// 策略名称：壁垒重锤（Bastion & Hammer）
// 选择理由：唯一稳定的胜点是把对手权威打到 0，而前哨基地会完全封锁「对方法威伤害」，所以打法是两段式——先用可重复触发的基地引擎叠高自己的权威血线并顺手造一道前哨墙锁死对手的直伤通道，再用单回合战斗爆发把对手的前哨墙一击拆掉，把伤害全额灌进权威。
// 本轮更新：按 2026-11-08 版程序适配 7 种模式（新增 hydra3/emperor）、6 个牌包任意组合、团队模式「整队轮流 + 队末才清算」、大将战个人权威与 moveCard，以及 double/choice/row/rows/targets/targetId 等新动作字段。

/**
 * MiniMax M3 · 壁垒重锤（Bastion & Hammer）
 *
 * 策略身份沿用上一版：两段式——「壁垒」（可重复触发的基地引擎 + 前哨墙）
 * 与「重锤」（单回合战斗爆发拆墙后把伤害全额灌进权威）。
 *
 * 本版针对 2026-11-08 版规则内核做的适配：
 *   1) 模式扩到 7 种：新增 hydra3（6 人两队各 3 人、共享 100 权威）与
 *      emperor（每队 1 大将 60 权威 + 2 提督 50 权威、大将败则该队失败）。
 *   2) 团队模式改为「整队轮流」+「队末才清算」：伤害在队末才清零，
 *      队友可接力拆同一道墙；转移的贸易/战斗在紧接着行动的队友回合开始到账。
 *   3) 大将战血线读个人权威，目标一律以 legalActions 为准；新增 moveCard。
 *   4) 牌包扩到 6 个且可自由组合：卡牌估值改为「可见字段 + 卡面 text 解析」，
 *      写死的价值表只作为加成/精确项，未知卡不再被当成废牌。
 *   5) 认识 double:true 的 ally、带 choice/row/rows/targets/targetId 的 play/ability，
 *      以及任何未知动作类型，一律打分兜底。
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
    'minimax-m3-pay｜壁垒重锤（Bastion & Hammer）｜用可重复触发的基地引擎与前哨墙筑高权威血线、锁死对手直伤通道，再用单回合战斗爆发拆掉对手前哨墙并把伤害全额灌进权威。'
};

/* ------------------------------------------------------------------ *
 * 卡牌知识表（依据 engine/cards.js、engine/expansions.js、engine/expansions-extra.js）
 * t 船/基地  c 费用  d 防御  o 前哨  f 阵营
 * p 主要能力  pc 主要能力选项  a 同盟能力  da 双同盟能力  op 可选主要能力  s 销毁能力
 * x 特殊标记
 * 说明：这张表只是「加成/精确项」。表里没有的卡（未来新牌）会走下面的
 *       卡面 text 解析兜底，绝不会因为不认识卡名就被当成废牌。
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
  brainWorld: { t: 'base', c: 8, d: 6, o: true, f: 'machine', p: { scrapOwn: 2, zones: ['hand', 'discard'], drawPerScrap: true, upTo: true } },
  junkyard: { t: 'base', c: 6, d: 6, o: true, f: 'machine', p: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  machineBase: { t: 'base', c: 7, d: 6, o: true, f: 'machine', p: { draw: 1, scrapOwnMandatory: 1 } },
  mechWorld: { t: 'base', c: 5, d: 6, o: true, f: 'machine', x: { allAlly: true } },
  missileBot: { t: 'ship', c: 2, f: 'machine', p: { combat: 2 }, op: { scrapOwn: 1 }, a: { combat: 2 } },
  missileMech: { t: 'ship', c: 6, f: 'machine', p: { combat: 6 }, op: { destroyBase: true }, a: { draw: 1 } },
  patrolMech: { t: 'ship', c: 4, f: 'machine', pc: [{ trade: 3 }, { combat: 5 }], a: { scrapOwn: 1, zones: ['hand', 'discard'] } },
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
  battleBot: { t: 'ship', c: 1, f: 'machine', p: { combat: 2 }, op: { scrapOwn: 1, zones: ['hand'] }, a: { combat: 2 } },
  solarSkiff: { t: 'ship', c: 1, f: 'federation', p: { trade: 2 }, a: { draw: 1 } },
  starBarge: { t: 'ship', c: 1, f: 'empire', p: { trade: 2 }, a: { combat: 2, discardOpponent: 1 } },
  swarmer: { t: 'ship', c: 1, f: 'blob', p: { combat: 3 }, op: { scrapRow: 1 }, a: { combat: 2 } },
  lancer: { t: 'ship', c: 2, f: 'empire', p: { combat: 4, combatIfEnemyBase: 2 }, a: { discardOpponent: 1 } },
  predator: { t: 'ship', c: 2, f: 'blob', p: { combat: 4 }, a: { draw: 1 } },
  repairBot: { t: 'ship', c: 2, f: 'machine', p: { trade: 2 }, op: { scrapOwn: 1, zones: ['discard'] }, s: { combat: 2 } },
  stellarReef: { t: 'base', c: 2, d: 3, f: 'blob', p: { trade: 1 }, s: { trade: 3 } },
  storageSilo: { t: 'base', c: 2, d: 3, f: 'federation', p: { authority: 2 }, a: { trade: 2 } },
  tradeHauler: { t: 'ship', c: 2, f: 'federation', p: { trade: 3 }, a: { authority: 3 } },
  warningBeacon: { t: 'base', c: 2, d: 2, o: true, f: 'machine', p: { combat: 2 }, x: { toHandIfFaction: 'machine' } },
  cargoPod: { t: 'ship', c: 3, f: 'blob', p: { trade: 3 }, a: { combat: 3 }, s: { combat: 3 } },
  convoyBot: { t: 'ship', c: 3, f: 'machine', p: { combat: 4 }, op: { scrapOwn: 1, zones: ['hand', 'discard'] }, a: { combat: 2 } },
  falcon: { t: 'ship', c: 3, f: 'empire', p: { combat: 2, draw: 1 }, s: { discardOpponent: 1 } },
  orbitalPlatform: { t: 'base', c: 3, d: 4, f: 'empire', p: { discardThenDraw: 1 }, a: { combat: 3 } },
  patrolCutter: { t: 'ship', c: 3, f: 'federation', p: { trade: 2, combat: 3 }, a: { authority: 4 } },
  ravager: { t: 'ship', c: 3, f: 'blob', p: { combat: 6 }, op: { scrapRow: 2 } },
  bioformer: { t: 'base', c: 4, d: 4, f: 'blob', p: { combat: 3 }, s: { trade: 3 } },
  centralStation: { t: 'base', c: 4, d: 5, f: 'federation', p: { trade: 2, drawIfThreeBases: 1, authorityIfThreeBases: 4 } },
  commandCenter: { t: 'base', c: 4, d: 4, o: true, f: 'empire', p: { trade: 2 }, x: { empireShipBonus: 2 } },
  frontierFerry: { t: 'ship', c: 4, f: 'federation', p: { trade: 3, authority: 4 }, s: { destroyBase: true } },
  gunship: { t: 'ship', c: 4, f: 'empire', p: { combat: 5, discardOpponent: 1 }, s: { trade: 4 } },
  miningMech: { t: 'ship', c: 4, f: 'machine', p: { trade: 3 }, op: { scrapOwn: 1, zones: ['hand', 'discard'] }, a: { combat: 3 } },
  theOracle: { t: 'base', c: 4, d: 5, o: true, f: 'machine', p: { scrapOwn: 1, zones: ['hand'] }, a: { combat: 3 } },
  agingBattleship: { t: 'ship', c: 5, f: 'empire', p: { combat: 5 }, a: { draw: 1 }, s: { combat: 2, draw: 2 } },
  colonySeedShip: { t: 'ship', c: 5, f: 'federation', p: { trade: 3, combat: 3, authority: 3 }, x: { toHandIfFaction: 'federation' } },
  heavyCruiser: { t: 'ship', c: 5, f: 'empire', p: { combat: 4, draw: 1 }, a: { draw: 1 } },
  mechCruiser: { t: 'ship', c: 5, f: 'machine', p: { combat: 6 }, op: { scrapOwn: 1, zones: ['hand', 'discard'] }, a: { destroyBase: true } },
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
  theWrecker: { t: 'ship', c: 7, f: 'machine', p: { combat: 6 }, op: { scrapOwn: 2, zones: ['hand', 'discard'] }, a: { draw: 1 } },
  emperorsDreadnaught: { t: 'ship', c: 8, f: 'empire', p: { combat: 8, draw: 1, discardOpponent: 1 }, x: { toHandIfFaction: 'empire' } },
  factoryWorld: { t: 'base', c: 8, d: 7, o: true, f: 'federation', p: { trade: 3, nextAcquireToHand: true } },
  leviathan: { t: 'ship', c: 8, f: 'blob', p: { combat: 9, draw: 1 }, op: { destroyBase: true }, a: { acquireCheapFree: { maxCost: 3, toHand: true } } },
  theIncinerator: { t: 'base', c: 8, d: 7, o: true, f: 'machine', p: { scrapOwn: 2, zones: ['hand', 'discard'], upTo: true }, a: { combatPerScrapOwn: 2 } },

  /* --- 边疆（frontiers） --- */
  fr_blobAlpha: { t: 'ship', c: 6, f: 'blob', p: { combat: 10 } },
  fr_blobMiner: { t: 'ship', c: 2, f: 'blob', p: { trade: 3 }, op: { scrapRow: 1 }, s: { combat: 2 } },
  fr_burrower: { t: 'ship', c: 3, f: 'blob', p: { combat: 5 }, a: { draw: 1 }, s: { acquireFreeMax: 4 } },
  fr_crusher: { t: 'ship', c: 3, f: 'blob', p: { combat: 6 }, a: { trade: 2 } },
  fr_hiveQueen: { t: 'ship', c: 7, f: 'blob', p: { combat: 7, draw: 1 }, a: { combat: 3 }, da: { combat: 3 } },
  fr_infestedMoon: { t: 'base', c: 6, d: 5, f: 'blob', p: { combat: 4 }, a: { draw: 1 }, da: { draw: 1 } },
  fr_moonwurmHatchling: { t: 'ship', c: 4, f: 'blob', pc: [{ trade: 3 }, { destroyBase: true }], a: { combat: 3 } },
  fr_nestingGround: { t: 'base', c: 4, d: 5, f: 'blob', p: { trade: 2 }, a: { combat: 4 } },
  fr_pulverizer: { t: 'ship', c: 5, f: 'blob', p: { scrapRowGainCostCombat: true }, a: { draw: 1 } },
  fr_spikeCluster: { t: 'base', c: 2, d: 3, f: 'blob', p: { combat: 2 }, a: { trade: 1 } },
  fr_stinger: { t: 'ship', c: 1, f: 'blob', p: { combat: 3 }, a: { combat: 3 }, s: { trade: 1 } },
  fr_swarmCluster: { t: 'base', c: 8, d: 8, f: 'blob', p: { combat: 5 }, a: { combat: 3 }, da: { combat: 3 } },
  fr_builderBot: { t: 'ship', c: 1, f: 'machine', p: { trade: 1 }, op: { scrapOwn: 1, zones: ['discard'] }, a: { trade: 1 }, s: { combat: 2 } },
  fr_conversionYard: { t: 'base', c: 5, d: 4, f: 'machine', op: { scrapOwn: 1, zones: ['hand'], combatIfScrap: 4 } },
  fr_defenseSystem: { t: 'base', c: 4, d: 4, f: 'machine', p: { combat: 2 }, a: { combat: 2 } },
  fr_destroyerBot: { t: 'ship', c: 3, f: 'machine', p: { combat: 5 }, op: { scrapOwn: 1, zones: ['discard'] } },
  fr_enforcerMech: { t: 'ship', c: 5, f: 'machine', p: { combat: 5 }, op: { scrapOwn: 1, zones: ['hand', 'discard'] }, a: { destroyBase: true }, s: { draw: 1 } },
  fr_integrationPort: { t: 'base', c: 3, d: 4, f: 'machine', p: { trade: 1 } },
  fr_nanobotSwarm: { t: 'ship', c: 8, f: 'machine', p: { combat: 5, draw: 2 }, op: { scrapOwn: 2, minScrap: 1, zones: ['hand', 'discard'] } },
  fr_neuralNexus: { t: 'base', c: 7, d: 4, f: 'machine', p: { scrapOwn: 1, zones: ['hand', 'discard'], gainCostCombat: true }, a: { draw: 1 } },
  fr_plasmaBot: { t: 'ship', c: 2, f: 'machine', p: { combat: 3 }, op: { scrapOwn: 1, zones: ['hand'] }, a: { combat: 2 } },
  fr_reclamationStation: { t: 'base', c: 6, d: 4, f: 'machine', p: { scrapOwn: 1, zones: ['discard'] }, s: { combatPerScrapOwn: 3 } },
  fr_capturedOutpost: { t: 'base', c: 3, d: 4, f: 'empire', p: { discardThenDraw: 1 } },
  fr_cargoCraft: { t: 'ship', c: 2, f: 'empire', p: { trade: 2, discardOpponent: 1 }, a: { combat: 4 } },
  fr_farmShip: { t: 'ship', c: 4, f: 'empire', p: { trade: 3, discardThenDraw: 1 }, s: { combat: 4 } },
  fr_frontierHawk: { t: 'ship', c: 1, f: 'empire', p: { combat: 3, discardThenDraw: 1 } },
  fr_hammerhead: { t: 'ship', c: 5, f: 'empire', p: { combat: 3, draw: 1, discardOpponent: 1 }, a: { draw: 1 } },
  fr_imperialFlagship: { t: 'ship', c: 8, f: 'empire', p: { combat: 7, draw: 2 }, a: { discardOpponent: 1 } },
  fr_jammingTerminal: { t: 'base', c: 5, d: 6, f: 'empire', p: { combat: 2, discardOpponent: 1 } },
  fr_lightCruiser: { t: 'ship', c: 3, f: 'empire', p: { combat: 4, discardOpponent: 1 }, a: { combat: 2 }, da: { draw: 1 } },
  fr_orbitalGunPlatform: { t: 'base', c: 4, d: 4, f: 'empire', p: { combat: 3 }, s: { trade: 3 } },
  fr_siegeFortress: { t: 'base', c: 7, d: 4, f: 'empire', p: { combat: 5 }, a: { combat: 4 } },
  fr_federationBattleship: { t: 'ship', c: 7, f: 'federation', p: { combat: 5, authority: 5, draw: 1 }, a: { destroyBase: true }, s: { authority: 10 } },
  fr_federationCruiser: { t: 'ship', c: 5, f: 'federation', p: { combat: 5, authority: 4 }, a: { combat: 2, authority: 2 } },
  fr_frontierRunner: { t: 'ship', c: 1, f: 'federation', p: { trade: 2, authority: 2 } },
  fr_gateship: { t: 'ship', c: 6, f: 'federation', p: { acquireCheapFree: { maxCost: 6, toTop: true } }, a: { authority: 5 } },
  fr_ionStation: { t: 'base', c: 5, d: 4, f: 'federation', p: { trade: 2 }, a: { trade: 1 }, da: { combat: 4, authority: 4 } },
  fr_longHauler: { t: 'ship', c: 4, f: 'federation', p: { trade: 3 }, a: { trade: 2 }, s: { topDeckNextBase: true } },
  fr_orbitalShuttle: { t: 'ship', c: 2, f: 'federation', p: { trade: 3, authorityIfTwoBases: 4, drawIfTwoBases: 1 } },
  fr_outlandStation: { t: 'base', c: 3, d: 4, f: 'federation', pc: [{ trade: 1 }, { authority: 3 }], s: { draw: 1 } },
  fr_patrolBoat: { t: 'ship', c: 3, f: 'federation', p: { combat: 4, authority: 3 }, a: { authority: 2 } },
  fr_transitNexus: { t: 'base', c: 8, d: 6, f: 'federation', p: { combat: 3, trade: 4, authority: 5 } },

  /* --- 危机：舰队与要塞（crisisFleets） --- */
  cf_borderFort: { t: 'base', c: 4, d: 4, f: 'machine', pc: [{ trade: 1 }, { combat: 2 }], a: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cf_capitolWorld: { t: 'base', c: 8, d: 4, f: 'federation', p: { authority: 6, draw: 1 } },
  cf_cargoLaunch: { t: 'ship', c: 1, f: 'empire', p: { draw: 1 }, s: { trade: 1 } },
  cf_customsFrigate: { t: 'ship', c: 4, f: 'federation', p: { acquireCheapFree: { maxCost: 4, type: 'ship', toTop: true } }, a: { combat: 4 }, s: { draw: 1 } },
  cf_patrolBot: { t: 'ship', c: 2, f: 'machine', pc: [{ trade: 2 }, { combat: 4 }], a: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cf_spikePod: { t: 'ship', c: 1, f: 'blob', p: { combat: 3 }, op: { scrapRow: 2 }, s: { combat: 2 } },
  cf_starFortress: { t: 'base', c: 7, d: 4, f: 'empire', p: { combat: 3, discardThenDraw: 1 }, a: { discardThenDraw: 1 } },

  /* --- 危机：基地与战列舰（crisisBases） --- */
  cb_defenseBot: { t: 'ship', c: 2, f: 'machine', p: { combat: 1, combatIfTwoBases: 8 }, op: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  cb_fighterBase: { t: 'base', c: 3, d: 4, f: 'empire', a: { discardOpponent: 1 } },
  cb_imperialTrader: { t: 'ship', c: 5, f: 'empire', p: { trade: 3, draw: 1 }, a: { combat: 4 } },
  cb_obliterator: { t: 'ship', c: 6, f: 'blob', p: { combat: 7, combatIfEnemyTwoBases: 6 }, a: { draw: 1 } },
  cb_tradeRaft: { t: 'ship', c: 1, f: 'federation', p: { trade: 1 }, a: { draw: 1 }, s: { trade: 1 } },
  cb_tradeWheel: { t: 'base', c: 3, d: 5, f: 'blob', p: { trade: 1 }, a: { combat: 2 } }
};

/* ------------------------------------------------------------------ *
 * 估值权重与分层
 * ------------------------------------------------------------------ */

const W = { trade: 1, combat: 1, authority: 1, draw: 1.15 };
const TIER = { LETHAL: 1000, PLAY: 40, ABILITY: 30, BUY: 20, ATTACK: 10, TRANSFER: 5, END: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const isTeamShared = mode => mode === 'team2v2' || mode === 'hydra3';

/* ------------------------------------------------------------------ *
 * 卡面文本解析（未知卡的通用估值路径）
 * ------------------------------------------------------------------ */

function grab(text, src) {
  const rx = new RegExp(src, 'g');
  let m;
  let total = 0;
  while ((m = rx.exec(text)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function mergeEff(a, b) {
  if (!b) return a;
  if (!a) return Object.assign({}, b);
  for (const key of Object.keys(b)) {
    const value = b[key];
    if (typeof value === 'number') a[key] = num(a[key]) + value;
    else if (typeof value === 'boolean') a[key] = !!(a[key] || value);
    else if (a[key] === undefined || a[key] === null) a[key] = value;
  }
  return a;
}

/** 把一段中文卡面解析成一个效果对象（只覆盖引擎真正会结算的字段）。 */
function parseEffect(body) {
  const e = {};
  const t = String(body || '');
  if (!t) return e;
  const gainMatch = t.match(/获得([^。；]*)/);
  const scope = gainMatch ? gainMatch[1] : t;
  let trade = grab(scope, '(\\d+)\\s*贸易');
  let combat = grab(scope, '(\\d+)\\s*战斗');
  let authority = grab(scope, '(\\d+)\\s*权威');
  let draw = grab(t, '抽\\s*(\\d+)\\s*张牌');
  const twoBases = /两座以上基地|至少两座基地/.test(t);
  const enemyTwoBases = /对手(有|控制)两座以上基地/.test(t);
  if (twoBases) {
    if (combat) {
      e.combatIfTwoBases = combat;
      combat = 0;
    }
    if (authority) {
      e.authorityIfTwoBases = authority;
      authority = 0;
    }
    if (draw) {
      e.drawIfTwoBases = draw;
      draw = 0;
    }
  } else if (enemyTwoBases && combat) {
    e.combatIfEnemyTwoBases = combat;
    combat = 0;
  }
  if (trade) e.trade = trade;
  if (combat) e.combat = combat;
  if (authority) e.authority = authority;
  if (draw) e.draw = draw;
  if (/摧毁目标基地/.test(t)) e.destroyBase = true;
  if (/免费获得/.test(t)) e.acquireCheapFree = { maxCost: grab(t, '不超过\\s*(\\d+)') || 6 };
  if (/销毁交易行/.test(t)) e.scrapRow = grab(t, '(\\d+)\\s*张') || 1;
  if (/等同其费用/.test(t)) e.gainCostCombat = true;
  if (/每销毁一张(?:牌)?(?:便)?获得\s*(\d+)\s*战斗/.test(t)) e.combatPerScrapOwn = Number(RegExp.$1);
  if (/每销毁一张(?:便|牌)?抽\s*(\d+)\s*张牌/.test(t)) e.drawPerScrap = Number(RegExp.$1);
  if (/再抽等量牌/.test(t)) e.recycle = 2;
  if (/每弃一张获得/.test(t)) e.depot = true;
  const discardThenDraw = t.match(/弃\s*(\d+)\s*张牌.*抽/);
  if (discardThenDraw) e.discardThenDraw = Number(discardThenDraw[1]);
  const scrapOwn = t.match(/销毁(手牌|弃牌堆)(?:.*?)(\d+)\s*张/);
  if (scrapOwn) e.scrapOwn = Number(scrapOwn[2]);
  const discardOpponent = t.match(/目标对手弃\s*(\d+)\s*张牌/);
  if (discardOpponent) e.discardOpponent = Number(discardOpponent[1]);
  if (/置于牌库顶/.test(t)) e.topDeckNextAny = true;
  if (/置入手牌/.test(t)) e.nextAcquireToHand = true;
  const combatIfScrap = t.match(/若销毁则获得\s*(\d+)\s*战斗/);
  if (combatIfScrap) e.combatIfScrap = Number(combatIfScrap[1]);
  return e;
}

/** 解析整张卡的卡面（表里没有的卡走这条路）。 */
function parseCardText(text) {
  const out = { primary: null, pc: null, ally: null, doubleAlly: null, optional: null, scrap: null, allAlly: false };
  const raw = String(text || '');
  if (!raw.trim()) return out;
  const segments = raw
    .split(/[。\n；]+/)
    .map(s => s.trim())
    .filter(Boolean);
  for (const seg of segments) {
    let label = 'primary';
    let body = seg;
    const m = seg.match(/^(同盟|双同盟|销毁|可选|选择)\s*[:：]?\s*(.*)$/);
    if (m) {
      label = m[1];
      body = (m[2] || '').trim();
    }
    if (/视为所有阵营的同盟/.test(body)) out.allAlly = true;
    if (label === '选择') {
      const branches = body
        .split(/或|；/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(parseEffect);
      if (!out.pc) out.pc = [];
      for (const br of branches) if (Object.keys(br).length) out.pc.push(br);
      continue;
    }
    const eff = parseEffect(body);
    if (!Object.keys(eff).length) continue;
    if (label === '同盟') out.ally = mergeEff(out.ally, eff);
    else if (label === '双同盟') out.doubleAlly = mergeEff(out.doubleAlly, eff);
    else if (label === '销毁') out.scrap = mergeEff(out.scrap, eff);
    else if (label === '可选') out.optional = mergeEff(out.optional, eff);
    else if (/或/.test(body)) {
      const branches = body
        .split(/或/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(parseEffect);
      if (!out.pc) out.pc = [];
      for (const br of branches) if (Object.keys(br).length) out.pc.push(br);
    } else out.primary = mergeEff(out.primary, eff);
  }
  return out;
}

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
  const teamShared = isTeamShared(mode);
  const emperorMode = mode === 'emperor';
  const anyTeam = teamShared || emperorMode;
  const emperors = Array.isArray(s.emperors) ? s.emperors : [];
  const myTeam = anyTeam ? me.team : null;
  const turn = num(context && context.turn, num(s.turn, 1));
  const aliveCount = Math.max(1, players.filter(p => !p.eliminated).length);
  const myRound = Math.floor((turn - 1) / playerCount) + 1;

  // 剩余回合估计：1v1 一局大约 13–15 个来回，权威墙越厚拖得越久
  const H = clamp(14 - myRound, 1.2, 14);
  const poolSize = Math.max(
    5,
    num(me.deckCount) + (me.hand || []).length + (me.discard || []).length + (me.inPlay || []).length
  );
  const cycleLen = Math.max(1.2, poolSize / 5);
  const reuse = clamp(0.6 + (H - 2) / cycleLen, 1, 3.2);

  const ctx = {
    s,
    players,
    me,
    mode,
    playerId,
    teamShared,
    emperorMode,
    anyTeam,
    myTeam,
    emperors,
    legalActions,
    memory: memory && typeof memory === 'object' ? memory : {},
    H,
    reuse,
    aliveCount,
    targets: [],
    enemies: [],
    myBaseCount: 0,
    myAllyCount: 0,
    myFactions: new Set(),
    playedFactions: new Set(),
    fleetHQBonus: 0,
    empireBonus: 0,
    blobInHand: 0,
    myBlobPlayed: 0,
    anyEnemyBase: false,
    enemyMaxBaseCount: 0,
    bestEnemyBaseValue: 0,
    combatFactor: 1,
    oppProduction: 6,
    authWeight: mode === 'firstBlood' ? 0.5 : 1,
    pendingActions: [],
    focusWall: 0,
    teamPotentialCombat: 0,
    nextTeammate: -1
  };

  /* ---- 队友与「紧接着行动的队友」（整队轮流：同队按座位升序连续行动） ---- */
  const teammates = anyTeam
    ? players.filter(p => p.team === myTeam && p.id !== playerId && !p.eliminated).map(p => p.id).slice().sort((a, b) => a - b)
    : [];
  ctx.teammates = teammates;
  for (const id of teammates) {
    if (id > playerId) {
      ctx.nextTeammate = id;
      break;
    }
  }
  ctx.nextActorIsTeammate = ctx.nextTeammate >= 0;

  /* ---- 我方阵面统计 ---- */
  for (const uid of me.inPlay || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    const def = CARDS[c.copiedFrom && s.cards[c.copiedFrom] ? s.cards[c.copiedFrom].id : c.id];
    if (c.type === 'base') ctx.myBaseCount++;
    if (def && def.a) ctx.myAllyCount++;
    if (def && def.x && def.x.allAlly) ctx.myAllAlly = true;
    if (def && def.x && def.x.fleetHQ) ctx.fleetHQBonus++;
    if (def && def.x && def.x.empireShipBonus) ctx.empireBonus += def.x.empireShipBonus;
    (c.factions || []).forEach(f => ctx.myFactions.add(f));
  }
  for (const uid of me.playedThisTurn || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    (c.factions || []).forEach(f => ctx.playedFactions.add(f));
    if (c.faction === 'blob') ctx.myBlobPlayed++;
  }
  for (const uid of me.hand || []) {
    const c = s.cards && s.cards[uid];
    if (!c) continue;
    if (c.faction === 'blob') ctx.blobInHand++;
  }

  /* ---- 权威口径：一律读个人权威（共享权威的队伍模式里引擎会同步到每个队员） ---- */
  const authorityOf = pid => {
    const p = players[pid];
    return p ? num(p.authority) : 0;
  };
  ctx.authorityOf = authorityOf;

  /* ---- 前哨墙口径：与引擎 teamHasOutpost / canAttackBase 一致 ----
   * 共享权威的队伍模式（team2v2 / hydra3）：整队有一座前哨则全队受保护；
   * 大将战 / 混战 / 猎杀：只看本人自己的前哨。 */
  const outpostsOf = pid => {
    const owner = players[pid];
    if (!owner) return [];
    const group = teamShared ? players.filter(p => p.team === owner.team) : [owner];
    const out = [];
    for (const member of group) {
      for (const uid of member.inPlay || []) {
        const c = s.cards && s.cards[uid];
        if (!c || c.type !== 'base' || !c.outpost) continue;
        out.push({
          uid,
          owner: member.id,
          defense: num(c.defense, 4),
          damage: num(s.damage && s.damage[uid]),
          info: cardInfo(ctx, uid)
        });
      }
    }
    return out;
  };
  ctx.outpostsOf = outpostsOf;

  /* ---- 可打目标：一律以 legalActions 给出的 attack.targetId 为准 ---- */
  const attackPlayerIds = new Set();
  for (const a of legalActions) {
    if (a && a.type === 'attack' && a.targetType === 'player') attackPlayerIds.add(a.targetId);
  }
  ctx.attackPlayerIds = attackPlayerIds;

  for (const p of players) {
    if (p.id === playerId || p.eliminated) continue;
    const outposts = outpostsOf(p.id);
    const wallRemaining = outposts.reduce((sum, o) => sum + Math.max(0, o.defense - o.damage), 0);
    let baseCount = 0;
    for (const uid of p.inPlay || []) {
      const c = s.cards && s.cards[uid];
      if (!c || c.type !== 'base') continue;
      baseCount++;
      ctx.anyEnemyBase = true;
      const info = cardInfo(ctx, uid);
      if (!info) continue;
      const val = perTurnValue(ctx, info, false);
      if (val > ctx.bestEnemyBaseValue) ctx.bestEnemyBaseValue = val;
    }
    if (baseCount > ctx.enemyMaxBaseCount) ctx.enemyMaxBaseCount = baseCount;
    ctx.enemies.push({
      id: p.id,
      player: p,
      authority: authorityOf(p.id),
      handCount: num(p.handCount),
      outposts,
      wallRemaining,
      hasOutpost: outposts.length > 0,
      isEmperor: emperors.indexOf(p.id) >= 0,
      attackable: attackPlayerIds.has(p.id),
      team: p.team
    });
  }
  ctx.targets = ctx.enemies.filter(e => e.attackable);

  /* ---- 本回合战斗的「去处」 ---- */
  let handCombat = 0;
  for (const uid of me.hand || []) {
    const info = cardInfo(ctx, uid);
    if (!info) continue;
    const eff = bestEffect(ctx, info);
    handCombat +=
      num(eff && eff.combat) +
      num(eff && eff.combatIfEnemyBase) +
      num(eff && eff.combatIfTwoBases) +
      num(eff && eff.combatIfEnemyTwoBases);
  }
  ctx.potentialCombat = num(me.combat) + handCombat;

  // 团队模式：整队轮流，伤害到队末才清零 → 全队的战斗预算是同一道墙的接力棒
  let teamPotential = ctx.potentialCombat;
  for (const id of teammates) {
    const mate = players[id];
    if (!mate) continue;
    teamPotential += num(mate.combat) + num(mate.handCount) * 0.9;
  }
  ctx.teamPotentialCombat = teamPotential;

  // 焦点敌人：优先「能被我打到」且权威最低的那个
  const focus = ctx.enemies
    .slice()
    .sort((a, b) => (a.attackable === b.attackable ? a.authority - b.authority : a.attackable ? -1 : 1))[0];
  ctx.focus = focus || null;
  ctx.focusWall = focus ? focus.wallRemaining : 0;

  let factor = 1;
  if (focus && focus.hasOutpost) {
    const breakable = ctx.potentialCombat >= focus.wallRemaining;
    if (!breakable) factor = teamShared ? 0.55 : 0.25;
  }
  ctx.combatFactor = clamp(factor, 0.2, 1);

  /* ---- 对手每回合战斗估计（评估自家前哨墙的防御价值） ---- */
  let oppProd = 0;
  for (const e of ctx.enemies) {
    const group = teamShared ? players.filter(p => p.team === e.team) : [e.player];
    let v = 0;
    for (const member of group) {
      for (const uid of member.inPlay || []) {
        const info = cardInfo(ctx, uid);
        if (!info || info.view.type !== 'base') continue;
        v += perTurnValue(ctx, info, false);
      }
    }
    v += num(e.player.handCount) * 0.8;
    if (v > oppProd) oppProd = v;
  }
  ctx.oppProduction = Math.max(4, oppProd);

  ctx.pendingActions = s.pending ? legalActions.slice() : [];
  return ctx;
}

/* ------------------------------------------------------------------ *
 * 卡牌信息（表优先，文本兜底）
 * ------------------------------------------------------------------ */

function cardInfo(ctx, uid) {
  const view = ctx.s.cards && ctx.s.cards[uid];
  if (!view) return null;
  const baseId = view.copiedFrom && ctx.s.cards[view.copiedFrom] ? ctx.s.cards[view.copiedFrom].id : view.id;
  const def = CARDS[baseId] || null;
  const parsed = def ? null : parseCardText(view.text);
  return {
    uid,
    view,
    def,
    parsed,
    id: baseId,
    isBase: view.type === 'base',
    cost: num(view.cost, def && def.c !== undefined ? def.c : 0),
    defense: num(view.defense, def && def.d !== undefined ? def.d : 0),
    outpost: !!view.outpost,
    faction: view.faction,
    factions: Array.isArray(view.factions) ? view.factions : []
  };
}

/** 取某个效果槽（primary / ally / doubleAlly / optional / scrap / pc）。 */
function effOf(info, slot) {
  if (!info) return null;
  if (info.def) {
    if (slot === 'pc') return info.def.pc || null;
    if (slot === 'primary') return info.def.p || null;
    if (slot === 'ally') return info.def.a || null;
    if (slot === 'doubleAlly') return info.def.da || null;
    if (slot === 'optional') return info.def.op || null;
    if (slot === 'scrap') return info.def.s || null;
    return null;
  }
  const p = info.parsed;
  if (!p) return null;
  if (slot === 'pc') return p.pc || null;
  if (slot === 'primary') return p.primary || null;
  if (slot === 'ally') return p.ally || null;
  if (slot === 'doubleAlly') return p.doubleAlly || null;
  if (slot === 'optional') return p.optional || null;
  if (slot === 'scrap') return p.scrap || null;
  return null;
}

/** 卡牌本身的基础信息（费用/防御/前哨）取自可见字段，缺失时用表补齐。 */
function cardCost(info) {
  if (!info) return 0;
  if (typeof info.view.cost === 'number') return info.view.cost;
  return info.def && info.def.c !== undefined ? num(info.def.c) : 0;
}
function cardDefense(info) {
  if (!info) return 0;
  if (typeof info.view.defense === 'number') return info.view.defense;
  return info.def && info.def.d !== undefined ? num(info.def.d) : 0;
}

/* ------------------------------------------------------------------ *
 * 估值基元
 * ------------------------------------------------------------------ */

/** 一个效果折算成「战斗等价点」。future=true 表示按未来多轮收益估值。 */
function effectValue(ctx, eff, opt) {
  if (!eff) return 0;
  const o = opt || {};
  const future = !!o.future;
  const cf = future ? 1 : ctx.combatFactor;
  let v = 0;
  if (eff.trade) v += eff.trade * W.trade;
  if (eff.combat) v += eff.combat * W.combat * cf;
  if (eff.authority) v += eff.authority * W.authority * ctx.authWeight;
  if (eff.draw) v += eff.draw * W.draw;
  if (eff.combatIfEnemyBase && ctx.anyEnemyBase) v += eff.combatIfEnemyBase * W.combat * cf;
  if (eff.combatIfTwoBases && ctx.myBaseCount >= 2) v += eff.combatIfTwoBases * W.combat * cf;
  if (eff.combatIfEnemyTwoBases && ctx.enemyMaxBaseCount >= 2) v += eff.combatIfEnemyTwoBases * W.combat * cf;
  if (eff.authorityIfTwoBases && ctx.myBaseCount >= 2) v += eff.authorityIfTwoBases * W.authority * ctx.authWeight;
  if (eff.drawIfTwoBases && ctx.myBaseCount >= 2) v += eff.drawIfTwoBases * W.draw;
  if (eff.drawIfThreeBases && ctx.myBaseCount >= 3) v += eff.drawIfThreeBases * W.draw;
  if (eff.authorityIfThreeBases && ctx.myBaseCount >= 3) v += eff.authorityIfThreeBases * W.authority * ctx.authWeight;
  if (eff.drawBlobPlayed) v += (ctx.myBlobPlayed + ctx.blobInHand) * W.draw;
  if (eff.combatPerScrapOwn) v += eff.combatPerScrapOwn * (num(ctx.me.scrappedThisTurn) + 1) * W.combat * cf;
  if (eff.discardOpponent) v += eff.discardOpponent * (future ? 0.8 : 1.1);
  if (eff.scrapRow) v += eff.scrapRow * 1.3;
  if (eff.destroyBase) v += ctx.bestEnemyBaseValue * 0.7;
  if (eff.destroyAndOrScrap) v += ctx.bestEnemyBaseValue * 0.4 + 1.2;
  if (eff.acquireFreeMax !== undefined) v += 2.4;
  if (eff.acquireShipFree) v += 2.4;
  if (eff.acquireCheapFree) v += 2.0;
  if (eff.topDeckNextShip || eff.topDeckNextAny || eff.topDeckNextBase) v += 0.7;
  if (eff.nextAcquireToHand) v += 1.1;
  if (eff.drawPerScrap) v += eff.drawPerScrap * W.draw;
  if (eff.discardThenDraw) v += 0.9;
  if (eff.depot) v += 1.2;
  if (eff.recycle) v += 1.2;
  if (eff.combatIfScrap) v += eff.combatIfScrap * W.combat * cf;
  if (eff.gainCostCombat) v += 1.3;
  if (eff.scrapOwnMandatory) v -= 0.9 * num(eff.scrapOwnMandatory);
  return v;
}

/** 打出瞬间引擎真正结算的字段（applySimpleEffect 的口径）。 */
function playEffectValue(ctx, eff) {
  if (!eff) return 0;
  let v = 0;
  if (eff.trade) v += eff.trade * W.trade;
  if (eff.combat) v += eff.combat * W.combat * ctx.combatFactor;
  if (eff.authority) v += eff.authority * W.authority * ctx.authWeight;
  if (eff.draw) v += eff.draw * W.draw;
  if (eff.combatIfEnemyBase && ctx.anyEnemyBase) v += eff.combatIfEnemyBase * W.combat * ctx.combatFactor;
  if (eff.combatIfTwoBases && ctx.myBaseCount >= 2) v += eff.combatIfTwoBases * W.combat * ctx.combatFactor;
  if (eff.combatIfEnemyTwoBases && ctx.enemyMaxBaseCount >= 2) v += eff.combatIfEnemyTwoBases * W.combat * ctx.combatFactor;
  if (eff.authorityIfTwoBases && ctx.myBaseCount >= 2) v += eff.authorityIfTwoBases * W.authority * ctx.authWeight;
  if (eff.drawIfTwoBases && ctx.myBaseCount >= 2) v += eff.drawIfTwoBases * W.draw;
  if (eff.drawIfThreeBases && ctx.myBaseCount >= 3) v += eff.drawIfThreeBases * W.draw;
  if (eff.authorityIfThreeBases && ctx.myBaseCount >= 3) v += eff.authorityIfThreeBases * W.authority * ctx.authWeight;
  if (eff.drawBlobPlayed) v += (ctx.myBlobPlayed + ctx.blobInHand) * W.draw;
  if (eff.combatPerScrapOwn && num(ctx.me.scrappedThisTurn)) v += eff.combatPerScrapOwn * num(ctx.me.scrappedThisTurn) * W.combat * ctx.combatFactor;
  if (eff.discardOpponent) v += eff.discardOpponent * 1.1;
  if (eff.topDeckNextShip || eff.topDeckNextAny || eff.topDeckNextBase) v += 0.7;
  if (eff.nextAcquireToHand) v += 1.1;
  return v;
}

/** 卡片主要能力里最值钱的一个选项。 */
function bestEffect(ctx, info) {
  const branches = effOf(info, 'pc');
  if (!branches || !branches.length) return effOf(info, 'primary');
  let best = null;
  let bestVal = -Infinity;
  for (const eff of branches) {
    const val = effectValue(ctx, eff, { future: true });
    if (val > bestVal) {
      bestVal = val;
      best = eff;
    }
  }
  return best || branches[0];
}

/** 这张牌的同盟能力是否已经就绪（场上有同阵营牌，或有「视为所有阵营的同盟」）。 */
function allyReady(ctx, uid, info) {
  const inPlay = ctx.me.inPlay || [];
  const factions = info.factions || [];
  for (const otherUid of inPlay) {
    if (otherUid === uid) continue;
    const other = ctx.s.cards && ctx.s.cards[otherUid];
    if (!other) continue;
    const otherDef = CARDS[other.copiedFrom && ctx.s.cards[other.copiedFrom] ? ctx.s.cards[other.copiedFrom].id : other.id];
    if (otherDef && otherDef.x && otherDef.x.allAlly) return true;
    const otherFactions = Array.isArray(other.factions) ? other.factions : [];
    if (factions.some(f => otherFactions.indexOf(f) >= 0)) return true;
  }
  return false;
}

/** 基地每回合能产出的价值（引擎价值，可持续到游戏结束）。 */
function perTurnValue(ctx, info, includeAlly) {
  if (!info) return 0;
  let v = 0;
  const branches = effOf(info, 'pc');
  if (branches && branches.length) {
    for (const eff of branches) v = Math.max(v, effectValue(ctx, eff, { future: true }));
  } else {
    v = effectValue(ctx, effOf(info, 'primary'), { future: true });
  }
  const def = info.def;
  if (def && def.x && def.x.fleetHQ) v += 2.2;
  if (def && def.x && def.x.empireShipBonus) v += def.x.empireShipBonus * 0.9;
  if (includeAlly !== false) {
    const ally = effOf(info, 'ally');
    if (ally && allyReady(ctx, info.uid, info)) v += effectValue(ctx, ally, { future: true }) * 0.8;
  }
  return v;
}

/** 自家前哨墙的防御价值：替我方挡下的伤害 ≈ min(防御值, 对手每回合战斗)。 */
function wallValue(ctx, info) {
  if (!info || !info.outpost) return 0;
  const defense = cardDefense(info);
  return Math.min(defense, ctx.oppProduction) * 0.85;
}

/** 摧毁敌方基地的价值：断掉它的产能 + 拆墙后打开的权威通道。 */
function baseKillValue(ctx, uid) {
  const info = cardInfo(ctx, uid);
  if (!info) return 0;
  const owner = ctx.players[info.view.owner];
  if (!owner) return 0;
  const denial = perTurnValue(ctx, info, true) * ctx.H * 0.45;
  let unlock = 1;
  if (info.outpost) {
    const wall = ctx.outpostsOf(owner.id);
    const others = wall.length - 1;
    unlock = others <= 0 ? 18 : 3 + cardDefense(info) * 0.4;
  }
  return denial + unlock;
}

/** 某张牌的价值（用于弃牌/销毁排序）。 */
function cardSalvage(ctx, uid, zone, opts) {
  const o = opts || {};
  const info = cardInfo(ctx, uid);
  if (!info) return 0.5;
  // 探索者销毁后会回到供应池，但要重新买回仍要 2 贸易，因此按「循环收益 − 重购成本」计
  if (info.id === 'explorer') return Math.max(1.5, 2 * ctx.reuse - 2);
  if (info.isBase) {
    const per = perTurnValue(ctx, info, true);
    return per * ctx.H * 0.8 + wallValue(ctx, info);
  }
  let v = 0;
  if (o.played) {
    // 场上已打出的飞船：主要能力已经结算，只剩同盟/销毁之类的后续价值
    v = effectValue(ctx, effOf(info, 'ally'), { future: true }) * 0.5;
  } else {
    v = effectValue(ctx, bestEffect(ctx, info), { future: true });
    const ally = effOf(info, 'ally');
    if (ally) v += effectValue(ctx, ally, { future: true }) * 0.5;
  }
  const factor = zone === 'discard' ? 0.5 : 1;
  return Math.max(0.3, v * 0.8 * factor);
}

/** 我手里/弃牌堆里这张牌在哪个区。 */
function zoneOf(ctx, uid) {
  const me = ctx.me;
  if ((me.hand || []).indexOf(uid) >= 0) return 'hand';
  if ((me.inPlay || []).indexOf(uid) >= 0) return 'inPlay';
  return 'discard';
}

/** 买下这张牌值多少（已扣掉贸易成本）。 */
function buyWorth(ctx, info) {
  if (!info) return -1;
  const cost = cardCost(info);
  if (info.isBase) {
    const per = perTurnValue(ctx, info, false);
    let v = per * Math.max(0.6, ctx.H - 2);
    v += wallValue(ctx, info);
    if (info.def && info.def.x && info.def.x.allAlly) v += 1.5 * ctx.myAllyCount;
    if (info.def && info.def.x && info.def.x.toHandIfFaction && ctx.playedFactions.has(info.def.x.toHandIfFaction)) v += 1.2;
    return v - cost * W.trade;
  }
  let v = effectValue(ctx, bestEffect(ctx, info), { future: true });
  const ally = effOf(info, 'ally');
  if (ally) v += effectValue(ctx, ally, { future: true }) * 0.6;
  if (info.def && info.def.x && info.def.x.toHandIfFaction && ctx.playedFactions.has(info.def.x.toHandIfFaction)) v *= 1.25;
  v *= ctx.reuse;
  return v - cost * W.trade;
}

/* ------------------------------------------------------------------ *
 * 各动作评分
 * ------------------------------------------------------------------ */

function scorePlay(ctx, a) {
  const info = cardInfo(ctx, a.cardId);
  if (!info) return 0;
  // 隐匿针舰 / 隐匿尖塔：打出的其实是「被复制那张牌」的能力
  let effInfo = info;
  if (a.copy && ctx.s.cards[a.copy]) {
    const copied = cardInfo(ctx, a.copy);
    if (copied) effInfo = copied;
  }
  let v = 0;
  if (!effInfo.isBase) {
    const branches = effOf(effInfo, 'pc');
    const eff = branches && branches.length ? branches[num(a.choice, 0)] || branches[0] : effOf(effInfo, 'primary');
    v += playEffectValue(ctx, eff);
    const card = ctx.s.cards[a.cardId];
    const factions = card && Array.isArray(card.factions) ? card.factions : [];
    const copiedCard = a.copy && ctx.s.cards[a.copy] ? ctx.s.cards[a.copy] : null;
    const merged = copiedCard && Array.isArray(copiedCard.factions) ? factions.concat(copiedCard.factions) : factions;
    // 舰队总部：每打出一艘飞船 +1 战斗
    if (ctx.fleetHQBonus) v += ctx.fleetHQBonus * W.combat * ctx.combatFactor;
    // 指挥中心：此后每打出一艘星际帝国飞船 +2 战斗
    if (ctx.empireBonus && merged.indexOf('empire') >= 0) v += ctx.empireBonus * W.combat * ctx.combatFactor;
    if (a.row !== undefined) {
      const rowInfo = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[a.row]);
      if (rowInfo) {
        const eff2 = effOf(effInfo, 'primary');
        if (eff2 && eff2.scrapRowGainCostCombat) {
          // 销毁交易行牌并获得等同于其费用的战斗
          v += cardCost(rowInfo) * W.combat * ctx.combatFactor + buyWorth(ctx, rowInfo) * 0.45 + 0.6;
        } else {
          v += buyWorth(ctx, rowInfo) * 0.85 + 1;
        }
      }
    }
  } else {
    // 基地 = 长期引擎：主要能力每回合都能重复触发，按剩余回合折算
    const per = perTurnValue(ctx, effInfo, false);
    v += per * ctx.H * 0.85;
    v += wallValue(ctx, effInfo);
    if (effInfo.def && effInfo.def.x && effInfo.def.x.allAlly) v += 1.5 * ctx.myAllyCount;
  }
  return v;
}

function scoreAbility(ctx, a) {
  const info = cardInfo(ctx, a.cardId);
  if (!info) return -1;
  const kind = a.ability;

  if (kind === 'primary') {
    const branches = effOf(info, 'pc');
    if (branches && branches.length) {
      const eff = branches[num(a.choice, 0)] || branches[0];
      if (eff && eff.recycle) {
        const targets = a.targets || [];
        const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
        return targets.length * W.draw - lost + 0.2;
      }
      // 常规资源型主要能力：其长期收益已在「打出基地」时按剩余回合计入，
      // 这里只留一个很小的正向项，保证引擎每回合都会被触发而不重复计价。
      return 0.25;
    }
    const p = effOf(info, 'primary') || {};
    if (p.scrapOwn) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      const draw = p.drawPerScrap ? targets.length * W.draw : 0;
      const combat = p.gainCostCombat ? targets.reduce((sum, t) => sum + cardCost(cardInfo(ctx, t)), 0) * W.combat * ctx.combatFactor : 0;
      return draw + combat - lost + 0.2;
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
    const opt = effOf(info, 'optional');
    if (!opt) return -1;
    if (opt.scrapRow) {
      const rows = a.rows || (a.row !== undefined ? [a.row] : []);
      let v = 0;
      for (const r of rows) {
        const rowInfo = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[r]);
        v += rowInfo ? buyWorth(ctx, rowInfo) * 0.6 + 0.8 : 1;
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
    // double:true 的双同盟用另一套效果键
    const eff = a.double ? effOf(info, 'doubleAlly') || effOf(info, 'ally') : effOf(info, 'ally');
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
      if (a.row !== undefined) {
        const rowInfo = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[a.row]);
        v += rowInfo ? buyWorth(ctx, rowInfo) * 0.5 + 0.6 : 0.6;
      }
      return v;
    }
    if (eff.acquireShipFree || eff.acquireCheapFree) {
      const rowInfo = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[a.row]);
      if (rowInfo) return buyWorth(ctx, rowInfo) * 0.85 + 1.2;
      return 2.0;
    }
    if (eff.discardThenDraw) {
      const targets = a.targets || [];
      const lost = targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
      return targets.length * W.draw - lost + 0.2;
    }
    if (eff.scrapRow) {
      const rows = a.rows || (a.row !== undefined ? [a.row] : []);
      let v = 0;
      for (const r of rows) {
        const rowInfo = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[r]);
        v += rowInfo ? buyWorth(ctx, rowInfo) * 0.6 + 0.8 : 1;
      }
      return v;
    }
    return effectValue(ctx, eff) + 0.2;
  }

  if (kind === 'scrap') {
    const eff = effOf(info, 'scrap');
    if (!eff) return -1;
    let v = effectValue(ctx, eff);
    if (eff.destroyBase && a.targetId) v += baseKillValue(ctx, a.targetId) * 0.8;
    if (a.targetId === null || a.targetId === undefined) v += 0.3; // 只销毁自身
    return v - cardSalvage(ctx, a.cardId, 'inPlay', { played: true });
  }

  return -1;
}

function scoreBuy(ctx, a) {
  if (a.explorer) {
    // 探索者：2 贸易买一张可反复循环的 +2 贸易牌
    const gain = 2 * W.trade * ctx.reuse + 0.8;
    return gain - 2 * W.trade;
  }
  const info = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[a.row]);
  if (!info) return -1;
  return buyWorth(ctx, info);
}

function scoreAttack(ctx, a) {
  if (a.targetType === 'base') {
    const info = cardInfo(ctx, a.targetId);
    if (!info) return -1;
    const needed = Math.max(1, cardDefense(info) - num(ctx.s.damage && ctx.s.damage[a.targetId]));
    if (a.amount >= needed) return baseKillValue(ctx, a.targetId) + 1;
    // 打不穿：非团队模式下伤害回合末清零 → 纯浪费；团队模式下伤害到队末才清零，
    // 队友可以接着打同一座墙 → 部分伤害是有效进度。
    if (ctx.teamShared) {
      const wallLeft = Math.max(0, needed - a.amount);
      const reachable = ctx.teamPotentialCombat >= wallLeft;
      return reachable ? a.amount * 0.6 : a.amount * 0.15;
    }
    return -6;
  }
  const pid = a.targetId;
  const enemy = ctx.enemies.find(e => e.id === pid);
  const auth = enemy ? enemy.authority : ctx.authorityOf(pid);
  if (a.amount >= auth && auth > 0) {
    if (ctx.mode === 'firstBlood') {
      // 猎杀·先血：首位玩家败北时其右手边玩家立即获胜 → 只有我能赢才动手
      const winner = nextAlive(ctx.players, pid, -1);
      return winner === ctx.playerId ? TIER.LETHAL : -40;
    }
    if (ctx.emperorMode) {
      // 大将战：大将被击败才判该队失败；提督阵亡只是解锁敌方大将
      if (enemy && enemy.isEmperor) return TIER.LETHAL;
      return 160;
    }
    if (ctx.teamShared) return TIER.LETHAL; // 共享权威的队伍：权威归零即全队出局
    return ctx.aliveCount === 2 ? TIER.LETHAL : 120;
  }
  let v = a.amount * W.combat;
  if (auth - a.amount <= ctx.potentialCombat) v += 3; // 下一击就能淘汰
  if (ctx.emperorMode && enemy) {
    // 大将战只有打敌方大将才算推进胜利；打提督只是解锁通道
    v = enemy.isEmperor ? a.amount * 1.2 : a.amount * 0.4;
    if (enemy.isEmperor && auth - a.amount <= ctx.potentialCombat) v += 6;
  } else if (enemy && ctx.focus && enemy.id === ctx.focus.id) {
    v += 0.6;
  }
  return v;
}

/** 队友预留（transfer）：只在共享权威的队伍模式里存在。 */
function scoreTransfer(ctx, a) {
  if (!ctx.teamShared) return -1;
  const mate = ctx.players[a.targetId];
  if (!mate || mate.eliminated) return -1;
  const amount = num(a.amount, 0);
  if (amount <= 0) return -1;
  const actsNext = ctx.nextActorIsTeammate && ctx.nextTeammate === a.targetId;
  if (a.resource === 'trade') {
    // 贸易只有当我自己花不掉时才转给队友
    let bestCost = Infinity;
    for (const act of ctx.legalActions) {
      if (act.type !== 'buy') continue;
      if (act.explorer) {
        bestCost = Math.min(bestCost, 2);
        continue;
      }
      const info = cardInfo(ctx, ctx.s.tradeRow && ctx.s.tradeRow[act.row]);
      if (info) bestCost = Math.min(bestCost, cardCost(info));
    }
    const surplus = num(ctx.me.trade) - (bestCost === Infinity ? 0 : bestCost);
    if (surplus < 1) return -1;
    // 紧接着行动的队友会立刻收到这笔贸易 → 可以马上买牌，价值更高
    return Math.min(amount, surplus) * (actsNext ? 1.15 : 0.85);
  }
  // 战斗：打不出去时才给队友（队友的预留会在他回合开始时到账）
  const hasAttack = ctx.legalActions.some(x => x.type === 'attack');
  if (hasAttack) {
    // 我自己也能打：只有当「全队打不穿墙、需要接力」时转给下一位队友才划算
    const wall = ctx.focusWall;
    if (!wall || ctx.potentialCombat >= wall) return amount * 0.4;
    return actsNext ? amount * 0.85 : amount * 0.45;
  }
  return amount * (actsNext ? 1.0 : 0.6);
}

/** 大将战专属：花 1 贸易把弃牌堆的一张牌交给队内相邻队友。 */
function scoreMoveCard(ctx, a) {
  if (ctx.mode !== 'emperor') return -1;
  if (num(ctx.me.trade) < 2) return -1; // 贸易紧张时不折腾
  const info = cardInfo(ctx, a.cardId);
  if (!info) return -1;
  const worth = cardSalvage(ctx, a.cardId, 'discard');
  if (worth < 2) return -1;
  // 队友拿到的是弃牌堆里的牌，价值有限；只在贸易明显盈余时作为兜底动作
  return 0.4;
}

/* ------------------------------------------------------------------ *
 * 待决选择：强制弃牌 / 强制销毁 / 指定弃牌目标 / 事件选择
 * ------------------------------------------------------------------ */

function nextAlive(players, from, dir) {
  for (let step = 1; step <= players.length; step++) {
    const idx = (from + dir * step + players.length * 2) % players.length;
    if (players[idx] && !players[idx].eliminated) return idx;
  }
  return null;
}

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
      const enemy = ctx.emperors.indexOf(a.targetId) >= 0 ? 1.5 : 1;
      const val = (num(p.handCount) * 1.2 + num(p.authority) / 25) * enemy;
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
      let cost;
      if (a.pay) {
        cost = 6 * W.authority;
      } else {
        cost = cardSalvage(ctx, a.baseId, 'inPlay');
        const info = cardInfo(ctx, a.baseId);
        // 拆掉自己的前哨会打开对面的直伤通道
        if (info && info.outpost) cost *= 1.3;
      }
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

  // 未知事件：挑一个「看起来代价最小」的分支
  let best = acts[0];
  let bestVal = Infinity;
  for (const a of acts) {
    let cost = 0;
    if (a.pay) cost += num(a.pay, 6) * W.authority;
    if (a.targets) cost += a.targets.reduce((sum, t) => sum + cardSalvage(ctx, t, zoneOf(ctx, t)), 0);
    if (a.cards) cost += a.cards.reduce((sum, t) => sum + cardSalvage(ctx, t, 'hand'), 0);
    if (a.baseId) cost += cardSalvage(ctx, a.baseId, 'inPlay');
    if (cost < bestVal) {
      bestVal = cost;
      best = a;
    }
  }
  return best;
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
        case 'moveCard': {
          const v = scoreMoveCard(ctx, action);
          if (v > 0) score = v; // 低于其它层级，只作为结束回合前的兜底动作
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
