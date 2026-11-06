/**
 * 策略名称：破垒夺权（Breach the Wall, Seize Authority）
 * 选择理由（一句话）：引擎里前哨基地是唯一挡得住权威伤害的护盾——只要对手还占着一座前哨，
 *   他的权威就扣不动、他的普通基地也打不到，所以 1v1 的胜负不在于铺得多快，
 *   而在于谁先用「当回合打光防御值」拆掉对方的前哨打开权威伤害通道，
 *   同时自己立一座前哨让对方无从下嘴，再把每回合必定清零的战斗与贸易全额兑现成权威伤害。
 *
 * 执行模型 ID：minimax-m3.1-flash
 *
 * 零依赖 ESM 模块：只使用引擎注入的 view / legalActions / playerId / random / memory / context。
 * chooseAction 始终返回 legalActions 数组中的某个原始对象引用，不修改 view / legalActions。
 */

/* ══════════════════════════════════════════════════════════════════════════
 * 一、卡牌效果表（抄自 src/engine/cards.js 与 src/engine/expansions.js 的牌面定义）
 *   p  = 主要能力   al = 同盟能力   sc = 销毁能力   opt = 可选能力   pc = 主要能力二选一
 *   资源键：t 贸易 / c 战斗 / a 权威 / d 抽牌 / den 迫使对手弃牌
 *   特殊键：combatIfEnemyBase 对手有基地时额外战斗 / drawIfTwoBases 两座基地时抽牌
 *     drawIfThreeBases 三座基地时抽牌 / authorityIfThreeBases 三座基地时额外权威
 *     drawBlobPlayed 每打出一张虫群牌便抽一张 / scrapOwn 销毁己方牌 / drawPerScrap 每销毁一张抽一张
 *     scrapOwnMandatory 抽牌后强制销毁手牌 / discardThenDraw 弃一张抽一张 / depot 弃牌换资源
 *     recycle 弃牌回收抽牌 / acquireFreeMax 免费获得不高于该费用的牌 / destroyBase 摧毁目标基地
 *     destroyAndOrScrap 摧毁基地并/或拆交易行 / scrapRow 销毁交易行牌 / topDeckNextShip 下一艘飞船置牌库顶
 *     topDeckNextAny 下一张牌置牌库顶 / nextAcquireToHand 下一张获得的牌置入手牌
 *     acquireShipFree 免费获得飞船 / acquireCheapFree 免费获得不高于该费用的牌
 *     combatPerScrapOwn 每销毁一张己方牌换战斗
 *   flags：allAlly 视为所有阵营同盟 / fleetHQ 飞船额外战斗 / empireShipBonus 帝国飞船额外战斗
 *     copyShip 复制飞船 / copyBase 复制基地 / toHandIfFaction 同阵营时入手
 * ══════════════════════════════════════════════════════════════════════════ */
