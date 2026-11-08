// 策略名称：价值节奏快攻（Tempo-Value Aggro）
// 选择理由（一句话）：伤害是唯一胜利资源，故以「先斩必杀 → 高效买牌滚雪球 → 销毁起始废牌 → 优先打脸抢血」在对手成型前结束对局。
// 本轮更新：适配 7 模式与 6 牌包、大将战个人权威/moveCard、团队整队轮流与队末清算、新动作字段（choice/row/rows/targets/targetId/double）。

export const meta = {
  name: 'deepseek v4pro',
  description: '模型 deepseek-v4-pro；策略「价值节奏快攻」：把伤害当作唯一胜利资源，先斩必杀、高效买牌滚雪球、销毁起始废牌、优先打脸抢血；已适配 7 种模式与 6 个牌包。'
};

// 卡牌「牌库价值」表（越大约值得买入/保留）。依据基础盒 + 殖民战争全部卡牌的效果
// 字段（战斗/贸易/权威/抽牌/销毁/同盟）折算为单一分值；未列出的牌走 text 解析兜底。
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

// 从中文卡面文本中提取第一个匹配数字（用于对未知牌做通用估值）。
function textNum(txt, re) {
  const m = txt.match(re);
  return m ? Number(m[1]) : 0;
}

// 截取「主要/选择」效果文本（去掉同盟/双同盟/销毁等后续段落），便于二选一分支评分。
function primaryText(text) {
  let t = text || '';
  const cut = t.search(/同盟/);
  if (cut > 0) t = t.slice(0, cut);
  return t;
}

// 对未知牌（frontiers / crisisFleets / crisisBases）按可见字段 + 卡面文本做通用估值。
function fallbackValue(c) {
  const txt = c.text || '';
  let s = (c.cost || 0) * 1.1;
  s += textNum(txt, /(\d+)\s*战斗/) * 1.0;
  s += textNum(txt, /(\d+)\s*贸易/) * 0.9;
  s += textNum(txt, /(\d+)\s*权威/) * 1.15;
  s += textNum(txt, /抽\s*(\d+)\s*张牌/) * 1.8;
  if (/免费获得/.test(txt)) s += 4;
  if (/摧毁目标基地/.test(txt)) s += 3;
  if (/对手弃/.test(txt)) s += 1.5;
  if (/销毁交易行/.test(txt)) s += 2;
  if (c.type === 'base') s += 2;
  if (c.outpost) s += 1;
  return s;
}

function valueOf(view, uid) {
  if (uid == null) return 0;
  const c = view.cards && view.cards[uid];
  if (!c) return 2;
  if (CARD_VALUE[c.id] !== undefined) return CARD_VALUE[c.id];
  return fallbackValue(c);
}

function costOf(view, uid) {
  if (uid == null) return 0;
  const c = view.cards && view.cards[uid];
  return (c && c.cost) ? c.cost : 0;
}

function authorityOf(view, id) {
  const p = view.players && view.players[id];
  return p ? (p.authority || 0) : 0;
}

function tradeOf(view, id) {
  const p = view.players && view.players[id];
  return p ? (p.trade || 0) : 0;
}

function sumValues(view, uids) {
  return (uids || []).reduce((s, uid) => s + valueOf(view, uid), 0);
}

// 给二选一分支文本打分；rowCard 用于「免费获得」分支对交易行卡估价。
function segmentScore(seg, view, rowCard) {
  let s = 0;
  s += textNum(seg, /(\d+)\s*战斗/) * 1.0;
  s += textNum(seg, /(\d+)\s*贸易/) * 0.9;
  s += textNum(seg, /(\d+)\s*权威/) * 1.15;
  s += textNum(seg, /抽\s*(\d+)\s*张牌/) * 1.8;
  if (seg.includes('免费获得')) s += rowCard ? valueOf(view, rowCard) + 1 : 4;
  if (seg.includes('摧毁')) s += rowCard ? 0 : 3;
  if (seg.includes('销毁交易行')) s += rowCard ? costOf(view, rowCard) * 0.9 + 1 : 1;
  return s;
}

