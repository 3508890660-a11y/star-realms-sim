// ============================================================
// 策略名称：雪球收割（Snowball-Reap）
// 选择理由（一句话）：1v1 的胜负手是「经济差 × 战斗转化效率」——
// 早期用高性价比贸易牌把雪球滚大，中期用高战斗效率牌把雪球兑换成权威伤害，
// 同时用权威牌守住生命线；全部决策由统一的「等效权威分」驱动，稳快兼顾。
//
// 零依赖：不使用 import / require。
// 引擎视图的 cards[uid] 只暴露 name/cost/type/faction/defense/outpost/factions/text，
// 不暴露效果结构，因此本文件按 src/engine/cards.js 与 expansions.js 的卡牌定义
// 内置了一份效果表 FX（仅用于评分，不参与规则计算）。
// ============================================================

const KNOWN_ACTION_TYPES = new Set([
  'play', 'ability', 'buy', 'attack', 'transfer',
  'discard', 'selectScrap', 'targetDiscard', 'eventChoice'
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
  lethal: 1000,
  actThreshold: 0.5,
};

// ---- 卡牌效果表（依据 src/engine/cards.js / expansions.js 整理，仅用于评分）----
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
};

// ---- 效果对象评分（一次性的即时/静态价值）----
function scoreEffect(e, ctx) {
  if (!e || typeof e !== 'object') return 0;
  const authMult = (ctx && ctx.authMult) || 1;
  const combatMult = (ctx && ctx.combatMult) || 1;
  const tradeBoost = ctx && ctx.tradeUrgent ? 0.5 : 0;
  const combatBoost = ctx && ctx.combatUrgent ? 0.6 : 0;
  let v = 0;
  if (e.trade) v += e.trade * SC.trade + tradeBoost;
  if (e.combat) v += e.combat * SC.combat * combatMult + combatBoost;
  if (e.authority) v += e.authority * SC.authority * authMult;
  if (e.draw) v += e.draw * SC.draw;
  if (e.drawIfTwoBases && ctx && ctx.myBases >= 2) v += e.drawIfTwoBases * SC.draw * 0.7;
  if (e.drawIfThreeBases && ctx && ctx.myBases >= 3) {
    v += e.drawIfThreeBases * SC.draw * 0.7;
    if (e.authorityIfThreeBases) v += e.authorityIfThreeBases * SC.authority * 0.7 * authMult;
  }
  if (e.drawBlobPlayed && ctx) v += Math.max(0, ctx.blobPlayed || 0) * SC.draw * 0.9;
  if (e.combatIfEnemyBase && ctx && ctx.enemyHasBase) v += e.combatIfEnemyBase * SC.combat * 0.6 * combatMult;
  if (e.combatPerScrapOwn && ctx) v += e.combatPerScrapOwn * Math.max(0, ctx.scrapped || 0) * SC.combat;
  if (e.discardOpponent) v += e.discardOpponent * SC.discardOpp;
  if (e.topDeckNextShip) v += SC.topDeck;
  if (e.topDeckNextAny) v += SC.topDeck;
  if (e.nextAcquireToHand) v += SC.toHand;
  if (e.recycle) v += SC.recycle;
  if (e.discardThenDraw) v += SC.discardThenDraw;
  if (e.depot) v += SC.depot;
  if (e.acquireFreeMax !== undefined) v += SC.acquireFree;
  if (e.acquireShipFree) v += SC.acquireFree;
  if (e.acquireCheapFree) v += SC.acquireFree * 0.8;
  if (e.scrapRow) v += e.scrapRow * SC.scrapRow;
  if (e.scrapOwn) v += e.scrapOwn * SC.scrapOwn;
  if (e.drawPerScrap) v += SC.drawPerScrap;
  if (e.destroyBase) v += SC.destroyBase;
  if (e.destroyAndOrScrap) v += SC.destroyAndScrap;
  return v;
}

