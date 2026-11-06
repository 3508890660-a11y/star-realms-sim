// deepseek v4pro · 团队调度 AI
// 零运行时依赖、纯只读决策。适配 standard / ffa / hunter / firstBlood / team2v2，
// 与 core / colonyWars / events 任意组合；不修改深冻结的 view / legalActions。
//
// 策略主题「团队调度」：
//   * team2v2：识别 view.teams 与共享权威、player.team 与队友；以 memory 锁定一个敌方焦点，
//     集中火力打穿敌方队伍（共享权威归零即全队出局）；优先拔除阻挡队伍攻击的前哨；
//     把本回合「自用不掉」的多余贸易/战斗通过 transfer 一次性预留给队友下回合使用。
//   * 非团队：以「本人权威 − 对手平均权威」动态调节攻防，领先施压、落后筑防蓄力。
//   * 所有待决（discard / selectScrap / targetDiscard / eventChoice）与未知动作均打分兜底，
//     始终原样返回 legalActions 中的一个对象；纯线性打分，无循环、无状态写入、不死循环。

export const meta = {
  name: 'deepseek v4pro · 团队调度',
  description: 'deepseek v4pro 团队调度：2V2 识别队伍与共享权威，锁定焦点集中火力打穿敌方队伍，并把多余贸易/战斗 transfer 给队友；非团队模式按权威差稳健切换攻防。全模式、全扩展、全待决与未知动作安全兜底，零依赖、只读决策。'
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
  const teams = Array.isArray(v.teams) ? v.teams : [];
  const me = players[playerId] || {};
  const mem = (memory && typeof memory === 'object') ? memory : {};

  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = cardInfo(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  // ---------- 模式 / 团队 / 共享权威识别 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;

  let myTeamId = (typeof me.team === 'number') ? me.team : null;
  if (myTeamId == null && teams.length) {
    const t = teams.find(t => t && Array.isArray(t.players) && t.players.indexOf(playerId) >= 0);
    if (t) myTeamId = t.id;
  }
  const teamMode = mode === 'team2v2' || (myTeamId != null && teams.length > 0);
  const myTeam = teamMode ? teams.find(t => t && t.id === myTeamId) : null;
  const enemyTeam = teamMode ? teams.find(t => t && t.id !== myTeamId) : null;

  const myAuth = teamMode
    ? num(myTeam && myTeam.authority, num(me.authority, startAuth))
    : num(me.authority, startAuth);
  const enemyAuth = teamMode
    ? num(enemyTeam && enemyTeam.authority, startAuth)
    : (() => {
        const foes = players.filter(p => p && p.id !== playerId && !p.eliminated);
        if (!foes.length) return startAuth;
        return foes.reduce((s, p) => s + num(p.authority, startAuth), 0) / foes.length;
      })();

  // 某个受击座位当前所归属队伍的共享权威（非团队模式即其个人权威）。
  const authOfTarget = tid => {
    const p = players[tid] || {};
    if (teamMode) {
      const t = teams.find(x => x && x.id === p.team);
      return num(t && t.authority, num(p.authority, enemyAuth));
    }
    return num(p.authority, startAuth);
  };

  const enemies = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (!teamMode || p.team !== myTeamId));
  const teammates = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    teamMode && p.team === myTeamId);

  // ---------- 集中火力：锁定一个敌方焦点，跨回合保持稳定 ----------
  // 优先从「当前可攻击的敌方座位」里选，保证火力落在合法目标上；团队模式下敌方
  // 两座位共享同一条血，锁定其一作为固定门面，避免战斗零敲碎打地分散。
  const attackableFoes = actions
    .filter(a => a && a.type === 'attack' && a.targetType === 'player')
    .map(a => a.targetId);
  const focusPool = enemies.filter(p => attackableFoes.length ? attackableFoes.indexOf(p.id) >= 0 : true);
  const pool = focusPool.length ? focusPool : enemies;
  let focus = mem._focus;
  if (!pool.some(p => p.id === focus)) {
    let best = null;
    for (const p of pool) {
      const a = num(p.authority, startAuth);
      const hc = num(p.handCount, (p.hand || []).length || 0);
      const ip = Array.isArray(p.inPlay) ? p.inPlay.length : 0;
      const sc = (startAuth - a) * 4 + hc * 1.5 + ip * 2 - (teamMode ? p.id * 0.001 : 0);
      if (!best || sc > best.sc) best = { id: p.id, sc };
    }
    focus = best ? best.id : null;
    mem._focus = focus;
  }

  // ---------- 攻防倾向（非团队稳健；团队偏进攻以打穿共享血条） ----------
  let aggro = clamp(0.5 + (myAuth - enemyAuth) / 45, 0.15, 0.9);
  if (teamMode) aggro = clamp(aggro + 0.12, 0.15, 0.95);
  aggro = clamp(aggro + clamp((turn - 6) / 40, 0, 0.2), 0.1, 0.95);
  if (memory && typeof memory === 'object') {
    aggro = clamp(0.7 * num(mem._aggro, aggro) + 0.3 * aggro, 0.1, 0.95);
    mem._aggro = aggro;
    mem.calls = num(mem.calls, 0) + 1;
  }
  const guard = 1 - aggro;     // 落后 → 偏防守 / 经济
  const authW = 1 + 2 * guard; // 血量越低，权威损失越敏感

  // ---------- 卡牌估值：解析可见规则文本，随攻防倾向动态变化 ----------
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
    if (id === 'scout') return 1.0 + 0.6 * guard;
    if (id === 'viper') return 1.1 + 0.6 * aggro;
    if (id === 'explorer') return 2.2 + 0.6 * guard;
    const cost = num(c.cost, 3);
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
    val *= (1 - clamp(cost, 1, 8) * 0.018);
    return val;
  };

  // ---------- 优先级基线（大间隔形成稳定优先级） ----------
  // 团队调度要点：transfer 高于「非焦点攻击 / 打不穿的前哨削血」，低于「自用实质动作」，
  // 于是能把零散、无处可用的余量让给队友，同时不放弃自己能立即见效的火力。
  const OFF = {
    outpost: 920000,      // 摧毁敌方前哨：拔护盾、解锁对队伍的攻击
    play: 700000,         // 出牌
    ally: 660000,         // 同盟
    primary: 620000,      // 主要能力
    optional: 600000,     // 可选能力
    destroyBase: 565000,  // 摧毁普通敌方基地
    scrap: 560000,        // 销毁能力
    buy: 500000,          // 有价值购买
    explorer: 470000,     // 探索者：低优先经济填充
    playerAtk: 300000,    // 对焦点削血（集中火力，团队模式优先自用）
    transfer: 250000,     // 2V2 余量预留给队友
    offFocusAtk: 190000,  // 非焦点攻击：低于 transfer，让余量交给队友
    chipBase: 130000,     // 未摧毁的基地削血：低于 transfer，攒一波打穿
    unknown: 40000,       // 未知动作安全兜底
    noop: 10000,          // 近似空操作
    endTurn: -1000000
  };

  // ---------- 事件待决选择（events 扩展） ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      // 弃至多两张：每少弃一张失去 4 权威（下限 1）；弃掉的牌进弃牌堆可回收，折算一半。
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
        const c = cardInfo(a.baseId); // 己方基地被摧毁后可回归，损失按折扣计；前哨更敏感
        return -(cardValue(a.baseId) * 0.4 + (c && c.outpost ? 3 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 永久销毁：优先压掉初始牌 / 廉价牌，绝不损失好牌；targets:[] 可安全跳过。
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
      // 抽三放二回牌库顶：把较差的两张放回去，把最好的留在手里本回合即可用。
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.5;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决动作（discard / selectScrap / targetDiscard / eventChoice） ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':       // 我是弃牌者：弃掉手里最差的一张
        return -cardValue(a.cardId) * 10;
      case 'selectScrap':   // 强制销毁：优先永久压掉初始牌以压缩牌组
        return 200 - cardValue(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多 / 威胁大的敌人弃牌，绝不指向队友
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
        let s = 100 + hc * 8 + threat * 3 + (guard * auth + aggro * (startAuth - auth)) * 0.5;
        if (teamMode && t.team === myTeamId) s -= 10000;
        return s;
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
        // 回合末会清零的余量，优先一次预留较大额度给队友；非队友目标降分兜底。
        if (!teamMode) return OFF.unknown;
        const toTeammate = teammates.some(p => p.id === a.targetId);
        return (toTeammate ? OFF.transfer : OFF.unknown) + num(a.amount, 0) * 3;
      }
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
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0); // 打不穿：宁可把战斗转给队友
        }
        // 对玩家：聚焦锁定的敌方门面，一次性倾泻最大额度；团队模式伤害落在共享权威上。
        const auth = authOfTarget(a.targetId);
        const isFocus = a.targetId === focus;
        const base = isFocus ? OFF.playerAtk : OFF.offFocusAtk;
        let s = base + amt * (6 + 20 * aggro);
        s += (startAuth - auth) * 0.5;
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
          let g = 8;                 // 弃 / 回收 / 销毁：滤掉差牌
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
        if (a.explorer) return OFF.explorer;
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buy - 60;
        let s = OFF.buy + cardValue(uid) * 14; // 按卡牌价值择优（价值已含攻防权重）
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

  // lethal：一击让敌方（队伍共享）权威归零，绝对优先；待决阶段不产生攻击动作。
  if (!v.pending) {
    const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
      num(a.amount, 0) >= authOfTarget(a.targetId));
    if (lethal) return lethal;
  }

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