const CARD_DB = {
  // ── 基础盒 ──
  scout: { p: { t: 1 } },
  viper: { p: { c: 1 } },
  explorer: { p: { t: 2 }, sc: { c: 2 } },
  battleBlob: { p: { c: 8 }, al: { d: 1 }, sc: { c: 4 } },
  battlePod: { p: { c: 4 }, al: { c: 2 }, opt: { scrapRow: 1 } },
  blobCarrier: { p: { c: 7 }, al: { acquireShipFree: 1 } },
  blobDestroyer: { p: { c: 6 }, al: { destroyAndOrScrap: 1 } },
  blobFighter: { p: { c: 3 }, al: { d: 1 } },
  blobWheel: { p: { c: 1 }, sc: { t: 3 } },
  blobWorld: { pc: [{ c: 5 }, { drawBlobPlayed: 1 }] },
  mothership: { p: { c: 6, d: 1 }, al: { d: 1 } },
  ram: { p: { c: 5 }, al: { c: 2 }, sc: { t: 3 } },
  theHive: { p: { c: 3 }, al: { d: 1 } },
  tradePod: { p: { t: 3 }, al: { c: 2 } },
  battleMech: { p: { c: 4 }, al: { d: 1 }, opt: { scrapOwn: 1 } },
  battleStation: { sc: { c: 5 } },
  brainWorld: { p: { scrapOwn: 2, drawPerScrap: 1 } },
  junkyard: { p: { scrapOwn: 1 } },
  machineBase: { p: { d: 1, scrapOwnMandatory: 1 } },
  mechWorld: { flags: ['allAlly'] },
  missileBot: { p: { c: 2 }, al: { c: 2 }, opt: { scrapOwn: 1 } },
  missileMech: { p: { c: 6 }, al: { d: 1 }, opt: { destroyBase: 1 } },
  patrolMech: { pc: [{ t: 3 }, { c: 5 }], al: { scrapOwn: 1 } },
  stealthNeedle: { flags: ['copyShip'] },
  supplyBot: { p: { t: 2 }, al: { c: 2 }, opt: { scrapOwn: 1 } },
  tradeBot: { p: { t: 2 }, al: { c: 2 }, opt: { scrapOwn: 1 } },
  battlecruiser: { p: { c: 5, d: 1 }, al: { den: 1 }, sc: { d: 1, destroyBase: 1 } },
  corvette: { p: { c: 1, d: 1 }, al: { c: 2 } },
  dreadnaught: { p: { c: 7, d: 1 }, sc: { c: 5 } },
  fleetHQ: { flags: ['fleetHQ'] },
  imperialFighter: { p: { c: 2, den: 1 }, al: { c: 2 } },
  imperialFrigate: { p: { c: 4, den: 1 }, al: { c: 2 }, sc: { d: 1 } },
  recyclingStation: { pc: [{ t: 1 }, { recycle: 2 }] },
  royalRedoubt: { p: { c: 3 }, al: { den: 1 } },
  spaceStation: { p: { c: 2 }, al: { c: 2 }, sc: { t: 4 } },
  surveyShip: { p: { t: 1, d: 1 }, sc: { den: 1 } },
  warWorld: { p: { c: 3 }, al: { c: 4 } },
  barterWorld: { pc: [{ a: 2 }, { t: 2 }], sc: { c: 5 } },
  centralOffice: { p: { t: 2 }, al: { topDeckNextShip: 1 } },
  commandShip: { p: { a: 4, c: 5, d: 2 }, al: { destroyBase: 1 } },
  cutter: { p: { a: 4, t: 2 }, al: { c: 4 } },
  defenseCenter: { pc: [{ a: 3 }, { c: 2 }], al: { c: 2 } },
  embassyYacht: { p: { a: 3, t: 2, drawIfTwoBases: 2 } },
  federationShuttle: { p: { t: 2 }, al: { a: 4 } },
  flagship: { p: { c: 5, d: 1 }, al: { a: 5 } },
  freighter: { p: { t: 4 }, al: { topDeckNextShip: 1 } },
  portOfCall: { p: { t: 3 }, sc: { d: 1, destroyBase: 1 } },
  tradeEscort: { p: { a: 4, c: 4 }, al: { d: 1 } },
  tradingPost: { pc: [{ a: 1 }, { t: 1 }], sc: { c: 3 } },
  // ── 殖民战争 ──
  battleBot: { p: { c: 2 }, al: { c: 2 }, opt: { scrapOwn: 1 } },
  solarSkiff: { p: { t: 2 }, al: { d: 1 } },
  starBarge: { p: { t: 2 }, al: { c: 2, den: 1 } },
  swarmer: { p: { c: 3 }, al: { c: 2 }, opt: { scrapRow: 1 } },
  lancer: { p: { c: 4, combatIfEnemyBase: 2 }, al: { den: 1 } },
  predator: { p: { c: 4 }, al: { d: 1 } },
  repairBot: { p: { t: 2 }, sc: { c: 2 }, opt: { scrapOwn: 1 } },
  stellarReef: { p: { t: 1 }, sc: { t: 3 } },
  storageSilo: { p: { a: 2 }, al: { t: 2 } },
  tradeHauler: { p: { t: 3 }, al: { a: 3 } },
  warningBeacon: { p: { c: 2 }, flags: ['toHandIfFaction:machine'] },
  cargoPod: { p: { t: 3 }, al: { c: 3 }, sc: { c: 3 } },
  convoyBot: { p: { c: 4 }, al: { c: 2 }, opt: { scrapOwn: 1 } },
  falcon: { p: { c: 2, d: 1 }, sc: { den: 1 } },
  orbitalPlatform: { p: { discardThenDraw: 1 }, al: { c: 3 } },
  patrolCutter: { p: { t: 2, c: 3 }, al: { a: 4 } },
  ravager: { p: { c: 6 }, opt: { scrapRow: 2 } },
  bioformer: { p: { c: 3 }, sc: { t: 3 } },
  centralStation: { p: { t: 2, drawIfThreeBases: 1, authorityIfThreeBases: 4 } },
  commandCenter: { p: { t: 2 }, flags: ['empireShipBonus'] },
  frontierFerry: { p: { t: 3, a: 4 }, sc: { destroyBase: 1 } },
  gunship: { p: { c: 5, den: 1 }, sc: { t: 4 } },
  miningMech: { p: { t: 3 }, al: { c: 3 }, opt: { scrapOwn: 1 } },
  theOracle: { p: { scrapOwn: 1 }, al: { c: 3 } },
  agingBattleship: { p: { c: 5 }, al: { d: 1 }, sc: { c: 2, d: 2 } },
  colonySeedShip: { p: { t: 3, c: 3, a: 3 }, flags: ['toHandIfFaction:federation'] },
  heavyCruiser: { p: { c: 4, d: 1 }, al: { d: 1 } },
  mechCruiser: { p: { c: 6 }, al: { destroyBase: 1 }, opt: { scrapOwn: 1 } },
  parasite: { pc: [{ c: 6 }, { acquireFreeMax: 6 }], al: { d: 1 } },
  stealthTower: { flags: ['copyBase'] },
  federationShipyard: { p: { t: 2 }, al: { topDeckNextAny: 1 } },
  frontierStation: { pc: [{ t: 2 }, { c: 3 }] },
  peacekeeper: { p: { c: 6, a: 6 }, al: { d: 1 } },
  plasmaVent: { p: { c: 4 }, sc: { destroyBase: 1 }, flags: ['toHandIfFaction:blob'] },
  supplyDepot: { p: { depot: 1 }, al: { d: 1 } },
  imperialPalace: { p: { d: 1, den: 1 }, al: { c: 4 } },
  loyalColony: { p: { t: 3, c: 3, a: 3 } },
  moonwurm: { p: { c: 8, d: 1 }, al: { acquireCheapFree: 2 } },
  theWrecker: { p: { c: 6 }, al: { d: 1 }, opt: { scrapOwn: 2 } },
  emperorsDreadnaught: { p: { c: 8, d: 1, den: 1 }, flags: ['toHandIfFaction:empire'] },
  factoryWorld: { p: { t: 3, nextAcquireToHand: 1 } },
  leviathan: { p: { c: 9, d: 1 }, al: { acquireCheapFree: 3 }, opt: { destroyBase: 1 } },
  theIncinerator: { p: { scrapOwn: 2 }, al: { combatPerScrapOwn: 2 } }
};

/* ══════════════════════════════════════════════════════════════════════════
 * 二、估值模型（单位 VP：1 VP ≈ 1 点权威伤害，权威即血线）
 *   战斗 → 权威伤害是唯一的胜负货币：通道打开时 1 战斗 = 1 VP；
 *           通道被前哨堵死时战斗只能用来砸墙，给 0.6 VP。
 *   权威 = 自己的血线，值多少由赛跑差值决定（落后时每点血线都值钱）。
 *   贸易 = 当回合就会清零的货币，只能当回合花：1 贸易 ≈ 1.4 VP。
 *   抽牌 ≈ 2.5 VP，迫使对手弃牌 ≈ 2.6 VP。
 * ══════════════════════════════════════════════════════════════════════════ */