// ---- 单卡长期价值（用于购买、弃牌、拆牌等决策）----
function cardScore(card, ctx) {
  if (!card) return 0;
  const fx = FX[card.id] || {};
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
  if (fx.scrap) v += scoreEffect(fx.scrap, ctx) * SC.scrapFactor;
  if (fx.optionalPrimary) v += scoreEffect(fx.optionalPrimary, ctx) * SC.optionalFactor;
  if (card.type === 'base') v *= SC.baseFactor;
  if (card.outpost) v += SC.outpost;
  if (fx.fleetHQ) v += SC.fleetHQ;
  if (fx.empireShipBonus) v += SC.empireShipBonus;
  if (fx.allAlly) v += SC.allAlly;
  if (fx.copyShip || fx.copyBase) v += SC.copyCard;
  if (card.faction && card.faction !== 'neutral' && ctx.myFactions.indexOf(card.faction) >= 0) v += SC.factionSynergy;
  return v;
}

// ---- 敌方基地威胁分 ----
function threatScore(d, ctx) {
  if (!d) return 0;
  let v = cardScore(d, ctx) * 0.8;
  if (ctx.minOppAuth <= 12) v += 1.5;
  return v;
}

// ---- 决策上下文 ----
function buildCtx(view, playerId, memory, context) {
  const players = view.players || [];
  const me = players[playerId] || { authority: 0, trade: 0, combat: 0, hand: [], inPlay: [], discard: [] };
  const mode = (view && view.mode) || (context && context.mode) || 'standard';
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated);
  const cards = view.cards || {};
  const myInPlay = me.inPlay || [];
  const typeOf = uid => { const c = cards[uid]; return c ? c.type : null; };
  const myBases = myInPlay.filter(uid => typeOf(uid) === 'base').length;
  const myFactions = [];
  for (const uid of myInPlay) {
    const c = cards[uid];
    if (c && Array.isArray(c.factions)) {
      for (const f of c.factions) if (myFactions.indexOf(f) < 0) myFactions.push(f);
    }
  }
  const enemyHasBase = opponents.some(o => (o.inPlay || []).some(uid => typeOf(uid) === 'base'));
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
  // 前哨阻挡与资源紧迫度
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
  const combatUrgent = (faceBlocked && me.combat < minOutpostNeeded) || (me.combat < minOppAuth);
  const ctx = {
    view, me, playerId, mode, opponents, cards,
    myBases, myFactions, enemyHasBase, blobPlayed,
    hasFleetHQ, hasCommandCenter, myAuth, minOppAuth, maxOppAuth,
    authMult, combatMult, underPressure, faceBlocked, combatUrgent,
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

// ---- 各动作评分 ----
function scorePlay(action, ctx) {
  const view = ctx.view;
  const self = view.cards[action.cardId];
  if (!self) return 0;
  const selfFx = FX[self.id] || {};
  let fx = selfFx;
  let copyCard = null;
  if (action.copy) {
    copyCard = view.cards[action.copy];
    if (copyCard) fx = FX[copyCard.id] || {};
  }
  const isBase = self.type === 'base' || (copyCard && copyCard.type === 'base');
  if (isBase) {
    // 基地打出即上场：长期价值折现（复制牌再加复制目标价值）
    let v = cardScore(self, ctx) * SC.basePlayFactor;
    if (copyCard) v += cardScore(copyCard, ctx) * SC.copyBonus;
    return v;
  }
  // 飞船打出即结算 primary
  let v = 0.5;
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
  const fx = FX[card.id] || {};
  const kind = action.ability;
  const hand = ctx.me.hand || [];
  const costOf = uid => {
    const d = view.cards[uid];
    if (!d) return 0;
    return cardScore(d, ctx) * (hand.indexOf(uid) >= 0 ? SC.handLoss : SC.discardLoss);
  };
  const sumCost = targets => (targets || []).reduce((s, u) => s + costOf(u), 0);

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
    if (effect.scrapOwn) return scoreEffect(effect, ctx) - sumCost(targets);
    return scoreEffect(effect, ctx);
  }

  if (kind === 'ally') {
    const e = fx.ally;
    if (!e) return 0;
    let v = scoreEffect(e, ctx) * SC.allyFactor;
    if ((e.acquireShipFree || e.acquireCheapFree) && action.row !== undefined) {
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
      return SC.scrapOwnTiny * targets.length - sumCost(targets);
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
  const fx = FX[d.id] || {};
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
    if (me.combat < needed) return 0; // 一击拆不掉，伤害回合末清零，不浪费战斗
    if (d && d.outpost) {
      const owner = view.players[d.owner];
      let otherOutposts = 0;
      if (owner) {
        for (const uid of (owner.inPlay || [])) {
          const c = view.cards[uid];
          if (c && c.outpost && uid !== action.targetId) otherOutposts++;
        }
      }
      return SC.outpostBreak + 0.4 * defense + (otherOutposts === 0 ? SC.outpostUnlock : 0);
    }
    return threatScore(d, ctx) * SC.nonOutpostAttack;
  }
  const target = view.players[action.targetId];
  if (!target) return 0;
  const auth = typeof target.authority === 'number' ? target.authority : 0;
  const amount = action.amount || 0;
  if (amount >= auth) {
    // 致命一击；先血模式下打死别人会让第三者获胜，宁可空过
    if (ctx.mode === 'firstBlood' && !firstBloodWinnerIsMe(view, action.targetId, ctx.playerId)) return 0.1;
    return SC.lethal;
  }
  let mult = 1 + (auth <= 15 ? 0.25 : 0) + (auth <= 8 ? 0.2 : 0);
  if (ctx.underPressure) mult *= 0.95;
  let v = amount * SC.combat * mult;
  if (amount < me.combat) v -= 0.5; // 没打满属于次优
  return v;
}

function scoreTransfer(action, ctx) {
  const per = action.resource === 'combat' ? SC.combat : SC.trade;
  return (action.amount || 0) * per;
}

// ---- 待决选择 ----
function handlePending(view, legalActions, playerId, ctx) {
  const p = view.pending || {};
  if (p.type === 'discard' || p.type === 'selectScrap') {
    let best = null;
    let bestScore = Infinity;
    for (const a of legalActions) {
      let s = 0;
      try {
        const d = view.cards[a.cardId];
        s = cardScore(d, ctx);
        if (p.type === 'selectScrap' && d && d.id === 'explorer') s -= 0.2; // 销毁探索者会回补供应堆，略优先
      } catch (err) { s = 0; }
      if (s < bestScore) { bestScore = s; best = a; }
    }
    return best || legalActions[0];
  }
  if (p.type === 'targetDiscard') {
    let best = null;
    let bestScore = -Infinity;
    for (const a of legalActions) {
      const o = view.players[a.targetId];
      const s = ((o && o.handCount) || 0) - ((o && o.authority) || 0) * 0.03;
      if (s > bestScore) { bestScore = s; best = a; }
    }
    return best || legalActions[0];
  }
  if (p.type === 'eventChoice') return scoreEventChoice(view, legalActions, ctx, p);
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
        else if (a.baseId) s = -cardScore(view.cards[a.baseId], ctx) * (me.authority <= 8 ? 1.5 : 0.9);
        else s = -1;
      } else if (kind === 'comet') {
        // 可销毁手牌/弃牌堆至多两张：只拆低分废牌
        s = (a.targets || []).reduce((sum, uid) => sum + (1.2 - 0.45 * cardScore(view.cards[uid], ctx)), 0);
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
        default: s = -Infinity; // 未知动作类型不参与选择
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
  description: '模型 ID step-5-preview；自选策略「雪球收割」：1v1 胜负手是经济差与战斗转化效率的乘积，早期买高性价比贸易牌滚大雪球、中期用高战斗效率牌收割权威并保留生命线，全部决策由统一等效权威分驱动，五模式与全部扩展通用。'
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
