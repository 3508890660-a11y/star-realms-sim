// 策略名称：精炼雪球（Refined Snowball）
// 选择理由（一句话）：1v1 没有回合上限，初始牌库 80% 是只值 1 贸易的侦察艇，
// 因此「贸易复利购买 + 持续销毁低质牌做牌库压缩」能滚出不可逆的质量差，
// 前中期囤经济，中后期把经济兑成一波爆发战斗，精确结算 lethal 并压制对方前哨。
// 本轮更新：按 2026-11-08 版程序适配——模式扩到 7 种与 6 牌包（未知卡改用卡面 text 通用估值）、
// 团队回合改整队轮流/队末清算（重写攻击半伤与转移口径）、新增 hydra3/emperor 适配
// （血线读个人权威、认识 double:true 双同盟与 moveCard、信任 legalActions 的目标过滤）。

export const meta = {
  name: 'GLM5.3flash 精炼雪球',
  description: 'glm-5.3-flash · 精炼雪球：前中期重贸易购买并以销毁能力压缩牌库，滚出手牌质量雪球；中后期转化为爆发战斗、精确 lethal 与前哨控制，已适配 7 种模式与 6 个牌包。'
};

// ---------------------------------------------------------------------------
// 卡牌估值表。RATING：购买价值 0-10；KEEP：保留价值（弃牌/销毁时用）。
// 覆盖 core / colonyWars + 三个新牌包的代表性卡；表外卡一律走 estimateFromText。
// ---------------------------------------------------------------------------
const RATING = {
  // 基础盒 · 虫群
  battleBlob: 8, battlePod: 6.5, blobCarrier: 8, blobDestroyer: 8, blobFighter: 6,
  blobWheel: 4.5, blobWorld: 9, mothership: 9, ram: 7, theHive: 6, tradePod: 6,
  // 基础盒 · 机械教团
  battleMech: 7, battleStation: 7, brainWorld: 9, junkyard: 7, machineBase: 7.5,
  mechWorld: 6, missileBot: 6, missileMech: 8, patrolMech: 7, stealthNeedle: 6.5,
  supplyBot: 6, tradeBot: 5.5,
  // 基础盒 · 星际帝国
  battlecruiser: 8, corvette: 6, dreadnaught: 8, fleetHQ: 5, imperialFighter: 5.5,
  imperialFrigate: 6.5, recyclingStation: 6.5, royalRedoubt: 7, spaceStation: 6.5,
  surveyShip: 6.5, warWorld: 7,
  // 基础盒 · 贸易联邦
  barterWorld: 5.5, centralOffice: 6.5, commandShip: 9, cutter: 7, defenseCenter: 6.5,
  embassyYacht: 6.5, federationShuttle: 6, flagship: 8, freighter: 8, portOfCall: 7.5,
  tradeEscort: 7, tradingPost: 4.5,
  // 殖民战争
  battleBot: 5.5, solarSkiff: 6.5, starBarge: 7, swarmer: 6, lancer: 7, predator: 6.5,
  repairBot: 5.5, stellarReef: 4.5, storageSilo: 5.5, tradeHauler: 7, warningBeacon: 6,
  cargoPod: 7, convoyBot: 6.5, falcon: 6.5, orbitalPlatform: 6, patrolCutter: 8, ravager: 7,
  bioformer: 5.5, centralStation: 7, commandCenter: 7.5, frontierFerry: 7, gunship: 8,
  miningMech: 7, theOracle: 6, agingBattleship: 7, colonySeedShip: 7, heavyCruiser: 7,
  mechCruiser: 7.5, parasite: 8, stealthTower: 6.5, federationShipyard: 7.5,
  frontierStation: 6.5, peacekeeper: 8.5, plasmaVent: 6.5, supplyDepot: 6,
  imperialPalace: 7.5, loyalColony: 8, moonwurm: 8.5, theWrecker: 7,
  emperorsDreadnaught: 9, factoryWorld: 7, leviathan: 9.5, theIncinerator: 7,
  // 边疆（frontiers）
  fr_blobAlpha: 8.5, fr_blobMiner: 6, fr_burrower: 7, fr_crusher: 7, fr_hiveQueen: 9,
  fr_infestedMoon: 7, fr_moonwurmHatchling: 7, fr_nestingGround: 6, fr_pulverizer: 6,
  fr_spikeCluster: 5, fr_stinger: 6, fr_swarmCluster: 7.5, fr_builderBot: 5.5,
  fr_conversionYard: 5, fr_defenseSystem: 5.5, fr_destroyerBot: 6, fr_enforcerMech: 7.5,
  fr_integrationPort: 4.5, fr_nanobotSwarm: 8, fr_neuralNexus: 6.5, fr_plasmaBot: 5.5,
  fr_reclamationStation: 5.5, fr_capturedOutpost: 5, fr_cargoCraft: 7, fr_farmShip: 6.5,
  fr_frontierHawk: 6, fr_hammerhead: 7, fr_imperialFlagship: 9, fr_jammingTerminal: 6.5,
  fr_lightCruiser: 7.5, fr_orbitalGunPlatform: 6, fr_siegeFortress: 7.5,
  fr_federationBattleship: 9, fr_federationCruiser: 7.5, fr_frontierRunner: 6,
  fr_gateship: 8, fr_ionStation: 6.5, fr_longHauler: 7, fr_orbitalShuttle: 7,
  fr_outlandStation: 6, fr_patrolBoat: 7, fr_transitNexus: 9,
  // 危机：舰队与要塞（crisisFleets）
  cf_borderFort: 6.5, cf_capitolWorld: 8.5, cf_cargoLaunch: 4.5, cf_customsFrigate: 7,
  cf_patrolBot: 6, cf_spikePod: 5.5, cf_starFortress: 7,
  // 危机：基地与战列舰（crisisBases）
  cb_defenseBot: 6.5, cb_fighterBase: 5.5, cb_imperialTrader: 7, cb_obliterator: 8,
  cb_tradeRaft: 5, cb_tradeWheel: 5.5,
  explorer: 5
};
const KEEP = Object.assign({}, RATING, { scout: 0.4, viper: 0.8, explorer: 2.6 });