const VP = {
  combatOpen: 1.0,
  combatWalled: 0.6,
  trade: 1.4,
  draw: 2.5,
  deny: 2.6,
  tradeRate: 1.0,       // 1 点贸易换到的 VP（决定买不买）
  baseDiscount: 0.5,     // 基地长线产出的折现
  baseTradeFactor: 0.7,  // 基地每回合贸易的实际转化率
  shipCycles: 1.15,      // 飞船打出后进弃牌堆，不会自动回手，只算少量再利用率
  horizon: 9,            // 剩余有效回合估计
  cycleDelay: 2,         // 买来的牌回到手牌需要的回合数
  gateBonus: 16,         // 拆掉对方最后一座前哨＝打开权威伤害通道
  eliminateBonus: 18,    // 淘汰一名对手
  copyBonus: 3
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/* ══════════════════════════════════════════════════════════════════════════
 * 三、读牌
 * ══════════════════════════════════════════════════════════════════════════ */
function readCard(view, uid) {
  const raw = (view.cards || {})[uid];
  if (!raw) return null;
  // 复制牌：效果来自被复制的牌，但费用与名称仍属原牌
  let src = null;
  if (raw.copiedFrom && (view.cards || {})[raw.copiedFrom]) src = (view.cards || {})[raw.copiedFrom];
  const effectId = src ? src.id : raw.id;
  const db = CARD_DB[effectId] || CARD_DB[raw.id] || null;
  return {
    uid,
    id: raw.id,
    effectId,
    db,
    cost: num(raw.cost),
    type: raw.type,
    outpost: !!raw.outpost,
    defense: num(raw.defense),
    faction: raw.faction,
    factions: Array.isArray(raw.factions) && raw.factions.length
      ? raw.factions
      : (raw.faction && raw.faction !== 'neutral' ? [raw.faction] : []),
    copied: !!raw.copiedFrom
  };
}

/** 一张牌的主要能力列表（可能是二选一）。 */
function primaryOptions(db) {
  if (!db) return [];
  if (db.pc) return db.pc;
  return db.p ? [db.p] : [];
}

function flagsOf(db) {
  return (db && db.flags) || [];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 四、局面上下文
 * ══════════════════════════════════════════════════════════════════════════ */
function buildContext(view, playerId, mode) {
  const players = view.players || [];
  const me = players[playerId] || {};
  const isTeam = mode === 'team2v2';
  const myTeam = isTeam ? me.team : null;

  const alive = players.filter((p) => p && !p.eliminated);
  const opponents = alive.filter((p) => p.id !== playerId && (!isTeam || p.team !== myTeam));
  const teammates = alive.filter((p) => p.id !== playerId && isTeam && p.team === myTeam);

  const cache = new Map();
  const card = (uid) => {
    if (!uid) return null;
    if (cache.has(uid)) return cache.get(uid);
    const c = readCard(view, uid);
    cache.set(uid, c);
    return c;
  };

  const myHand = (me.hand || []).slice();
  const myInPlay = (me.inPlay || []).slice();

  const myBases = [];
  let myOutpostCount = 0;
  for (const uid of myInPlay) {
    const c = card(uid);
    if (!c || c.type !== 'base') continue;
    myBases.push(c);
    if (c.outpost) myOutpostCount++;
  }
  for (const t of teammates) {
    for (const uid of t.inPlay || []) {
      const c = card(uid);
      if (c && c.type === 'base' && c.outpost) { myOutpostCount++; break; }
    }
  }

  const enemyBases = [];
  for (const opp of opponents) {
    for (const uid of opp.inPlay || []) {
      const c = card(uid);
      if (!c || c.type !== 'base') continue;
      c.ownerId = opp.id;
      enemyBases.push(c);
    }
  }

  const ctx = {
    view,
    playerId,
    mode,
    isTeam,
    me,
    players,
    alive,
    opponents,
    teammates,
    card,
    myHand,
    myInPlay,
    myBases,
    myOutpostCount,
    enemyBases
  };

  const teamOf = (pid) => (players.find((p) => p.id === pid) || {}).team;

  /** 目标信息：血线、手牌数、是否被前哨挡住（决定我能否扣他的权威）。 */
  ctx.targetInfo = (targetId) => {
    const target = players[targetId];
    const team = (view.teams || []).find((t) => (t.players || []).includes(targetId));
    const hp = isTeam && team ? num(team.authority) : num(target && target.authority);
    const walled = enemyBases.some((c) => c.outpost && (isTeam
      ? teamOf(c.ownerId) === (target || {}).team
      : c.ownerId === targetId));
    return {
      id: targetId,
      player: target,
      team,
      hp: Math.max(1, hp),
      walled,
      handCount: num(target && target.handCount)
    };
  };

  ctx.primaryTarget = opponents[0] ? ctx.targetInfo(opponents[0].id) : null;
  ctx.anyChannelOpen = opponents.some((o) => !ctx.targetInfo(o.id).walled);
  ctx.combatVP = ctx.anyChannelOpen ? VP.combatOpen : VP.combatWalled;

  // 对手每回合大概能打出多少战斗（用于前哨与权威的估值）
  let theirRate = 0;
  for (const c of enemyBases) theirRate += perTurnCombat(c.db);
  for (const o of opponents) theirRate += num(o.handCount) * 0.6;
  ctx.theirRate = theirRate;

  let myRate = 0;
  for (const c of myBases) myRate += perTurnCombat(c.db);
  myRate += num(me.handCount) * 0.6;
  ctx.myRate = Math.max(0.5, myRate);

  // 权威（血线）的价值：赛跑领先时多余血线没意义，落后时每点血线都值钱
  const myHP = Math.max(1, num(me.authority));
  const theirHP = ctx.primaryTarget ? ctx.primaryTarget.hp : 50;
  const tWin = theirHP / ctx.myRate;
  const tLose = myHP / Math.max(0.5, theirRate);
  ctx.margin = tWin - tLose;
  ctx.authorityVP = clamp(0.35 + 0.95 / (1 + Math.exp(ctx.margin / 1.5)), 0.3, 1.35);

  ctx.marketCard = (row) => {
    const uid = (view.tradeRow || [])[row];
    return uid ? card(uid) : null;
  };

  // 我本回合打出过哪些阵营（用于 toHandIfFaction 的即时入手）
  ctx.playedFactions = new Set();
  for (const uid of me.playedThisTurn || []) {
    const c = card(uid);
    if (!c) continue;
    for (const f of c.factions) ctx.playedFactions.add(f);
  }

  // 买入的牌会不会立刻到手
  ctx.landsInHand = (c) => {
    if (!c) return false;
    if (me.nextAcquireToHand) return true;
    const flag = flagsOf(c.db).find((f) => f.startsWith('toHandIfFaction:'));
    if (!flag) return false;
    return ctx.playedFactions.has(flag.split(':')[1]);
  };

  // 同盟能力此刻是否可能已经触发
  ctx.allyReady = (c) => {
    if (!c || !c.db || !c.db.al) return 0;
    for (const uid of myInPlay) {
      const o = card(uid);
      if (o && flagsOf(o.db).includes('allAlly')) return 1;
    }
    for (const uid of myInPlay) {
      if (uid === c.uid) continue;
      const o = card(uid);
      if (o && o.factions.some((f) => c.factions.includes(f))) return 1;
    }
    return 0.35;
  };

  ctx.myAllyCount = myInPlay.filter((u) => {
    const o = card(u);
    return o && o.db && o.db.al;
  }).length;

  // 本回合还能凑出的战斗（用于判断拆基地能否补刀）
  let reach = 0;
  for (const uid of myHand) {
    const c = card(uid);
    if (!c || !c.db) continue;
    for (const eff of primaryOptions(c.db)) reach += num(eff.c);
  }
  for (const c of myBases) {
    for (const eff of primaryOptions(c.db)) reach += num(eff.c);
  }
  ctx.reachCombat = reach;

  // 焚化炉：销毁己方牌换战斗
  let inc = 0;
  for (const uid of myInPlay) {
    const c = card(uid);
    if (c && c.db && c.db.al && c.db.al.combatPerScrapOwn) inc += c.db.al.combatPerScrapOwn;
  }
  ctx.incineratorBonus = inc * ctx.combatVP;

  return ctx;
}

/** 牌面「每回合战斗产出」的粗估。 */
function perTurnCombat(db) {
  if (!db) return 0;
  let best = 0;
  for (const eff of primaryOptions(db)) best = Math.max(best, num(eff.c));
  if (db.al) best += num(db.al.c) * 0.5;
  return best;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 五、效果估值
 * ══════════════════════════════════════════════════════════════════════════ */
function effectVP(ctx, eff, target) {
  if (!eff) return 0;
  let v = 0;
  if (eff.t) v += eff.t * VP.trade;
  if (eff.c) v += eff.c * ctx.combatVP;
  if (eff.a) v += eff.a * ctx.authorityVP;
  if (eff.d) v += eff.d * VP.draw;
  if (eff.den) v += eff.den * VP.deny;
  if (eff.combatIfEnemyBase && ctx.enemyBases.length > 0) v += eff.combatIfEnemyBase * ctx.combatVP;
  if (eff.drawIfTwoBases && ctx.myBases.length >= 2) v += eff.drawIfTwoBases * VP.draw;
  if (eff.drawIfThreeBases && ctx.myBases.length >= 3) {
    v += eff.drawIfThreeBases * VP.draw;
    if (eff.authorityIfThreeBases) v += eff.authorityIfThreeBases * ctx.authorityVP;
  }
  if (eff.drawBlobPlayed) {
    let blobs = 0;
    for (const uid of ctx.me.playedThisTurn || []) {
      const c = ctx.card(uid);
      if (c && c.faction === 'blob') blobs++;
    }
    v += blobs * VP.draw;
  }
  if (eff.topDeckNextShip) v += 1.8;
  if (eff.topDeckNextAny) v += 1.8;
  if (eff.nextAcquireToHand) v += 2.4;
  if (eff.combatPerScrapOwn) {
    v += eff.combatPerScrapOwn * num(ctx.me.scrappedThisTurn) * ctx.combatVP;
  }
  if (eff.destroyBase && target && target.targetId) v += killBaseVP(ctx, target.targetId);
  if (eff.destroyAndOrScrap && target) {
    if (target.targetId) v += killBaseVP(ctx, target.targetId);
    if (target.row !== undefined) v += 0.3;
  }
  if (eff.scrapRow && target) {
    const rows = target.rows || (target.row !== undefined ? [target.row] : []);
    for (const row of rows) v += rerollRowVP(ctx, row);
  }
  if (eff.acquireShipFree && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) v += cardVP(ctx, c, 'acquire');
  }
  if (eff.acquireCheapFree && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) v += cardVP(ctx, c, 'acquire');
  }
  if (eff.acquireFreeMax && target) {
    // 没有指定行就什么都拿不到
    if (target.row !== undefined) {
      const c = ctx.marketCard(target.row);
      if (c) v += cardVP(ctx, c, 'acquire');
    }
  }
  if (eff.scrapOwn && target) {
    const targets = target.targets || [];
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? sacrificeVP(ctx, c) : 2;
    }
    if (eff.drawPerScrap) v += targets.length * VP.draw;
  }
  if (eff.scrapOwnMandatory) {
    let cheapest = Infinity;
    for (const uid of ctx.myHand) {
      const c = ctx.card(uid);
      if (c) cheapest = Math.min(cheapest, sacrificeVP(ctx, c));
    }
    v -= isFinite(cheapest) ? cheapest : 1.5;
  }
  if (eff.discardThenDraw && target) {
    const targets = target.targets || [];
    v += targets.length * VP.draw;
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? discardVP(ctx, c) : 1;
    }
  }
  if (eff.depot && target) {
    const targets = target.targets || [];
    const unit = target.resource === 'combat' ? ctx.combatVP : VP.trade;
    v += targets.length * 2 * unit;
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? discardVP(ctx, c) : 1;
    }
  }
  if (eff.recycle && target) {
    const targets = target.targets || [];
    v += targets.length * VP.draw;
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? discardVP(ctx, c) : 1;
    }
  }
  return v;
}

