// 策略名称：压缩脉冲
// 选择理由（一句话）：用前期贸易获取高效战斗与抽牌，随后压缩低效牌并连续压低对手权威。

export const meta = {
  name: 'KIMI 3.1pro · 压缩脉冲',
  description: 'kimi-k3.1-pro 自选策略「压缩脉冲」：前期保贸易节奏，中期精简牌库，以高效战斗、抽牌和同盟形成持续斩杀压力。'
};

const CHOICES = {
  patrolMech: [{ trade: 3 }, { combat: 5 }],
  blobWorld: [{ combat: 5 }, { drawBlobs: true }],
  barterWorld: [{ authority: 2 }, { trade: 2 }],
  defenseCenter: [{ authority: 3 }, { combat: 2 }],
  tradingPost: [{ authority: 1 }, { trade: 1 }],
  frontierStation: [{ trade: 2 }, { combat: 3 }],
  parasite: [{ combat: 6 }, { acquire: true }]
};

const SPECIAL = {
  fleetHQ: 8,
  commandCenter: 4,
  mechWorld: 4,
  brainWorld: 4,
  machineBase: 2,
  stealthNeedle: 4,
  stealthTower: 5,
  parasite: 3,
  blobCarrier: 3,
  mothership: 2,
  leviathan: 2
};

function card(view, uid) {
  return (uid && view && view.cards && view.cards[uid]) || {};
}

function self(view, playerId) {
  return (view && view.players && view.players[playerId]) || {};
}

function turnOf(view, context) {
  return Number(context && context.turn) || Number(view && view.turn) || 1;
}

function maxMatches(text, regex) {
  let best = 0;
  for (const match of String(text || '').matchAll(regex)) best = Math.max(best, Number(match[1]) || 0);
  return best;
}

function effect(text) {
  return {
    combat: maxMatches(text, /获得\s*(\d+)\s*战斗/g),
    trade: maxMatches(text, /获得\s*(\d+)\s*贸易/g),
    authority: maxMatches(text, /获得\s*(\d+)\s*权威/g),
    draw: maxMatches(text, /抽\s*(\d+)\s*张/g),
    discard: maxMatches(text, /对手弃\s*(\d+)\s*张/g)
  };
}

function mainEffect(view, uid) {
  return effect(String(card(view, uid).text || '').split('。')[0]);
}

function enemies(view, playerId) {
  const me = self(view, playerId);
  return ((view && view.players) || []).filter(player =>
    player && !player.eliminated && player.id !== playerId &&
    (me.team === null || me.team === undefined || player.team !== me.team)
  );
}

function authorityWeight(view, playerId) {
  const me = self(view, playerId);
  const foes = enemies(view, playerId);
  const lowest = foes.length ? Math.min(...foes.map(player => player.authority || 50)) : 50;
  if ((me.authority || 0) <= 12) return 1.15;
  if ((me.authority || 0) <= 24) return 0.75;
  return lowest <= 14 ? 0.2 : 0.42;
}

function factionCount(view, playerId, faction, memory) {
  if (!faction || faction === 'neutral') return 0;
  const me = self(view, playerId);
  let count = Math.min(4, Number(memory && memory.factions && memory.factions[faction]) || 0) * 0.5;
  for (const zone of ['hand', 'discard', 'inPlay', 'playedThisTurn']) {
    for (const uid of me[zone] || []) {
      const c = card(view, uid);
      if (c.faction === faction || (c.factions || []).includes(faction)) count += 0.35;
    }
  }
  return Math.min(5, count);
}

