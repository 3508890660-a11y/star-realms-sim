// 策略名称：价值节奏快攻（Tempo-Value Aggro）
// 选择理由（一句话）：基础盒 1v1 是 50 权威竞速，伤害是唯一胜利资源，故以「先斩必杀 → 高效买牌滚雪球 → 销毁起始废牌 → 优先打脸抢血」压制对手。

export const meta = {
  name: 'deepseek v4pro',
  description: '模型 deepseek-v4-pro；策略「价值节奏快攻」：把伤害当作唯一胜利资源，先斩必杀、高效买牌滚雪球、销毁起始废牌、优先打脸抢血，抢在对手成型前结束对局。'
};

// 卡牌「牌库价值」表（越大约值得买入/保留）。依据基础盒 + 殖民战争全部卡牌的效果
// 字段（战斗/贸易/权威/抽牌/销毁/同盟）折算为单一分值；未列出的牌走 cost/type 兜底。
const CARD_VALUE = {
  // core 中立
  scout: 1, viper: 1, explorer: 2.8,
  // core 虫群
  battleBlob: 10.8, battlePod: 5.4, blobCarrier: 8.9, blobDestroyer: 7.4,
  blobFighter: 4.2, blobWheel: 5.0, blobWorld: 16.0, mothership: 9.4,
  ram: 7.3, theHive: 11.0, tradePod: 4.1,
  // core 机械
  battleMech: 5.9, battleStation: 3.6, brainWorld: 20.0, junkyard: 8.2,
  machineBase: 14.5, mechWorld: 4.5, missileBot: 3.8, missileMech: 7.8,
  patrolMech: 6.2, stealthNeedle: 5.0, supplyBot: 3.8, tradeBot: 2.8,
  // core 帝国
  battlecruiser: 9.7, corvette: 4.3, dreadnaught: 11.2, fleetHQ: 7.5,
  imperialFighter: 4.6, imperialFrigate: 7.5, recyclingStation: 7.4,
  royalRedoubt: 11.5, spaceStation: 10.1, surveyShip: 3.8, warWorld: 12.6,
  // core 联邦
  barterWorld: 8.6, centralOffice: 7.3, commandShip: 13.5, cutter: 7.2,
  defenseCenter: 9.4, embassyYacht: 6.3, federationShuttle: 3.7, flagship: 9.3,
  freighter: 4.4, portOfCall: 12.4, tradeEscort: 8.2, tradingPost: 5.6,
  // colony 机械
  battleBot: 3.8, convoyBot: 5.8, miningMech: 5.3, repairBot: 3.5,
  theOracle: 9.8, stealthTower: 6.0, theWrecker: 8.5, mechCruiser: 7.8,
  frontierStation: 10.7, theIncinerator: 15.5,
  // colony 联邦
  solarSkiff: 3.2, storageSilo: 6.1, tradeHauler: 4.2, patrolCutter: 6.7,
  centralStation: 8.0, frontierFerry: 6.8, colonySeedShip: 8.8,
  federationShipyard: 8.3, peacekeeper: 11.7, loyalColony: 25.0, factoryWorld: 13.9,
  // colony 帝国
  starBarge: 3.9, lancer: 6.0, falcon: 4.8, orbitalPlatform: 4.7, gunship: 8.1,
  commandCenter: 9.0, agingBattleship: 8.8, heavyCruiser: 7.4,
  emperorsDreadnaught: 12.2, supplyDepot: 7.3, imperialPalace: 15.0,
  // colony 虫群
  swarmer: 4.4, predator: 5.2, cargoPod: 5.9, ravager: 6.6, bioformer: 10.8,
  parasite: 7.2, plasmaVent: 13.6, moonwurm: 11.6, leviathan: 13.2
};

// 同盟免费获得（row 表示免费拿一张）与可选销毁交易行（row 表示销毁一张）需要区分。
const FREE_ACQUIRE_IDS = new Set(['blobCarrier', 'moonwurm', 'leviathan']);
const SCRAP_ROW_IDS = new Set(['battlePod', 'swarmer', 'ravager']);

function valueOf(view, uid) {
  const c = view.cards && view.cards[uid];
  if (!c) return 2;
  if (CARD_VALUE[c.id] !== undefined) return CARD_VALUE[c.id];
  const cost = c.cost || 0;
  return cost * 1.5 + (c.type === 'base' ? 2 : 0) + (c.outpost ? 0.5 : 0);
}

