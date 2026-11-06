// 策略名称：曲线竞速（Curve Race）
// 选择理由（一句话）：1v1 星域奇航是「总输出竞速」，按费用-价值曲线贪婪购置让贸易复利最大化，
// 配合战斗零浪费（满额直伤 + 最省破墙）实现最快斩杀，是不依赖特定牌运的通用最强框架。

export const meta = {
  name: 'GLM5.3 · 曲线竞速',
  description: 'glm-5.3 自选策略「曲线竞速」：早期购置高性价比廉价牌、后期平滑转向高绝对值旗舰，战斗全部转化为直伤、前哨墙只做最省破墙——用经济复利与斩杀效率赢下 1v1 竞速。'
};

// ---------- 静态知识表（依据 cards.js / expansions.js 的公开定义独立整理） ----------

// 内在价值：该牌在整个对局中的长期输出/生存贡献估计（约 1~11）
const INTRINSIC = {
  scout: 2, viper: 1.6, explorer: 4,
  // 基础盒 · 虫群
  blobFighter: 6, battlePod: 7, tradePod: 7.2, ram: 7.4, blobWheel: 6.4, blobDestroyer: 8.6,
  theHive: 8, battleBlob: 9, blobCarrier: 8.6, mothership: 9.4, blobWorld: 10.5,
  // 基础盒 · 机械教团
  tradeBot: 5.4, missileBot: 6.4, supplyBot: 7, patrolMech: 8, stealthNeedle: 8, battleMech: 8.4,
  battleStation: 7, missileMech: 9, junkyard: 7.4, machineBase: 8, mechWorld: 8.6, brainWorld: 9,
  // 基础盒 · 星际帝国
  imperialFighter: 6, corvette: 7, imperialFrigate: 8, surveyShip: 7, recyclingStation: 7.4,
  spaceStation: 7.4, royalRedoubt: 8.6, warWorld: 9, fleetHQ: 10, battlecruiser: 9.5, dreadnaught: 10,
  // 基础盒 · 贸易联邦
  federationShuttle: 5.4, cutter: 7.4, embassyYacht: 7.6, freighter: 7.6, tradeEscort: 8.4,
  flagship: 9, commandShip: 11, portOfCall: 8.4, centralOffice: 8.4, defenseCenter: 8,
  barterWorld: 7.4, tradingPost: 6.4,
  // 殖民战争 · 虫群
  swarmer: 5.8, stellarReef: 5.2, cargoPod: 7, ravager: 7.4, bioformer: 6.8, parasite: 8.4,
  plasmaVent: 7.8, moonwurm: 9.8, leviathan: 11,
  // 殖民战争 · 机械教团
  battleBot: 5.2, repairBot: 6, convoyBot: 7, miningMech: 7.4, theOracle: 6.8, mechCruiser: 8.4,
  stealthTower: 8, theWrecker: 9, theIncinerator: 9, frontierStation: 7.8,
  // 殖民战争 · 星际帝国
  starBarge: 5.8, predator: 6.4, lancer: 6.4, falcon: 6.8, orbitalPlatform: 6.4, gunship: 7.8,
  commandCenter: 8, agingBattleship: 7.4, heavyCruiser: 8.4, supplyDepot: 7.4, imperialPalace: 9,
  emperorsDreadnaught: 11,
  // 殖民战争 · 贸易联邦
  solarSkiff: 5.4, storageSilo: 5.4, tradeHauler: 6.4, warningBeacon: 6, patrolCutter: 7.4,
  frontierFerry: 7.4, centralStation: 7, colonySeedShip: 8.4, peacekeeper: 8.8, federationShipyard: 8,
  loyalColony: 8.8, factoryWorld: 9.4
};

// 能提供权威的牌（自己血线告急时购买加权）
const AUTH_IDS = new Set([
  'federationShuttle', 'cutter', 'embassyYacht', 'tradeEscort', 'flagship', 'commandShip',
  'storageSilo', 'tradeHauler', 'patrolCutter', 'frontierFerry', 'centralStation', 'colonySeedShip',
  'peacekeeper', 'loyalColony', 'tradingPost', 'barterWorld', 'defenseCenter'
]);

