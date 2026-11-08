// ============================================================
// 策略名称：蜂群速攻（Blitz Swarm）
// 选择理由（一句话）：1v1 权威池仅 50 且回复手段稀少，战斗输出是最直接、
//   可逐回合累计的获胜资源；以「每回合战斗最大化 + 持续削薄牌库」速攻压制，
//   比慢速贸易积累更稳定地终结对手。
// 执行模型 ID：kimi-k2.8-preview
// 零依赖：不使用 import / require，只依据 legalActions 与 view 决策。
// ============================================================

export const meta = {
  name: 'KIMI 2.8preview · 蜂群速攻',
  description: 'kimi-k2.8-preview 策略「蜂群速攻」：1v1 权威池仅 50 且回复稀少，优先打光手牌堆战斗输出、持续 scrap 削薄牌库，速攻压制快速终结对手。'
};

// ---------- 卡牌知识 ----------

// 初始牌与低价值牌（削牌/弃牌时优先处理）
const JUNK = { scout: 1.0, viper: 0.4 };

// 各卡「销毁能力」的效果（key 为卡牌 id），用于判断何时主动销毁
const SCRAP_FX = {
  explorer: { combat: 2 },
  battleStation: { combat: 5 },
  spaceStation: { trade: 4 },
  barterWorld: { combat: 5 },
  tradingPost: { combat: 3 },
  blobWheel: { trade: 3 },
  ram: { trade: 3 },
  stellarReef: { trade: 3 },
  bioformer: { trade: 3 },
  dreadnaught: { combat: 5 },
  battleBlob: { combat: 4 },
  cargoPod: { combat: 3 },
  repairBot: { combat: 2 },
  agingBattleship: { combat: 2, draw: 2 },
  imperialFrigate: { draw: 1 },
  surveyShip: { discardOpponent: 1 },
  gunship: { trade: 4 },
  falcon: { discardOpponent: 1 },
  frontierFerry: { destroyBase: true },
  plasmaVent: { destroyBase: true },
  portOfCall: { draw: 1, destroyBase: true },
  battlecruiser: { draw: 1, destroyBase: true }
};

const num = (text, re) => {
  let m;
  let sum = 0;
  const r = new RegExp(re, 'g');
  while ((m = r.exec(text))) sum += Number(m[1]);
  return sum;
};

// 通用卡牌评分：由规则文本数值 + 类型/前哨/关键词得出，全牌池通用
function cardScore(c) {
  if (!c) return 0;
  if (JUNK[c.id] !== undefined) return JUNK[c.id];
  const t = c.text || '';
  let s = 0;
  s += num(t, '获得 (\\d+) 战斗') * 1.0;
  s += num(t, '获得 (\\d+) 贸易') * 0.9;
  s += num(t, '获得 (\\d+) 权威') * 0.7;
  s += num(t, '抽 (\\d+) 张牌') * 1.6;
  if (c.outpost) s += 2 + (c.defense || 0) * 0.5;
  else if (c.type === 'base') s += 1 + (c.defense || 0) * 0.25;
  if (/免费获得/.test(t)) s += 3;
  if (/摧毁目标基地/.test(t)) s += 2.5;
  if (/目标对手弃/.test(t)) s += 1.5;
  if (/置入手牌/.test(t)) s += 2;
  if (/牌库顶/.test(t)) s += 1;
  return s;
}

const isJunkUid = (uid, cardOf) => {
  const c = cardOf(uid);
  return !!c && cardScore(c) <= 2.5;
};

// ---------- 决策上下文 ----------

function buildCtx(view, playerId, cardOf) {
  const me = (view && view.players && view.players[playerId]) || {};
  const row = (view && view.tradeRow) || [];
  const rowCards = row.map(uid => cardOf(uid)).filter(Boolean);
  return {
    me,
    myTrade: me.trade || 0,
    myCombat: me.combat || 0,
    myAuth: typeof me.authority === 'number' ? me.authority : 50,
    rowCards,
    affordableGood: extra => rowCards.some(c =>
      c.cost !== null && c.cost !== undefined && c.cost <= (me.trade || 0) + extra && cardScore(c) >= 4),
    goodFreeAcquire: rowCards.some(c =>
      c.cost !== null && c.cost !== undefined && c.cost <= 6 && cardScore(c) >= 5),
    junkInHand: (me.hand || []).some(uid => isJunkUid(uid, cardOf)),
    blobPlayed: (me.playedThisTurn || []).filter(uid => {
      const c = cardOf(uid);
      return c && c.faction === 'blob';
    }).length
  };
}

