// 策略名称：薄牌护城河（Lean Deck Rampart）
// 选择理由：1v1 中牌组压缩带来复利、权威增益等效永久回血，二者构成的护城河比一次性战斗爆发更稳，待对手攻势衰竭再以战斗临界斩杀。

export const meta = {
  name: 'hy4 · 薄牌护城河',
  description: 'hy4std 自选策略「薄牌护城河」：销毁废牌做复利、集中阵营滚经济、用权威增益拉出不可击穿的血线，只在出现斩杀窗口或血线告急时才切换攻防，比 1v1 里堆一次性战斗更稳。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function textEffects(text) {
  const e = { trade: 0, combat: 0, authority: 0, draw: 0, scrap: 0, discard: 0 };
  if (typeof text !== 'string' || !text) return e;
  try {
    let m;
    const res = /(\d+)\s*(贸易|战斗|权威)/g;
    while ((m = res.exec(text)) !== null) {
      const n = num(parseInt(m[1], 10), 0);
      if (m[2] === '贸易') e.trade += n;
      else if (m[2] === '战斗') e.combat += n;
      else e.authority += n;
    }
    const dr = /抽\s*(\d+)\s*张牌/g;
    while ((m = dr.exec(text)) !== null) e.draw += num(parseInt(m[1], 10), 0);
    if (/销毁/.test(text)) e.scrap += 1;
    if (/弃\s*\d+\s*张牌|目标对手弃|弃牌/.test(text)) e.discard += 1;
  } catch (_) {
    // 文本解析失败时按零值回退
  }
  return e;
}

