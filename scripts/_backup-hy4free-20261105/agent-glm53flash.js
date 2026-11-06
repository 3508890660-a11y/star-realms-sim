// GLM5.3flash · 快攻闪击 —— 零依赖、只读决策。
// 适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合。
// 主题：lethal 搜索 + 每点战斗的即时收益；偏好低费高战力，可用 scrap 终局补刀，
//       但绝不无意义消耗强牌。所有 pending / eventChoice / transfer / 未知动作
//       一律打分兜底，单次线性遍历、原样返回 legalActions 中的对象，绝不死循环。

export const meta = {
  name: 'GLM5.3flash · 快攻闪击',
  description: 'GLM5.3flash 快攻闪击：lethal 搜索优先，以每点战斗的即时收益为核心，偏好低费高战力与 scrap 补刀收尾，避免无意义消耗强牌；全模式、全扩展、全待决与未知动作均安全兜底。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const myCombat = num(me.combat, 0);
  const mode = (context && context.mode) || v.mode || 'standard';
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const turn = num((context && context.turn) || v.turn, 1);
  const rush = Math.min(turn, 20) * 3; // 回合越靠后越急着把战斗变现

  // 记忆只做计数，不参与任何循环或状态推进。
  if (memory && typeof memory === 'object') memory.calls = num(memory.calls, 0) + 1;

  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = cardInfo(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };
  const isJunk = uid => {
    const c = cardInfo(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper' || c.id === 'explorer');
  };

  // ---------- 从规则文本解析卡牌的进攻画像 ----------
  const sumNums = (text, re) => {
    let s = 0;
    for (const m of String(text == null ? '' : text).matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  const profile = text => {
    const t = typeof text === 'string' ? text : '';
    const scrapPart = (t.match(/销毁[^。]*/g) || []).join(' ');
    return {
      combat: sumNums(t, /(\d+)\s*战斗/g),
      trade: sumNums(t, /(\d+)\s*贸易/g),
      authority: sumNums(t, /(\d+)\s*权威/g),
      draw: sumNums(t, /抽\s*(\d+)\s*张/g),
      discardOpp: sumNums(t, /弃\s*(\d+)\s*张牌/g),
      scrapCombat: sumNums(scrapPart, /(\d+)\s*战斗/g),
      ally: /同盟/.test(t),
      outpost: /前哨/.test(t),
      free: /免费|置于牌库顶|置入手牌|获得时可/.test(t),
      drawWord: /抽/.test(t)
    };
  };
  const choiceSegment = (c, choice) => {
    const t = c && typeof c.text === 'string' ? c.text : '';
    const after = t.split(/选择[:：]/)[1];
    if (!after) return '';
    const parts = after.split(/或|；/).map(x => x.trim()).filter(Boolean);
    return parts[choice] || '';
  };

  // 进攻价值：战斗为核心，兼顾过牌与削手牌；按「每点费用的战斗效率」偏好低费高战力。
  const cardValue = uid => {
    const c = cardInfo(uid);
    if (!c) return 1;
    const id = c.id;
    if (id === 'scout') return 1.0;
    if (id === 'viper') return 1.6;
    if (id === 'explorer') return 2.4;
    const cost = num(c.cost, 3);
    const e = profile(c.text);
    let val = 2;
    val += e.combat * 3.2;
    val += e.draw * 2.0 + (e.drawWord ? 1 : 0);
    val += e.discardOpp * 2.0;
    val += e.authority * 0.8;
    val += e.trade * 0.7;
    val += e.scrapCombat * 1.2;
    if (e.ally) val += 1.5;
    if (e.free) val += 1.5;
    if (c.outpost || e.outpost) val += 0.6;
    else if (c.type === 'base') val += 1.0;
    if (c.faction && c.faction !== 'neutral') val += 0.3;
    const eff = e.combat + e.scrapCombat * 0.6 + e.draw * 0.5 + e.discardOpp * 0.5;
    val += (eff / Math.max(1, cost)) * 2.5;
    val -= Math.max(0, cost - 4) * 0.35;
    return val;
  };

  // ---------- 可致命目标与战斗缺口 ----------
  const attackTargets = new Set();
  for (const a of actions) {
    if (a && a.type === 'attack' && a.targetType === 'player') attackTargets.add(a.targetId);
  }
  const killAuth = attackTargets.size
    ? Math.min(...[...attackTargets].map(id => num((players[id] || {}).authority, Infinity)))
    : Infinity;
  const combatGap = killAuth - myCombat; // 还差多少战斗可致命

  // ---------- lethal：最小充分伤害，保留战斗余量，避免无意义超杀 ----------
  let lethal = null;
  for (const a of actions) {
    if (!a || a.type !== 'attack' || a.targetType !== 'player') continue;
    const amt = num(a.amount, 0);
    const auth = num((players[a.targetId] || {}).authority, Infinity);
    if (amt >= auth && (!lethal || amt < num(lethal.amount, Infinity))) lethal = a;
  }
  if (lethal) return lethal;

  // scrap 终局补刀：销毁低效牌换战斗后即可致命，才允许消耗；强牌绝不乱拆。
  const scrapFinish = a => {
    if (!a || a.type !== 'ability' || a.ability !== 'scrap') return false;
    const c = cardInfo(a.cardId);
    if (!c) return false;
    const gain = profile(c.text).scrapCombat;
    if (gain <= 0 || !(combatGap > 0) || gain < combatGap) return false;
    return isJunk(a.cardId) || cardValue(a.cardId) <= 3.2;
  };

  // ---------- 优先级基线（大间隔形成稳定顺序） ----------
  const OFF = {
    scrapFinish: 980000, // scrap 补刀铺平 lethal
    play: 700000,        // 先打完手牌，攒战斗与贸易
    primary: 660000,
    ally: 650000,
    optional: 620000,
    buy: 560000,         // 用积累的贸易买低费高战力
    outpost: 540000,     // 拔前哨，解锁对玩家攻击
    destroyBase: 520000,
    playerAtk: 300000,   // 把战斗转成即时伤害
    scrap: 260000,       // 普通 scrap 能力（不补刀时压低）
    chipBase: 200000,
    transfer: 120000,    // 2V2 余量预留
    unknown: 60000,      // 未知动作安全兜底
    noop: 20000,         // 近似空操作
    endTurn: -1000000
  };

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    const targets = Array.isArray(a.targets) ? a.targets : [];
    if (ev === 'blackHole') {
      // 弃至多两张；每少弃一张失去 4 权威（下限 1）。快攻珍视血量，但弃差牌换不掉血通常划算。
      const auth = num(me.authority, startAuth);
      const missing = Math.max(0, 2 - targets.length);
      const loss = auth - Math.max(1, auth - 4 * missing);
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid) * 0.5; // 弃牌进弃牌堆，可回收
      return -(cost + loss * 2.2);
    }
    if (ev === 'bombardment') {
      if (a.pay) {
        const auth = num(me.authority, startAuth);
        const loss = auth - Math.max(1, auth - 6);
        return -(loss * 2.2);
      }
      if (a.baseId) {
        const c = cardInfo(a.baseId);
        return -(cardValue(a.baseId) * 0.35 + (c && c.outpost ? 1.5 : 0.3));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 永久销毁：只压初始牌/探索者等低效牌，绝不损失强牌。
      let benefit = 0;
      for (const uid of targets) {
        if (isJunk(uid)) benefit += 40;
        else {
          const cv = cardValue(uid);
          benefit += cv <= 3.2 ? 8 : -cv * 5;
        }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      // 抽三放二回牌库顶：把最差两张放回去，把高战力留在手里本回合用。
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择 ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard': // 弃掉最差的一张，绝不弃强牌
        return -cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 30 : 0);
      case 'selectScrap': // 强制销毁优先压掉初始牌，提升战斗密度
        return 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0);
      case 'targetDiscard': { // 挑手牌多、威胁大、快出局的对手弃牌
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = (t.inPlay || []).length;
        return 100 + hc * 8 + threat * 3 + (startAuth - auth) * 0.6;
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
      case 'transfer': // 回合末清零的余量：combat 自己要用，trade 富余可给队友
        return OFF.transfer + num(a.amount, 0) * 1.5 + (a.resource === 'combat' ? -30 : 0);
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) {
            const base = outpost ? OFF.outpost : OFF.destroyBase;
            return base + amt * 4 + cardValue(a.targetId) * 0.4;
          }
          return OFF.chipBase + amt * 3 + (outpost ? 60 : 0);
        }
        // 对玩家：每点战斗即时兑现为伤害，聚焦最接近出局者。
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = OFF.playerAtk + amt * 60 + rush * 4;
        s += (startAuth - auth) * 3;
        if (auth <= killAuth + 1) s += 200;
        return s;
      }
      case 'play': {
        const c = cardInfo(a.cardId);
        let s = OFF.play + cardValue(a.cardId) * 2 + profile(c && c.text).combat * 6;
        if (a.copy) s += cardValue(a.copy) * 2 + 40;                         // 复制强力飞船
        if (a.row !== undefined) s += cardValue((v.tradeRow || [])[a.row]) * 1.5; // 免费获得
        if (a.choice !== undefined && /战斗/.test(choiceSegment(c, a.choice))) s += 60;
        return s;
      }
      case 'ability': {
        const c = cardInfo(a.cardId);
        const e = profile(c && c.text);
        let base;
        switch (a.ability) {
          case 'scrap': base = scrapFinish(a) ? OFF.scrapFinish : OFF.scrap; break;
          case 'ally': base = OFF.ally; break;
          case 'primary': base = OFF.primary; break;
          case 'optional': base = OFF.optional; break;
          default: base = OFF.unknown;
        }
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        // 空目标且无其它效果：近似空操作，尽量不做（仍是合法动作，安全兜底）。
        if (targets && targets.length === 0 && !hasRow && !hasTargetId) return OFF.noop;
        let val = 0;
        if (a.ability !== 'scrap') {
          val += e.combat * 5 + (a.ability === 'ally' ? e.combat * 2 : 0);
        } else {
          val += e.scrapCombat * 8; // scrap 战斗：补刀价值高
        }
        if (hasTargetId) val += 120; // 摧毁敌方基地
        if (hasRow) val += 60;       // 销毁交易行 / 免费获得
        if (a.resource) val += 5;
        if (targets && targets.length) {
          for (const uid of targets) {
            if (isStarter(uid)) val += 25;        // 压掉初始牌，提升战斗密度
            else val -= cardValue(uid) * 1.5;     // 别消耗强牌
          }
        }
        if (a.choice !== undefined && /战斗/.test(choiceSegment(c, a.choice))) val += 40;
        if (a.ability === 'scrap' && !scrapFinish(a)) val -= cardValue(a.cardId) * 2.5;
        return base + val;
      }
      case 'buy': {
        if (a.explorer) return OFF.buy - 40; // 探索者：未来补刀资源，低优先
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buy - 80;
        let s = OFF.buy + cardValue(uid) * 16;
        const cf = cardInfo(uid);
        const owned = new Set();
        for (const u of (me.inPlay || [])) {
          const ci = cardInfo(u);
          for (const f of (ci && Array.isArray(ci.factions) ? ci.factions : [])) owned.add(f);
        }
        if (cf && Array.isArray(cf.factions) && cf.factions.some(f => owned.has(f))) s += 10;
        return s;
      }
      default:
        return OFF.unknown; // 未知动作：安全兜底
    }
  };

  // ---------- 统一择优：单次线性遍历，原样返回合法动作，绝不修改冻结对象 ----------
  const scoreFn = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    if (a.type === 'discard' || a.type === 'selectScrap' ||
        a.type === 'targetDiscard' || a.type === 'eventChoice') return pendingScore(a);
    return mainScore(a);
  };
  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = scoreFn(a); } catch (_) { s = OFF.unknown; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = OFF.unknown;
    s += rnd() * 0.5; // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