// 销毁类能力的即期产出（用于判断何时值得牺牲这张牌）
const SCRAP_FX = {
  explorer: { combat: 2 },
  battleBlob: { combat: 4 },
  battleStation: { combat: 5, outpost: true },
  cargoPod: { combat: 3 },
  ram: { trade: 3 },
  blobWheel: { trade: 3 },
  stellarReef: { trade: 3 },
  bioformer: { trade: 3 },
  spaceStation: { trade: 4, outpost: true },
  gunship: { trade: 4 },
  repairBot: { combat: 2 },
  tradingPost: { combat: 3 },
  barterWorld: { combat: 5 },
  agingBattleship: { combat: 2, draw: 2 },
  dreadnaught: { combat: 5 },
  imperialFrigate: { draw: 1 },
  battlecruiser: { draw: 1, destroyBase: true },
  portOfCall: { draw: 1, destroyBase: true },
  frontierFerry: { destroyBase: true },
  plasmaVent: { destroyBase: true }
};

// 未知牌的兜底价值（按费用与类型粗估）
function genericValue(card) {
  const cost = typeof card.cost === 'number' ? card.cost : 1;
  return cost * 1.15 + (card.type === 'base' ? 1 : 0) + (card.outpost ? 0.5 : 0);
}

function intrOf(view, uid) {
  const c = uid && view.cards && view.cards[uid];
  if (!c) return 2;
  if (INTRINSIC[c.id] !== undefined) return INTRINSIC[c.id];
  return genericValue(c);
}

// ---------- 视图辅助 ----------

function enemiesOf(view, me, mode) {
  const myTeam = view.players[me].team;
  return view.players.filter(p =>
    p.id !== me && !p.eliminated && (mode !== 'team2v2' || myTeam === null || myTeam === undefined || p.team !== myTeam)
  );
}

// 所有敌人前哨中最便宜的破墙需求（Infinity = 没有墙）
function wallNeeded(view, me, mode) {
  let min = Infinity;
  for (const p of enemiesOf(view, me, mode)) {
    for (const uid of p.inPlay || []) {
      const c = view.cards[uid];
      if (c && c.outpost) {
        const need = Math.max(1, (c.defense || 1) - ((view.damage && view.damage[uid]) || 0));
        if (need < min) min = need;
      }
    }
  }
  return min;
}

// 拥有 combat 点战斗后是否打得到人（近似：无墙或墙可破）
function attackUsableAfter(view, me, mode, combat) {
  const wall = wallNeeded(view, me, mode);
  return wall === Infinity || wall <= combat;
}

// 最低敌方权威（斩杀线参考；firstBlood 只看「我击杀即可获胜」的目标）
function nextAlivePlayer(view, me) {
  const n = view.players.length;
  for (let i = 1; i <= n; i++) {
    const p = view.players[(me + i) % n];
    if (p && !p.eliminated) return p.id;
  }
  return null;
}

function lowestEnemyAuthority(view, me, mode) {
  if (mode === 'firstBlood') {
    const t = nextAlivePlayer(view, me);
    return t === null ? null : view.players[t].authority;
  }
  let min = null;
  for (const p of enemiesOf(view, me, mode)) {
    if (min === null || p.authority < min) min = p.authority;
  }
  return min;
}

// ---------- 待决（pending）处理 ----------