function cardQuality(view, uid, playerId, context, memory) {
  const c = card(view, uid);
  if (!c.id) return 0;
  const turn = turnOf(view, context);
  const tradeWeight = turn <= 7 ? 1.65 : turn <= 14 ? 1.25 : 0.95;
  const combatWeight = turn <= 5 ? 2.15 : 2.5;
  const text = c.text || '';
  const primary = mainEffect(view, uid);
  let value = primary.combat * combatWeight + primary.trade * tradeWeight +
    primary.authority * authorityWeight(view, playerId) + primary.draw * 5;

  const ally = (text.match(/同盟：([^。]+)/) || [])[1] || '';
  const allyEffect = effect(ally);
  const synergy = 0.2 + Math.min(0.8, factionCount(view, playerId, c.faction, memory) * 0.16);
  value += (allyEffect.combat * combatWeight + allyEffect.trade * tradeWeight +
    allyEffect.authority * authorityWeight(view, playerId) + allyEffect.draw * 4.5) * synergy;

  if (c.type === 'base') {
    value = value * 1.22 + (Number(c.defense) || 0) * 0.42 + (c.outpost ? 2.8 : 0);
  }
  if (/销毁手牌|销毁弃牌堆/.test(text)) value += 4.2;
  if (/目标对手弃/.test(text)) value += 1.6;
  if (/免费获得/.test(text)) value += 4.5 * Math.max(0.55, synergy);
  if (/复制/.test(text)) value += 3;
  if (/置入手牌/.test(text)) value += 2;
  if (/置于牌库顶/.test(text)) value += 1.2;
  if (/所有阵营/.test(text)) value += 2.5;
  value += SPECIAL[c.id] || 0;
  value -= (Number(c.cost) || 0) * (turn <= 7 ? 0.58 : 0.78);
  return value;
}

function handValue(view, uid, playerId, context) {
  const c = card(view, uid);
  const e = mainEffect(view, uid);
  const tradeWeight = turnOf(view, context) <= 7 ? 1.5 : 1;
  let value = e.combat * 2.25 + e.trade * tradeWeight + e.draw * 5 +
    e.authority * authorityWeight(view, playerId);
  if (/目标对手弃/.test(c.text || '')) value += 1.5;
  if (c.id === 'scout') value = 1.5;
  if (c.id === 'viper') value = 2.2;
  if (c.id === 'explorer') value = 4;
  return value;
}

function purgeGain(view, uid, playerId, context) {
  const id = card(view, uid).id;
  const turn = turnOf(view, context);
  if (id === 'viper') return 10;
  if (id === 'scout') return turn <= 5 ? 6 : 9;
  if (id === 'explorer') return turn <= 7 ? -3 : 3;
  return -Math.max(2, handValue(view, uid, playerId, context));
}

function cycleGain(view, uid, playerId, context) {
  const id = card(view, uid).id;
  if (id === 'viper' || id === 'scout') return 5;
  if (id === 'explorer') return turnOf(view, context) > 10 ? 2 : -1;
  return -handValue(view, uid, playerId, context);
}

function bestPurchase(view, playerId, trade, context, memory, above = -1) {
  let best = null;
  for (const uid of (view && view.tradeRow) || []) {
    const c = card(view, uid);
    const cost = Number(c.cost);
    if (!c.id || !Number.isFinite(cost) || cost > trade || cost <= above) continue;
    const quality = cardQuality(view, uid, playerId, context, memory);
    if (!best || quality > best.quality) best = { uid, cost, quality };
  }
  return best;
}

function unlockBonus(view, playerId, extraTrade, context, memory) {
  if (!extraTrade) return 0;
  const me = self(view, playerId);
  const unlocked = bestPurchase(view, playerId, (me.trade || 0) + extraTrade, context, memory, me.trade || 0);
  return unlocked ? 9 + Math.max(0, unlocked.quality) * 1.4 : 0;
}

function hasOutpost(view, player) {
  return (player.inPlay || []).some(uid => card(view, uid).outpost);
}

function canRoughlyHit(view, playerId, target) {
  if (hasOutpost(view, target)) return false;
  if (view.mode !== 'team2v2') return true;
  const team = (view.teams || []).find(item => item.id === target.team);
  return !(team && team.players.some(id => hasOutpost(view, view.players[id])));
}

function choiceValue(view, action, playerId, context, memory) {
  const c = card(view, action.cardId);
  const me = self(view, playerId);
  if (c.id === 'recyclingStation' && action.choice === 1) {
    return (action.targets || []).reduce((sum, uid) => sum + cycleGain(view, uid, playerId, context), 0) * 2;
  }
  const choice = (CHOICES[c.id] || [])[action.choice];
  if (!choice) return 0;
  if (choice.drawBlobs) {
    const count = (me.playedThisTurn || []).filter(uid => {
      const played = card(view, uid);
      return played.faction === 'blob' || (played.factions || []).includes('blob');
    }).length;
    return count * 5.4;
  }
  if (choice.acquire) {
    return action.row === undefined ? -10 : cardQuality(view, view.tradeRow[action.row], playerId, context, memory) * 1.65 + 5;
  }
  let value = (choice.combat || 0) * 2.5 + (choice.trade || 0) * 1.5 +
    (choice.authority || 0) * authorityWeight(view, playerId);
  value += unlockBonus(view, playerId, choice.trade || 0, context, memory);
  if (choice.combat && enemies(view, playerId).some(target =>
    canRoughlyHit(view, playerId, target) && target.authority <= (me.combat || 0) + choice.combat
  )) value += 60;
  return value;
}

