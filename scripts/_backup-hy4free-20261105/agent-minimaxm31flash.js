// MiniMax M3.1flash · 牌组压缩 AI
// 零运行时依赖、纯只读决策：绝不修改深冻结的 view / legalActions，
// 始终原样返回 legalActions 中的一个对象。
//
// 策略主题「牌组压缩」：
//   1) 优先永久销毁 Scout / Viper / Explorer 等低效牌，让高价值牌更常上手；
//   2) 高度重视抽牌、弃牌再抽（recycle / discardThenDraw / depot）、销毁自身
//      手牌或弃牌堆牌等「过牌循环」，用循环放大压缩收益；
//   3) 「只有在压缩后仍能购买时才花贸易」：先做完免费的出牌与压缩工作，把贸易
//      优先留给压缩价值最高的牌，只有当买完某张牌后仍付得起这张压缩目标牌时，
//      才把贸易花在填充牌 / 探索者上；
//   4) 所有 pending 与未知动作均打分兜底，并用私有记忆检测重复决策防停滞。
//
// 适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合。

export const meta = {
  name: 'MiniMax M3.1flash · 牌组压缩',
  description: 'MiniMax M3.1flash 牌组压缩：优先销毁 Scout/Viper/Explorer 等低效牌，重视抽牌与弃牌循环，贸易优先留给压缩/过牌牌；适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合，安全处理全部待决与未知动作。'
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
  // 「Scout/Viper/Explorer 等低效牌」——优先压缩的目标。
  const isLowEfficiency = uid => {
    const c = cardInfo(uid);
    if (!c) return false;
    return c.id === 'scout' || c.id === 'viper' || c.id === 'explorer';
  };

  // ---------- 模式、权威、威胁 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const authW = 1 + clamp((startAuth - myAuth) / startAuth, 0, 1) * 2; // 血越少权威越珍贵
  const myTeam = me.team; // 非团队模式为 null
  const enemies = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const auths = enemies.map(p => num(p.authority, startAuth));
  const minEnemy = auths.length ? Math.min(...auths) : startAuth;
  const avgEnemy = auths.length ? auths.reduce((a, b) => a + b, 0) / auths.length : startAuth;
  const lead = myAuth - avgEnemy;
  const aggro = clamp(0.35 + lead / 60, 0.1, 0.8); // 压缩偏慢，基准进攻性较低

  // ---------- 卡牌规则文本解析（不硬编码卡表，任意牌包通用）----------
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
      discardOpp: sumNums(t, /对手弃\s*(\d+)\s*张牌/g),
      ally: /同盟/.test(t),
      scrapOwn: /销毁[^，。]*手牌|销毁[^，。]*弃牌堆/.test(t), // 可销毁手牌/弃牌堆
      scrapSelf: /销毁：/.test(t),                              // 本牌自带销毁能力
      cycle: /弃至多|然后抽|等量牌|每弃一张/.test(t),           // 弃牌循环
      destroyBase: /摧毁/.test(t),
      free: /免费|置于牌库顶|置入手牌|获得时可/.test(t),
      drawWord: /抽/.test(t)
    };
  };

  // 卡牌「留在牌组里的价值」：越低越该被销毁 / 弃掉。
  const cardValue = uid => {
    const c = cardInfo(uid);
    if (!c) return 2;
    if (c.id === 'scout') return 1.0;
    if (c.id === 'viper') return 1.2;
    if (c.id === 'explorer') return 1.8;
    const e = profile(c.text);
    let val = 3;
    val += e.trade * 0.9;
    val += e.combat * 0.7;
    val += e.authority * 0.9;
    val += e.draw * 3.0 + (e.drawWord ? 1.2 : 0);
    val += e.discardOpp * 1.6;
    if (c.type === 'base') val += 1.5 + (c.outpost ? 2.0 : 0);
    if (e.ally) val += 1.8;
    if (e.scrapOwn) val += 4.5;   // 能主动压缩牌组
    if (e.cycle) val += 3.0;     // 弃牌循环
    if (e.scrapSelf) val += 1.2; // 自带退出通道
    if (e.destroyBase) val += 1.2;
    if (e.free) val += 2.0;
    if (c.faction && c.faction !== 'neutral') val += 0.5;
    const cost = Number.isFinite(c.cost) ? c.cost : 3;
    val *= (1 - clamp(cost, 1, 8) * 0.012);
    return val;
  };

  // 「压缩价值」：购买 / 打出时的择优权重，偏重过牌、压缩、循环与低费。
  const compressionMerit = uid => {
    const c = cardInfo(uid);
    if (!c) return 1;
    if (c.id === 'explorer') return 0.4; // 填充牌，本身即压缩目标
    const e = profile(c.text);
    let m = 1;
    m += e.draw * 2.2 + (e.drawWord ? 0.8 : 0);
    if (e.scrapOwn) m += 3.5;
    if (e.cycle) m += 2.5;
    if (e.scrapSelf) m += 1.0;
    if (e.ally) m += 1.2;
    if (e.free) m += 1.5;
    m += (e.trade + e.authority) * 0.35 + e.combat * 0.25;
    const cost = Number.isFinite(c.cost) ? c.cost : 3;
    m -= cost * 0.35;
    return m;
  };

  // ---------- 私有记忆：压缩倾向（EMA 平滑）----------
  let thinBias = 0.4;
  if (memory && typeof memory === 'object') {
    try {
      let weak = 0, total = 0;
      for (const zone of ['hand', 'discard', 'inPlay']) {
        const arr = Array.isArray(me[zone]) ? me[zone] : [];
        for (const uid of arr) { total++; if (isLowEfficiency(uid)) weak++; }
      }
      const ratio = total ? weak / total : 0.4;
      thinBias = clamp(0.65 * num(memory._thin, ratio) + 0.35 * ratio, 0, 1);
      memory._thin = thinBias;
      memory.calls = num(memory.calls, 0) + 1;
    } catch (err) { /* 记忆不可写时忽略，绝不触碰冻结对象 */ }
  }

  // ---------- 优先级基线 ----------
  const OFF = {
    outpost: 660000,
    play: 820000,
    ally: 770000,
    primary: 755000,
    optional: 740000,
    scrapSelf: 720000,
    destroyBase: 640000,
    buyGood: 600000,
    chipBase: 540000,
    playerAtk: 520000,
    transfer: 460000,
    buyFiller: 300000,
    unknown: 200000,
    noop: 40000,
    endTurn: -1000000
  };
  const FILLER = 1.6; // 压缩价值低于此值视为填充牌

  // 「只有在压缩后仍能购买时才花贸易」：预留买得起的、压缩价值最高的牌的费用。
  let reserveCost = 0, bestGoodMerit = -Infinity;
  for (const a of actions) {
    if (!a || a.type !== 'buy' || a.explorer) continue;
    const uid = (v.tradeRow || [])[a.row];
    if (!uid) continue;
    const c = cardInfo(uid);
    const cost = c && Number.isFinite(c.cost) ? c.cost : 3;
    const m = compressionMerit(uid);
    if (m >= FILLER && m > bestGoodMerit) { bestGoodMerit = m; reserveCost = cost; }
  }

  // ---------- 致命一击（绝对优先；team2v2 的 authority 为全队共享值，同样成立）----------
  if (!v.pending) {
    const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
      num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
    if (lethal) return lethal;
  }

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = Math.min(Math.max(0, myAuth - 1), 4 * missing); // 事件掉血不会低于 1
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid) * 0.4;    // 弃进弃牌堆可回收，折价
      return -(cost + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) return -(6 * authW);
      if (a.baseId) {
        const c = cardInfo(a.baseId);
        return -(cardValue(a.baseId) * 0.4 + (c && c.outpost ? 2 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 纯压缩：只销毁低效牌，绝不误伤好牌；targets:[] 可安全跳过。
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) {
        if (isLowEfficiency(uid)) benefit += 45 * (1 + thinBias);
        else { const cv = cardValue(uid); benefit += cv <= 3.5 ? 6 : -cv * 10; }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;             // 把最差的两张放回牌库顶
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.5;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决动作（discard / selectScrap / targetDiscard / eventChoice / 未知）----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':       // 我是弃牌者：弃掉手里最差的一张（多为初始牌）
        return -cardValue(a.cardId) * 10;
      case 'selectScrap':   // 强制永久销毁：优先压掉 Scout/Viper/Explorer
        return 300 - cardValue(a.cardId) * 10 + (isLowEfficiency(a.cardId) ? 500 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多、威胁大、最接近出局的对手
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = (t.inPlay || []).length;
        return 100 + hc * 8 + threat * 3 + (startAuth - auth) * 0.4 * (0.5 + aggro);
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0; // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段：能力动作 ----------
  const abilityScore = a => {
    const kind = a.ability;
    const targets = Array.isArray(a.targets) ? a.targets : null;
    const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
    const hasTargetId = a.targetId !== undefined && a.targetId !== null;

    // 带 targets：销毁 / 回收 / 弃掉自己的牌 —— 压缩与循环的核心。
    // 强烈奖励销毁低效牌，重罚误伤好牌；空目标视为近似空操作。
    if (targets) {
      if (targets.length === 0 && !hasRow && !hasTargetId && a.choice === undefined) {
        return OFF.noop + (a.resource ? 6 : 0);
      }
      const kindBase = kind === 'ally' ? OFF.ally : kind === 'optional' ? OFF.optional :
        kind === 'scrap' ? OFF.scrapSelf : OFF.primary;
      let s = kindBase;
      for (const uid of targets) {
        if (isLowEfficiency(uid)) s += 50000 * (1 + thinBias);
        else { const cv = cardValue(uid); s += cv <= 3.5 ? 2500 : -cv * 7000; }
      }
      s += targets.length * 800;           // 多循环 = 更快见到好牌
      if (a.resource) s += 6;
      if (a.choice !== undefined) s += 3;
      if (targets.length === 0) s -= 300;  // 空目标降权
      return s;
    }

    // 无 targets：按能力类型给基座，再叠加其它效果。
    let s;
    if (kind === 'scrap') {
      // 销毁自身：失去这张牌；若是低效牌则正合压缩意图。
      s = OFF.scrapSelf - cardValue(a.cardId) * 2 + (isLowEfficiency(a.cardId) ? 60 : 0);
    } else {
      const baseByKind = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional };
      s = baseByKind[kind] === undefined ? OFF.unknown : baseByKind[kind];
    }
    if (hasTargetId) {
      const c = cardInfo(a.targetId);
      s += (c && c.outpost) ? 300 : 100;   // 摧毁敌方前哨 / 基地
    }
    if (hasRow) s += 70;                  // 销毁交易行 / 免费获得
    if (a.resource) s += 6;
    if (a.choice !== undefined) s += 3;
    return s;
  };

  // ---------- 主阶段：统一打分 ----------
  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn':
        return OFF.endTurn;
      case 'transfer': // 回合末清零的余量，一次预留较大额度给队友
        return OFF.transfer + num(a.amount, 0) * 2;
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) return (outpost ? OFF.outpost : OFF.destroyBase) + amt * 3 + cardValue(a.targetId) * 0.5;
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0);
        }
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = OFF.playerAtk + amt * (4 + 10 * aggro);
        s += (startAuth - auth) * 0.5;
        if (auth <= minEnemy + 1) s += 40; // 集火最接近出局者
        return s;
      }
      case 'play': {
        let s = OFF.play + cardValue(a.cardId) * 1.2 + compressionMerit(a.cardId) * 6;
        if (a.copy) s += cardValue(a.copy) * 2 + 30;                          // 复制强力牌
        if (a.row !== undefined) s += cardValue((v.tradeRow || [])[a.row]) * 1.2; // 免费获得
        if (a.choice !== undefined) s += 3;
        return s;
      }
      case 'ability':
        return abilityScore(a);
      case 'buy': {
        const trade = num(me.trade, 0);
        if (a.explorer) {
          // 探索者本身是压缩目标，只有「买完仍付得起压缩目标牌」时才考虑，且优先级最低。
          return OFF.buyFiller - 60 + ((trade - 2) >= reserveCost ? 2000 : -30000);
        }
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buyFiller - 50;
        const c = cardInfo(uid);
        const cost = c && Number.isFinite(c.cost) ? c.cost : 3;
        const merit = compressionMerit(uid);
        if (merit < FILLER) {
          // 「只有在压缩后仍能购买时才花贸易」：买完仍付得起压缩目标牌才动手。
          return (trade - cost) >= reserveCost
            ? OFF.buyFiller + merit * 40 - cost * 2
            : OFF.buyFiller - 30000;
        }
        return OFF.buyGood + merit * 30 - cost * 2;
      }
      default:
        return OFF.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  const scoreFn = v.pending ? pendingScore : mainScore;

  // 统一择优：始终返回 legalActions 中的原始对象，绝不修改。
  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = scoreFn(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5; // 极小抖动，仅打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }

  // ---------- 停滞检测：状态未变且反复返回同一非结束动作时，强制收尾，杜绝死循环 ----------
  if (memory && typeof memory === 'object' && best && best.type !== 'endTurn') {
    try {
      const sig = [
        num(v.turn, 0), actions.length, num(me.trade, 0), num(me.combat, 0),
        (me.hand || []).length, (me.discard || []).length, (me.inPlay || []).length,
        num(me.deckCount, 0), num(myAuth, 0), num(v.explorers, 0),
        (v.tradeRow || []).filter(Boolean).length,
        players.map(p => num(p && p.authority, 0)).join(','),
        v.pending ? (v.pending.type || '') : ''
      ].join('|');
      memory._stall = (sig === memory._sig) ? num(memory._stall, 0) + 1 : 0;
      memory._sig = sig;
      if (num(memory._stall, 0) > 8) {
        const end = actions.find(a => a && a.type === 'endTurn');
        if (end) return end;
      }
    } catch (err) { /* 记忆不可写时忽略 */ }
  }

  return best;
}