function handlePending(view, legal, me, mode, turn) {
  const type = legal[0] && legal[0].type;
  const my = view.players[me];

  if (type === 'discard' || type === 'selectScrap') {
    // 弃/销毁最差的牌
    let best = null, bestV = Infinity;
    for (const a of legal) {
      const v = intrOf(view, a.cardId);
      if (v < bestV) { bestV = v; best = a; }
    }
    return best || legal[0];
  }

  if (type === 'targetDiscard') {
    // 打击最强（权威最高）的候选人
    let best = null, bestV = -1;
    for (const a of legal) {
      const p = view.players[a.targetId];
      const v = p ? p.authority : 0;
      if (v > bestV) { bestV = v; best = a; }
    }
    return best || legal[0];
  }

  if (type === 'eventChoice') {
    const ev = (view.pending && view.pending.eventId) || (legal[0] && legal[0].eventId);
    if (ev === 'blackHole' || ev === 'comet') {
      // 尽量弃/销毁最差的两张；黑洞少弃一张要亏 4 权威，额外奖励多弃
      const bonus = ev === 'blackHole' ? 3.5 : 0;
      let best = null, bestScore = -Infinity;
      for (const a of legal) {
        const ts = a.targets || [];
        let score = 0.1 * ts.length + bonus * ts.length;
        for (const t of ts) score += 4 - intrOf(view, t);
        if (score > bestScore) { bestScore = score; best = a; }
      }
      return best || legal[0];
    }
    if (ev === 'bombardment') {
      // 摧毁最便宜的自家基地（价值≤6 或血线告急），否则宁愿掉 6 权威
      let cheap = null, cheapV = Infinity;
      for (const a of legal) {
        if (!a.baseId) continue;
        const v = intrOf(view, a.baseId);
        if (v < cheapV) { cheapV = v; cheap = a; }
      }
      if (cheap && (cheapV <= 6 || my.authority <= 12)) return cheap;
      return legal.find(a => a.pay) || legal[0];
    }
    if (ev === 'warpJump') {
      // 抽 3 还 2：把最差的 2 张放回牌库顶，留住最好的一张
      const drawn = (view.pending && view.pending.drawn) || [];
      const ranked = [...drawn].sort((x, y) => intrOf(view, y) - intrOf(view, x));
      const keep = ranked[0];
      const back = new Set(drawn.filter(u => u !== keep));
      let best = null, bestScore = -Infinity;
      for (const a of legal) {
        const cs = a.cards || [];
        let score = 0;
        for (const c of cs) score += back.has(c) ? 2 : -2;
        if (score > bestScore) { bestScore = score; best = a; }
      }
      return best || legal[0];
    }
    return legal[0]; // 未知事件：安全兜底
  }
  return legal[0];
}

// ---------- 主阶段 ----------

function findLethal(view, legal, me, mode) {
  const winTarget = mode === 'firstBlood' ? nextAlivePlayer(view, me) : null;
  let best = null;
  for (const a of legal) {
    if (a.type !== 'attack' || a.targetType !== 'player') continue;
    if (mode === 'firstBlood' && a.targetId !== winTarget) continue;
    const p = view.players[a.targetId];
    if (p && a.amount >= p.authority) {
      if (!best || a.amount > best.amount) best = a;
    }
  }
  return best;
}

// 打出/主要效果分支的价值（play 的 choice 与基地 primary 的 choice 共用）
function choiceValue(view, a, w, me) {
  const info = view.cards[a.cardId];
  const id = info ? info.id : null;
  switch (id) {
    case 'patrolMech': return a.choice === 0 ? 3 * w.trade : 5 * w.combat;
    case 'frontierStation': return a.choice === 0 ? 2 * w.trade : 3 * w.combat;
    case 'barterWorld': return a.choice === 0 ? 2 * w.auth : 2 * w.trade;
    case 'defenseCenter': return a.choice === 0 ? 3 * w.auth : 2 * w.combat;
    case 'tradingPost': return a.choice === 0 ? 1 * w.auth : 1 * w.trade;
    case 'blobWorld': {
      if (a.choice === 0) return 5 * w.combat;
      let blobs = 0;
      for (const uid of view.players[me].inPlay || []) {
        const c = view.cards[uid];
        if (c && c.factions && c.factions.includes('blob')) blobs++;
      }
      return Math.min(10, blobs * 1.15);
    }
    case 'parasite': {
      if (a.choice === 0) return 6 * w.combat;
      if (a.row !== undefined) {
        const uid = view.tradeRow[a.row];
        return uid ? intrOf(view, uid) * 0.9 : -9;
      }
      return -9;
    }
    case 'recyclingStation': {
      if (a.choice === 0) return 1 * w.trade;
      const ts = a.targets || [];
      if (!ts.length) return -9;
      for (const t of ts) if (intrOf(view, t) > 3.5) return -9;
      return 0.9 * ts.length;
    }
    default: return a.choice === 0 ? 0 : -1;
  }
}

