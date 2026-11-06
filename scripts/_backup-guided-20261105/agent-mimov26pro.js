// MIMO-v2.6-pro · 混合博弈（执行模型 ID：mimo-v2.6-pro）
// 零依赖、只读决策脚本：所有动作均原样取自 legalActions，不修改任何入参，不 sort 原数组。
// 混合博弈主题：用 memory 记录偏好（阵营偏置、动作历史），
// 按对手数量 / 团队权威 / 血量 / 牌库质量自适应切换权重，全程不硬编码卡名。
//
// 分层优先级（band 决定次序，band 内连续分值决定选谁）：
//   lethal → 拆除阻止直伤的敌方前哨 → 出牌与同盟 → 有价值购买 →
//   削血攻击 → 2V2 资源预留 → 未知/兜底 → 结束回合。

export const meta = {
  name: 'MIMO-v2.6-pro · 混合博弈',
  description: 'mimo-v2.6-pro 混合博弈策略：memory 记录偏好，按对手数量/团队权威/血量/牌库自适应切换权重，不硬编码卡名；优先 lethal、拆除阻挡直伤的敌方前哨、出牌与同盟、有价值购买、削血攻击、2V2 资源预留，五种模式与 core/colonyWars/events 任意组合全兼容，未知动作安全兜底。'
};

// ---------- 基础工具 ----------
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- 通用卡牌估值（不硬编码卡名，只看结构特征与规则文本关键词） ----------
function textScore(text, ctx) {
  if (typeof text !== 'string' || !text) return 0;
  let s = 0;
  if (text.includes('抽')) s += 1.7 * ctx.drawWeight;
  if (text.includes('销毁')) s += 1.0 * ctx.scrapWeight;
  if (text.includes('战斗')) s += 1.1 * ctx.combatWeight;
  if (text.includes('贸易')) s += 1.0 * ctx.tradeWeight;
  if (text.includes('权威')) s += 1.1 * ctx.authorityWeight;
  if (text.includes('同盟')) s += 0.7;
  return s;
}

function isJunk(view, uid) {
  const c = view.cards && view.cards[uid];
  if (!c) return true;
  return c.cost == null || num(c.cost, 0) <= 1;
}

function cardValue(view, uid, ctx) {
  const c = view.cards && view.cards[uid];
  if (!c) return 1.5;
  let v = 1.5;
  v += num(c.cost, 0) * 1.15;
  if (c.type === 'base') {
    v += 1.2 + num(c.defense) * 0.35;
    if (c.outpost) v += 1.6 * ctx.outpostWeight;
  }
  v += textScore(c.text, ctx);
  const f = c.faction;
  if (f) v += (ctx.factionSynergy[f] || 0) * 0.45 + (ctx.memoryBias[f] || 0) * 0.3;
  return v;
}

// 主动能力的分支选项：按规则文本拆分后给每个 choice 独立估值
function choiceScore(view, uid, choice, ctx) {
  const c = view.cards && view.cards[uid];
  const text = (c && c.text) || '';
  const parts = text.split(/；或|或者|；|或/).map(p => p.trim()).filter(Boolean);
  if (!parts.length || choice >= parts.length) return 0;
  return textScore(parts[choice], ctx);
}

