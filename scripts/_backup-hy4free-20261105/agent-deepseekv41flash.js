// deepseek v4.1flash · 事件响应 AI
// 零依赖、只读决策：只读取 view / legalActions / context，仅写入本座位私有的 memory。
// 始终原样返回 legalActions 中的一个对象，绝不克隆、拼造或修改冻结对象。
// 适配 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events 的任意组合。
//
// 策略主题「事件响应」：
//   1. 为 blackHole / bombardment / comet / warpJump 的 eventChoice 建立明确估值；
//   2. 低血时显著提高权威损失的罚分，优先弃牌 / 摧毁可回收基地，避免权威损失；
//   3. 事件结算后用一个短衰减窗口抬高「资源与战斗」动作权重，快速回到节奏；
//   4. 其余阶段采用均衡攻防，不极端切换。

export const meta = {
  name: 'deepseek v4.1flash · 事件响应',
  description: '事件响应型 AI：黑洞/轨道轰击/彗星/跃迁四类事件分别估值，低血时坚决避免权威损失，事件结束后数步内快速回到出牌、购买与攻击节奏；其余阶段均衡攻防。全模式、全扩展、全待决动作与未知动作均安全兜底，零依赖、只读、不修改冻结对象。'
};

const num = (value, fallback) =>
  (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const pending = v.pending || null;
  const damage = v.damage || {};
  const tradeRow = Array.isArray(v.tradeRow) ? v.tradeRow : [];

  // ---------- 事件窗口记忆：决定「事件后回到节奏」的加成强度 ----------
  const isEvent = (!!pending && pending.type === 'eventChoice') ||
    actions.some(a => a && a.type === 'eventChoice');
  const mem = (memory && typeof memory === 'object') ? memory : null;
  if (mem) {
    mem.calls = num(mem.calls, 0) + 1;
    if (isEvent) mem._sinceEvent = 0;
    else mem._sinceEvent = num(mem._sinceEvent, 99) + 1;
  }
  const sinceEvent = mem ? num(mem._sinceEvent, 99) : 99;
  const rush = clamp(1 - sinceEvent / 6, 0, 1); // 事件后 6 步内线性衰减

  // ---------- 模式、血量差与「低血危险度」 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTeam = me.team; // team2v2 为 0 / 1，其余为 null；注意 0 是有效值
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const enemyAuths = opponents.map(p => num(p.authority, startAuth));
  const minEnemy = enemyAuths.length ? Math.min(...enemyAuths) : startAuth;
  const avgEnemy = enemyAuths.length
    ? enemyAuths.reduce((sum, x) => sum + x, 0) / enemyAuths.length
    : startAuth;

  // 均衡攻防：aggro 只在窄区间浮动，领先略偏攻、落后略偏守，不做极端切换
  let aggro = clamp(0.52 + (myAuth - avgEnemy) / 120, 0.40, 0.65);
  aggro = clamp(aggro + clamp((turn - 8) / 120, 0, 0.08), 0.40, 0.70);
  const guard = 1 - aggro;

  // 低于约 55% 权威开始进入「低血」，越接近出局越珍惜每一点权威
  const danger = clamp((startAuth * 0.55 - myAuth) / (startAuth * 0.55), 0, 1);
  const authW = 1 + 2.2 * danger + 0.8 * guard; // 事件权威损失罚分权重

  // ---------- 通用卡牌估值：只依赖可见的通用字段，兼容任意牌包组合 ----------
  const info = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = info(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  const sumNums = (text, re) => {
    let sum = 0;
    for (const m of String(text).matchAll(re)) sum += Number(m[1]) || 0;
    return sum;
  };
  const profile = text => {
    const t = typeof text === 'string' ? text : '';
    return {
      trade: sumNums(t, /(\d+)\s*贸易/g),
      combat: sumNums(t, /(\d+)\s*战斗/g),
      authority: sumNums(t, /(\d+)\s*权威/g),
      draw: sumNums(t, /抽\s*(\d+)\s*张/g),
      discardOpp: sumNums(t, /弃\s*(\d+)\s*张牌/g),
      drawWord: /抽/.test(t),
      scrapWord: /销毁/.test(t),
      discardWord: /弃/.test(t),
      destroyWord: /摧毁/.test(t),
      free: /免费|置于牌库顶|置入手牌/.test(t),
      allyWord: /同盟/.test(t)
    };
  };
  const cardValue = uid => {
    const c = info(uid);
    if (!c) return 1.2;
    const id = c.id;
    if (id === 'scout') return 1.0 + 0.5 * guard;      // 贸易：偏守时更想保留
    if (id === 'viper') return 1.1 + 0.5 * aggro;      // 战斗：偏攻时更想保留
    if (id === 'explorer') return 2.0 + 0.4 * guard;   // 经济填充 / 可销毁压缩
    const cost = Number.isFinite(c.cost) ? c.cost : 3;
    const e = profile(c.text);
    let val = 2.6;
    val += e.trade * (0.9 + 0.5 * guard);
    val += e.combat * (0.7 + 1.0 * aggro);
    val += e.authority * (1.0 + 1.6 * guard + 2 * danger); // 低血时回血牌更值钱
    val += e.draw * 2.4 + (e.drawWord ? 1.8 : 0);
    val += e.discardOpp * 2.0;
    if (c.outpost) val += 3 + 2 * guard;
    else if (c.type === 'base') val += 1.8 + 1.2 * guard;
    if (e.allyWord) val += 2.2;
    if (e.scrapWord || e.discardWord) val += 1.4;
    if (e.destroyWord) val += 1.8;
    if (e.free) val += 2.6;
    if (c.faction && c.faction !== 'neutral') val += 0.4;
    val *= (1 - clamp(cost, 1, 8) * 0.02); // 轻微偏好高效中低费牌
    return val;
  };

  // ---------- 四类事件的明确估值 ----------
  const eventScore = a => {
    const ev = a.eventId || (pending && (pending.eventId || pending.kind)) || '';

    if (ev === 'blackHole') {
      // 弃至多两张手牌；每少弃一张失去 4 权威（引擎保底权威不低于 1）。
      // 弃牌仅进弃牌堆、可回收，按折扣计；低血时权威损失罚分加重 → 尽量弃满两张。
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const nominalLoss = 4 * missing;
      const realLoss = clamp(nominalLoss, 0, Math.max(0, myAuth - 1));
      const loss = 0.35 * nominalLoss + 0.65 * realLoss;
      let discardCost = 0;
      for (const uid of targets) discardCost += cardValue(uid);
      return -(discardCost * (0.45 + 0.1 * guard) + loss * authW + missing * 3);
    }

    if (ev === 'bombardment') {
      if (a.pay) {
        // 失去 6 权威（保底 1）：低血时罚分极重，坚决避免
        const real = clamp(6, 0, Math.max(0, myAuth - 1));
        const loss = 0.35 * 6 + 0.65 * real;
        return -(loss * authW + 14);
      }
      if (a.baseId) {
        // 摧毁的己方基地进弃牌堆可回收，按折扣计；前哨额外损失护盾
        const c = info(a.baseId);
        return -(cardValue(a.baseId) * 0.38 + (c && c.outpost ? 3.5 : 0.6));
      }
      return -1;
    }

    if (ev === 'comet') {
      // 永久销毁至多两张：优先压掉初始牌 / 廉价牌以压缩牌组；targets:[] 可安全跳过
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) {
        if (isStarter(uid)) benefit += 42;
        else {
          const cv = cardValue(uid);
          benefit += cv <= 3.2 ? 9 : -cv * 4.5; // 绝不损失好牌
        }
      }
      return benefit;
    }

    if (ev === 'warpJump') {
      // 抽三放二回牌库顶：把最差两张放回、最好一张留在手里（本回合即可用）。
      // cards[0] 会先被抽到，故两张都放回时让较好的那张排在前面略有加成。
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.6;
      return s;
    }

    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择：discard / selectScrap / targetDiscard / eventChoice / 未知 ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard': // 我是弃牌者：弃掉手里最差的一张
        return -cardValue(a.cardId) * 10;
      case 'selectScrap': // 强制销毁：优先永久压掉初始牌以压缩牌组
        return 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 520 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多 / 威胁大 / 血更少的对手
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = (t.inPlay || []).length;
        return 100 + hc * 8 + threat * 3 + (startAuth - auth) * 0.5;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0; // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段：均衡攻防的优先级基线 ----------
  const OFF = {
    outpost: 900000,      // 摧毁敌方前哨：拔护盾、解锁对玩家攻击
    play: 700000,         // 出牌（资源）
    ally: 660000,         // 同盟能力
    primary: 620000,      // 主要能力
    optional: 600000,     // 可选能力
    destroyBase: 565000,  // 摧毁普通敌方基地
    scrap: 558000,        // 销毁能力
    buy: 500000,          // 购买（资源）
    playerAtk: 180000,    // 对玩家削血（战斗）
    chipBase: 130000,     // 未摧毁的基地削血
    transfer: 100000,     // 2V2 把回合末清零的余量预留给队友
    unknown: 40000,       // 未知动作安全兜底
    noop: 10000,          // 近似空操作
    endTurn: -1000000
  };

  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn':
        return OFF.endTurn;

      case 'transfer':
        // 回合末清零的余量转给队友；事件后先把自己的节奏跑起来，暂不预留
        return OFF.transfer + num(a.amount, 0) * 2 +
          (a.resource === 'combat' ? 4 : 0) - rush * 20000;

      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = info(a.targetId);
          const def = num(c && c.defense, 1);
          const destroyed = (num(damage[a.targetId], 0) + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) {
            const cv = cardValue(a.targetId) * 0.6;
            if (outpost) return OFF.outpost + 40000 * guard + amt * 3 + cv + rush * 20000;
            return OFF.destroyBase + amt * 3 + cv + rush * 12000;
          }
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0);
        }
        // 对玩家：伤害与攻防倾向、事件回节奏加成共同决定；聚焦最弱 / 接近出局者
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = OFF.playerAtk + amt * (6 + 20 * aggro + rush * 14);
        s += (startAuth - auth) * 0.5;
        if (auth <= minEnemy + 1) s += 40;
        // firstBlood：我是座位 1 时击倒座位 0 立即获胜，集中施压首位玩家
        if (mode === 'firstBlood' && playerId === 1 && a.targetId === 0) s += 5000;
        return s;
      }

      case 'play': {
        const cv = cardValue(a.cardId);
        let s = OFF.play + cv * 1.5 + rush * (30 + cv * 6); // 事件后优先打出高价值牌
        if (a.copy) s += cardValue(a.copy) * 2 + 30;                  // 复制强力牌
        if (a.row !== undefined) s += cardValue(tradeRow[a.row]) * 1.2; // 免费获得
        if (a.choice !== undefined) s += 3;                            // 选择效果：择优抖动
        return s;
      }

      case 'ability': {
        const kindOff = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional, scrap: OFF.scrap };
        const base = kindOff[a.ability] !== undefined ? kindOff[a.ability] : OFF.unknown;
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const emptyTargets = targets && targets.length === 0;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        let val = 0;
        if (hasRow) val += 90;       // 销毁交易行 / 免费获得
        if (hasTargetId) val += 110; // 摧毁敌方基地
        if (a.resource) val += 6;
        if (targets && targets.length) {
          let g = 8; // 弃 / 回收 / 销毁：滤掉差牌、保住好牌
          for (const uid of targets) {
            if (isStarter(uid)) g += 28;
            else {
              const cv = cardValue(uid);
              g += cv <= 3.2 ? 5 : -cv * 2;
            }
          }
          val += g;
        }
        if (emptyTargets && !hasRow && !hasTargetId && a.choice === undefined) {
          return OFF.noop - rush * 15000; // 空目标且无其它效果：近似空操作，尽量不做
        }
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') {
          val -= cardValue(a.cardId) * 0.35; // 销毁自身会失去这张牌
          val -= rush * 12000;               // 事件后不优先做低收益销毁
        }
        val += rush * 25;
        return base + val;
      }

      case 'buy': {
        if (a.explorer) return OFF.buy - 30 + rush * 20; // 探索者：低优先经济填充
        const uid = tradeRow[a.row];
        if (!uid) return OFF.buy - 60;
        const cv = cardValue(uid);
        let s = OFF.buy + cv * 14 + rush * (40 + cv * 10); // 事件后优先买高价值牌
        const owned = new Set();
        for (const u of (me.inPlay || [])) {
          const c = info(u);
          for (const f of (c && Array.isArray(c.factions) ? c.factions : [])) owned.add(f);
        }
        const cf = info(uid);
        if (cf && Array.isArray(cf.factions) && cf.factions.some(f => owned.has(f))) s += 12;
        return s;
      }

      default:
        return OFF.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  // ---------- lethal：一击致胜，绝对优先（team2v2 的 authority 为全队共享值，同样成立） ----------
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---------- 统一择优：始终返回 legalActions 中的原始对象，绝不修改 ----------
  const scoreFn = pending ? pendingScore : mainScore;
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