function bestPlay(view, plays, w, me) {
  let best = null, bestV = -Infinity;
  for (const a of plays) {
    let v = 5; // 打出永远不亏
    if (a.copy) v += intrOf(view, a.copy) * 0.2; // 复制目标越强越好
    if (a.choice !== undefined) v += choiceValue(view, a, w, me);
    if (v > bestV) { bestV = v; best = a; }
  }
  return best;
}

function evalScrap(view, a, me, mode, turn) {
  const info = view.cards[a.cardId];
  const id = info ? info.id : null;
  const fx = SCRAP_FX[id];
  if (!fx) return null;
  const my = view.players[me];

  // 前哨类牺牲自己护墙，门槛更高：能借此斩杀或残局才动
  if (fx.outpost) {
    const total = my.combat + (fx.combat || 0);
    const eAuth = lowestEnemyAuthority(view, me, mode);
    const lethal = fx.combat && eAuth !== null && total >= eAuth && attackUsableAfter(view, me, mode, total);
    if (!lethal && turn < 12) return null;
  }

  if (fx.destroyBase) {
    if (!a.targetId || !view.cards[a.targetId]) return null;
    const v = intrOf(view, a.targetId);
    return v >= 7 ? v * 0.55 + (fx.draw ? 1 : 0) : null;
  }
  if (fx.combat) {
    const total = my.combat + fx.combat;
    const eAuth = lowestEnemyAuthority(view, me, mode);
    const usable = attackUsableAfter(view, me, mode, total);
    const lethal = eAuth !== null && total >= eAuth && usable;
    const ok = lethal || (turn >= 8 && usable);
    return ok ? 1 + fx.combat * 0.1 : null;
  }
  if (fx.trade) {
    // 只有当这点贸易正好能补上一个顶级购买时才值得换
    for (const uid of view.tradeRow || []) {
      const c = uid && view.cards[uid];
      if (c && typeof c.cost === 'number' && c.cost > my.trade && c.cost <= my.trade + fx.trade && intrOf(view, uid) >= 8) {
        return 1;
      }
    }
    return null;
  }
  if (fx.draw) return turn >= 12 ? 1 : null;
  return null;
}

function evalAbility(view, a, me, mode, turn, w) {
  const info = view.cards[a.cardId];
  const id = info ? info.id : null;
  const kind = a.ability;

  if (kind === 'ally') {
    // 摧毁敌方基地类（destroyBase / destroyAndOrScrap 的带目标变体）
    if (a.targetId !== undefined && view.cards[a.targetId]) {
      let v = intrOf(view, a.targetId) * 0.5 + 1;
      if (a.row !== undefined) v -= 0.1; // 优先不动交易行的变体
      return v;
    }
    if (a.row !== undefined) {
      // 免费获得类（虫群母舰/月蚀巨虫/利维坦）；销毁交易行类（虫群毁灭者）跳过
      const acquire = id === 'blobCarrier' || id === 'moonwurm' || id === 'leviathan';
      if (!acquire) return null;
      const uid = view.tradeRow[a.row];
      return uid ? intrOf(view, uid) * 0.8 : null;
    }
    return 1; // 抽牌/战斗/贸易/权威/压制弃牌/置顶标记等纯收益
  }

  if (kind === 'primary') {
    if (a.choice !== undefined) return choiceValue(view, a, w, me);
    if (a.targets) {
      if (!a.targets.length) return null; // 空目标=浪费能力
      for (const t of a.targets) if (intrOf(view, t) > 3.5) return null; // 只薄牌库，不销毁好牌
      if (id === 'supplyDepot') {
        const rw = a.resource === 'combat' ? w.combat : w.trade;
        return 2 * a.targets.length * rw + 0.3 * a.targets.length;
      }
      let v = 0.4 * a.targets.length;
      if (id === 'brainWorld') v += 1.1 * a.targets.length; // 每销毁一张还抽一张
      return v;
    }
    return 1; // 常规主要能力：每回合的免费资源
  }

  if (kind === 'optional') {
    if (a.targets && a.targets.length) {
      for (const t of a.targets) if (intrOf(view, t) > 3.5) return null;
      return 0.5 * a.targets.length;
    }
    if (a.row !== undefined || a.rows) return null; // 销毁交易行：期望不明，安全跳过
    if (a.targetId !== undefined) {
      if (!view.cards[a.targetId]) return null;
      return intrOf(view, a.targetId) * 0.5 + 1; // 免费摧毁敌基地（导弹机甲/利维坦）
    }
    return null;
  }

  if (kind === 'scrap') return evalScrap(view, a, me, mode, turn);
  return null;
}

