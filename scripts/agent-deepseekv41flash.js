// 策略名称：三段涨潮（Three-Phase Tide）
// 选择理由：各类模式本质都只比权威，先用贸易把每回合产出推高、再用前哨与高效战斗牌锁住资源差、最后集中两三个高战斗回合兑现斩杀，比纯快攻或纯经济都更稳。
// 本轮更新：按 2026-11-08 程序更新第 1–6 条适配——7 模式（hydra3 整队轮流/队末清算、emperor 个人权威与 moveCard）、6 牌包通用估值加文本兜底、double:true 同盟与 choice/row/rows/targets 方言、未知动作安全兜底。
// ============================================================================
// 策略骨架（不依赖任何外部模块，零 import / require）：
//   1. 主阶段按固定相位推进：打出 -> 能力 -> 攻击 -> 购买 -> 预留/移交 -> 结束回合。
//      相位顺序保证「先产生资源、再决定消耗」，不会在资源未结算前花掉战斗。
//   2. 购买用卡牌价值表 + 卡面文本解析打分，并按回合在「贸易权重 / 战斗权重 / 防守权重」
//      之间平滑切换，这就是「涨潮」的三段。回合长度按模式起始权威归一化，
//      所以 100 权威的三头龙不会用 50 权威的节奏去收经济。
//   3. 攻击严格遵循引擎事实：基地伤害只在「全队回合结束」时清零，因此
//      (a) 只有本刀能打穿才打；(b) 团队模式下允许把对面前哨磨到只剩 1–2 点，交给紧接着行动的队友收；
//      (c) 队友已经在同一目标上留了伤害，就在 defLeft 里如实扣掉。
//   4. 队伍口径：team2v2 / hydra3 共享权威、整队轮流、队末才弃手补牌，因此
//      换手前的剩余资源一律 transfer 给下一个行动的队友；emperor 权威在个人身上，
//      血线读 players[].authority，移交用 moveCard。
//   5. 所有待决动作（弃牌 / 指定弃牌 / 强制销毁 / 事件选择）都有显式评分与安全兜底，
//      未知动作一律回退到合法列表里的 endTurn 或第一个元素。
// ============================================================================

export const meta = {
  name: 'deepseek v4.1flash · 三段涨潮',
  description:
    'deepseek-v4.1-flash｜策略「三段涨潮」：早期贸易滚雪球、中期前哨与高效率战斗牌锁差、末期集中火力斩杀；零依赖，7 模式与 core/colonyWars/events/frontiers/crisisFleets/crisisBases 任意组合均可安全决策。'
};

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const RECUR = 1.28; // 基地主要能力按「每回合可重复使用」折算的系数

const PENDING_TYPES = new Set(['discard', 'selectScrap', 'targetDiscard', 'eventChoice']);

// 共享权威的队伍模式；emperor 也是队伍模式，但权威在个人身上。
const SHARED_TEAM_MODES = new Set(['team2v2', 'hydra3']);
const TEAM_LIKE_MODES = new Set(['team2v2', 'hydra3', 'emperor']);

const isSharedTeam = mode => SHARED_TEAM_MODES.has(mode);
const isTeamLike = mode => TEAM_LIKE_MODES.has(mode);