// ---------- 局面自适应（混合博弈核心） ----------
function buildContext(view, playerId, memory, context) {
  const players = view.players || [];
  const me = players[playerId] || {};
  const alive = players.filter(p => p && !p.eliminated);
  const opponents = alive.filter(p => p.id !== playerId);

  const myAuth = num(me.authority, 50);
  const oppAuths = opponents.map(p => num(p.authority, 50));
  const minOpp = oppAuths.length ? Math.min(...oppAuths) : 50;
  const avgOpp = oppAuths.length ? oppAuths.reduce((a, b) => a + b, 0) / oppAuths.length : 50;

  const turn = num(context && context.turn, 1);
  const phase = turn <= 6 ? 'early' : (turn <= 14 ? 'mid' : 'late');

  const hand = Array.isArray(me.hand) ? me.hand : [];
  const inPlay = Array.isArray(me.inPlay) ? me.inPlay : [];
  const discard = Array.isArray(me.discard) ? me.discard : [];
  const deckSize = num(me.deckCount) + hand.length + discard.length + inPlay.length;
  const junkCount = [...hand, ...discard, ...inPlay].filter(uid => isJunk(view, uid)).length;
  const junkRatio = deckSize ? junkCount / deckSize : 0;

  const lead = myAuth - avgOpp;
  const authorityUrgency = clamp(1 + (24 - myAuth) / 18, 0.55, 3);

  // 阵营协同：手上与场上的阵营聚集度
  const factionSynergy = {};
  for (const uid of [...hand, ...inPlay]) {
    const c = view.cards && view.cards[uid];
    if (c && c.faction) factionSynergy[c.faction] = (factionSynergy[c.faction] || 0) + 1;
  }
  // memory 偏好：历史上买过的阵营
  const memoryBias = (memory && memory.factionBias) || {};

  return {
    me, opponents, myAuth, minOpp, avgOpp, lead, turn, phase,
    deckSize, junkRatio, authorityUrgency, factionSynergy, memoryBias,
    drawWeight: clamp(1 + (phase === 'late' ? 0.45 : 0.15) + (deckSize >= 14 ? 0.25 : 0) - (deckSize <= 6 ? 0.3 : 0), 0.6, 1.9),
    scrapWeight: clamp(0.8 + junkRatio * 2 + (phase === 'late' ? 0.3 : 0), 0.7, 2.2),
    combatWeight: clamp(1 + (lead > 6 ? 0.35 : 0) + (phase === 'late' ? 0.35 : 0) - (lead < -8 ? 0.2 : 0), 0.7, 1.8),
    tradeWeight: clamp(1 + (phase === 'early' ? 0.5 : phase === 'mid' ? 0.15 : -0.35), 0.5, 1.7),
    authorityWeight: clamp(authorityUrgency * 0.75, 0.5, 2.2),
    outpostWeight: clamp(1 + (opponents.length >= 2 ? 0.45 : 0) + (myAuth < 20 ? 0.35 : 0), 0.8, 2.1)
  };
}

// ---------- 分层优先级 ----------
const BAND = {
  lethal: 9e6,
  forced: 8e6,
  outpostBreak: 7e5,
  play: 6e5,
  ally: 5.9e5,
  primary: 5.7e5,
  optional: 5.5e5,
  scrapAbility: 5.25e5,
  buy: 4.2e5,
  baseKill: 3.6e5,
  playerChip: 3.1e5,
  baseChip: 2.6e5,
  transfer: 2.1e5,
  junkBuy: 1.6e5,
  fallback: 1e3,
  endTurn: 0
};

// firstBlood：某座位败北时其右手边玩家获胜，补刀前先确认受益人
function firstBloodBeneficiary(view, targetId) {
  const players = view.players || [];
  const n = players.length;
  if (!n) return null;
  for (let step = 1; step <= n; step++) {
    const idx = ((targetId - step) % n + n) % n;
    const p = players[idx];
    if (p && !p.eliminated) return idx;
  }
  return null;
}

function scoreAttack(a, view, ctx, legalActions, playerId, mode) {
  const amount = num(a.amount, 1);
  if (a.targetType === 'player') {
    const t = (view.players || [])[a.targetId];
    const auth = t ? num(t.authority, 50) : 50;
    const kills = amount >= auth;
    if (kills) {
      if (mode === 'firstBlood') {
        return firstBloodBeneficiary(view, a.targetId) === playerId
          ? BAND.lethal + 1e5
          : -1e7; // 杀了便宜别人，绝不补刀
      }
      return BAND.lethal + 1e5 - amount * 5;
    }
    let s = BAND.playerChip + amount * 120;
    s += clamp(60 - auth, -20, 60) * 12; // 集火最弱对手
    return s;
  }
  // 攻击基地
  const c = view.cards && view.cards[a.targetId];
  const def = num(c && c.defense, 5);
  const dmg = num(view.damage && view.damage[a.targetId], 0);
  const needed = Math.max(1, def - dmg);
  const killsBase = amount >= needed;
  const isOutpost = !!(c && c.outpost);
  const baseVal = cardValue(view, a.targetId, ctx);
  const blocked = !legalActions.some(x => x.type === 'attack' && x.targetType === 'player');
  if (isOutpost) {
    let s = BAND.outpostBreak + (killsBase ? 8e3 : 0) - needed * 60 + baseVal * 200;
    if (blocked) s += 6e3; // 正在阻止直伤，拆得越快越好
    return s;
  }
  if (killsBase) return BAND.baseKill + baseVal * 300 + (blocked ? 2e3 : 0);
  return BAND.baseChip + amount * 150 + baseVal * 60;
}

