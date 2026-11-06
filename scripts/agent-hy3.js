// 策略名称：协同滚雪球（Synergy Snowball）
// 选择理由（一句话）：1v1 星域奇航最稳的赢法是靠同阵营「同盟」抽牌/获权/获战建立卡差雪球，再用战斗拆除敌方前哨封锁后直伤抢杀，续航与压制兼顾。

// 零依赖：本脚本不出现任何 import / require。
// 设计仅依据 README 第 6 节接口文档与引擎规则（legalActions / applyAction 的字段），
// 不读取任何已有 AI 实现，所有评分逻辑独立推导。

export const meta = {
  name: 'hy3 · 协同滚雪球',
  description: '由模型 hy3 独立设计的策略「协同滚雪球」：优先打出同阵营飞船触发同盟抽牌/获权/获战建立卡差雪球，再用战斗拆除敌方前哨封锁后直伤抢杀，兼顾续航与压制；零依赖、五模式与 core/colonyWars/events 任意组合全兼容。'
};

// ---------- 文本解析工具（view 只暴露卡牌 text 描述，需从中提取数值） ----------

function num(re, text) {
  if (!text) return 0;
  const r = new RegExp(re.source, 'g');
  let m, sum = 0;
  while ((m = r.exec(text)) !== null) sum += parseInt(m[1], 10) || 0;
  return sum;
}

// 去掉「同盟」「销毁」之后的描述，只保留主/可选效果
function stripClauses(text) {
  let t = text || '';
  const i = t.indexOf('同盟');
  if (i >= 0) t = t.slice(0, i);
  const j = t.indexOf('销毁');
  if (j >= 0) t = t.slice(0, j);
  return t;
}

// 同盟效果价值（仅取 同盟： 之后的片段）
function allyValue(text) {
  const i = (text || '').indexOf('同盟');
  const clause = i >= 0 ? text.slice(i) : '';
  if (!clause) return 0;
  let v = 0;
  v += num(/获得\s*(\d+)\s*战斗/g, clause) * 1.1;
  v += num(/获得\s*(\d+)\s*权威/g, clause) * 1.4;
  v += num(/获得\s*(\d+)\s*贸易/g, clause) * 1.0;
  v += num(/抽\s*(\d+)\s*张牌/g, clause) * 3.0;
  if (/摧毁目标基地|免费获得|销毁交易行/.test(clause)) v += 2;
  if (/目标对手弃/.test(clause)) v += 1.5;
  return v;
}

// 同盟是否值得发动（纯「销毁自己牌」的同盟跳过，避免自损）
function allyBeneficial(text) {
  const i = (text || '').indexOf('同盟');
  const clause = i >= 0 ? text.slice(i) : '';
  if (!clause) return false;
  if (/获得|抽|摧毁目标基地|免费获得|销毁交易行/.test(clause)) return true;
  return false; // 仅「可销毁手牌…」之类无收益
}

// 主效果价值（基地计入持续收益）
function primaryValue(card) {
  if (!card) return 0;
  const t = stripClauses(card.text);
  let v = 0;
  v += num(/获得\s*(\d+)\s*贸易/g, t) * 1.0;
  v += num(/获得\s*(\d+)\s*战斗/g, t) * 1.1;
  v += num(/获得\s*(\d+)\s*权威/g, t) * 1.4;
  v += num(/抽\s*(\d+)\s*张牌/g, t) * 3.0;
  if (card.type === 'base') {
    v = v * 2 + (card.outpost ? 4 : 0) + 2 + (card.defense || 0) * 0.5;
  }
  return v;
}

// 选项效果价值（primaryChoice）
function choiceValue(text, idx, me) {
  let t = text || '';
  const i = t.indexOf('选择：');
  if (i >= 0) t = t.slice(i + 3);
  const opts = t.split(/或|；或/).map(s => s.trim()).filter(Boolean);
  const opt = opts[idx] || opts[0] || '';
  let v = 0;
  v += num(/获得\s*(\d+)\s*贸易/g, opt) * 1.0;
  v += num(/获得\s*(\d+)\s*战斗/g, opt) * 1.1;
  v += num(/获得\s*(\d+)\s*权威/g, opt) * 1.4;
  if (/抽/.test(opt)) {
    const d = num(/抽\s*(\d+)\s*张牌/g, opt) || 1;
    const played = (me.playedThisTurn || []).length || 1;
    v += Math.min(d * played, d * 3) * 3.0;
  }
  return v;
}

// 购买价值
function cardScore(card, view, me) {
  if (!card) return 0;
  let v = primaryValue(card);
  if (card.type !== 'base') v += allyValue(card.text) * 0.6;
  const dom = dominantFaction(view, me);
  if (dom && (card.factions || []).includes(dom) && card.faction !== 'neutral') v += 3;
  return v - 0.2 * (card.cost || 1);
}

// ---------- 阵营统计（用于同盟协同偏向） ----------

