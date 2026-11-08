// 策略名称：协同滚雪球（Synergy Snowball）
// 选择理由（一句话）：星域奇航最稳的赢法是靠同阵营「同盟」抽牌/获权/获战建立卡差雪球，再用战斗拆除敌方前哨封锁后直伤抢杀，续航与压制兼顾。
// 本轮更新：按 PROGRAM-UPDATES 第 1–6 节适配 7 模式 + 6 牌包，新增 double 双同盟 / choice/row/rows/targets/targetId / emperor.moveCard 安全兜底，并据团队整队轮流、队末清算、emperor 个人权威与大将优先修正估值。

// 零依赖：本脚本不出现任何 import / require / process / 文件 / 网络。
// 设计仅依据 README 第 6 节接口文档与 engine/*.js 的实际代码（legalActions / applyAction 的字段），
// 不读取任何已有 AI 实现，所有评分逻辑独立推导。视图为深冻结快照，绝不写入。

export const meta = {
  name: 'hy3 · 协同滚雪球',
  description: '由模型 hy3 独立设计的策略「协同滚雪球」：优先打出同阵营飞船触发同盟抽牌/获权/获战建立卡差雪球，再用战斗拆除敌方前哨封锁后直伤抢杀，兼顾续航与压制；零依赖、七模式与六牌包任意组合全兼容。'
};

// ---------- 文本解析工具（view 只暴露卡牌 text 描述，需从中提取数值） ----------

function num(re, text) {
  if (!text) return 0;
  const r = new RegExp(re.source, 'g');
  let m, sum = 0;
  while ((m = r.exec(text)) !== null) sum += parseInt(m[1], 10) || 0;
  return sum;
}

// 去掉「同盟」「双同盟」「销毁」之后的描述，只保留主/可选效果
function stripClauses(text) {
  let t = text || '';
  const i = t.indexOf('同盟');
  if (i >= 0) t = t.slice(0, i);
  const j = t.indexOf('销毁');
  if (j >= 0) t = t.slice(0, j);
  return t;
}

// 同盟效果价值（取「同盟」之后的片段；双同盟文本也含「同盟」，会被一并计入）
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
function choiceValue(text, idx) {
  let t = text || '';
  const i = t.indexOf('选择：');
  if (i >= 0) t = t.slice(i + 3);
  const opts = t.split(/或|；或/).map(s => s.trim()).filter(Boolean);
  const opt = opts[idx] || opts[0] || '';
  let v = 0;
  v += num(/获得\s*(\d+)\s*贸易/g, opt) * 1.0;
  v += num(/获得\s*(\d+)\s*战斗/g, opt) * 1.1;
  v += num(/获得\s*(\d+)\s*权威/g, opt) * 1.4;
  if (/抽/.test(opt)) v += 3.0;        // 抽牌分支本身给一张稳定收益
  if (/摧毁目标基地/.test(opt)) v += 2; // 拆基地分支
  return v;
}

// 通用卡牌评分（购买 / 弃置 / 销毁兜底共用），优先用可见字段与 text
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
  if (me) {
    (me.inPlay || []).forEach(add);
    (me.hand || []).forEach(add);
    (me.discard || []).forEach(add);
  }
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

// ---------- 模式 / 队伍辅助 ----------

function isTeamMode(view) {
  return Array.isArray(view.teams) && view.teams.length > 0;
}

// 团队模式下权威共享：读个人权威即可（引擎已 sync 到每个队员），但要先判空
function authorityOf(view, id) {
  const p = view.players && view.players[id];
  return p ? (p.authority || 0) : 0;
}

// emperor 模式下敌方大将根据 team 反查（seat 在 view.emperors 中、且非我方队伍）
function enemyEmperorSeat(view, playerId) {
  if (view.mode !== 'emperor' || !Array.isArray(view.emperors) || !view.emperors.length) return -1;
  const me = view.players[playerId];
  if (!me) return -1;
  for (const e of view.emperors) {
    const p = view.players[e];
    if (p && p.team !== me.team) return e;
  }
  return -1;
}

// 团队模式下「下一顺位队友」（用于收尾时把余裕资源 transfer 给队友）
function nextTeammateSeat(view, playerId) {
  const me = view.players[playerId];
  if (!me || me.team == null) return -1;
  const mates = (view.players || [])
    .filter(p => p.team === me.team && p.id !== playerId && !p.eliminated)
    .map(p => p.id);
  if (!mates.length) return -1;
  // 引擎 nextTeamTurn 用座位升序：优先取比自己大的最小座位，否则取最小座位（环形）
  const higher = mates.filter(id => id > playerId).sort((a, b) => a - b);
  if (higher.length) return higher[0];
  return mates.slice().sort((a, b) => a - b)[0];
}

