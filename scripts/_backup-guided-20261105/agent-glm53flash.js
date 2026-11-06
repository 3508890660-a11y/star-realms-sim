// GLM5.3flash · 快攻闪击 —— 零依赖、只读、防御式决策脚本。
// 设计目标：
//   1) lethal 搜索永远第一优先；
//   2) 优先拆除阻止直伤的敌方前哨（含 destroyBase 类能力）；
//   3) 低费船优先出、同盟即时触发，追求每点战斗的当回合收益；
//   4) 只做高性价比购买（探索者/低费船），不攒后期大件；
//   5) 战斗向权威最低的对手倾泻，2V2 把剩余资源转给队友；
//   6) 所有 pending（discard/selectScrap/targetDiscard/eventChoice）与未知动作
//      一律安全兜底，任何路径都原样返回 legalActions 中的对象，绝不抛异常。

export const meta = {
  name: 'GLM5.3flash 快攻闪击',
  description: 'glm-5.3-flash 快攻闪击策略：lethal 搜索、拆除拦截前哨、低费船速攻与每点战斗即时收益，终局用 scrap 补刀收尾；兼容五种模式与 core/colonyWars/events 任意组合。'
};

// ---------- 基础工具（全部只读，不触碰冻结对象） ----------

function cardOf(view, uid) {
  return (view && view.cards && view.cards[uid]) || null;
}

function isOutpost(view, uid) {
  const c = cardOf(view, uid);
  return !!(c && c.outpost);
}

function defenseOf(view, uid) {
  const c = cardOf(view, uid);
  const d = c && typeof c.defense === 'number' ? c.defense : null;
  return d === null ? Number.POSITIVE_INFINITY : d;
}

function authorityOf(view, id) {
  const p = view && view.players ? view.players[id] : null;
  return p && typeof p.authority === 'number' ? p.authority : 0;
}

// 找到某个场上 uid 的拥有者座位 id（找不到返回 -1）
function ownerOf(view, uid) {
  const players = (view && view.players) || [];
  for (const p of players) {
    if (Array.isArray(p.inPlay) && p.inPlay.includes(uid)) return p.id;
  }
  return -1;
}

function groupByType(legalActions) {
  const group = Object.create(null);
  for (const a of legalActions) {
    const t = a && a.type ? a.type : '_unknown_';
    (group[t] = group[t] || []).push(a);
  }
  return group;
}

// ---------- 待决（pending）处理 ----------

