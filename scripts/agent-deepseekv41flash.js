// ============================================================================
// 策略名称：三段涨潮（Three-Phase Tide）
// 选择理由（一句话）：1v1 只比权威，先用贸易把每回合产出推高、再用前哨与高效战斗
// 牌锁死资源差、最后集中两三个高战斗回合兑现斩杀，比纯快攻或纯经济都更稳。
//
// 设计要点（不依赖任何外部模块）：
//   1. 主阶段按固定相位推进：打出 -> 能力 -> 攻击 -> 购买 -> 预留 -> 结束回合。
//      相位顺序保证「先产生资源、再决定消耗」，不会在资源未结算前花掉战斗。
//   2. 购买用一张手写的卡牌价值表打分，并按回合在「贸易权重 / 战斗权重 / 防守权重」
//      之间平滑切换，这就是「涨潮」的三段。
//   3. 攻击严格遵循引擎事实：基地伤害在回合末清零，所以只做「本回合能打穿」的攻击；
//      对手有前哨时，优先打掉能打掉的前哨，否则宁可不浪费战斗。
//   4. 所有待决动作（弃牌 / 指定弃牌 / 强制销毁 / 事件选择）都有显式评分与安全兜底，
//      未知动作一律回退到合法列表里的第一个元素。
// ============================================================================

export const meta = {
  name: 'deepseek v4.1flash · 三段涨潮',
  description:
    'deepseek-v4.1-flash｜策略「三段涨潮」：早期贸易滚雪球、中期前哨与高效率战斗牌锁差、末期集中火力斩杀；零依赖，五模式与 core/colonyWars/events 任意组合均可安全决策。'
};

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const num = value => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const RECUR = 1.28; // 基地主要能力按「每回合可重复使用」折算的系数

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
  theIncinerator: { base: 1, def: 7, out: 1, thin: 2, x: 2.2 }
});

const UNKNOWN_PROFILE = Object.freeze({ t: 0, c: 0, a: 0, d: 0, x: 0, thin: 0, row: 0 });
const parsedCache = Object.create(null);

// 未知卡牌的兜底解析：只取第一句主效果，宁可低估也不误判。
function parseProfile(text) {
  const s = String(text || '');
  const pick = re => {
    const m = s.match(re);
    return m ? num(Number(m[1])) : 0;
  };
  return {
    t: pick(/获得\s*(\d+)\s*贸易/),
    c: pick(/获得\s*(\d+)\s*战斗/),
    a: pick(/获得\s*(\d+)\s*权威/),
    d: pick(/抽\s*(\d+)\s*张牌/),
    x: 0,
    thin: 0,
    row: 0
  };
}

function profileOf(view, uid) {
  const card = view && view.cards ? view.cards[uid] : null;
  if (!card) return UNKNOWN_PROFILE;
  const known = CARD_TABLE[card.id];
  if (known) return known;
  if (!parsedCache[card.id]) parsedCache[card.id] = parseProfile(card.text);
  return parsedCache[card.id];
}

function intrinsic(p) {
  if (!p) return 0;
  const oneShot = num(p.t) * 1.0 + num(p.c) * 1.05 + num(p.a) * 0.95 + num(p.d) * 1.25;
  const thin = num(p.thin) * 1.5 + num(p.row) * 0.55;
  if (p.base) {
    return oneShot * RECUR + num(p.def) * 0.4 + (p.out ? 2.6 : 0) + thin * RECUR + num(p.x) * 1.15;
  }
  return oneShot + thin + num(p.x);
}

function cardValue(view, uid) {
  return intrinsic(profileOf(view, uid));
}

// ---------------------------------------------------------------------------
// 局面上下文：三段权重就在这里
// ---------------------------------------------------------------------------
function deckAverage(view, playerId) {
  const me = view.players[playerId] || {};
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
  const me = view.players[playerId] || {};
  let sum = 0;
  for (const p of view.players || []) {
    if (!p || p.id === playerId || p.eliminated) continue;
    if (view.mode === 'team2v2' && p.team === me.team) continue;
    for (const uid of p.inPlay || []) sum += intrinsic(profileOf(view, uid));
  }
  return sum;
}

