// 策略名称：破垒夺权（Breach the Wall, Seize Authority）
// 选择理由：前哨基地是引擎里唯一挡得住权威伤害的护盾——先立前哨护住自己，再用「当回合打光防御值」拆掉对方前哨打开权威伤害通道，最后把当回合必定清零的战斗与贸易全额兑现成权威伤害。
// 本轮更新：按 2026-11-08 版程序更新第 1–6 节适配——7 种模式（新增 hydra3 / emperor）、6 个牌包（新增 frontiers / crisisFleets / crisisBases）、整队轮流与队末清算的伤害口径、大将个人血线与 moveCard、double:true 同盟与 choice/row/targets 新动作方言，并给未知卡加 text 通用估值兜底。

/**
 * 零依赖 ESM 模块：只使用引擎注入的 view / legalActions / playerId / random / memory / context。
 * chooseAction 始终返回 legalActions 数组中的某个原始对象引用，不修改 view / legalActions，不对原数组 sort。
 *
 * 估值口径（单位 VP：1 VP ≈ 1 点权威伤害，权威即血线）：
 *   战斗 → 权威伤害是唯一的胜负货币：通道打开时 1 战斗 = 1 VP；通道被前哨堵死时只能用来砸墙，给 0.6 VP。
 *   权威 = 血线，价值由赛跑差值决定（落后时每点血线都值钱）。
 *   贸易 = 当回合就会清零的货币，只能当回合花：1 贸易 ≈ 1.4 VP。
 *   抽牌 ≈ 2.5 VP，迫使对手弃牌 ≈ 2.6 VP。
 */

export const meta = {
  name: 'MiniMax M3.1flash · 破垒夺权',
  description:
    'minimax-m3.1-flash｜破垒夺权｜前哨是引擎里唯一挡得住权威伤害的护盾：先立前哨护住自己，' +
    '再当回合打光防御值拆掉对方前哨打开权威伤害通道，把当回合清零的战斗与贸易全额兑现成权威伤害；' +
    '本版按 2026-11-08 版程序适配 7 模式 / 6 牌包 / 整队轮流 / 大将战。'
};

