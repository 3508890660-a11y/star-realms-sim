// KIMI 2.8preview · 基地控制 —— 零依赖、只读决策。
// 适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 的任意组合。
// 策略：把「前哨」当作局面核心资产——优先购买与部署己方前哨、优先拆除挡住直伤的敌方前哨；
// 拆塔按「防御缺口 + 拆解后剩余战斗」排序；未摧毁基地伤害回合末清零，故绝不空耗战斗。
// 所有待决选择、未知动作与未知事件一律打分兜底，单次调用必原样返回 legalActions 中的一个对象。

export const meta = {
  name: 'KIMI 2.8preview · 基地控制',
  description: 'KIMI 2.8preview 基地控制：优先购买与保护前哨，按基地防御与剩余战斗拆除敌方前哨，未摧毁伤害清零故只打能一击摧毁的基地；全模式、全扩展、全待决与未知动作安全兜底，零依赖只读。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const arr = v => (Array.isArray(v) ? v : []);

// 事件卡进入交易行时可零成本购买；对会削弱己方基地/权威的事件保持回避。
const EVENT_BIAS = {
  bombardment: -70, supernova: -55, blackHole: -30, comet: -10,
  galacticSummit: 25, quasar: 20, tradeMission: 35, warpJump: 15
};

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = arr(legalActions);
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = arr(v.players);
  const me = players[playerId] || {};
  const damage = v.damage || {};
  const tradeRow = arr(v.tradeRow);

  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const isOutpost = uid => { const c = cardInfo(uid); return !!(c && c.outpost); };
  const isStarter = uid => { const c = cardInfo(uid); return !!c && (c.id === 'scout' || c.id === 'viper'); };

  // ---------- 模式 / 血量 / 控塔倾向 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTeam = me.team;
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const myOutposts = arr(me.inPlay).filter(isOutpost).length;
  let enemyOutposts = 0;
  for (const p of opponents) enemyOutposts += arr(p.inPlay).filter(isOutpost).length;

  // 敌方前哨多 → 偏拆塔；己方前哨多 → 偏防守/发展。用私有记忆轻度平滑，不写入冻结视图。
  let bias = clamp(0.5 + (enemyOutposts - myOutposts) / 8, 0.2, 0.8);
  if (memory && typeof memory === 'object') {
    bias = clamp(0.7 * num(memory._baseBias, bias) + 0.3 * bias, 0.15, 0.85);
    memory._baseBias = bias;
    memory.calls = num(memory.calls, 0) + 1;
  }
  const combat = num(me.combat, 0);
  const authW = 1 + clamp((startAuth - myAuth) / startAuth, 0, 1) * 1.5;
  const seatZeroRisk = (mode === 'firstBlood' && playerId === 0) ? 1 : 0;
  const authLoss = n => myAuth - Math.max(1, myAuth - n);

  // ---------- 卡牌估值：前哨最高，基地次之，贸易/战斗为买塔与拆塔的燃料 ----------
  const sumNums = (text, re) => {
    let s = 0;
    for (const m of String(text).matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  const profile = text => {
    const t = typeof text === 'string' ? text : '';
    return {
      trade: sumNums(t, /(\d+)\s*贸易/g),
      combat: sumNums(t, /(\d+)\s*战斗/g),
      authority: sumNums(t, /(\d+)\s*权威/g),
      draw: sumNums(t, /抽\s*(\d+)\s*张/g),
      discardOpp: sumNums(t, /弃\s*(\d+)\s*张牌/g),
      ally: /同盟/.test(t),
      scrap: /销毁/.test(t),
      discard: /弃/.test(t),
      destroyBase: /摧毁/.test(t),
      free: /免费|置于牌库顶|置入手牌|获得时可/.test(t),
      drawWord: /抽/.test(t)
    };
  };
  const cardValue = uid => {
    const c = cardInfo(uid);
    if (!c) return 1;
    const id = c.id;
    if (id === 'scout') return 2.4;
    if (id === 'viper') return 1.6;
    if (id === 'explorer') return 2.0;
    if (c.type === 'event') return 1;
    const cost = num(c.cost, 3);
    const e = profile(c.text);
    let val = 3;
    val += e.trade * 1.3;
    val += e.combat * 1.4;
    val += e.authority * 1.2;
    val += e.draw * 2.4 + (e.drawWord ? 2 : 0);
    val += e.discardOpp * 2;
    if (c.outpost) val += 12;
    else if (c.type === 'base') val += 5;
    if (e.destroyBase) val += 6;
    if (e.ally) val += 2.5;
    if (e.scrap || e.discard) val += 1.5;
    if (e.free) val += 3;
    if (c.faction && c.faction !== 'neutral') val += 0.5;
    val *= (1 - clamp(cost, 1, 8) * 0.02);
    return val;
  };

  // ---------- 优先级基线（大间隔形成稳定优先级） ----------
  const OFF = {
    killOutpost: 900000,     // 攻击拆掉挡路前哨
    abilityOutpost: 880000,  // ability 不花战斗拆前哨
    play: 700000,
    ally: 660000,
    primary: 640000,
    optional: 620000,
    scrap: 600000,
    abilityBase: 585000,     // ability 拆敌方普通基地
    buyOutpost: 560000,
    buyBase: 520000,
    buyOther: 500000,
    killBase: 480000,        // 攻击摧毁敌方普通基地
    eventBuy: 460000,
    playerAtk: 180000,
    transfer: 100000,
    unknown: 40000,
    chipBase: 20000,         // 打不掉的基地：伤害清零，几乎不投资
    noop: 5000,
    endTurn: -1000000
  };

  // lethal 绝对优先（team2v2 的 authority 为全队共享值，同样成立）。
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // 本回合是否已有「能一击摧毁的敌方前哨」：决定 2V2 是否把战斗转给队友。
  const anyDestroyableOutpost = actions.some(a => {
    if (!a || a.type !== 'attack' || a.targetType !== 'base' || !isOutpost(a.targetId)) return false;
    return num(a.amount, 0) >= Math.max(1, num(cardInfo(a.targetId)?.defense, 1) - num(damage[a.targetId], 0));
  });

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && v.pending.eventId) || '';
    const targets = arr(a.targets);
    if (ev === 'blackHole') {
      const missing = Math.max(0, 2 - targets.length);
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid) * 0.5;
      return -(cost + authLoss(4 * missing) * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) {
        const noCheapBase = !actions.some(x => x && x.type === 'eventChoice' && x.baseId &&
          cardInfo(x.baseId) && !cardInfo(x.baseId).outpost);
        return 50 - authLoss(6) * authW * 2 + (noCheapBase ? 260 : 0) + myOutposts * 30;
      }
      if (a.baseId) {
        const c = cardInfo(a.baseId);
        if (c && c.outpost) return -1000000; // 绝不拆自己的前哨
        return 100 - cardValue(a.baseId) * 2;
      }
      return 0;
    }
    if (ev === 'comet') {
      let benefit = 0;
      for (const uid of targets) {
        if (isOutpost(uid)) benefit -= 100000;
        else if (isStarter(uid)) benefit += 50;
        else {
          const cv = cardValue(uid);
          benefit += cv <= 3.5 ? 10 : -cv * 4;
        }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      let s = 0;
      for (const uid of arr(a.cards)) s -= cardValue(uid) * 3;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择（discard / selectScrap / targetDiscard / eventChoice / 未知） ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':
        return -cardValue(a.cardId) * 10; // 弃最差牌，保留前哨/基地与贸易燃料
      case 'selectScrap': {
        const c = cardInfo(a.cardId);
        return 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0) +
          (c && c.outpost ? -100000 : 0);
      }
      case 'targetDiscard': {
        const t = players[a.targetId] || {};
        const hc = num(t.handCount, arr(t.hand).length);
        const bases = arr(t.inPlay).filter(u => { const c = cardInfo(u); return !!(c && c.type === 'base'); }).length;
        const outposts = arr(t.inPlay).filter(isOutpost).length;
        return 100 + hc * 8 + bases * 6 + outposts * 10 +
          (startAuth - num(t.authority, startAuth)) * 0.4;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0; // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段动作 ----------
  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn':
        return OFF.endTurn;
      case 'transfer': {
        const amt = num(a.amount, 0);
        let s = OFF.transfer + amt * 2;
        if (a.resource === 'combat') s += anyDestroyableOutpost ? -120 : 40; // 战斗优先自己拆塔
        else s += 30; // 贸易余量给队友买前哨
        return s;
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const def = num(c && c.defense, 1);
          const needed = Math.max(1, def - num(damage[a.targetId], 0));
          const destroys = amt >= needed;             // 引擎按 min(needed, combat) 生成 amount
          const leftover = Math.max(0, combat - amt); // 拆解后剩余战斗
          const owner = players.find(p => p && arr(p.inPlay).includes(a.targetId)) || {};
          const ownerAuth = num(owner.authority, startAuth);
          if (!destroys) return OFF.chipBase + leftover * 0.01; // 伤害回合末清零，不主动投资
          if (c && c.outpost) {
            // 先用最小代价拆挡路前哨：剩余战斗越多越好，可继续拆下一座或转直伤。
            return OFF.killOutpost + leftover * 25 + Math.min(def, 10) * 2 +
              (startAuth - ownerAuth) * 0.6 + bias * 60;
          }
          return OFF.killBase + leftover * 8 + cardValue(a.targetId) * 2 +
            (startAuth - ownerAuth) * 0.3;
        }
        if (a.targetType === 'player') {
          // 战斗回合末清零，一次性打满；优先最弱者。
          const t = players[a.targetId] || {};
          const auth = num(t.authority, startAuth);
          let s = OFF.playerAtk + amt * 25 + (startAuth - auth) * 0.8;
          if (mode === 'firstBlood' && playerId === 1 && a.targetId === 0) s += 300;
          return s;
        }
        return OFF.unknown;
      }
      case 'play': {
        const c = cardInfo(a.cardId);
        let s = OFF.play + cardValue(a.cardId) * 1.5;
        if (c && c.outpost) s += 70 + seatZeroRisk * 40;      // 部署前哨
        else if (c && c.type === 'base') s += 30;
        if (a.copy) s += cardValue(a.copy) * 2 + 30;
        if (a.row !== undefined) {
          const uid = tradeRow[a.row];
          const rc = cardInfo(uid);
          s += cardValue(uid) * 1.2 + (rc && rc.outpost ? 60 : 0);
        }
        if (a.choice !== undefined) s += 3;
        return s;
      }
      case 'ability': {
        const kindOff = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional, scrap: OFF.scrap };
        const base = kindOff[a.ability] === undefined ? OFF.unknown : kindOff[a.ability];
        const targets = arr(a.targets);
        const emptyTargets = a.targets !== undefined && targets.length === 0;
        const hasRow = a.row !== undefined || arr(a.rows).length > 0;
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        if (hasTargetId) {
          // 不消耗战斗即可摧毁敌方基地：拆前哨最优先。
          const tc = cardInfo(a.targetId);
          return (tc && tc.outpost ? OFF.abilityOutpost : OFF.abilityBase) +
            (tc ? cardValue(a.targetId) * 2 : 0) + (hasRow ? 40 : 0);
        }
        let val = 0;
        if (hasRow) {
          val += 90;
          const rows = a.row !== undefined ? [a.row] : arr(a.rows);
          for (const row of rows) {
            const rc = cardInfo(tradeRow[row]);
            if (rc && rc.outpost) val += 80;       // 免费获得前哨 / 销毁行内前哨
            else if (rc && rc.type === 'base') val += 25;
          }
        }
        if (a.resource) val += 6;
        if (a.targets !== undefined) {
          let g = 8;
          for (const uid of targets) {
            if (isStarter(uid)) g += 28;
            else {
              const cv = cardValue(uid);
              g += cv <= 3.5 ? 5 : -cv * 2;
            }
          }
          val += g;
        }
        // 无实质效果的空目标能力：最低优先；引擎会标记 used，不会造成死循环。
        if (emptyTargets && !hasRow && a.choice === undefined && !a.resource) return OFF.noop;
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') val -= cardValue(a.cardId) * 0.35;
        return base + val;
      }
      case 'buy': {
        if (a.explorer) return OFF.buyOther - 30;
        const uid = tradeRow[a.row];
        const c = cardInfo(uid);
        if (!c) return OFF.buyOther - 60;
        if (c.type === 'event') {
          const biasEv = EVENT_BIAS[c.id] ?? 0;
          if (biasEv < 0) return OFF.endTurn - Math.abs(biasEv) * 100; // 会削己方基地/权威的事件，绝不主动买
          return OFF.eventBuy + biasEv;
        }
        let s;
        if (c.outpost) {
          s = OFF.buyOutpost + num(c.defense, 3) * 6 + (myOutposts === 0 ? 45 : 0) +
            (1 - bias) * 40 + cardValue(uid) * 8 + seatZeroRisk * 60;
        } else if (c.type === 'base') {
          s = OFF.buyBase + num(c.defense, 3) * 4 + cardValue(uid) * 8 + (myOutposts === 0 ? 12 : 0);
        } else {
          s = OFF.buyOther + cardValue(uid) * 12;
        }
        const owned = new Set();
        for (const u of arr(me.inPlay)) {
          const ci = cardInfo(u);
          for (const f of arr(ci && ci.factions)) owned.add(f);
        }
        if (arr(c.factions).some(f => owned.has(f))) s += 14;
        return s;
      }
      default:
        return OFF.unknown; // 未知动作：安全兜底
    }
  };

  // ---------- 统一择优：始终返回 legalActions 中的原始对象，绝不修改冻结视图 ----------
  const scoreFn = v.pending ? pendingScore : mainScore;
  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = scoreFn(a); } catch (_) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    const jitter = rnd();
    if (typeof jitter === 'number' && Number.isFinite(jitter)) s += jitter * 0.5;
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