function pickPending(view, group, legalActions) {
  // 强制弃牌：丢价值最低的（费用最低，船略后于非船）
  if (group.discard) {
    let best = null, bestScore = Number.POSITIVE_INFINITY;
    for (const a of group.discard) {
      const c = cardOf(view, a.cardId);
      let score = c && typeof c.cost === 'number' && c.cost >= 0 ? c.cost : 0;
      if (c && c.type === 'ship') score += 0.5; // 快攻更不舍得丢船
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best || group.discard[0];
  }
  // 强制销毁：销毁价值最低的
  if (group.selectScrap) {
    let best = null, bestScore = Number.POSITIVE_INFINITY;
    for (const a of group.selectScrap) {
      const c = cardOf(view, a.cardId);
      const score = c && typeof c.cost === 'number' && c.cost >= 0 ? c.cost : 0;
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best || group.selectScrap[0];
  }
  // 指定弃牌目标：直接取第一个候选（合法即可）
  if (group.targetDiscard) return group.targetDiscard[0];
  // 事件选择：能付的代价里挑最保守的（pay 最小 / 目标最少），否则取第一个
  if (group.eventChoice) {
    let best = null, bestScore = Number.POSITIVE_INFINITY;
    for (const a of group.eventChoice) {
      let score = 0;
      if (typeof a.pay === 'number') score += a.pay;
      if (Array.isArray(a.targets)) score += a.targets.length;
      if (Array.isArray(a.cards)) score += a.cards.length;
      if (score < bestScore) { bestScore = score; best = a; }
    }
    return best || group.eventChoice[0];
  }
  return null;
}

// ---------- 攻击与拆前哨 ----------

function lethalAttack(view, group) {
  const list = group.attack;
  if (!list) return null;
  let best = null, bestAuth = Number.POSITIVE_INFINITY;
  for (const a of list) {
    if (a.targetType !== 'player') continue;
    const auth = authorityOf(view, a.targetId);
    if (a.amount >= auth && auth < bestAuth) { bestAuth = auth; best = a; }
  }
  return best;
}

// 用 destroyBase 类能力（scrap/optional/ally）拆敌方前哨，优先防御最低者
function outpostDestroyAbility(view, group) {
  const list = group.ability;
  if (!list) return null;
  let best = null, bestDef = Number.POSITIVE_INFINITY;
  for (const a of list) {
    if (a.ability !== 'scrap' && a.ability !== 'optional' && a.ability !== 'ally') continue;
    if (typeof a.targetId !== 'string') continue;
    if (!isOutpost(view, a.targetId)) continue;
    const d = defenseOf(view, a.targetId);
    if (d < bestDef) { bestDef = d; best = a; }
  }
  return best;
}

// 用攻击全额击碎前哨（amount >= 防御必然摧毁），优先前哨主防最弱/权威最低的对手
function outpostKillAttack(view, group) {
  const list = group.attack;
  if (!list) return null;
  let best = null, bestScore = Number.POSITIVE_INFINITY;
  for (const a of list) {
    if (a.targetType !== 'base') continue;
    if (!isOutpost(view, a.targetId)) continue;
    if (a.amount < defenseOf(view, a.targetId)) continue; // 打不碎就不算拆拦截
    const owner = ownerOf(view, a.targetId);
    const score = owner >= 0 ? authorityOf(view, owner) : 0;
    if (score < bestScore) { bestScore = score; best = a; }
  }
  return best;
}

// 普通攻击：优先打权威最低的对手（火力集中），并把战斗全部倾泻
function playerAttack(view, group) {
  const list = group.attack;
  if (!list) return null;
  let best = null, bestAuth = Number.POSITIVE_INFINITY, bestAmount = -1;
  for (const a of list) {
    if (a.targetType !== 'player') continue;
    const auth = authorityOf(view, a.targetId);
    if (auth < bestAuth || (auth === bestAuth && a.amount > bestAmount)) {
      bestAuth = auth; bestAmount = a.amount; best = a;
    }
  }
  return best;
}

// 打基地：先选能全额击碎的（前哨优先，防御最低优先），否则啃防御最低的前哨
function baseAttack(view, group) {
  const list = group.attack;
  if (!list) return null;
  let kill = null, killDef = Number.POSITIVE_INFINITY, killOut = false;
  let chip = null, chipDef = Number.POSITIVE_INFINITY;
  for (const a of list) {
    if (a.targetType !== 'base') continue;
    const d = defenseOf(view, a.targetId);
    const op = isOutpost(view, a.targetId);
    if (a.amount >= d) {
      const eff = (op ? -0.5 : 0) + d; // 同等防御下优先前哨
      if (!kill || eff < (killOut ? -0.5 : 0) + killDef) { killDef = d; killOut = op; kill = a; }
    } else if (op && d < chipDef) { chipDef = d; chip = a; }
  }
  return kill || chip;
}

// ---------- 出牌 / 能力 / 购买评分 ----------

// 出牌：优先带免费获得（row 指向交易行，船 > 基地 > 高费加成），同分偏向低费（快攻节奏）
function playScore(view, a) {
  let s = 1;
  if (a.row !== undefined && a.row !== null) {
    const uid = view.tradeRow ? view.tradeRow[a.row] : null;
    const c = cardOf(view, uid);
    if (c) {
      s += c.type === 'ship' ? 3 : 2;
      if (typeof c.cost === 'number' && c.cost >= 6) s += 1;
    } else {
      s += 1;
    }
  }
  const self = cardOf(view, a.cardId);
  if (self && typeof self.cost === 'number' && self.cost >= 0) {
    s += Math.max(0, 6 - Math.min(6, self.cost)) * 0.1; // 低费先出
  }
  return s;
}

function bestPlay(view, group) {
  const list = group.play;
  if (!list || !list.length) return null;
  let best = null, bestScore = -Number.POSITIVE_INFINITY;
  for (const a of list) {
    const s = playScore(view, a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best;
}

// 购买：快攻只买得起性价比——探索者与低费船优先，早期跳过昂贵大件
function buyScore(view, a, context) {
  const turn = context && typeof context.turn === 'number' ? context.turn : 0;
  if (a.explorer) return 5;
  const uid = view.tradeRow ? view.tradeRow[a.row] : null;
  const c = cardOf(view, uid);
  if (!c) return -1;
  let s = c.type === 'ship' ? 4 : 2;
  if (typeof c.cost === 'number') {
    s += Math.max(0, 4 - c.cost) * 0.5;        // 低费更符合闪击节奏
    if (c.cost > 6 && turn < 8) s -= 3;        // 前期不囤大件
  }
  if (c.outpost) s -= 0.5;                     // 前哨不直接压血，稍降权
  return s;
}

function bestBuy(view, group, context) {
  const list = group.buy;
  if (!list || !list.length) return null;
  let best = null, bestScore = 3.5; // 低于阈值就不买，保留资源不乱花
  for (const a of list) {
    const s = buyScore(view, a, context);
    if (s >= bestScore) { bestScore = s; best = a; }
  }
  return best;
}

// 同盟能力：触发即赚，优先免费拿船（acquire 类带 row 的），否则取第一个
function bestAlly(group) {
  const list = group.ally || (group.ability || []).filter(a => a.ability === 'ally');
  if (!list || !list.length) return null;
  let best = null, bestScore = -1;
  for (const a of list) {
    let s = 1;
    if (typeof a.row === 'number') s += 1;
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best;
}

// 其余能力（primary/optional/scrap 残余）：取第一个可用，scrap 仅终局/低血时补刀
function leftoverAbility(view, group, context, playerId) {
  const list = group.ability;
  if (!list || !list.length) return null;
  const turn = context && typeof context.turn === 'number' ? context.turn : 0;
  const lowEnemy = minEnemyAuthority(view, playerId);
  for (const a of list) {
    if (a.ability === 'scrap' && turn < 6 && lowEnemy > 12) continue; // 前中期不乱烧
    return a;
  }
  return null;
}

function minEnemyAuthority(view, selfId) {
  let min = Number.POSITIVE_INFINITY;
  for (const p of (view && view.players) || []) {
    if (p.id === selfId || p.eliminated) continue;
    if (typeof p.authority === 'number' && p.authority < min) min = p.authority;
  }
  return min;
}

// 2V2 资源预留：当只剩 transfer 与 endTurn 时，把剩余 trade/combat 全部转给队友
function bestTransfer(view, group, playerId) {
  const list = group.transfer;
  if (!list || !list.length) return null;
  const me = view.players[playerId];
  if (!me) return null;
  const tradeAmt = typeof me.trade === 'number' ? me.trade : 0;
  const combatAmt = typeof me.combat === 'number' ? me.combat : 0;
  if (tradeAmt >= 2) {
    const t = list.find(a => a.resource === 'trade' && a.amount === tradeAmt);
    if (t) return t;
  }
  if (combatAmt >= 2) {
    const t = list.find(a => a.resource === 'combat' && a.amount === combatAmt);
    if (t) return t;
  }
  return null;
}

function firstNonEndTurn(legalActions) {
  for (const a of legalActions) if (a && a.type !== 'endTurn') return a;
  return null;
}

function endTurnOf(legalActions) {
  for (const a of legalActions) if (a && a.type === 'endTurn') return a;
  return legalActions[0];
}

// ---------- 主决策 ----------

function decide({ view, legalActions, playerId, context }) {
  if (!legalActions || !legalActions.length) return undefined;
  const group = groupByType(legalActions);

  // 0) 待决选择（discard/selectScrap/targetDiscard/eventChoice）
  const pending = pickPending(view, group, legalActions);
  if (pending) return pending;

  // 1) lethal：能直接击杀就绝不手软
  const lethal = lethalAttack(view, group);
  if (lethal) return lethal;

  // 2) 拆除阻止直伤的敌方前哨：能力摧毁优先于攻击摧毁
  const opAbility = outpostDestroyAbility(view, group);
  if (opAbility) return opAbility;
  const opKill = outpostKillAttack(view, group);
  if (opKill) return opKill;

  // 3) 同盟即时触发（快攻要的就是当回合收益）
  const ally = bestAlly(group);
  if (ally) return ally;

  // 4) 出牌：低费船与免费获得优先
  const play = bestPlay(view, group);
  if (play) return play;

  // 5) 残余能力（base primary / optional / 终局 scrap 补刀）
  const ability = leftoverAbility(view, group, context, playerId);
  if (ability) return ability;

  // 6) 有价值购买：探索者/低费船优先，不达阈值不乱花
  const buy = bestBuy(view, group, context);
  if (buy) return buy;

  // 7) 削血攻击：打权威最低对手并倾泻全部战斗；没有玩家目标就啃基地
  const patk = playerAttack(view, group);
  if (patk) return patk;
  const batk = baseAttack(view, group);
  if (batk) return batk;

  // 8) 2V2 资源预留：仅当场上再无可执行动作时，把剩余资源转给队友
  const otherUseful = ['attack', 'play', 'buy', 'ability', 'ally'].some(t => group[t]);
  if (!otherUseful && group.transfer) {
    const tr = bestTransfer(view, group, playerId);
    if (tr) return tr;
  }

  // 9) 兜底：任何未知动作类型先试着用掉，实在没有再结束回合
  const fallback = firstNonEndTurn(legalActions);
  return fallback || endTurnOf(legalActions);
}

export function chooseAction(args) {
  const ctx = args || {};
  const actions = Array.isArray(ctx.legalActions) ? ctx.legalActions : [];
  try {
    const choice = decide({
      view: ctx.view,
      legalActions: actions,
      playerId: ctx.playerId,
      context: ctx.context
    });
    if (choice && actions.includes(choice)) return choice;
    return actions[0];
  } catch (err) {
    return actions[0];
  }
}
