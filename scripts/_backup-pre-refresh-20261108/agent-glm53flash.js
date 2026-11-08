// 策略名称：精炼雪球（Refined Snowball）
// 选择理由（一句话）：1v1 没有回合上限，初始牌库 80% 是只值 1 贸易的侦察艇，
// 因此「贸易复利购买 + 持续销毁低质牌做牌库压缩」能滚出不可逆的质量差，
// 前中期囤经济，中后期把经济兑成一波爆发战斗，精确结算 lethal 并压制对方前哨。

export const meta = {
  name: 'GLM5.3flash 精炼雪球',
  description: 'glm-5.3-flash · 精炼雪球：前中期重贸易购买并以销毁能力压缩牌库，滚出手牌质量雪球；中后期转化为爆发战斗、精确 lethal 与前哨控制压制对手。'
};

// ---------------------------------------------------------------------------
// 卡牌估值表（基础盒 + 殖民战争）。RATING：购买价值 0-10；KEEP：保留价值（弃牌/销毁时用）。
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
  explorer: 5
};
const KEEP = Object.assign({}, RATING, { scout: 0.4, viper: 0.8, explorer: 2.6 });

// ---------------------------------------------------------------------------
// 基础工具（只读，不修改 view / legalActions）
// ---------------------------------------------------------------------------
function def(view, uid) {
  return view && view.cards ? view.cards[uid] : null;
}
function rateDef(d) {
  if (!d) return 0;
  const r = RATING[d.id];
  return typeof r === 'number' ? r : Math.min(3 + (d.cost || 0) * 0.7, 9);
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
function econPhase(view, me, context) {
  const turn = (context && context.turn) || view.turn || 1;
  if (view.mode === 'team2v2') return turn <= 9;
  return turn <= 6;
}

// ---------------------------------------------------------------------------
// lethal：先手必杀。firstBlood 模式下若击杀会把胜利送给别人则不杀。
// ---------------------------------------------------------------------------
function findLethal(view, legalActions, me) {
  for (const a of legalActions) {
    if (a.type !== 'attack' || a.targetType !== 'player') continue;
    const t = view.players[a.targetId];
    if (!t) continue;
    if (a.amount < t.authority) continue;
    if (view.mode === 'firstBlood' && rightNeighborAlive(view, a.targetId) !== me) continue;
    return a;
  }
  return null;
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
  return legalActions[0];
}

// 事件选择：黑洞 / 彗星 / 轨道轰击 / 跃迁，未知事件走兜底。
function handleEvent(view, actions, me) {
  const p = view.pending || {};
  let kind = p.kind;
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
// 打牌：全都要打，挑“分支质量”最高的先打（复制对象、primaryChoice 分支）。
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
    s += choiceScorePlay(view, a, me, econ);
    if (s > bs) { bs = s; best = a; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 能力：同盟 / 主要 / 可选 / 销毁。销毁压缩牌库优先，其次摧毁前哨，再同盟，再资源。
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
  // 优先可整杀的前哨（剩余防御最低），否则价值最高的基地。
  let bestOutpost = null, bestODef = Infinity;
  let bestBase = null, bestRating = -Infinity;
  for (const uid of targetIds || []) {
    const d = def(view, uid);
    if (!d) continue;
    if (d.outpost) {
      const remain = Math.max(1, (d.defense || 1));
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

  // 销毁己方牌的压缩能力（机械阵营为主）：目标全部是侦察艇/毒蛇才动手
  if (targets) {
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
    return -1; // 没有低质牌就不启动销毁/弃牌能力
  }

  // 同盟免费拿牌
  if (a.ability === 'ally' && a.row !== undefined) {
    const rd = def(view, view.tradeRow[a.row]);
    if (!rd) return -1;
    return 3 + rateDef(rd) * 0.3; // blobCarrier / moonwurm / leviathan
  }

  // 摧毁目标基地（missileMech 可选 / mechCruiser、commandShip 同盟等）
  if (a.targetId !== undefined && a.ability !== 'scrap') {
    const td = def(view, a.targetId);
    if (!td) return -1;
    return td.outpost ? 4 : 2 + rateDef(td) * 0.2;
  }

  // blobDestroyer 同盟：摧毁基地和/或销毁交易行
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

  // 销毁交易行（swarmer / ravager）：只在对手必抢的高价值卡且我买不起时才拆行拒购
  if (a.row !== undefined || Array.isArray(a.rows)) {
    const rows = a.rows || [a.row];
    let deny = 0;
    for (const r of rows) {
      const rd = def(view, view.tradeRow[r]);
      if (rd && rateDef(rd) >= 8 && (view.players[me].trade || 0) < (rd.cost || 0)) deny += 1.5;
    }
    return deny > 0 ? 2.5 : -1;
  }

  // 置牌库顶类同盟（centralOffice / freighter / federationShipyard）
  if (a.ability === 'ally') return 3;
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
// 攻击：只整杀不半伤（引擎在回合末清空基地伤害记录，半伤全是浪费）。
// ---------------------------------------------------------------------------
function pickAttack(view, legalActions, me) {
  const atks = legalActions.filter(a => a.type === 'attack');
  if (!atks.length) return null;
  const face = atks.filter(a => a.targetType === 'player');
  const baseActs = atks.filter(a => a.targetType === 'base');

  if (face.length) {
    const enemies = [...new Set(face.map(a => a.targetId))];
    let target;
    if (view.mode === 'firstBlood') {
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
      return d && a.amount >= (d.defense || 1);
    });
    if (killable.length) {
      const outposts = killable.filter(a => def(view, a.targetId).outpost);
      const pool = outposts.length ? outposts : killable;
      const best = pool.reduce((b, a) => {
        if (outposts.length) {
          return (def(view, a.targetId).defense || 0) < (def(view, b.targetId).defense || 0) ? a : b;
        }
        return rating(view, a.targetId) > rating(view, b.targetId) ? a : b;
      });
      return best;
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
    if (a.explorer) d = { id: 'explorer', faction: 'neutral', cost: 2, type: 'ship' };
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
  return null; // 剩的贸易太低不值得乱花（2V2 会转给队友）
}

// ---------------------------------------------------------------------------
// 2V2：回合末把用不掉的贸易/战斗转给队友（资源不转就浪费）。
// ---------------------------------------------------------------------------
function pickTransfer(view, legalActions, me) {
  if (!Array.isArray(view.teams) || !view.teams.length) return null;
  const p = view.players[me] || {};
  const acts = legalActions.filter(a => a.type === 'transfer');
  if (!acts.length) return null;
  if ((p.trade || 0) > 0) {
    const t = acts.find(a => a.resource === 'trade' && a.amount === p.trade);
    if (t) return t;
  }
  if ((p.combat || 0) > 0) {
    const c = acts.find(a => a.resource === 'combat' && a.amount === p.combat);
    if (c) return c;
  }
  return null;
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

  // 2. 能力（同盟/销毁压缩/资源/摧毁基地）
  const ability = pickAbility(view, legalActions, me, econ);
  if (ability) return ability;

  // 3. 攻击（lethal 已在前面处理，这里做整杀前哨与打脸）
  const attack = pickAttack(view, legalActions, me);
  if (attack) return attack;

  // 4. 购买（每次调用买一件，引擎会带着新状态再次询问）
  const buy = pickBuy(view, legalActions, me, econ);
  if (buy) return buy;

  // 5. 2V2 转移剩余资源
  const transfer = pickTransfer(view, legalActions, me);
  if (transfer) return transfer;

  // 6. 兜底：未知动作类型时优先选一个非结束回合的动作
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
