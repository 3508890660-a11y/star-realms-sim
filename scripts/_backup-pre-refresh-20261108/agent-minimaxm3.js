/**
 * MiniMax M3 · 壁垒重锤（Bastion & Hammer）
 *
 * 策略名称：壁垒重锤（Bastion & Hammer）
 * 选择理由（一句话）：1v1 唯一的胜点是把对手权威打到 0，而本引擎里前哨基地会完全封锁
 *   「对方法威伤害」（对方只要有前哨，我就只能先拆墙，而且墙的防御值必须在一回合内一次打满，
 *   因为基地受到的伤害回合末清零），所以最优打法是两段式——先用可重复触发的基地引擎
 *   （储藏筒仓每回合 +2 权威、贸易站/易货世界/防御中心每回合权威、战争世界/空间站每回合战斗）
 *   叠高自己的权威血线并顺手造一道前哨墙锁死对手的直伤通道，再用单回合爆发的战斗
 *   把对手的前哨墙一击拆掉，再把伤害全额灌进权威。
 *
 * 零依赖脚本：不含 import / require，不修改 view 与 legalActions，
 * 每次 chooseAction 都从 legalActions 里原样返回一个动作对象。
 */

/* ------------------------------------------------------------------ *
 * meta
 * ------------------------------------------------------------------ */

export const meta = {
  name: 'MiniMax M3 · 壁垒重锤',
  description:
    'minimax-m3-pay 自主设计的「壁垒重锤」：用可重复触发的基地引擎与前哨墙筑高权威血线、锁死对手直伤通道，再用单回合战斗爆发拆掉对手前哨墙并把伤害全额灌进权威。'
};

/* ------------------------------------------------------------------ *
 * 卡牌知识表（依据 src/engine/cards.js 与 src/engine/expansions.js 独立整理）
 * t 船/基地  c 费用  d 防御  o 前哨  f 阵营
 * p 主要能力  pc 主要能力选项  a 同盟能力  op 可选主要能力  s 销毁能力
 * x 特殊标记
 * ------------------------------------------------------------------ */