// ---------------------------------------------------------------------------
// 基础工具（只读，不修改 view / legalActions）
// ---------------------------------------------------------------------------
function def(view, uid) {
  return view && view.cards ? view.cards[uid] : null;
}
// 未知卡通用估值：解析卡面 text 中的数字效果（引擎的 text 与实际行为一致）。
function estimateFromText(d) {
  const t = String(d.text || '');
  let v = 0;
  const grab = (re, w) => {
    let s = 0;
    const list = t.match(re);
    if (list) for (const m of list) s += Number(m[1]) * w;
    return s;
  };
  v += grab(/获得\s*(\d+)\s*贸易/g, 1.0);
  v += grab(/获得\s*(\d+)\s*战斗/g, 0.85);
  v += grab(/获得\s*(\d+)\s*权威/g, 0.9);
  v += grab(/抽\s*(\d+)\s*张牌/g, 1.1);
  if (/摧毁目标基地/.test(t)) v += 1.6;
  if (/免费获得/.test(t)) v += 2;
  if (/双同盟/.test(t)) v += 0.8;
  if (/目标对手弃/.test(t)) v += 0.6;
  if (/销毁交易行/.test(t)) v += 0.5;
  if (d.type === 'base') v += 0.5; // 基地持续在场的溢价
  if (d.outpost) v += 0.6;
  return v;
}
function rateDef(d) {
  if (!d) return 0;
  const r = RATING[d.id];
  if (typeof r === 'number') return r;
  const est = estimateFromText(d);
  const fallback = Math.min(3 + (d.cost || 0) * 0.7, 9);
  return Math.max(est, fallback * 0.9);
}
function rating(view, uid) {
  return rateDef(def(view, uid));
}
function keepDef(d) {
  if (!d) return 5;
  const k = KEEP[d.id];
  return typeof k === 'number' ? k : rateDef(d);
}
function keepVal(view, uid) {
  return keepDef(def(view, uid));
}
function myZones(view, me) {
  const p = view && view.players ? view.players[me] : null;
  if (!p) return [];
  return [].concat(p.hand || [], p.inPlay || [], p.discard || []);
}
function factionCounts(view, me) {
  const counts = {};
  for (const uid of myZones(view, me)) {
    const d = def(view, uid);
    if (d && d.faction && d.faction !== 'neutral') counts[d.faction] = (counts[d.faction] || 0) + 1;
  }
  return counts;
}
function dominantFaction(counts) {
  let best = null, n = 0;
  for (const f of Object.keys(counts)) if (counts[f] > n) { n = counts[f]; best = f; }
  return best;
}
function worstCard(view, uids) {
  let w = null, v = Infinity;
  for (const uid of uids || []) {
    const k = keepVal(view, uid);
    if (k < v) { v = k; w = uid; }
  }
  return w;
}
function teammatesOf(view, me) {
  if (!view || !Array.isArray(view.teams)) return [];
  for (const t of view.teams) {
    if (Array.isArray(t.players) && t.players.includes(me)) {
      return t.players.filter(id => id !== me && view.players[id] && !view.players[id].eliminated);
    }
  }
  return [];
}
function aliveIds(view) {
  return (view.players || []).filter(p => p && !p.eliminated).map(p => p.id);
}
function rightNeighborAlive(view, targetId) {
  const n = (view.players || []).length;
  for (let i = 1; i < n; i++) {
    const id = (targetId - i + n * 2) % n;
    if (view.players[id] && !view.players[id].eliminated) return id;
  }
  return null;
}
function isTeamLike(view) {
  return Array.isArray(view.teams) && view.teams.length > 0;
}
// 经济期阈值按 7 种模式分档：6 人团队模式回合数按人次计，节奏更长。
const ECON_TURNS = { standard: 6, ffa: 6, hunter: 7, firstBlood: 6, team2v2: 8, hydra3: 12, emperor: 6 };
function econPhase(view, me, context) {
  const turn = (context && context.turn) || view.turn || 1;
  const lim = ECON_TURNS[view.mode];
  return turn <= (typeof lim === 'number' ? lim : 6);
}