// ---------- 打出价值 ----------

function playValue(card, view, me, p) {
  if (p.copy !== undefined && p.copy !== null) {
    const c = view.cards[p.copy];
    if (!c) return -100; // 无可复制飞船时压到最低，最后才打
    return primaryValue(c) + 3;
  }
  if (p.choice !== undefined && p.choice !== null) {
    return choiceValue(card.text, p.choice);
  }
  let v = primaryValue(card);
  const inPlayFactions = factionSet(view, me, 'inPlay');
  if ((card.factions || []).some(f => inPlayFactions.has(f))) {
    v += allyValue(card.text) * 0.6 + 1; // 能触发同盟则加分
  }
  return v;
}

// ---------- 各决策点 ----------

function findLethal(view, actions, playerId) {
  const cand = [];
  for (const a of actions) {
    if (a.type === 'attack' && a.targetType === 'player') {
      const t = view.players[a.targetId];
      if (t && !t.eliminated && a.amount >= authorityOf(view, a.targetId)) cand.push(a);
    }
  }
  if (!cand.length) return null;
  // emperor：能斩大将就斩大将（才是胜利条件）；否则取首个
  if (view.mode === 'emperor') {
    const ge = enemyEmperorSeat(view, playerId);
    const g = cand.find(a => a.targetId === ge);
    if (g) return g;
  }
  return cand[0];
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
      // 销毁：换取战斗/权威、拆基地、或销毁交易行再得战斗时才发动，避免自毁好牌
      const clause = (text.split('销毁：')[1] || '');
      const cb = num(/获得\s*(\d+)\s*战斗/g, clause);
      const ca = num(/获得\s*(\d+)\s*权威/g, clause);
      const isExplorer = card && card.id === 'explorer';
      const destroysBase = /摧毁目标基地|销毁目标基地/.test(clause) || /销毁交易行/.test(clause);
      beneficial = cb >= 5 || ca >= 8 || destroysBase || (isExplorer && cb > 0);
      v = Math.max(cb, ca);
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
      card = { text: '获得 2 贸易。', type: 'ship', cost: 2, faction: 'neutral', factions: [], id: 'explorer' };
    } else {
      const uid = view.tradeRow && view.tradeRow[b.row];
      card = uid ? view.cards[uid] : null;
    }
    if (!card) continue;
    const s = cardScore(card, view, me);
    if (s > bv) { bv = s; best = b; }
  }
  if (!best || bv <= 0) return null;
  return best;
}

// 在 baseAtks 里挑「最该打的基地」：优先可击杀，其次已累计伤害（团队合击），再退化
function pickBaseAttack(baseAtks, view) {
  if (!baseAtks.length) return null;
  const dmgOf = uid => (view.damage && view.damage[uid]) || 0;
  const killable = baseAtks.filter(a => {
    const c = view.cards[a.targetId];
    if (!c) return false;
    return a.amount >= ((c.defense || 0) - dmgOf(a.targetId));
  });
  if (killable.length) return killable.reduce((x, y) => (y.amount < x.amount ? y : x)); // 用最少战斗击杀
  // 团队整队轮流→队末才清伤害：优先续打已有伤害的基地（合击滚雪球）
  const withDmg = baseAtks.filter(a => dmgOf(a.targetId) > 0);
  if (withDmg.length) return withDmg.reduce((x, y) => (dmgOf(y.targetId) > dmgOf(x.targetId) ? y : x));
  return baseAtks.reduce((x, y) => (y.amount > x.amount ? y : x)); // 否则削血
}

function chooseAttack(view, actions, me, playerId) {
  const atks = actions.filter(a => a.type === 'attack');
  if (!atks.length) return null;

  // 致死直伤（已在主流程优先，这里不再重复；仅作结构兼容）

  const baseAtks = atks.filter(a => a.targetType === 'base');
  const playerAtks = atks.filter(a => a.targetType === 'player');

  // 1) 优先拆敌方前哨（封锁直伤的墙）
  const outpostAtks = baseAtks.filter(a => {
    const c = view.cards[a.targetId];
    return c && c.outpost;
  });
  if (outpostAtks.length) return pickBaseAttack(outpostAtks, view);

  // 2) 直伤抢杀：emperor 只打敌方大将；其余模式打最低权威对手
  if (playerAtks.length) {
    let pool = playerAtks;
    if (view.mode === 'emperor') {
      const ge = enemyEmperorSeat(view, playerId);
      const gatks = playerAtks.filter(a => a.targetId === ge);
      if (gatks.length) pool = gatks;
    }
    let target = null, minAuth = Infinity;
    for (const a of pool) {
      const auth = authorityOf(view, a.targetId);
      if (auth < minAuth) { minAuth = auth; target = a.targetId; }
    }
    if (target != null) {
      const cand = pool.filter(a => a.targetId === target);
      return cand.reduce((x, y) => (y.amount > x.amount ? y : x));
    }
  }

  // 3) 没有可直伤目标时，拆掉非前哨敌方基地（剥夺其持续收益，团队模式可合击）
  if (baseAtks.length) return pickBaseAttack(baseAtks, view);
  return null;
}