/* ══════════════════════════════════════════════════════════════════════════
 * 一、卡牌效果表
 *   p  = 主要能力   pc = 主要能力二选一   al = 同盟能力   dal = 双同盟能力
 *   sc = 销毁能力   opt = 可选能力
 *   资源键：t 贸易 / c 战斗 / a 权威 / d 抽牌 / den 迫使对手弃牌
 *   特殊键：combatIfEnemyBase 对手有基地时额外战斗 / combatIfTwoBases 我方两座基地时额外战斗
 *     combatIfEnemyTwoBases 场上有人有两座基地时额外战斗 / authorityIfTwoBases 我方两座基地时额外权威
 *     drawIfTwoBases 两座基地时抽牌 / drawIfThreeBases 三座基地时抽牌 / authorityIfThreeBases 三座基地时额外权威
 *     drawBlobPlayed 每打出一张虫群牌便抽一张 / scrapOwn 销毁己方牌 / drawPerScrap 每销毁一张抽一张
 *     scrapOwnMandatory 抽牌后强制销毁手牌 / discardThenDraw 弃一张抽一张 / depot 弃牌换资源
 *     recycle 弃牌回收抽牌 / acquireFreeMax 免费获得不高于该费用的牌 / destroyBase 摧毁目标基地
 *     destroyAndOrScrap 摧毁基地并/或拆交易行 / scrapRow 销毁交易行牌 / scrapRowGainCostCombat 拆交易行换战斗
 *     gainCostCombat 销毁的牌按费用换战斗 / combatIfScrap 销毁后额外战斗 / combatPerScrapOwn 每销毁一张换战斗
 *     topDeckNextShip 下一艘飞船置牌库顶 / topDeckNextBase 下一座基地置牌库顶
 *     topDeckNextAny 下一张牌置牌库顶 / nextAcquireToHand 下一张获得的牌置入手牌
 *     acquireShipFree 免费获得飞船 / acquireCheapFree 免费获得不高于该费用的牌
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
  moonwurm: { p: { c: 8, d: 1 }, al: { acquireCheapFree: { maxCost: 2, toHand: 1 } } },
  theWrecker: { p: { c: 6 }, al: { d: 1 }, opt: { scrapOwn: 2 } },
  emperorsDreadnaught: { p: { c: 8, d: 1, den: 1 }, flags: ['toHandIfFaction:empire'] },
  factoryWorld: { p: { t: 3, nextAcquireToHand: 1 } },
  leviathan: { p: { c: 9, d: 1 }, al: { acquireCheapFree: { maxCost: 3, toHand: 1 } }, opt: { destroyBase: 1 } },
  theIncinerator: { p: { scrapOwn: 2 }, al: { combatPerScrapOwn: 2 } },

  // ── 边疆（frontiers）──
  fr_blobAlpha: { p: { c: 10 } },
  fr_blobMiner: { p: { t: 3 }, opt: { scrapRow: 1 }, sc: { c: 2 } },
  fr_burrower: { p: { c: 5 }, al: { d: 1 }, sc: { acquireFreeMax: 4 } },
  fr_crusher: { p: { c: 6 }, al: { t: 2 } },
  fr_hiveQueen: { p: { c: 7, d: 1 }, al: { c: 3 }, dal: { c: 3 } },
  fr_infestedMoon: { p: { c: 4 }, al: { d: 1 }, dal: { d: 1 } },
  fr_moonwurmHatchling: { pc: [{ t: 3 }, { destroyBase: 1 }], al: { c: 3 } },
  fr_nestingGround: { p: { t: 2 }, al: { c: 4 } },
  fr_pulverizer: { p: { scrapRowGainCostCombat: 1 }, al: { d: 1 } },
  fr_spikeCluster: { p: { c: 2 }, al: { t: 1 } },
  fr_stinger: { p: { c: 3 }, al: { c: 3 }, sc: { t: 1 } },
  fr_swarmCluster: { p: { c: 5 }, al: { c: 3 }, dal: { c: 3 } },
  fr_builderBot: { p: { t: 1 }, opt: { scrapOwn: 1 }, al: { t: 1 }, sc: { c: 2 } },
  fr_conversionYard: { opt: { scrapOwn: 1, combatIfScrap: 4 } },
  fr_defenseSystem: { p: { c: 2 }, al: { c: 2 } },
  fr_destroyerBot: { p: { c: 5 }, opt: { scrapOwn: 1 } },
  fr_enforcerMech: { p: { c: 5 }, opt: { scrapOwn: 1 }, al: { destroyBase: 1 }, sc: { d: 1 } },
  fr_integrationPort: { p: { t: 1 } },
  fr_nanobotSwarm: { p: { c: 5, d: 2 }, opt: { scrapOwn: 2 } },
  fr_neuralNexus: { p: { scrapOwn: 1, gainCostCombat: 1 }, al: { d: 1 } },
  fr_plasmaBot: { p: { c: 3 }, opt: { scrapOwn: 1 }, al: { c: 2 } },
  fr_reclamationStation: { p: { scrapOwn: 1 }, sc: { combatPerScrapOwn: 3 } },
  fr_capturedOutpost: { p: { discardThenDraw: 1 } },
  fr_cargoCraft: { p: { t: 2, den: 1 }, al: { c: 4 } },
  fr_farmShip: { p: { t: 3, discardThenDraw: 1 }, sc: { c: 4 } },
  fr_frontierHawk: { p: { c: 3, discardThenDraw: 1 } },
  fr_hammerhead: { p: { c: 3, d: 1, den: 1 }, al: { d: 1 } },
  fr_imperialFlagship: { p: { c: 7, d: 2 }, al: { den: 1 } },
  fr_jammingTerminal: { p: { c: 2, den: 1 } },
  fr_lightCruiser: { p: { c: 4, den: 1 }, al: { c: 2 }, dal: { d: 1 } },
  fr_orbitalGunPlatform: { p: { c: 3 }, sc: { t: 3 } },
  fr_siegeFortress: { p: { c: 5 }, al: { c: 4 } },
  fr_federationBattleship: { p: { c: 5, a: 5, d: 1 }, al: { destroyBase: 1 }, sc: { a: 10 } },
  fr_federationCruiser: { p: { c: 5, a: 4 }, al: { c: 2, a: 2 } },
  fr_frontierRunner: { p: { t: 2, a: 2 } },
  fr_gateship: { p: { acquireCheapFree: { maxCost: 6, toTop: 1 } }, al: { a: 5 } },
  fr_ionStation: { p: { t: 2 }, al: { t: 1 }, dal: { c: 4, a: 4 } },
  fr_longHauler: { p: { t: 3 }, al: { t: 2 }, sc: { topDeckNextBase: 1 } },
  fr_orbitalShuttle: { p: { t: 3, authorityIfTwoBases: 4, drawIfTwoBases: 1 } },
  fr_outlandStation: { pc: [{ t: 1 }, { a: 3 }], sc: { d: 1 } },
  fr_patrolBoat: { p: { c: 4, a: 3 }, al: { a: 2 } },
  fr_transitNexus: { p: { c: 3, t: 4, a: 5 } },

  // ── 危机：舰队与要塞（crisisFleets）──
  cf_borderFort: { pc: [{ t: 1 }, { c: 2 }], al: { scrapOwn: 1 } },
  cf_capitolWorld: { p: { a: 6, d: 1 } },
  cf_cargoLaunch: { p: { d: 1 }, sc: { t: 1 } },
  cf_customsFrigate: { p: { acquireCheapFree: { maxCost: 4, type: 'ship', toTop: 1 } }, al: { c: 4 }, sc: { d: 1 } },
  cf_patrolBot: { pc: [{ t: 2 }, { c: 4 }], al: { scrapOwn: 1 } },
  cf_spikePod: { p: { c: 3 }, opt: { scrapRow: 2 }, sc: { c: 2 } },
  cf_starFortress: { p: { c: 3, discardThenDraw: 1 }, al: { discardThenDraw: 1 } },

  // ── 危机：基地与战列舰（crisisBases）──
  cb_defenseBot: { p: { c: 1, combatIfTwoBases: 8 }, opt: { scrapOwn: 1 } },
  cb_fighterBase: { al: { den: 1 } },
  cb_imperialTrader: { p: { t: 3, d: 1 }, al: { c: 4 } },
  cb_obliterator: { p: { c: 7, combatIfEnemyTwoBases: 6 }, al: { d: 1 } },
  cb_tradeRaft: { p: { t: 1 }, al: { d: 1 }, sc: { t: 1 } },
  cb_tradeWheel: { p: { t: 1 }, al: { c: 2 } }
};

/* ══════════════════════════════════════════════════════════════════════════
 * 二、模式口径表（不写死玩家人数、队伍人数、卡名全集、大将座位）
 *   team     : 存在队伍（座位按 id % 2 分两队）
 *   shared   : 权威在队伍上（team2v2=75 / hydra3=100），血线读 teams[].authority
 *   teamTurn : 整队轮流 + 队末才清算（伤害/弃手/补牌都在队末）
 *   shieldTeam: 前哨护盾按整队共享（team2v2 / hydra3）；大将战与混战按个人
 * ══════════════════════════════════════════════════════════════════════════ */
const MODE_CFG = {
  standard: { team: false, shared: false, teamTurn: false, shieldTeam: false },
  ffa: { team: false, shared: false, teamTurn: false, shieldTeam: false },
  hunter: { team: false, shared: false, teamTurn: false, shieldTeam: false },
  firstBlood: { team: false, shared: false, teamTurn: false, shieldTeam: false },
  team2v2: { team: true, shared: true, teamTurn: true, shieldTeam: true },
  hydra3: { team: true, shared: true, teamTurn: true, shieldTeam: true },
  emperor: { team: true, shared: false, teamTurn: true, shieldTeam: false }
};

const MODE_FALLBACK = MODE_CFG.standard;

/* ══════════════════════════════════════════════════════════════════════════
 * 三、估值常量
 * ══════════════════════════════════════════════════════════════════════════ */
const VP = {
  combatOpen: 1.0,
  combatWalled: 0.6,
  trade: 1.4,
  draw: 2.5,
  deny: 2.6,
  tradeRate: 1.0,
  baseDiscount: 0.5,
  baseTradeFactor: 0.7,
  shipCycles: 1.15,
  horizon: 9,
  cycleDelay: 2,
  gateBonus: 16,
  eliminateBonus: 18,
  copyBonus: 3,
  emperorKillBonus: 120,
  unlockBonus: 8
};

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const arr = (v) => (Array.isArray(v) ? v : []);

/* ══════════════════════════════════════════════════════════════════════════
 * 四、读牌 + 未知卡的 text 通用估值兜底
 *   牌包可任意组合，交易行里会出现没见过的卡：
 *   优先用写死的效果表（可作加成），再用 view.cards[uid].text 做通用解析保底。
 * ══════════════════════════════════════════════════════════════════════════ */