function pickAttack(view, legal, me, mode) {
  const atks = legal.filter(a => a.type === 'attack');
  if (!atks.length) return null;
  const playerAtks = atks.filter(a => a.targetType === 'player');
  const baseAtks = atks.filter(a => a.targetType === 'base');
  const my = view.players[me];
  const winTarget = mode === 'firstBlood' ? nextAlivePlayer(view, me) : null;

  // firstBlood：只打「我击杀即可获胜」的目标，绝不替他人做嫁衣
  let faceTargets = playerAtks;
  if (mode === 'firstBlood') faceTargets = playerAtks.filter(a => a.targetId === winTarget);

  if (faceTargets.length) {
    const combat = my.combat;
    // 值得先拆的高价值基地：拆完仍剩 ≥3 点直伤，且对手血量还高（≥20）
    let bestBase = null, bestBaseV = 0;
    for (const a of baseAtks) {
      const info = a.targetId && view.cards[a.targetId];
      if (!info) continue;
      const needed = Math.max(1, (info.defense || 1) - ((view.damage && view.damage[a.targetId]) || 0));
      const v = intrOf(view, a.targetId);
      if (needed <= combat - 3 && v >= 6.5 && v > bestBaseV) { bestBase = a; bestBaseV = v; }
    }
    const eAuth = view.players[faceTargets[0].targetId] ? view.players[faceTargets[0].targetId].authority : 50;
    if (bestBase && eAuth >= 20) return bestBase;

    // 直伤：选血最少的可打目标，全额输出
    let targetId = null, targetAuth = Infinity;
    for (const a of faceTargets) {
      const auth = view.players[a.targetId] ? view.players[a.targetId].authority : Infinity;
      if (auth < targetAuth) { targetAuth = auth; targetId = a.targetId; }
    }
    let best = null;
    for (const a of faceTargets) {
      if (a.targetId !== targetId) continue;
      if (!best || a.amount > best.amount) best = a;
    }
    return best;
  }

  // 被前哨护墙：只打「本回合恰好能破」的墙，绝不留下回合清零的溢出伤害
  if (baseAtks.length) {
    let best = null, bestNeed = Infinity;
    for (const a of baseAtks) {
      const info = a.targetId && view.cards[a.targetId];
      if (!info) continue;
      const needed = Math.max(1, (info.defense || 1) - ((view.damage && view.damage[a.targetId]) || 0));
      if (my.combat >= needed && needed < bestNeed) { best = a; bestNeed = needed; }
    }
    return best; // 破不了墙就宁可不打
  }
  return null;
}