// ---------------------------------------------------------------------------
// 卡牌价值表
//   t/c/a/d : 主效果里的贸易 / 战斗 / 权威 / 抽牌（基地为「每回合」量）
//   base/def/out : 基地 / 防御 / 前哨
//   thin : 每次使用能主动销毁手牌或弃牌堆的牌数（牌库压缩）
//   row  : 每次使用能销毁交易行的牌数
//   x    : 同盟、附带效果、复制、免费获得等一次性附加价值
//   sc   : 销毁自身时的一次性收益（用于斩杀判断）
//   copy : 复制类卡牌
//   choice : 多选一卡牌（估值时按「灵活」折价，避免高估）
// ---------------------------------------------------------------------------
const CARD_TABLE = Object.freeze({
  // ---- 中立 ----
  scout: { t: 1 },
  viper: { c: 1 },
  explorer: { t: 2, sc: 2.1 },

  // ---- 虫群 ----
  battleBlob: { c: 8, x: 1.5, sc: 4.2 },
  battlePod: { c: 4, x: 1.5, row: 1 },
  blobCarrier: { c: 7, x: 2.4 },
  blobDestroyer: { c: 6, x: 2.6 },
  blobFighter: { c: 3, x: 0.8 },
  blobWheel: { base: 1, def: 5, c: 1, x: 0.5, sc: 3 },
  blobWorld: { base: 1, def: 7, c: 5, x: 1.0, choice: 1 },
  mothership: { c: 6, d: 1, x: 0.8 },
  ram: { c: 5, x: 1.1, sc: 3 },
  theHive: { base: 1, def: 5, c: 3, x: 0.7 },
  tradePod: { t: 3, x: 0.9 },

  // ---- 机械教团 ----
  battleMech: { c: 4, x: 1.0, thin: 1 },
  battleStation: { base: 1, def: 5, out: 1, x: 1.4, sc: 5.2 },
  brainWorld: { base: 1, def: 6, out: 1, thin: 2, x: 2.6 },
  junkyard: { base: 1, def: 5, out: 1, thin: 1, x: 0.8 },
  machineBase: { base: 1, def: 6, out: 1, d: 1, x: 0.4 },
  mechWorld: { base: 1, def: 6, out: 1, x: 2.4 },
  missileBot: { c: 2, x: 0.9, thin: 1 },
  missileMech: { c: 6, x: 2.2 },
  patrolMech: { c: 5, x: 0.5, thin: 1, choice: 1 },
  stealthNeedle: { x: 5.0, copy: 1 },
  supplyBot: { t: 2, x: 0.9, thin: 1 },
  tradeBot: { t: 1, x: 0.8, thin: 1 },

  // ---- 星际帝国 ----
  battlecruiser: { c: 5, d: 1, x: 1.8, sc: 3.9 },
  corvette: { c: 1, d: 1, x: 0.9 },
  dreadnaught: { c: 7, d: 1, x: 0.7, sc: 5.2 },
  fleetHQ: { base: 1, def: 8, x: 3.2 },
  imperialFighter: { c: 2, x: 1.8 },
  imperialFrigate: { c: 4, x: 1.9, sc: 1.3 },
  recyclingStation: { base: 1, def: 4, out: 1, t: 1, x: 1.4, choice: 1 },
  royalRedoubt: { base: 1, def: 6, out: 1, c: 3, x: 0.7 },
  spaceStation: { base: 1, def: 4, out: 1, c: 2, x: 1.4, sc: 4 },
  surveyShip: { t: 1, d: 1, x: 0.3, sc: 0.9 },
  warWorld: { base: 1, def: 4, out: 1, c: 3, x: 1.1 },

  // ---- 贸易联邦 ----
  barterWorld: { base: 1, def: 4, a: 2, t: 2, x: 0.8, choice: 1, sc: 5.2 },
  centralOffice: { base: 1, def: 6, t: 2, x: 1.1 },
  commandShip: { a: 4, c: 5, d: 2, x: 1.5 },
  cutter: { a: 4, t: 2, x: 1.3 },
  defenseCenter: { base: 1, def: 5, out: 1, a: 3, c: 2, x: 0.7, choice: 1 },
  embassyYacht: { a: 3, t: 2, x: 1.3 },
  federationShuttle: { t: 2, x: 0.8 },
  flagship: { c: 5, d: 1, x: 1.3 },
  freighter: { t: 4, x: 0.7 },
  portOfCall: { base: 1, def: 6, out: 1, t: 3, x: 1.1, sc: 3.9 },
  tradeEscort: { a: 4, c: 4, x: 0.7 },
  tradingPost: { base: 1, def: 4, out: 1, a: 1, t: 1, x: 0.9, choice: 1, sc: 3.1 },

  // ---- 殖民战争 ----
  battleBot: { c: 2, x: 1.0, thin: 1 },
  solarSkiff: { t: 2, x: 0.7 },
  starBarge: { t: 2, x: 1.5 },
  swarmer: { c: 3, x: 0.9, row: 1 },
  lancer: { c: 4, x: 1.1 },
  predator: { c: 4, x: 0.8 },
  repairBot: { t: 2, x: 0.8, thin: 1, sc: 2.1 },
  stellarReef: { base: 1, def: 3, t: 1, x: 0.4, sc: 3 },
  storageSilo: { base: 1, def: 3, a: 2, x: 0.8 },
  tradeHauler: { t: 3, x: 0.8 },
  warningBeacon: { base: 1, def: 2, out: 1, c: 2, x: 0.5 },
  cargoPod: { t: 3, x: 1.3, sc: 3.1 },
  convoyBot: { c: 4, x: 0.9, thin: 1 },
  falcon: { c: 2, d: 1, x: 0.4, sc: 0.9 },
  orbitalPlatform: { base: 1, def: 4, x: 1.8 },
  patrolCutter: { t: 2, c: 3, x: 1.0 },
  ravager: { c: 6, x: 1.5 },
  bioformer: { base: 1, def: 4, c: 3, x: 0.7, sc: 3 },
  centralStation: { base: 1, def: 5, t: 2, x: 1.1 },
  commandCenter: { base: 1, def: 4, out: 1, t: 2, x: 1.5 },
  frontierFerry: { t: 3, a: 4, x: 1.1, sc: 2.5 },
  gunship: { c: 5, x: 1.7, sc: 4 },
  miningMech: { t: 3, x: 1.0, thin: 1 },
  theOracle: { base: 1, def: 5, out: 1, thin: 1, x: 1.5 },
  agingBattleship: { c: 5, x: 1.5, sc: 4.6 },
  colonySeedShip: { t: 3, c: 3, a: 3, x: 0.7 },
  heavyCruiser: { c: 4, d: 1, x: 0.9 },
  mechCruiser: { c: 6, x: 1.7, thin: 1 },
  parasite: { c: 6, x: 2.0, choice: 1 },
  stealthTower: { base: 1, def: 5, out: 1, x: 3.6, copy: 1 },
  federationShipyard: { base: 1, def: 6, out: 1, t: 2, x: 1.3 },
  frontierStation: { base: 1, def: 6, out: 1, t: 2, c: 3, x: 0.3, choice: 1 },
  peacekeeper: { c: 6, a: 6, x: 0.7 },
  plasmaVent: { base: 1, def: 5, c: 4, x: 1.1, sc: 2.5 },
  supplyDepot: { base: 1, def: 5, out: 1, x: 2.0 },
  imperialPalace: { base: 1, def: 6, out: 1, d: 1, x: 1.5 },
  loyalColony: { base: 1, def: 6, t: 3, c: 3, a: 3, x: 0.5 },
  moonwurm: { c: 8, d: 1, x: 1.8 },
  theWrecker: { c: 6, thin: 2, x: 1.1 },
  emperorsDreadnaught: { c: 8, d: 1, x: 1.7 },
  factoryWorld: { base: 1, def: 7, out: 1, t: 3, x: 2.2 },
  leviathan: { c: 9, d: 1, x: 2.2 },
  theIncinerator: { base: 1, def: 7, out: 1, thin: 2, x: 2.2 },

  // ---- 边疆 / 危机（新增牌包里估值最容易走样的几张，写死做加成；其余走文本解析） ----
  fr_blobAlpha: { c: 10, x: 0.4 },
  fr_crusher: { c: 6, x: 1.0 },
  fr_hiveQueen: { c: 7, d: 1, x: 4.2 },
  fr_pulverizer: { c: 3.4, row: 1, x: 1.2 },
  fr_gateship: { x: 6.0 },
  fr_transitNexus: { base: 1, def: 6, t: 4, c: 3, a: 5, x: 0.4 },
  fr_federationBattleship: { c: 5, a: 5, d: 1, x: 1.4, sc: 4.0 },
  fr_orbitalShuttle: { t: 3, a: 2.2, d: 0.5 },
  cf_capitolWorld: { base: 1, def: 4, a: 6, d: 1 },
  cf_starFortress: { base: 1, def: 4, c: 3, x: 0.8 },
  cb_obliterator: { c: 9.4, x: 0.5 },
  cb_defenseBot: { c: 4.6, thin: 1 }
});

const UNKNOWN_PROFILE = Object.freeze({ t: 0, c: 0, a: 0, d: 0, x: 0, thin: 0, row: 0 });
const parsedCache = Object.create(null);