/** 永久销毁一张牌的代价（进废牌堆，不可回收）。 */
function sacrificeVP(ctx, card) {
  if (!card) return 1;
  if (card.type === 'base') {
    return perTurnCombat(card.db) * VP.horizon * VP.baseDiscount + outpostVP(ctx, card);
  }
  return cardVP(ctx, card, 'play') * 0.75;
}

/** 弃进弃牌堆（可回收）的代价：只损失本回合的节奏。 */
function discardVP(ctx, card) {
  if (!card) return 1;
  return Math.max(0.4, perTurnCombat(card.db) * 0.6);
}

/** 前哨作为护盾的价值：挡住对手的权威伤害，并迫使对手只能砸我的前哨。 */
function outpostVP(ctx, card) {
  if (!card || !card.outpost) return 0;
  const base = 4 + 1.6 * card.defense + 2.2 * ctx.theirRate;
  return ctx.myOutpostCount > 0 ? base * 0.2 : base;
}

/** 拆掉敌方基地的价值：断他的长线产出 + 视情况打开权威伤害通道。 */
function killBaseVP(ctx, uid) {
  const card = ctx.card(uid);
  if (!card) return 0;
  const info = ctx.targetInfo(card.ownerId);
  // 他被前哨护着时，打他的普通基地威胁不到我的血线
  const threat = info.walled ? 0.35 : 1;
  let v = perTurnCombat(card.db) * VP.horizon * VP.baseDiscount * threat;
  if (card.outpost) {
    // 前哨护盾是按「护盾归属组」计算的：2V2 里整队共享一座护盾，
    // 所以只有清空敌队全部前哨才真的打开权威伤害通道。
    const remaining = ctx.enemyBases.filter((c) => c.outpost && sameShield(ctx, c, card)).length;
    if (remaining <= 1) {
      // 最后一座前哨：权威伤害通道打开，这是全场最大的一次翻盘点
      v += VP.gateBonus * (ctx.isTeam ? 2 : 1) + info.hp * 0.3;
    } else {
      // 还有别的前哨挡着，但每拆一座都在推进「破垒」：按剩余数量折算进度
      v += ctx.isTeam ? (VP.gateBonus * 2) / remaining : 5;
    }
  }
  return v;
}