/** 把一段中文卡面拆成「主要 / 同盟 / 销毁」三段。 */
function splitSections(text) {
  const t = String(text || '');
  const iAlly = t.indexOf('同盟');
  const iScrap = t.indexOf('销毁');
  if (iAlly >= 0 && iScrap >= 0 && iAlly < iScrap) {
    return { primary: t.slice(0, iAlly), ally: t.slice(iAlly, iScrap), scrap: t.slice(iScrap) };
  }
  if (iAlly >= 0) return { primary: t.slice(0, iAlly), ally: t.slice(iAlly), scrap: '' };
  if (iScrap >= 0) return { primary: t.slice(0, iScrap), ally: '', scrap: t.slice(iScrap) };
  return { primary: t, ally: '', scrap: '' };
}

/** 从一段文字里抓资源数字。 */
function scrapeNumbers(src) {
  const out = { t: 0, c: 0, a: 0, d: 0, den: 0 };
  if (!src) return out;
  const grab = (re, key) => {
    const r = new RegExp(re, 'g');
    let m;
    while ((m = r.exec(src))) out[key] += parseInt(m[1], 10) || 0;
  };
  grab(/(\d+)\s*贸易/g, 't');
  grab(/(\d+)\s*战斗/g, 'c');
  grab(/(\d+)\s*权威/g, 'a');
  grab(/抽\s*(\d+)\s*张牌/g, 'd');
  grab(/对手弃\s*(\d+)\s*张牌/g, 'den');
  return out;
}

/**
 * 未知卡的通用估值：从卡面文本反推一个粗略的效果表。
 * 数值只用于排序，不追求精确。
 */
function inferDb(raw) {
  const text = String(raw && raw.text ? raw.text : '');
  const sec = splitSections(text);
  const primaryText = sec.primary;
  const branch = primaryText.indexOf('选择');
  let p = {};
  if (branch >= 0) {
    // 二选一卡面：两条分支取较高的一条
    const seg = primaryText.slice(branch).split(/或/).map(s => scrapeNumbers(s));
    const best = seg.reduce((a, b) => (b.c + b.t + b.a + b.d > a.c + a.t + a.a + a.d ? b : a), { c: 0, t: 0, a: 0, d: 0, den: 0 });
    p = { c: best.c, t: best.t, a: best.a, d: best.d, den: best.den };
  } else {
    p = scrapeNumbers(primaryText);
  }
  const al = scrapeNumbers(sec.ally);
  const sc = scrapeNumbers(sec.scrap);
  const db = { inferred: true };
  if (p.c || p.t || p.a || p.d || p.den) db.p = p;
  if (al.c || al.t || al.a || al.d || al.den) db.al = al;
  if (sc.c || sc.t || sc.a || sc.d || sc.den) db.sc = sc;
  if (/摧毁目标基地/.test(text)) {
    db.p = db.p || {};
    db.p.destroyBase = 1;
  }
  if (/免费获得/.test(text)) {
    db.p = db.p || {};
    db.p.acquireFreeMax = 4;
  }
  if (/销毁交易行/.test(text)) {
    db.opt = db.opt || {};
    db.opt.scrapRow = 1;
  }
  if (/前哨/.test(text)) db.flags = (db.flags || []).concat(['outpost']);
  return db;
}

/** 读取一张可见卡：优先写死表，缺失时用 text 兜底。 */
function readCard(view, uid) {
  const raw = (view.cards || {})[uid];
  if (!raw) return null;
  let src = null;
  if (raw.copiedFrom && (view.cards || {})[raw.copiedFrom]) src = (view.cards || {})[raw.copiedFrom];
  const effectId = src ? src.id : raw.id;
  let db = CARD_DB[effectId] || CARD_DB[raw.id] || null;
  const inferred = !db;
  if (!db) db = inferDb(raw);
  return {
    uid,
    id: raw.id,
    effectId,
    db,
    inferred,
    cost: num(raw.cost),
    type: raw.type,
    outpost: !!raw.outpost,
    defense: num(raw.defense),
    faction: raw.faction,
    factions: Array.isArray(raw.factions) && raw.factions.length
      ? raw.factions.slice()
      : (raw.faction && raw.faction !== 'neutral' ? [raw.faction] : []),
    text: typeof raw.text === 'string' ? raw.text : '',
    copied: !!raw.copiedFrom
  };
}

/** 一张牌的主要能力列表（可能是二选一）。 */
function primaryOptions(db) {
  if (!db) return [];
  if (Array.isArray(db.pc) && db.pc.length) return db.pc;
  return db.p ? [db.p] : [];
}

function flagsOf(db) {
  return (db && db.flags) || [];
}

/* ══════════════════════════════════════════════════════════════════════════
 * 五、局面上下文
 * ══════════════════════════════════════════════════════════════════════════ */