// 团队模式收尾：把余裕资源 transfer 给下一顺位队友（beginTurn 会到账）
function chooseTransfer(view, actions, me, playerId) {
  if (!isTeamMode(view)) return null;
  const transfers = actions.filter(a => a.type === 'transfer');
  if (!transfers.length) return null;
  const leftoverTrade = me.trade || 0;
  const leftoverCombat = me.combat || 0;
  if (leftoverTrade < 1 && leftoverCombat < 1) return null;
  const next = nextTeammateSeat(view, playerId);
  if (next < 0) return null;
  const cand = transfers.filter(a =>
    a.targetId === next &&
    a.amount <= (a.resource === 'combat' ? leftoverCombat : leftoverTrade)
  );
  if (!cand.length) return null;
  // 尽量一次性把该资源全都给出去
  return cand.reduce((x, y) => (y.amount > x.amount ? y : x));
}

// emperor 专属：花 1 贸易把弃牌里一张好牌交给相邻队友（队内环形相邻）
function chooseMoveCard(view, actions, me) {
  if (view.mode !== 'emperor') return null;
  const moves = actions.filter(a => a.type === 'moveCard');
  if (!moves.length) return null;
  if ((me.trade || 0) < 1) return null;
  let best = null, bv = -Infinity;
  for (const m of moves) {
    const c = view.cards[m.cardId];
    const v = c ? cardScore(c, view, me) : 0;
    if (v > bv) { bv = v; best = m; }
  }
  // 只移交价值可观的牌，避免把垃圾塞给队友
  if (best && bv >= 1) return best;
  return null;
}

// ---------- 待决与事件安全兜底 ----------

function lowestCardAction(actions, type, view, me) {
  let best = null, bv = Infinity;
  for (const a of actions) {
    if (a.type !== type) continue;
    const id = a.cardId;
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
  const sumVal = arr => Array.isArray(arr)
    ? arr.reduce((s, id) => s + (view.cards[id] ? cardScore(view.cards[id], view, me) : 0), 0)
    : 0;

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
    // 抽 3 退回 2：把价值最低的两张放回牌库顶
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
  const me = view && view.players ? view.players[playerId] : null;

  try {
    // 0) 待决优先处理（含未知动作兜底）
    if (view && view.pending) return resolvePending(view, actions, me);

    // 1) 致死直伤（emperor 优先斩大将）
    const lethal = findLethal(view, actions, playerId);
    if (lethal) return lethal;

    // 2) 打出手中卡牌（先铺场、攒资源、触发同盟）
    const play = choosePlay(view, actions, me);
    if (play) return play;

    // 3) 发动有益能力（同盟/双同盟/基地主能力/可选能力/补刀销毁）
    const ability = chooseAbility(view, actions, me);
    if (ability) return ability;

    // 4) 购买最优可负担卡牌（建设雪球）
    const buy = chooseBuy(view, actions, me);
    if (buy) return buy;

    // 5) 用战斗拆前哨 / 直伤抢杀 / 拆基地
    const atk = chooseAttack(view, actions, me, playerId);
    if (atk) return atk;

    // 6) 团队资源结转：把余裕贸易/战斗交给下一顺位队友（整队轮流，队末才清算）
    const transfer = chooseTransfer(view, actions, me, playerId);
    if (transfer) return transfer;

    // 7) emperor：把弃牌里好牌交给相邻队友
    const move = chooseMoveCard(view, actions, me);
    if (move) return move;

    // 8) 兜底：结束回合或任意合法动作（绝不抛异常、不修改视图）
    const end = actions.find(a => a.type === 'endTurn');
    if (end) return end;
    return actions[0];
  } catch (e) {
    // 任何意外都安全退回，绝不中断对局
    const end = actions.find(a => a.type === 'endTurn');
    if (end) return end;
    return actions[0];
  }
}
