// 策略名称：雪球收割（Snowball-Reap）
// 选择理由：1v1 的胜负手是「经济差 × 战斗转化效率」——早期用高性价比贸易牌把雪球滚大，中期用高战斗效率牌把雪球兑换成权威伤害，同时用权威牌守住生命线；全部决策由统一的「等效权威分」驱动，稳快兼顾。
// 本轮更新：按 PROGRAM-UPDATES 第 1–6 条适配 2026-11-08 规则内核——新增 hydra3 / emperor 两模式与 moveCard 动作，按「整队轮流 / 队末清算」修正基地伤害与资源预留估值，支持 double:true 双同盟与 choice/row/rows/targets/targetId 等新动作字段，六牌包未知卡一律用 text 解析兜底。
//
// 零依赖：不使用 import / require。
// 估值口径：view.cards[uid] 只暴露 name/cost/type/faction/defense/outpost/factions/text/set，
// 因此本文件内置两份互补的估值来源——
//   ① FX：依据 engine/cards.js / expansions.js / expansions-extra.js 整理的效果表（六牌包全覆盖，仅用于评分）；
//   ② textFx：从卡面 text 解析出的等价效果（未知卡 / 合成卡的唯一依据，也是已知卡的小额加成）。
// 任何未知卡、未知动作都走兜底分支，不抛异常、不死循环。

const KNOWN_ACTION_TYPES = new Set([
  'play', 'ability', 'buy', 'attack', 'transfer', 'moveCard',
  'discard', 'selectScrap', 'targetDiscard', 'eventChoice', 'endTurn'
]);

// ---- 评分权重（统一「等效权威分」）----
const SC = {
  trade: 0.9, combat: 0.85, authority: 1.0, draw: 2.0,
  discardOpp: 1.2, topDeck: 0.8, toHand: 0.9, recycle: 0.9,
  discardThenDraw: 0.9, depot: 1.8, acquireFree: 3.2,
  scrapRow: 0.7, scrapOwn: 0.35, drawPerScrap: 1.7,
  destroyBase: 2.2, destroyAndScrap: 2.4,
  allyFactor: 0.9, scrapFactor: 0.6, optionalFactor: 0.5,
  outpost: 1.5, fleetHQ: 3.0, empireShipBonus: 2.0, allAlly: 1.0, copyCard: 3.5,
  baseFactor: 1.8, basePlayFactor: 0.85, copyBonus: 0.8, factionSynergy: 0.8,
  freeAcquireBonus: 1.5, allyPotential: 0.5,
  handLoss: 0.8, discardLoss: 0.25,
  scrapRowBig: 2.2, scrapRowSmall: 0.8, scrapOwnTiny: 0.3,
  selfScrapLoss: 0.7, scrapUrgentBonus: 3.0,
  explorerScore: 3.2,
  outpostBreak: 4.5, outpostUnlock: 2.5, nonOutpostAttack: 0.6,
  lethal: 1000, bigKill: 40,
  actThreshold: 0.5, playFloor: 0.55,
};