// 卡面切成「主效果 / 同盟 / 双同盟 / 销毁 / 可选」五段。新牌包的中文卡面是引擎
// 按已实现效果反写的，所以分段解析对没见过的卡同样有效。
function sectionsOf(text) {
  const parts = { primary: '', ally: '', double: '', scrap: '', optional: '' };
  const s = String(text || '').replace(/\r/g, '');
  for (const raw of s.split(/[\n；;]/)) {
    const chunk = raw.trim();
    if (!chunk) continue;
    if (/^双同盟/.test(chunk)) parts.double += chunk.slice(3) + ' ';
    else if (/^同盟/.test(chunk)) parts.ally += chunk.slice(2) + ' ';
    else if (/^销毁/.test(chunk)) parts.scrap += chunk.slice(2) + ' ';
    else if (/^可选/.test(chunk)) parts.optional += chunk.slice(2) + ' ';
    else parts.primary += chunk + ' ';
  }
  return parts;
}

// 只在「获得 N 单位」句式上取数；前面 12 个字里出现「若」的按条件收益折半。
function pickGains(seg, unit) {
  if (!seg) return 0;
  const re = new RegExp(`获得\\s*(\\d+)\\s*${unit}`, 'g');
  let total = 0;
  let m;
  while ((m = re.exec(seg))) {
    const before = seg.slice(Math.max(0, m.index - 12), m.index);
    total += Number(m[1]) * (/若/.test(before) ? 0.5 : 1);
  }
  return total;
}

function pickDraw(seg) {
  if (!seg) return 0;
  const re = /抽\s*(\d+)\s*张/g;
  let total = 0;
  let m;
  while ((m = re.exec(seg))) {
    const before = seg.slice(Math.max(0, m.index - 12), m.index);
    total += Number(m[1]) * (/若|每/.test(before) ? 0.5 : 1);
  }
  return total;
}

function segmentValue(seg) {
  if (!seg) return 0;
  let v = 0;
  if (/摧毁目标基地/.test(seg)) v += 4.2;
  if (/免费获得/.test(seg)) v += 4.6;
  if (/等同于其费用/.test(seg)) v += 1.6;
  if (/每销毁一张|每弃一张/.test(seg)) v += 1.1;
  if (/目标对手弃/.test(seg)) v += 1.0;
  if (/弃\s*\d*\s*张牌，?(然后|再)|回收/.test(seg)) v += 0.6;
  if (/置于牌库顶/.test(seg)) v += 0.7;
  if (/置入手牌/.test(seg)) v += 1.0;
  return v;
}

function parseProfile(text, card) {
  const parts = sectionsOf(text);
  const prim = parts.primary;
  const allySeg = parts.ally + ' ' + parts.double;
  const scrapSeg = parts.scrap;
  const optSeg = parts.optional;
  const allyValue = pickGains(allySeg, '贸易') * 1.0 + pickGains(allySeg, '战斗') * 1.05 +
    pickGains(allySeg, '权威') * 0.95 + pickDraw(allySeg) * 1.25 + segmentValue(allySeg);
  const scrapValue = pickGains(scrapSeg, '贸易') * 1.0 + pickGains(scrapSeg, '战斗') * 1.05 +
    pickGains(scrapSeg, '权威') * 0.95 + pickDraw(scrapSeg) * 1.25 + segmentValue(scrapSeg);
  const rowMatches = prim.match(/销毁交易行\s*(\d+|一|两|二|三)/);
  let row = 0;
  if (rowMatches) row = /^\d+$/.test(rowMatches[1]) ? Number(rowMatches[1]) : (/一/.test(rowMatches[1]) ? 1 : 2);
  if (!row && /销毁交易行/.test(prim)) row = 1;
  const thin = /销毁\s*[1-2一二两]\s*张|销毁手牌|销毁弃牌堆/.test(prim + ' ' + optSeg) ? 1 : 0;
  return {
    t: pickGains(prim, '贸易'),
    c: pickGains(prim, '战斗'),
    a: pickGains(prim, '权威'),
    d: pickDraw(prim),
    x: allyValue * 0.55 + scrapValue * 0.25 + segmentValue(prim),
    thin,
    row,
    sc: scrapValue > 0 ? clamp(scrapValue, 0, 6) : 0,
    base: card && card.type === 'base' ? 1 : 0,
    def: num(card && card.defense),
    out: card && card.outpost ? 1 : 0,
    cost: num(card && card.cost)
  };
}

function profileOf(view, uid) {
  const card = view && view.cards ? view.cards[uid] : null;
  if (!card) return UNKNOWN_PROFILE;
  const known = !card.copiedFrom && CARD_TABLE[card.id];
  if (known) return known;
  const key = String(card.text || '') + '|' + String(card.type || '');
  if (!parsedCache[key]) parsedCache[key] = parseProfile(card.text, card);
  return parsedCache[key];
}

function intrinsic(p) {
  if (!p) return 0;
  const oneShot = num(p.t) * 1.0 + num(p.c) * 1.05 + num(p.a) * 0.95 + num(p.d) * 1.25;
  const thin = num(p.thin) * 1.5 + num(p.row) * 0.55;
  let value;
  if (p.base) {
    value = oneShot * RECUR + num(p.def) * 0.4 + (p.out ? 2.6 : 0) + thin * RECUR + num(p.x) * 1.15;
  } else {
    value = oneShot + thin + num(p.x);
  }
  // 完全没读懂的新卡：按费用给一个保守先验，宁可低估也不把它当 0 永远不买
  if (value <= 0.01 && num(p.cost) > 0) value = num(p.cost) * 0.9;
  return value;
}

function cardValue(view, uid) {
  return intrinsic(profileOf(view, uid));
}

// ---------------------------------------------------------------------------
// 座位 / 队伍口径（不写死人数、队伍人数、大将座位）
// ---------------------------------------------------------------------------
function playerOf(view, id) {
  return (view && view.players && view.players[id]) || {};
}

function isEmperorSeat(view, id) {
  return Array.isArray(view.emperors) && view.emperors.indexOf(id) >= 0;
}

function isAllyOf(view, playerId, other) {
  if (!other || other.id === playerId) return false;
  if (!isTeamLike(view.mode)) return false;
  const me = playerOf(view, playerId);
  const team = me.team;
  if (team === null || team === undefined) return false;
  return other.team === team;
}

function enemiesOf(view, playerId) {
  return (view.players || []).filter(p => p && p.id !== playerId && !p.eliminated && !isAllyOf(view, playerId, p));
}