function baseThreat(view, uid, playerId, context, memory) {
  const c = card(view, uid);
  const e = mainEffect(view, uid);
  let threat = e.combat * 1.8 + e.trade * 1.35 + e.draw * 5 + e.authority * 0.55;
  if (/目标对手弃/.test(c.text || '')) threat += 2.5;
  if (/免费获得|复制|置于牌库顶|置入手牌/.test(c.text || '')) threat += 4;
  threat += SPECIAL[c.id] || 0;
  threat += cardQuality(view, uid, playerId, context, memory) * 0.15;
  return Math.max(1, threat);
}

function playScore(view, action, playerId, context, memory) {
  const c = card(view, action.cardId);
  const e = mainEffect(view, action.cardId);
  let score = 500 + e.draw * 12 + e.combat * 0.5 + e.trade * 0.35;
  score += unlockBonus(view, playerId, e.trade, context, memory);
  if (action.choice !== undefined) score += choiceValue(view, action, playerId, context, memory);
  if (action.copy) score += 8 + cardQuality(view, action.copy, playerId, context, memory) * 1.4;
  if (action.row !== undefined && /免费获得/.test(c.text || '')) {
    score += 8 + cardQuality(view, view.tradeRow[action.row], playerId, context, memory) * 1.5;
  }
  return score;
}

function rowScrapScore(view, action, playerId, context, memory) {
  const rows = action.rows || [action.row];
  let score = 390;
  for (const row of rows) {
    const uid = view.tradeRow[row];
    const c = card(view, uid);
    const quality = cardQuality(view, uid, playerId, context, memory);
    if ((self(view, playerId).trade || 0) >= (Number(c.cost) || 0) && quality > 6) return -40;
    score += quality > 9 ? quality * 0.8 : 7 - quality * 0.35;
  }
  return score;
}

function scrapAbilityScore(view, action, playerId, context, memory) {
  const c = card(view, action.cardId);
  const text = c.text || '';
  const section = (text.match(/销毁：([^。]+)/) || [])[1] || '';
  const e = effect(section);
  const loss = c.type === 'base'
    ? 8 + baseThreat(view, action.cardId, playerId, context, memory) * 0.65
    : Math.max(0, cardQuality(view, action.cardId, playerId, context, memory) * 0.25);
  if (action.targetId) return 470 + baseThreat(view, action.targetId, playerId, context, memory) * 4 - loss;
  if (/摧毁/.test(section) && !action.targetId) return -80;
  let score = 235;
  if (e.trade) {
    const unlock = unlockBonus(view, playerId, e.trade, context, memory);
    score = unlock ? 500 + unlock : 225 + e.trade * 2;
  } else if (e.combat) score = 250 + e.combat * 2.2;
  else if (e.draw) score = 145 + e.draw * 8;
  else if (e.discard) score = 150 + e.discard * 5;
  if (c.id === 'explorer') score += 12;
  return score - loss;
}