// 卡牌「销毁」效果价值（用于评估是否值得发动自毁能力）。
function scrapTextValue(c) {
  const txt = c.text || '';
  const idx = txt.indexOf('销毁：');
  if (idx < 0) return 0;
  const seg = txt.slice(idx + 3);
  let s = 0;
  s += textNum(seg, /(\d+)\s*战斗/) * 1.0;
  s += textNum(seg, /(\d+)\s*贸易/) * 0.9;
  s += textNum(seg, /(\d+)\s*权威/) * 1.15;
  s += textNum(seg, /抽\s*(\d+)\s*张牌/) * 1.8;
  if (seg.includes('摧毁')) s += 4;
  if (seg.includes('免费获得')) s += 4;
  return s;
}

export function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  try {
    memory.calls = (memory.calls || 0) + 1;
    if (!Array.isArray(legalActions) || legalActions.length === 0) return legalActions[0];
    if (view.pending) return pickPending(view, legalActions);
    return pickMain(view, legalActions, playerId);
  } catch (err) {
    // 任何异常都退回安全动作，绝不抛错、绝不返回非数组内对象。
    for (const a of (legalActions || [])) if (a && a.type === 'endTurn') return a;
    return (legalActions && legalActions[0]);
  }
}

// ---------------------------------------------------------------------------
// 主阶段：严格按「必杀 > 打出 > 能力 > 打脸 > 拆基地 > 购买 > 转移 > 移牌 > 结束」节奏。
// ---------------------------------------------------------------------------
function pickMain(view, legalActions, playerId) {
  const mode = view.mode;
  const emperors = view.emperors || [];
  const isEmperorMode = mode === 'emperor';

  // 1) 必杀：伤害足以清空目标权威；大将战优先击毙大将（真正的胜负手）。
  let lethal = null, lethalScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'attack' || a.targetType !== 'player' || !(a.amount > 0)) continue;
    if (a.amount < authorityOf(view, a.targetId)) continue;
    let sc = a.amount;
    if (isEmperorMode && emperors.includes(a.targetId)) sc += 100000;
    if (sc > lethalScore) { lethalScore = sc; lethal = a; }
  }
  if (lethal) return lethal;

  // 2) 打出：先生成资源/触发同盟，几乎永远正确。
  let best = null, bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'play') continue;
    const s = playScore(view, a, playerId);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best) return best;

  // 3) 能力：同盟/基地主要/可选/销毁，仅当净收益为正才用。
  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'ability') continue;
    const s = abilityScore(view, a, playerId);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && bestScore > 0) return best;

  // 4) 攻击：能打脸就全量打脸（前哨会让打脸动作整体不存在，交给引擎过滤）。
  let face = null;
  for (const a of legalActions) {
    if (a.type === 'attack' && a.targetType === 'player') {
      if (!face || a.amount > face.amount) face = a;
    }
  }
  if (face) return face;

  // 5) 拆基地（多为前哨阻挡；团队模式队末才清伤害，可接力拆同一座）。
  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'attack' || a.targetType !== 'base') continue;
    const s = baseAttackScore(view, a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best) return best;

  // 6) 购买：挑性价比最高的可负担卡牌。
  best = null; bestScore = -Infinity;
  for (const a of legalActions) {
    if (a.type !== 'buy') continue;
    const s = buyScore(view, a);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && bestScore > 0) return best;

  // 7) 转移（2V2 / 3V3）：把剩余资源一次性转给队友，队友回合开始即到账。
  let tr = null;
  for (const a of legalActions) {
    if (a.type === 'transfer') { if (!tr || a.amount > tr.amount) tr = a; }
  }
  if (tr) return tr;

  // 8) 大将战移牌：低优先级，只在贸易富余时把弃牌堆好牌喂给相邻队友。
  if (isEmperorMode) {
    let mc = null, mcScore = -Infinity;
    for (const a of legalActions) {
      if (a.type !== 'moveCard') continue;
      const v = valueOf(view, a.cardId);
      const s = tradeOf(view, playerId) >= 3 ? v * 0.2 : 0;
      if (s > mcScore) { mcScore = s; mc = a; }
    }
    if (mc && mcScore > 0) return mc;
  }

  // 9) 结束回合。
  for (const a of legalActions) if (a.type === 'endTurn') return a;

  // 未知动作兜底：返回第一个合法动作，绝不抛异常。
  return legalActions[0];
}