function dominantFaction(view, me) {
  const counts = {};
  const add = uid => {
    const c = view.cards[uid];
    if (!c) return;
    for (const f of (c.factions || [])) {
      if (f === 'neutral') continue;
      counts[f] = (counts[f] || 0) + 1;
    }
  };
  (me.inPlay || []).forEach(add);
  (me.hand || []).forEach(add);
  (me.discard || []).forEach(add);
  let best = null, bv = 0;
  for (const f in counts) if (counts[f] > bv) { bv = counts[f]; best = f; }
  return best;
}

function factionSet(view, me, zone) {
  const s = new Set();
  const add = uid => {
    const c = view.cards[uid];
    if (!c) return;
    (c.factions || []).forEach(f => s.add(f));
  };
  (me[zone] || []).forEach(add);
  return s;
}

// ---------- 打出价值 ----------

function playValue(card, view, me, p) {
  if (p.copy !== undefined && p.copy !== null) {
    const c = view.cards[p.copy];
    if (!c) return -100; // 无可复制飞船时压到最低，最后才打
    return primaryValue(c) + 3;
  }
  if (p.choice !== undefined && p.choice !== null) {
    return choiceValue(card.text, p.choice, me);
  }
  let v = primaryValue(card);
  const inPlayFactions = factionSet(view, me, 'inPlay');
  if ((card.factions || []).some(f => inPlayFactions.has(f))) {
    v += allyValue(card.text) * 0.6 + 1; // 能触发同盟则加分
  }
  return v;
}

// ---------- 各决策点 ----------

function findLethal(view, actions) {
  for (const a of actions) {
    if (a.type === 'attack' && a.targetType === 'player') {
      const t = view.players[a.targetId];
      if (t && !t.eliminated && a.amount >= t.authority) return a;
    }
  }
  return null;
}