function buildContext(view, playerId, context, memory) {
  const me = (view.players && view.players[playerId]) || {};
  const players = view.players || [];
  const turn = num(context && context.turn) || num(view.turn) || 1;
  const isTeam = view.mode === 'team2v2';
  const opps = players.filter(p => p && p.id !== playerId && !p.eliminated && (!isTeam || p.team !== me.team));
  const auths = opps.map(p => num(p.authority));
  const minOpp = auths.length ? Math.min.apply(null, auths) : 50;
  const maxOpp = auths.length ? Math.max.apply(null, auths) : 50;
  // 只开殖民战争时节奏明显更快（低费牌多、对局短），经济窗口要收窄
  const expansions = view.expansions || {};
  const fast = !!expansions.colonyWars && !expansions.core;
  const econ = clamp(1 - (turn - 1) / (fast ? 6 : 7), 0, 1);
  const danger = clamp((32 - num(me.authority)) / 24, 0, 1.2);
  const finish = clamp((20 - minOpp) / 12, 0, 1.5);
  const race = clamp((maxOpp - num(me.authority)) / 18, 0, 1.2); // 权威落后 = 伤害竞赛落后
  const threat = clamp(enemyBoardValue(view, playerId) / 25, 0, 1.2);
  const avg = deckAverage(view, playerId);
  // 门槛跟牌库平均价值走：只有明显优于现有牌才买，避免后期买废牌稀释牌库
  const floor = clamp(avg + 0.1, 2.4, 6.2);
  return {
    turn,
    fast,
    econ,
    danger,
    finish,
    race,
    threat,
    floor,
    deckAvg: avg,
    meAuth: num(me.authority),
    meTrade: num(me.trade),
    minOpp,
    maxOpp,
    me,
    mode: view.mode,
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

// 对手前哨的最大剩余防御；0 表示正面可攻击。
function enemyOutpostWall(view, playerId) {
  const me = view.players[playerId] || {};
  let wall = 0;
  for (const p of view.players || []) {
    if (!p || p.id === playerId || p.eliminated) continue;
    if (view.mode === 'team2v2' && p.team === me.team) continue;
    for (const uid of p.inPlay || []) {
      const card = view.cards[uid];
      if (!card || card.type !== 'base' || !card.outpost) continue;
      const left = num(card.defense) - num(view.damage && view.damage[uid]);
      wall = Math.max(wall, left);
    }
  }
  return wall;
}

function isEnemyOutpost(view, playerId, uid) {
  const card = view.cards[uid];
  const owner = card && typeof card.owner === 'number' ? view.players[card.owner] : null;
  if (!card || card.type !== 'base' || !card.outpost) return false;
  if (!owner) return true;
  if (owner.id === playerId) return false;
  if (view.mode === 'team2v2' && owner.team === (view.players[playerId] || {}).team) return false;
  return true;
}

function countBlobs(view, playerId) {
  const me = view.players[playerId] || {};
  let n = 0;
  for (const uid of me.playedThisTurn || []) {
    const card = view.cards[uid];
    if (card && card.faction === 'blob') n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const fallback = () => {
    if (!Array.isArray(legalActions) || !legalActions.length) return { type: 'endTurn' };
    const end = legalActions.find(a => a && a.type === 'endTurn');
    return end || legalActions[0];
  };

  try {
    if (!Array.isArray(legalActions) || !legalActions.length) return fallback();
    if (!view || !Array.isArray(view.players)) return fallback();

    const mem = memory || (memory = {});
    mem.calls = (mem.calls || 0) + 1;
    const ctx = buildContext(view, playerId, context, mem);

    const first = legalActions[0] || {};
    if (
      first.type === 'discard' ||
      first.type === 'selectScrap' ||
      first.type === 'targetDiscard' ||
      first.type === 'eventChoice'
    ) {
      const pendingIndex = choosePending(view, legalActions, playerId, ctx);
      return legalActions[pendingIndex >= 0 ? pendingIndex : 0];
    }

    let index = choosePlay(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseAbility(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseAttack(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    index = chooseBuy(view, legalActions, playerId, ctx);
    if (index >= 0) {
      const action = legalActions[index];
      if (action && action.explorer) mem.explorers = (mem.explorers || 0) + 1;
      return legalActions[index];
    }

    index = chooseTransfer(view, legalActions, playerId, ctx);
    if (index >= 0) return legalActions[index];

    return fallback();
  } catch (err) {
    return fallback();
  }
}

// ---------------------------------------------------------------------------
// 1) 出牌：先基地（为「两座/三座基地」和同盟铺垫），再抽牌牌，复制类最后
// ---------------------------------------------------------------------------
function playRank(view, action, ctx, playerId) {
  const card = view.cards[action.cardId] || {};
  const p = profileOf(view, action.cardId);
  let rank = 1.0;
  if (card.type === 'base') rank += 1.2;
  if (num(p.d) > 0) rank += 0.9;
  if (p.copy) rank -= 5.0; // 复制类必须等别的牌先进场
  if (card.id === 'blobWorld') rank -= 2.5; // 想多抽就先把虫群打出来
  rank += 0.001 * optionValue(view, action, ctx, playerId);
  return rank;
}

function optionValue(view, action, ctx, playerId) {
  const card = view.cards[action.cardId] || {};
  if (action.copy) return cardValue(view, action.copy);
  if (card.id === 'patrolMech') {
    if (action.choice === 0) return 3.0 + (needTradeNow(ctx) ? 2.0 : 0);
    return 5.25 + (preferCombat(ctx) ? 2.0 : 0);
  }
  if (card.id === 'parasite') {
    if (action.choice === 0) return 6.3;
    if (action.row !== undefined) {
      const uid = view.tradeRow[action.row];
      return uid ? cardValue(view, uid) * 0.95 : 0;
    }
    return 2.0;
  }
  if (action.row !== undefined) {
    const uid = view.tradeRow[action.row];
    return uid ? cardValue(view, uid) : 0;
  }
  return 5.0;
}

function choosePlay(view, legalActions, playerId, ctx) {
  let bestIndex = -1;
  let bestRank = -Infinity;
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'play') continue;
    const rank = playRank(view, action, ctx, playerId);
    if (rank > bestRank) {
      bestRank = rank;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// 2) 能力：主要 -> 同盟 -> 可选 -> 销毁
// ---------------------------------------------------------------------------
const BASE_CHOICE = Object.freeze({
  blobWorld: ['combat', 'blobDraw'],
  recyclingStation: ['trade', 'recycle'],
  barterWorld: ['authority', 'trade'],
  defenseCenter: ['authority', 'combat'],
  tradingPost: ['authority', 'trade'],
  frontierStation: ['trade', 'combat']
});

function baseChoiceScore(view, action, playerId, ctx) {
  const card = view.cards[action.cardId] || {};
  const table = BASE_CHOICE[card.id];
  if (!table) return 5.0;
  const kind = table[action.choice] || 'trade';
  if (kind === 'combat') return 4.0 + (preferCombat(ctx) ? 3.0 : 0);
  if (kind === 'trade') return 4.0 + (needTradeNow(ctx) ? 3.0 : 0);
  if (kind === 'authority') return 4.0 + (ctx.danger > 0.4 ? 3.0 : 0);
  if (kind === 'blobDraw') return 4.0 + countBlobs(view, playerId) * 1.2;
  if (kind === 'recycle') return 1.0;
  return 4.0;
}

function handOf(view, playerId) {
  const me = view.players[playerId] || {};
  return me.hand || [];
}

function targetsScore(view, action, playerId) {
  const targets = action.targets || [];
  let score = 0;
  const hand = handOf(view, playerId);
  for (const uid of targets) {
    const value = cardValue(view, uid);
    const inHand = hand.indexOf(uid) >= 0;
    score += 3.0 - value - (inHand ? 0.9 : 0);
  }
  const card = view.cards[action.cardId] || {};
  if (card.id === 'brainWorld') score += targets.length * 1.3; // 每销毁一张抽一张
  return score;
}

function abilityScore(view, action, playerId, ctx) {
  const kind = action.ability;
  const card = view.cards[action.cardId] || {};
  const p = profileOf(view, action.cardId);

  if (kind === 'primary') {
    if (action.targets !== undefined) return targetsScore(view, action, playerId);
    if (action.choice !== undefined) return baseChoiceScore(view, action, playerId, ctx);
    if (action.targetId !== undefined) return 8.0;
    if (card.id === 'machineBase') {
      // 会强制销毁一张手牌；手牌里全是好牌时宁可不发动
      const hand = handOf(view, playerId);
      let worst = Infinity;
      for (const uid of hand) worst = Math.min(worst, cardValue(view, uid));
      if (!hand.length) return 6.0;
      return worst <= 3.5 ? 6.0 : 0;
    }
    return 6.0;
  }

  if (kind === 'ally') {
    if (action.targetId !== undefined && action.row !== undefined) return 7.0;
    if (action.targetId !== undefined) return 7.3;
    if (action.row !== undefined) return 6.0 + (view.tradeRow[action.row] ? cardValue(view, view.tradeRow[action.row]) * 0.05 : 0);
    if (action.targets !== undefined) return targetsScore(view, action, playerId);
    return 6.0;
  }

  if (kind === 'optional') {
    if (action.targets !== undefined) return targetsScore(view, action, playerId);
    if (action.targetId !== undefined) return 7.0;
    if (action.rows !== undefined || action.row !== undefined) {
      const rows = action.rows || (action.row !== undefined ? [action.row] : []);
      let best = 0;
      let affordable = false;
      for (const row of rows) {
        const uid = view.tradeRow[row];
        if (!uid) continue;
        const c = view.cards[uid];
        if (!c) continue;
        best = Math.max(best, cardValue(view, uid));
        if (num(ctx.meTrade) >= num(c.cost)) affordable = true;
      }
      // 只是「销毁交易行」：只有在对手买得起的高价值牌上才用来卡对手
      if (best >= 8.5 && !affordable) return 6.0;
      return 0;
    }
    return 0;
  }

  if (kind === 'scrap') {
    if (action.targetId === null) return 0; // 带空目标的拆基地分支等于白丢目标
    const value = intrinsic(p);
    const wall = enemyOutpostWall(view, playerId);
    const combat = num((view.players[playerId] || {}).combat);
    if (action.targetId !== undefined && wall > 0 && combat < wall) return 9.0; // 拆不掉的前哨交给能力
    const sc = num(p.sc);
    if (sc > 0 && wall <= 0 && combat + sc >= ctx.minOpp) return 8.0; // 销毁正好凑出斩杀
    if (card.type === 'base') return 0;
    if (ctx.turn >= 8 && value <= 3.3) return 4.0;
    return 0;
  }

  return 0;
}

function chooseAbility(view, legalActions, playerId, ctx) {
  const groups = { primary: [], ally: [], optional: [], scrap: [] };
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'ability') continue;
    const bucket = groups[action.ability];
    if (bucket) bucket.push(i);
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
  return -1;
}

// ---------------------------------------------------------------------------
// 3) 攻击：只做「本回合有效」的伤害
// ---------------------------------------------------------------------------
function defLeft(view, uid) {
  const card = view.cards[uid];
  if (!card) return 1;
  const dealt = view.damage && view.damage[uid] ? num(view.damage[uid]) : 0;
  return Math.max(1, num(card.defense) - dealt);
}

function chooseAttack(view, legalActions, playerId, ctx) {
  const me = view.players[playerId] || {};
  if (num(me.combat) <= 0) return -1;

  const face = [];
  const bases = [];
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'attack') continue;
    if (action.targetType === 'player') face.push({ i, action });
    else if (action.targetType === 'base') bases.push({ i, action });
  }

  if (face.length) {
    // 能斩杀就先斩杀，并且只投入恰好足够的战斗，多余战斗留给其他目标
    let lethalIndex = -1;
    let lethalAmount = Infinity;
    for (const item of face) {
      const target = view.players[item.action.targetId] || {};
      const authority = num(target.authority);
      if (item.action.amount >= authority && item.action.amount < lethalAmount) {
        lethalAmount = item.action.amount;
        lethalIndex = item.i;
      }
    }
    if (lethalIndex >= 0) return lethalIndex;

    // 否则集火权威最低的对手
    let targetId = face[0].action.targetId;
    let lowest = Infinity;
    for (const item of face) {
      const authority = num((view.players[item.action.targetId] || {}).authority);
      if (authority < lowest) {
        lowest = authority;
        targetId = item.action.targetId;
      }
    }
    let bestIndex = -1;
    let bestAmount = -1;
    for (const item of face) {
      if (item.action.targetId !== targetId) continue;
      if (item.action.amount > bestAmount) {
        bestAmount = item.action.amount;
        bestIndex = item.i;
      }
    }
    return bestIndex >= 0 ? bestIndex : face[0].i;
  }

  // 正面被前哨封住：优先打掉本回合能打掉的前哨
  let bestIndex = -1;
  let bestScore = -1;
  for (const item of bases) {
    const uid = item.action.targetId;
    if (item.action.amount < defLeft(view, uid)) continue; // 打不穿就是白送伤害
    const outpost = isEnemyOutpost(view, playerId, uid);
    const value = cardValue(view, uid);
    const score = (outpost ? 100 : 0) + value;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = item.i;
    }
  }
  if (bestIndex >= 0) return bestIndex;

  // 完全打不到人时，拆掉对手最贵的基地也算止损
  let salvageIndex = -1;
  let salvageValue = 5.5;
  for (const item of bases) {
    const uid = item.action.targetId;
    if (item.action.amount < defLeft(view, uid)) continue;
    const value = cardValue(view, uid);
    if (value > salvageValue) {
      salvageValue = value;
      salvageIndex = item.i;
    }
  }
  return salvageIndex;
}

// ---------------------------------------------------------------------------
// 4) 购买：价值表 + 三段权重 + 随回合抬高的门槛
// ---------------------------------------------------------------------------
function chooseBuy(view, legalActions, playerId, ctx) {
  const me = view.players[playerId] || {};
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
    const uid = view.tradeRow[action.row];
    if (!uid) continue;
    const card = view.cards[uid];
    if (!card) continue;
    const profile = profileOf(view, uid);
    // 门槛按「牌面绝对价值」判定：低于牌库平均水平的牌不买，避免稀释牌库
    if (intrinsic(profile) < ctx.floor) continue;
    const score = buyValue(profile, ctx) - num(card.cost) * 0.42;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  if (bestIndex >= 0) return bestIndex;

  // 结尾剩下的 2-3 贸易买探索者，等于用「本来会浪费的贸易」换一张可压缩的低价牌
  const bought = num((ctx.memory && ctx.memory.explorers) || 0);
  if (explorerIndex >= 0 && ctx.turn <= 9 && bought < 3 && num(me.trade) >= 2 && num(me.trade) <= 4) {
    return explorerIndex;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// 5) 2V2 预留：只在攻击和购买都结算完之后，把剩余资源交给队友
// ---------------------------------------------------------------------------
function chooseTransfer(view, legalActions, playerId, ctx) {
  let bestIndex = -1;
  let bestAmount = -1;
  let bestResource = '';
  for (let i = 0; i < legalActions.length; i++) {
    const action = legalActions[i];
    if (!action || action.type !== 'transfer') continue;
    if (
      action.amount > bestAmount ||
      (action.amount === bestAmount && action.resource === 'trade' && bestResource !== 'trade')
    ) {
      bestAmount = action.amount;
      bestResource = action.resource;
      bestIndex = i;
    }
  }
  return bestIndex;
}

// ---------------------------------------------------------------------------
// 6) 待决动作
// ---------------------------------------------------------------------------
function choosePending(view, legalActions, playerId, ctx) {
  const type = legalActions[0] && legalActions[0].type;
  if (type === 'discard' || type === 'selectScrap') return chooseDiscard(view, legalActions);
  if (type === 'targetDiscard') return chooseTargetDiscard(view, legalActions);
  if (type === 'eventChoice') return chooseEvent(view, legalActions, playerId, ctx);
  return 0;
}

function discardWeight(view, uid) {
  const card = view.cards[uid];
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
    const target = view.players[legalActions[i].targetId] || {};
    // 手牌越少、权威越高，弃牌干扰越大
    const score = -num(target.handCount) + num(target.authority) * 0.03;
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
  const eventId = legalActions[0] && legalActions[0].eventId;

  if (eventId === 'blackHole') {
    // 弃牌只是进弃牌堆，不是永久损失；少弃一张要掉 4 权威，永远优先弃满
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      const targets = legalActions[i].targets || [];
      let cost = 4 * (2 - targets.length) * (ctx.meAuth <= 14 ? 1.8 : 1);
      for (const uid of targets) {
        const card = view.cards[uid];
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
    let payCost = 6 * (ctx.meAuth <= 12 ? 3.0 : 1 + ctx.danger * 0.5);
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
    // 放回牌库顶的两张牌会很快再抽到，先放最不重要的，并且把两者中较好的放最上面
    let bestIndex = 0;
    let bestCost = Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      const cards = legalActions[i].cards || [];
      if (cards.length < 2) continue;
      const cost = cardValue(view, cards[0]) + cardValue(view, cards[1]) * 1.15;
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    return bestIndex;
  }

  return 0;
}
