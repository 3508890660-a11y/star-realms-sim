// MIMO-v2.6-pro · 混合博弈 AI —— 零运行时依赖、纯只读决策。
// 适配 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events 的任意组合。
//
// 策略主题「混合博弈」：
//  1. memory 按「模式 + 可见扩展集合」分桶，记录经济/快攻/防守三套权重的历史偏好，
//     并用历次本人掉血速度与对对手的压制速度做反馈，跨调用平滑累积。
//  2. 每次决策依据：对手数量、团队共享权威、血量分布（最低/均值/离散度）、
//     剩余牌库、以及 legalActions 的动作结构，在线混合出当前三权重。
//  3. 三权重同时作用于「卡牌三维估值」与「动作优先级」，实现经济/快攻/防守的连续切换。
//  4. 卡牌估值只依赖结构化字段（cost/type/outpost/defense/factions/set）与规则文本正则，
//     不引用任何具体卡名，因此对任意扩展牌池天然适配。
//  5. lethal 绝对优先；discard/selectScrap/targetDiscard/eventChoice/transfer/未知动作
//     统一打分兜底，始终原样返回 legalActions 中的对象；无 while/递归，不会死循环。

export const meta = {
  name: 'MIMO-v2.6-pro · 混合博弈',
  description: '多模式自适应混合博弈：以 memory 分模式记录经济/快攻/防守历史偏好，按对手数量、团队共享权威、血量分布、牌库余量与合法动作结构动态混合权重；卡牌估值不硬编码卡名，全模式、全扩展、待决与未知动作均安全兜底。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ema = (prev, next, a) => a * next + (1 - a) * num(prev, next);

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const mem = (memory && typeof memory === 'object') ? memory : {};
  const mode = (context && context.mode) || v.mode || 'standard';
  const firstBlood = /firstBlood/i.test(String(mode));

  // ---------- 局面信号 ----------
  const isTeam = me.team !== null && me.team !== undefined;
  const startAuth = isTeam ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (me.team == null || p.team !== me.team));
  const foes = opponents.map(p => num(p.authority, startAuth));
  const nOpp = opponents.length;
  const minFoe = foes.length ? Math.min(...foes) : startAuth;
  const avgFoe = foes.length ? foes.reduce((a, b) => a + b, 0) / foes.length : startAuth;
  const spread = foes.length ? Math.max(...foes) - minFoe : 0;
  const lead = myAuth - avgFoe;
  const deckLeft = num(v.tradeDeckCount, 80);
  const deckPhase = clamp(1 - deckLeft / 80, 0, 0.9);

  // 合法动作结构：局面当下提供的机会类型占比
  const mix = { play: 0, ability: 0, buy: 0, attack: 0, transfer: 0, other: 0 };
  for (const a of actions) {
    if (!a || typeof a !== 'object') continue;
    if (Object.prototype.hasOwnProperty.call(mix, a.type)) mix[a.type]++;
    else mix.other++;
  }

  // ---------- 三权重：由局面信号给出原始倾向 ----------
  const multi = clamp((nOpp - 1) / 3, 0, 1);
  let econ = 1 + 0.9 * (1 - deckPhase) + 0.35 * clamp(mix.buy / 6, 0, 1) - 0.55 * multi;
  let aggro = 1 + 0.7 * deckPhase + 0.45 * clamp(lead / 40, -0.5, 1) +
    0.3 * clamp((avgFoe - minFoe) / 30, 0, 1) + 0.25 * clamp(mix.attack / 12, 0, 1);
  let guard = 1 + 0.8 * multi + 0.4 * clamp(-lead / 40, -0.5, 1) +
    0.25 * clamp(spread / 40, 0, 1) + (isTeam ? 0.35 : 0);
  econ = clamp(econ, 0.25, 2.4);
  aggro = clamp(aggro, 0.25, 2.6);
  guard = clamp(guard, 0.25, 2.6);

  // ---------- memory：按模式分桶记录并反馈历史偏好 ----------
  const setsKey = (() => {
    const s = new Set();
    for (const uid of Object.keys(cards)) {
      const set = cards[uid] && cards[uid].set;
      if (set) s.add(set);
    }
    return [...s].sort().join('+') || 'core';
  })();
  const bucket = `${mode}|${setsKey}`;
  mem.calls = num(mem.calls, 0) + 1;
  if (!mem.prefs || typeof mem.prefs !== 'object') mem.prefs = {};
  const pref = mem.prefs[bucket] || (mem.prefs[bucket] = {
    econ, aggro, guard, visits: 0, hurt: 0, pressure: 0,
    lastAuth: myAuth, lastFoe: minFoe
  });
  // 反馈：本人掉血快 → 更偏防守/经济；能持续压低对手 → 更偏快攻。
  const dSelf = clamp(num(pref.lastAuth, myAuth) - myAuth, 0, 30);
  const dFoe = clamp(num(pref.lastFoe, minFoe) - minFoe, 0, 30);
  pref.hurt = ema(pref.hurt, dSelf, 0.22);
  pref.pressure = ema(pref.pressure, dFoe, 0.22);
  pref.lastAuth = myAuth;
  pref.lastFoe = minFoe;
  pref.visits = num(pref.visits, 0) + 1;
  const wEcon = clamp(0.68 * econ + 0.32 * (num(pref.econ, econ) + 0.02 * pref.hurt), 0.25, 3);
  const wAggro = clamp(0.68 * aggro + 0.32 * (num(pref.aggro, aggro) + 0.03 * pref.pressure), 0.25, 3);
  const wGuard = clamp(0.68 * guard + 0.32 * (num(pref.guard, guard) + 0.03 * pref.hurt), 0.25, 3);
  pref.econ = ema(pref.econ, wEcon, 0.3);
  pref.aggro = ema(pref.aggro, wAggro, 0.3);
  pref.guard = ema(pref.guard, wGuard, 0.3);
  const authW = 1 + 1.6 * (wGuard - 1);

  // ---------- 卡牌估值：只依赖结构化字段与规则文本，不硬编码卡名 ----------
  const info = uid => (uid != null && cards[uid]) || null;
  const sumNums = (text, re) => {
    let total = 0;
    for (const m of String(text).matchAll(re)) total += Number(m[1]) || 0;
    return total;
  };
  const profile = uid => {
    const c = info(uid);
    if (!c) return { econ: 0.8, atk: 0.5, def: 0.4, cost: 0, chaff: false, base: false, outpost: false, factions: [] };
    const t = typeof c.text === 'string' ? c.text : '';
    const e = {
      trade: sumNums(t, /(\d+)\s*贸易/g),
      combat: sumNums(t, /(\d+)\s*战斗/g),
      authority: sumNums(t, /(\d+)\s*权威/g),
      draw: sumNums(t, /抽\s*(\d+)\s*张/g),
      discardOpp: sumNums(t, /弃\s*(\d+)\s*张牌/g),
      ally: /同盟/.test(t),
      scrap: /销毁/.test(t),
      destroyBase: /摧毁/.test(t),
      free: /免费|置于牌库顶|置入手牌|获得时可/.test(t),
      drawWord: /抽/.test(t)
    };
    const cost = num(c.cost, 0);
    const base = c.type === 'base';
    const outpost = !!c.outpost;
    const isEvent = c.type === 'event';
    const factions = Array.isArray(c.factions) ? c.factions :
      (c.faction && c.faction !== 'neutral' ? [c.faction] : []);
    let ec = 1 + e.trade + e.draw * 2.6 + (e.drawWord ? 1.6 : 0) + (e.free ? 3 : 0) +
      (e.ally ? 1.2 : 0) + (e.scrap ? 0.8 : 0) + e.authority * 0.25;
    let at = 0.5 + e.combat + e.discardOpp * 2 + (e.destroyBase ? 2.2 : 0) + (e.ally ? 0.8 : 0);
    let de = 0.3 + e.authority * 1.2 + (outpost ? 3.2 : 0) + (base ? 1.8 : 0) +
      num(c.defense, 0) * 0.35 + (e.drawWord ? 0.5 : 0);
    if (isEvent) { ec = 1; at = 1; de = 1; }
    const chaff = !isEvent && !base && cost <= 1 && (ec + at + de) < 8;
    const eff = 1 - clamp(cost, 1, 8) * 0.02;
    return { econ: ec * eff, atk: at * eff, def: de * eff, cost, chaff, base, outpost, factions };
  };
  const cardScore = uid => {
    const p = profile(uid);
    return wEcon * p.econ + wAggro * p.atk + wGuard * p.def;
  };

  // ---------- lethal：一击致胜，绝对优先（团队模式 authority 为共享值，同样成立） ----------
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---------- 事件待决选择：按动作结构分类，不依赖具体卡名 ----------
  const eventScore = a => {
    const ev = String((a && a.eventId) || (v.pending && (v.pending.eventId || v.pending.kind)) || '');
    if (a && a.pay) return -(6 * authW);           // 支付权威（规则失 6）
    if (a && a.baseId) {                            // 摧毁己方基地：可回归，按折扣计损失
      const p = profile(a.baseId);
      return -(cardScore(a.baseId) * 0.45 + (p.outpost ? 2 : 0.4));
    }
    if (a && a.cards) {                             // 跃迁：差牌回牌库顶、好牌留手
      let s = 0;
      for (const uid of a.cards) s -= cardScore(uid) * 3;
      if (a.cards.length >= 2 && cardScore(a.cards[0]) >= cardScore(a.cards[1])) s += 0.5;
      return s;
    }
    if (a && a.targets) {
      const maxT = actions.reduce((m, x) => (x && Array.isArray(x.targets)) ? Math.max(m, x.targets.length) : m, 0);
      if (/comet/i.test(ev)) {                     // 纯压缩：优先永久压掉结构化低效牌
        let s = 0;
        for (const uid of a.targets) s += profile(uid).chaff ? 45 : -cardScore(uid) * 4;
        return s;
      }
      // 少选要掉血（黑洞类）：权衡弃牌损失与权威损失
      let cost = 0;
      for (const uid of a.targets) cost += cardScore(uid) * 0.5;
      const missing = Math.max(0, maxT - a.targets.length);
      const loss = myAuth - Math.max(1, myAuth - 4 * missing);
      return -(cost + loss * authW);
    }
    return 0;                                      // 未知事件选择：中性兜底
  };

  // ---------- 待决选择 ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':                               // 弃掉三维价值最低的一张
        return -cardScore(a.cardId) * 10 + (profile(a.cardId).chaff ? 60 : 0);
      case 'selectScrap':                           // 强制销毁：优先永久压掉低效牌
        return 200 - cardScore(a.cardId) * 10 + (profile(a.cardId).chaff ? 600 : 0);
      case 'targetDiscard': {                      // 指定弃牌目标：手牌多、威胁大、血线低
        const t = players[a.targetId] || {};
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = (t.inPlay || []).length;
        const auth = num(t.authority, startAuth);
        return 100 + hc * 8 + threat * 3 + (startAuth - auth) * 0.5 * wAggro;
      }
      case 'eventChoice': return eventScore(a);
      default: return 0;                           // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段：大间隔稳定优先级 + 三权重微调 ----------
  const OFF = {
    outpost: 920000, play: 700000, ally: 665000, primary: 630000, optional: 610000,
    destroyBase: 570000, scrap: 560000, buy: 500000, playerAtk: 190000,
    chipBase: 135000, transfer: 110000, unknown: 45000, noop: 12000, endTurn: -1000000
  };
  const buyBase = OFF.buy + 60000 * (wEcon - 1);
  const atkBase = OFF.playerAtk + 90000 * (wAggro - 1);
  const outpostBase = OFF.outpost + 30000 * (wGuard - 1);

  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn': return OFF.endTurn;
      case 'transfer': {                            // 回合末清零的余量预留给队友
        const k = a.resource === 'combat' ? 2.4 : 1.9;
        return OFF.transfer + num(a.amount, 0) * k + (isTeam ? 20 : 0);
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const p = profile(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(info(a.targetId) && info(a.targetId).defense, 1);
          const cv = cardScore(a.targetId) * 0.6;
          if ((dmg + amt) >= def) {
            if (p.outpost) return outpostBase + 30000 * wGuard + amt * 3 + cv;
            return OFF.destroyBase + amt * 3 + cv + 8000 * wAggro;
          }
          return OFF.chipBase + amt * 2 + (p.outpost ? 40 : 0);
        }
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = atkBase + amt * (5 + 18 * wAggro) + (startAuth - auth) * 0.5;
        if (auth <= minFoe + 1) s += 35;           // 补刀最弱者
        if (firstBlood && a.targetId === 0 && playerId === 1) s += 150; // 先血：促首位出局
        return s;
      }
      case 'play': {
        let s = OFF.play + cardScore(a.cardId) * 1.6;
        if (a.copy) s += cardScore(a.copy) * 2 + 25;
        if (a.row !== undefined) s += cardScore((v.tradeRow || [])[a.row]) * 1.2;
        if (a.choice !== undefined) s += 3;
        return s;
      }
      case 'ability': {
        const base = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional, scrap: OFF.scrap }[a.ability];
        const off = base === undefined ? OFF.unknown : base;
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        let val = 0;
        if (hasRow) val += 80 + 30 * wEcon;         // 免费获得 / 销毁交易行
        if (hasTargetId) val += 100 + 40 * wAggro;  // 摧毁敌方基地
        if (a.resource) val += 6;
        if (targets && targets.length) {
          let g = 6;
          for (const uid of targets) g += profile(uid).chaff ? 26 : -cardScore(uid) * 1.8;
          val += g;
        }
        if (targets && targets.length === 0 && !hasRow && !hasTargetId && a.choice === undefined) return OFF.noop;
        if (targets && targets.length === 0) val -= 260;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') val -= cardScore(a.cardId) * 0.35;
        return off + val;
      }
      case 'buy': {
        if (a.explorer) return buyBase - 40 + 20 * wEcon;
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return buyBase - 80;
        let s = buyBase + cardScore(uid) * 13;
        const cf = info(uid);
        const factions = (cf && Array.isArray(cf.factions)) ? cf.factions : [];
        const owned = new Set();
        for (const u of (me.inPlay || [])) {
          const c = info(u);
          for (const f of (c && Array.isArray(c.factions) ? c.factions : [])) owned.add(f);
        }
        if (factions.some(f => owned.has(f))) s += 10 + 6 * wEcon; // 阵营协同
        return s;
      }
      default: return OFF.unknown;                  // 未知动作：安全兜底
    }
  };

  // ---------- 统一择优：原样返回 legalActions 中的对象，绝不修改冻结视图 ----------
  const scoreFn = v.pending ? pendingScore : mainScore;
  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = scoreFn(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5;                              // 极小抖动，仅用于打破平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