/**
 * 两张基地是否属于同一个「护盾归属组」。
 * 引擎的 teamHasOutpost 在 2V2 里按整队判定，其他模式按单个玩家判定。
 */
function sameShield(ctx, a, b) {
  if (!ctx.isTeam) return a.ownerId === b.ownerId;
  return ctx.players[a.ownerId] && ctx.players[b.ownerId]
    && ctx.players[a.ownerId].team === ctx.players[b.ownerId].team;
}

/** 拆交易行某位＝重掷该位置的牌（交易行是双方共用的）。 */
function rerollRowVP(ctx, row) {
  const card = ctx.marketCard(row);
  if (!card) return 0;
  const current = cardVP(ctx, card, 'buy');
  let total = 0;
  let n = 0;
  for (let r = 0; r < 5; r++) {
    const c = ctx.marketCard(r);
    if (!c) continue;
    total += cardVP(ctx, c, 'buy');
    n++;
  }
  const expected = n ? total / n : current;
  return clamp(expected - current, -3, 3);
}

/** 一张牌每回合能带来的产出（基地的主要与同盟能力每回合都可再发动一次）。 */
function perTurnValue(ctx, card) {
  if (!card || !card.db) return 0;
  const db = card.db;
  let best = 0;
  for (const eff of primaryOptions(db)) {
    let v = 0;
    if (eff.t) v += eff.t * VP.trade * VP.baseTradeFactor;
    if (eff.c) v += eff.c * ctx.combatVP;
    if (eff.a) v += eff.a * ctx.authorityVP * 0.7;
    if (eff.d) v += eff.d * VP.draw * 0.6;
    if (eff.combatIfEnemyBase && ctx.enemyBases.length > 0) v += eff.combatIfEnemyBase * ctx.combatVP;
    if (eff.drawIfTwoBases && ctx.myBases.length >= 2) v += eff.drawIfTwoBases * VP.draw * 0.6;
    if (eff.drawIfThreeBases && ctx.myBases.length >= 3) v += eff.drawIfThreeBases * VP.draw * 0.6;
    if (eff.authorityIfThreeBases && ctx.myBases.length >= 3) v += eff.authorityIfThreeBases * ctx.authorityVP * 0.7;
    if (eff.den) v += eff.den * VP.deny * 0.5;
    if (eff.acquireShipFree) v += 2.5;
    if (eff.acquireCheapFree) v += 2.0;
    if (eff.destroyBase) v += 2.5;
    if (eff.destroyAndOrScrap) v += 2.0;
    if (eff.topDeckNextShip) v += 0.9;
    if (eff.topDeckNextAny) v += 0.9;
    if (eff.nextAcquireToHand) v += 1.2;
    if (v > best) best = v;
  }
  if (db.al) best += perTurnCombat(db) * 0 + allyPerTurn(ctx, card);
  return best;
}

