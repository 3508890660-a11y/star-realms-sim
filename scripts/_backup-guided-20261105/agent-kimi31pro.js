// KIMI 3.1pro：局面推演。零依赖，只读取视图并返回原合法动作对象。

export const meta = {
  name: 'KIMI 3.1pro · 局面推演',
  description: 'kimi-k3.1-pro 的局面推演策略：综合模式、回合、权威差、前哨、牌组质量与剩余资源，对合法动作进行多因素评分，并对事件选择作保守修正。'
};

const finite = (value, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const array = value => Array.isArray(value) ? value : [];

function decide({ view = {}, legalActions = [], playerId = 0, context = {} }) {
  const players = array(view.players);
  const cards = view.cards && typeof view.cards === 'object' ? view.cards : {};
  const me = players[playerId] || {};
  const mode = context.mode || view.mode || 'standard';
  const turn = finite(context.turn, finite(view.turn, 1));
  const isTeam = mode === 'team2v2';
  const initialAuthority = isTeam ? 75 : 50;
  const authority = finite(me.authority, initialAuthority);
  const enemies = players.filter(player => player && player.id !== playerId &&
    !player.eliminated && (!isTeam || player.team !== me.team));
  const enemyAuthorities = enemies.map(player => finite(player.authority, initialAuthority));
  const weakestAuthority = enemyAuthorities.length ? Math.min(...enemyAuthorities) : initialAuthority;
  const averageEnemyAuthority = enemyAuthorities.length
    ? enemyAuthorities.reduce((sum, value) => sum + value, 0) / enemyAuthorities.length
    : initialAuthority;

  const card = uid => uid != null && cards[uid] ? cards[uid] : null;
  const tradeRow = array(view.tradeRow);
  const damage = view.damage && typeof view.damage === 'object' ? view.damage : {};

  // 所有攻击先检查终结条件，避免普通效用分淹没 lethal。
  for (const action of legalActions) {
    if (action && action.type === 'attack' && action.targetType === 'player') {
      const target = players[action.targetId];
      if (target && finite(action.amount) >= finite(target.authority, initialAuthority)) return action;
    }
  }

  function sumMatches(text, regex) {
    let total = 0;
    for (const match of text.matchAll(regex)) total += finite(Number(match[1]));
    return total;
  }

  function profile(text) {
    const source = typeof text === 'string' ? text : '';
    return {
      trade: sumMatches(source, /(\d+)\s*贸易/g),
      combat: sumMatches(source, /(\d+)\s*战斗/g),
      authority: sumMatches(source, /(\d+)\s*权威/g),
      draw: sumMatches(source, /抽\s*(\d+)\s*张/g),
      disrupt: /目标对手/.test(source) ? sumMatches(source, /弃\s*(\d+)\s*张牌/g) : 0,
      destroyBase: /摧毁[^。]*基地/.test(source),
      thin: /销毁手牌|手牌或弃牌堆|手牌和\/或弃牌堆/.test(source),
      free: /免费获得/.test(source)
    };
  }

  function cardValue(uid) {
    const item = card(uid);
    if (!item) return 1.5;
    if (item.id === 'scout') return 0.8;
    if (item.id === 'viper') return 0.9;
    if (item.id === 'explorer') return 2.1;
    const effect = profile(item.text);
    let value = 1.2 + clamp(finite(item.cost, 2), 0, 9) * 0.8;
    value += effect.trade * 0.65 + effect.combat * 0.7 + effect.authority * 0.8;
    value += effect.draw * 1.7 + effect.disrupt * 1.2;
    if (item.type === 'base') value += 2.2 + finite(item.defense, 4) * 0.25;
    if (item.outpost) value += 2.5;
    if (effect.free) value += 2;
    if (effect.destroyBase) value += 1;
    if (effect.thin) value += 0.8;
    return clamp(value, 0.5, 25);
  }

  // 隐藏牌库只按可见牌估值的保守均值补齐，不读取任何隐藏顺序。
  const visibleOwnCards = [me.hand, me.discard, me.inPlay]
    .flatMap(zone => array(zone));
  const visibleValue = visibleOwnCards.reduce((sum, uid) => sum + cardValue(uid), 0);
  const visibleAverage = visibleOwnCards.length ? visibleValue / visibleOwnCards.length : 1.4;
  const deckCount = finite(me.deckCount);
  const deckAverage = (visibleValue + deckCount * clamp(visibleAverage, 1.2, 3.2)) /
    Math.max(1, visibleOwnCards.length + deckCount);

  const early = clamp((8 - turn) / 7, 0, 1);
  const late = clamp((turn - 9) / 12, 0, 1);
  const danger = clamp((initialAuthority - authority) / initialAuthority, 0, 1);
  const lead = clamp((authority - averageEnemyAuthority) / initialAuthority, -1, 1);
  const enemyOutposts = enemies.reduce((count, player) => count +
    array(player.inPlay).filter(uid => card(uid)?.outpost).length, 0);
  const eventsEnabled = !!view.expansions?.events || array(view.expansions?.sets).includes('events');

  const weights = {
    damage: (8 + 4 * late + 2 * Math.max(0, lead)) * (mode === 'ffa' ? 0.85 : 1),
    heal: (3 + 10 * danger) * (eventsEnabled ? 1.15 : 1),
    trade: 1.8 + 2.2 * early,
    deck: Math.max(2.5, 5 + 4 * early - 2 * late),
    draw: 2.8 + 1.2 * early,
    defense: 4 + 7 * danger + (eventsEnabled ? 1 : 0),
    team: 2.5
  };
  weights.combat = weights.damage * (enemyOutposts ? 0.9 : 0.7);
  if (mode === 'hunter' || mode === 'firstBlood') weights.damage *= 1.12;
  if (mode === 'firstBlood' && playerId === 0) {
    weights.heal *= 1.8;
    weights.defense *= 1.6;
    weights.damage *= 0.82;
  }

  function effectScore(effect) {
    return effect.trade * weights.trade + effect.combat * weights.combat +
      effect.authority * weights.heal + effect.draw * weights.draw +
      effect.disrupt * 3 + (effect.thin ? weights.deck * 0.35 : 0) +
      (effect.free ? weights.deck * 0.8 : 0);
  }

  function selectedText(text, choice) {
    if (choice === undefined || typeof text !== 'string') return text || '';
    const match = text.match(/选择：([^。]+)/);
    if (!match) return text;
    const options = match[1].split(/；?或/);
    return text.replace(match[0], options[choice] || options[0]);
  }

  function abilityText(item, kind, choice) {
    let text = selectedText(item?.text, choice);
    if (kind === 'ally') {
      const at = text.indexOf('同盟');
      text = at >= 0 ? text.slice(at) : '';
      const scrap = text.indexOf('销毁：');
      if (scrap >= 0) text = text.slice(0, scrap);
    } else if (kind === 'scrap') {
      const at = text.indexOf('销毁：');
      text = at >= 0 ? text.slice(at + 3) : '';
    } else if (kind === 'optional') {
      text = text.split('。').filter(part => part.trim().startsWith('可')).join('。');
    } else {
      text = text.split('同盟')[0].split('销毁：')[0]
        .split('。').filter(part => !part.trim().startsWith('可')).join('。');
    }
    return text;
  }

  function acquiredRowScore(action, free) {
    const rows = action.rows || (action.row !== undefined ? [action.row] : []);
    let score = 0;
    for (const row of rows) {
      const uid = tradeRow[row];
      const gain = cardValue(uid) - deckAverage;
      score += free ? weights.deck * (gain + 1.5) : 2 + cardValue(uid) * 0.15;
    }
    return score;
  }

  function selectedCardsScore(action, permanent) {
    let score = 0;
    for (const uid of array(action.targets)) {
      const difference = deckAverage - cardValue(uid);
      score += difference * weights.deck * (permanent ? 1.2 : 0.55);
      const item = card(uid);
      if (permanent && (item?.id === 'scout' || item?.id === 'viper')) score += 5;
    }
    return score;
  }

  function enemyBaseScore(uid, destroyed) {
    const item = card(uid);
    if (!destroyed) return -30000;
    return 70000 + (item?.outpost ? 60000 : 0) +
      cardValue(uid) * 3 + (item?.outpost ? weights.combat * 4 : 0);
  }

  function eventScore(action) {
    const eventId = action.eventId || view.pending?.kind || '';
    const targets = array(action.targets);
    const putBack = array(action.cards);
    const caution = 1.25 + danger;
    if (eventId === 'blackHole') {
      const authorityLoss = Math.max(0, 2 - targets.length) * 4;
      return -authorityLoss * weights.heal * caution -
        targets.reduce((sum, uid) => sum + cardValue(uid) * 0.8, 0);
    }
    if (eventId === 'bombardment') {
      if (action.pay) return -Math.min(6, Math.max(0, authority - 1)) * weights.heal * caution;
      const item = card(action.baseId);
      return -cardValue(action.baseId) * weights.deck * 0.7 -
        (item?.outpost ? weights.defense * 2 : 1);
    }
    if (eventId === 'comet') return selectedCardsScore(action, true);
    if (eventId === 'warpJump') {
      return -putBack.reduce((sum, uid) => sum + cardValue(uid), 0) * 0.6;
    }
    // 新事件优先无支付、无弃牌、无拆基地的安全分支。
    let score = 0;
    if (action.pay) score -= 6 * weights.heal * caution;
    if (action.baseId) score -= cardValue(action.baseId) * weights.deck;
    for (const uid of [...targets, ...putBack]) score -= cardValue(uid);
    return score;
  }

  function score(action) {
    if (!action || typeof action !== 'object') return -1000000;
    switch (action.type) {
      case 'play': {
        const item = card(action.copy) || card(action.cardId);
        const text = item?.type === 'base' ? '' : abilityText(item, 'primary', action.choice);
        let value = 30000 + effectScore(profile(text));
        if (item?.type === 'base') value += weights.defense + cardValue(action.cardId);
        if (item?.outpost) value += weights.defense * 2;
        if (action.copy) value += cardValue(action.copy) * 0.4;
        value += acquiredRowScore(action, true);
        return value;
      }
      case 'ability': {
        const item = card(action.cardId);
        let value = 28000 + effectScore(profile(abilityText(item, action.ability, action.choice)));
        if (action.ability === 'ally') value += 600;
        if (action.targetId) value += enemyBaseScore(action.targetId, true) * 0.75;
        value += acquiredRowScore(action, action.ability === 'ally');
        value += selectedCardsScore(action, true);
        if (action.resource) {
          value += array(action.targets).length * 2 *
            (action.resource === 'combat' ? weights.combat : weights.trade);
        }
        if (action.ability === 'scrap') value -= cardValue(action.cardId) * weights.deck * 0.35;
        return value;
      }
      case 'buy': {
        const uid = action.explorer ? null : tradeRow[action.row];
        const item = card(uid);
        const cost = action.explorer ? 2 : finite(item?.cost, 2);
        const quality = action.explorer ? 2.1 - deckAverage : cardValue(uid) - deckAverage;
        let value = 12000 + quality * weights.deck * 2 - cost * weights.trade * 0.3;
        value += effectScore(profile(item?.text)) * 0.3;
        if (item?.type === 'base') value += weights.defense;
        if (item?.outpost) value += weights.defense * 2;
        return value;
      }
      case 'attack': {
        const amount = finite(action.amount);
        if (action.targetType === 'base') {
          const item = card(action.targetId);
          const remaining = finite(item?.defense, 1) - finite(damage[action.targetId]);
          return enemyBaseScore(action.targetId, amount >= remaining) + amount * 0.01;
        }
        const target = players[action.targetId] || {};
        const targetAuthority = finite(target.authority, initialAuthority);
        let value = 6000 + amount * weights.damage;
        if (targetAuthority <= weakestAuthority + 1) value += 300;
        if (mode === 'ffa') value += array(target.inPlay).length * 20;
        return value;
      }
      case 'transfer':
        return 2000 + finite(action.amount) * weights.team;
      case 'discard':
        return -cardValue(action.cardId) * 10;
      case 'selectScrap':
        return (deckAverage - cardValue(action.cardId)) * weights.deck * 2;
      case 'targetDiscard': {
        const target = players[action.targetId] || {};
        return finite(target.handCount) * 5 + array(target.inPlay).length * 2 +
          (initialAuthority - finite(target.authority, initialAuthority)) * 0.2;
      }
      case 'eventChoice':
        return eventScore(action);
      case 'endTurn': {
        const wastedTrade = legalActions.some(item => item?.type === 'buy') ? finite(me.trade) : 0;
        const wastedCombat = legalActions.some(item => item?.type === 'attack' &&
          (item.targetType === 'player' || enemyBaseScore(item.targetId, true) > 0)) ? finite(me.combat) : 0;
        return -10000 - wastedTrade * weights.trade - wastedCombat * weights.combat;
      }
      default:
        return -100000;
    }
  }

  let best = legalActions[0];
  let bestScore = -Infinity;
  for (const action of legalActions) {
    let value;
    try { value = score(action); } catch { value = -1000000; }
    if (!Number.isFinite(value)) value = -1000000;
    if (value > bestScore) {
      best = action;
      bestScore = value;
    }
  }
  return best;
}

export function chooseAction(options = {}) {
  const legalActions = Array.isArray(options.legalActions) ? options.legalActions : [];
  if (!legalActions.length) return legalActions[0];
  try {
    const chosen = decide({ ...options, legalActions });
    return legalActions.includes(chosen) ? chosen : legalActions[0];
  } catch {
    return legalActions[0];
  }
}