function buildContext(view, playerId, mode, legalActions) {
  const cfg = MODE_CFG[mode] || MODE_FALLBACK;
  const players = arr(view.players);
  const me = players[playerId] || {};
  const isTeam = !!cfg.team;
  const shared = !!cfg.shared;
  const teamTurn = !!cfg.teamTurn;
  const myTeam = isTeam ? (me.team === 0 || me.team === 1 ? me.team : null) : null;

  const alive = players.filter((p) => p && !p.eliminated);
  const teammates = isTeam ? alive.filter((p) => p.id !== playerId && p.team === myTeam) : [];
  const opponents = alive.filter((p) => p.id !== playerId && (!isTeam || p.team !== myTeam));

  const cache = new Map();
  const card = (uid) => {
    if (!uid) return null;
    if (cache.has(uid)) return cache.get(uid);
    const c = readCard(view, uid);
    cache.set(uid, c);
    return c;
  };

  const myHand = arr(me.hand).slice();
  const myInPlay = arr(me.inPlay).slice();

  // 我方基地（引擎口径：只看本人的 inPlay）
  const myBases = [];
  let myOutpostCount = 0;
  for (const uid of myInPlay) {
    const c = card(uid);
    if (!c || c.type !== 'base') continue;
    myBases.push(c);
    if (c.outpost) myOutpostCount++;
  }
  // 队伍模式且护盾按整队共享时，队友的前哨也算我方的护盾
  if (cfg.shieldTeam) {
    for (const t of teammates) {
      for (const uid of arr(t.inPlay)) {
        const c = card(uid);
        if (c && c.type === 'base' && c.outpost) { myOutpostCount++; break; }
      }
    }
  }

  // 敌方基地
  const enemyBases = [];
  for (const opp of opponents) {
    for (const uid of arr(opp.inPlay)) {
      const c = card(uid);
      if (!c || c.type !== 'base') continue;
      c.ownerId = opp.id;
      enemyBases.push(c);
    }
  }

  const teams = arr(view.teams);
  const teamOf = (pid) => {
    const p = players.find((x) => x && x.id === pid);
    return p ? p.team : null;
  };
  const teamAuthority = (teamId) => {
    const t = teams.find((x) => x && x.id === teamId);
    return t ? num(t.authority) : 0;
  };

  /** 护盾归属组：整队共享护盾时按队伍，否则按个人。 */
  const shieldKey = (ownerId) => (cfg.shieldTeam ? 'T' + String(teamOf(ownerId)) : 'P' + String(ownerId));

  /** 血线：共享权威读队伍，个人血线读玩家本人。 */
  const hpOf = (pid) => {
    const p = players[pid];
    if (!p) return 1;
    if (shared) {
      const t = teams.find((x) => x && arr(x.players).includes(pid));
      const v = t ? num(t.authority) : num(p.authority);
      return Math.max(1, v);
    }
    return Math.max(1, num(p.authority));
  };

  const ctx = {
    view,
    playerId,
    mode,
    cfg,
    isTeam,
    shared,
    teamTurn,
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
    enemyBases,
    teams,
    teamOf,
    shieldKey,
    hpOf
  };

  /** 目标信息：血线、手牌数、是否被前哨挡住。 */
  ctx.targetInfo = (targetId) => {
    const target = players[targetId];
    const hp = hpOf(targetId);
    const key = shieldKey(targetId);
    const walled = enemyBases.some((c) => c.outpost && shieldKey(c.ownerId) === key);
    return {
      id: targetId,
      player: target,
      team: target ? target.team : null,
      hp,
      walled,
      handCount: num(target && target.handCount)
    };
  };

  // 合法动作里真实存在的攻击目标（信任 legalActions，不自己推导对位表）
  const attackablePlayers = new Set();
  const attackableBases = new Set();
  for (const a of arr(legalActions)) {
    if (!a || typeof a.type !== 'string') continue;
    if (a.type === 'attack') {
      if (a.targetType === 'base') attackableBases.add(a.targetId);
      else attackablePlayers.add(a.targetId);
    }
  }
  ctx.attackablePlayers = attackablePlayers;
  ctx.attackableBases = attackableBases;

  // 战斗兑现价值（通道是否打开要等 ctx.emperors 算完，见下）
  ctx.combatVP = VP.combatOpen;

  // 对手每回合大概能打出多少战斗
  const rateOf = (p) => {
    let r = 0;
    for (const uid of arr(p.inPlay)) {
      const c = card(uid);
      if (c && c.type === 'base') r += perTurnCombat(c.db);
    }
    r += num(p.handCount) * 0.6;
    return r;
  };
  let theirRate = 0;
  for (const o of opponents) theirRate += rateOf(o);
  ctx.theirRate = theirRate;

  let myRate = 0;
  if (isTeam) {
    // 队伍模式：整队轮流，队友的产出对我方的赛跑同样有效
    for (const p of players) {
      if (!p || p.eliminated) continue;
      if (p.id === playerId || (myTeam !== null && p.team === myTeam)) myRate += rateOf(p);
    }
  } else {
    myRate = rateOf(me);
  }
  ctx.myRate = Math.max(0.5, myRate);

  // 场上是否有人（不含我）控制两座以上基地（combatIfEnemyTwoBases 口径）
  ctx.somePlayerTwoBases = players.some((p) => {
    if (!p || p.id === playerId) return false;
    return arr(p.inPlay).filter((uid) => {
      const c = card(uid);
      return c && c.type === 'base';
    }).length >= 2;
  });

  // 场上是否有人（不含我）控制基地（combatIfEnemyBase 口径：连队友的基地也算）
  ctx.someOtherHasBase = players.some((p) => {
    if (!p || p.id === playerId) return false;
    return arr(p.inPlay).some((uid) => {
      const c = card(uid);
      return c && c.type === 'base';
    });
  });

  // 大将战：座位与身份。engine 的约定是 emperors[team] 为该队的大将座位，
  // 但赛制可能轮换成别的座位组合，所以先按数组下标取、再用队伍号校验与兜底。
  const emperors = arr(view.emperors);
  ctx.emperors = emperors;
  ctx.isEmperor = emperors.includes(playerId);
  const emperorByIndex = (myTeam !== null ? emperors[myTeam] : undefined);
  const emperorByTeam = emperors.find((seat) => teamOf(seat) === myTeam);
  ctx.myEmperorSeat = emperorByIndex !== undefined && teamOf(emperorByIndex) === myTeam
    ? emperorByIndex
    : (emperorByTeam !== undefined ? emperorByTeam : emperorByIndex);
  ctx.enemyEmperorSeat = (() => {
    const byIndex = (myTeam !== null ? emperors[1 - myTeam] : undefined);
    if (byIndex !== undefined && teamOf(byIndex) !== myTeam && byIndex !== playerId) return byIndex;
    const byTeam = emperors.find((seat) => seat !== playerId && teamOf(seat) !== myTeam);
    return byTeam !== undefined ? byTeam : byIndex;
  })();

  /**
   * 权威伤害通道是否打开：存在一个「没有前哨护盾、且规则允许我攻击」的敌人。
   * 目标资格严格照搬 engine/modes.js 的 canAttackPlayer / teamHasOutpost 口径：
   *   team2v2 / hydra3：任意敌方队员，但整队有一座前哨就全员不可打；
   *   emperor：大将可打任意敌人；提督只能打对位提督，对位提督阵亡后才解锁敌方大将；
   *   hunter / firstBlood：只能打左手边（座位 +1 方向）的存活玩家；
   *   standard / ffa：任意存活对手。
   * 注意：真正选动作时仍然只从 legalActions 里取，不自己拼造目标。
   */
  ctx.eligibleTargets = eligiblePlayerTargets(ctx);
  ctx.anyChannelOpen = ctx.eligibleTargets.some((id) => !ctx.targetInfo(id).walled);
  ctx.combatVP = ctx.anyChannelOpen ? VP.combatOpen : VP.combatWalled;

  // 血线：共享权威看队伍池；大将战看两名大将的个人权威
  const theirHP = (() => {
    if (mode === 'emperor') {
      const seat = ctx.enemyEmperorSeat;
      return seat !== undefined ? hpOf(seat) : 50;
    }
    if (shared) {
      const enemyTeam = opponents.length ? teamOf(opponents[0].id) : null;
      const pool = enemyTeam !== null ? teamAuthority(enemyTeam) : 0;
      return Math.max(1, pool);
    }
    let lowest = Infinity;
    for (const o of opponents) lowest = Math.min(lowest, hpOf(o.id));
    return isFinite(lowest) ? lowest : 50;
  })();
  const myHP = (() => {
    if (mode === 'emperor') {
      const seat = ctx.myEmperorSeat;
      return seat !== undefined ? hpOf(seat) : Math.max(1, num(me.authority));
    }
    if (shared) return Math.max(1, teamAuthority(myTeam));
    return Math.max(1, num(me.authority));
  })();

  // 权威（血线）的价值：赛跑领先时多余血线没意义，落后时每点血线都值钱
  const tWin = theirHP / ctx.myRate;
  const tLose = myHP / Math.max(0.5, ctx.theirRate);
  ctx.margin = tWin - tLose;
  ctx.authorityVP = clamp(0.35 + 0.95 / (1 + Math.exp(ctx.margin / 1.5)), 0.3, 1.35);
  if (mode === 'emperor' && !ctx.isEmperor) {
    // 提督的个人权威只决定自己能不能继续打，不决定队伍生死
    ctx.authorityVP = 0.25;
  }

  ctx.marketCard = (row) => {
    const uid = arr(view.tradeRow)[row];
    return uid ? card(uid) : null;
  };

  // 我本回合打出过哪些阵营（用于 toHandIfFaction 的即时入手）
  ctx.playedFactions = new Set();
  for (const uid of arr(me.playedThisTurn)) {
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

  // 同盟能力此刻是否可能已经触发。
  // 引擎的 player.triggered 是权威答案（能发动的 ally 动作才出现在 legalActions 里），
  // 没有触发时按「场上同阵营牌」估算未来几回合的触发概率。
  ctx.allyReady = (c) => {
    if (!c || !c.db || !c.db.al) return 0;
    const trig = me.triggered;
    if (trig && typeof trig === 'object' && trig[c.uid]) return 1;
    let same = 0;
    for (const p of players) {
      if (!p || p.eliminated) continue;
      for (const uid of arr(p.inPlay)) {
        const o = card(uid);
        if (!o) continue;
        if (flagsOf(o.db).includes('allAlly')) return 0.85;
        if (o.factions.some((f) => c.factions.includes(f))) same++;
      }
    }
    return same ? 0.6 : 0.2;
  };

  ctx.myAllyCount = myInPlay.filter((u) => {
    const o = card(u);
    return o && o.db && o.db.al;
  }).length;

  // 本回合还能凑出的战斗（用于判断拆基地能否补刀）。
  // 注意：手里的牌打出不花钱（cost 只是交易行售价），所以手牌产出要全额计入。
  const producible = (handCards) => {
    let v = 0;
    for (const uid of handCards) {
      const c = card(uid);
      if (!c || !c.db) continue;
      let best = 0;
      for (const eff of primaryOptions(c.db)) best = Math.max(best, num(eff.c));
      v += best;
    }
    return v;
  };
  const baseCombat = (player) => {
    let v = 0;
    for (const uid of arr(player.inPlay)) {
      const c = card(uid);
      if (!c || c.type !== 'base' || !c.db) continue;
      let best = 0;
      for (const eff of primaryOptions(c.db)) best = Math.max(best, num(eff.c));
      v += best;
    }
    return v;
  };
  const reachNow = num(me.combat) + producible(myHand) + baseCombat(me);
  ctx.reachCombat = reachNow;
  if (teamTurn) {
    // 队末才清伤害：队友能接着把这座基地打死（对手手牌是隐藏的，只能粗估）
    let teamReach = reachNow;
    for (const t of teammates) {
      teamReach += num(t.combat) + baseCombat(t) + num(t.handCount) * 1.5;
    }
    ctx.teamReachCombat = teamReach;
  } else {
    ctx.teamReachCombat = reachNow;
  }

  // 焚化炉一类：销毁己方牌换战斗
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

/**
 * 复刻 engine/modes.js 的 canAttackPlayer 口径，算出「规则允许我攻击权威」的目标集合。
 * 只用于估值（判断权威伤害通道是否打开），真正选动作时仍然只从 legalActions 里取。
 *   - team2v2 / hydra3：任意敌方队员（整队共享权威，打谁都掉同一池血）
 *   - emperor：大将打任意敌人；提督只能打对位提督，对位提督阵亡后解锁敌方大将
 *   - hunter / firstBlood：只能打左手边（座位 +1 方向）的存活玩家
 *   - standard / ffa：任意存活对手
 */
function eligiblePlayerTargets(ctx) {
  const players = ctx.players;
  const aliveIds = ctx.alive.map((p) => p.id);
  const nextAlive = (from, dir) => {
    for (let step = 1; step <= players.length; step++) {
      const index = (from + dir * step + players.length * 2) % players.length;
      if (players[index] && !players[index].eliminated) return index;
    }
    return null;
  };
  const isEmperorSeat = (id) => ctx.emperors.includes(id);

  if (ctx.mode === 'hunter' || ctx.mode === 'firstBlood') {
    const t = nextAlive(ctx.playerId, 1);
    return t === null ? [] : [t];
  }

  if (ctx.mode === 'emperor') {
    if (isEmperorSeat(ctx.playerId)) return ctx.opponents.map((o) => o.id);
    // 提督：只能打对位提督；两队提督按各自队内座位序一一配对（不是座位 +1）
    const own = ctx.players
      .filter((p) => p && p.team === ctx.me.team && !isEmperorSeat(p.id))
      .map((p) => p.id)
      .sort((a, b) => a - b);
    const rival = ctx.players
      .filter((p) => p && p.team !== ctx.me.team && !isEmperorSeat(p.id))
      .map((p) => p.id)
      .sort((a, b) => a - b);
    const index = own.indexOf(ctx.playerId);
    if (index < 0 || index >= rival.length) return [];
    const opposite = rival[index];
    const out = [opposite];
    if (players[opposite] && players[opposite].eliminated) {
      for (const o of ctx.opponents) if (isEmperorSeat(o.id)) out.push(o.id);
    }
    return out.filter((id) => players[id] && !players[id].eliminated);
  }

  return aliveIds.filter((id) => id !== ctx.playerId);
}

/* ══════════════════════════════════════════════════════════════════════════
 * 六、效果估值
 * ══════════════════════════════════════════════════════════════════════════ */
function effectVP(ctx, eff, target) {
  if (!eff) return 0;
  let v = 0;
  if (eff.t) v += eff.t * VP.trade;
  if (eff.c) v += eff.c * ctx.combatVP;
  if (eff.a) v += eff.a * ctx.authorityVP;
  if (eff.d) v += eff.d * VP.draw;
  if (eff.den) v += eff.den * VP.deny;
  if (eff.combatIfEnemyBase && ctx.someOtherHasBase) v += eff.combatIfEnemyBase * ctx.combatVP;
  if (eff.combatIfTwoBases && ctx.myBases.length >= 2) v += eff.combatIfTwoBases * ctx.combatVP;
  if (eff.combatIfEnemyTwoBases && ctx.somePlayerTwoBases) v += eff.combatIfEnemyTwoBases * ctx.combatVP;
  if (eff.authorityIfTwoBases && ctx.myBases.length >= 2) v += eff.authorityIfTwoBases * ctx.authorityVP;
  if (eff.drawIfTwoBases && ctx.myBases.length >= 2) v += eff.drawIfTwoBases * VP.draw;
  if (eff.drawIfThreeBases && ctx.myBases.length >= 3) {
    v += eff.drawIfThreeBases * VP.draw;
    if (eff.authorityIfThreeBases) v += eff.authorityIfThreeBases * ctx.authorityVP;
  }
  if (eff.drawBlobPlayed) {
    let blobs = 0;
    for (const uid of arr(ctx.me.playedThisTurn)) {
      const c = ctx.card(uid);
      if (c && c.faction === 'blob') blobs++;
    }
    v += blobs * VP.draw;
  }
  if (eff.topDeckNextShip) v += 1.8;
  if (eff.topDeckNextBase) v += 1.8;
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
  if (eff.scrapRowGainCostCombat && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) v += num(c.cost) * ctx.combatVP + rerollRowVP(ctx, target.row) * 0.5;
  }
  if (eff.acquireShipFree && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) v += cardVP(ctx, c, 'acquire');
  }
  if (eff.acquireCheapFree && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) {
      v += cardVP(ctx, c, 'acquire');
      const spec = eff.acquireCheapFree;
      if (spec && typeof spec === 'object') {
        if (spec.toHand) v += 2.0;
        else if (spec.toTop) v += 1.2;
      }
    }
  }
  if (eff.acquireFreeMax && target && target.row !== undefined) {
    const c = ctx.marketCard(target.row);
    if (c) v += cardVP(ctx, c, 'acquire');
  }
  if (eff.scrapOwn && target) {
    const targets = arr(target.targets);
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? sacrificeVP(ctx, c) : 2;
    }
    if (eff.drawPerScrap) v += targets.length * VP.draw;
    if (eff.gainCostCombat) {
      for (const uid of targets) {
        const c = ctx.card(uid);
        v += num(c && c.cost) * ctx.combatVP;
      }
    }
    if (eff.combatIfScrap && targets.length) v += eff.combatIfScrap * ctx.combatVP;
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
    const targets = arr(target.targets);
    v += targets.length * VP.draw;
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? discardVP(ctx, c) : 1;
    }
  }
  if (eff.depot && target) {
    const targets = arr(target.targets);
    const unit = target.resource === 'combat' ? ctx.combatVP : VP.trade;
    v += targets.length * 2 * unit;
    for (const uid of targets) {
      const c = ctx.card(uid);
      v -= c ? discardVP(ctx, c) : 1;
    }
  }
  if (eff.recycle && target) {
    const targets = arr(target.targets);
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

/**
 * 拆掉敌方基地的价值：断他的长线产出 + 视情况打开权威伤害通道。
 * 护盾归属组：team2v2 / hydra3 按整队，大将战与混战按个人。
 */
function killBaseVP(ctx, uid) {
  const card = ctx.card(uid);
  if (!card) return 0;
  const info = ctx.targetInfo(card.ownerId);
  const threat = info.walled ? 0.35 : 1;
  let v = perTurnCombat(card.db) * VP.horizon * VP.baseDiscount * threat;
  if (card.outpost) {
    const key = ctx.shieldKey(card.ownerId);
    const remaining = ctx.enemyBases.filter((c) => c.outpost && ctx.shieldKey(c.ownerId) === key).length;
    if (remaining <= 1) {
      // 最后一座前哨：权威伤害通道打开，这是全场最大的一次翻盘点
      const scale = ctx.shared ? 2 : (ctx.mode === 'emperor' && card.ownerId === ctx.enemyEmperorSeat ? 1.5 : 1);
      v += VP.gateBonus * scale + info.hp * 0.3;
    } else {
      // 还有别的前哨挡着，但每拆一座都在推进「破垒」
      v += ctx.shared ? (VP.gateBonus * 2) / remaining : 5;
    }
  }
  return v;
}

/** 拆交易行某位＝重掷该位置的牌（交易行是双方共用的）。 */
function rerollRowVP(ctx, row) {
  const card = ctx.marketCard(row);
  if (!card) return 0;
  const current = cardVP(ctx, card, 'buy');
  let total = 0;
  let n = 0;
  const rowLen = arr(ctx.view.tradeRow).length;
  for (let r = 0; r < rowLen; r++) {
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
    if (eff.combatIfEnemyBase && ctx.someOtherHasBase) v += eff.combatIfEnemyBase * ctx.combatVP;
    if (eff.combatIfTwoBases && ctx.myBases.length >= 2) v += eff.combatIfTwoBases * ctx.combatVP;
    if (eff.combatIfEnemyTwoBases && ctx.somePlayerTwoBases) v += eff.combatIfEnemyTwoBases * ctx.combatVP;
    if (eff.authorityIfTwoBases && ctx.myBases.length >= 2) v += eff.authorityIfTwoBases * ctx.authorityVP * 0.7;
    if (eff.drawIfTwoBases && ctx.myBases.length >= 2) v += eff.drawIfTwoBases * VP.draw * 0.6;
    if (eff.drawIfThreeBases && ctx.myBases.length >= 3) v += eff.drawIfThreeBases * VP.draw * 0.6;
    if (eff.authorityIfThreeBases && ctx.myBases.length >= 3) v += eff.authorityIfThreeBases * ctx.authorityVP * 0.7;
    if (eff.den) v += eff.den * VP.deny * 0.5;
    if (eff.acquireShipFree) v += 2.5;
    if (eff.acquireCheapFree) v += 2.0;
    if (eff.acquireFreeMax) v += 2.0;
    if (eff.destroyBase) v += 2.5;
    if (eff.destroyAndOrScrap) v += 2.0;
    if (eff.scrapRow) v += 1.5;
    if (eff.scrapRowGainCostCombat) v += 2.0;
    if (eff.gainCostCombat) v += 2.0;
    if (eff.combatIfScrap) v += 2.0;
    if (eff.topDeckNextShip) v += 0.9;
    if (eff.topDeckNextBase) v += 0.9;
    if (eff.topDeckNextAny) v += 0.9;
    if (eff.nextAcquireToHand) v += 1.2;
    if (v > best) best = v;
  }
  if (db.al) best += allyPerTurn(ctx, card);
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
  if (al.acquireFreeMax) v += 2.0;
  if (al.destroyBase) v += 2.5;
  if (al.destroyAndOrScrap) v += 2.0;
  if (al.scrapRow) v += 1.5;
  if (al.topDeckNextShip) v += 0.9;
  if (al.topDeckNextBase) v += 0.9;
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
    if (ctx.landsInHand(card)) v += perTurnValue(ctx, card) * 0.8 + 2;
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
 * 七、动作评分
 * ══════════════════════════════════════════════════════════════════════════ */

/** 攻击玩家：1 点伤害 = 1 VP；致命一击额外奖励。 */
function scoreAttackPlayer(ctx, action) {
  const info = ctx.targetInfo(action.targetId);
  const amount = num(action.amount);
  let v = amount;

  if (ctx.mode === 'emperor') {
    // 大将战：权威在个人身上，胜负看大将
    const isEnemyEmperor = action.targetId === ctx.enemyEmperorSeat;
    if (isEnemyEmperor) {
      v = amount * 1.1 + 4;             // 直接打在胜负条件上
      if (amount >= info.hp) v += VP.emperorKillBonus;   // 大将败则该队失败
      return v;
    }
    // 敌方提督：清掉他才能解锁己方提督去打大将
    v = amount * 0.4;
    if (amount >= info.hp) v += VP.eliminateBonus + VP.unlockBonus;
    return v;
  }

  if (amount >= info.hp) {
    if (ctx.mode === 'standard' || ctx.shared) {
      v += 1000; // 直接获胜 / 对方整队权威归零
    } else if (ctx.mode === 'firstBlood') {
      // 先血：首位败北者的左手边存活玩家直接获胜。
      // 我就是那个邻居 → 我赢；否则这一刀直接送对手赢，必须重罚。
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
 * 引擎：玩家 X 被淘汰时，他左边最近的存活玩家获胜（nextAlive(X, -1)）。
 * 先血模式下这意味着「杀掉我的那个邻座」＝我直接获胜。
 */
function killsLeftNeighbor(ctx, targetId) {
  const order = ctx.alive.map((p) => p.id);
  const idx = order.indexOf(targetId);
  if (idx < 0) return false;
  return order[(idx - 1 + order.length) % order.length] === ctx.playerId;
}

/**
 * 攻击基地：伤害在队末才清零，必须在队内把防御值打光，否则白打。
 * 引擎给出的 amount 恒为 min(还需要的防御值, 我的战斗)。
 */
function scoreAttackBase(ctx, action) {
  const card = ctx.card(action.targetId);
  if (!card) return 0;
  const dealt = num((ctx.view.damage || {})[action.targetId]);
  const needed = Math.max(1, card.defense - dealt);
  const amount = num(action.amount);
  const kill = killBaseVP(ctx, action.targetId);
  if (amount >= needed) return kill;
  // 只打了一半：看本队这一轮能不能补刀（队末才清伤害，队友能接着打）
  if (ctx.teamReachCombat >= needed - amount) return kill * (ctx.teamTurn ? 0.8 : 0.7);
  // 打不死：团队模式里伤害留到队友回合，仍有一点残值
  return ctx.teamTurn ? kill * 0.18 : 0.05;
}

/** 打出卡牌。 */
function scorePlay(ctx, action) {
  const card = ctx.card(action.cardId);
  if (!card) return 0;
  const db = card.db;
  if (!db) return 1;

  // 复制牌：效果来自被复制的牌
  if (action.copy) {
    const src = ctx.card(action.copy);
    if (!src || !src.db) return 0;
    if (src.type === 'base') {
      // 复制基地：拿走它的长期产出与前哨护盾（整队共享护盾时价值更高）
      let v = perTurnValue(ctx, src) * VP.horizon * VP.baseDiscount + outpostVP(ctx, src);
      v += VP.copyBonus + 2;
      return v * 0.85;
    }
    const opts = primaryOptions(src.db);
    const idx = clamp(num(action.choice), 0, Math.max(0, opts.length - 1));
    const eff = opts.length ? opts[idx] : null;
    let v = eff ? effectVP(ctx, eff, action) : 0;
    if (src.db.al) v += effectVP(ctx, src.db.al, null) * ctx.allyReady(src);
    v *= VP.shipCycles * 0.85;
    if (src.db.sc) v += effectVP(ctx, src.db.sc, null) * 0.55;
    return v;
  }

  const opts = primaryOptions(db);
  const chosen = opts.length ? opts[clamp(num(action.choice), 0, opts.length - 1)] : null;

  if (card.type === 'base') {
    // 引擎只在「打出飞船」时结算主要能力；基地的主要能力是每回合单独发动的能力动作。
    // 所以基地的价值＝长期每回合产出 + 前哨护盾。
    let v = perTurnValue(ctx, card) * VP.horizon * VP.baseDiscount;
    v += outpostVP(ctx, card);
    const fl = flagsOf(db);
    if (fl.includes('allAlly')) v += 4 + ctx.myAllyCount * 1.2;
    if (fl.includes('fleetHQ')) v += 3;
    if (fl.includes('empireShipBonus')) v += 3;
    if (fl.includes('copyBase')) v += VP.copyBonus + 2;
    return v;
  }

  // 飞船：打出时立即结算主要能力，之后进弃牌堆，可以反复使用
  let v = chosen ? effectVP(ctx, chosen, action) : 0;
  // 舰队总部 / 指挥中心 让本回合打出的飞船额外产出战斗
  for (const uid of ctx.myInPlay) {
    const o = ctx.card(uid);
    if (!o || !o.db) continue;
    const fl = flagsOf(o.db);
    if (fl.includes('fleetHQ')) v += 1 * ctx.combatVP;
    if (fl.includes('empireShipBonus') && card.factions.includes('empire')) v += 2 * ctx.combatVP;
  }
  v *= VP.shipCycles * 0.85;
  if (db.sc) v += effectVP(ctx, db.sc, null) * 0.55;
  if (flagsOf(db).includes('copyShip')) v += VP.copyBonus;
  return v;
}

/** 发动能力（主要 / 同盟 / 双同盟 / 可选 / 销毁）。 */
function scoreAbility(ctx, action) {
  const card = ctx.card(action.cardId);
  if (!card || !card.db) return 0;
  const db = card.db;
  const kind = action.ability;
  let eff = null;
  if (kind === 'primary') {
    if (Array.isArray(db.pc) && db.pc.length) eff = db.pc[clamp(num(action.choice), 0, db.pc.length - 1)] || db.pc[0];
    else eff = db.p;
  } else if (kind === 'ally') {
    // double:true 是双同盟：引擎给的动作仍是 ability:'ally'，只是效果键不同
    eff = action.double ? (db.dal || db.al) : db.al;
  } else if (kind === 'scrap') eff = db.sc;
  else if (kind === 'optional') eff = db.opt;
  if (!eff) return 0;

  let v = effectVP(ctx, eff, action);

  if (kind === 'scrap') {
    // 销毁自己的牌＝永久失去这张牌
    v -= sacrificeVP(ctx, card);
  }
  if (kind === 'ally' && action.double) {
    // 双同盟需要另外两张同阵营卡在场，兑现更稳一点
    v *= 1.05;
  }
  if (kind === 'optional' && db.opt && db.opt.scrapOwn) {
    // 可选拆自己的牌：只有喂焚化炉时才划算
    v -= 1;
    v += ctx.incineratorBonus * arr(action.targets).length;
  }
  if (kind === 'primary' && db.p && db.p.scrapOwn && !db.pc) {
    // 主要能力本身就是拆自己的牌（如废料场／神谕机）：纯亏
    v -= 1.5;
  }
  if (kind === 'primary' && db.p && db.p.scrapOwnMandatory) {
    // 抽牌后强制销毁手牌：只有牌库见底才划算
    v -= 0.5;
  }
  return v;
}

/** 购买。 */
function scoreBuy(ctx, action) {
  if (action.explorer) {
    // 探索者：花 2 贸易买到的是一张「可回收的探索者」——它落进弃牌堆，
    // 之后洗回牌库时是一张可打出换 2 贸易 / 或销毁换 2 战斗的牌。
    // 贸易上基本打平（2 换 2），额外白拿一个 2 战斗的选项，略为正价。
    return 1.6;
  }
  const card = ctx.marketCard(action.row);
  if (!card) return 0;
  return cardVP(ctx, card, 'buy');
}

/**
 * 队友资源预留：整队轮流下，队友紧接着行动，reserve 在他回合开始时到账。
 * 战斗尤其值钱：伤害到队末才清，队友可以接着把同一座基地打死。
 */
function scoreTransfer(ctx, action) {
  const mate = ctx.players[action.targetId];
  if (!mate) return 0;
  const amount = num(action.amount);
  if (amount <= 0) return 0;
  const reserve = mate.reserve || { trade: 0, combat: 0 };
  // 队友越早行动，预留资源越早兑现
  const soon = teammateActsSoon(ctx, action.targetId);

  if (action.resource === 'trade') {
    // 队友手上已经宽裕就别留了
    const need = clamp(3 - (num(mate.trade) + num(reserve.trade)), 0, amount);
    if (!need) return 0;
    // 队友得有牌可买，否则贸易留过去也是空转
    const budget = num(mate.trade) + num(reserve.trade) + need;
    const canSpend = arr(ctx.view.tradeRow).some((uid) => {
      const c = uid ? ctx.card(uid) : null;
      return c && num(c.cost) > 0 && num(c.cost) <= budget;
    });
    if (!canSpend) return 0;
    return need * VP.trade * 0.6 * (soon ? 1.2 : 0.7);
  }

  // 战斗：队友能直接把它兑现成权威伤害，或接着补刀一座已打过血的基地
  const need = clamp(3 - (num(mate.combat) + num(reserve.combat)), 0, amount);
  if (!need) return 0;
  let v = 0;
  if (ctx.anyChannelOpen) v += need * ctx.combatVP * 0.8;
  for (const uid of ctx.attackableBases) {
    const c = ctx.card(uid);
    if (!c) continue;
    const dealt = num((ctx.view.damage || {})[uid]);
    const needed = Math.max(1, c.defense - dealt);
    if (needed <= need) { v += killBaseVP(ctx, uid) * 0.5; break; }
  }
  return v * (soon ? 1.2 : 0.7);
}

/**
 * 大将战专属：花 1 贸易把自己弃牌堆里的一张牌交给队内相邻队友。
 * 牌进的是队友的弃牌堆（他牌库见底时会洗回去），所以只是小额增值，
 * 但在队友紧接着行动时价值最高；不能喧宾夺主。
 */
function scoreMoveCard(ctx, action) {
  const card = ctx.card(action.cardId);
  const mate = ctx.players[action.targetId];
  if (!mate) return 0;
  const soon = teammateActsSoon(ctx, action.targetId);
  const v = card ? cardVP(ctx, card, 'play') : 0;
  // 1 贸易的成本（贸易是当回合清零的钱）
  let s = v * 0.2 - VP.trade * 0.5;
  if (soon) s += 0.5;
  return s;
}

/**
 * 队友是否紧接着我行动（整队轮流：同队按座位升序连续行动）。
 * 只有下一位队友才算「马上」；再往后的那位要等对手队轮完才轮到。
 */
function teammateActsSoon(ctx, targetId) {
  if (!ctx.teamTurn) return false;
  const mine = ctx.players
    .filter((p) => p && p.team === ctx.me.team && !p.eliminated)
    .map((p) => p.id)
    .sort((a, b) => a - b);
  const idx = mine.indexOf(ctx.playerId);
  const tIdx = mine.indexOf(targetId);
  if (idx < 0 || tIdx < 0) return false;
  return tIdx === idx + 1;
}

/* ══════════════════════════════════════════════════════════════════════════
 * 八、待决选择（事件 / 强制弃牌 / 强制销毁 / 指定弃牌对象）
 * ══════════════════════════════════════════════════════════════════════════ */
function scorePending(ctx, action) {
  const pending = ctx.view.pending || {};
  const kind = pending.kind || pending.eventId || pending.type;
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
  if (action.type === 'eventChoice') return scoreEventChoice(ctx, pending, action, kind);
  return 0;
}

function scoreEventChoice(ctx, pending, action, kind) {
  if (kind === 'blackHole') {
    // 每少弃一张掉 4 权威；弃进弃牌堆可回收，代价很小
    const targets = arr(action.targets);
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
    const targets = arr(action.targets);
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
    const back = arr(action.cards);
    const drawn = arr(pending.drawn);
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
 * 九、主入口
 * ══════════════════════════════════════════════════════════════════════════ */
export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  try {
    if (!view || !Array.isArray(legalActions) || legalActions.length === 0) return null;
    const mode = (context && context.mode) || view.mode || 'standard';
    const ctx = buildContext(view, playerId, mode, legalActions);

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
          case 'moveCard': score = scoreMoveCard(ctx, action); break;
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