function startAuthorityOf(view, p) {
  if (view.mode === 'team2v2') return 75;
  if (view.mode === 'hydra3') return 100;
  if (view.mode === 'emperor') return isEmperorSeat(view, p.id) ? 60 : 50;
  return 50;
}

// 右手边玩家 = 逆序的下一个存活座位（firstBlood 的「首位败北者右手边获胜」用它）
function rightNeighbourSeat(view, seat) {
  const list = view.players || [];
  const n = list.length;
  for (let step = 1; step <= n; step++) {
    const id = ((seat - step) % n + n) % n;
    const p = list[id];
    if (p && !p.eliminated && id !== seat) return id;
  }
  return null;
}

// 同队按座位升序连续行动：下一个行动的队友是「座位比我大的最小队友」，否则环形回到第一个
function nextTeammateId(view, playerId) {
  if (!isTeamLike(view.mode)) return null;
  const me = playerOf(view, playerId);
  if (me.team === null || me.team === undefined) return null;
  const mates = (view.players || [])
    .filter(p => p && p.id !== playerId && !p.eliminated && p.team === me.team)
    .map(p => p.id)
    .sort((a, b) => a - b);
  if (!mates.length) return null;
  for (const id of mates) if (id > playerId) return id;
  return mates[0];
}

// ---------------------------------------------------------------------------
// 局面上下文：三段权重就在这里
// ---------------------------------------------------------------------------
function deckAverage(view, playerId) {
  const me = playerOf(view, playerId);
  const seen = [...(me.hand || []), ...(me.discard || [])];
  for (const uid of me.inPlay || []) {
    // 场上基地不再回到牌库，不计入「下回合会抽到什么」的平均值
    const card = view.cards[uid];
    if (card && card.type !== 'base') seen.push(uid);
  }
  let sum = 0;
  let count = 0;
  for (const uid of seen) {
    const card = view.cards[uid];
    if (!card) continue;
    sum += intrinsic(profileOf(view, uid));
    count++;
  }
  return count ? sum / count : 1.0;
}

function enemyBoardValue(view, playerId) {
  let sum = 0;
  for (const p of enemiesOf(view, playerId)) {
    for (const uid of p.inPlay || []) sum += intrinsic(profileOf(view, uid));
  }
  return sum;
}

function countBlobs(view, playerId) {
  const me = playerOf(view, playerId);
  let n = 0;
  for (const uid of me.playedThisTurn || []) {
    const card = view.cards[uid];
    if (card && card.faction === 'blob') n++;
  }
  return n;
}

function buildContext(view, playerId, context, memory) {
  const me = playerOf(view, playerId);
  const turn = num(context && context.turn) || num(view.turn) || 1;
  const enemies = enemiesOf(view, playerId);
  const auths = enemies.map(p => num(p.authority));
  const minOpp = auths.length ? Math.min.apply(null, auths) : 50;
  const maxOpp = auths.length ? Math.max.apply(null, auths) : 50;

  const startAuth = Math.max(1, startAuthorityOf(view, me));
  const meRatio = num(me.authority) / startAuth;
  let oppMinRatio = 1;
  let oppMaxRatio = 0;
  for (const p of enemies) {
    const r = num(p.authority) / Math.max(1, startAuthorityOf(view, p));
    if (r < oppMinRatio) oppMinRatio = r;
    if (r > oppMaxRatio) oppMaxRatio = r;
  }

  const expansions = view.expansions || {};
  // 只开殖民战争时节奏明显更快（低费牌多、对局短），经济窗口要收窄
  const fast = !!expansions.colonyWars && !expansions.core;
  const teamLike = isTeamLike(view.mode);
  // 起始权威越高（2v2 75 / 3v3 100）对局越长，经济段要按比例拉长
  const scale = startAuth / 50;
  const period = Math.max(4.5, (fast ? 5.6 : 7) * scale * (teamLike ? 1.05 : 1));
  const econ = clamp(1 - (turn - 1) / period, 0, 1);

  const danger = clamp((0.62 - meRatio) / 0.46, 0, 1.2);
  const finish = clamp((0.42 - oppMinRatio) / 0.26, 0, 1.5);
  const race = clamp((oppMaxRatio - meRatio) / 0.36, 0, 1.2);
  const threat = clamp(enemyBoardValue(view, playerId) / (18 * Math.max(1, enemies.length)), 0, 1.2);

  const avg = deckAverage(view, playerId);
  // 门槛跟牌库平均价值走：只有明显优于现有牌才买，避免后期买废牌稀释牌库
  const floor = clamp(avg + 0.1, 2.4, 6.2);

  return {
    turn,
    fast,
    teamLike,
    sharedTeam: isSharedTeam(view.mode),
    isEmperor: view.mode === 'emperor',
    iAmEmperor: view.mode === 'emperor' && isEmperorSeat(view, playerId),
    econ,
    danger,
    finish,
    race,
    threat,
    floor,
    deckAvg: avg,
    startAuth,
    meAuth: num(me.authority),
    meTrade: num(me.trade),
    meCombat: num(me.combat),
    minOpp,
    maxOpp,
    enemies,
    enemyCount: Math.max(1, enemies.length),
    blobs: countBlobs(view, playerId),
    me,
    mode: view.mode,
    playerId,
    memory
  };
}

function buyValue(p, ctx) {
  let v = intrinsic(p);
  if (p.choice) v -= 1.0 + (num(p.t) + num(p.c) + num(p.a)) * 0.2;
  v += num(p.t) * 1.0 * ctx.econ; // 第一段：贸易加成
  v += num(p.c) * 0.85 * (1 - ctx.econ); // 第三段：战斗加成
  v += num(p.c) * 0.55 * (ctx.race + ctx.threat * 0.6);
  v += (p.out ? 2.2 : 0) * (ctx.danger + ctx.threat);
  v += num(p.a) * 0.5 * ctx.danger;
  v += num(p.c) * 0.6 * ctx.finish;
  return v;
}

function preferCombat(ctx) {
  if (ctx.finish > 0.2) return true;
  return ctx.econ < 0.4;
}

function needTradeNow(ctx) {
  if (ctx.econ <= 0.2) return false;
  return ctx.meTrade < 4;
}

// ---------------------------------------------------------------------------
// 基地 / 前哨
// ---------------------------------------------------------------------------
function defLeft(view, uid) {
  const card = view.cards && view.cards[uid];
  if (!card) return 1;
  const dealt = view.damage && view.damage[uid] ? num(view.damage[uid]) : 0;
  return Math.max(1, num(card.defense) - dealt);
}