function splitChoices(text) {
  if (typeof text !== 'string' || !text) return [];
  try {
    const m = text.match(/选择[：:]([\s\S]+)$/);
    if (!m) return [];
    return m[1].split(/；或|或|；/).map(s => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function choiceEffects(text, choice) {
  const opts = splitChoices(text);
  const idx = num(choice, 0);
  if (opts.length && idx >= 0 && idx < opts.length) return textEffects(opts[idx]);
  return textEffects(text);
}

function cardValue(view, uid) {
  const c = view && view.cards ? view.cards[uid] : null;
  if (!c) return 0;
  if (c.id === 'scout') return 0.3;
  if (c.id === 'viper') return 0.4;
  if (c.id === 'explorer') return 1.4;
  let v = num(c.cost, 0);
  if (c.type === 'base') v += 1.5 + num(c.defense, 0) * 0.15;
  if (c.outpost) v += 1.2;
  const e = textEffects(c.text);
  v += e.trade * 0.22 + e.combat * 0.2 + e.authority * 0.26 + e.draw * 0.5 + e.scrap * 0.35 + e.discard * 0.3;
  return v;
}

function junkValue(view, uid) {
  const c = view && view.cards ? view.cards[uid] : null;
  if (!c) return 0;
  if (c.id === 'scout' || c.id === 'viper') return 3;
  if (c.id === 'explorer') return 1.2;
  if (num(c.cost, 0) <= 1 && c.type === 'ship') return 0.4;
  return -cardValue(view, uid);
}

function factionSynergy(view, playerId, faction) {
  if (!faction || faction === 'neutral') return 0;
  const me = view && view.players ? view.players[playerId] : null;
  if (!me) return 0;
  let n = 0;
  for (const zone of ['hand', 'discard', 'inPlay']) {
    const list = me[zone];
    if (!Array.isArray(list)) continue;
    for (const uid of list) {
      const c = view.cards ? view.cards[uid] : null;
      if (!c) continue;
      if (c.faction === faction) n++;
      else if (Array.isArray(c.factions) && c.factions.indexOf(faction) >= 0) n++;
    }
  }
  return n;
}

function allyBonus(view, playerId, card) {
  if (!card) return 0;
  const fs = Array.isArray(card.factions) ? card.factions : (card.faction ? [card.faction] : []);
  if (!fs.length) return 0;
  const me = view && view.players ? view.players[playerId] : null;
  const inPlay = me && Array.isArray(me.inPlay) ? me.inPlay : [];
  for (const uid of inPlay) {
    const c = view.cards ? view.cards[uid] : null;
    if (!c) continue;
    const of = Array.isArray(c.factions) ? c.factions : (c.faction ? [c.faction] : []);
    for (const f of fs) {
      if (f && f !== 'neutral' && of.indexOf(f) >= 0) return 3;
    }
  }
  return 0;
}

function buildCtx(view, playerId, legalActions) {
  const players = view && Array.isArray(view.players) ? view.players : [];
  const me = players[playerId] || {};
  const myAuth = num(me.authority, 50);
  const myTrade = num(me.trade, 0);
  const myCombat = num(me.combat, 0);
  const opps = [];
  for (let i = 0; i < players.length; i++) {
    if (i === playerId) continue;
    const p = players[i] || {};
    if (p.eliminated) continue;
    opps.push({ id: i, authority: num(p.authority, 50), handCount: num(p.handCount, 0) });
  }
  const minOppAuth = opps.length ? Math.min.apply(null, opps.map(o => o.authority)) : 50;
  const guard = clamp((34 - myAuth) / 34 + 0.15, 0.1, 1.6);
  let lethal = false;
  for (let i = 0; i < legalActions.length; i++) {
    const a = legalActions[i];
    if (a && a.type === 'attack' && a.targetType === 'player') {
      const ta = num((players[a.targetId] || {}).authority, 50);
      if (num(a.amount, 0) >= ta) { lethal = true; break; }
    }
  }
  const nearKill = !lethal && minOppAuth <= myCombat + 6;
  const aggro = lethal ? 3 : (nearKill ? 1.7 : (myAuth < 18 ? 1.15 : 0.7));
  const greed = lethal ? 0.25 : clamp(1.2 - guard * 0.45, 0.3, 1.15);
  const handLeft = Array.isArray(me.hand) ? me.hand.length : 0;
  const played = Array.isArray(me.playedThisTurn) ? me.playedThisTurn.length : 0;
  const total = handLeft + played;
  const progress = total > 0 ? played / total : 1;
  return { players, me, myAuth, myTrade, myCombat, opps, minOppAuth, guard, lethal, aggro, greed, progress };
}

function scoreEventChoice(view, ctx, a) {
  const cards = view && view.cards ? view.cards : {};
  const targets = Array.isArray(a.targets) ? a.targets : [];
  switch (a.eventId) {
    case 'blackHole': {
      let loss = 0;
      for (const uid of targets) loss += cardValue(view, uid);
      loss += 4 * (2 - targets.length) * ctx.guard * 0.7;
      return 40 - loss;
    }
    case 'comet': {
      let s = 20 + targets.length * 2;
      for (const uid of targets) s += junkValue(view, uid) * 2;
      return s;
    }
    case 'bombardment': {
      if (a.pay) return 30 - 6 * ctx.guard * 0.7;
      const c = cards[a.baseId] || {};
      let loss = 2 + cardValue(view, a.baseId) * 1.4;
      if (c.outpost) loss += 6;
      return 30 - loss;
    }
    case 'warpJump': {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 22;
      for (const uid of cs) s -= cardValue(view, uid) * 2;
      return s;
    }
    default:
      return 10;
  }
}

function scoreAction(view, playerId, ctx, a) {
  if (!a || typeof a !== 'object') return -1;
  const players = ctx.players;
  const cards = view && view.cards ? view.cards : {};
  const tradeRow = view && Array.isArray(view.tradeRow) ? view.tradeRow : [];

  switch (a.type) {
    case 'attack': {
      if (a.targetType === 'player') {
        const ta = num((players[a.targetId] || {}).authority, 50);
        const amt = num(a.amount, 0);
        if (amt >= ta) return 10000 + (50 - amt);
        let s = 16 + amt * ctx.aggro + (ta < 15 ? 8 : 0);
        s *= 0.3 + 0.7 * ctx.progress;
        return s;
      }
      const c = cards[a.targetId];
      let s = 16 + num(c && c.cost, 0) * 0.5 + num(c && c.defense, 0) * 0.5;
      if (c && c.outpost) s += 26;
      if (ctx.lethal) s *= 0.4;
      return s;
    }
    case 'play': {
      const c = cards[a.cardId] || {};
      const e = a.choice !== undefined ? choiceEffects(c.text, a.choice) : textEffects(c.text);
      let s = 12;
      s += e.trade * (0.5 + 0.7 * ctx.greed);
      s += e.combat * 0.45 * ctx.aggro;
      s += e.authority * 0.5 * ctx.guard;
      s += e.draw * 1.2;
      s += allyBonus(view, playerId, c);
      if (c.type === 'base') s += 3 + num(c.defense, 0) * 0.2;
      if (c.outpost) s += 3 * ctx.guard;
      if (a.copy) s += 2;
      if (a.row !== undefined && a.row !== null) s += 2 + cardValue(view, tradeRow[a.row]) * 0.9;
      return s;
    }
    case 'ability': {
      const c = cards[a.cardId] || {};
      switch (a.ability) {
        case 'ally': {
          let s = 11;
          if (a.row !== undefined && a.row !== null) s += 2 + cardValue(view, tradeRow[a.row]) * 0.9;
          if (a.targetId !== undefined && a.targetId !== null) s += 12;
          if (Array.isArray(a.targets)) {
            for (const uid of a.targets) s += junkValue(view, uid) > 0 ? 2 : -2;
          }
          return s;
        }
        case 'primary': {
          const e = a.choice !== undefined ? choiceEffects(c.text, a.choice) : textEffects(c.text);
          let s = 9;
          s += e.trade * 0.3 + e.combat * 0.3 * ctx.aggro + e.authority * 0.4 * ctx.guard + e.draw * 0.8;
          if (Array.isArray(a.targets)) {
            for (const uid of a.targets) s += junkValue(view, uid) > 0 ? 2.5 : -3;
          }
          if (a.resource === 'combat') s += 2 * ctx.aggro;
          else if (a.resource === 'trade') s += 1;
          return s;
        }
        case 'optional': {
          if (Array.isArray(a.targets)) {
            let q = 0;
            for (const uid of a.targets) q += junkValue(view, uid) > 0 ? 3 : -4;
            return q;
          }
          if (a.targetId !== undefined && a.targetId !== null) return 14;
          if (a.row !== undefined && a.row !== null) return 3;
          if (Array.isArray(a.rows)) return 3;
          return 4;
        }
        case 'scrap': {
          const e = textEffects(c.text);
          let s = 7 + e.trade * 0.2 + e.combat * 0.25 * ctx.aggro + e.draw * 0.6;
          if (a.targetId !== undefined && a.targetId !== null) s += 10;
          if (c.type === 'base') s -= 3;
          return s;
        }
        default:
          return 6;
      }
    }
    case 'buy': {
      if (a.explorer) return 6 * ctx.greed + (ctx.myTrade <= 3 ? 3 : 0);
      const c = cards[tradeRow[a.row]];
      if (!c) return 0;
      let v = cardValue(view, tradeRow[a.row]);
      const syn = factionSynergy(view, playerId, c.faction);
      v *= 1 + Math.min(syn, 6) * 0.08;
      let s = v * (1.5 * ctx.greed + 0.4);
      s *= 0.35 + 0.65 * ctx.progress;
      return s;
    }
    case 'transfer': {
      let s = 5 + num(a.amount, 0) * 0.12;
      if (a.resource === 'combat') s += 3 * ctx.aggro;
      return s;
    }
    case 'discard':
      return 24 - cardValue(view, a.cardId) * 2;
    case 'selectScrap':
      return 24 - cardValue(view, a.cardId) * 2;
    case 'targetDiscard': {
      const p = players[a.targetId] || {};
      return 12 + num(p.handCount, 0) * 1.2 + num(p.authority, 50) * 0.02;
    }
    case 'eventChoice':
      return scoreEventChoice(view, ctx, a);
    case 'endTurn':
      return 0;
    default:
      return -1;
  }
}

export function chooseAction(args) {
  const input = args || {};
  const legalActions = input.legalActions;
  if (!Array.isArray(legalActions) || legalActions.length === 0) {
    return Array.isArray(legalActions) ? legalActions[0] : undefined;
  }
  try {
    const view = input.view || {};
    const playerId = input.playerId;
    const ctx = buildCtx(view, playerId, legalActions);
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      let s;
      try {
        s = scoreAction(view, playerId, ctx, legalActions[i]);
      } catch (_) {
        s = -1;
      }
      if (typeof s !== 'number' || !Number.isFinite(s)) s = -1;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    return legalActions[bestIdx];
  } catch (_) {
    return legalActions[0];
  }
}
