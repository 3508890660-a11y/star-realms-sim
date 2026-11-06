// deepseek v4pro · 团队调度 AI
//
// 零依赖、纯只读决策。只读取深冻结的 view 与 legalActions，绝不对其做任何修改，
// 不 sort() 原数组，所有决策点都原样返回 legalActions 中的某个对象引用。
//
// 适配 standard / ffa / hunter / firstBlood / team2v2 五种模式，以及
// core / colonyWars / events 任意组合；对 play / ability(primary/ally/optional/scrap) /
// buy / attack / endTurn / discard / selectScrap / targetDiscard / eventChoice /
// transfer 以及任何未知动作都做安全兜底。
//
// 策略主题「团队调度」：
//   * team2v2：从 view.teams 与 player.team 识别队伍与共享权威；用 memory 锁定一个
//     敌方焦点座位，把战斗持续倾泻到同一条共享血条上，力求一次打穿敌方整队；
//     优先拔除阻挡队伍直伤的前哨；把本回合「自用不掉」的多余贸易/战斗通过
//     transfer 一次性预留给队友下回合使用。
//   * 非团队模式：退化为「本人权威 − 敌方权威差」驱动的稳健攻防，领先施压、落后筑防蓄力。

export const meta = {
  name: 'deepseek v4pro · 团队调度',
  description: 'deepseek-v4-pro 团队调度策略：2V2 下识别队伍与共享权威，用 memory 锁定敌方焦点集中火力打穿一队，并把多余贸易/战斗 transfer 给队友；非团队模式按权威差稳健切换攻防。全模式、core/colonyWars/events 任意组合、全部待决与未知动作安全兜底，零依赖、只读决策、始终返回合法动作。'
};

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const acts = Array.isArray(legalActions) ? legalActions : [];
  if (!acts.length) return undefined; // 正常流程必然至少含 endTurn 或待决动作，仅作极端兜底

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const teams = Array.isArray(v.teams) ? v.teams : [];
  const me = players[playerId] || {};
  const mem = (memory && typeof memory === 'object') ? memory : {};
  const pending = v.pending || null;

  const card = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = card(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  // ---------- 模式 / 队伍 / 共享权威 ----------
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;

  let myTeamId = (typeof me.team === 'number') ? me.team : null;
  if (myTeamId == null && teams.length) {
    const t = teams.find(x => x && Array.isArray(x.players) && x.players.indexOf(playerId) >= 0);
    if (t) myTeamId = t.id;
  }
  const isTeam = mode === 'team2v2' || (myTeamId != null && teams.length > 0);
  const myTeam = isTeam ? teams.find(x => x && x.id === myTeamId) : null;
  const enemyTeam = isTeam ? teams.find(x => x && x.id !== myTeamId) : null;

  const myAuth = isTeam
    ? num(myTeam && myTeam.authority, num(me.authority, startAuth))
    : num(me.authority, startAuth);
  const enemyAuth = isTeam
    ? num(enemyTeam && enemyTeam.authority, startAuth)
    : (() => {
        const foes = players.filter(p => p && p.id !== playerId && !p.eliminated);
        if (!foes.length) return startAuth;
        return foes.reduce((s, p) => s + num(p.authority, startAuth), 0) / foes.length;
      })();

  const enemies = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (!isTeam || p.team !== myTeamId));
  const teammates = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    isTeam && p.team === myTeamId);

  // 某座位当前归属的「血条」权威（团队模式即队伍共享权威）。
  const authOf = tid => {
    const p = players[tid] || {};
    if (isTeam) {
      const t = teams.find(x => x && x.id === p.team);
      return num(t && t.authority, num(p.authority, enemyAuth));
    }
    return num(p.authority, startAuth);
  };

  // ---------- 集中火力：跨回合锁定一个敌方焦点 ----------
  const attackableIds = acts.filter(a => a && a.type === 'attack' && a.targetType === 'player')
    .map(a => a.targetId);
  const pool = enemies.filter(p => attackableIds.length ? attackableIds.indexOf(p.id) >= 0 : true);
  let focus = mem._focus;
  if (!pool.some(p => p.id === focus)) {
    let best = null;
    for (const p of pool) {
      const sc = (startAuth - num(p.authority, startAuth)) * 4 +
        num(p.handCount, (p.hand || []).length || 0) * 1.5 +
        (Array.isArray(p.inPlay) ? p.inPlay.length : 0) * 2 - p.id * 0.001;
      if (!best || sc > best.sc) best = { id: p.id, sc };
    }
    focus = best ? best.id : null;
    mem._focus = focus;
  }

  // ---------- 攻防倾向：团队偏进攻，非团队按权威差 ----------
  let aggro = clamp(0.5 + (myAuth - enemyAuth) / 45, 0.15, 0.9);
  if (isTeam) aggro = clamp(aggro + 0.12, 0.15, 0.95);
  aggro = clamp(aggro + clamp((turn - 6) / 40, 0, 0.2), 0.1, 0.95);
  if (memory && typeof memory === 'object') {
    aggro = clamp(0.7 * num(mem._aggro, aggro) + 0.3 * aggro, 0.1, 0.95);
    mem._aggro = aggro;
    mem.calls = num(mem.calls, 0) + 1;
  }
  const guard = 1 - aggro;
  const authW = 1 + 2 * guard; // 权威越紧张，掉血越敏感

  // ---------- 卡牌估值：解析可见规则文本，随攻防倾向动态加权 ----------
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
  const cardVal = uid => {
    const c = card(uid);
    if (!c) return 1;
    if (c.id === 'scout') return 1.0 + 0.6 * guard;
    if (c.id === 'viper') return 1.1 + 0.6 * aggro;
    if (c.id === 'explorer') return 2.2 + 0.6 * guard;
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

  // ---------- 优先级基线（大间隔分层，保证稳定次序） ----------
  // 团队调度要点：transfer 高于「非焦点攻击 / 打不穿的前哨削血」，低于一切自用实质动作，
  // 让零散余量交给队友集中使用，同时不牺牲自己能立即见效的火力。
  const OFF = {
    outpost: 920000,
    play: 700000,
    ally: 660000,
    primary: 620000,
    optional: 600000,
    destroyBase: 565000,
    scrap: 560000,
    buy: 500000,
    explorer: 470000,
    playerAtk: 300000,
    transfer: 250000,
    offFocusAtk: 190000,
    chipBase: 130000,
    unknown: 40000,
    noop: 10000,
    endTurn: -1000000
  };

  // ---------- 事件待决打分（events 扩展） ----------
  const eventScore = a => {
    const ev = a.eventId || (pending && (pending.eventId || pending.kind)) || '';
    if (ev === 'blackHole') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = myAuth - Math.max(1, myAuth - 4 * missing);
      let cost = 0;
      for (const uid of targets) cost += cardVal(uid);
      return -(cost * 0.5 + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) {
        const loss = myAuth - Math.max(1, myAuth - 6);
        return -(loss * authW);
      }
      if (a.baseId) {
        const c = card(a.baseId);
        return -(cardVal(a.baseId) * 0.4 + (c && c.outpost ? 3 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) {
        if (isStarter(uid)) benefit += 40;
        else {
          const cv = cardVal(uid);
          benefit += cv <= 3.5 ? 10 : -cv * 4;
        }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardVal(uid) * 3;
      if (cs.length >= 2 && cardVal(cs[0]) >= cardVal(cs[1])) s += 0.5;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决动作打分 ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard': // 我是弃牌者：弃手里最差的一张
        return -cardVal(a.cardId) * 10;
      case 'selectScrap': // 强制销毁：优先永久压掉初始牌压缩牌组
        return 200 - cardVal(a.cardId) * 10 + (isStarter(a.cardId) ? 500 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多 / 威胁大的敌人，绝不指向队友
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, (t.hand || []).length || 0);
        const threat = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
        let s = 100 + hc * 8 + threat * 3 + (guard * auth + aggro * (startAuth - auth)) * 0.5;
        if (isTeam && t.team === myTeamId) s -= 10000;
        return s;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0; // 未知待决：中性兜底
    }
  };

  // ---------- 主阶段动作打分 ----------
  const mainScore = a => {
    if (!a || typeof a !== 'object') return OFF.unknown;
    switch (a.type) {
      case 'endTurn':
        return OFF.endTurn;
      case 'transfer': {
        if (!isTeam) return OFF.unknown;
        const toTeammate = teammates.some(p => p.id === a.targetId);
        return (toTeammate ? OFF.transfer : OFF.unknown) + num(a.amount, 0) * 3;
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = card(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) {
            const cv = cardVal(a.targetId) * 0.6;
            if (outpost) return OFF.outpost + 40000 * guard + amt * 3 + cv;
            return OFF.destroyBase + amt * 3 + cv;
          }
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0);
        }
        // 对玩家：聚焦锁定门面，倾泻最大额度；团队模式伤害落在共享血条上
        const auth = authOf(a.targetId);
        const base = a.targetId === focus ? OFF.playerAtk : OFF.offFocusAtk;
        return base + amt * (6 + 20 * aggro) + (startAuth - auth) * 0.5;
      }
      case 'play': {
        let s = OFF.play + cardVal(a.cardId) * 1.5;
        if (a.copy) s += cardVal(a.copy) * 2 + 30;
        if (a.row !== undefined) s += cardVal((v.tradeRow || [])[a.row]) * 1.2;
        if (a.choice !== undefined) s += 3;
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
        if (hasRow) val += 90;
        if (hasTargetId) val += 110;
        if (a.resource) val += 6;
        if (targets && targets.length) {
          let g = 8;
          for (const uid of targets) {
            if (isStarter(uid)) g += 28;
            else {
              const cv = cardVal(uid);
              g += cv <= 3.5 ? 5 : -cv * 2;
            }
          }
          val += g;
        }
        if (emptyTargets && !hasRow && !hasTargetId && a.choice === undefined) return OFF.noop;
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') val -= cardVal(a.cardId) * 0.35;
        return base + val;
      }
      case 'buy': {
        if (a.explorer) return OFF.explorer;
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return OFF.buy - 60;
        let s = OFF.buy + cardVal(uid) * 14;
        const owned = new Set();
        for (const u of (me.inPlay || [])) {
          const c = card(u);
          for (const f of (c && Array.isArray(c.factions) ? c.factions : [])) owned.add(f);
        }
        const cf = card(uid);
        if (cf && Array.isArray(cf.factions) && cf.factions.some(f => owned.has(f))) s += 12;
        return s;
      }
      default:
        return OFF.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  // lethal：一击让敌方血条归零，绝对优先；待决阶段不产生攻击动作
  if (!pending) {
    const lethal = acts.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
      num(a.amount, 0) >= authOf(a.targetId));
    if (lethal) return lethal;
  }

  // ---------- 统一择优：始终返回 legalActions 中的原始对象 ----------
  const scoreFn = pending ? pendingScore : mainScore;
  let best = acts[0];
  let bestVal = -Infinity;
  for (const a of acts) {
    let s;
    try { s = scoreFn(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5; // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