function isEnemyOutpost(view, playerId, uid) {
  const card = view.cards && view.cards[uid];
  if (!card || card.type !== 'base' || !card.outpost) return false;
  const ownerId = typeof card.owner === 'number' ? card.owner : null;
  if (ownerId === null) return true;
  if (ownerId === playerId) return false;
  const owner = playerOf(view, ownerId);
  if (!owner || owner.id === undefined) return true;
  return !isAllyOf(view, playerId, owner);
}

// 对手（整队口径）最厚的一面前哨剩余防御；0 表示正面可攻击。
function enemyOutpostWall(view, playerId) {
  let wall = 0;
  for (const p of enemiesOf(view, playerId)) {
    for (const uid of p.inPlay || []) {
      if (!isEnemyOutpost(view, playerId, uid)) continue;
      wall = Math.max(wall, defLeft(view, uid));
    }
  }
  return wall;
}

// 最近一座被打残的敌方基地剩余防御（团队模式下伤害会留给队友收）
function softestEnemyBase(view, playerId) {
  let best = 99;
  for (const p of enemiesOf(view, playerId)) {
    for (const uid of p.inPlay || []) {
      const card = view.cards[uid];
      if (!card || card.type !== 'base') continue;
      best = Math.min(best, defLeft(view, uid));
    }
  }
  return best === 99 ? 0 : best;
}

// ---------------------------------------------------------------------------
// 多选一：按卡面分支文本打分（对新牌包同样有效）
// ---------------------------------------------------------------------------
function splitBranches(text) {
  const s = String(text || '');
  const cut = s.indexOf('选择');
  const body = cut >= 0 ? s.slice(cut + 2) : s;
  return body
    .replace(/^[:：]\s*/, '')
    .split(/；?\s*或\s*|\n/)
    .map(part => part.trim())
    .filter(Boolean);
}

function branchValue(seg, ctx) {
  if (!seg) return 0;
  let v = 0;
  v += pickGains(seg, '贸易') * (1.0 + ctx.econ * 0.5);
  v += pickGains(seg, '战斗') * (1.0 + (1 - ctx.econ) * 0.5);
  v += pickGains(seg, '权威') * (0.95 + ctx.danger * 0.5);
  v += pickDraw(seg) * 1.25;
  if (/摧毁目标基地/.test(seg)) v += 4.0;
  if (/免费获得/.test(seg)) v += 4.4;
  if (/每打出过一张/.test(seg)) v += 1.4 + ctx.blobs * 1.1;
  if (/弃至多|回收|弃\s*\d*\s*张牌/.test(seg)) v += 0.8;
  if (/销毁/.test(seg)) v += 0.5;
  return v;
}