function authorityOf(view, id) {
  const p = view.players && view.players[id];
  return p ? (p.authority || 0) : 0;
}

function sumValues(view, uids) {
  return (uids || []).reduce((s, uid) => s + valueOf(view, uid), 0);
}

export function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  memory.calls = (memory.calls || 0) + 1;
  if (!Array.isArray(legalActions) || legalActions.length === 0) return legalActions[0];
  if (view.pending) return pickPending(view, legalActions);
  return pickMain(view, legalActions, playerId);
}

// ---------------------------------------------------------------------------
// 主阶段：严格按「必杀 > 打出 > 能力 > 打脸 > 打基地 > 购买 > 转移 > 结束」的节奏。
// ---------------------------------------------------------------------------
function pickMain(view, legalActions, playerId) {
  // 1) 必杀：当前战斗值足以清空目标权威，直接获胜。
  for (const a of legalActions) {
    if (a.type === 'attack' && a.targetType === 'player' && a.amount > 0 &&
        a.amount >= authorityOf(view, a.targetId)) return a;
  }

  // 2) 打出：先生成资源/触发同盟，几乎永远正确。
  let best = null, bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'play') continue;
    const s = playScore(view, a, playerId);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best) return best;

  // 3) 能力：同盟/基地主要/销毁，仅当净收益为正才用。
  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'ability') continue;
    const s = abilityScore(view, a, playerId);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && bestScore > 0) return best;

  // 4) 攻击：能打脸就全量打脸，否则先拆基地（多为前哨阻挡）。
  let face = null;
  for (const a of legalActions) {
    if (a.type === 'attack' && a.targetType === 'player') {
      if (!face || a.amount > face.amount) face = a;
    }
  }
  if (face) return face;

  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'attack' || a.targetType !== 'base') continue;
    const s = baseAttackScore(view, a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best) return best;

  // 5) 购买：挑性价比最高的可负担卡牌。
  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'buy') continue;
    const s = buyScore(view, a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && bestScore > 0) return best;

  // 6) 转移（2V2）：一次性转走剩余资源给队友。
  let tr = null;
  for (const a of legalActions) {
    if (a.type === 'transfer') { if (!tr || a.amount > tr.amount) tr = a; }
  }
  if (tr) return tr;

  // 7) 结束回合。
  for (const a of legalActions) if (a.type === 'endTurn') return a;

  // 未知动作兜底：返回第一个合法动作，绝不抛异常。
  return legalActions[0];
}

function playScore(view, a, playerId) {
  const c = view.cards && view.cards[a.cardId];
  if (!c) return 0;
  let s = valueOf(view, a.cardId);
  if (a.copy) s += valueOf(view, a.copy) * 0.5; // 隐匿针舰/尖塔：复制价值最高的目标
  if (a.choice !== undefined) {
    if (c.id === 'patrolMech') s += (a.choice === 1 ? 2 : 0); // 5 战斗 > 3 贸易
    else if (c.id === 'parasite') {
      if (a.choice === 0) s += 6; // 6 战斗
      else {
        const rc = a.row !== undefined ? view.tradeRow[a.row] : null;
        s += 2 + (rc ? valueOf(view, rc) * 0.7 : 0); // 免费获得费用 ≤6 的牌
      }
    }
  }
  return s;
}

function abilityScore(view, a, playerId) {
  const c = view.cards && view.cards[a.cardId];
  if (!c) return 0;
  const kind = a.ability;
  const targets = a.targets || [];
  let s = 0;

  if (a.targetId) s += valueOf(view, a.targetId) + 2; // 摧毁敌方基地
  if (a.row !== undefined) {
    const rc = view.tradeRow && view.tradeRow[a.row];
    const rv = rc ? valueOf(view, rc) : 0;
    if (FREE_ACQUIRE_IDS.has(c.id)) s += rv + 2;       // 免费获得
    else if (SCRAP_ROW_IDS.has(c.id)) s += rv * 0.5;   // 销毁行牌（拒绝对手）
    else s += rv * 0.5;
  }
  if (targets.length) {
    const lost = sumValues(view, targets);
    if (kind === 'optional' || kind === 'primary' || kind === 'ally') {
      // 销毁废牌（压缩）或弃牌过牌：倾向销毁价值最低者
      s += targets.length * 2.0 - lost * 0.45;
    }
  }
  if (!a.targetId && a.row === undefined && !targets.length) {
    if (kind === 'ally') s += 2.0;                    // 同盟数值（抽牌/战斗等）
    else if (kind === 'scrap') s += valueOf(view, a.cardId) * 0.4 - valueOf(view, a.cardId) * 0.8; // 自毁多为负
    else s += 1.0;                                    // 基地主要 / 可选纯资源
  }
  return s;
}