function scorePlay(a, view, ctx) {
  let s = BAND.play + cardValue(view, a.cardId, ctx) * 800;
  if (a.copy) s += cardValue(view, a.copy, ctx) * 400;
  if (a.row != null && view.tradeRow && view.tradeRow[a.row]) {
    s += cardValue(view, view.tradeRow[a.row], ctx) * 700; // 免费拿高价值
  }
  if (a.choice != null) s += choiceScore(view, a.cardId, a.choice, ctx) * 300;
  return s;
}

function scoreAbility(a, view, ctx) {
  const kind = a.ability;
  const own = cardValue(view, a.cardId, ctx);
  let targetScore = 0;
  if (a.targetId != null && view.cards && view.cards[a.targetId]) {
    targetScore += cardValue(view, a.targetId, ctx) * 260;
  }
  if (a.row != null && view.tradeRow && view.tradeRow[a.row]) {
    targetScore += cardValue(view, view.tradeRow[a.row], ctx) * 240;
  }
  if (Array.isArray(a.rows)) {
    for (const r of a.rows) {
      if (view.tradeRow && view.tradeRow[r]) targetScore += cardValue(view, view.tradeRow[r], ctx) * 240;
    }
  }
  // targets 多为弃/销毁自己的牌：越弱越好弃，弃得多换收益
  let giveScore = 0;
  if (Array.isArray(a.targets)) {
    for (const uid of a.targets) giveScore += 1200 - cardValue(view, uid, ctx) * 900;
  }
  if (a.resource === 'combat') giveScore += 260 * ctx.combatWeight;
  if (a.resource === 'trade') giveScore += 260 * ctx.tradeWeight;
  const choiceBonus = a.choice != null ? choiceScore(view, a.cardId, a.choice, ctx) * 220 : 0;

  switch (kind) {
    case 'ally':
      return BAND.ally + 1200 + targetScore + giveScore + choiceBonus;
    case 'primary':
      return BAND.primary + 900 + targetScore + giveScore + choiceBonus;
    case 'optional':
      return BAND.optional + 500 + targetScore + giveScore + choiceBonus;
    case 'scrap': {
      let s = BAND.scrapAbility + 600 - own * 620 + targetScore + giveScore + choiceBonus;
      if (a.targetId === null) s -= 1500; // 不拆任何基地的销毁分支，保守处理
      if (ctx.phase === 'late' || ctx.combatWeight > 1.2) s += 700;
      return s;
    }
    default:
      return BAND.fallback + 100;
  }
}

function scoreBuy(a, view, ctx) {
  let v;
  if (a.explorer) {
    v = 2.6 + (ctx.phase === 'early' ? 0.9 : ctx.phase === 'mid' ? 0.4 : 0.1);
  } else {
    const uid = view.tradeRow && view.tradeRow[a.row];
    v = uid ? cardValue(view, uid, ctx) : 2;
  }
  return (v >= 3.0 ? BAND.buy : BAND.junkBuy) + v * 900;
}

function scoreTransfer(a, ctx) {
  let s = BAND.transfer + num(a.amount, 1) * 1500;
  if (a.resource === 'trade') s += ctx.phase === 'early' ? 400 : 100;
  if (a.resource === 'combat') s += 300;
  return s;
}

