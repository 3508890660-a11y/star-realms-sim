// GLM5.3 · 舰队协同 —— 零依赖、只读决策 AI
//
// 策略主题：同阵营聚集、同盟触发、能形成连锁的购买与出牌顺序。
//   1) 用 view.cards 的 factions/faction 统计己方可见牌组的阵营分布；
//   2) 打出与场上已有牌同阵营、且能点亮同盟能力的牌，给最高非致命优先级；
//   3) 优先使用已触发的同盟能力（免费获得 / 抽牌 / 资源），把连锁延续下去；
//   4) 购买时偏好能补齐同盟链、与牌组主导阵营一致的牌；
//   5) 出牌优先选择能产生贸易 / 抽牌 / 免费获得的牌，让本回合能继续行动。
//
// 适配 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events
// 的任意组合；只依赖通用字段（factions、cost、type、outpost、text、defense），
// 不硬编码扩展牌表。所有待决动作、未知动作都有打分兜底，绝不修改冻结对象，
// 且始终原样返回 legalActions 中的一个对象。

export const meta = {
  name: 'GLM5.3 · 舰队协同',
  description: '以同阵营聚集、同盟触发与连锁出牌/购买为核心的舰队协同策略。适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合；待决、事件、transfer 与未知动作均安全兜底，零依赖、只读决策、原样返回合法动作。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const arr = v => Array.isArray(v) ? v : [];

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const mode = (context && context.mode) || v.mode || 'standard';
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myTeam = me.team == null ? null : me.team;

  const info = uid => (uid != null && cards[uid]) || null;
  // 优先用引擎算好的多阵营数组（含复制牌），否则回退到单一 faction。
  const factionsOf = uid => {
    const c = info(uid);
    if (!c) return [];
    if (Array.isArray(c.factions) && c.factions.length) {
      return c.factions.filter(f => f && f !== 'neutral');
    }
    return c.faction && c.faction !== 'neutral' ? [c.faction] : [];
  };
  const isStarter = uid => {
    const c = info(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  // ---------- 阵营分布：同阵营聚集与同盟链的基础 ----------
  const factionCount = Object.create(null);   // 手牌 + 弃牌 + 场上
  const inPlayFaction = Object.create(null);  // 仅场上（决定本回合能否触发同盟）
  const tally = (list, table) => {
    for (const uid of arr(list)) {
      for (const f of factionsOf(uid)) table[f] = (table[f] || 0) + 1;
    }
  };
  tally(me.hand, factionCount);
  tally(me.discard, factionCount);
  tally(me.inPlay, factionCount);
  tally(me.inPlay, inPlayFaction);

  let dominant = null;
  let dominantCount = 0;
  for (const f in factionCount) {
    if (factionCount[f] > dominantCount) { dominantCount = factionCount[f]; dominant = f; }
  }

  // 敌友判定：team2v2 按队伍，其它模式排除自己与已淘汰者。
  const enemies = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const enemyAuths = enemies.map(p => num(p.authority, startAuth));
  const minEnemy = enemyAuths.length ? Math.min(...enemyAuths) : startAuth;

  // ---------- 卡牌文本解析（通用，覆盖 core / colonyWars） ----------
  const textOf = uid => {
    const c = info(uid);
    return c && typeof c.text === 'string' ? c.text : '';
  };
  const sumNums = (text, re) => {
    let s = 0;
    for (const m of String(text).matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  const effect = uid => {
    const t = textOf(uid);
    return {
      trade: sumNums(t, /(\d+)\s*贸易/g),
      combat: sumNums(t, /(\d+)\s*战斗/g),
      authority: sumNums(t, /(\d+)\s*权威/g),
      draw: sumNums(t, /抽\s*(\d+)\s*张/g),
      discardOpp: sumNums(t, /弃\s*(\d+)\s*张牌/g),
      ally: /同盟/.test(t),
      scrap: /销毁/.test(t),
      destroyBase: /摧毁/.test(t),
      free: /免费|置于牌库顶|置入手牌|获得时可|牌库顶/.test(t),
      drawWord: /抽/.test(t),
      chain: /抽|免费|置于牌库顶|置入手牌|贸易/.test(t)
    };
  };

  // ---------- 协同价值：效果强度 + 与己方牌组的阵营契合度 ----------
  const cardValue = uid => {
    const c = info(uid);
    if (!c) return 1;
    const id = c.id;
    if (id === 'scout') return 1.0;
    if (id === 'viper') return 1.2;
    if (id === 'explorer') return 2.0;
    const cost = (typeof c.cost === 'number' && Number.isFinite(c.cost)) ? c.cost : 3;
    const e = effect(uid);
    let val = 3;
    val += e.trade * 1.0;
    val += e.combat * 0.8;
    val += e.authority * 1.1;
    val += e.draw * 2.8 + (e.drawWord ? 1.8 : 0);  // 抽牌延长连锁，权重最高
    val += e.discardOpp * 2.0;
    if (c.outpost) val += 3.5;
    else if (c.type === 'base') val += 2.2;
    if (e.ally) val += 3.2;                          // 同盟能力 = 连锁节点
    if (e.scrap) val += 1.2;
    if (e.destroyBase) val += 1.8;
    if (e.free) val += 2.6;
    val += Math.min(cost, 8) * 0.35;
    const fs = factionsOf(uid);
    let fit = 0;
    for (const f of fs) fit += (factionCount[f] || 0);
    val += Math.min(fit, 12) * 0.9;                  // 同阵营越多，越容易形成同盟链
    if (dominant && fs.includes(dominant)) val += 1.2;
    return val;
  };

  // 打出这张牌预计新点亮的同盟链节点数（仅看本回合场上同阵营牌）。
  const allyChain = uid => {
    const fs = factionsOf(uid);
    if (!fs.length) return 0;
    let matches = 0;
    for (const f of fs) matches += (inPlayFaction[f] || 0);
    if (!matches) return 0;
    const trig = (me && typeof me.triggered === 'object' && me.triggered) || {};
    let chain = 0;
    if (effect(uid).ally) chain += 1;               // 新牌自身的同盟立即点亮
    for (const other of arr(me.inPlay)) {
      if (other === uid || trig[other]) continue;
      if (factionsOf(other).some(f => fs.includes(f)) && effect(other).ally) chain += 1;
    }
    return chain;
  };

  // ---------- 优先级档位（大间隔保证稳定顺序，特征加成不轻易越档） ----------
  const OFF = {
    outpost: 1000000,      // 摧毁敌方前哨：解锁对玩家攻击
    play: 820000,          // 出牌（叠加同盟链加成后成为实际最高优先）
    ally: 740000,          // 已触发的同盟能力
    primary: 680000,       // 基地主要能力
    optional: 640000,      // 可选能力（销毁交易行等）
    destroyBase: 600000,   // 摧毁普通基地
    buy: 560000,           // 购买
    playerAtk: 420000,     // 对玩家削血
    chipBase: 320000,      // 未摧毁基地削血
    scrap: 260000,         // 销毁能力（失去该牌，谨慎）
    transfer: 140000,      // 2V2 预留余量给队友
    unknown: 70000,        // 未知动作安全兜底
    noop: 20000,           // 近似空操作
    endTurn: -1000000000
  };

  const auth = num(me.authority, startAuth);

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      // 弃至多两张；每少弃一张失去 4 权威。弃牌进弃牌堆可回收，损失打折。
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = auth - Math.max(1, auth - 4 * missing);
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid);
      return -(cost * 600 + loss * 2200);
    }
    if (ev === 'bombardment') {
      if (a.pay) return -(auth - Math.max(1, auth - 6)) * 2200;
      if (a.baseId) {
        // 优先牺牲协同贡献低、非前哨的基地；被摧毁的基地进弃牌堆仍可回收。
        const c = info(a.baseId);
        let fit = 0;
        for (const f of factionsOf(a.baseId)) fit += (factionCount[f] || 0);
        return -(cardValue(a.baseId) * 300 + fit * 800 + (c && c.outpost ? 6000 : 0));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 永久销毁：优先压掉初始牌，绝不损失高协同牌；targets:[] 可安全跳过。
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let s = 0;
      for (const uid of targets) {
        if (isStarter(uid)) s += 120000;
        else {
          const cv = cardValue(uid);
          s += cv <= 4 ? 20000 : -cv * 8000;
        }
      }
      return s;
    }
    if (ev === 'warpJump') {
      // 抽三放二回牌库顶：把协同价值最低的两张放回去，好牌留在手里本回合可用。
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3000;
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 1500; // 较好的先抽到
      return s;
    }
    // galacticSummit / quasar / supernova / tradeMission 为即时结算，不产生待决；
    // 未知事件一律中性兜底。
    return 0;
  };

  // ---------- 待决选择：discard / selectScrap / targetDiscard / eventChoice ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':       // 弃掉协同价值最低的牌，保留同盟链组件
        return -cardValue(a.cardId) * 1000 - (isStarter(a.cardId) ? 0 : 4000);
      case 'selectScrap':   // 强制销毁：优先永久压掉初始牌 / 低协同牌
        return 100000 - cardValue(a.cardId) * 1000 + (isStarter(a.cardId) ? 200000 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多、威胁大、最接近出局的对手
        const t = players[a.targetId] || {};
        const hc = num(t.handCount, arr(t.hand).length);
        const threat = arr(t.inPlay).length;
        const ta = num(t.authority, startAuth);
        return 100000 + hc * 9000 + threat * 2500 + clamp(startAuth - ta, 0, startAuth) * 120;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0;           // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段动作 ----------
  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn':
        return OFF.endTurn;
      case 'transfer': {
        // 2V2：回合末会清零的余量预留给队友；仅在无更高价值动作时发生。
        const amt = num(a.amount, 0);
        return OFF.transfer + Math.min(amt, 20) * 800 + (a.resource === 'combat' ? 2000 : 0);
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = info(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed && outpost) return OFF.outpost + Math.min(amt, 15) * 1500 + cardValue(a.targetId);
          if (destroyed) return OFF.destroyBase + Math.min(amt, 15) * 1500 + cardValue(a.targetId) * 0.5;
          return OFF.chipBase + Math.min(amt, 15) * 900 + (outpost ? 12000 : 0);
        }
        const t = players[a.targetId] || {};
        const ta = num(t.authority, startAuth);
        let s = OFF.playerAtk + Math.min(amt, 20) * 2600;
        s += clamp(startAuth - ta, 0, startAuth) * 220;
        if (ta <= minEnemy + 1) s += 16000;         // 聚焦最接近出局者
        return s;
      }
      case 'play': {
        const e = effect(a.cardId);
        let s = OFF.play + cardValue(a.cardId) * 2600;
        s += clamp(allyChain(a.cardId), 0, 6) * 19000;   // 同阵营连锁：核心加成
        if (e.chain) s += 14000;                          // 产生资源/抽牌，延长连锁
        if (e.draw) s += e.draw * 5000;
        if (a.copy) s += cardValue(a.copy) * 1800 + 8000; // 复制强力牌
        if (a.row !== undefined) s += cardValue((v.tradeRow || [])[a.row]) * 2200 + 12000; // 免费获得
        if (a.choice !== undefined) s += 1500;
        return s;
      }
      case 'ability': {
        const kindOff = { ally: OFF.ally, primary: OFF.primary, optional: OFF.optional, scrap: OFF.scrap };
        const base = kindOff[a.ability] === undefined ? OFF.unknown : kindOff[a.ability];
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const emptyTargets = targets && targets.length === 0;
        const hasRow = a.row !== undefined || (Array.isArray(a.rows) && a.rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        const ec = effect(a.cardId);
        let val = 0;
        if (hasRow) {
          // 销毁交易行 / 免费获得：刷新出同阵营牌的机会，契合协同主题。
          val += a.ability === 'ally' ? 34000 : 22000;
          if (Array.isArray(a.rows)) val += a.rows.length * 4000;
        }
        if (hasTargetId) val += 20000;              // 摧毁敌方基地
        if (a.resource) val += 4000;
        if (a.choice !== undefined) val += 1500;
        if (targets && targets.length) {
          let g = 6000;
          for (const uid of targets) {
            if (isStarter(uid)) g += 16000;        // 压缩初始牌
            else {
              const cv = cardValue(uid);
              g += cv <= 4 ? 4000 : -cv * 1800;   // 绝不损失高协同牌
            }
          }
          val += g;
        }
        if (emptyTargets && !hasRow && !hasTargetId && a.choice === undefined) return OFF.noop;
        if (emptyTargets) val -= 20000;
        if (a.ability === 'ally') {
          if (ec.free) val += 18000;              // 免费获得 / 置顶：连锁节点
          if (ec.draw) val += ec.draw * 5000;
          if (ec.combat) val += ec.combat * 900;
          if (ec.trade) val += ec.trade * 900;
          if (ec.authority) val += ec.authority * 900;
          if (ec.discardOpp) val += ec.discardOpp * 4000;
        }
        if (a.ability === 'scrap') val -= cardValue(a.cardId) * 900; // 销毁会失去这张牌
        return base + clamp(val, -40000, 80000);
      }
      case 'buy': {
        if (a.explorer) return OFF.buy - 20000;   // 探索者：低优先经济填充
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buy - 40000;
        let s = OFF.buy + cardValue(uid) * 2600;
        const fs = factionsOf(uid);
        let fit = 0;
        for (const f of fs) fit += (factionCount[f] || 0) * 0.8 + (inPlayFaction[f] || 0) * 1.6;
        s += clamp(fit, 0, 14) * 3200;            // 同阵营聚集
        if (effect(uid).ally) s += 12000;         // 买回即形成同盟链
        if (fs.some(f => (inPlayFaction[f] || 0) > 0)) s += 10000; // 立即可触发同盟
        return s;
      }
      default:
        return OFF.unknown;                       // 未知动作：安全兜底
    }
  };

  // ---------- 统一分发：按动作类型判断，不依赖 pending 结构 ----------
  const PENDING_TYPES = new Set(['discard', 'selectScrap', 'targetDiscard', 'eventChoice']);
  const scoreFn = a => {
    if (a && PENDING_TYPES.has(a.type)) return pendingScore(a);
    if (v.pending) return 0;                      // 待决时出现未知类型：中性兜底
    return mainScore(a);
  };

  // lethal：一击致胜，绝对优先（team2v2 的 authority 为全队共享值，同样成立）。
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---------- 择优：只读遍历，绝不修改冻结的 legalActions ----------
  let best = actions[0];
  let bestVal = -Infinity;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    let s;
    try { s = scoreFn(a); } catch (err) { s = v.pending ? 0 : OFF.unknown; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = v.pending ? 0 : OFF.unknown;
    s += rnd() * 0.5;                            // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }

  // ---------- 停滞防护：连续多次选中同一动作时强制结束回合，杜绝死循环 ----------
  const mem = (memory && typeof memory === 'object') ? memory : null;
  if (mem) {
    try {
      mem.calls = num(mem.calls, 0) + 1;
      let sig = '';
      try { sig = JSON.stringify(best); } catch (err) { sig = String(best && best.type); }
      if (sig === mem._lastSig) mem._repeat = num(mem._repeat, 0) + 1;
      else { mem._lastSig = sig; mem._repeat = 0; }
      if (mem._repeat >= 12) {
        const end = actions.find(a => a && a.type === 'endTurn');
        if (end) { mem._repeat = 0; return end; }
      }
    } catch (err) { /* memory 不可写时忽略，不影响返回值 */ }
  }

  return best;
}