// primaryChoice 选项判断：按 id 特化，未知卡默认选项 0
function wantChoice(c, a, ctx) {
  switch (c && c.id) {
    case 'patrolMech': // 3 贸易 / 5 战斗
      return (a.choice === 0) === ctx.affordableGood(3);
    case 'frontierStation': // 2 贸易 / 3 战斗
      return (a.choice === 0) === ctx.affordableGood(2);
    case 'barterWorld': // 2 权威 / 2 贸易
    case 'tradingPost': // 1 权威 / 1 贸易
      return (a.choice === 1) === (ctx.affordableGood(2) || ctx.myTrade < 2);
    case 'defenseCenter': // 3 权威 / 2 战斗
      return (a.choice === 0) === (ctx.myAuth <= 28);
    case 'recyclingStation': // 1 贸易 / 弃至多 2 再抽
      return (a.choice === 1) === ctx.junkInHand;
    case 'blobWorld': // 5 战斗 / 每打过一张虫群抽 1
      return (a.choice === 1) === (ctx.blobPlayed >= 3);
    case 'parasite': // 6 战斗 / 免费获得 ≤6 的牌
      return a.choice === 1 ? ctx.goodFreeAcquire : true;
    default:
      return (a.choice || 0) === 0;
  }
}

// ---------- 待决事件 ----------

function pickEvent(actions, view, playerId, cardOf, me, authorityOf) {
  const pending = (view && view.pending) || {};
  const kind = pending.kind;
  if (kind === 'blackHole') { // 每少弃一张失 4 权威
    let best = actions[0];
    let bestCost = Infinity;
    for (const a of actions) {
      const ts = a.targets || [];
      const cost = 4 * (2 - ts.length) + ts.reduce((s, u) => s + cardScore(cardOf(u)), 0);
      if (cost < bestCost) { bestCost = cost; best = a; }
    }
    return best;
  }
  if (kind === 'comet') { // 免费销毁手牌/弃牌至多 2 张：优先削垃圾
    let best = actions[0];
    let bestV = -Infinity;
    for (const a of actions) {
      const ts = a.targets || [];
      const v = ts.reduce((s, u) => s + (6 - cardScore(cardOf(u))), 0);
      if (v > bestV) { bestV = v; best = a; }
    }
    return best;
  }
  if (kind === 'bombardment') { // 毁一座基地或失 6 权威
    const pay = actions.find(a => a.pay);
    const baseActs = actions.filter(a => a.baseId);
    if (!baseActs.length) return pay || actions[0];
    let worst = baseActs[0];
    let worstV = Infinity;
    for (const a of baseActs) {
      const v = cardScore(cardOf(a.baseId));
      if (v < worstV) { worstV = v; worst = a; }
    }
    if (worstV > 6 && (me ? me.authority : 50) > 8) return worst;
    return pay || worst;
  }
  if (kind === 'warpJump') { // 抽 3 留 1，放回 2：把好牌放回牌库顶（先放最好的）
    let best = actions[0];
    let bestV = -Infinity;
    for (const a of actions) {
      const cs = a.cards || [];
      const v = (cs.length ? cardScore(cardOf(cs[0])) * 2 : 0) + (cs[1] ? cardScore(cardOf(cs[1])) : 0);
      if (v > bestV) { bestV = v; best = a; }
    }
    return best;
  }
  // 未知事件：优先零代价兜底
  const free = actions.find(a => !a.pay && !(a.targets || []).length && !a.baseId && !(a.cards || []).length);
  return free || actions[0];
}

// ---------- 主要/同盟能力 ----------

function targetValue(a, cardOf) {
  return (a.targets || []).reduce((s, u) => s + (6 - cardScore(cardOf(u))), 0);
}