function playScore(view, a, playerId) {
  const c = view.cards && view.cards[a.cardId];
  if (!c) return 0;
  let s = valueOf(view, a.cardId);
  if (a.copy) s += valueOf(view, a.copy) * 0.5; // 隐匿针舰/尖塔：复制价值最高的目标

  const txt = c.text || '';
  const rc = a.row !== undefined ? (view.tradeRow && view.tradeRow[a.row]) : null;

  if (a.choice !== undefined) {
    // 二选一：按卡面文本切「或」后的分支打分；带 row 的分支是「免费获得」。
    const parts = primaryText(txt).split('或');
    const seg = parts[Math.min(a.choice, parts.length - 1)] || '';
    s += segmentScore(seg, view, rc);
  } else if (a.row !== undefined) {
    // 非选择分支的 row：免费获得（acquireCheapFree）或销毁交易行换战斗（scrapRowGainCostCombat）。
    if (txt.includes('免费获得')) s += valueOf(view, rc) + 1.5;
    else if (txt.includes('销毁交易行')) s += costOf(view, rc) * 0.9 + 2;
    else s += valueOf(view, rc) * 0.7;
  }
  return s;
}

function abilityScore(view, a, playerId) {
  const c = view.cards && view.cards[a.cardId];
  if (!c) return 0;
  const kind = a.ability;
  const txt = c.text || '';
  let s = 0;

  // 摧毁目标基地（targetId 可能为 null：销毁能力不带目标）。
  if (a.targetId != null) s += valueOf(view, a.targetId) + 2;

  // 单行：免费获得 / 销毁交易行 / 同盟免费获得。
  if (a.row !== undefined) {
    const rc = view.tradeRow && view.tradeRow[a.row];
    const rv = rc ? valueOf(view, rc) : 0;
    if (txt.includes('免费获得')) s += rv + 1.5;
    else if (txt.includes('销毁交易行')) s += costOf(view, rc) * 0.9 + 2;
    else s += rv * 0.6;
  }

  // 多行（可选销毁交易行 N 张，rows 数组）。
  if (Array.isArray(a.rows)) {
    for (const r of a.rows) {
      const rc = view.tradeRow && view.tradeRow[r];
      s += costOf(view, rc) * 0.5 + 1;
    }
  }

  // 销毁手牌/弃牌堆（targets）或弃牌过牌。
  if (a.targets && a.targets.length) {
    const lost = sumValues(view, a.targets);
    if (kind === 'optional' || kind === 'primary' || kind === 'ally') {
      s += a.targets.length * 2.0 - lost * 0.45;
    }
  }

  // 纯资源 / 同盟 / 双同盟 / 销毁（自毁）。
  if (a.targetId == null && a.row === undefined && !Array.isArray(a.rows) && !(a.targets && a.targets.length)) {
    if (kind === 'ally') {
      s += a.double ? 2.5 : 2.0; // 双同盟是额外一次同盟机会，视作等价免费同盟
    } else if (kind === 'scrap') {
      s += scrapTextValue(c) - valueOf(view, a.cardId) * 0.5; // 自毁多为负，仅效果足够强才用
    } else {
      s += 1.0; // 基地主要 / 可选纯资源
    }
  }
  return s;
}

function baseAttackScore(view, a) {
  const d = view.cards && view.cards[a.targetId];
  if (!d) return 0;
  const defense = d.defense || 0;
  const existing = (view.damage && view.damage[a.targetId]) || 0;
  const needed = Math.max(1, defense - existing);
  const killing = a.amount >= needed;
  return valueOf(view, a.targetId) + (killing ? 15 : 0) - needed * 0.2;
}

function buyScore(view, a) {
  if (a.explorer) return 1.2; // 探索者低优先，仅在无可购时兜底
  const rc = view.tradeRow && view.tradeRow[a.row];
  if (!rc) return 0;
  return valueOf(view, rc) - costOf(view, rc) * 0.6;
}

// ---------------------------------------------------------------------------
// 待决选择：弃牌 / 强制销毁 / 指定弃牌目标 / 事件选择，全部安全兜底。
// ---------------------------------------------------------------------------
function pickPending(view, legalActions) {
  const p = view.pending;
  if (!p) return legalActions[0];
  if (p.type === 'discard' || p.type === 'selectScrap' || p.type === 'scrapMandatory') {
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