/** 同盟能力的每回合产出估值。 */
function allyPerTurn(ctx, card) {
  const al = card && card.db && card.db.al;
  if (!al) return 0;
  let v = 0;
  if (al.t) v += al.t * VP.trade * VP.baseTradeFactor;
  if (al.c) v += al.c * ctx.combatVP;
  if (al.a) v += al.a * ctx.authorityVP * 0.7;
  if (al.d) v += al.d * VP.draw * 0.6;
  if (al.den) v += al.den * VP.deny * 0.5;
  if (al.acquireShipFree) v += 2.5;
  if (al.acquireCheapFree) v += 2.0;
  if (al.destroyBase) v += 2.5;
  if (al.destroyAndOrScrap) v += 2.0;
  if (al.topDeckNextShip) v += 0.9;
  if (al.topDeckNextAny) v += 0.9;
  return v * ctx.allyReady(card);
}

/**
 * 一张牌的整体价值。
 *   'play'    手里立刻能打出
 *   'buy'     买下来，约 VP.cycleDelay 回合后回到手牌
 *   'acquire' 免费获得（不花钱）
 */
function cardVP(ctx, card, mode) {
  if (!card || !card.db) return 1;
  const db = card.db;

  if (mode === 'buy') {
    const horizon = Math.max(0, VP.horizon - VP.cycleDelay);
    let v;
    if (card.type === 'base') {
      v = perTurnValue(ctx, card) * horizon * VP.baseDiscount + outpostVP(ctx, card) * 0.7;
    } else {
      let instant = 0;
      for (const eff of primaryOptions(db)) instant = Math.max(instant, effectVP(ctx, eff, null));
      if (db.al) instant += effectVP(ctx, db.al, null) * ctx.allyReady(card);
      v = instant * VP.shipCycles * 0.8;
      if (db.sc) v += effectVP(ctx, db.sc, null) * 0.5;
    }
    if (ctx.landsInHand(card)) v += perTurnValue(ctx, card) * 0.8 + 2; // 立刻入手＝本回合就能用
    return v - card.cost * VP.tradeRate;
  }

  if (mode === 'acquire') {
    if (card.type === 'base') {
      return perTurnValue(ctx, card) * VP.horizon * VP.baseDiscount * 0.8 + outpostVP(ctx, card) * 0.7;
    }
    let instant = 0;
    for (const eff of primaryOptions(db)) instant = Math.max(instant, effectVP(ctx, eff, null));
    return instant * VP.shipCycles * 0.7;
  }

  // 手里立刻打出
  if (card.type === 'base') {
    let v = perTurnValue(ctx, card) * VP.horizon * VP.baseDiscount + outpostVP(ctx, card);
    const fl = flagsOf(db);
    if (fl.includes('allAlly')) v += 4 + ctx.myAllyCount * 1.2;
    if (fl.includes('fleetHQ')) v += 3;
    if (fl.includes('empireShipBonus')) v += 3;
    if (fl.includes('copyBase')) v += VP.copyBonus + 2;
    return v;
  }
  let v = 0;
  for (const eff of primaryOptions(db)) v = Math.max(v, effectVP(ctx, eff, null));
  if (db.al) v += effectVP(ctx, db.al, null) * ctx.allyReady(card);
  if (db.sc) v += effectVP(ctx, db.sc, null) * 0.55;
  if (flagsOf(db).includes('copyShip')) v += VP.copyBonus;
  return v;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 六、动作评分
 * ══════════════════════════════════════════════════════════════════════════ */

/** 攻击玩家：1 点伤害 = 1 VP；致命一击额外奖励。 */
function scoreAttackPlayer(ctx, action) {
  const info = ctx.targetInfo(action.targetId);
  const amount = num(action.amount);
  let v = amount;
  if (amount >= info.hp) {
    if (ctx.mode === 'standard' || ctx.mode === 'team2v2') {
      v += 1000; // 直接获胜 / 对方整队权威归零
    } else if (ctx.mode === 'firstBlood') {
      // 先血：首位败北者的左手邻居直接获胜。
      // 我就是那个左手邻居 → 我赢；否则这一刀直接送对手赢，必须重罚。
      v += killsLeftNeighbor(ctx, action.targetId) ? 1000 : -1000;
    } else {
      v += VP.eliminateBonus;
    }
  } else {
    // 先血：集火我正在追杀的猎物
    if (ctx.mode === 'firstBlood' && killsLeftNeighbor(ctx, action.targetId)) v += 1.5;
    // 自由混战：优先补刀血线最低的对手
    if (ctx.mode === 'ffa') {
      let lowest = Infinity;
      for (const o of ctx.opponents) lowest = Math.min(lowest, ctx.targetInfo(o.id).hp);
      if (info.hp <= lowest) v += 1.2;
    }
  }
  return v;
}

/**
 * 引擎：玩家 X 被淘汰时，他左手边的存活玩家获胜（nextAlive(X, -1)）。
 * 先血模式下这意味着「杀掉我的左手邻座」＝我直接获胜。
 */
function killsLeftNeighbor(ctx, targetId) {
  const order = ctx.alive.map((p) => p.id);
  const idx = order.indexOf(targetId);
  if (idx < 0) return false;
  return order[(idx - 1 + order.length) % order.length] === ctx.playerId;
}

/**
 * 攻击基地：伤害在回合末清零，必须当回合打死，否则白打。
 * 引擎给出的 amount 恒为 min(还需要的防御值, 我的战斗)，所以能否一击致命
 * 完全由 amount 是否达到还需要的防御值决定。
 */
function scoreAttackBase(ctx, action) {
  const card = ctx.card(action.targetId);
  if (!card) return 0;
  const dealt = num((ctx.view.damage || {})[action.targetId]);
  const needed = Math.max(1, card.defense - dealt);
  const amount = num(action.amount);
  const kill = killBaseVP(ctx, action.targetId);
  if (amount >= needed) return kill;
  // 只打了一半：本回合还有余力补刀才值得
  if (ctx.reachCombat >= needed - amount) return kill * 0.7;
  return 0.05;
}

/** 打出卡牌。 */
function scorePlay(ctx, action) {
  const card = ctx.card(action.cardId);
  if (!card) return 0;
  const db = card.db;
  if (!db) return 1;

  // 复制牌：效果来自被复制的牌，但只在本回合有效
  if (action.copy) {
    const src = ctx.card(action.copy);
    if (!src || !src.db) return 0;
    const opts = primaryOptions(src.db);
    const eff = opts.length ? opts[num(action.choice) || 0] : null;
    let v = eff ? effectVP(ctx, eff, action) : 0;
    if (src.db.al) v += effectVP(ctx, src.db.al, null) * ctx.allyReady(src);
    if (src.type === 'base') v *= 0.6;
    return v;
  }

  const opts = primaryOptions(db);
  if (!opts.length) {
    // 没有主要能力的牌（例如只有可选/销毁能力的基地）价值在留存
    return card.type === 'base'
      ? perTurnValue(ctx, card) * VP.horizon * VP.baseDiscount * 0.5 + outpostVP(ctx, card)
      : 1;
  }
  const chosen = opts[num(action.choice) || 0] || opts[0];
  let v = effectVP(ctx, chosen, action);

  if (card.type === 'ship') {
    // 舰队总部 / 指挥中心 让本回合打出的飞船额外产出战斗
    for (const uid of ctx.myInPlay) {
      const o = ctx.card(uid);
      if (!o || !o.db) continue;
      const fl = flagsOf(o.db);
      if (fl.includes('fleetHQ')) v += 1 * ctx.combatVP;
      if (fl.includes('empireShipBonus') && card.factions.includes('empire')) v += 2 * ctx.combatVP;
    }
    // 飞船会回到牌堆反复使用
    v *= VP.shipCycles * 0.85;
    if (db.sc) v += effectVP(ctx, db.sc, null) * 0.55;
    if (flagsOf(db).includes('copyShip')) v += VP.copyBonus;
  } else {
    // 基地的主要能力每回合都能再发动一次
    v += perTurnValue(ctx, card) * VP.horizon * VP.baseDiscount;
    v += outpostVP(ctx, card);
    const fl = flagsOf(db);
    if (fl.includes('allAlly')) v += 4 + ctx.myAllyCount * 1.2;
    if (fl.includes('fleetHQ')) v += 3;
    if (fl.includes('empireShipBonus')) v += 3;
    if (fl.includes('copyBase')) v += VP.copyBonus + 2;
  }
  return v;
}

/** 发动能力（主要 / 同盟 / 可选 / 销毁）。 */
function scoreAbility(ctx, action) {
  const card = ctx.card(action.cardId);
  if (!card || !card.db) return 0;
  const db = card.db;
  const kind = action.ability;
  let eff = null;
  if (kind === 'primary') eff = db.pc ? (db.pc[num(action.choice)] || db.pc[0]) : db.p;
  else if (kind === 'ally') eff = db.al;
  else if (kind === 'scrap') eff = db.sc;
  else if (kind === 'optional') eff = db.opt;
  if (!eff) return 0;

  let v = effectVP(ctx, eff, action);

  if (kind === 'scrap') {
    // 销毁自己的牌＝永久失去这张牌
    v -= sacrificeVP(ctx, card);
  }
  if (kind === 'optional' && db.opt && db.opt.scrapOwn) {
    // 可选拆自己的牌：只有喂焚化炉时才划算
    v -= 1;
    v += ctx.incineratorBonus * (action.targets || []).length;
  }
  if (kind === 'primary' && db.p && db.p.scrapOwn && !db.pc) {
    // 主要能力本身就是拆自己的牌（如废料场／神谕机）：纯亏
    v -= 1.5;
  }
  return v;
}

/** 购买。 */
function scoreBuy(ctx, action) {
  if (action.explorer) {
    // 2 贸易换一张探索者：净 +2 贸易，可销毁换 2 战斗
    return 2.6;
  }
  const card = ctx.marketCard(action.row);
  if (!card) return 0;
  return cardVP(ctx, card, 'buy');
}

/** 队友资源预留：我的战斗回合末会清零，预留过去等于替队友存下。 */
function scoreTransfer(ctx, action) {
  const mate = ctx.players[action.targetId];
  if (!mate) return 0;
  const amount = num(action.amount);
  if (amount <= 0) return 0;
  const reserve = mate.reserve || { trade: 0, combat: 0 };

  if (action.resource === 'trade') {
    // 队友手上已经宽裕就别留了
    const need = clamp(3 - (num(mate.trade) + num(reserve.trade)), 0, amount);
    if (!need) return 0;
    // 队友得有牌可买，否则贸易留过去也是空转
    const canSpend = (ctx.view.tradeRow || []).some((uid) => {
      const c = uid ? ctx.card(uid) : null;
      return c && num(c.cost) > 0 && num(c.cost) <= num(mate.trade) + need;
    });
    if (!canSpend) return 0;
    return need * VP.trade * 0.6;
  }

  // 战斗：队友能直接把它兑现成权威伤害时才值得留
  const need = clamp(3 - (num(mate.combat) + num(reserve.combat)), 0, amount);
  if (!need) return 0;
  const mateCanHit = ctx.opponents.some((o) => !ctx.targetInfo(o.id).walled);
  if (!mateCanHit) return 0; // 通道堵着，战斗给队友也变不成伤害
  return need * ctx.combatVP * 0.8;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 七、待决选择（事件 / 强制弃牌 / 强制销毁）
 * ══════════════════════════════════════════════════════════════════════════ */
function scorePending(ctx, action) {
  const pending = ctx.view.pending || {};
  if (action.type === 'discard') {
    // 强制弃牌：弃掉最没用的
    const card = ctx.card(action.cardId);
    return -(card ? discardVP(ctx, card) : 1);
  }
  if (action.type === 'selectScrap') {
    // 强制销毁：挑最不值钱的
    const card = ctx.card(action.cardId);
    return -(card ? sacrificeVP(ctx, card) : 1);
  }
  if (action.type === 'targetDiscard') {
    // 指定谁弃牌：挑手牌最多的
    const target = ctx.players[action.targetId];
    if (!target) return 0;
    return num(target.handCount) * 1.4;
  }
  if (action.type === 'eventChoice') return scoreEventChoice(ctx, pending, action);
  return 0;
}

function scoreEventChoice(ctx, pending, action) {
  const kind = pending.kind;
  if (kind === 'blackHole') {
    // 每少弃一张掉 4 权威；弃进弃牌堆可回收，代价很小
    const targets = action.targets || [];
    const loss = Math.min(4 * (2 - targets.length), Math.max(0, num(ctx.me.authority) - 1));
    let cost = 0;
    for (const uid of targets) {
      const c = ctx.card(uid);
      cost += c ? discardVP(ctx, c) : 1;
    }
    return -loss * ctx.authorityVP - cost + targets.length * 0.6;
  }
  if (kind === 'bombardment') {
    if (action.pay) {
      // 付 6 权威（不会低于 1）
      const loss = Math.min(6, Math.max(0, num(ctx.me.authority) - 1));
      return -loss * ctx.authorityVP;
    }
    // 摧毁自己一座基地：牌进弃牌堆可回收，但产出这回合没了
    const card = ctx.card(action.baseId);
    if (!card) return -6 * ctx.authorityVP;
    const loss = perTurnValue(ctx, card) * 2.5 + (card.outpost ? outpostVP(ctx, card) * 0.5 : 0);
    return -loss;
  }
  if (kind === 'comet') {
    // 销毁自己 0-2 张牌：默认一张都不销毁，除非能喂焚化炉
    const targets = action.targets || [];
    if (!targets.length) return 0.3;
    let cost = 0;
    for (const uid of targets) {
      const c = ctx.card(uid);
      cost += c ? sacrificeVP(ctx, c) : 1;
    }
    return -cost + ctx.incineratorBonus * targets.length;
  }
  if (kind === 'warpJump') {
    // 抽 3 张，把 2 张放回牌库顶；留下的那张应当最有价值
    const back = action.cards || [];
    const drawn = pending.drawn || [];
    let kept = null;
    for (const uid of drawn) {
      if (!back.includes(uid)) { kept = ctx.card(uid); break; }
    }
    let v = kept ? cardVP(ctx, kept, 'play') : 0;
    if (back.length === 2) {
      const a = ctx.card(back[0]);
      const b = ctx.card(back[1]);
      if (a && b) {
        const va = cardVP(ctx, a, 'play');
        const vb = cardVP(ctx, b, 'play');
        // unshift 顺序：cards[0] 最先被抽到
        v += Math.max(va, vb) * 0.35 + Math.min(va, vb) * 0.2;
      }
    }
    return v;
  }
  return 0;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 八、主入口
 * ══════════════════════════════════════════════════════════════════════════ */

export const meta = {
  name: 'MiniMax M3.1flash · 破垒夺权',
  description:
    'minimax-m3.1-flash 独立设计的 1v1 策略「破垒夺权」：前哨基地是引擎里唯一挡得住权威伤害的护盾，' +
    '所以先立前哨护住自己、再用当回合打光防御值的方式拆掉对方前哨打开权威伤害通道，' +
    '再把每回合必定清零的战斗与贸易全额兑现成权威伤害。'
};

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  try {
    if (!view || !Array.isArray(legalActions) || legalActions.length === 0) return null;
    const mode = (context && context.mode) || view.mode || 'standard';
    const ctx = buildContext(view, playerId, mode);

    let best = null;
    let bestScore = -Infinity;
    const ties = [];

    for (const action of legalActions) {
      if (!action || typeof action.type !== 'string') continue;
      let score;
      if (ctx.view.pending) {
        score = scorePending(ctx, action);
      } else {
        switch (action.type) {
          case 'play': score = scorePlay(ctx, action); break;
          case 'ability': score = scoreAbility(ctx, action); break;
          case 'buy': score = scoreBuy(ctx, action); break;
          case 'attack':
            score = action.targetType === 'base'
              ? scoreAttackBase(ctx, action)
              : scoreAttackPlayer(ctx, action);
            break;
          case 'transfer': score = scoreTransfer(ctx, action); break;
          case 'endTurn': score = 0; break;
          default: score = 0; break; // 未知动作：安全兜底
        }
      }
      if (score > bestScore + 1e-9) {
        bestScore = score;
        best = action;
        ties.length = 0;
        ties.push(action);
      } else if (Math.abs(score - bestScore) <= 1e-9) {
        ties.push(action);
      }
    }

    if (!best) {
      const end = legalActions.find((a) => a && a.type === 'endTurn');
      return end || legalActions[0];
    }
    // 没有「有意义的行动」时才结束回合，别白白丢掉本回合的战斗与贸易
    if (!ctx.view.pending && bestScore <= 0.05) {
      const end = legalActions.find((a) => a && a.type === 'endTurn');
      if (end) return end;
    }
    if (ties.length > 1 && typeof random === 'function') {
      const idx = Math.floor(random() * ties.length) % ties.length;
      return ties[idx];
    }
    return best;
  } catch (err) {
    // 任何异常都必须返回一个合法动作
    try {
      const list = Array.isArray(legalActions) ? legalActions : [];
      const end = list.find((a) => a && a.type === 'endTurn');
      return end || list[0] || null;
    } catch (_) {
      return null;
    }
  }
}