function pickBuy(view, legal, me, mode, turn) {
  const buys = legal.filter(a => a.type === 'buy');
  if (!buys.length) return null;
  const my = view.players[me];

  // 用可见区域统计阵营密度（手牌+弃牌+场上），找主导阵营做同盟协同
  const counts = {};
  for (const zone of ['hand', 'discard', 'inPlay']) {
    for (const uid of my[zone] || []) {
      const c = view.cards[uid];
      if (!c || !c.factions) continue;
      for (const f of c.factions) if (f !== 'neutral') counts[f] = (counts[f] || 0) + 1;
    }
  }
  let dom = null, domCount = 0;
  for (const k of Object.keys(counts)) {
    if (counts[k] > domCount) { dom = k; domCount = counts[k]; }
  }

  // 曲线指数：早期(t≈0)按性价比 intr/cost^0.6，后期(t=0.6)平滑过渡到纯绝对价值 intr
  const t = Math.min(0.6, turn / 25);
  let best = null, bestScore = 0;
  for (const a of buys) {
    let id, cost, faction;
    if (a.explorer) { id = 'explorer'; cost = 2; faction = 'neutral'; }
    else {
      const uid = view.tradeRow[a.row];
      const c = uid && view.cards[uid];
      if (!c) continue;
      id = c.id;
      cost = typeof c.cost === 'number' ? c.cost : 1;
      faction = c.faction;
    }
    const base = INTRINSIC[id] !== undefined ? INTRINSIC[id] : (a.explorer ? 4 : genericValue(view.cards[view.tradeRow[a.row]]));
    let syn = 1;
    if (faction && faction !== 'neutral') {
      if (dom && faction === dom && domCount >= 3) syn = 1.15;
      else if (dom && domCount >= 4) syn = 0.93;
    }
    if (my.authority <= 14 && AUTH_IDS.has(id)) syn *= 1.3;
    const score = base * syn * Math.pow(Math.max(1, cost), t - 0.6);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return bestScore >= 1.8 ? best : null;
}

function pickTransfer(legal) {
  const trs = legal.filter(a => a.type === 'transfer');
  if (!trs.length) return null;
  // 先转贸易再转战斗，每次全量
  let best = null;
  for (const a of trs) {
    if (!best) { best = a; continue; }
    if (a.resource === 'trade' && best.resource !== 'trade') { best = a; continue; }
    if (a.resource === best.resource && a.amount > best.amount) best = a;
  }
  return best;
}

function decide(view, legal, me, ctx) {
  const mode = (ctx && ctx.mode) || view.mode || 'standard';
  const turn = (ctx && ctx.turn) || view.turn || 1;

  // 待决动作优先
  if (view.pending || (legal[0] && ['discard', 'targetDiscard', 'selectScrap', 'eventChoice'].indexOf(legal[0].type) >= 0)) {
    return handlePending(view, legal, me, mode, turn);
  }

  const my = view.players[me];
  if (!my) return null;

  // 资源权重（当下最缺什么）
  const w = {
    trade: legal.some(a => a.type === 'buy') ? 1 : 0.55,
    combat: attackUsableAfter(view, me, mode, Math.max(1, my.combat)) ? 1 : 0.35,
    auth: my.authority <= 20 ? 1 : 0.45
  };

  // 1. 致命一击
  const lethal = findLethal(view, legal, me, mode);
  if (lethal) return lethal;

  // 2. 打出手中所有牌（先攒资源与同盟）
  const plays = legal.filter(a => a.type === 'play');
  if (plays.length) return bestPlay(view, plays, w, me);

  // 3. 有利可图的能力（主要/同盟/可选/销毁，逐个估值）
  const abils = legal.filter(a => a.type === 'ability');
  if (abils.length) {
    let best = null, bestV = 0;
    for (const a of abils) {
      const v = evalAbility(view, a, me, mode, turn, w);
      if (v !== null && v > bestV) { bestV = v; best = a; }
    }
    if (best) return best;
  }

  // 4. 攻击（满额直伤 / 最省破墙）
  const atk = pickAttack(view, legal, me, mode);
  if (atk) return atk;

  // 5. 购买（曲线评分）
  const buy = pickBuy(view, legal, me, mode, turn);
  if (buy) return buy;

  // 6. 2V2 资源预留（购物与攻击之后的真剩余）
  const tr = pickTransfer(legal);
  if (tr) return tr;

  // 7. 结束回合
  return legal.find(a => a.type === 'endTurn') || null;
}

// ---------- 入口 ----------

export function chooseAction({ view, legalActions, playerId, context }) {
  if (!Array.isArray(legalActions) || !legalActions.length) return undefined;
  try {
    const pick = decide(view, legalActions, playerId, context);
    if (pick && legalActions.includes(pick)) return pick;
  } catch (err) {
    // 任何内部错误都退到安全兜底，绝不让对局暂停
  }
  const end = legalActions.find(a => a && a.type === 'endTurn');
  return end || legalActions[0];
}