function scoreEventChoice(a, view, ctx) {
  const urgency = ctx.authorityUrgency;
  const kind = a.eventId;
  if (kind === 'blackHole' && Array.isArray(a.targets)) {
    let loss = 0;
    for (const uid of a.targets) loss += cardValue(view, uid, ctx);
    loss += (2 - a.targets.length) * 4 * urgency; // 少弃一张失 4 权威
    return -loss * 500;
  }
  if (kind === 'comet' && Array.isArray(a.targets)) {
    let gain = 0;
    for (const uid of a.targets) gain += 2.6 - cardValue(view, uid, ctx); // 销毁弱牌赚压缩
    return gain * 500;
  }
  if (kind === 'bombardment') {
    if (a.baseId) return -cardValue(view, a.baseId, ctx) * 600 - (ctx.myAuth > 30 ? 400 : 0);
    if (a.pay) return -6 * urgency * 500;
  }
  if (kind === 'warpJump' && Array.isArray(a.cards)) {
    let sum = 0;
    for (const uid of a.cards) sum += cardValue(view, uid, ctx);
    const v0 = a.cards[0] != null ? cardValue(view, a.cards[0], ctx) : 0;
    const v1 = a.cards[1] != null ? cardValue(view, a.cards[1], ctx) : 0;
    return -sum * 500 + Math.max(v0, v1) * 180; // 放回弱牌，较强者置顶
  }
  // 未知事件保守：少弃、少付、少毁
  let s = 0;
  if (Array.isArray(a.targets)) s -= a.targets.length * 200;
  if (a.pay) s -= 800;
  if (a.baseId) s -= 300;
  return s;
}

function scoreAction(a, view, ctx, legalActions, playerId, mode) {
  if (!a || typeof a !== 'object') return BAND.fallback;
  switch (a.type) {
    case 'play':
      return scorePlay(a, view, ctx);
    case 'ability':
      return scoreAbility(a, view, ctx);
    case 'buy':
      return scoreBuy(a, view, ctx);
    case 'attack':
      return scoreAttack(a, view, ctx, legalActions, playerId, mode);
    case 'transfer':
      return scoreTransfer(a, ctx);
    case 'discard':
      return BAND.forced - cardValue(view, a.cardId, ctx) * 800;
    case 'selectScrap':
      return BAND.forced - cardValue(view, a.cardId, ctx) * 800 + 5;
    case 'targetDiscard': {
      const t = (view.players || [])[a.targetId];
      const s = t ? num(t.handCount) * 160 + num(t.authority) * 1.5 + (Array.isArray(t.inPlay) ? t.inPlay.length * 90 : 0) : 0;
      return BAND.forced + s;
    }
    case 'eventChoice':
      return BAND.forced + scoreEventChoice(a, view, ctx);
    case 'endTurn':
      return BAND.endTurn;
    default:
      return BAND.fallback; // 未知动作安全兜底
  }
}

// ---------- 主入口 ----------
export function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  const rnd = typeof random === 'function' ? random : Math.random;
  try {
    if (!Array.isArray(legalActions) || legalActions.length === 0) return undefined;
    if (memory && typeof memory === 'object') {
      memory.calls = num(memory.calls) + 1;
      if (!memory.factionBias || typeof memory.factionBias !== 'object') memory.factionBias = {};
      if (!memory.history || typeof memory.history !== 'object') memory.history = {};
    }
    const mode = (context && context.mode) || view.mode || 'standard';
    const ctx = buildContext(view, playerId, memory, context);

    let best = null;
    let bestScore = -Infinity;
    for (const a of legalActions) {
      const s = scoreAction(a, view, ctx, legalActions, playerId, mode) + rnd() * 0.999;
      if (s > bestScore) {
        bestScore = s;
        best = a;
      }
    }
    if (!best) {
      const end = legalActions.find(x => x && x.type === 'endTurn');
      return end || legalActions[0];
    }
    // 记录偏好：动作历史 + 购买阵营偏置
    if (memory && typeof memory === 'object') {
      memory.history[best.type] = num(memory.history[best.type]) + 1;
      if (best.type === 'buy' && !best.explorer && view.tradeRow) {
        const uid = view.tradeRow[best.row];
        const c = uid && view.cards && view.cards[uid];
        if (c && c.faction) memory.factionBias[c.faction] = num(memory.factionBias[c.faction]) + 1;
      }
    }
    return best;
  } catch {
    // 兜底：任何异常都不外抛，退回结束回合或首个合法动作
    const end = Array.isArray(legalActions) ? legalActions.find(x => x && x.type === 'endTurn') : null;
    return end || (Array.isArray(legalActions) && legalActions[0]) || undefined;
  }
}