function choiceValue(view, cardId, choice, ctx) {
  const card = view.cards && view.cards[cardId];
  const branches = splitBranches(card && card.text);
  if (!branches.length) return 4.0;
  const seg = branches[choice];
  if (seg === undefined) return 4.0;
  return clamp(branchValue(seg, ctx), 0.2, 12);
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const fallback = () => {
    const list = Array.isArray(legalActions) ? legalActions : [];
    if (!list.length) return { type: 'endTurn' };
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a && a.type === 'endTurn') return a;
    }
    return list[0];
  };

  try {
    if (!Array.isArray(legalActions) || !legalActions.length) return fallback();
    if (!view || !Array.isArray(view.players) || !view.players[playerId]) return fallback();

    const mem = memory || {};
    mem.calls = (mem.calls || 0) + 1;
    const ctx = buildContext(view, playerId, context, mem);

    // 待决阶段：引擎只会给该待决类型的动作，此时不要去找 play / buy
    const firstAction = legalActions[0] || {};
    let onlyPending = PENDING_TYPES.has(firstAction.type);
    if (onlyPending) {
      for (let i = 1; i < legalActions.length; i++) {
        if (!PENDING_TYPES.has(legalActions[i] && legalActions[i].type)) { onlyPending = false; break; }
      }
    }
    if (onlyPending) {
      const index = choosePending(view, legalActions, playerId, ctx);
      if (index >= 0) return legalActions[index];
      return fallback();
    }

    let index = choosePlay(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseAbility(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseAttack(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseBuy(view, legalActions, playerId, ctx);
    if (index >= 0) {
      if (legalActions[index] && legalActions[index].explorer) mem.explorers = (mem.explorers || 0) + 1;
      return legalActions[index];
    }

    index = chooseTransfer(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseMoveCard(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    return fallback();
  } catch (err) {
    return fallback();
  }
}

// ---------------------------------------------------------------------------
// 1) 出牌：先基地（为「多座基地」和同盟铺垫），再抽牌牌，复制类最后
// ---------------------------------------------------------------------------
function rowCardValue(view, row) {
  if (!view.tradeRow || row === undefined || row === null) return 0;
  const uid = view.tradeRow[row];
  return uid ? cardValue(view, uid) : 0;
}

function optionValue(view, action, ctx) {
  const card = (view.cards && view.cards[action.cardId]) || {};
  if (action.copy) return cardValue(view, action.copy);
  let v = 0;
  let hasBranch = false;
  if (action.choice !== undefined) {
    v += choiceValue(view, action.cardId, action.choice, ctx);
    hasBranch = true;
  }
  if (action.row !== undefined) {
    v += rowCardValue(view, action.row);
    hasBranch = true;
  }
  if (!hasBranch && num(card.cost) === 0) v = 1.0;
  return v;
}

function playRank(view, action, ctx) {
  const card = (view.cards && view.cards[action.cardId]) || {};
  const p = profileOf(view, action.cardId);
  let rank = 1.0;
  if (card.type === 'base') rank += 1.2;
  // 团队模式：前哨保护的是整队，早一拍落地收益更高
  if (card.type === 'base' && card.outpost && ctx.teamLike) rank += 0.5;
  if (num(p.d) > 0) rank += 0.9;
  if (p.copy || card.copyShip) rank -= 5.0; // 复制类必须等别的牌先进场
  rank += 0.02 * optionValue(view, action, ctx);
  return rank;
}

function choosePlay(view, legalActions, playerId, ctx) {
  let bestIndex = -1;
  let bestRank = -Infinity;
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'play') continue;
    const rank = playRank(view, action, ctx);
    if (rank > bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// 2) 能力：主要 -> 同盟（含双同盟）-> 可选 -> 销毁
//    所有附加字段（choice / row / rows / targets / targetId / double）都原样使用
// ---------------------------------------------------------------------------
function handOf(view, playerId) {
  return playerOf(view, playerId).hand || [];
}

function sectionForKind(card, kind, action) {
  const parts = sectionsOf(card && card.text);
  if (kind === 'ally') return action && action.double ? parts.double : parts.ally;
  if (kind === 'optional') return parts.optional;
  if (kind === 'scrap') return parts.scrap;
  return parts.primary;
}

function targetsScore(view, action, ctx, kind) {
  const targets = action.targets || [];
  const card = (view.cards && view.cards[action.cardId]) || {};
  const seg = sectionForKind(card, kind, action);
  const hand = handOf(view, ctx.playerId);
  let score = 0;
  let costSum = 0;
  for (const uid of targets) {
    const value = cardValue(view, uid);
    const inHand = hand.indexOf(uid) >= 0;
    // 销毁/弃掉一张牌：失去它，换来一次牌库过滤（弃牌堆的牌本来也要重洗）
    score += (inHand ? 2.2 : 2.6) - value;
    const c = view.cards && view.cards[uid];
    if (c) costSum += num(c.cost);
  }
  if (/每销毁一张|每弃一张|等量|再抽/.test(seg)) score += targets.length * 1.35;
  if (/每销毁一张/.test(seg) && /战斗/.test(seg)) score += targets.length * 1.1;
  if (/等同于其费用/.test(seg) && targets.length) score += costSum * 0.8;
  if (action.resource === 'combat') score += targets.length * 0.4; // depot 选战斗
  return score;
}

function targetAbilityScore(view, action, ctx, kind) {
  const targetId = action.targetId;
  if (targetId === null || targetId === undefined) return 0;
  const card = view.cards && view.cards[targetId];
  if (!card || card.type !== 'base') return 0;
  const outpost = isEnemyOutpost(view, ctx.playerId, targetId);
  let score = kind === 'scrap' ? 6.6 : 6.2;
  if (outpost) score += 2.6; // 拆掉前哨等于给全队解封
  score += clamp(cardValue(view, targetId) * 0.12, 0, 1.8);
  if (defLeft(view, targetId) <= 2) score += 1.0;
  return score;
}

function rowAbilityScore(view, action, ctx, kind, card) {
  const rows = action.rows || (action.row !== undefined ? [action.row] : []);
  const seg = sectionForKind(card, kind, action);
  if (!rows.length) return 0;
  let bestRowValue = 0;
  let bestRow = -1;
  for (const row of rows) {
    const v = rowCardValue(view, row);
    if (v > bestRowValue) { bestRowValue = v; bestRow = row; }
  }
  let score = 0;
  if (/销毁交易行/.test(seg) && /等同于其费用|获得.*战斗/.test(seg)) {
    // 销毁交易行换战斗：本刀战斗量 = 该卡费用
    const uid = view.tradeRow && view.tradeRow[bestRow];
    const cost = uid && view.cards[uid] ? num(view.cards[uid].cost) : 2;
    score = 3.0 + cost * 0.55;
    if (ctx.finish > 0.3) score += 1.0;
  } else if (/免费获得/.test(seg)) {
    // 免费拿交易行一张牌：拿最贵的
    score = 4.6 + bestRowValue * 0.55;
  } else if (/销毁交易行/.test(seg)) {
    // 纯销毁交易行：只有在对手买得起的高价值牌上才用来卡对手
    let bestValue = 0;
    let affordable = false;
    for (const row of rows) {
      const uid = view.tradeRow && view.tradeRow[row];
      if (!uid) continue;
      const c = view.cards[uid];
      if (!c) continue;
      bestValue = Math.max(bestValue, cardValue(view, uid));
      if (num(ctx.meTrade) >= num(c.cost)) affordable = true;
    }
    if (bestValue >= 8.5 && !affordable) score = 4.5;
  }
  // destroyAndOrScrap：同时带 targetId 时把拆基地的价值加上
  if (action.targetId !== undefined && action.targetId !== null) {
    score += targetAbilityScore(view, action, ctx, kind);
  }
  return score;
}

function abilityScore(view, action, playerId, ctx) {
  const kind = action.ability;
  const card = (view.cards && view.cards[action.cardId]) || {};

  if (kind === 'scrap') {
    if (action.targetId === null || action.targetId === undefined) {
      if (action.row !== undefined || action.rows !== undefined) return rowAbilityScore(view, action, ctx, kind, card);
      // 销毁自身：只有收益能换到东西时才做
      const p = profileOf(view, action.cardId);
      const sc = num(p.sc);
      const wall = enemyOutpostWall(view, playerId);
      const combat = num(playerOf(view, playerId).combat);
      if (sc > 0 && wall <= 0 && combat + sc >= ctx.minOpp) return 8.0; // 销毁正好凑出斩杀
      if (/摧毁目标基地/.test(sectionForKind(card, kind, action))) return 0;
      if (ctx.turn >= 8 && intrinsic(p) <= 3.3) return 4.0;
      return 0;
    }
  }

  if (action.targets !== undefined) return targetsScore(view, action, ctx, kind);
  if (action.rows !== undefined || action.row !== undefined) return rowAbilityScore(view, action, ctx, kind, card);
  if (action.choice !== undefined) return choiceValue(view, action.cardId, action.choice, ctx);
  if (action.targetId !== undefined) return targetAbilityScore(view, action, ctx, kind);

  // 无附加字段的能力：按卡面判断是否值得发动
  if (kind === 'primary') {
    const seg = sectionForKind(card, kind, action);
    if (/销毁手牌/.test(seg) || /销毁\s*1\s*张/.test(seg)) {
      // 会强制销毁一张手牌：手里全是好牌时宁可不发动
      const hand = handOf(view, playerId);
      if (!hand.length) return 6.0;
      let worst = Infinity;
      for (const uid of hand) worst = Math.min(worst, cardValue(view, uid));
      return worst <= 3.5 ? 6.0 : 0;
    }
    if (/摧毁目标基地/.test(seg) && action.targetId === undefined) return 0;
    return 6.0;
  }

  if (kind === 'ally') {
    const seg = sectionForKind(card, kind, action);
    if (/摧毁目标基地/.test(seg)) return 0; // 缺 targetId 的分支不合法，交给引擎过滤
    let base = 6.0;
    if (action.double) base -= 0.2; // 双同盟排在普通同盟之后用
    return base;
  }

  return 0;
}

function chooseAbility(view, legalActions, playerId, ctx) {
  const groups = { primary: [], ally: [], optional: [], scrap: [] };
  const loose = [];
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'ability') continue;
    const bucket = groups[action.ability];
    if (bucket) bucket.push(i);
    else loose.push(i); // 未知能力键：按主要能力的口径兜底打分
  }
  for (const kind of ['primary', 'ally', 'optional', 'scrap']) {
    const bucket = groups[kind];
    if (!bucket.length) continue;
    let bestIndex = -1;
    let bestScore = 0;
    for (const i of bucket) {
      const score = abilityScore(view, legalActions[i], playerId, ctx);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) return bestIndex;
  }
  if (loose.length) {
    let bestIndex = -1;
    let bestScore = 0;
    for (const i of loose) {
      const score = abilityScore(view, legalActions[i], playerId, ctx);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) return bestIndex;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 3) 攻击：只做「本回合有效」的伤害（基地伤害在队末才清零）
// ---------------------------------------------------------------------------
function chooseAttack(view, legalActions, playerId, ctx) {
  const me = playerOf(view, playerId);
  if (num(me.combat) <= 0) return -1;

  // firstBlood：谁先被打死，他的右手边玩家立刻获胜 —— 只对「我的右手边猎物」下杀手
  const lethalForbidden = targetId =>
    view.mode === 'firstBlood' && rightNeighbourSeat(view, targetId) !== playerId;

  const face = [];
  const bases = [];
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'attack') continue;
    if (action.targetType === 'player') {
      const targetId = action.targetId;
      const authority = num(playerOf(view, targetId).authority);
      const amount = num(action.amount);
      if (amount <= 0) continue;
      if (amount >= authority && lethalForbidden(targetId)) continue; // 不替别人做嫁衣
      face.push({ i, action, amount, authority, targetId });
    } else if (action.targetType === 'base') {
      bases.push({ i, action });
    } else {
      // 未知 targetType：按基地/玩家都不成立处理，直接跳过
    }
  }

  if (face.length) {
    // 能斩杀就先斩杀，并且只投入恰好足够的战斗，多余战斗留给其他目标
    let lethalIndex = -1;
    let lethalScore = -Infinity;
    for (const item of face) {
      if (item.amount < item.authority) continue;
      let score = 100 - item.amount * 0.01;
      if (ctx.isEmperor && isEmperorSeat(view, item.targetId)) score += 40; // 大将被击败 = 直接赢
      if (score > lethalScore) {
        lethalScore = score;
        lethalIndex = item.i;
      }
    }
    if (lethalIndex >= 0) return lethalIndex;

    // 否则集火权威最低的对手（team2v2 / hydra3 是共享权威，打谁都一样）
    let bestTarget = null;
    let bestRatio = Infinity;
    for (const item of face) {
      const ratio = item.authority / Math.max(1, startAuthorityOf(view, playerOf(view, item.targetId)));
      const bonus = ctx.isEmperor && isEmperorSeat(view, item.targetId) ? -0.05 : 0;
      if (ratio + bonus < bestRatio) {
        bestRatio = ratio + bonus;
        bestTarget = item.targetId;
      }
    }
    let bestIndex = -1;
    let bestAmount = -1;
    for (const item of face) {
      if (item.targetId !== bestTarget) continue;
      if (item.amount > bestAmount) {
        bestAmount = item.amount;
        bestIndex = item.i;
      }
    }
    if (bestIndex >= 0) return bestIndex;
    return face[0].i;
  }

  // 正面被前哨封住：优先打掉本回合能打掉的前哨，其次补刀已残血的基地
  let bestIndex = -1;
  let bestScore = -Infinity;
  let softIndex = -1;
  let softScore = 0;
  for (const item of bases) {
    const uid = item.action.targetId;
    const card = view.cards && view.cards[uid];
    if (!card) continue;
    const amount = num(item.action.amount);
    const left = defLeft(view, uid);
    const outpost = isEnemyOutpost(view, playerId, uid);
    const value = cardValue(view, uid);
    if (amount >= left) {
      let score = 18 + (outpost ? 28 : 0) + value * 0.6;
      if (left <= 2) score += 3; // 队友已经磨过，补刀
      if (score > bestScore) {
        bestScore = score;
        bestIndex = item.i;
      }
    } else if (ctx.teamLike && outpost && left - amount <= 2) {
      // 团队模式：伤害留到队末，磨到 1–2 点交给紧接着行动的队友收
      const score = 2.6 - (left - amount) * 0.4;
      if (score > softScore) {
        softScore = score;
        softIndex = item.i;
      }
    }
  }
  if (bestIndex >= 0) return bestIndex;
  if (softIndex >= 0) return softIndex;
  return -1;
}

// ---------------------------------------------------------------------------
// 4) 购买：价值表 + 三段权重 + 随回合抬高的门槛
// ---------------------------------------------------------------------------
function chooseBuy(view, legalActions, playerId, ctx) {
  const me = playerOf(view, playerId);
  if (num(me.trade) <= 0) return -1;

  let bestIndex = -1;
  let bestScore = -Infinity;
  let explorerIndex = -1;

  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'buy') continue;
    if (action.explorer) {
      explorerIndex = i;
      continue;
    }
    const uid = view.tradeRow ? view.tradeRow[action.row] : null;
    if (!uid) continue;
    const card = view.cards && view.cards[uid];
    if (!card) continue;
    const profile = profileOf(view, uid);
    // 门槛按「牌面绝对价值」判定：低于牌库平均水平的牌不买，避免稀释牌库
    if (intrinsic(profile) < ctx.floor) continue;
    let score = buyValue(profile, ctx) - num(card.cost) * 0.42;
    // 团队模式：前哨替全队挡刀，值得溢价；大将战：个人权威更脆，也略溢价
    if (ctx.teamLike && card.outpost) score += 1.1;
    if (ctx.isEmperor && card.outpost) score += 0.8;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) return bestIndex;

  // 结尾剩下的 2-3 贸易买探索者，等于用「本来会浪费的贸易」换一张可压缩的低价牌
  const bought = num((ctx.memory && ctx.memory.explorers) || 0);
  const explorerLimit = ctx.turn <= (ctx.fast ? 8 : 11);
  if (explorerIndex >= 0 && explorerLimit && bought < 3 && num(me.trade) >= 2 && num(me.trade) <= 4) {
    return explorerIndex;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 5) 队伍资源：队内换手前把「本回合会清零」的资源交给紧接着行动的队友
//    team2v2 / hydra3 用 transfer（队友下个 beginTurn 立即到账，可接着打同一座基地）
// ---------------------------------------------------------------------------
function chooseTransfer(view, legalActions, playerId, ctx) {
  if (!ctx.sharedTeam) return -1;
  const nextAlly = nextTeammateId(view, playerId);
  const softBase = softestEnemyBase(view, playerId);
  let bestIndex = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'transfer') continue;
    const amount = num(action.amount);
    if (amount <= 0) continue;
    // 战斗更容易在本回合兑现（对面的基地还带着伤害），因此略高于贸易
    let score = amount * (action.resource === 'combat' ? 1.1 : 1.0);
    if (nextAlly !== null && action.targetId === nextAlly) score += 0.7;
    if (action.resource === 'combat' && softBase > 0) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// 6) 大将战移牌：花 1 贸易把弃牌堆一张牌交给相邻队友
//    只在攻击/购买都无牌可打、贸易本来会浪费时做，且只送有价值的牌
// ---------------------------------------------------------------------------
function chooseMoveCard(view, legalActions, playerId, ctx) {
  if (view.mode !== 'emperor') return -1;
  if (num(ctx.meTrade) < 1) return -1;
  const nextAlly = nextTeammateId(view, playerId);
  let bestIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'moveCard') continue;
    const value = cardValue(view, action.cardId);
    if (value < 3.2) continue; // 送侦察艇没有意义，宁可留着贸易
    let score = value;
    if (nextAlly !== null && action.targetId === nextAlly) score += 0.8;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// 7) 待决动作
// ---------------------------------------------------------------------------
function choosePending(view, legalActions, playerId, ctx) {
  const type = (legalActions[0] && legalActions[0].type) || (view.pending && view.pending.type);
  if (type === 'discard' || type === 'selectScrap') return chooseDiscard(view, legalActions);
  if (type === 'targetDiscard') return chooseTargetDiscard(view, legalActions);
  if (type === 'eventChoice') return chooseEvent(view, legalActions, playerId, ctx);
  return 0;
}

function discardWeight(view, uid) {
  const card = view.cards && view.cards[uid];
  if (!card) return 2.2;
  if (card.id === 'scout') return 0.2;
  if (card.id === 'viper') return 0.3;
  if (card.id === 'explorer') return 1.0;
  return intrinsic(profileOf(view, uid));
}

function chooseDiscard(view, legalActions) {
  let bestIndex = 0;
  let bestWeight = Infinity;
  for (let i = 0; i < legalActions.length; i++) {
    const weight = discardWeight(view, legalActions[i].cardId);
    if (weight < bestWeight) {
      bestWeight = weight;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function chooseTargetDiscard(view, legalActions) {
  let bestIndex = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < legalActions.length; i++) {
    const target = playerOf(view, legalActions[i].targetId);
    // 手牌越少、权威越高，弃牌干扰越大
    let score = -num(target.handCount) + num(target.authority) * 0.03;
    if (view.mode === 'emperor' && isEmperorSeat(view, legalActions[i].targetId)) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function findEmptyTargets(legalActions) {
  for (let i = 0; i < legalActions.length; i++) {
    const targets = legalActions[i].targets;
    if (Array.isArray(targets) && targets.length === 0) return i;
  }
  return -1;
}

function chooseEvent(view, legalActions, playerId, ctx) {
  const eventId = (legalActions[0] && legalActions[0].eventId) || (view.pending && view.pending.eventId);

  if (eventId === 'blackHole') {
    // 弃牌只是进弃牌堆，不是永久损失；少弃一张要掉 4 权威，永远优先弃满
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      const targets = legalActions[i].targets || [];
      let cost = 4 * (2 - targets.length) * (ctx.meAuth <= ctx.startAuth * 0.28 ? 1.8 : 1);
      for (const uid of targets) {
        const card = view.cards && view.cards[uid];
        cost += (card ? intrinsic(profileOf(view, uid)) : 2.0) * 0.12;
      }
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  if (eventId === 'bombardment') {
    // 摧毁自家基地 vs 掉 6 权威：权威见底时必须保命，否则比较两者价值
    let payIndex = -1;
    for (let i = 0; i < legalActions.length; i++) {
      if (legalActions[i].pay) payIndex = i;
    }
    let payCost = 6 * (ctx.meAuth <= ctx.startAuth * 0.24 ? 3.0 : 1 + ctx.danger * 0.5);
    if (ctx.meAuth - 6 <= 1) payCost = 999;
    let bestIndex = payIndex >= 0 ? payIndex : 0;
    let bestCost = payCost;
    for (let i = 0; i < legalActions.length; i++) {
      const baseId = legalActions[i].baseId;
      if (!baseId) continue;
      const cost = cardValue(view, baseId) * 0.95;
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  if (eventId === 'comet') {
    // 免费压缩牌库：只销毁低价值牌，优先弃牌堆里的牌
    const hand = handOf(view, playerId);
    let bestIndex = findEmptyTargets(legalActions);
    if (bestIndex < 0) bestIndex = 0;
    let bestGain = 0;
    for (let i = 0; i < legalActions.length; i++) {
      const targets = legalActions[i].targets || [];
      let gain = 0;
      for (const uid of targets) {
        const value = cardValue(view, uid);
        const inHand = hand.indexOf(uid) >= 0;
        gain += Math.max(0, (inHand ? 2.2 : 2.8) - value) - (inHand ? 0.5 : 0);
      }
      if (gain > bestGain) {
        bestGain = gain;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  if (eventId === 'warpJump') {
    // 两张牌放回牌库顶：先放次要的，两张里较好的那张放最上面（先抽到）
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      const cards = legalActions[i].cards || [];
      if (cards.length < 2) continue;
      const v0 = cardValue(view, cards[0]);
      const v1 = cardValue(view, cards[1]);
      const cost = v0 + v1 - v0 * 0.12;
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  return 0;
}