const CARDS = {
  /* --- 基础盒 --- */
  scout: { t: 'ship', f: 'neutral', p: { trade: 1 } },
  viper: { t: 'ship', f: 'neutral', p: { combat: 1 } },
  explorer: { t: 'ship', c: 2, f: 'neutral', p: { trade: 2 }, s: { combat: 2 } },
  battleBlob: { t: 'ship', c: 6, f: 'blob', p: { combat: 8 }, a: { draw: 1 }, s: { combat: 4 } },
  battlePod: { t: 'ship', c: 2, f: 'blob', p: { combat: 4 }, op: { scrapRow: 1 }, a: { combat: 2 } },
  blobCarrier: { t: 'ship', c: 6, f: 'blob', p: { combat: 7 }, a: { acquireShipFree: true } },
  blobDestroyer: { t: 'ship', c: 4, f: 'blob', p: { combat: 6 }, a: { destroyAndOrScrap: true } },
  blobFighter: { t: 'ship', c: 1, f: 'blob', p: { combat: 3 }, a: { draw: 1 } },
  blobWheel: { t: 'base', c: 3, d: 5, f: 'blob', p: { combat: 1 }, s: { trade: 3 } },
  blobWorld: { t: 'base', c: 8, d: 7, f: 'blob', pc: [{ combat: 5 }, { drawBlobPlayed: true }] },
  mothership: { t: 'ship', c: 7, f: 'blob', p: { combat: 6, draw: 1 }, a: { draw: 1 } },
  ram: { t: 'ship', c: 3, f: 'blob', p: { combat: 5 }, a: { combat: 2 }, s: { trade: 3 } },
  theHive: { t: 'base', c: 5, d: 5, f: 'blob', p: { combat: 3 }, a: { draw: 1 } },
  tradePod: { t: 'ship', c: 2, f: 'blob', p: { trade: 3 }, a: { combat: 2 } },
  battleMech: { t: 'ship', c: 5, f: 'machine', p: { combat: 4 }, op: { scrapOwn: 1 }, a: { draw: 1 } },
  battleStation: { t: 'base', c: 3, d: 5, o: true, f: 'machine', s: { combat: 5 } },
  brainWorld: { t: 'base', c: 8, d: 6, o: true, f: 'machine', p: { scrapOwn: 2, drawPerScrap: true } },
  junkyard: { t: 'base', c: 6, d: 6, o: true, f: 'machine', p: { scrapOwn: 1 } },
  machineBase: { t: 'base', c: 7, d: 6, o: true, f: 'machine', p: { draw: 1, scrapOwnMandatory: 1 } },
  mechWorld: { t: 'base', c: 5, d: 6, o: true, f: 'machine', x: { allAlly: true } },
  missileBot: { t: 'ship', c: 2, f: 'machine', p: { combat: 2 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  missileMech: { t: 'ship', c: 6, f: 'machine', p: { combat: 6 }, op: { destroyBase: true }, a: { draw: 1 } },
  patrolMech: { t: 'ship', c: 4, f: 'machine', pc: [{ trade: 3 }, { combat: 5 }], a: { scrapOwn: 1 } },
  stealthNeedle: { t: 'ship', c: 4, f: 'machine', x: { copyShip: true } },
  supplyBot: { t: 'ship', c: 3, f: 'machine', p: { trade: 2 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  tradeBot: { t: 'ship', c: 1, f: 'machine', p: { trade: 1 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  battlecruiser: { t: 'ship', c: 6, f: 'empire', p: { combat: 5, draw: 1 }, a: { discardOpponent: 1 }, s: { draw: 1, destroyBase: true } },
  corvette: { t: 'ship', c: 2, f: 'empire', p: { combat: 1, draw: 1 }, a: { combat: 2 } },
  dreadnaught: { t: 'ship', c: 7, f: 'empire', p: { combat: 7, draw: 1 }, s: { combat: 5 } },
  fleetHQ: { t: 'base', c: 8, d: 8, f: 'empire', x: { fleetHQ: true } },
  imperialFighter: { t: 'ship', c: 1, f: 'empire', p: { combat: 2, discardOpponent: 1 }, a: { combat: 2 } },
  imperialFrigate: { t: 'ship', c: 3, f: 'empire', p: { combat: 4, discardOpponent: 1 }, a: { combat: 2 }, s: { draw: 1 } },
  recyclingStation: { t: 'base', c: 4, d: 4, o: true, f: 'empire', pc: [{ trade: 1 }, { recycle: 2 }] },
  royalRedoubt: { t: 'base', c: 6, d: 6, o: true, f: 'empire', p: { combat: 3 }, a: { discardOpponent: 1 } },
  spaceStation: { t: 'base', c: 4, d: 4, o: true, f: 'empire', p: { combat: 2 }, a: { combat: 2 }, s: { trade: 4 } },
  surveyShip: { t: 'ship', c: 3, f: 'empire', p: { trade: 1, draw: 1 }, s: { discardOpponent: 1 } },
  warWorld: { t: 'base', c: 5, d: 4, o: true, f: 'empire', p: { combat: 3 }, a: { combat: 4 } },
  barterWorld: { t: 'base', c: 4, d: 4, f: 'federation', pc: [{ authority: 2 }, { trade: 2 }], s: { combat: 5 } },
  centralOffice: { t: 'base', c: 7, d: 6, f: 'federation', p: { trade: 2 }, a: { topDeckNextShip: true } },
  commandShip: { t: 'ship', c: 8, f: 'federation', p: { authority: 4, combat: 5, draw: 2 }, a: { destroyBase: true } },
  cutter: { t: 'ship', c: 2, f: 'federation', p: { authority: 4, trade: 2 }, a: { combat: 4 } },
  defenseCenter: { t: 'base', c: 5, d: 5, o: true, f: 'federation', pc: [{ authority: 3 }, { combat: 2 }], a: { combat: 2 } },
  embassyYacht: { t: 'ship', c: 3, f: 'federation', p: { authority: 3, trade: 2, drawIfTwoBases: 2 } },
  federationShuttle: { t: 'ship', c: 1, f: 'federation', p: { trade: 2 }, a: { authority: 4 } },
  flagship: { t: 'ship', c: 6, f: 'federation', p: { combat: 5, draw: 1 }, a: { authority: 5 } },
  freighter: { t: 'ship', c: 4, f: 'federation', p: { trade: 4 }, a: { topDeckNextShip: true } },
  portOfCall: { t: 'base', c: 6, d: 6, o: true, f: 'federation', p: { trade: 3 }, s: { draw: 1, destroyBase: true } },
  tradeEscort: { t: 'ship', c: 5, f: 'federation', p: { authority: 4, combat: 4 }, a: { draw: 1 } },
  tradingPost: { t: 'base', c: 3, d: 4, o: true, f: 'federation', pc: [{ authority: 1 }, { trade: 1 }], s: { combat: 3 } },

  /* --- 殖民战争 --- */
  battleBot: { t: 'ship', c: 1, f: 'machine', p: { combat: 2 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  solarSkiff: { t: 'ship', c: 1, f: 'federation', p: { trade: 2 }, a: { draw: 1 } },
  starBarge: { t: 'ship', c: 1, f: 'empire', p: { trade: 2 }, a: { combat: 2, discardOpponent: 1 } },
  swarmer: { t: 'ship', c: 1, f: 'blob', p: { combat: 3 }, op: { scrapRow: 1 }, a: { combat: 2 } },
  lancer: { t: 'ship', c: 2, f: 'empire', p: { combat: 4, combatIfEnemyBase: 2 }, a: { discardOpponent: 1 } },
  predator: { t: 'ship', c: 2, f: 'blob', p: { combat: 4 }, a: { draw: 1 } },
  repairBot: { t: 'ship', c: 2, f: 'machine', p: { trade: 2 }, op: { scrapOwn: 1 }, s: { combat: 2 } },
  stellarReef: { t: 'base', c: 2, d: 3, f: 'blob', p: { trade: 1 }, s: { trade: 3 } },
  storageSilo: { t: 'base', c: 2, d: 3, f: 'federation', p: { authority: 2 }, a: { trade: 2 } },
  tradeHauler: { t: 'ship', c: 2, f: 'federation', p: { trade: 3 }, a: { authority: 3 } },
  warningBeacon: { t: 'base', c: 2, d: 2, o: true, f: 'machine', p: { combat: 2 }, x: { toHandIfFaction: 'machine' } },
  cargoPod: { t: 'ship', c: 3, f: 'blob', p: { trade: 3 }, a: { combat: 3 }, s: { combat: 3 } },
  convoyBot: { t: 'ship', c: 3, f: 'machine', p: { combat: 4 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  falcon: { t: 'ship', c: 3, f: 'empire', p: { combat: 2, draw: 1 }, s: { discardOpponent: 1 } },
  orbitalPlatform: { t: 'base', c: 3, d: 4, f: 'empire', p: { discardThenDraw: 1 }, a: { combat: 3 } },
  patrolCutter: { t: 'ship', c: 3, f: 'federation', p: { trade: 2, combat: 3 }, a: { authority: 4 } },
  ravager: { t: 'ship', c: 3, f: 'blob', p: { combat: 6 }, op: { scrapRow: 2 } },
  bioformer: { t: 'base', c: 4, d: 4, f: 'blob', p: { combat: 3 }, s: { trade: 3 } },
  centralStation: { t: 'base', c: 4, d: 5, f: 'federation', p: { trade: 2, drawIfThreeBases: 1, authorityIfThreeBases: 4 } },
  commandCenter: { t: 'base', c: 4, d: 4, o: true, f: 'empire', p: { trade: 2 }, x: { empireShipBonus: 2 } },
  frontierFerry: { t: 'ship', c: 4, f: 'federation', p: { trade: 3, authority: 4 }, s: { destroyBase: true } },
  gunship: { t: 'ship', c: 4, f: 'empire', p: { combat: 5, discardOpponent: 1 }, s: { trade: 4 } },
  miningMech: { t: 'ship', c: 4, f: 'machine', p: { trade: 3 }, op: { scrapOwn: 1 }, a: { combat: 3 } },
  theOracle: { t: 'base', c: 4, d: 5, o: true, f: 'machine', p: { scrapOwn: 1 }, a: { combat: 3 } },
  agingBattleship: { t: 'ship', c: 5, f: 'empire', p: { combat: 5 }, a: { draw: 1 }, s: { combat: 2, draw: 2 } },
  colonySeedShip: { t: 'ship', c: 5, f: 'federation', p: { trade: 3, combat: 3, authority: 3 }, x: { toHandIfFaction: 'federation' } },
  heavyCruiser: { t: 'ship', c: 5, f: 'empire', p: { combat: 4, draw: 1 }, a: { draw: 1 } },
  mechCruiser: { t: 'ship', c: 5, f: 'machine', p: { combat: 6 }, op: { scrapOwn: 1 }, a: { destroyBase: true } },
  parasite: { t: 'ship', c: 5, f: 'blob', pc: [{ combat: 6 }, { acquireFreeMax: 6 }], a: { draw: 1 } },
  stealthTower: { t: 'base', c: 5, d: 5, o: true, f: 'machine', x: { copyBase: true } },
  federationShipyard: { t: 'base', c: 6, d: 6, o: true, f: 'federation', p: { trade: 2 }, a: { topDeckNextAny: true } },
  frontierStation: { t: 'base', c: 6, d: 6, o: true, f: 'machine', pc: [{ trade: 2 }, { combat: 3 }] },
  peacekeeper: { t: 'ship', c: 6, f: 'federation', p: { combat: 6, authority: 6 }, a: { draw: 1 } },
  plasmaVent: { t: 'base', c: 6, d: 5, f: 'blob', p: { combat: 4 }, x: { toHandIfFaction: 'blob' }, s: { destroyBase: true } },
  supplyDepot: { t: 'base', c: 6, d: 5, o: true, f: 'empire', p: { depot: true }, a: { draw: 1 } },
  imperialPalace: { t: 'base', c: 7, d: 6, o: true, f: 'empire', p: { draw: 1, discardOpponent: 1 }, a: { combat: 4 } },
  loyalColony: { t: 'base', c: 7, d: 6, f: 'federation', p: { trade: 3, combat: 3, authority: 3 } },
  moonwurm: { t: 'ship', c: 7, f: 'blob', p: { combat: 8, draw: 1 }, a: { acquireCheapFree: { maxCost: 2, toHand: true } } },
  theWrecker: { t: 'ship', c: 7, f: 'machine', p: { combat: 6 }, op: { scrapOwn: 2 }, a: { draw: 1 } },
  emperorsDreadnaught: { t: 'ship', c: 8, f: 'empire', p: { combat: 8, draw: 1, discardOpponent: 1 }, x: { toHandIfFaction: 'empire' } },
  factoryWorld: { t: 'base', c: 8, d: 7, o: true, f: 'federation', p: { trade: 3, nextAcquireToHand: true } },
  leviathan: { t: 'ship', c: 8, f: 'blob', p: { combat: 9, draw: 1 }, op: { destroyBase: true }, a: { acquireCheapFree: { maxCost: 3, toHand: true } } },
  theIncinerator: { t: 'base', c: 8, d: 7, o: true, f: 'machine', p: { scrapOwn: 2 }, a: { combatPerScrapOwn: 2 } }
};

/* ------------------------------------------------------------------ *
 * 估值权重与分层
 * ------------------------------------------------------------------ */

const W = { trade: 1, combat: 1, authority: 1, draw: 1.15 };
const TIER = { LETHAL: 1000, PLAY: 40, ABILITY: 30, BUY: 20, ATTACK: 10, TRANSFER: 5, END: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/* ------------------------------------------------------------------ *
 * 上下文构建：把视图折算成估值所需的状态
 * ------------------------------------------------------------------ */

function buildContext(view, legalActions, playerId, context, memory) {
  const s = view && typeof view === 'object' ? view : {};
  const players = Array.isArray(s.players) ? s.players : [];
  const me = players[playerId] || {
    id: playerId, hand: [], inPlay: [], discard: [], authority: 0, trade: 0, combat: 0, playedThisTurn: []
  };
  const mode = (context && context.mode) || s.mode || 'standard';
  const playerCount = Math.max(1, players.length);
  const turn = num(context && context.turn, num(s.turn, 1));
  const myRound = Math.floor((turn - 1) / playerCount) + 1;

  // 剩余回合估计：1v1 一局大约 13 个来回，权威墙越厚拖得越久
  const H = clamp(14 - myRound, 1.2, 14);
  const poolSize = Math.max(
    5,
    num(me.deckCount) + (me.hand || []).length + (me.discard || []).length + (me.inPlay || []).length
  );
  const cycleLen = Math.max(1.2, poolSize / 5); // 牌池循环一轮需要的回合数
  const reuse = clamp(0.6 + (H - 2) / cycleLen, 1, 3.2); // 一张买来的牌还能被打几次

  const nextAlive = (from, dir) => {
    for (let step = 1; step <= players.length; step++) {
      const idx = (from + dir * step + players.length * 2) % players.length;
      if (!players[idx].eliminated) return idx;
    }
    return null;
  };
  const canAttackPlayer = (attacker, target) => {
    if (attacker === target || !players[target] || players[target].eliminated) return false;
    if (mode === 'team2v2') return players[attacker].team !== players[target].team;
    if (mode === 'hunter' || mode === 'firstBlood') return nextAlive(attacker, 1) === target;
    return true;
  };

  const tableOf = uid => {
    const c = s.cards && s.cards[uid];
    if (!c) return null;
    const id = c.copiedFrom && s.cards[c.copiedFrom] ? s.cards[c.copiedFrom].id : c.id;
    const def = CARDS[id];
    if (!def) return null;
    return { id, def, view: c };
  };

  const ctx = {
    s,
    players,
    me,
    mode,
    playerId,
    legalActions,
    memory: memory && typeof memory === 'object' ? memory : {},
    H,
    reuse,
    tableOf,
    nextAlive,
    targets: [],
    aliveCount: Math.max(1, players.filter(p => !p.eliminated).length),
    myBaseCount: 0,
    myAllyCount: 0,
    anyEnemyBase: false,
    bestEnemyBaseValue: 0,
    combatFactor: 1,
    myFactions: new Set(),
    playedFactions: new Set(),
    fleetHQBonus: 0,
    empireBonus: 0,
    blobInHand: 0,
    myBlobPlayed: 0,
    // 先血模式胜负只看「谁先击倒」，血线本身不保命 → 权威产出的估值打折
    authWeight: mode === 'firstBlood' ? 0.5 : 1,
    pendingActions: []
  };

  // ---- 我方阵面统计 ----
  for (const uid of me.inPlay || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    const def = CARDS[c.copiedFrom && s.cards[c.copiedFrom] ? s.cards[c.copiedFrom].id : c.id];
    if (!def) continue;
    if (def.t === 'base') ctx.myBaseCount++;
    if (def.a) ctx.myAllyCount++;
    if (def.x && def.x.allAlly) ctx.myAllAlly = true;
    if (def.x && def.x.fleetHQ) ctx.fleetHQBonus++;
    if (def.x && def.x.empireShipBonus) ctx.empireBonus += def.x.empireShipBonus;
    (c.factions || []).forEach(f => ctx.myFactions.add(f));
  }
  for (const uid of me.playedThisTurn || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    (c.factions || []).forEach(f => ctx.playedFactions.add(f));
    const def = CARDS[c.id];
    if (def && def.f === 'blob') ctx.myBlobPlayed++;
  }
  for (const uid of me.hand || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    if (c.faction === 'blob') ctx.blobInHand++;
  }

  // ---- 对手统计 ----
  for (const p of players) {
    if (p.id === playerId || p.eliminated) continue;
    for (const uid of p.inPlay || []) {
      const c = s.cards && s.cards[uid];
      if (!c || c.type !== 'base') continue;
      ctx.anyEnemyBase = true;
      const info = tableOf(uid);
      if (!info) continue;
      const val = perTurnValue(ctx, info.def, true);
      if (val > ctx.bestEnemyBaseValue) ctx.bestEnemyBaseValue = val;
    }
  }

  // ---- 可攻击目标与前哨墙 ----
  const authorityOf = pid => {
    if (mode === 'team2v2') {
      const p = players[pid];
      const team = p && s.teams && s.teams[1 - p.team];
      if (team) return num(team.authority);
    }
    return num(players[pid] && players[pid].authority);
  };
  const wallOf = pid => {
    const p = players[pid];
    if (!p) return { sum: 0, count: 0 };
    const group =
      mode === 'team2v2'
        ? players.filter(x => x.team === p.team && !x.eliminated)
        : [p];
    let sum = 0;
    let count = 0;
    for (const member of group) {
      for (const uid of member.inPlay || []) {
        const c = s.cards && s.cards[uid];
        if (!c || c.type !== 'base' || !c.outpost) continue;
        sum += num(c.defense, 4);
        count++;
      }
    }
    return { sum, count };
  };
  ctx.authorityOf = authorityOf;
  ctx.wallOf = wallOf;

  for (const p of players) {
    if (p.id === playerId || p.eliminated) continue;
    if (!canAttackPlayer(playerId, p.id)) continue;
    const wall = wallOf(p.id);
    ctx.targets.push({
      id: p.id,
      authority: authorityOf(p.id),
      handCount: num(p.handCount),
      wallSum: wall.sum,
      wallCount: wall.count,
      hasOutpost: wall.count > 0
    });
  }
  ctx.minAuthTarget = ctx.targets.length
    ? ctx.targets.reduce((a, b) => (b.authority < a.authority ? b : a)).id
    : -1;

  // ---- 本回合战斗的「去处」 ----
  // 有前哨 → 权威暂时打不到，战斗只能用来拆墙；打不满墙则本回合战斗基本浪费（但仍要堆爆发）。
  let handCombat = 0;
  for (const uid of me.hand || []) {
    const info = tableOf(uid);
    if (!info) continue;
    const eff = info.def.pc ? bestEffect(ctx, info.def) : info.def.p;
    handCombat += num(eff && eff.combat) + num(eff && eff.combatIfEnemyBase);
  }
  ctx.potentialCombat = num(me.combat) + handCombat;
  let factor = 0;
  for (const t of ctx.targets) {
    const f = t.wallCount === 0 ? 1 : ctx.potentialCombat >= t.wallSum ? 1 : 0.45;
    if (f > factor) factor = f;
  }
  ctx.combatFactor = clamp(factor, 0.45, 1);

  // ---- 对手每回合战斗估计（用于评估自家前哨墙的防御价值） ----
  let oppProd = 0;
  for (const t of ctx.targets) {
    const p = players[t.id];
    let v = 0;
    for (const uid of (p && p.inPlay) || []) {
      const info = tableOf(uid);
      if (!info || info.def.t !== 'base') continue;
      v += perTurnValue(ctx, info.def, false);
    }
    v += num(p && p.handCount) * 0.8;
    if (v > oppProd) oppProd = v;
  }
  ctx.oppProduction = Math.max(4, oppProd);

  ctx.pendingActions = s.pending ? legalActions.slice() : [];
  return ctx;
}

/* ------------------------------------------------------------------ *
 * 估值基元
 * ------------------------------------------------------------------ */

/** 一个能力效果折算成「战斗等价点」。future=true 表示按未来多轮收益估值。 */
function effectValue(ctx, eff, opt) {
  if (!eff) return 0;
  const future = !!(opt && opt.future);
  const cf = future ? 1 : ctx.combatFactor;
  let v = 0;
  if (eff.trade) v += eff.trade * W.trade;
  if (eff.combat) v += eff.combat * W.combat * cf;
  if (eff.authority) v += eff.authority * W.authority * ctx.authWeight;
  if (eff.draw) v += eff.draw * W.draw;
  if (eff.combatIfEnemyBase && ctx.anyEnemyBase) v += eff.combatIfEnemyBase * W.combat * cf;
  if (eff.drawIfTwoBases && ctx.myBaseCount >= 2) v += eff.drawIfTwoBases * W.draw;
  if (eff.drawIfThreeBases && ctx.myBaseCount >= 3) v += eff.drawIfThreeBases * W.draw;
  if (eff.authorityIfThreeBases && ctx.myBaseCount >= 3) {
    v += eff.authorityIfThreeBases * W.authority * ctx.authWeight;
  }
  if (eff.drawBlobPlayed) v += (ctx.myBlobPlayed + ctx.blobInHand) * W.draw;
  if (eff.combatPerScrapOwn) {
    v += eff.combatPerScrapOwn * (num(ctx.me.scrappedThisTurn) + 1) * W.combat * cf;
  }
  if (eff.discardOpponent) v += eff.discardOpponent * (future ? 0.8 : 1.1);
  if (eff.scrapRow) v += eff.scrapRow * 1.3;
  if (eff.destroyBase) v += ctx.bestEnemyBaseValue * 0.7;
  if (eff.destroyAndOrScrap) v += ctx.bestEnemyBaseValue * 0.4 + 1.2;
  if (eff.acquireFreeMax !== undefined) v += 2.4;
  if (eff.acquireShipFree) v += 2.4;
  if (eff.acquireCheapFree) v += 2.0;
  if (eff.topDeckNextShip || eff.topDeckNextAny) v += 0.7;
  if (eff.nextAcquireToHand) v += 1.1;
  if (eff.drawPerScrap) v += eff.drawPerScrap * W.draw;
  if (eff.discardThenDraw) v += 0.9;
  if (eff.depot) v += 1.2;
  if (eff.recycle) v += 1.2;
  if (eff.scrapOwnMandatory) v -= 0.9 * num(eff.scrapOwnMandatory);
  return v;
}

/** 卡片主要能力里最值钱的一个选项。 */
function bestEffect(ctx, def) {
  if (!def.pc) return def.p;
  let best = null;
  let bestVal = -Infinity;
  for (const eff of def.pc) {
    const val = effectValue(ctx, eff, { future: true });
    if (val > bestVal) {
      bestVal = val;
      best = eff;
    }
  }
  return best || def.pc[0];
}

/** 基地每回合能产出的价值（引擎价值，可持续到游戏结束）。 */
function perTurnValue(ctx, def, includeAlly) {
  let v = 0;
  if (def.pc) {
    for (const eff of def.pc) v = Math.max(v, effectValue(ctx, eff, { future: true }));
  } else {
    v = effectValue(ctx, def.p, { future: true });
  }
  if (def.x && def.x.fleetHQ) v += 2.2; // 每回合多打的飞船都 +1 战斗
  if (def.x && def.x.empireShipBonus) v += def.x.empireShipBonus * 0.9;
  if (includeAlly !== false && def.a) {
    const faction = def.f;
    const triggered = ctx.myAllAlly || (faction && ctx.myFactions.has(faction));
    if (triggered) v += effectValue(ctx, def.a, { future: true }) * 0.8;
  }
  return v;
}

/** 自家前哨墙的防御价值：替我方挡下的伤害 ≈ min(防御值, 对手每回合战斗)。 */
function wallValue(ctx, def, info) {
  const c = info && info.view;
  if (!c || !c.outpost) return 0;
  const defense = num(c.defense, num(def && def.d, 4));
  return Math.min(defense, ctx.oppProduction) * 0.85;
}

/** 摧毁敌方基地的价值：断掉它的产能 + 拆墙后打开的权威通道。 */
function baseKillValue(ctx, uid) {
  const c = ctx.s.cards && ctx.s.cards[uid];
  if (!c) return 0;
  const owner = ctx.players[c.owner];
  if (!owner) return 0;
  const info = ctx.tableOf(uid);
  let denial = 0;
  if (info) denial = perTurnValue(ctx, info.def, true) * ctx.H * 0.45;
  let unlock = 0;
  if (c.outpost) {
    const wall = ctx.wallOf(owner.id);
    const others = wall.count - 1;
    unlock = others <= 0 ? 18 : 3 + num(c.defense, 4) * 0.4;
  } else {
    unlock = 1;
  }
  return denial + unlock;
}

/** 某张牌的价值（用于弃牌/销毁排序）。 */
function cardSalvage(ctx, uid, zone) {
  const info = ctx.tableOf(uid);
  if (!info) return 0.5;
  const def = info.def;
  // 探索者销毁后会回到供应池，但要重新买回仍要 2 贸易，因此按「循环收益 − 重购成本」计
  if (info.id === 'explorer') return Math.max(1.5, 2 * ctx.reuse - 2);
  if (def.t === 'base') {
    const per = perTurnValue(ctx, def, true);
    return per * ctx.H * 0.8 + wallValue(ctx, def, info);
  }
  let v = effectValue(ctx, bestEffect(ctx, def), { future: true });
  if (def.a) v += effectValue(ctx, def.a, { future: true }) * 0.5;
  const factor = zone === 'discard' ? 0.5 : 1;
  return Math.max(0.3, v * 0.8 * factor);
}

/** 我手里/弃牌堆里这张牌在哪个区。 */
function zoneOf(ctx, uid) {
  const me = ctx.me;
  if ((me.hand || []).includes(uid)) return 'hand';
  if ((me.discard || []).includes(uid)) return 'discard';
  if ((me.inPlay || []).includes(uid)) return 'inPlay';
  return 'discard';
}

/** 买下这张牌值多少（已扣掉贸易成本）。 */
function buyWorth(ctx, def, info) {
  const cost = num(def.c);
  if (def.t === 'base') {
    const per = perTurnValue(ctx, def, false);
    let v = per * Math.max(0.6, ctx.H - 2);
    v += wallValue(ctx, def, info);
    if (def.x && def.x.allAlly) v += 1.5 * ctx.myAllyCount;
    if (def.x && def.x.toHandIfFaction && ctx.playedFactions.has(def.x.toHandIfFaction)) v += 1.2;
    return v - cost * W.trade;
  }
  let v = effectValue(ctx, bestEffect(ctx, def), { future: true });
  if (def.a) v += effectValue(ctx, def.a, { future: true }) * 0.6;
  if (def.x && def.x.toHandIfFaction && ctx.playedFactions.has(def.x.toHandIfFaction)) v *= 1.25;
  v *= ctx.reuse;
  return v - cost * W.trade;
}

/* ------------------------------------------------------------------ *
 * 各动作评分
 * ------------------------------------------------------------------ */

function scorePlay(ctx, a) {
  const info = ctx.tableOf(a.cardId);
  if (!info) return 0;
  // 隐匿针舰 / 隐匿尖塔：打出的其实是「被复制那张牌」的能力
  let def = info.def;
  if (a.copy && ctx.s.cards[a.copy]) {
    const copied = CARDS[ctx.s.cards[a.copy].id];
    if (copied) def = copied;
  }
  let v = 0;
  if (def.t === 'ship') {
    const eff = def.pc ? def.pc[num(a.choice, 0)] : def.p;
    v += effectValue(ctx, eff);
    v += ctx.fleetHQBonus * W.combat * ctx.combatFactor;
    if (ctx.empireBonus) {
      const card = ctx.s.cards[a.cardId];
      if (card && (card.factions || []).includes('empire')) {
        v += ctx.empireBonus * W.combat * ctx.combatFactor;
      }
    }
    if (a.row !== undefined) {
      const free = ctx.tableOf(ctx.s.tradeRow && ctx.s.tradeRow[a.row]);
      if (free) v += buyWorth(ctx, free.def, free) * 0.8 + 1;
    }
  } else {
    // 基地 = 长期引擎：主要能力每回合都能重复触发，按剩余回合折算
    const per = perTurnValue(ctx, def, false);
    v += per * ctx.H * 0.85;
    v += wallValue(ctx, def, info);
    if (def.x && def.x.allAlly) v += 1.5 * ctx.myAllyCount;
  }
  return v;
}

function scoreAbility(ctx, a) {
  const info = ctx.tableOf(a.cardId);
  if (!info) return -1;
  const def = info.def;
  const kind = a.ability;

  if (kind === 'primary') {
    if (def.pc) {
      const eff = def.pc[num(a.choice, 0)];
      if (eff && eff.recycle) {
        const targets = a.targets || [];
        const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
        return targets.length * W.draw - lost + 0.2;
      }
      // 常规资源型主要能力：其长期收益已在「打出基地」时按剩余回合计入，
      // 这里只留一个很小的正向项，保证引擎每回合都会被触发而不重复计价。
      return 0.25;
    }
    const p = def.p || {};
    if (p.scrapOwn) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      const draw = p.drawPerScrap ? targets.length * W.draw : 0;
      return draw - lost + 0.2;
    }
    if (p.discardThenDraw) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      return targets.length * W.draw - lost + 0.2;
    }
    if (p.depot) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      const res =
        a.resource === 'combat'
          ? 2 * targets.length * W.combat * ctx.combatFactor
          : 2 * targets.length * W.trade;
      return res - lost + 0.2;
    }
    if (p.scrapOwnMandatory) {
      return num(p.draw) * W.draw - 0.9 + 0.2;
    }
    return 0.25;
  }

  if (kind === 'optional') {
    const opt = def.op;
    if (!opt) return -1;
    if (opt.scrapRow) {
      const rows = a.rows || (a.row !== undefined ? [a.row] : []);
      let v = 0;
      for (const r of rows) {
        const uid = ctx.s.tradeRow && ctx.s.tradeRow[r];
        const info2 = ctx.tableOf(uid);
        v += info2 ? buyWorth(ctx, info2.def, info2) * 0.6 + 0.8 : 1;
      }
      return v;
    }
    if (opt.destroyBase) return baseKillValue(ctx, a.targetId);
    if (opt.scrapOwn) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      const res = effectValue(ctx, opt);
      return res - lost;
    }
    return -1;
  }

  if (kind === 'ally') {
    const eff = def.a;
    if (!eff) return -1;
    if (eff.scrapOwn) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      return effectValue(ctx, eff) - lost + 0.2;
    }
    if (eff.destroyBase) return baseKillValue(ctx, a.targetId);
    if (eff.destroyAndOrScrap) {
      let v = 1.2;
      if (a.targetId) v += baseKillValue(ctx, a.targetId) * 0.8;
      if (a.row !== undefined) v += 1.2;
      return v;
    }
    return effectValue(ctx, eff) + 0.2;
  }

  if (kind === 'scrap') {
    const eff = def.s;
    if (!eff) return -1;
    return effectValue(ctx, eff) - cardSalvage(ctx, a.cardId, 'inPlay');
  }

  return -1;
}

function scoreBuy(ctx, a) {
  if (a.explorer) {
    // 探索者：2 贸易买一张可反复循环的 +2 贸易牌
    const gain = 2 * W.trade * ctx.reuse + 0.8;
    return gain - 2 * W.trade;
  }
  const uid = ctx.s.tradeRow && ctx.s.tradeRow[a.row];
  const info = ctx.tableOf(uid);
  if (!info) return -1;
  return buyWorth(ctx, info.def, info);
}

function scoreAttack(ctx, a) {
  if (a.targetType === 'base') {
    const c = ctx.s.cards && ctx.s.cards[a.targetId];
    if (!c) return -1;
    const needed = num(c.defense, 4) - num(ctx.s.damage && ctx.s.damage[a.targetId]);
    if (a.amount < needed) return -6; // 伤害回合末清零，打不穿就是白费
    return baseKillValue(ctx, a.targetId) + 1;
  }
  const pid = a.targetId;
  const auth = ctx.authorityOf(pid);
  if (a.amount >= auth) {
    if (ctx.mode === 'firstBlood') {
      const winner = ctx.nextAlive(pid, -1);
      return winner === ctx.playerId ? TIER.LETHAL : -40; // 击杀会送给别人则不杀
    }
    if (ctx.mode === 'team2v2') return TIER.LETHAL;
    return ctx.aliveCount === 2 ? TIER.LETHAL : 120;
  }
  let v = a.amount * W.combat;
  if (auth - a.amount <= ctx.potentialCombat) v += 3; // 下一击就能淘汰
  if (pid === ctx.minAuthTarget) v += 0.6;
  return v;
}

function scoreTransfer(ctx, a) {
  if (ctx.mode !== 'team2v2') return -1;
  const mate = ctx.players[a.targetId];
  if (!mate) return -1;
  if (a.resource === 'trade') {
    // 贸易只有当我自己花不掉时才转给队友
    let bestCost = Infinity;
    for (const act of ctx.legalActions) {
      if (act.type !== 'buy') continue;
      if (act.explorer) {
        bestCost = Math.min(bestCost, 2);
        continue;
      }
      const info = ctx.tableOf(ctx.s.tradeRow && ctx.s.tradeRow[act.row]);
      if (info) bestCost = Math.min(bestCost, num(info.def.c));
    }
    const surplus = num(ctx.me.trade) - (bestCost === Infinity ? 0 : bestCost);
    if (surplus < 1) return -1;
    return Math.min(a.amount, surplus) * 0.9;
  }
  // 战斗：打不出去时才给队友（队友的预留会在他下回合开始时到账）
  const hasAttack = ctx.legalActions.some(x => x.type === 'attack');
  if (hasAttack) return -1;
  return a.amount * 0.6;
}

/* ------------------------------------------------------------------ *
 * 待决选择：强制弃牌 / 强制销毁 / 指定弃牌目标 / 事件选择
 * ------------------------------------------------------------------ */

function handlePending(ctx) {
  const acts = ctx.pendingActions;
  if (!acts.length) return null;
  const type = acts[0].type;

  if (type === 'discard' || type === 'selectScrap') {
    let best = null;
    let bestVal = Infinity;
    for (const a of acts) {
      const val = cardSalvage(ctx, a.cardId, zoneOf(ctx, a.cardId));
      if (val < bestVal) {
        bestVal = val;
        best = a;
      }
    }
    return best || acts[0];
  }

  if (type === 'targetDiscard') {
    let best = null;
    let bestVal = -Infinity;
    for (const a of acts) {
      const p = ctx.players[a.targetId];
      if (!p) continue;
      const val = num(p.handCount) * 1.2 + num(p.authority) / 25;
      if (val > bestVal) {
        bestVal = val;
        best = a;
      }
    }
    return best || acts[0];
  }

  if (type === 'eventChoice') return handleEventChoice(ctx, acts);

  return acts[0];
}

function handleEventChoice(ctx, acts) {
  const eventId = acts[0].eventId;

  if (eventId === 'blackHole') {
    // 弃 1 张掉 4 权威，弃 2 张不掉权威
    let best = null;
    let bestCost = Infinity;
    for (const a of acts) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, 'hand'), 0);
      const rawLoss = 4 * (2 - targets.length);
      const authLoss = Math.min(rawLoss, Math.max(0, num(ctx.me.authority) - 1));
      const cost = lost + authLoss;
      if (cost < bestCost) {
        bestCost = cost;
        best = a;
      }
    }
    return best || acts[0];
  }

  if (eventId === 'bombardment') {
    // 摧毁自己一座基地，或者失去 6 权威
    let best = null;
    let bestCost = Infinity;
    for (const a of acts) {
      const cost = a.pay ? 6 * W.authority : cardSalvage(ctx, a.baseId, 'inPlay');
      if (cost < bestCost) {
        bestCost = cost;
        best = a;
      }
    }
    return best || acts[0];
  }

  if (eventId === 'comet') {
    // 销毁自己的牌没有任何好处 → 一张都不销毁
    const empty = acts.find(a => !(a.targets || []).length);
    return empty || acts[0];
  }

  if (eventId === 'warpJump') {
    // 把最不值钱的 2 张放回牌库顶，贵的留在手里
    let best = null;
    let bestVal = Infinity;
    for (const a of acts) {
      const cards = a.cards || [];
      const val = cards.reduce((sum, t) => sum + cardSalvage(ctx, t, 'hand'), 0);
      if (val < bestVal) {
        bestVal = val;
        best = a;
      }
    }
    return best || acts[0];
  }

  return acts[0];
}

/* ------------------------------------------------------------------ *
 * 主入口
 * ------------------------------------------------------------------ */

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  try {
    if (!Array.isArray(legalActions) || legalActions.length === 0) {
      return { type: 'endTurn' };
    }
    const ctx = buildContext(view, legalActions, playerId, context, memory);

    // 待决选择优先（此时 legalActions 里只有待决动作）
    const pending = handlePending(ctx);
    if (pending) return pending;

    let bestAction = null;
    let bestScore = -Infinity;
    for (const action of legalActions) {
      let score = -Infinity;
      switch (action.type) {
        case 'play': {
          const v = scorePlay(ctx, action);
          if (v > 0.2) score = TIER.PLAY + v;
          break;
        }
        case 'ability': {
          const v = scoreAbility(ctx, action);
          if (v >= 0) score = TIER.ABILITY + v;
          break;
        }
        case 'buy': {
          const v = scoreBuy(ctx, action);
          if (v > 0) score = TIER.BUY + v;
          break;
        }
        case 'attack': {
          const v = scoreAttack(ctx, action);
          if (v > 0) score = TIER.ATTACK + v;
          break;
        }
        case 'transfer': {
          const v = scoreTransfer(ctx, action);
          if (v > 0) score = TIER.TRANSFER + v;
          break;
        }
        case 'endTurn':
          score = TIER.END;
          break;
        default:
          score = -1; // 未知动作：最低优先级，但仍原样返回
          break;
      }
      if (score > bestScore) {
        bestScore = score;
        bestAction = action;
      }
    }

    if (!bestAction) {
      const fallback = legalActions.find(a => a.type === 'endTurn') || legalActions[0];
      return fallback;
    }
    return bestAction;
  } catch (error) {
    try {
      return legalActions[0];
    } catch (ignored) {
      return { type: 'endTurn' };
    }
  }
}