// ---- 卡牌效果表（依据 engine/cards.js / expansions.js / expansions-extra.js 整理，仅用于评分）----
const FX = {
  scout: { primary: { trade: 1 } },
  viper: { primary: { combat: 1 } },
  explorer: { primary: { trade: 2 }, scrap: { combat: 2 } },

  battleBlob: { primary: { combat: 8 }, ally: { draw: 1 }, scrap: { combat: 4 } },
  battlePod: { primary: { combat: 4 }, optionalPrimary: { scrapRow: 1 }, ally: { combat: 2 } },
  blobCarrier: { primary: { combat: 7 }, ally: { acquireShipFree: true } },
  blobDestroyer: { primary: { combat: 6 }, ally: { destroyAndOrScrap: true } },
  blobFighter: { primary: { combat: 3 }, ally: { draw: 1 } },
  blobWheel: { primary: { combat: 1 }, scrap: { trade: 3 } },
  blobWorld: { primaryChoice: [{ combat: 5 }, { drawBlobPlayed: true }] },
  mothership: { primary: { combat: 6, draw: 1 }, ally: { draw: 1 } },
  ram: { primary: { combat: 5 }, ally: { combat: 2 }, scrap: { trade: 3 } },
  theHive: { primary: { combat: 3 }, ally: { draw: 1 } },
  tradePod: { primary: { trade: 3 }, ally: { combat: 2 } },

  battleMech: { primary: { combat: 4 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { draw: 1 } },
  battleStation: { outpost: true, scrap: { combat: 5 } },
  brainWorld: { outpost: true, primary: { scrapOwn: 2, zones: ['hand', 'discard'], drawPerScrap: true, upTo: true } },
  junkyard: { outpost: true, primary: { scrapOwn: 1, zones: ['hand', 'discard'], optional: true } },
  machineBase: { outpost: true, primary: { draw: 1, scrapOwnMandatory: 1 } },
  mechWorld: { outpost: true, allAlly: true },
  missileBot: { primary: { combat: 2 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { combat: 2 } },
  missileMech: { primary: { combat: 6 }, optionalPrimary: { destroyBase: true }, ally: { draw: 1 } },
  patrolMech: { primaryChoice: [{ trade: 3 }, { combat: 5 }], ally: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  stealthNeedle: { copyShip: true },
  supplyBot: { primary: { trade: 2 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { combat: 2 } },
  tradeBot: { primary: { trade: 1 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { combat: 2 } },

  battlecruiser: { primary: { combat: 5, draw: 1 }, ally: { discardOpponent: 1 }, scrap: { draw: 1, destroyBase: true } },
  corvette: { primary: { combat: 1, draw: 1 }, ally: { combat: 2 } },
  dreadnaught: { primary: { combat: 7, draw: 1 }, scrap: { combat: 5 } },
  fleetHQ: { fleetHQ: true },
  imperialFighter: { primary: { combat: 2, discardOpponent: 1 }, ally: { combat: 2 } },
  imperialFrigate: { primary: { combat: 4, discardOpponent: 1 }, ally: { combat: 2 }, scrap: { draw: 1 } },
  recyclingStation: { outpost: true, primaryChoice: [{ trade: 1 }, { recycle: 2 }] },
  royalRedoubt: { outpost: true, primary: { combat: 3 }, ally: { discardOpponent: 1 } },
  spaceStation: { outpost: true, primary: { combat: 2 }, ally: { combat: 2 }, scrap: { trade: 4 } },
  surveyShip: { primary: { trade: 1, draw: 1 }, scrap: { discardOpponent: 1 } },
  warWorld: { outpost: true, primary: { combat: 3 }, ally: { combat: 4 } },

  barterWorld: { primaryChoice: [{ authority: 2 }, { trade: 2 }], scrap: { combat: 5 } },
  centralOffice: { primary: { trade: 2 }, ally: { topDeckNextShip: true } },
  commandShip: { primary: { authority: 4, combat: 5, draw: 2 }, ally: { destroyBase: true } },
  cutter: { primary: { authority: 4, trade: 2 }, ally: { combat: 4 } },
  defenseCenter: { outpost: true, primaryChoice: [{ authority: 3 }, { combat: 2 }], ally: { combat: 2 } },
  embassyYacht: { primary: { authority: 3, trade: 2, drawIfTwoBases: 2 } },
  federationShuttle: { primary: { trade: 2 }, ally: { authority: 4 } },
  flagship: { primary: { combat: 5, draw: 1 }, ally: { authority: 5 } },
  freighter: { primary: { trade: 4 }, ally: { topDeckNextShip: true } },
  portOfCall: { outpost: true, primary: { trade: 3 }, scrap: { draw: 1, destroyBase: true } },
  tradeEscort: { primary: { authority: 4, combat: 4 }, ally: { draw: 1 } },
  tradingPost: { outpost: true, primaryChoice: [{ authority: 1 }, { trade: 1 }], scrap: { combat: 3 } },

  // ---- 殖民战争 ----
  battleBot: { primary: { combat: 2 }, optionalPrimary: { scrapOwn: 1, zones: ['hand'] }, ally: { combat: 2 } },
  solarSkiff: { primary: { trade: 2 }, ally: { draw: 1 } },
  starBarge: { primary: { trade: 2 }, ally: { combat: 2, discardOpponent: 1 } },
  swarmer: { primary: { combat: 3 }, optionalPrimary: { scrapRow: 1 }, ally: { combat: 2 } },
  lancer: { primary: { combat: 4, combatIfEnemyBase: 2 }, ally: { discardOpponent: 1 } },
  predator: { primary: { combat: 4 }, ally: { draw: 1 } },
  repairBot: { primary: { trade: 2 }, optionalPrimary: { scrapOwn: 1, zones: ['discard'] }, scrap: { combat: 2 } },
  stellarReef: { primary: { trade: 1 }, scrap: { trade: 3 } },
  storageSilo: { primary: { authority: 2 }, ally: { trade: 2 } },
  tradeHauler: { primary: { trade: 3 }, ally: { authority: 3 } },
  warningBeacon: { outpost: true, primary: { combat: 2 }, toHandIfFaction: 'machine' },
  cargoPod: { primary: { trade: 3 }, ally: { combat: 3 }, scrap: { combat: 3 } },
  convoyBot: { primary: { combat: 4 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { combat: 2 } },
  falcon: { primary: { combat: 2, draw: 1 }, scrap: { discardOpponent: 1 } },
  orbitalPlatform: { primary: { discardThenDraw: 1 }, ally: { combat: 3 } },
  patrolCutter: { primary: { trade: 2, combat: 3 }, ally: { authority: 4 } },
  ravager: { primary: { combat: 6 }, optionalPrimary: { scrapRow: 2 } },
  bioformer: { primary: { combat: 3 }, scrap: { trade: 3 } },
  centralStation: { primary: { trade: 2, drawIfThreeBases: 1, authorityIfThreeBases: 4 } },
  commandCenter: { outpost: true, empireShipBonus: 2, primary: { trade: 2 } },
  frontierFerry: { primary: { trade: 3, authority: 4 }, scrap: { destroyBase: true } },
  gunship: { primary: { combat: 5, discardOpponent: 1 }, scrap: { trade: 4 } },
  miningMech: { primary: { trade: 3 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { combat: 3 } },
  theOracle: { outpost: true, primary: { scrapOwn: 1, zones: ['hand'] }, ally: { combat: 3 } },
  agingBattleship: { primary: { combat: 5 }, ally: { draw: 1 }, scrap: { combat: 2, draw: 2 } },
  colonySeedShip: { primary: { trade: 3, combat: 3, authority: 3 }, toHandIfFaction: 'federation' },
  heavyCruiser: { primary: { combat: 4, draw: 1 }, ally: { draw: 1 } },
  mechCruiser: { primary: { combat: 6 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { destroyBase: true } },
  parasite: { primaryChoice: [{ combat: 6 }, { acquireFreeMax: 6 }], ally: { draw: 1 } },
  stealthTower: { outpost: true, copyBase: true },
  federationShipyard: { outpost: true, primary: { trade: 2 }, ally: { topDeckNextAny: true } },
  frontierStation: { outpost: true, primaryChoice: [{ trade: 2 }, { combat: 3 }] },
  peacekeeper: { primary: { combat: 6, authority: 6 }, ally: { draw: 1 } },
  plasmaVent: { primary: { combat: 4 }, toHandIfFaction: 'blob', scrap: { destroyBase: true } },
  supplyDepot: { outpost: true, primary: { depot: true }, ally: { draw: 1 } },
  imperialPalace: { outpost: true, primary: { draw: 1, discardOpponent: 1 }, ally: { combat: 4 } },
  loyalColony: { primary: { trade: 3, combat: 3, authority: 3 } },
  moonwurm: { primary: { combat: 8, draw: 1 }, ally: { acquireCheapFree: { maxCost: 2, toHand: true } } },
  theWrecker: { primary: { combat: 6 }, optionalPrimary: { scrapOwn: 2, zones: ['hand', 'discard'] }, ally: { draw: 1 } },
  emperorsDreadnaught: { primary: { combat: 8, draw: 1, discardOpponent: 1 }, toHandIfFaction: 'empire' },
  factoryWorld: { outpost: true, primary: { trade: 3, nextAcquireToHand: true } },
  leviathan: { primary: { combat: 9, draw: 1 }, optionalPrimary: { destroyBase: true }, ally: { acquireCheapFree: { maxCost: 3, toHand: true } } },
  theIncinerator: { outpost: true, primary: { scrapOwn: 2, zones: ['hand', 'discard'], upTo: true }, ally: { combatPerScrapOwn: 2 } },

  // ---- 边疆 frontiers ----
  fr_blobAlpha: { primary: { combat: 10 } },
  fr_blobMiner: { primary: { trade: 3 }, optionalPrimary: { scrapRow: 1 }, scrap: { combat: 2 } },
  fr_burrower: { primary: { combat: 5 }, ally: { draw: 1 }, scrap: { acquireFreeMax: 4 } },
  fr_crusher: { primary: { combat: 6 }, ally: { trade: 2 } },
  fr_hiveQueen: { primary: { combat: 7, draw: 1 }, ally: { combat: 3 }, doubleAlly: { combat: 3 } },
  fr_infestedMoon: { primary: { combat: 4 }, ally: { draw: 1 }, doubleAlly: { draw: 1 } },
  fr_moonwurmHatchling: { primaryChoice: [{ trade: 3 }, { destroyBase: true }], ally: { combat: 3 } },
  fr_nestingGround: { primary: { trade: 2 }, ally: { combat: 4 } },
  fr_pulverizer: { primary: { scrapRowGainCostCombat: true }, ally: { draw: 1 } },
  fr_spikeCluster: { primary: { combat: 2 }, ally: { trade: 1 } },
  fr_stinger: { primary: { combat: 3 }, ally: { combat: 3 }, scrap: { trade: 1 } },
  fr_swarmCluster: { primary: { combat: 5 }, ally: { combat: 3 }, doubleAlly: { combat: 3 } },
  fr_builderBot: { primary: { trade: 1 }, optionalPrimary: { scrapOwn: 1, zones: ['discard'] }, ally: { trade: 1 }, scrap: { combat: 2 } },
  fr_conversionYard: { optionalPrimary: { scrapOwn: 1, zones: ['hand'], combatIfScrap: 4 } },
  fr_defenseSystem: { primary: { combat: 2 }, ally: { combat: 2 } },
  fr_destroyerBot: { primary: { combat: 5 }, optionalPrimary: { scrapOwn: 1, zones: ['discard'] } },
  fr_enforcerMech: { primary: { combat: 5 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { destroyBase: true }, scrap: { draw: 1 } },
  fr_integrationPort: { primary: { trade: 1 } },
  fr_nanobotSwarm: { primary: { combat: 5, draw: 2 }, optionalPrimary: { scrapOwn: 2, minScrap: 1, zones: ['hand', 'discard'] } },
  fr_neuralNexus: { primary: { scrapOwn: 1, zones: ['hand', 'discard'], gainCostCombat: true }, ally: { draw: 1 } },
  fr_plasmaBot: { primary: { combat: 3 }, optionalPrimary: { scrapOwn: 1, zones: ['hand'] }, ally: { combat: 2 } },
  fr_reclamationStation: { primary: { scrapOwn: 1, zones: ['discard'] }, scrap: { combatPerScrapOwn: 3 } },
  fr_capturedOutpost: { primary: { discardThenDraw: 1 } },
  fr_cargoCraft: { primary: { trade: 2, discardOpponent: 1 }, ally: { combat: 4 } },
  fr_farmShip: { primary: { trade: 3, discardThenDraw: 1 }, scrap: { combat: 4 } },
  fr_frontierHawk: { primary: { combat: 3, discardThenDraw: 1 } },
  fr_hammerhead: { primary: { combat: 3, draw: 1, discardOpponent: 1 }, ally: { draw: 1 } },
  fr_imperialFlagship: { primary: { combat: 7, draw: 2 }, ally: { discardOpponent: 1 } },
  fr_jammingTerminal: { primary: { combat: 2, discardOpponent: 1 } },
  fr_lightCruiser: { primary: { combat: 4, discardOpponent: 1 }, ally: { combat: 2 }, doubleAlly: { draw: 1 } },
  fr_orbitalGunPlatform: { primary: { combat: 3 }, scrap: { trade: 3 } },
  fr_siegeFortress: { primary: { combat: 5 }, ally: { combat: 4 } },
  fr_federationBattleship: { primary: { combat: 5, authority: 5, draw: 1 }, ally: { destroyBase: true }, scrap: { authority: 10 } },
  fr_federationCruiser: { primary: { combat: 5, authority: 4 }, ally: { combat: 2, authority: 2 } },
  fr_frontierRunner: { primary: { trade: 2, authority: 2 } },
  fr_gateship: { primary: { acquireCheapFree: { maxCost: 6, toTop: true } }, ally: { authority: 5 } },
  fr_ionStation: { primary: { trade: 2 }, ally: { trade: 1 }, doubleAlly: { combat: 4, authority: 4 } },
  fr_longHauler: { primary: { trade: 3 }, ally: { trade: 2 }, scrap: { topDeckNextBase: true } },
  fr_orbitalShuttle: { primary: { trade: 3, authorityIfTwoBases: 4, drawIfTwoBases: 1 } },
  fr_outlandStation: { primaryChoice: [{ trade: 1 }, { authority: 3 }], scrap: { draw: 1 } },
  fr_patrolBoat: { primary: { combat: 4, authority: 3 }, ally: { authority: 2 } },
  fr_transitNexus: { primary: { combat: 3, trade: 4, authority: 5 } },

  // ---- 危机：舰队与要塞 crisisFleets ----
  cf_borderFort: { primaryChoice: [{ trade: 1 }, { combat: 2 }], ally: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cf_capitolWorld: { primary: { authority: 6, draw: 1 } },
  cf_cargoLaunch: { primary: { draw: 1 }, scrap: { trade: 1 } },
  cf_customsFrigate: { primary: { acquireCheapFree: { maxCost: 4, type: 'ship', toTop: true } }, ally: { combat: 4 }, scrap: { draw: 1 } },
  cf_patrolBot: { primaryChoice: [{ trade: 2 }, { combat: 4 }], ally: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cf_spikePod: { primary: { combat: 3 }, optionalPrimary: { scrapRow: 2 }, scrap: { combat: 2 } },
  cf_starFortress: { primary: { combat: 3, discardThenDraw: 1 }, ally: { discardThenDraw: 1 } },

  // ---- 危机：基地与战列舰 crisisBases ----
  cb_defenseBot: { primary: { combat: 1, combatIfTwoBases: 8 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cb_fighterBase: { ally: { discardOpponent: 1 } },
  cb_imperialTrader: { primary: { trade: 3, draw: 1 }, ally: { combat: 4 } },
  cb_obliterator: { primary: { combat: 7, combatIfEnemyTwoBases: 6 }, ally: { draw: 1 } },
  cb_tradeRaft: { primary: { trade: 1 }, ally: { draw: 1 }, scrap: { trade: 1 } },
  cb_tradeWheel: { primary: { trade: 1 }, ally: { combat: 2 } },
};

// ============================================================
// text 解析：把卡面中文说明成「等价效果对象」，未知卡的唯一估值依据
// ============================================================
const CN_NUM = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
function toNum(s) {
  if (s == null) return 0;
  if (CN_NUM[s] !== undefined) return CN_NUM[s];
  const n = parseInt(s, 10);
  return isNaN(n) ? 0 : n;
}

const TEXT_FX_CACHE = new Map();

// 从一句话里抽取「获得 X 贸易/战斗/权威」「抽 X 张」
function parseAlt(s) {
  const e = {};
  let m;
  const re = /(\d+|[一二两三四五六七八九十])\s*(贸易|战斗|权威)/g;
  while ((m = re.exec(s))) {
    const n = toNum(m[1]);
    if (m[2] === '贸易') e.trade = (e.trade || 0) + n;
    else if (m[2] === '战斗') e.combat = (e.combat || 0) + n;
    else e.authority = (e.authority || 0) + n;
  }
  const rd = /抽\s*(\d+|[一二两三四五])\s*张/g;
  while ((m = rd.exec(s))) e.draw = (e.draw || 0) + toNum(m[1]);
  return e;
}

function mergeEffect(dst, src) {
  if (!src) return dst;
  for (const k of Object.keys(src)) {
    if (typeof src[k] === 'number') dst[k] = (dst[k] || 0) + src[k];
    else if (src[k] === true) dst[k] = true;
    else if (typeof src[k] === 'object' && src[k] !== null) dst[k] = src[k];
  }
  return dst;
}

// 段内旗标（免费获取、摧毁基地、条件加成等）；返回 false 表示本段已完整处理、不再合并数值
function applyTextFlags(body, fx, card) {
  if (/所有飞船打出时额外获得/.test(body)) fx.fleetHQ = true;
  if (/复制/.test(body)) {
    if (/基地/.test(body)) fx.copyBase = true; else fx.copyShip = true;
  }
  if (/视为所有阵营/.test(body)) fx.allAlly = true;
  if (/每打出一艘星际帝国飞船/.test(body)) fx.empireShipBonus = 2;
  const mFree = /免费获得(?:一张|一艘)?(?:费用不超过|费用不高于)\s*(\d+)\s*的?(飞船|卡|牌)?/.exec(body);
  if (mFree) {
    if (mFree[2] === '飞船') fx.acquireShipFree = true;
    else if (mFree[2] === '卡' || mFree[2] === '牌') fx.acquireFreeMax = Number(mFree[1]);
    else fx.acquireCheapFree = { maxCost: Number(mFree[1]), toHand: /置入手牌/.test(body), toTop: /置于牌库顶/.test(body) };
  }
  if (/免费获得一艘飞船/.test(body)) fx.acquireShipFree = true;
  if (/摧毁目标基地|可摧毁目标基地|摧毁一座/.test(body)) {
    if (/和\/或|和或|和销毁交易行/.test(body)) fx.destroyAndOrScrap = true;
    else fx.destroyBase = true;
  }
  if (/下一张获得的(?:飞船或)?(?:基地|牌|飞船)置入手牌/.test(body)) fx.nextAcquireToHand = true;
  else if (/置于牌库顶/.test(body)) fx.topDeckNextAny = true;
  if (/获得时可置入手牌/.test(body)) fx.toHandIfFaction = (card && card.faction) || 'neutral';
  const mOpp = /(?:目标)?对手弃\s*(\d+)\s*张/.exec(body);
  if (mOpp) fx.discardOpponent = Number(mOpp[1]);
  if (/若(?:你控制至少两座基地|控制两座以上基地)/.test(body)) {
    let m;
    if ((m = /获得\s*(\d+)\s*战斗/.exec(body))) fx.combatIfTwoBases = Number(m[1]);
    if ((m = /获得\s*(\d+)\s*权威/.exec(body))) fx.authorityIfTwoBases = Number(m[1]);
    if ((m = /抽\s*(\d+)\s*张/.exec(body))) fx.drawIfTwoBases = Number(m[1]);
  }
  if (/若你控制至少三座基地/.test(body)) {
    let m;
    if ((m = /获得\s*(\d+)\s*权威/.exec(body))) fx.authorityIfThreeBases = Number(m[1]);
    if ((m = /抽\s*(\d+)\s*张/.exec(body))) fx.drawIfThreeBases = Number(m[1]);
  }
  if (/若对手控制基地/.test(body)) { const m = /获得\s*(\d+)\s*战斗/.exec(body); if (m) fx.combatIfEnemyBase = Number(m[1]); }
  if (/若对手有两座以上基地/.test(body)) { const m = /获得\s*(\d+)\s*战斗/.exec(body); if (m) fx.combatIfEnemyTwoBases = Number(m[1]); }
  if (/每打出过一张虫群牌/.test(body)) fx.drawBlobPlayed = true;
  return true;
}

function parseCardText(card) {
  const text = String((card && card.text) || '');
  if (!text) return null;
  const fx = {};
  const flat = text.replace(/和\/或/g, '和');
  const segs = flat.split(/[；;。\n]/).map(s => s.trim()).filter(Boolean);
  let choiceMode = false;
  for (const raw of segs) {
    let seg = raw;
    let isAlt = false;
    if (seg.charAt(0) === '或') { isAlt = true; seg = seg.slice(1); }
    let bucket = 'primary';
    if (seg.indexOf('前哨') === 0) { fx.outpost = true; continue; }
    if (seg.indexOf('双同盟') === 0) { bucket = 'doubleAlly'; seg = seg.slice(3); }
    else if (seg.indexOf('同盟') === 0) { bucket = 'ally'; seg = seg.slice(2); }
    else if (seg.indexOf('销毁') === 0 && (seg.charAt(2) === '：' || seg.charAt(2) === ':')) { bucket = 'scrap'; seg = seg.slice(3); }
    if (/^可选[：:]/.test(seg)) { bucket = 'optionalPrimary'; seg = seg.replace(/^可选[：:]/, ''); }
    if (/^选择[：:]/.test(seg)) { choiceMode = true; seg = seg.replace(/^选择[：:]/, ''); }
    seg = seg.replace(/^[：:]/, '').trim();
    if (!seg) continue;

    // ---- 纯效果段：无数值合并 ----
    if (/^每弃一张获得/.test(seg)) { fx.depot = true; continue; }
    if (/再抽等量/.test(seg)) { const m = /([一二两三四\d]+)\s*张/.exec(seg); fx.recycle = m ? toNum(m[1]) : 2; continue; }
    if (/每销毁一张/.test(seg)) {
      const m = /获得\s*(\d+)\s*战斗/.exec(seg);
      if (m) fx.combatPerScrapOwn = Number(m[1]); else fx.drawPerScrap = true;
      continue;
    }
    if (/销毁交易行一张牌并获得等同于其费用的战斗/.test(seg)) { fx.scrapRowGainCostCombat = true; continue; }
    if (/摧毁目标基地和销毁交易行/.test(seg)) { fx.destroyAndOrScrap = true; continue; }
    const mNexus = /销毁\s*(\d+|[一二两])\s*张牌并获得等同于其费用的战斗/.exec(seg);
    if (mNexus) {
      const zones = /弃牌堆/.test(seg) && /手牌/.test(seg) ? ['hand', 'discard'] : (/弃牌堆/.test(seg) ? ['discard'] : ['hand', 'discard']);
      fx[bucket] = mergeEffect(fx[bucket] || {}, { scrapOwn: toNum(mNexus[1]), zones, gainCostCombat: true });
      continue;
    }
    const mCIS = /销毁\s*(\d+|[一二两])\s*张牌[，,]\s*若销毁则获得\s*(\d+)\s*战斗/.exec(seg);
    if (mCIS) {
      const zones = /手牌/.test(seg) && /弃牌堆/.test(seg) ? ['hand', 'discard'] : (/弃牌堆/.test(seg) ? ['discard'] : ['hand']);
      fx[bucket] = mergeEffect(fx[bucket] || {}, { scrapOwn: toNum(mCIS[1]), zones, combatIfScrap: Number(mCIS[2]) });
      continue;
    }
    const mOwn = /^可?销毁\s*(手牌或弃牌堆|手牌|弃牌堆)?\s*(至多\s*)?([一二两三四\d]+)?\s*张牌?$/.exec(seg);
    if (mOwn) {
      const zones = mOwn[1] === '手牌' ? ['hand'] : (mOwn[1] === '弃牌堆' ? ['discard'] : ['hand', 'discard']);
      fx[bucket] = mergeEffect(fx[bucket] || {}, { scrapOwn: mOwn[3] ? toNum(mOwn[3]) : 1, zones });
      continue;
    }
    const mRow = /^可?销毁交易行\s*(至多\s*)?([一二两三四\d]+)?\s*张牌?$/.exec(seg);
    if (mRow) {
      fx[bucket] = mergeEffect(fx[bucket] || {}, { scrapRow: mRow[2] ? toNum(mRow[2]) : 1 });
      continue;
    }
    const mDD = /弃\s*(\d+|[一二两])\s*张牌[，,]?\s*再抽/.exec(seg);
    if (mDD) { fx[bucket] = mergeEffect(fx[bucket] || {}, { discardThenDraw: toNum(mDD[1]) }); continue; }

    // ---- 常规段：旗标 + 数值（「或」分分支）----
    applyTextFlags(seg, fx, card);
    const alts = seg.split(/\s*或\s*/);
    const parsed = alts.map(parseAlt).filter(e => Object.keys(e).length > 0);
    if (!parsed.length) continue;
    if (bucket === 'primary' && (isAlt || choiceMode || (alts.length > 1 && parsed.length > 1))) {
      fx.primaryChoice = fx.primaryChoice || [];
      for (const e of parsed) fx.primaryChoice.push(e);
      choiceMode = true;
    } else {
      fx[bucket] = mergeEffect(fx[bucket] || {}, parsed[0]);
      if (parsed.length > 1) for (let i = 1; i < parsed.length; i++) mergeEffect(fx[bucket], parsed[i]);
    }
  }
  return Object.keys(fx).length ? fx : null;
}

function textFx(card) {
  if (!card) return null;
  const key = String(card.id) + '|' + String(card.text || '') + '|' + String(card.type || '');
  const cached = TEXT_FX_CACHE.get(key);
  if (cached !== undefined) return cached;
  const fx = parseCardText(card);
  TEXT_FX_CACHE.set(key, fx);
  return fx;
}

function fxOf(card) {
  if (!card) return {};
  const known = FX[card.id];
  if (known) return known;
  return textFx(card) || {};
}

// ============================================================
// 效果对象评分（一次性即时/静态价值）
// ============================================================
function scoreEffect(e, ctx) {
  if (!e || typeof e !== 'object') return 0;
  const authMult = (ctx && ctx.authMult) || 1;
  const combatMult = (ctx && ctx.combatMult) || 1;
  const drawMult = ctx && ctx.lowHand ? 1.3 : 1;
  const tradeBoost = ctx && ctx.tradeUrgent ? 0.5 : 0;
  const combatBoost = ctx && ctx.combatUrgent ? 0.6 : 0;
  let v = 0;
  if (e.trade) v += e.trade * SC.trade + tradeBoost;
  if (e.combat) v += e.combat * SC.combat * combatMult + combatBoost;
  if (e.authority) v += e.authority * SC.authority * authMult;
  if (e.draw) v += e.draw * SC.draw * drawMult;
  if (e.drawIfTwoBases && ctx && ctx.myBases >= 2) v += e.drawIfTwoBases * SC.draw * 0.7 * drawMult;
  if (e.drawIfThreeBases && ctx && ctx.myBases >= 3) {
    v += e.drawIfThreeBases * SC.draw * 0.7 * drawMult;
    if (e.authorityIfThreeBases) v += e.authorityIfThreeBases * SC.authority * 0.7 * authMult;
  }
  if (e.authorityIfTwoBases && ctx && ctx.myBases >= 2) v += e.authorityIfTwoBases * SC.authority * 0.85 * authMult;
  if (e.combatIfTwoBases && ctx && ctx.myBases >= 2) v += e.combatIfTwoBases * SC.combat * 0.85 * combatMult;
  if (e.combatIfEnemyTwoBases && ctx && ctx.anyOtherTwoBases) v += e.combatIfEnemyTwoBases * SC.combat * 0.85 * combatMult;
  if (e.drawBlobPlayed && ctx) v += Math.max(0, ctx.blobPlayed || 0) * SC.draw * 0.9 * drawMult;
  if (e.combatIfEnemyBase && ctx && ctx.anyOtherHasBase) v += e.combatIfEnemyBase * SC.combat * 0.6 * combatMult;
  if (e.combatPerScrapOwn && ctx) v += e.combatPerScrapOwn * Math.max(0, ctx.scrapped || 0) * SC.combat;
  if (e.discardOpponent) v += e.discardOpponent * SC.discardOpp;
  if (e.topDeckNextShip) v += SC.topDeck;
  if (e.topDeckNextAny) v += SC.topDeck;
  if (e.topDeckNextBase) v += SC.topDeck * 0.8;
  if (e.nextAcquireToHand) v += SC.toHand;
  if (e.recycle) v += SC.recycle;
  if (e.discardThenDraw) v += SC.discardThenDraw;
  if (e.depot) v += SC.depot;
  if (e.acquireFreeMax !== undefined) v += SC.acquireFree;
  if (e.acquireShipFree) v += SC.acquireFree;
  if (e.acquireCheapFree) { v += SC.acquireFree * 0.8; if (e.acquireCheapFree.toHand) v += 0.5; }
  if (e.scrapRow) v += e.scrapRow * SC.scrapRow;
  if (e.scrapOwn) v += e.scrapOwn * SC.scrapOwn;
  if (e.drawPerScrap) v += SC.drawPerScrap;
  if (e.destroyBase) v += SC.destroyBase;
  if (e.destroyAndOrScrap) v += SC.destroyAndScrap;
  if (e.scrapRowGainCostCombat) v += 2.6 * combatMult;
  if (e.gainCostCombat) v += 2.2 * combatMult;
  if (e.combatIfScrap) v += e.combatIfScrap * SC.combat * 0.6 * combatMult;
  return v;
}

// ---- 单卡长期价值（购买、弃牌、拆牌等决策）----
function fxValue(fx, card, ctx) {
  let v = 0;
  if (fx.primaryChoice) {
    let best = -Infinity;
    for (const e of fx.primaryChoice) {
      const s = scoreEffect(e, ctx);
      if (s > best) best = s;
    }
    if (best > -Infinity) v += best;
  } else if (fx.primary) {
    v += scoreEffect(fx.primary, ctx);
  }
  if (fx.ally) v += scoreEffect(fx.ally, ctx) * SC.allyFactor;
  if (fx.doubleAlly) v += scoreEffect(fx.doubleAlly, ctx) * SC.allyFactor * 0.7;
  if (fx.scrap) v += scoreEffect(fx.scrap, ctx) * SC.scrapFactor;
  if (fx.optionalPrimary) v += scoreEffect(fx.optionalPrimary, ctx) * SC.optionalFactor;
  if (card.type === 'base') v *= SC.baseFactor;
  if (card.outpost) {
    let w = 1;
    if (ctx && ctx.teamMode) w = 1.4;                                  // 团队模式全队共享前哨保护
    else if (ctx && ctx.emperorMode) w = ctx.iAmEmperor ? 1.5 : 1.1;   // 大将的前哨守护胜负手
    v += SC.outpost * w;
  }
  if (fx.fleetHQ) v += SC.fleetHQ;
  if (fx.empireShipBonus) v += SC.empireShipBonus;
  if (fx.allAlly) v += SC.allAlly;
  if (fx.copyShip || fx.copyBase) v += SC.copyCard;
  if (card.faction && card.faction !== 'neutral' && ctx && ctx.myFactions.indexOf(card.faction) >= 0) v += SC.factionSynergy;
  return v;
}

function cardScore(card, ctx) {
  if (!card) return 0;
  const known = FX[card.id];
  const fx = known || textFx(card) || {};
  let v = fxValue(fx, card, ctx);
  if (known) {
    const tfx = textFx(card);
    if (tfx) v += 0.2 * fxValue(tfx, card, ctx); // 写死表作加成，text 解析参与每一次估值
  }
  return v;
}

// ---- 敌方基地威胁分 ----
function threatScore(d, ctx) {
  if (!d) return 0;
  let v = cardScore(d, ctx) * 0.8;
  if (ctx.minOppAuth <= 12) v += 1.5;
  return v;
}

// ---- 工具：按 uid 找场上持有者 ----
function findOwner(view, uid) {
  const players = view.players || [];
  for (const p of players) {
    if (p && (p.inPlay || []).indexOf(uid) >= 0) return p;
  }
  return null;
}
// ---- 决策上下文（七模式通用；队伍相关信息按模式计算，不写死人数）----
function buildCtx(view, playerId, memory, context) {
  const players = view.players || [];
  const me = players[playerId] || { authority: 0, trade: 0, combat: 0, hand: [], inPlay: [], discard: [] };
  const mode = (view && view.mode) || (context && context.mode) || 'standard';
  const emperorMode = mode === 'emperor';
  const teamMode = mode === 'team2v2' || mode === 'hydra3';
  const teamLike = teamMode || emperorMode;
  const myTeam = teamLike && typeof me.team === 'number' ? me.team : null;
  const cards = view.cards || {};
  const typeOf = uid => { const c = cards[uid]; return c ? c.type : null; };
  const countBases = p => (p.inPlay || []).filter(uid => typeOf(uid) === 'base').length;

  // 敌人：团队/大将模式按队伍划分，其余模式所有其他存活玩家
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated && (myTeam === null || p.team !== myTeam));
  const teammates = teamLike
    ? players.filter(p => p && p.id !== playerId && !p.eliminated && p.team === myTeam)
    : [];

  // 整队轮流（nextTeamTurn）：同队按座位升序连续行动。
  // 若存在座位比我大且未淘汰的队友，下一个行动者就是队友（transfer 立即到账、可接力拆基地）。
  let nextTeammateId = null;
  if (teamLike) {
    const later = teammates.filter(t => t.id > playerId).sort((a, b) => a.id - b.id);
    if (later.length) nextTeammateId = later[0].id;
  }
  const nextActorIsTeammate = nextTeammateId !== null;

  const myInPlay = me.inPlay || [];
  const myBases = countBases(me);
  const myFactions = [];
  for (const uid of myInPlay) {
    const c = cards[uid];
    if (c && Array.isArray(c.factions)) {
      for (const f of c.factions) if (myFactions.indexOf(f) < 0) myFactions.push(f);
    }
  }
  // 引擎的 combatIfEnemyBase / combatIfEnemyTwoBases 统计「其他存活玩家」（含队友）
  const anyOtherHasBase = players.some(p => p && p.id !== playerId && !p.eliminated && countBases(p) >= 1);
  const anyOtherTwoBases = players.some(p => p && p.id !== playerId && !p.eliminated && countBases(p) >= 2);
  const blobPlayed = (me.playedThisTurn || []).filter(uid => {
    const c = cards[uid];
    return c && Array.isArray(c.factions) && c.factions.indexOf('blob') >= 0;
  }).length;
  const hasFleetHQ = myInPlay.some(uid => { const fx = FX[(cards[uid] || {}).id]; return fx && fx.fleetHQ; });
  const hasCommandCenter = myInPlay.some(uid => { const fx = FX[(cards[uid] || {}).id]; return fx && fx.empireShipBonus; });
  const myAuth = typeof me.authority === 'number' ? me.authority : 0;
  const oppAuths = opponents.map(o => (typeof o.authority === 'number' ? o.authority : 0));
  const minOppAuth = oppAuths.length ? Math.min.apply(null, oppAuths) : 999;
  const maxOppAuth = oppAuths.length ? Math.max.apply(null, oppAuths) : 0;
  let underPressure = false;
  if (memory && typeof memory.lastAuth === 'number' && myAuth < memory.lastAuth - 3) underPressure = true;
  const authMult = myAuth <= 15 ? 1.5 : (myAuth <= 25 ? 1.15 : 1);
  const combatMult = minOppAuth <= 15 ? 1.25 : 1;
  const emperors = view.emperors || [];
  const iAmEmperor = emperorMode && emperors.indexOf(playerId) >= 0;

  // 前哨阻挡：团队模式看对方全队（teamHasOutpost），大将战看个人；阈值取最薄的前哨
  let minOutpostNeeded = Infinity;
  for (const o of opponents) {
    for (const uid of (o.inPlay || [])) {
      const c = cards[uid];
      if (c && c.outpost) {
        const needed = Math.max(1, (c.defense || 1) - ((view.damage || {})[uid] || 0));
        if (needed < minOutpostNeeded) minOutpostNeeded = needed;
      }
    }
  }
  const faceBlocked = minOutpostNeeded !== Infinity;
  const combatUrgent = faceBlocked && me.combat < minOutpostNeeded;

  const ctx = {
    view, me, playerId, mode, opponents, teammates, cards,
    emperorMode, teamMode, teamLike, myTeam, nextTeammateId, nextActorIsTeammate, iAmEmperor,
    myBases, myFactions, anyOtherHasBase, anyOtherTwoBases, blobPlayed,
    hasFleetHQ, hasCommandCenter, myAuth, minOppAuth, maxOppAuth,
    authMult, combatMult, underPressure, faceBlocked, combatUrgent,
    lowHand: (me.hand || []).length <= 2,
    scrapped: me.scrappedThisTurn || 0, memory,
  };
  // 贸易紧迫：差 1~3 贸易就能买到高分牌
  ctx.tradeUrgent = false;
  const row = view.tradeRow || [];
  for (let r = 0; r < row.length; r++) {
    const uid = row[r];
    const c = uid ? cards[uid] : null;
    if (c && c.cost != null && cardScore(c, ctx) >= 4 && c.cost - me.trade >= 1 && c.cost - me.trade <= 3) {
      ctx.tradeUrgent = true;
    }
  }
  return ctx;
}

// ---- 先血模式：target 败北后，赢家是否为「败者右手边第一位存活者」----
function firstBloodWinnerIsMe(view, targetId, meId) {
  const players = view.players || [];
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = ((targetId - step) % n + n) % n;
    const p = players[idx];
    if (p && !p.eliminated) return idx === meId;
  }
  return false;
}

// ---- 致命一击的估值：不同模式「打死人」的含金量完全不同 ----
function lethalValue(ctx, action) {
  if (ctx.mode === 'firstBlood') {
    // 先血：首位败北时其右手边玩家立即获胜；打死别人会送给第三者，宁可普通输出
    return firstBloodWinnerIsMe(ctx.view, action.targetId, ctx.playerId) ? SC.lethal : 0.1;
  }
  if (ctx.emperorMode) {
    // 大将战：只有大将被击败才整队失败；提督阵亡只是解锁敌方大将
    const emperors = ctx.view.emperors || [];
    return emperors.indexOf(action.targetId) >= 0 ? SC.lethal : SC.bigKill;
  }
  if (ctx.teamMode) {
    // team2v2 / hydra3：全队共享权威，任一人被打到 0 即全队出局
    return SC.lethal;
  }
  // ffa / hunter：最后存活者胜；打到只剩一个敌人时才是致胜一击
  return ctx.opponents.length <= 2 ? SC.lethal : SC.bigKill;
}

// ---- 各动作评分 ----
function scorePlay(action, ctx) {
  const view = ctx.view;
  const self = view.cards[action.cardId];
  if (!self) return 0;
  const selfFx = fxOf(self);
  let fx = selfFx;
  let copyCard = null;
  if (action.copy) {
    copyCard = view.cards[action.copy];
    if (copyCard) fx = fxOf(copyCard);
  }
  const isBase = self.type === 'base' || (copyCard && copyCard.type === 'base');
  if (isBase) {
    // 基地打出即上场：长期价值折现（复制牌再加复制目标价值）
    let v = cardScore(self, ctx) * SC.basePlayFactor;
    if (copyCard) v += cardScore(copyCard, ctx) * SC.copyBonus;
    return v;
  }
  // 飞船打出即结算 primary
  let v = SC.playFloor;
  const effect = fx.primaryChoice ? fx.primaryChoice[action.choice] : fx.primary;
  if (effect) {
    let s = scoreEffect(effect, ctx);
    if (effect.acquireFreeMax !== undefined) {
      if (action.row !== undefined) {
        const uid = view.tradeRow[action.row];
        const rowCard = uid ? view.cards[uid] : null;
        if (rowCard) s = Math.max(s, cardScore(rowCard, ctx) + SC.freeAcquireBonus);
      } else {
        s = 0; // 没有可免费获得的目标，该选择空转
      }
    }
    if (effect.acquireCheapFree && action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      const rowCard = uid ? view.cards[uid] : null;
      if (rowCard) {
        let av = cardScore(rowCard, ctx) + SC.freeAcquireBonus * 0.8;
        if (effect.acquireCheapFree.toHand) av += 0.5;
        s = Math.max(s, av);
      }
    }
    if (effect.scrapRowGainCostCombat && action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      const rowCard = uid ? view.cards[uid] : null;
      if (rowCard) {
        const cost = rowCard.cost == null ? 3 : rowCard.cost;
        s = Math.max(s, cost * SC.combat + 0.8); // 按费用换战斗，并顺手拆掉一张交易行
      }
    }
    // 引擎未实现「飞船主能力摧毁基地」，该分支保守估值
    if (effect.destroyBase && action.targetId === undefined) s = Math.min(s, 0.5);
    v += s;
  }
  // 协同加分：舰队总部 / 指挥中心 / 潜在同盟触发
  if (ctx.hasFleetHQ) v += SC.combat;
  if (ctx.hasCommandCenter && (self.factions || []).indexOf('empire') >= 0) v += SC.combat * 2;
  if (selfFx.ally && self.faction && self.faction !== 'neutral' && ctx.myFactions.indexOf(self.faction) >= 0) v += SC.allyPotential;
  return v;
}

function scoreAbility(action, ctx) {
  const view = ctx.view;
  const card = view.cards[action.cardId];
  if (!card) return 0;
  const fx = fxOf(card);
  const kind = action.ability;
  const hand = ctx.me.hand || [];
  const costOf = uid => {
    const d = view.cards[uid];
    if (!d) return 0;
    return cardScore(d, ctx) * (hand.indexOf(uid) >= 0 ? SC.handLoss : SC.discardLoss);
  };
  const sumCost = targets => (targets || []).reduce((s, u) => s + costOf(u), 0);
  const rowCostCombat = row => {
    const uid = view.tradeRow[row];
    const d = uid ? view.cards[uid] : null;
    if (!d) return 0;
    const cost = d.cost == null ? 3 : d.cost;
    return cost * SC.combat + 0.8;
  };

  if (kind === 'primary') {
    const effect = fx.primaryChoice ? fx.primaryChoice[action.choice] : fx.primary;
    if (!effect) return 0;
    const targets = action.targets || [];
    if (effect.drawPerScrap) return SC.draw * targets.length - sumCost(targets);
    if (effect.recycle || effect.discardThenDraw) return SC.draw * targets.length - sumCost(targets);
    if (effect.depot) {
      const combatBoost = action.resource === 'combat' && ctx.combatUrgent ? 0.6 : 0;
      const tradeBoost = action.resource === 'trade' && ctx.tradeUrgent ? 0.5 : 0;
      const per = (action.resource === 'combat' ? SC.combat : SC.trade) + combatBoost + tradeBoost;
      return per * 2 * targets.length - sumCost(targets);
    }
    let v = scoreEffect(effect, ctx);
    if (effect.scrapOwn) {
      v -= sumCost(targets);
      if (effect.gainCostCombat) {
        let combat = 0;
        for (const uid of targets) { const d = view.cards[uid]; if (d && d.cost != null) combat += d.cost; }
        v += combat * SC.combat * 0.9; // 按被销毁牌的费用换战斗
      }
      if (effect.combatIfScrap && targets.length) v += effect.combatIfScrap * SC.combat;
    }
    if (effect.acquireFreeMax !== undefined && action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      const rowCard = uid ? view.cards[uid] : null;
      if (rowCard) v = Math.max(v, cardScore(rowCard, ctx) + SC.freeAcquireBonus);
    }
    if (effect.acquireCheapFree && action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      const rowCard = uid ? view.cards[uid] : null;
      if (rowCard) {
        let av = cardScore(rowCard, ctx) + SC.freeAcquireBonus * 0.8;
        if (effect.acquireCheapFree.toHand) av += 0.5;
        v = Math.max(v, av);
      }
    }
    if (effect.scrapRowGainCostCombat && action.row !== undefined) v = Math.max(v, rowCostCombat(action.row));
    if (effect.destroyBase && action.targetId) {
      const t = view.cards[action.targetId];
      if (t) v += threatScore(t, ctx) * 0.6;
    }
    return v;
  }

  if (kind === 'ally') {
    // double:true 的双同盟是另一次同盟机会，效果走 doubleAlly（未知卡退回 ally）
    const e = action.double ? (fx.doubleAlly || fx.ally) : fx.ally;
    if (!e) return 0;
    let v = scoreEffect(e, ctx) * SC.allyFactor;
    if ((e.acquireShipFree || e.acquireCheapFree || e.acquireFreeMax !== undefined) && action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      const rowCard = uid ? view.cards[uid] : null;
      if (rowCard) {
        let av = cardScore(rowCard, ctx) + SC.freeAcquireBonus * 0.7;
        if (e.acquireCheapFree && e.acquireCheapFree.toHand) av += 0.5;
        v = Math.max(v, av);
      }
    }
    if (e.destroyBase || e.destroyAndOrScrap) {
      if (action.targetId) {
        const t = view.cards[action.targetId];
        v = Math.max(v, threatScore(t, ctx) + SC.destroyBase);
      }
      if (action.row !== undefined) {
        const uid = view.tradeRow[action.row];
        const rowCard = uid ? view.cards[uid] : null;
        if (rowCard) v = Math.max(v, cardScore(rowCard, ctx) * 0.4 + 1.0);
      }
      if (e.destroyAndOrScrap && action.targetId && action.row !== undefined) {
        const t = view.cards[action.targetId];
        const uid2 = view.tradeRow[action.row];
        const rowCard = uid2 ? view.cards[uid2] : null;
        v = Math.max(v, (t ? threatScore(t, ctx) : 0) + (rowCard ? cardScore(rowCard, ctx) * 0.4 + 1.0 : 0) + SC.destroyBase);
      }
    }
    if (e.scrapRowGainCostCombat && action.row !== undefined) v = Math.max(v, rowCostCombat(action.row));
    if (e.scrapOwn) {
      const targets = action.targets || [];
      v = Math.max(v, (SC.scrapOwn * targets.length - sumCost(targets)) * SC.allyFactor);
    }
    if (e.discardThenDraw || e.recycle) {
      const targets = action.targets || [];
      v = Math.max(v, (SC.draw * targets.length - sumCost(targets)) * SC.allyFactor);
    }
    if (e.combatPerScrapOwn) {
      // 焚化炉联动：先估算本回合可拆张数，保证 primary 先执行（拆牌）再 ally（换战斗）
      let potential = ctx.scrapped || 0;
      const used = (ctx.me.used && ctx.me.used[action.cardId]) || [];
      if (fx.primary && fx.primary.scrapOwn && used.indexOf('primary') < 0) {
        const cands = [];
        for (const zone of (fx.primary.zones || ['hand', 'discard'])) {
          for (const uid of (ctx.me[zone] || [])) cands.push(uid);
        }
        let cheap = 0;
        for (const uid of cands) {
          const d = view.cards[uid];
          if (d && costOf(uid) < 2.0) cheap++;
        }
        if (cheap > 0) potential += Math.min(2, cheap);
      }
      v = Math.max(v, e.combatPerScrapOwn * Math.min(4, potential) * SC.combat);
    }
    return v;
  }

  if (kind === 'optional') {
    const e = fx.optionalPrimary;
    if (!e) return 0;
    if (e.scrapRow) {
      const rows = action.rows || (action.row !== undefined ? [action.row] : []);
      let v = 0;
      for (const r of rows) {
        const uid = view.tradeRow[r];
        const d = uid ? view.cards[uid] : null;
        if (!d) continue;
        const cs = cardScore(d, ctx);
        const cost = d.cost == null ? Infinity : d.cost;
        if (ctx.me.trade >= cost && cs >= 3) continue; // 自己这回合还可能买，留给 buy
        v += cost >= 4 ? SC.scrapRowBig : SC.scrapRowSmall;
      }
      return v;
    }
    if (e.scrapOwn) {
      const targets = action.targets || [];
      let v = SC.scrapOwnTiny * targets.length - sumCost(targets);
      if (e.combatIfScrap && targets.length) v += e.combatIfScrap * SC.combat;
      return v;
    }
    if (e.destroyBase && action.targetId) {
      const t = view.cards[action.targetId];
      return threatScore(t, ctx) + SC.destroyBase;
    }
    return 0;
  }

  if (kind === 'scrap') {
    const e = fx.scrap;
    if (!e) return 0;
    let v = scoreEffect(e, ctx);
    v -= cardScore(card, ctx) * SC.selfScrapLoss;
    if (e.destroyBase && action.targetId) {
      const t = view.cards[action.targetId];
      if (t) v += threatScore(t, ctx) * 0.6;
    }
    if (e.combat && ctx.combatUrgent) v += SC.scrapUrgentBonus;
    return v;
  }
  return 0;
}

function scoreBuy(action, ctx) {
  const view = ctx.view;
  if (action.explorer) return SC.explorerScore + (ctx.me.trade >= 4 ? 0.3 : 0);
  const uid = view.tradeRow[action.row];
  const d = uid ? view.cards[uid] : null;
  if (!d) return 0;
  let v = cardScore(d, ctx);
  const fx = fxOf(d);
  if (ctx.me.topDeckNextAny || (d.type === 'ship' && ctx.me.topDeckNextShip)) v += SC.topDeck;
  if (ctx.me.nextAcquireToHand) v += SC.toHand;
  if (fx.toHandIfFaction && ctx.myFactions.indexOf(fx.toHandIfFaction) >= 0) v += SC.toHand;
  return v;
}

function scoreAttack(action, ctx) {
  const view = ctx.view;
  const me = ctx.me;
  if (action.targetType === 'base') {
    const d = view.cards[action.targetId];
    const defense = (d && d.defense) || 1;
    const needed = Math.max(1, defense - ((view.damage || {})[action.targetId] || 0));
    if (me.combat < needed) {
      // 非团队模式：伤害回合末清零，打不死就别把战斗丢进去
      // 团队模式：伤害到队末才清，且下一个行动者是队友时可接力——允许「摸一下」
      if (ctx.teamMode && ctx.nextActorIsTeammate && me.combat >= 2) {
        const frac = me.combat / needed;
        let v = (threatScore(d, ctx) * 0.45 + 0.8) * frac;
        if (d && d.outpost) v += SC.outpostBreak * 0.6 * frac;
        return v;
      }
      return 0;
    }
    if (d && d.outpost) {
      const owner = findOwner(view, action.targetId) || (d.owner != null ? view.players[d.owner] : null);
      let otherOutposts = 0;
      if (owner) {
        // 团队模式看对方全队的前哨数量
        const teamMates = ctx.teamMode
          ? view.players.filter(p => p && p.team === owner.team)
          : [owner];
        for (const p of teamMates) {
          for (const uid of (p.inPlay || [])) {
            const c = view.cards[uid];
            if (c && c.outpost && uid !== action.targetId) otherOutposts++;
          }
        }
      }
      return SC.outpostBreak + 0.4 * defense + (otherOutposts === 0 ? SC.outpostUnlock : 0);
    }
    return threatScore(d, ctx) * SC.nonOutpostAttack;
  }
  const target = view.players[action.targetId];
  if (!target) return 0;
  // 血线与斩杀一律读个人权威（大将战里 teams[].authority 是 0）
  const auth = typeof target.authority === 'number' ? target.authority : 0;
  const amount = action.amount || 0;
  if (amount >= auth) return lethalValue(ctx, action);
  let mult = 1 + (auth <= 15 ? 0.25 : 0) + (auth <= 8 ? 0.2 : 0);
  if (ctx.underPressure) mult *= 0.95;
  let v = amount * SC.combat * mult;
  if (amount < me.combat) v -= 0.5; // 没打满属于次优
  return v;
}

function scoreTransfer(action, ctx) {
  const per = action.resource === 'combat' ? SC.combat : SC.trade;
  let v = (action.amount || 0) * per;
  // 整队轮流：转给紧接着行动的队友，其 beginTurn 立刻加进资源池，价值略上浮；
  // 转给已行动过的队友要等下一轮，稍打折。
  v *= (ctx.nextActorIsTeammate && ctx.nextTeammateId === action.targetId) ? 1.05 : 0.85;
  return v;
}

// ---- 大将战移牌：花 1 贸易把弃牌堆一张牌交给队内相邻队友 ----
function scoreMoveCard(action, ctx) {
  const view = ctx.view;
  const card = view.cards[action.cardId];
  const target = view.players[action.targetId];
  if (!card || !target) return 0;
  const base = Math.max(0, cardScore(card, ctx));
  let v = 0.2 + 0.12 * base - SC.trade; // 1 贸易成本；清废牌 + 队友弃牌堆再利用
  const emperors = view.emperors || [];
  if (emperors.indexOf(target.id) >= 0) v += 0.25; // 交给大将：其弃牌堆更关键
  if (base < 1.5) v += 0.15;
  return v;
}

// ---- 未知动作：低分兜底（引擎对未知 type 会直接抛错，绝不让它抢在 endTurn 前）----
function scoreUnknown(action, ctx) {
  if (action && action.cardId && ctx && ctx.view && ctx.view.cards) {
    const c = ctx.view.cards[action.cardId];
    if (c) return 0.1 + 0.05 * Math.max(0, cardScore(c, ctx));
  }
  return 0.15;
}

// ---- 待决选择 ----
function handlePending(view, legalActions, playerId, ctx) {
  const p = view.pending || {};
  const t = p.type;
  if (t === 'discard' || t === 'selectScrap' || t === 'scrapMandatory') {
    let best = null;
    let bestScore = Infinity;
    for (const a of legalActions) {
      let s = 0;
      try {
        const d = view.cards[a.cardId];
        s = cardScore(d, ctx);
        if (t !== 'discard' && d && d.id === 'explorer') s -= 0.2; // 销毁探索者会回补供应堆，略优先
      } catch (err) { s = 0; }
      if (s < bestScore) { bestScore = s; best = a; }
    }
    return best || legalActions[0];
  }
  if (t === 'targetDiscard') {
    let best = null;
    let bestScore = -Infinity;
    for (const a of legalActions) {
      const o = view.players[a.targetId];
      const s = ((o && o.handCount) || 0) - ((o && o.authority) || 0) * 0.03;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    return best || legalActions[0];
  }
  if (t === 'eventChoice') return scoreEventChoice(view, legalActions, ctx, p);
  // 未知待决类型：原样返回第一个合法动作
  return legalActions[0];
}

function scoreEventChoice(view, legalActions, ctx, p) {
  const me = ctx.me;
  const kind = p.kind || p.eventId;
  let best = null;
  let bestScore = -Infinity;
  for (const a of legalActions) {
    let s = 0;
    try {
      if (kind === 'blackHole') {
        // 每少弃一张失去 4 权威（不低于 1）：权威损失 + 手牌损失最小化
        const n = (a.targets || []).length;
        const authLoss = Math.min(4 * (2 - n), Math.max(0, me.authority - 1));
        const cardLoss = (a.targets || []).reduce((sum, uid) => sum + cardScore(view.cards[uid], ctx), 0);
        s = -(authLoss + 0.7 * cardLoss);
      } else if (kind === 'bombardment') {
        // 摧毁一座己方基地 vs 失去 6 权威
        if (a.pay) s = -Math.min(6, Math.max(0, me.authority - 1)) * (me.authority <= 8 ? 1.4 : 1);
        else if (a.baseId) {
          const d = view.cards[a.baseId];
          let cost = cardScore(d, ctx) * (me.authority <= 8 ? 1.5 : 0.9);
          if (d && d.outpost) {
            cost *= 1.5; // 前哨被打掉会影响后续防护
            if (ctx.teamMode) {
              let teamOutposts = 0;
              for (const pl of view.players) {
                if (pl && pl.team === me.team) {
                  for (const uid of (pl.inPlay || [])) {
                    const c = view.cards[uid];
                    if (c && c.outpost) teamOutposts++;
                  }
                }
              }
              if (teamOutposts <= 1) cost *= 1.6; // 全队最后一座前哨，坚决不拆
            }
          }
          s = -cost;
        }
        else s = -1;
      } else if (kind === 'comet') {
        // 可销毁手牌/弃牌堆至多两张：无收益，只捡弃牌堆里的真废牌，手牌绝不销毁
        for (const uid of (a.targets || [])) {
          const cs = cardScore(view.cards[uid], ctx);
          const inHand = (me.hand || []).indexOf(uid) >= 0;
          s += inHand ? -(0.8 * cs + 0.3) : (0.25 - 0.02 * cs);
        }
      } else if (kind === 'warpJump') {
        // 抽 3 张选 2 张按序放回牌库顶：把最想要的放最上
        const c = a.cards || [];
        s = (c[0] ? cardScore(view.cards[c[0]], ctx) : 0) + (c[1] ? 0.9 * cardScore(view.cards[c[1]], ctx) : 0);
      } else {
        s = 0; // 未知事件：各选项等价，取第一个
      }
    } catch (err) { s = -1; }
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best || legalActions[0];
}

// ---- 主阶段：全量评分取最高 ----
function handleMain(view, legalActions, playerId, ctx) {
  let best = null;
  let bestScore = SC.actThreshold;
  for (const action of legalActions) {
    let s = -Infinity;
    try {
      switch (action && action.type) {
        case 'play': s = scorePlay(action, ctx); break;
        case 'ability': s = scoreAbility(action, ctx); break;
        case 'buy': s = scoreBuy(action, ctx); break;
        case 'attack': s = scoreAttack(action, ctx); break;
        case 'transfer': s = scoreTransfer(action, ctx); break;
        case 'moveCard': s = scoreMoveCard(action, ctx); break;
        default: s = scoreUnknown(action, ctx); break;
      }
    } catch (err) { s = -Infinity; }
    if (s > bestScore) { bestScore = s; best = action; }
  }
  if (best) return best;
  const end = legalActions.find(a => a && a.type === 'endTurn');
  return end || legalActions[0];
}

// ---- 异常兜底：优先返回已知类型的非结束动作 ----
function fallbackAction(legalActions) {
  if (!Array.isArray(legalActions) || legalActions.length === 0) return { type: 'endTurn' };
  for (const a of legalActions) {
    if (a && KNOWN_ACTION_TYPES.has(a.type) && a.type !== 'endTurn') return a;
  }
  return legalActions[0];
}

// ============================================================
// 脚本入口
// ============================================================
export const meta = {
  name: 'step5preview·雪球收割',
  description: '模型 ID step-5-preview；自选策略「雪球收割（Snowball-Reap）」：胜负手是经济差与战斗转化效率的乘积——早期买高性价比贸易牌滚大雪球，中期用高战斗效率牌收割权威并保留生命线；全部决策由统一等效权威分驱动，适配 2026-11-08 新版七模式与六牌包。'
};

export function chooseAction(args) {
  const { view, legalActions, playerId, context } = args || {};
  let memory = args && args.memory;
  try {
    if (!memory) memory = {};
    memory.calls = (memory.calls || 0) + 1;
    if (!Array.isArray(legalActions) || legalActions.length === 0) return { type: 'endTurn' };
    const safeView = view || { players: [], cards: {}, tradeRow: [] };
    const me = safeView.players && safeView.players[playerId];
    // 回合记忆：记录回合开始时的权威，用于判断是否被压制
    const turn = typeof safeView.turn === 'number' ? safeView.turn : 0;
    if (me && safeView.activePlayer === playerId && memory.lastTurn !== turn) {
      memory.lastAuth = me.authority;
      memory.lastTurn = turn;
    }
    const ctx = buildCtx(safeView, playerId, memory, context);
    if (safeView.pending) return handlePending(safeView, legalActions, playerId, ctx);
    return handleMain(safeView, legalActions, playerId, ctx);
  } catch (err) {
    return fallbackAction(legalActions);
  }
}