function choosePlay(view, actions, me) {
  const handSet = new Set(me.hand || []);
  let best = null, bv = -Infinity;
  for (const p of actions) {
    if (p.type !== 'play') continue;
    if (!handSet.has(p.cardId)) continue; // 只打仍在手牌的卡
    const card = view.cards[p.cardId];
    if (!card) continue;
    const v = playValue(card, view, me, p);
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}

function chooseAbility(view, actions, me) {
  let best = null, bv = -Infinity;
  for (const a of actions) {
    if (a.type !== 'ability') continue;
    const card = view.cards[a.cardId];
    const text = card ? card.text : '';
    let beneficial = false, v = 0;
    if (a.ability === 'ally') {
      beneficial = allyBeneficial(text);
      v = allyValue(text);
    } else if (a.ability === 'primary') {
      beneficial = true; // 基地主能力几乎都给资源
      v = primaryValue(card);
    } else if (a.ability === 'optional') {
      beneficial = /摧毁目标基地|销毁交易行|免费获得|获得\s*\d+\s*(战斗|贸易|权威)|抽\s*\d+\s*张牌/.test(text);
      v = primaryValue(card);
    } else if (a.ability === 'scrap') {
      // 仅在能换取战斗（补刀/拆墙）或本身是探索者时发动，避免自毁好牌
      const clause = (text.split('销毁：')[1] || '');
      const cb = num(/获得\s*(\d+)\s*战斗/g, clause);
      const isExplorer = card && card.id === 'explorer';
      beneficial = cb >= 5 || (isExplorer && cb > 0);
      v = cb;
    }
    if (beneficial && v >= 0) {
      if (v > bv) { bv = v; best = a; }
    }
  }
  return best;
}

function chooseBuy(view, actions, me) {
  let best = null, bv = -Infinity;
  for (const b of actions) {
    if (b.type !== 'buy') continue;
    let card;
    if (b.explorer) {
      card = { text: '获得 2 贸易。', type: 'ship', cost: 2, faction: 'neutral', factions: [] };
    } else {
      const uid = view.tradeRow[b.row];
      card = uid ? view.cards[uid] : null;
    }
    if (!card) continue;
    const s = cardScore(card, view, me);
    if (s > bv) { bv = s; best = b; }
  }
  if (!best || bv <= 0) return null;
  return best;
}

function chooseAttack(view, actions, me) {
  const atks = actions.filter(a => a.type === 'attack');
  if (!atks.length) return null;

  // 致死直伤
  const lethal = findLethal(view, atks);
  if (lethal) return lethal;

  const baseAtks = atks.filter(a => a.targetType === 'base');
  const playerAtks = atks.filter(a => a.targetType === 'player');

  // 1) 优先拆敌方前哨（封锁直伤的墙）
  const outpostAtks = baseAtks.filter(a => {
    const c = view.cards[a.targetId];
    return c && c.outpost;
  });
  if (outpostAtks.length) {
    const killable = outpostAtks.filter(a => a.amount >= (view.cards[a.targetId].defense || 0));
    if (killable.length) {
      return killable.reduce((x, y) => (y.amount < x.amount ? y : x)); // 用最少战斗拆掉
    }
    return outpostAtks.reduce((x, y) => (y.amount > x.amount ? y : x)); // 否则削血
  }

  // 2) 无封锁则直伤抢杀：优先打权威最低的对手（混战/先血更有利）
  if (playerAtks.length) {
    let target = null, minAuth = Infinity;
    for (const a of playerAtks) {
      const t = view.players[a.targetId];
      if (!t || t.eliminated) continue;
      if (t.authority < minAuth) { minAuth = t.authority; target = a.targetId; }
    }
    const cand = playerAtks.filter(a => a.targetId === target);
    return cand.reduce((x, y) => (y.amount > x.amount ? y : x));
  }

  // 3) 没有可直伤目标时，拆掉非前哨敌方基地（剥夺其持续收益）
  if (baseAtks.length) {
    const killable = baseAtks.filter(a => a.amount >= (view.cards[a.targetId].defense || 0));
    if (killable.length) return killable.reduce((x, y) => (y.amount < x.amount ? y : x));
    return baseAtks.reduce((x, y) => (y.amount > x.amount ? y : x));
  }
  return null;
}

// ---------- 待决与事件安全兜底 ----------

function lowestCardAction(actions, type, view, me) {
  let best = null, bv = Infinity;
  for (const a of actions) {
    if (a.type !== type) continue;
    const id = type === 'selectScrap' ? a.cardId : a.cardId;
    const c = view.cards[id];
    const v = c ? cardScore(c, view, me) : 0;
    if (v < bv) { bv = v; best = a; }
  }
  return best;
}

function chooseEventChoice(view, actions, me) {
  const ev = actions.filter(a => a.type === 'eventChoice');
  if (!ev.length) return actions[0];
  const kind = view.pending && view.pending.kind;
  const sumVal = arr => arr.reduce((s, id) => s + (view.cards[id] ? cardScore(view.cards[id], view, me) : 0), 0);

  if (kind === 'blackHole') {
    // 弃 2 张避免 -8 权威，挑价值最低的两张
    let best = null, bv = Infinity;
    for (const a of ev) {
      const t = a.targets || [];
      if (t.length < 2) continue;
      const v = sumVal(t);
      if (v < bv) { bv = v; best = a; }
    }
    return best || ev[0];
  }
  if (kind === 'bombardment') {
    const baseActs = ev.filter(a => a.baseId);
    if (baseActs.length) {
      let best = null, bv = Infinity;
      for (const a of baseActs) {
        const c = view.cards[a.baseId];
        const v = c ? cardScore(c, view, me) : 0;
        if (v < bv) { bv = v; best = a; }
      }
      return best; // 拆最弱自家基地，胜过 -6 权威
    }
    return ev.find(a => a.pay) || ev[0];
  }
  if (kind === 'comet') {
    // 销毁 2 张最低价值牌以压缩牌库
    let best = null, bv = Infinity;
    for (const a of ev) {
      const t = a.targets || [];
      if (t.length < 2) continue;
      const v = sumVal(t);
      if (v < bv) { bv = v; best = a; }
    }
    return best || ev[0];
  }
  if (kind === 'warpJump') {
    // 抽 3 退回 2：把价值最低的两张放回牌库顶，留最好的在手上
    let best = null, bv = Infinity;
    for (const a of ev) {
      const c = a.cards || [];
      if (c.length < 2) continue;
      const v = sumVal(c);
      if (v < bv) { bv = v; best = a; }
    }
    return best || ev[0];
  }
  return ev[0];
}

function resolvePending(view, actions, me) {
  const p = view.pending;
  if (!p) return actions[0];
  if (p.type === 'discard') return lowestCardAction(actions, 'discard', view, me) || actions[0];
  if (p.type === 'selectScrap') return lowestCardAction(actions, 'selectScrap', view, me) || actions[0];
  if (p.type === 'targetDiscard') return actions.find(a => a.type === 'targetDiscard') || actions[0];
  if (p.type === 'eventChoice') return chooseEventChoice(view, actions, me);
  // 任何未知待决动作：安全返回第一个合法动作
  return actions[0];
}

// ---------- 主入口 ----------

export async function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  const actions = legalActions;
  if (!actions || !actions.length) return null;

  const me = view.players[playerId];

  // 0) 待决优先处理（含未知动作兜底）
  if (view.pending) return resolvePending(view, actions, me);

  // 1) 致死直伤
  const lethal = findLethal(view, actions);
  if (lethal) return lethal;

  // 2) 打出手中卡牌（先铺场、攒资源、触发同盟）
  const play = choosePlay(view, actions, me);
  if (play) return play;

  // 3) 发动有益能力（同盟/基地主能力/可选能力/补刀销毁）
  const ability = chooseAbility(view, actions, me);
  if (ability) return ability;

  // 4) 购买最优可负担卡牌（建设雪球）
  const buy = chooseBuy(view, actions, me);
  if (buy) return buy;

  // 5) 用战斗拆前哨 / 直伤抢杀 / 拆基地
  const atk = chooseAttack(view, actions, me);
  if (atk) return atk;

  // 6) 兜底：结束回合或任意合法动作（绝不抛异常、不修改视图）
  const end = actions.find(a => a.type === 'endTurn');
  if (end) return end;
  return actions[0];
}