// ---------------------------------------------------------------------------
// lethal：先手必杀。firstBlood 模式下若击杀会把胜利送给别人则不杀。
// 大将战里击杀敌方大将直接获胜，多个 lethal 时优先杀大将。
// ---------------------------------------------------------------------------
function findLethal(view, legalActions, me) {
  let fallback = null;
  for (const a of legalActions) {
    if (a.type !== 'attack' || a.targetType !== 'player') continue;
    const t = view.players[a.targetId];
    if (!t) continue;
    if (a.amount < t.authority) continue; // 血线一律读个人权威（emperor 里 teams[].authority 是 0）
    if (view.mode === 'firstBlood' && rightNeighborAlive(view, a.targetId) !== me) continue;
    if (Array.isArray(view.emperors) && view.emperors.includes(a.targetId)) return a;
    if (!fallback) fallback = a;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// 待决选择：强制弃牌 / 指定弃牌目标 / 强制销毁 / 事件选择
// ---------------------------------------------------------------------------
function handlePending(view, legalActions, me) {
  const kind = legalActions[0].type;
  if (kind === 'discard' || kind === 'selectScrap') {
    const hand = (view.players[me] && view.players[me].hand) || [];
    const pool = hand.length ? hand : legalActions.map(a => a.cardId).filter(Boolean);
    const w = worstCard(view, pool) || (legalActions[0].cardId);
    const act = legalActions.find(a => a.cardId === w);
    return act || legalActions[0];
  }
  if (kind === 'targetDiscard') {
    const mates = teammatesOf(view, me);
    const enemies = legalActions.filter(a => a.targetId !== me && !mates.includes(a.targetId));
    const pool = enemies.length ? enemies : legalActions;
    let best = pool[0], n = -1;
    for (const a of pool) {
      const h = (view.players[a.targetId] || {}).handCount || 0;
      if (h > n) { n = h; best = a; }
    }
    return best;
  }
  if (kind === 'eventChoice') return handleEvent(view, legalActions, me);
  return legalActions[0]; // 其它待决类型安全兜底
}

// 事件选择：黑洞 / 彗星 / 轨道轰击 / 跃迁，未知事件走兜底。
const EVENT_KIND = { blackHole: 'blackHole', comet: 'comet', bombardment: 'bombardment', warpJump: 'warpJump' };
function handleEvent(view, actions, me) {
  const p = view.pending || {};
  let kind = p.kind;
  if (!kind && view.eventContext && EVENT_KIND[view.eventContext.eventId]) {
    kind = EVENT_KIND[view.eventContext.eventId];
  }
  if (!kind) {
    if (actions.some(a => a.pay || a.baseId)) kind = 'bombardment';
    else if (actions.some(a => a.cards)) kind = 'warpJump';
    else if (actions.some(a => a.targets)) kind = 'blackHole';
    else kind = 'unknown';
  }
  const meP = view.players[me] || {};

  if (kind === 'blackHole') {
    // 弃 i 张的代价 = 4*(2-i) 权威 + 被弃牌价值，取总代价最小。
    let best = actions[0], bc = Infinity;
    for (const a of actions) {
      const t = Array.isArray(a.targets) ? a.targets : [];
      const cost = 4 * (2 - t.length) + t.reduce((s, c) => s + keepVal(view, c), 0);
      if (cost < bc) { bc = cost; best = a; }
    }
    return best;
  }
  if (kind === 'comet') {
    // 销毁手牌/弃牌堆低质牌：代价 = 牌价值 - 1.5*张数的压缩收益。
    let best = actions[0], bc = Infinity;
    for (const a of actions) {
      const t = Array.isArray(a.targets) ? a.targets : [];
      const cost = t.reduce((s, c) => s + keepVal(view, c), 0) - 1.5 * t.length;
      if (cost < bc) { bc = cost; best = a; }
    }
    return best;
  }
  if (kind === 'bombardment') {
    const pay = actions.find(a => a.pay);
    const baseActs = actions.filter(a => a.baseId);
    if (baseActs.length) {
      let worst = null, v = Infinity;
      for (const a of baseActs) {
        const d = def(view, a.baseId);
        const k = keepDef(d) + (d && d.outpost ? 2 : 0); // 前哨更值钱，尽量不拆
        if (k < v) { v = k; worst = a; }
      }
      if (worst && v <= 5.5) return worst;
    }
    return pay || actions[0];
  }
  if (kind === 'warpJump') {
    // 抽 3 选 2 放回牌库顶：unshift 后 cards[0] 在最顶、最先抽到，优先放最好的。
    let best = actions[0], bs = -Infinity;
    for (const a of actions) {
      const c = Array.isArray(a.cards) ? a.cards : [];
      const v0 = c.length > 0 ? keepVal(view, c[0]) : 0;
      const v1 = c.length > 1 ? keepVal(view, c[1]) : 0;
      const s = v0 * 1.5 + v1;
      if (s > bs) { bs = s; best = a; }
    }
    return best;
  }
  // 未知事件：若有 targets 类选择则选“目标最多”的（多数事件多选更优），否则第一个。
  const withTargets = actions.filter(a => Array.isArray(a.targets) && a.targets.length);
  if (withTargets.length) {
    return withTargets.reduce((b, a) => (a.targets.length > b.targets.length ? a : b));
  }
  return actions[0];
}

// ---------------------------------------------------------------------------
// 打牌：全都要打，挑“分支质量”最高的先打（复制对象、primaryChoice 分支、带 row 免费获取）。
// ---------------------------------------------------------------------------
function choiceScorePlay(view, a, me, econ) {
  const d = def(view, a.cardId);
  if (!d) return 0;
  if (d.id === 'parasite') {
    if (a.choice === 0) return 6; // 6 战斗
    if (a.row !== undefined) return rating(view, view.tradeRow[a.row]); // 免费拿牌
    return 0;
  }
  if (d.id === 'patrolMech') {
    return a.choice === 0 ? (econ ? 6.5 : 4) : (econ ? 4 : 6); // 3 贸易 vs 5 战斗
  }
  return 0;
}

function pickPlay(view, legalActions, me, econ) {
  const plays = legalActions.filter(a => a.type === 'play');
  if (!plays.length) return null;
  let best = null, bs = -Infinity;
  for (const a of plays) {
    let s = 1;
    if (a.copy) s += rateDef(def(view, a.copy)) * 0.5; // 隐匿针舰/尖塔：复制场面上最强的
    if (a.row !== undefined) {
      // 打牌附带免费获取 / 销毁行换战斗（frontiers 等新方言），按行卡价值加分
      const rd = def(view, view.tradeRow[a.row]);
      if (rd) s += 1.5 + rateDef(rd) * 0.25;
    }
    s += choiceScorePlay(view, a, me, econ);
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 能力：同盟（含 double:true 双同盟）/ 主要 / 可选 / 销毁。
// 销毁压缩牌库优先，其次摧毁前哨，再同盟，再资源。
// ---------------------------------------------------------------------------
function blobShipCount(view, me) {
  const p = view.players[me] || {};
  let n = 0;
  for (const uid of p.inPlay || []) {
    const d = def(view, uid);
    if (d && d.faction === 'blob' && d.type === 'ship') n++;
  }
  return n;
}

function choiceScoreAbility(view, a, d, me, econ) {
  if (d.id === 'blobWorld') {
    return a.choice === 1 ? (blobShipCount(view, me) >= 3 ? 6 : 1) : 5; // 抽牌 vs 5 战斗
  }
  if (d.id === 'defenseCenter') return a.choice === 0 ? ((view.players[me].authority || 50) < 14 ? 3 : 1.5) : 2;
  if (d.id === 'barterWorld' || d.id === 'tradingPost') return a.choice === 1 ? 2 : 1.5; // 偏贸易
  if (d.id === 'frontierStation') return a.choice === (econ ? 0 : 1) ? 2.2 : 1.8; // 2 贸易 vs 3 战斗
  return 1;
}

function bestEnemyBaseTarget(view, targetIds) {
  // 优先可整杀的前哨（剩余防御最低，计入累计伤害），否则价值最高的基地。
  const dmg = view.damage || {};
  let bestOutpost = null, bestODef = Infinity;
  let bestBase = null, bestRating = -Infinity;
  for (const uid of targetIds || []) {
    const d = def(view, uid);
    if (!d) continue;
    if (d.outpost) {
      const remain = Math.max(1, (d.defense || 1) - (dmg[uid] || 0));
      if (remain < bestODef) { bestODef = remain; bestOutpost = uid; }
    } else if (rating(view, uid) > bestRating) {
      bestRating = rating(view, uid); bestBase = uid;
    }
  }
  return bestOutpost || bestBase || null;
}

function scoreAbility(view, a, me, mates, econ) {
  const d = def(view, a.cardId);
  if (!d) return -1;
  const targets = Array.isArray(a.targets) ? a.targets : null;

  // machineBase：抽 1 再强制销 1，净赚过滤，永远启动
  if (d.id === 'machineBase' && a.ability === 'primary') return 4.5;

  // 销毁能力（会移除该牌本身）：飞船反正回合末离场，销毁=纯赚压缩；基地只在前哨互换时考虑。
  if (a.ability === 'scrap') {
    if (d.type === 'ship') {
      if (a.targetId) {
        const td = def(view, a.targetId);
        return 3 + (td && td.outpost ? 1.5 : 0.5) + rateDef(td) * 0.05;
      }
      return 3;
    }
    // 基地销毁能力：仅当目标是敌方前哨（plasmaVent/frontierFerry/portOfCall 类）才值得
    if (a.targetId) {
      const td = def(view, a.targetId);
      return td && td.outpost ? 2 : -1;
    }
    return -1;
  }

  // 销毁/弃牌己方牌的能力（机械阵营、discardThenDraw、depot、recycle 等）
  if (targets) {
    if (!targets.length) return -1; // 空目标 = 空过，不启动
    const bad = targets.every(c => keepVal(view, c) <= 1.1);
    if (bad) {
      if (a.resource === 'trade' && econ) return 4 + targets.length;
      if (a.resource === 'combat' && !econ) return 4 + targets.length;
      if (!a.resource) return 5 + targets.length;
      return 3.5 + targets.length;
    }
    // 补给站 depot：2 贸易/战斗 换 1 张，价值低也可接受
    if (a.resource && targets.length === 1) {
      const gain = 2 - keepVal(view, targets[0]);
      if (gain > 0) return 2.5 + gain;
    }
    // 轨道平台 弃1抽1：丢最差的牌做过滤
    if (d.id === 'orbitalPlatform' && targets.length === 1 && keepVal(view, targets[0]) <= 3) return 3;
    // 弃 1 抽 1 的过滤型效果（discardThenDraw）：丢最差牌约等于免费过滤
    if (targets.length === 1 && keepVal(view, targets[0]) <= 1.6) return 3;
    return -1; // 没有低质牌就不启动销毁/弃牌能力
  }

  // 同盟免费拿牌（含 double:true 的双同盟取行分支）
  if (a.ability === 'ally' && a.row !== undefined) {
    const rd = def(view, view.tradeRow[a.row]);
    if (!rd) return -1;
    return 3 + rateDef(rd) * 0.3; // blobCarrier / moonwurm / leviathan / gateship 类
  }

  // 摧毁目标基地（missileMech 可选 / mechCruiser、commandShip、enforcerMech 同盟等）
  if (a.targetId !== undefined && a.ability !== 'scrap') {
    const td = def(view, a.targetId);
    if (!td) return -1;
    return td.outpost ? 4 : 2 + rateDef(td) * 0.2;
  }

  // blobDestroyer 同盟：摧毁基地和/或销毁交易行（引擎已拆成单选/组合动作，各分支独立打分）
  if (d.id === 'blobDestroyer' && a.ability === 'ally') {
    let s = 0;
    if (a.targetId) {
      const td = def(view, a.targetId);
      s += td && td.outpost ? 3.5 : 1.5;
    }
    if (a.row !== undefined) {
      const rd = def(view, view.tradeRow[a.row]);
      s += rd && rateDef(rd) >= 8 ? 1.5 : 0.5;
    }
    return s > 0 ? s : -1;
  }

  // 销毁交易行（swarmer / ravager / spikePod 等）：拒购高价值卡优先，
  // 其余情况把“销毁行换等费战斗”当小收益，不再一律拒绝。
  if (a.row !== undefined || Array.isArray(a.rows)) {
    const rows = a.rows || [a.row];
    let s = 0.8;
    for (const r of rows) {
      const rd = def(view, view.tradeRow[r]);
      if (!rd) continue;
      if (rateDef(rd) >= 8 && (view.players[me].trade || 0) < (rd.cost || 0)) s += 1.5; // 对手必抢且我买不起
      else s += Math.min((rd.cost || 0) * 0.12, 1); // 可能换到战斗的期望小收益
    }
    return s;
  }

  // 置牌库顶类同盟（centralOffice / freighter / federationShipyard）；double:true 当一次额外同盟机会
  if (a.ability === 'ally') return a.double ? 3.3 : 3;
  // 其余主要能力（资源、抽牌等）默认可用
  if (a.ability === 'primary') return 1.5 + choiceScoreAbility(view, a, d, me, econ) * 0.5;
  if (a.ability === 'optional') return 1;
  return 0.5;
}

function pickAbility(view, legalActions, me, econ) {
  const acts = legalActions.filter(a => a.type === 'ability');
  if (!acts.length) return null;
  const mates = teammatesOf(view, me);
  let best = null, bs = -Infinity;
  for (const a of acts) {
    const s = scoreAbility(view, a, me, mates, econ);
    if (s > bs) { bs = s; best = a; }
  }
  return bs >= 0.5 ? best : null;
}

// ---------------------------------------------------------------------------
// 攻击。个人模式维持「只整杀不半伤」（回合末清伤害）；
// 团队模式（team2v2/hydra3）基地伤害队末才清零，队友可合击同一座基地，
// 因此先整杀，没有整杀机会时允许把多余战斗砸进高价值基地供队友续刀。
// 打脸目标不按座位推导，完全信任 legalActions 给出的 targetId。
// ---------------------------------------------------------------------------
function neededToKill(view, uid, fallbackDef) {
  const dmg = (view.damage || {})[uid] || 0;
  return Math.max(1, (fallbackDef || 1) - dmg);
}

function pickAttack(view, legalActions, me) {
  const atks = legalActions.filter(a => a.type === 'attack');
  if (!atks.length) return null;
  const face = atks.filter(a => a.targetType === 'player');
  const baseActs = atks.filter(a => a.targetType === 'base');

  if (face.length) {
    const enemies = [...new Set(face.map(a => a.targetId))];
    let target;
    const emps = enemies.filter(id => Array.isArray(view.emperors) && view.emperors.includes(id));
    if (view.mode === 'emperor' && emps.length) {
      target = emps[0]; // 大将战：能打大将就打大将（杀大将直接获胜）
    } else if (view.mode === 'firstBlood') {
      // 优先打“击杀后我直接获胜”的座位，否则打权威最低者
      target = enemies.find(id => rightNeighborAlive(view, id) === me);
      if (!target) target = enemies.reduce((lo, id) =>
        (view.players[id].authority < view.players[lo].authority ? id : lo), enemies[0]);
    } else {
      target = enemies.reduce((lo, id) =>
        (view.players[id].authority < view.players[lo].authority ? id : lo), enemies[0]);
    }
    const options = face.filter(a => a.targetId === target);
    const lethal = options.find(a => a.amount >= view.players[target].authority &&
      (view.mode !== 'firstBlood' || rightNeighborAlive(view, target) === me));
    if (lethal) return lethal;
    let maxAmt = Math.max(...options.map(a => a.amount));
    if (view.mode === 'firstBlood' && maxAmt >= view.players[target].authority) {
      maxAmt = view.players[target].authority - 1; // 别替别人做嫁衣
    }
    if (maxAmt >= 1) {
      const act = options.find(x => x.amount === maxAmt);
      if (act) return act;
    }
  }

  if (baseActs.length) {
    const killable = baseActs.filter(a => {
      const d = def(view, a.targetId);
      return d && a.amount >= neededToKill(view, a.targetId, d.defense);
    });
    if (killable.length) {
      const outposts = killable.filter(a => def(view, a.targetId).outpost);
      const pool = outposts.length ? outposts : killable;
      const best = pool.reduce((b, a) => {
        if (outposts.length) {
          return neededToKill(view, a.targetId, def(view, a.targetId).defense) <
            neededToKill(view, b.targetId, def(view, b.targetId).defense) ? a : b;
        }
        return rating(view, a.targetId) > rating(view, b.targetId) ? a : b;
      });
      return best;
    }
    // 团队模式专属：没有整杀机会时，把多余战斗砸进高价值基地（伤害队末才清，队友能续刀）
    if (isTeamLike(view)) {
      let best = null, bs = -Infinity;
      for (const a of baseActs) {
        const d = def(view, a.targetId);
        if (!d) continue;
        const s = rateDef(d) + (d.outpost ? 1 : 0) + a.amount * 0.05;
        if (s > bs) { bs = s; best = a; }
      }
      if (best && bs >= 5 && best.amount >= 4) return best;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 购买：评分 - 轻微费用惩罚 + 阵营协同。买不起好的就买探索者兜底。
// ---------------------------------------------------------------------------
function pickBuy(view, legalActions, me, econ) {
  const buys = legalActions.filter(a => a.type === 'buy');
  if (!buys.length) return null;
  const dom = dominantFaction(factionCounts(view, me));
  let best = null, bs = -Infinity;
  for (const a of buys) {
    let d;
    if (a.explorer) d = { id: 'explorer', faction: 'neutral', cost: 2, type: 'ship', text: '获得 2 贸易' };
    else d = def(view, view.tradeRow[a.row]);
    if (!d) continue;
    let s = rateDef(d);
    if (dom && d.faction === dom) s += 0.7;
    if (d.type === 'base') s += econ ? 0.4 : 0.2;
    if (d.outpost) s += 0.2;
    s -= (d.cost || 0) * 0.05;
    if (s > bs) { bs = s; best = a; }
  }
  if (!best) return null;
  if (bs >= 4.5) return best;
  const expl = buys.find(a => a.explorer);
  if (expl) return expl;
  if (bs >= 3.4) return best;
  return null; // 剩的贸易太低不值得乱花（团队模式会转给队友）
}

// ---------------------------------------------------------------------------
// 大将战专属 moveCard：花 1 贸易把弃牌堆一张牌交给相邻队友。
// 只在贸易富余（大概率买完牌）且弃牌堆确有好牌时启动；优先交给本队大将，
// 否则交给手牌+牌库最薄的队友。贸易紧张时绝不挪用买牌预算。
// ---------------------------------------------------------------------------
function pickMoveCard(view, legalActions, me) {
  const moves = legalActions.filter(a => a.type === 'moveCard');
  if (!moves.length) return null;
  const p = view.players[me] || {};
  if ((p.trade || 0) < 4) return null;
  const seen = new Map();
  for (const a of moves) {
    const v = rating(view, a.cardId);
    if (!seen.has(a.cardId) || v > seen.get(a.cardId)) seen.set(a.cardId, v);
  }
  let bestCard = null, bv = -Infinity;
  for (const [cardId, v] of seen.entries()) if (v > bv) { bv = v; bestCard = cardId; }
  if (!bestCard || bv < 6.5) return null;
  const emps = Array.isArray(view.emperors) ? view.emperors : [];
  const myEmperor = emps.find(id =>
    id !== me && view.players[id] && !view.players[id].eliminated && view.players[id].team === p.team);
  if (myEmperor !== undefined) {
    const toEmp = moves.find(a => a.cardId === bestCard && a.targetId === myEmperor);
    if (toEmp) return toEmp;
  }
  let pick = null, bn = Infinity;
  for (const a of moves) {
    if (a.cardId !== bestCard) continue;
    const t = view.players[a.targetId];
    if (!t || t.eliminated) continue;
    const n = (t.handCount || 0) + (t.deckCount || 0);
    if (n < bn) { bn = n; pick = a; }
  }
  return pick;
}

// ---------------------------------------------------------------------------
// 团队模式（team2v2 / hydra3）转移：整队轮流下队友紧接着行动，
// transfer 出去的资源下一动就到账，所以回合末把用不掉的贸易/战斗全额转出去。
// ---------------------------------------------------------------------------
function pickTransfer(view, legalActions, me) {
  if (!isTeamLike(view)) return null;
  const p = view.players[me] || {};
  const acts = legalActions.filter(a => a.type === 'transfer');
  if (!acts.length) return null;
  const full = (resource) => {
    if ((p[resource] || 0) <= 0) return null;
    return acts.find(a => a.resource === resource && a.amount === p[resource]) ||
      acts.filter(a => a.resource === resource).reduce((b, a) => (a.amount > b.amount ? a : b), acts.find(a => a.resource === resource));
  };
  return full('trade') || full('combat') || null;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
function decide(view, legalActions, me, context) {
  // lethal 最优先
  const lethal = findLethal(view, legalActions, me);
  if (lethal) return lethal;

  // 待决选择分支
  const firstType = legalActions[0].type;
  if (firstType === 'discard' || firstType === 'selectScrap' ||
      firstType === 'targetDiscard' || firstType === 'eventChoice') {
    return handlePending(view, legalActions, me);
  }

  const econ = econPhase(view, me, context);

  // 1. 打牌（打完才结算攻击，避免战斗被能力追加后漏算）
  const play = pickPlay(view, legalActions, me, econ);
  if (play) return play;

  // 2. 能力（同盟/双同盟/销毁压缩/资源/摧毁基地）
  const ability = pickAbility(view, legalActions, me, econ);
  if (ability) return ability;

  // 3. 攻击（lethal 已在前面处理，这里做整杀前哨、打脸与团队合击半伤）
  const attack = pickAttack(view, legalActions, me);
  if (attack) return attack;

  // 4. 购买（每次调用买一件，引擎会带着新状态再次询问）
  const buy = pickBuy(view, legalActions, me, econ);
  if (buy) return buy;

  // 5. 大将战：富余贸易把弃牌堆好牌移交给队友（优先本队大将）
  const move = pickMoveCard(view, legalActions, me);
  if (move) return move;

  // 6. 团队模式：回合末把剩余贸易/战斗全额转给队友
  const transfer = pickTransfer(view, legalActions, me);
  if (transfer) return transfer;

  // 7. 兜底：未知动作类型时优先选一个非结束回合的动作
  const useful = legalActions.find(a => a.type !== 'endTurn');
  return useful || legalActions[0];
}

function safeFallback(legalActions) {
  try {
    if (!Array.isArray(legalActions) || !legalActions.length) return legalActions ? legalActions[0] : undefined;
    const useful = legalActions.find(a => a && a.type !== 'endTurn');
    return useful || legalActions[0];
  } catch (err) {
    return legalActions ? legalActions[0] : undefined;
  }
}

export function chooseAction(input) {
  const args = input || {};
  const { view, legalActions, playerId } = args;
  try {
    if (!Array.isArray(legalActions) || !legalActions.length) {
      return legalActions ? legalActions[0] : undefined;
    }
    if (!view || !view.players || !view.players[playerId]) return safeFallback(legalActions);
    args.memory && (args.memory.calls = (args.memory.calls || 0) + 1);
    return decide(view, legalActions, playerId, args.context);
  } catch (err) {
    return safeFallback(legalActions);
  }
}