function pickAbility(list, ctx, cardOf) {
  let best = null;
  let bestV = -Infinity;
  for (const a of list) {
    let v = 3; // 普通资源/抽牌能力
    if (a.choice !== undefined) {
      const c = cardOf(a.cardId);
      if (!wantChoice(c, a, ctx)) v = -50;
    }
    if (a.targets) {
      if (!a.targets.length) continue; // 空目标（如补给站不 discard）无收益
      v = targetValue(a, cardOf);
    }
    if (a.row !== undefined) v += cardScore(cardOf(ctx.viewRow(a.row)));
    if (a.rows) {
      for (const r of a.rows) v += cardScore(cardOf(ctx.viewRow(r)));
    }
    if (a.targetId) v += 6 + cardScore(cardOf(a.targetId));
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

// ---------- 可选能力 ----------

function pickOptional(list, ctx, cardOf, view, playerId, minEnemyAuth) {
  let best = null;
  let bestV = 0;
  const row = view.tradeRow || [];
  for (const a of list) {
    if (a.targets) { // scrapOwn：有垃圾才发动
      const v = targetValue(a, cardOf);
      if (v > bestV && (a.targets || []).some(u => isJunkUid(u, cardOf))) { bestV = v; best = a; }
    } else if (a.row !== undefined || a.rows) { // 销毁交易行：拦截对手买得起的好牌
      const rows = a.rows || [a.row];
      let v = 0;
      for (const r of rows) {
        const c = cardOf(row[r]);
        if (c && c.cost >= 3 && cardScore(c) >= 4.5 && c.cost > ctx.myTrade) v += cardScore(c);
      }
      if (v > bestV) { bestV = v; best = a; }
    } else if (a.targetId) { // 摧毁基地：优先前哨或终局
      const c = cardOf(a.targetId);
      const v = c && c.outpost ? 8 + cardScore(c) : (c ? cardScore(c) : 0);
      if (v > bestV && c && (c.outpost || minEnemyAuth <= 14 || (c.defense || 99) <= 4)) { bestV = v; best = a; }
    }
  }
  return best;
}

// ---------- 销毁能力 ----------

function bestEnemyOutpost(view, playerId, cardOf) {
  const players = view.players || [];
  let best = null;
  let bestV = -Infinity;
  for (const p of players) {
    if (!p || p.id === playerId || p.eliminated) continue;
    for (const uid of p.inPlay || []) {
      const c = cardOf(uid);
      if (c && c.type === 'base' && c.outpost && cardScore(c) > bestV) { bestV = cardScore(c); best = uid; }
    }
  }
  return best;
}

function pickScrapAbility(list, view, playerId, cardOf, ctx, minEnemyAuth) {
  for (const a of list) {
    const c = cardOf(a.cardId);
    if (!c) continue;
    const fx = SCRAP_FX[c.id] || {};
    const isShip = c.type === 'ship';
    if (fx.combat) {
      const ok = isShip
        ? (minEnemyAuth <= 18 || ctx.myCombat + fx.combat >= minEnemyAuth)
        : (ctx.myCombat + fx.combat >= minEnemyAuth || minEnemyAuth <= 10);
      if (ok) return a;
    }
    if (fx.trade) {
      // 飞船的贸易销毁可补购买差额；基地的只在终局拆
      const gap = bestBuyGap(view, cardOf, ctx, fx.trade);
      if (isShip ? gap > 0 : minEnemyAuth <= 10) return a;
    }
    if (fx.discardOpponent && isShip) return a;
    if (fx.draw && isShip && !fx.destroyBase) return a;
    if (fx.destroyBase) {
      const outpost = bestEnemyOutpost(view, playerId, cardOf);
      if (outpost) {
        const targeted = list.find(x => x.cardId === a.cardId && x.targetId === outpost);
        return targeted || a;
      }
      if (isShip && fx.draw) return a; // 飞船反正回合末弃掉，顺带抽牌
    }
  }
  return null;
}

// 若多得 extraTrade 贸易，能否买到明显更好的牌（返回差额提示 >0）
function bestBuyGap(view, cardOf, ctx, extraTrade) {
  let gap = 0;
  for (const c of ctx.rowCards) {
    if (c.cost === null || c.cost === undefined) continue;
    const now = c.cost <= ctx.myTrade && cardScore(c) >= 4;
    const withExtra = c.cost <= ctx.myTrade + extraTrade && cardScore(c) >= 5.5;
    if (!now && withExtra) gap = Math.max(gap, c.cost - ctx.myTrade);
  }
  return gap;
}

// ---------- 出牌 ----------

function pickPlay(plays, ctx, cardOf) {
  let best = null;
  let bestV = -Infinity;
  for (const a of plays) {
    const c = cardOf(a.cardId);
    let v = cardScore(c);
    if (a.copy) v += cardScore(cardOf(a.copy)) * 0.9; // 复制舰/复制基地
    if (a.choice !== undefined && !wantChoice(c, a, ctx)) v -= 50;
    if (v > bestV) { bestV = v; best = a; }
  }
  return best || plays[0];
}

// ---------- 主决策 ----------

export async function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return undefined;
  if (!view || !view.players) return legalActions[0];

  const players = view.players;
  const cardOf = uid => (view.cards && view.cards[uid]) || null;
  const ofType = t => legalActions.filter(a => a.type === t);
  const endTurn = ofType('endTurn')[0] || null;

  const enemyIds = players.filter(p => p && p.id !== playerId && !p.eliminated).map(p => p.id);
  const authorityOf = id => {
    if (view.teams && view.teams.length) {
      const team = view.teams.find(t => (t.players || []).includes(id));
      if (team) return team.authority;
    }
    return players[id] && typeof players[id].authority === 'number' ? players[id].authority : 999;
  };
  const weakestEnemy = () => {
    if (!enemyIds.length) return -1;
    return enemyIds.reduce((a, b) => (authorityOf(a) <= authorityOf(b) ? a : b));
  };
  const minEnemyAuth = enemyIds.length ? authorityOf(weakestEnemy()) : 999;
  const me = players[playerId] || {};
  const ctx = buildCtx(view, playerId, cardOf);
  ctx.viewRow = r => (view.tradeRow || [])[r];

  // ===== 1. 待决决策 =====
  const t0 = legalActions[0].type;
  if (t0 === 'discard' || t0 === 'selectScrap') {
    // 被迫弃牌 / 强制销毁：丢价值最低的牌
    let best = legalActions[0];
    let bestV = Infinity;
    for (const a of legalActions) {
      const v = cardScore(cardOf(a.cardId));
      if (v < bestV) { bestV = v; best = a; }
    }
    return best;
  }
  if (t0 === 'targetDiscard') {
    // 指定弃牌目标：选手牌最多的对手
    let best = legalActions[0];
    let bestC = -1;
    for (const a of legalActions) {
      const c = players[a.targetId] ? players[a.targetId].handCount || 0 : 0;
      if (c > bestC) { bestC = c; best = a; }
    }
    return best;
  }
  if (t0 === 'eventChoice') return pickEvent(legalActions, view, playerId, cardOf, me, authorityOf);
  // 未知待决类型：兜底第一个（一定合法）
  if (!ofType('play').length && !ofType('buy').length && !ofType('attack').length && !endTurn) {
    return legalActions[0];
  }

  const attacks = ofType('attack');

  // ===== 2. 斩杀检测 =====
  if (attacks.length && enemyIds.length) {
    const weakest = weakestEnemy();
    const wAuth = authorityOf(weakest);
    const lethal = attacks.filter(a => a.targetType === 'player' && a.targetId === weakest && a.amount >= wAuth);
    if (lethal.length) return lethal.reduce((x, y) => (x.amount >= y.amount ? x : y));
  }

  // ===== 3. 出牌 =====
  const plays = ofType('play');
  if (plays.length) return pickPlay(plays, ctx, cardOf);

  // ===== 4. 能力 =====
  const abilities = ofType('ability');
  const primAlly = abilities.filter(a => a.ability === 'primary' || a.ability === 'ally');
  const picked = pickAbility(primAlly, ctx, cardOf);
  if (picked) return picked;
  const optional = abilities.filter(a => a.ability === 'optional');
  const pickedOpt = pickOptional(optional, ctx, cardOf, view, playerId, minEnemyAuth);
  if (pickedOpt) return pickedOpt;
  const scraps = abilities.filter(a => a.ability === 'scrap');
  const pickedScrap = pickScrapAbility(scraps, view, playerId, cardOf, ctx, minEnemyAuth);
  if (pickedScrap) return pickedScrap;

  // ===== 5. 购买 =====
  const buys = ofType('buy');
  if (buys.length) {
    let best = null;
    let bestV = 2.4; // 阈值：低于此宁可不买，避免牌库膨胀
    for (const a of buys) {
      let v;
      if (a.explorer) {
        v = 2.6; // 探索者：2 贸易 + 可销毁 2 战斗，余钱兜底
      } else {
        const c = cardOf(ctx.viewRow(a.row));
        if (!c) continue;
        v = cardScore(c) - 0.45 * (c.cost || 0);
      }
      if (v > bestV) { bestV = v; best = a; }
    }
    if (best) return best;
  }

  // ===== 6. 攻击 =====
  if (attacks.length && enemyIds.length) {
    const playerActs = attacks.filter(a => a.targetType === 'player');
    if (playerActs.length) {
      // 集中火力打权威最低的对手
      let target = weakestEnemy();
      if (!playerActs.some(a => a.targetId === target)) {
        target = playerActs[0].targetId;
        for (const a of playerActs) {
          if (authorityOf(a.targetId) < authorityOf(target)) target = a.targetId;
        }
      }
      const opts = playerActs.filter(a => a.targetId === target);
      return opts.reduce((x, y) => (x.amount >= y.amount ? x : y));
    }
    // 前哨阻挡：能击杀就击杀，否则磨最高价值前哨
    const damage = view.damage || {};
    const finishing = attacks.filter(a => {
      const c = cardOf(a.targetId);
      return c && a.amount >= Math.max(1, (c.defense || 0) - (damage[a.targetId] || 0));
    });
    if (finishing.length) return finishing[0];
    let best = attacks[0];
    let bestV = -Infinity;
    for (const a of attacks) {
      const v = cardScore(cardOf(a.targetId));
      if (v > bestV) { bestV = v; best = a; }
    }
    return best;
  }

  // ===== 7. 结束回合 / 兜底 =====
  if (endTurn) return endTurn;
  // 未知主阶段动作（未来扩展）：随机挑一个非结束动作，保证不死循环
  const others = legalActions.filter(a => a.type !== 'endTurn');
  return others.length ? others[Math.floor((random ? random() : Math.random()) * others.length)] : legalActions[0];
}