function baseAttackScore(view, a) {
  const d = view.cards && view.cards[a.targetId];
  const needed = d && d.defense ? d.defense : 1;
  const killing = a.amount >= needed;
  const val = d ? valueOf(view, a.targetId) : 2;
  return val + (killing ? 15 : 0) - needed * 0.2;
}

function buyScore(view, a) {
  if (a.explorer) return 1.2; // 探索者低优先，仅在无可购时兜底
  const rc = view.tradeRow && view.tradeRow[a.row];
  if (!rc) return 0;
  const c = view.cards[rc];
  const cost = c && c.cost ? c.cost : 0;
  return valueOf(view, rc) - cost * 0.6;
}

// ---------------------------------------------------------------------------
// 待决选择：弃牌 / 强制销毁 / 指定弃牌目标 / 事件选择，全部安全兜底。
// ---------------------------------------------------------------------------
function pickPending(view, legalActions) {
  const p = view.pending;
  if (!p) return legalActions[0];
  if (p.type === 'discard' || p.type === 'selectScrap') {
    // 弃/销毁价值最低的牌（毒蛇、侦察艇优先）
    return worstCardAction(view, legalActions, a => a.cardId);
  }
  if (p.type === 'targetDiscard') {
    // 多人时指定权威最高的对手弃牌，施加最大压力
    let best = legalActions[0], bestAuth = -1;
    for (const a of legalActions) {
      const au = authorityOf(view, a.targetId);
      if (au > bestAuth) { bestAuth = au; best = a; }
    }
    return best;
  }
  if (p.type === 'eventChoice') return pickEventChoice(view, legalActions);
  return legalActions[0]; // 未知待决兜底
}

function worstCardAction(view, actions, getUid) {
  let best = actions[0], bestVal = Infinity;
  for (const a of actions) {
    const uid = getUid(a);
    const v = uid != null ? valueOf(view, uid) : 0;
    if (v < bestVal) { bestVal = v; best = a; }
  }
  return best;
}

function pickEventChoice(view, legalActions) {
  const p = view.pending;
  const kind = p.kind || (view.eventContext && view.eventContext.eventId);
  if (kind === 'blackHole') {
    // 弃至多 2 张最差手牌，每少弃一张损 4 权威 → 尽量弃满且弃废牌
    let best = legalActions[0], bestScore = -Infinity;
    for (const a of legalActions) {
      const t = a.targets || [];
      const score = t.length * 4 - sumValues(view, t) * 0.5;
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }
  if (kind === 'comet') {
    // 销毁至多 2 张最差的牌（好事，压缩废牌）
    let best = legalActions[0], bestScore = -Infinity;
    for (const a of legalActions) {
      const t = a.targets || [];
      const score = t.length * 3 - sumValues(view, t);
      if (score > bestScore) { bestScore = score; best = a; }
    }
    return best;
  }
  if (kind === 'warpJump') {
    // 抽 3 留 1：把价值最低的 2 张放回牌库顶
    let best = legalActions[0], bestVal = Infinity;
    for (const a of legalActions) {
      const v = sumValues(view, a.cards || []);
      if (v < bestVal) { bestVal = v; best = a; }
    }
    return best;
  }
  if (kind === 'bombardment') {
    // 摧毁己方最差的基地，或付 6 权威（保高价值基地）
    let best = null, bestCost = Infinity;
    for (const a of legalActions) {
      if (a.pay) { if (6.5 < bestCost) { bestCost = 6.5; best = a; } }
      else if (a.baseId) {
        const v = valueOf(view, a.baseId);
        if (v < bestCost) { bestCost = v; best = a; }
      }
    }
    return best || legalActions[0];
  }
  return legalActions[0]; // 未知事件兜底
}
