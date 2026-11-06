// HY4 稳态中盘 AI —— 零依赖、只读决策，适配 standard/ffa/hunter/firstBlood/team2v2
// 与 core/colonyWars/events 的任意组合。不改 view/legalActions，不引入任何依赖。
//
// 策略：稳健中期经济。以「本人权威 − 对手平均权威」的血量差动态调节攻防：
//   领先 → 提高战斗/玩家攻击权重，尽快施压终结；落后 → 提高贸易/过牌/回血/前哨权重，筑防蓄力。
//   固定优先级：lethal > 拔除前哨 > 出牌 > 同盟 > 有价值购买 > 削血攻击 > 预留余量。
//   所有 pending 与未知动作都打分兜底，始终原样返回 legalActions 中的一个对象。

export const meta = {
  name: 'HY4 · 稳态中盘',
  description: 'HY4 稳健中期经济：依据权威（血量）差动态切换攻防——领先时施压终结、落后时回血筑防并压缩牌组；优先 lethal、拔除前哨、出牌、同盟与高价值购买。全模式、全扩展、全待决与未知动作均安全兜底。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};

  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = cardInfo(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  // ---------- 血量差 → 攻防倾向 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTeam = me.team; // 非团队模式为 null
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const auths = opponents.map(p => num(p.authority, startAuth));
  const minEnemy = auths.length ? Math.min(...auths) : startAuth;
  const avgEnemy = auths.length ? auths.reduce((a, b) => a + b, 0) / auths.length : startAuth;
  const lead = myAuth - avgEnemy;
  let aggro = clamp(0.5 + lead / 45, 0.1, 0.9);
  aggro = clamp(aggro + clamp((turn - 6) / 40, 0, 0.2), 0.1, 0.95);
  // 「稳健」：用座位私有记忆做轻度平滑，避免攻防倾向剧烈抖动。
  if (memory && typeof memory === 'object') {
    aggro = clamp(0.7 * num(memory._aggro, aggro) + 0.3 * aggro, 0.1, 0.95);
    memory._aggro = aggro;
    memory.calls = num(memory.calls, 0) + 1;
  }
  const guard = 1 - aggro;     // 落后 → 偏防守/经济
  const authW = 1 + 2 * guard; // 血量越低，权威越珍贵

  // ---------- 卡牌估值：面向中期经济，随攻防动态变化 ----------
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
    if (id === 'scout') return 1.0 + 0.6 * guard;     // 贸易：落后时更想保留
    if (id === 'viper') return 1.1 + 0.6 * aggro;     // 战斗：领先时更想保留
    if (id === 'explorer') return 2.2 + 0.6 * guard;  // 经济填充/压缩牌
    const cost = (typeof c.cost === 'number' && Number.isFinite(c.cost)) ? c.cost : 3;
    const e = profile(c.text);
    let val = 3;
    val += e.trade * (1.0 + 0.4 * guard);
    val += e.draw * 2.6 + (e.drawWord ? 2 : 0);
    val += e.authority * (1.1 + 1.4 * guard);
    val += e.combat * (0.6 + 1.2 * aggro);
    val += e.discardOpp * 2.2;
    if (c.outpost) val += 3 + 3 * guard;
    else if (c.type === 'base') val += 2 + 1.5 * guard;
    if (e.ally) val += 2.5;
    if (e.scrap || e.discard) val += 1.5;
    if (e.destroyBase) val += 2;
    if (e.free) val += 3;
    if (c.faction && c.faction !== 'neutral') val += 0.5;
    val *= (1 - clamp(cost, 1, 8) * 0.018); // 轻微偏好高效中费牌
    return val;
  };

  // ---------- 优先级基线（大间隔形成稳定优先级） ----------
  const OFF = {
    outpost: 920000,      // 摧毁敌方前哨：最高非致命优先（拔护盾、解锁对玩家攻击）
    play: 700000,         // 出牌
    ally: 660000,         // 同盟
    primary: 620000,      // 主要能力
    optional: 600000,     // 可选能力
    destroyBase: 565000,  // 摧毁普通敌方基地
    scrap: 560000,        // 销毁能力
    buy: 500000,          // 有价值购买
    playerAtk: 180000,    // 对玩家削血
    chipBase: 130000,     // 未摧毁的基地削血
    transfer: 100000,     // 2V2 把回合末清零的余量预留给队友
    unknown: 40000,       // 未知动作安全兜底
    noop: 10000,          // 近似空操作
    endTurn: -1000000
  };

  // lethal：一击致胜，绝对优先（team2v2 的 authority 为全队共享值，同样成立）。
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      // 弃至多两张：每少弃一张失去 4 权威（下限 1）。弃掉的牌进弃牌堆可回收，故折算一半。
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = myAuth - Math.max(1, myAuth - 4 * missing);
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid);
      return -(cost * 0.5 + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) {
        const loss = myAuth - Math.max(1, myAuth - 6);
        return -(loss * authW);
      }
      if (a.baseId) {
        const c = cardInfo(a.baseId); // 己方基地被摧毁后进入弃牌堆（可回归），损失按折扣计
        return -(cardValue(a.baseId) * 0.4 + (c && c.outpost ? 2 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 永久销毁：优先压掉初始牌/廉价牌，绝不损失好牌；targets:[] 可安全跳过。
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
      // 抽三放二回牌库顶：偏好把较差的两张放回去、把最好的留在手里（本回合即可用）。
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.5;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择（discard / selectScrap / targetDiscard / eventChoice） ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':       // 我是弃牌者：弃掉手里最差的一张
        return -cardValue(a.cardId) * 10;
      case 'selectScrap':   // 强制销毁：优先永久压掉初始牌以压缩牌组
        return 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多 / 威胁大的对手弃牌
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = (t.inPlay || []).length;
        return 100 + hc * 8 + threat * 3 + (guard * auth + aggro * (startAuth - auth)) * 0.5;
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
      case 'transfer': // 回合末会清零的余量，优先一次预留较大额度给队友
        return OFF.transfer + num(a.amount, 0) * 2;
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) {
            const cv = cardValue(a.targetId) * 0.6;
            if (outpost) return OFF.outpost + 40000 * guard + amt * 3 + cv;
            return OFF.destroyBase + amt * 3 + cv;
          }
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0); // 未摧毁削血：先发展再处理
        }
        // 对玩家：聚焦最弱/最接近出局者，领先时伤害权重更高
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const weakest = auth <= minEnemy + 1;
        let s = OFF.playerAtk + amt * (6 + 20 * aggro);
        s += (startAuth - auth) * 0.5;
        if (weakest) s += 40;
        return s;
      }
      case 'play': {
        let s = OFF.play + cardValue(a.cardId) * 1.5;
        if (a.copy) s += cardValue(a.copy) * 2 + 30;                       // 复制强力牌
        if (a.row !== undefined) s += cardValue((v.tradeRow || [])[a.row]) * 1.2; // 免费获得
        if (a.choice !== undefined) s += 3;                                 // 选择效果：抖动择优
        return s;
      }
      case 'ability': {
        const kindOff = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional, scrap: OFF.scrap };
        const base = kindOff[a.ability] === undefined ? OFF.unknown : kindOff[a.ability];
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const emptyTargets = targets && targets.length === 0;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        let val = 0;
        if (hasRow) val += 90;        // 销毁交易行 / 免费获得
        if (hasTargetId) val += 110;  // 摧毁敌方基地
        if (a.resource) val += 6;
        if (targets && targets.length) {
          let g = 8;                 // 弃/回收/销毁：滤掉差牌
          for (const uid of targets) {
            if (isStarter(uid)) g += 28;
            else {
              const cv = cardValue(uid);
              g += cv <= 3.5 ? 5 : -cv * 2;
            }
          }
          val += g;
        }
        if (emptyTargets && !hasRow && !hasTargetId && a.choice === undefined) {
          return OFF.noop;           // 空目标且无其它效果：近似空操作，尽量不做
        }
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') val -= cardValue(a.cardId) * 0.35; // 销毁自身会失去这张牌
        return base + val;
      }
      case 'buy': {
        if (a.explorer) return OFF.buy - 30; // 探索者：低优先经济填充
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buy - 60;
        let s = OFF.buy + cardValue(uid) * 14; // 按卡牌价值择优，价值已含血量差权重
        const owned = new Set();
        for (const u of (me.inPlay || [])) {
          const c = cardInfo(u);
          for (const f of (c && Array.isArray(c.factions) ? c.factions : [])) owned.add(f);
        }
        const cf = cardInfo(uid);
        if (cf && Array.isArray(cf.factions) && cf.factions.some(f => owned.has(f))) s += 12;
        return s;
      }
      default:
        return OFF.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  // ---------- 统一择优：始终返回 legalActions 中的原始对象，绝不修改 ----------
  const scoreFn = v.pending ? pendingScore : mainScore;
  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = scoreFn(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5; // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