function abilityScore(view, action, playerId, context, memory) {
  const c = card(view, action.cardId);
  const text = c.text || '';
  if (action.ability === 'scrap') return scrapAbilityScore(view, action, playerId, context, memory);

  if (action.targets && /销毁手牌|销毁弃牌堆/.test(text)) {
    const gain = (action.targets || []).reduce((sum, uid) => sum + purgeGain(view, uid, playerId, context), 0);
    if (!action.targets.length || gain <= 0) return -35;
    return 535 + gain * 2 + (/每销毁一张便抽/.test(text) ? action.targets.length * 8 : 0);
  }
  if (action.targets && /弃至多两张牌，每弃一张获得/.test(text)) {
    const gain = (action.targets || []).reduce((sum, uid) => sum + cycleGain(view, uid, playerId, context), 0);
    if (!action.targets.length || gain <= 0) return -30;
    const resource = action.resource === 'combat' ? 'combat' : 'trade';
    return 515 + gain + (resource === 'combat' ? action.targets.length * 5 :
      unlockBonus(view, playerId, action.targets.length * 2, context, memory));
  }
  if (action.targets && /弃至多两张牌|弃 1 张牌，然后抽/.test(text)) {
    const gain = (action.targets || []).reduce((sum, uid) => sum + cycleGain(view, uid, playerId, context), 0);
    if (!action.targets.length || gain <= 0) return -30;
    return 520 + gain * 2;
  }
  if (action.row !== undefined && /免费获得/.test(text)) {
    return 490 + cardQuality(view, view.tradeRow[action.row], playerId, context, memory) * 2;
  }
  if (action.targetId && /摧毁/.test(text)) {
    let score = 465 + baseThreat(view, action.targetId, playerId, context, memory) * 4;
    if (action.row !== undefined) score += Math.max(0, rowScrapScore(view, action, playerId, context, memory) - 390);
    return score;
  }
  if ((action.row !== undefined || action.rows) && /销毁交易行/.test(text)) {
    return rowScrapScore(view, action, playerId, context, memory);
  }

  let score = action.ability === 'ally' ? 425 : 405;
  if (action.choice !== undefined) score += choiceValue(view, action, playerId, context, memory);
  const section = action.ability === 'ally'
    ? (text.match(/同盟：([^。]+)/) || [])[1] || ''
    : text.split('。')[0];
  const e = effect(section);
  score += e.draw * 11 + e.combat * 0.5 + e.trade * 0.4 + e.authority * 0.25;
  score += unlockBonus(view, playerId, e.trade, context, memory);
  if (/销毁手牌/.test(text) && !action.targets) score += 10;
  return score;
}

function buyScore(view, action, playerId, context, memory) {
  const me = self(view, playerId);
  const turn = turnOf(view, context);
  let quality;
  if (action.explorer) {
    quality = turn <= 7 ? 6 : turn <= 13 ? 3.4 : 1.7;
    if ((me.deckCount || 0) <= 2) quality += 0.8;
  } else {
    const uid = view.tradeRow[action.row];
    const c = card(view, uid);
    quality = cardQuality(view, uid, playerId, context, memory);
    if (me.topDeckNextAny || (c.type === 'ship' && me.topDeckNextShip)) quality += 2;
    if (c.toHandIfFaction || /若本回合打出过.*置入手牌/.test(c.text || '')) quality += 0.7;
  }
  if (turn > 9 && quality < 2) return -15;
  return 300 + quality * 5;
}

function firstBloodWinner(view, targetId) {
  const players = view.players || [];
  if (!players.length) return null;
  let index = targetId;
  for (let count = 0; count < players.length; count++) {
    index = (index - 1 + players.length) % players.length;
    if (!players[index].eliminated) return index;
  }
  return null;
}

function attackScore(view, action, playerId, context, memory) {
  const me = self(view, playerId);
  if (action.targetType === 'base') {
    const c = card(view, action.targetId);
    const needed = Math.max(1, (Number(c.defense) || 1) - ((view.damage || {})[action.targetId] || 0));
    if (action.amount < needed) return -90;
    return 170 + baseThreat(view, action.targetId, playerId, context, memory) * 5 +
      (c.outpost ? 32 : 0) - action.amount * 0.25;
  }
  const target = (view.players || [])[action.targetId] || {};
  if (view.mode === 'firstBlood' && action.amount >= target.authority && firstBloodWinner(view, action.targetId) !== playerId) return -500;
  let score = 205 + action.amount * 2.4;
  if (view.mode === 'ffa') score += Math.max(0, 35 - (target.authority || 0)) * 0.25;
  if ((me.combat || 0) === action.amount) score += 2;
  return score;
}

function transferScore(view, action, legalActions) {
  if (action.resource === 'trade') {
    if (action.amount < 2) return -12;
    const canBuy = legalActions.some(item => item.type === 'buy');
    return (canBuy ? 20 : 42) + action.amount * 0.3;
  }
  const canAttack = legalActions.some(item => item.type === 'attack');
  return (canAttack ? 5 : 34) + action.amount * 0.2;
}

