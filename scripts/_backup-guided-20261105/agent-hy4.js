// hy4 · 稳健中期经济 —— 零依赖、只读决策（执行模型 ID：hy4std）
// 适配 standard / ffa / hunter / firstBlood / team2v2 五种模式，
// 以及 core / colonyWars / events 的任意组合；所有动作均原样取自 legalActions。
//
// 优先级骨架：lethal > 拔除敌方前哨 > 出牌与同盟 > 有价值购买 > 削血攻击 >
//             2V2 资源预留 > 未知动作兜底 > 结束回合。
// 主题：以「本人权威 − 对手平均权威」平滑攻防倾向，领先转攻、落后筑防与过牌；
//       按回合数形成中期经济曲线，中期给贸易/过牌/压缩/高费引擎更高权重。

export const meta = {
  name: 'hy4 · 稳健中期经济',
  description: 'hy4std 稳健中期经济：用权威差平滑切换攻防，领先转攻、落后筑防与过牌；按回合推进中期经济曲线，优先 lethal、拔除前哨、出牌同盟与高价值购买，五种模式及 core/colonyWars/events 任意组合全兼容。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 分层优先级：先比 layer，再比同层内的 weight，避免用魔法大数拼分数。
const L = {
  outpostDone: 90,   // 一击摧毁敌方前哨，解锁对玩家直伤
  outpostChip: 72,   // 继续削前哨（尚未摧毁），保障直伤通道
  play: 70,
  ally: 68,
  primary: 64,
  optional: 62,
  scrap: 60,
  buy: 55,
  baseDone: 52,      // 摧毁普通敌方基地
  playerAtk: 40,
  baseChip: 34,      // 普通基地削血
  transfer: 30,
  pending: 60,       // 待决选择专用层
  unknown: 20,       // 未知动作安全兜底
  noop: 8,           // 近似空操作
  endTurn: -100
};

const grade = (layer, weight) => ({ layer, weight });

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (actions.length === 0) return actions[0];
  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = (v.cards && typeof v.cards === 'object') ? v.cards : {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const info = uid => (uid != null && cards[uid]) ? cards[uid] : null;
  const isStarter = uid => {
    const c = info(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper' || c.id === 'explorer');
  };

  // ---- 局面读数 ----
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const teamGame = mode === 'team2v2';
  const startAuth = teamGame ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const foes = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (me.team == null || p.team !== me.team));
  const foeAuth = foes.map(p => num(p.authority, startAuth));
  const minFoe = foeAuth.length ? Math.min.apply(null, foeAuth) : startAuth;
  const avgFoe = foeAuth.length ? foeAuth.reduce((a, b) => a + b, 0) / foeAuth.length : startAuth;

  // ---- 攻防倾向：血量差 + 回合，并用私有记忆做指数平滑（稳健、不抖动）----
  let pressure = clamp(0.5 + (myAuth - avgFoe) / 40, 0.12, 0.9);
  pressure = clamp(pressure + clamp((turn - 8) / 50, 0, 0.16), 0.12, 0.95);
  if (memory && typeof memory === 'object') {
    try {
      pressure = clamp(0.65 * num(memory._pressure, pressure) + 0.35 * pressure, 0.12, 0.95);
      memory._pressure = pressure;
      memory.calls = num(memory.calls, 0) + 1;
    } catch (e) { /* 记忆不可写时忽略，不影响决策 */ }
  }
  const guard = 1 - pressure;   // 落后 → 防御/经济
  const authW = 1 + 2 * guard;  // 血少时权威更珍贵

  // ---- 中期经济曲线：回合钟形 × 牌组成型度，决定贸易/过牌/高费牌的加成 ----
  const zones = [].concat(
    Array.isArray(me.hand) ? me.hand : [],
    Array.isArray(me.discard) ? me.discard : [],
    Array.isArray(me.inPlay) ? me.inPlay : []
  );
  let bought = 0, seen = 0;
  for (const uid of zones) {
    const c = info(uid);
    if (!c) continue;
    seen++;
    if (!isStarter(uid)) bought++;
  }
  const deckQuality = seen ? bought / seen : 0;            // 非初始牌占比 → 经济成型度
  const mid = clamp(1 - Math.abs(turn - 7) / 6, 0, 1);    // turn=7 附近为中期峰值
  const econ = clamp(mid * (0.7 + 0.6 * deckQuality), 0, 1.3);

  // ---- 卡牌估值（只读卡面属性，不硬编码任何扩展牌名）----
  const sum = (text, re) => {
    let s = 0;
    const t = typeof text === 'string' ? text : '';
    for (const m of t.matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  const cardValue = uid => {
    const c = info(uid);
    if (!c) return 1;
    const id = c.id;
    if (id === 'scout') return 1.0 + 0.5 * guard;
    if (id === 'viper') return 1.0 + 0.5 * pressure;
    if (id === 'explorer') return 2.0 + 0.5 * guard;
    const text = typeof c.text === 'string' ? c.text : '';
    const trade = sum(text, /(\d+)\s*贸易/g);
    const combat = sum(text, /(\d+)\s*战斗/g);
    const authority = sum(text, /(\d+)\s*权威/g);
    const draw = sum(text, /抽\s*(\d+)\s*张/g);
    const discardOpp = sum(text, /弃\s*(\d+)\s*张牌/g);
    const cost = num(c.cost, 3);
    let val = 2.5;
    val += trade * (1.0 + 0.9 * econ + 0.4 * guard);
    val += combat * (0.6 + 1.3 * pressure);
    val += authority * (1.0 + 1.6 * guard);
    val += draw * (2.2 + 1.2 * econ + 0.8 * guard) + (/抽/.test(text) ? 1.5 : 0);
    val += discardOpp * (1.6 + 0.6 * guard);
    if (c.outpost) val += 3 + 3.5 * guard;
    else if (c.type === 'base') val += 1.8 + 1.2 * guard;
    if (/同盟/.test(text)) val += 2.2 * (1 + 0.3 * econ);
    if (/销毁/.test(text)) val += 1.4 * econ;        // 中期压缩牌组
    if (/摧毁/.test(text)) val += 2;
    if (/免费|置于牌库顶|置入手牌|获得时可/.test(text)) val += 3;
    if (c.faction && c.faction !== 'neutral') val += 0.5;
    if (cost >= 5) val += (cost - 4) * 0.6 * econ;   // 中期偏爱高费引擎
    val *= 1 - clamp(cost, 1, 8) * 0.02;
    return val;
  };

  // ---- lethal：一击终结，绝对优先（2V2 的 player.authority 已是队伍共享值）----
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---- 事件选择估值 ----
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const loss = myAuth - Math.max(1, myAuth - 4 * Math.max(0, 2 - targets.length));
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid) * 0.5;
      return -(cost + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) return -(myAuth - Math.max(1, myAuth - 6)) * authW;
      if (a.baseId) {
        const b = info(a.baseId);
        return -(cardValue(a.baseId) * 0.4 + (b && b.outpost ? 2 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) {
        if (isStarter(uid)) benefit += 40;
        else {
          const cv = cardValue(uid);
          benefit += cv <= 3.5 ? 10 : -cv * 4;
        }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.5;
      return s;
    }
    return 0;   // 未知事件：中性兜底
  };

  // ---- 待决选择：所有动作同层，用 weight 择优 ----
  const gradePending = a => {
    if (!a || typeof a !== 'object') return grade(L.pending, 0);
    switch (a.type) {
      case 'discard':       return grade(L.pending, -cardValue(a.cardId) * 10);
      case 'selectScrap':   return grade(L.pending, 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0));
      case 'targetDiscard': {
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, Array.isArray(t.hand) ? t.hand.length : 0);
        const threat = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
        return grade(L.pending, 100 + hc * 8 + threat * 3 + (guard * auth + pressure * (startAuth - auth)) * 0.5);
      }
      case 'eventChoice':   return grade(L.pending, eventScore(a));
      default:              return grade(L.pending, 0);   // 未知待决动作
    }
  };

  // ---- 主阶段动作 ----
  const gradeMain = a => {
    if (!a || typeof a !== 'object') return grade(L.unknown, 0);
    switch (a.type) {
      case 'endTurn':
        return grade(L.endTurn, 0);
      case 'transfer':
        return grade(L.transfer, num(a.amount, 0) * 2 + (a.resource === 'trade' ? 4 * econ : 0));
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = info(a.targetId);
          const def = num(c && c.defense, 1);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const outpost = !!(c && c.outpost);
          const destroyed = (dmg + amt) >= def;
          const cv = cardValue(a.targetId) * 0.6;
          if (destroyed && outpost) return grade(L.outpostDone, 40000 * guard + amt * 3 + cv);
          if (destroyed)            return grade(L.baseDone, amt * 3 + cv);
          if (outpost)              return grade(L.outpostChip, amt * 3 + cv + 30);
          return grade(L.baseChip, amt * 2);
        }
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let w = amt * (6 + 20 * pressure) + (startAuth - auth) * 0.5;
        if (auth <= minFoe + 1) w += 40;   // 聚焦最弱、最接近出局者
        return grade(L.playerAtk, w);
      }
      case 'play': {
        let w = cardValue(a.cardId) * 1.6;
        if (a.copy) w += cardValue(a.copy) * 2 + 30;                       // 复制强力牌
        if (a.row !== undefined) w += cardValue((v.tradeRow || [])[a.row]) * 1.2; // 免费获得
        if (a.choice !== undefined) w += 3;                                // 选择效果抖动择优
        return grade(L.play, w);
      }
      case 'ability': {
        const base = ({ ally: L.ally, primary: L.primary, optional: L.optional, scrap: L.scrap })[a.ability];
        const layer = base === undefined ? L.unknown : base;
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const empty = targets && targets.length === 0;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        let w = 0;
        if (hasRow) w += 90;        // 销毁交易行 / 免费获得
        if (hasTargetId) w += 110;  // 摧毁敌方基地
        if (a.resource) w += 6;
        if (targets && targets.length) {
          let g = 8;               // 弃/回收/销毁：滤掉差牌
          for (const uid of targets) {
            if (isStarter(uid)) g += 28;
            else g += cardValue(uid) <= 3.5 ? 5 : -cardValue(uid) * 2;
          }
          w += g;
        }
        if (empty && !hasRow && !hasTargetId && a.choice === undefined) return grade(L.noop, 0);
        if (empty) w -= 300;
        if (a.choice !== undefined) w += 3;
        if (a.ability === 'scrap') w -= cardValue(a.cardId) * 0.35;  // 销毁自身失去这张牌
        return grade(layer, w);
      }
      case 'buy': {
        if (a.explorer) return grade(L.buy, -30);   // 探索者：低优先经济填充
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return grade(L.buy, -60);
        let w = cardValue(uid) * 13;
        const owned = new Set();
        for (const u of (Array.isArray(me.inPlay) ? me.inPlay : [])) {
          const c = info(u);
          if (c && Array.isArray(c.factions)) for (const f of c.factions) owned.add(f);
        }
        const cf = info(uid);
        if (cf && Array.isArray(cf.factions) && cf.factions.some(f => owned.has(f))) w += 12; // 阵营协同
        return grade(L.buy, w);
      }
      default:
        return grade(L.unknown, 0);   // 任何未知动作：安全兜底
    }
  };

  // ---- 统一择优：只读遍历，始终返回 legalActions 中的原始对象引用 ----
  const gradeFn = v.pending ? gradePending : gradeMain;
  let best = actions[0];
  let bestLayer = -Infinity, bestWeight = -Infinity;
  for (const a of actions) {
    let g;
    try { g = gradeFn(a); } catch (e) { g = grade(L.unknown, 0); }
    const layer = num(g && g.layer, 0);
    const weight = num(g && g.weight, 0) + rnd() * 0.25;   // 极小抖动，仅破平局
    if (layer > bestLayer || (layer === bestLayer && weight > bestWeight)) {
      bestLayer = layer; bestWeight = weight; best = a;
    }
  }
  return best;
}