function pendingChoice(view, legalActions, playerId, context) {
  const pending = view.pending || {};
  if (pending.type === 'discard') {
    return pick(legalActions, action => -handValue(view, action.cardId, playerId, context));
  }
  if (pending.type === 'scrapMandatory') {
    return pick(legalActions, action => purgeGain(view, action.cardId, playerId, context));
  }
  if (pending.type === 'targetDiscard') {
    return pick(legalActions, action => {
      const target = view.players[action.targetId] || {};
      const count = view.players.length || 1;
      const distance = (action.targetId - view.activePlayer + count) % count;
      return (target.handCount || 0) * 6 + (count - distance) * 2 + (target.authority || 0) * 0.03;
    });
  }
  if (pending.type !== 'eventChoice') return legalActions[0];

  return pick(legalActions, action => {
    const me = self(view, playerId);
    if (pending.eventId === 'blackHole') {
      const count = (action.targets || []).length;
      const authority = me.authority || 0;
      const before = Math.min(Math.max(0, authority - 1), 8);
      const after = Math.min(Math.max(0, authority - 1), 4 * (2 - count));
      return (before - after) * 1.2 - (action.targets || []).reduce(
        (sum, uid) => sum + handValue(view, uid, playerId, context) * 0.7, 0
      );
    }
    if (pending.eventId === 'comet') {
      return (action.targets || []).reduce((sum, uid) => sum + Math.max(0, purgeGain(view, uid, playerId, context)), 0);
    }
    if (pending.eventId === 'bombardment') {
      if (action.pay) return (me.authority || 0) <= 7 ? 100 : 7.2 * authorityWeight(view, playerId);
      return baseThreat(view, action.baseId, playerId, context, null) * 0.75;
    }
    if (pending.eventId === 'warpJump') {
      const cards = action.cards || [];
      return -cards.reduce((sum, uid) => sum + handValue(view, uid, playerId, context), 0) +
        (cards.length ? handValue(view, cards[0], playerId, context) * 0.01 : 0);
    }
    return 0;
  });
}

function pick(legalActions, score) {
  let best = legalActions[0];
  let bestScore = -Infinity;
  for (const action of legalActions) {
    const value = Number(score(action));
    if (Number.isFinite(value) && value > bestScore) {
      best = action;
      bestScore = value;
    }
  }
  return best;
}

function rememberBuy(memory, view, action) {
  if (!memory || !view) return;
  const uid = action.explorer ? null : view.tradeRow[action.row];
  const id = action.explorer ? 'explorer' : card(view, uid).id;
  if (!id) return;
  memory.buys = memory.buys || [];
  memory.buys.push(id);
  memory.factions = memory.factions || {};
  const faction = action.explorer ? 'neutral' : card(view, uid).faction;
  if (faction && faction !== 'neutral') memory.factions[faction] = (memory.factions[faction] || 0) + 1;
}

export function chooseAction({ view, legalActions, playerId, memory, context }) {
  if (!Array.isArray(legalActions) || !legalActions.length) return undefined;
  try {
    if (view.pending) return pendingChoice(view, legalActions, playerId, context);

    let lethal = null;
    for (const action of legalActions) {
      if (action.type !== 'attack' || action.targetType !== 'player') continue;
      const target = view.players[action.targetId] || {};
      if (action.amount < target.authority) continue;
      if (view.mode === 'firstBlood' && firstBloodWinner(view, action.targetId) !== playerId) continue;
      if (!lethal || action.amount < lethal.amount) lethal = action;
    }
    if (lethal) return lethal;

    const selected = pick(legalActions, action => {
      switch (action.type) {
        case 'play': return playScore(view, action, playerId, context, memory);
        case 'ability': return abilityScore(view, action, playerId, context, memory);
        case 'buy': return buyScore(view, action, playerId, context, memory);
        case 'attack': return attackScore(view, action, playerId, context, memory);
        case 'transfer': return transferScore(view, action, legalActions);
        case 'endTurn': return 0;
        default: return -10000;
      }
    });
    if (selected.type === 'buy') rememberBuy(memory, view, selected);
    return selected;
  } catch (error) {
    if (!view || !view.pending) {
      const end = legalActions.find(action => action && action.type === 'endTurn');
      if (end) return end;
    }
    return legalActions[0];
  }
}
