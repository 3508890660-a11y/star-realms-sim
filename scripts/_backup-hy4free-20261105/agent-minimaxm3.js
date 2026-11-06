// MiniMax M3 · 贸易滚雪球 —— 零依赖、只读决策 AI
// 适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合。
// 不改 view / legalActions / context（深冻结），仅写本座位私有 memory；
// 始终原样返回 legalActions 中的一个对象，所有待决与未知动作都打分兜底，不会死循环。
//
// 策略：以「回合数」建立经济曲线，前期偏贸易与压缩（滚雪球起步），
//   中期偏好高费牌（把贸易换算成质量），后期把经济转为战斗（直伤终结）。
//   卡牌价值由规则文本粗估：贸易 / 战斗 / 抽牌 / 权威 / 费用 / 阵营 / 前哨。

export const meta = {
  name: 'MiniMax M3 · 贸易滚雪球',
  description: '按回合数建立经济曲线：前期贸易与压缩、中期高费牌、后期经济转战斗；从卡牌文本粗估贸易/战斗/抽牌价值。全模式、全牌包、全部待决与未知动作均安全兜底。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 数字解析：卡牌文本以阿拉伯数字为主，事件/殖民战争牌偶用中文数字，一并兼容。
const CN = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const toNum = tok => /^\d+$/.test(tok) ? Number(tok) : (CN[tok] || 0);
const sumNums = (t, re) => {
  let s = 0;
  for (const m of t.matchAll(re)) s += toNum(m[1]);
  return s;
};

// 从规则文本粗估一张牌的「贸易 / 战斗 / 抽牌 / 权威 / 弃对手牌」等要素。
const profile = text => {
  const t = typeof text === 'string' ? text : '';
  return {
    trade: sumNums(t, /([\d一二两三四五六七八九十]+)\s*贸易/g),
    combat: sumNums(t, /([\d一二两三四五六七八九十]+)\s*战斗/g),
    authority: sumNums(t, /([\d一二两三四五六七八九十]+)\s*权威/g),
    draw: sumNums(t, /抽\s*([\d一二两三四五六七八九十]+)\s*张/g),
    discardOpp: sumNums(t, /(?:目标)?对手弃\s*([\d一二两三四五六七八九十]+)\s*张牌/g),
    ally: /同盟/.test(t),
    destroyBase: /摧毁/.test(t),
    free: /免费|置于牌库顶|置入手牌|获得时可/.test(t),
    scrapEffect: /销毁[：:]/.test(t),
    conditionalDraw: /若|便|每|至少/.test(t)
  };
};

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const cardInfo = uid => (uid != null && cards[uid]) || null;

  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = clamp(num((context && context.turn) || v.turn, 1), 1, 40);
  const sets = (v.expansions && Array.isArray(v.expansions.sets)) ? v.expansions.sets : ['core'];
  const hasEvents = sets.includes('events');
  const hasColonyWars = sets.includes('colonyWars');
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myTeam = me.team;
  // 对手集合：team2v2 排除队友，其余排除已淘汰者；猎杀/先血由引擎限定合法目标，
  // 这里只对 legalActions 中已给出的目标打分，不再自行推断攻击限制。
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const auths = opponents.map(p => num(p.authority, startAuth));
  const minEnemy = auths.length ? Math.min(...auths) : startAuth;

  // ---------- 经济曲线：按回合数分段 ----------
  const eco = clamp((6 - turn) / 5, 0, 1);               // 前期(1~6)：贸易、抽牌、压缩
  const mid = clamp(1 - Math.abs(turn - 7) / 5, 0, 1);   // 中期(~7)：偏好高费牌
  let war = clamp((turn - 8) / 7, 0, 1);                 // 后期(8~15)：经济转战斗
  // 自有牌最高费用作为「经济已成形」信号，把兑现战斗的时点适度提前（滚雪球兑现）。
  let econLevel = 0;
  for (const uid of [...(me.hand || []), ...(me.discard || []), ...(me.inPlay || [])]) {
    const c = cardInfo(uid);
    if (c && typeof c.cost === 'number' && c.cost > econLevel) econLevel = c.cost;
  }
  war = clamp(war + clamp(econLevel / 8, 0, 0.25) + (hasColonyWars ? 0.03 : 0), 0, 1);
  if (memory && typeof memory === 'object') {
    war = clamp(0.75 * num(memory._war, war) + 0.25 * war, 0, 1); // 轻度平滑，避免阶段抖动
    memory._war = war;
    memory.calls = num(memory.calls, 0) + 1;
    memory.curve = { turn, eco, mid, war };
  }

  // 各要素权重随阶段变化：贸易/抽牌前期高，战斗后期飙升，高费偏好中期见顶。
  const W = {
    eco, mid, war,
    trade: 1.0 + 0.9 * eco - 0.2 * war,
    combat: 0.45 + 1.9 * war,
    draw: 2.3 + 0.8 * eco,
    authority: 1.0 + 0.5 * (1 - war) + (hasEvents ? 0.2 : 0),
    cost: 0.15 + 1.4 * mid,
    scrap: 0.5 + 1.5 * eco
  };

  // ---------- 卡牌估值（面向当前阶段） ----------
  const cardValue = uid => {
    const c = cardInfo(uid);
    if (!c) return 1;
    if (c.id === 'scout') return 1.3;                       // 前期仍产贸易，中后期是压缩目标
    if (c.id === 'viper') return 0.9;                       // 前期几乎无用，优先压缩
    if (c.id === 'explorer') return 2.0 + 1.0 * W.eco - 0.6 * W.war; // 经济填充，销毁可换战斗
    const e = profile(c.text);
    const cost = num(c.cost, 3);
    const choice = /选择[：:]/.test(c.text || '') ? 0.7 : 1; // 二选一牌两路效果打折
    let val = 2.5;
    val += e.trade * W.trade * choice;
    val += e.combat * W.combat * choice;
    val += e.draw * W.draw * (e.conditionalDraw ? 0.5 : 1);
    val += e.authority * W.authority * choice;
    val += e.discardOpp * (1.3 + 0.7 * W.war);
    val += cost * W.cost;                                   // 中期偏好高费牌
    if (c.type === 'base') val += 1.5 + (c.outpost ? 2.5 : 0);
    if (e.ally) val += 2.0;
    if (e.destroyBase) val += 1.2 + 1.5 * W.war;
    if (e.free) val += 2.0;
    if (e.scrapEffect) val += 1.0 * W.scrap;               // 前期可作压缩手段
    if (c.faction && c.faction !== 'neutral') val += 0.4;
    val *= (1 - clamp(cost, 1, 8) * 0.012);                // 轻微效率偏好
    return val;
  };

  // 压缩偏好：初始牌优先销毁；好牌给负收益以免误伤。
  const scrapGain = uid => {
    const c = cardInfo(uid);
    if (!c) return 0;
    if (c.id === 'viper') return 30;
    if (c.id === 'scout') return 24;
    if (c.id === 'explorer') return 10;
    const cv = cardValue(uid);
    return cv <= 3.5 ? 6 : -cv * 3;
  };

  const ownedFactions = new Set();
  for (const u of (me.inPlay || [])) {
    const c = cardInfo(u);
    const fs = c ? (Array.isArray(c.factions) ? c.factions :
      (c.faction && c.faction !== 'neutral' ? [c.faction] : [])) : [];
    for (const f of fs) ownedFactions.add(f);
  }

  const choiceBias = choice => (choice === 0 ? 8 * W.eco : 8 * W.war); // 前期偏贸易/权威，后期偏战斗

  const targetDiscardScore = a => {
    const t = players[a.targetId] || {};
    const auth = num(t.authority, startAuth);
    const hc = num(t.handCount, (t.hand || []).length || 0);
    const threat = (t.inPlay || []).length;
    let s = 100 + hc * 8 + threat * 3 + (startAuth - auth) * 0.6;
    if (mode === 'firstBlood' && a.targetId === 0) s += 30; // 先血：逼首位玩家出局可即时获胜
    return s;
  };

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    const myAuth = num(me.authority, startAuth);
    const authW = 1 + 1.5 * W.eco + (hasEvents ? 0.4 : 0); // 前期/事件局里权威更珍贵
    if (ev === 'blackHole') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = myAuth - Math.max(1, myAuth - 4 * missing);
      let cost = 0;
      for (const uid of targets) cost += cardValue(uid) * 0.5; // 弃牌进弃牌堆可回收，折半
      return -(cost + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) {
        const loss = myAuth - Math.max(1, myAuth - 6);
        return -(loss * authW);
      }
      if (a.baseId) {
        const c = cardInfo(a.baseId);
        return -(cardValue(a.baseId) * 0.35 + (c && c.outpost ? 3 : 0.5)); // 摧毁己方基地（可回收）
      }
      return -1;
    }
    if (ev === 'comet') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) benefit += scrapGain(uid);   // 永久销毁，优先压掉初始牌
      return benefit * (0.6 + W.scrap);
    }
    if (ev === 'warpJump') {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(uid) * 3;          // 把最差两张放回牌库顶，留最好的在手
      if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 0.5; // 较好者置顶先抽
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 优先级基线（大间隔形成稳定优先级） ----------
  // 后期把 destroyBase 让位给 playerAtk，体现「经济转战斗」；前哨始终优先清除以解锁直伤。
  const P = {
    outpost: 690000,
    play: 700000,
    ally: 660000,
    primary: 630000,
    optional: 600000,
    scrap: 560000,
    destroyBase: 200000 + 365000 * (1 - war),
    buy: 500000,
    playerAtk: 170000 + 200000 * war,
    chipBase: 130000,
    transfer: 90000,
    unknown: 40000,
    noop: -1100000,
    endTurn: -1000000
  };

  // ---------- 统一择优：覆盖主阶段与所有 pending 动作 ----------
  const score = a => {
    if (!a || typeof a !== 'object') return P.unknown;
    switch (a.type) {
      case 'endTurn':
        return P.endTurn;
      case 'transfer': {
        // 回合末会清零的余量转给队友；偏好一次转较大额度，避免多步空转。
        let s = P.transfer + num(a.amount, 0) * 20;
        if (mode === 'team2v2' && a.resource === 'combat') s += 220000 * (1 - war);
        return s;
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const def = num(c && c.defense, 1);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(c && c.outpost);
          if (destroyed) {
            const cv = cardValue(a.targetId) * 0.5;
            if (outpost) return P.outpost + 30000 * war + amt * 3 + cv;
            return P.destroyBase + amt * 3 + cv;
          }
          return P.chipBase + amt * 2 + (outpost ? 30 : 0);
        }
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = P.playerAtk + amt * (5 + 22 * war);
        s += (startAuth - auth) * 0.5;
        if (auth <= minEnemy + 1) s += 35;                 // 聚焦最弱/最接近出局者
        if (mode === 'firstBlood' && a.targetId === 0) s += 25;
        return s;
      }
      case 'play': {
        let s = P.play + cardValue(a.cardId) * 1.5;
        if (a.copy) s += cardValue(a.copy) * 2 + 25;                        // 复制强力牌
        if (a.row !== undefined) s += cardValue((v.tradeRow || [])[a.row]) * 1.5; // 免费获得
        if (a.choice !== undefined) s += choiceBias(a.choice);
        return s;
      }
      case 'ability': {
        const kindOff = { ally: P.ally, primary: P.primary, optional: P.optional, scrap: P.scrap };
        const base = kindOff[a.ability] === undefined ? P.unknown : kindOff[a.ability];
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const emptyTargets = targets && targets.length === 0;
        const hasRow = a.row !== undefined;
        const hasRows = Array.isArray(a.rows) && a.rows.length > 0;
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        const scrapRow = a.ability === 'optional' && (hasRow || hasRows) && !targets && !hasTargetId;
        const hasOther = hasRow || hasRows || hasTargetId || a.choice !== undefined || a.resource !== undefined;
        if (emptyTargets && !hasOther && a.choice === undefined) return P.noop; // 空目标近似空操作
        if (scrapRow) return P.unknown + (hasRows ? 10 : 0); // 可选销毁交易行放到最后，避免误删想买的牌
        let val = 0;
        if (hasRow) {
          const rc = (v.tradeRow || [])[a.row];
          val += rc ? cardValue(rc) * 1.2 + 20 : 20;       // 免费获得/置牌库顶，估值择优
        }
        if (hasTargetId) {
          const c = cardInfo(a.targetId);
          val += 60 + (c && c.outpost ? 40 : 0) + (c ? cardValue(a.targetId) * 0.3 : 0) + 30 * war; // 摧毁敌方基地
        }
        if (a.resource) {
          val += 6;
          const pref = war > 0.5 ? 'combat' : 'trade';
          if (a.resource === pref) val += 14;              // 补给站：前期换贸易、后期换战斗
        }
        if (targets && targets.length) {
          let g = 6;
          for (const uid of targets) g += scrapGain(uid);
          val += g * (0.5 + W.scrap);                       // 压缩：优先销毁初始牌
        }
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += choiceBias(a.choice);
        if (a.ability === 'scrap') val -= cardValue(a.cardId) * 0.35; // 销毁自身会失去这张牌
        return base + val;
      }
      case 'buy': {
        if (a.explorer) return P.buy + (2.0 + 1.0 * W.eco - 0.6 * W.war) * 14 - 20;
        const uid = (v.tradeRow || [])[a.row];
        if (!uid) return P.buy - 60;
        let s = P.buy + cardValue(uid) * 14;
        const cf = cardInfo(uid);
        if (cf) {
          const fs = Array.isArray(cf.factions) ? cf.factions :
            (cf.faction && cf.faction !== 'neutral' ? [cf.faction] : []);
          if (fs.some(f => ownedFactions.has(f))) s += 12; // 阵营聚集，同盟更易触发
        }
        return s;
      }
      // ---------- 待决选择（pending 时 legalActions 仅含这些类型） ----------
      case 'discard':
        return -cardValue(a.cardId) * 10;                  // 弃掉手里最差的一张
      case 'selectScrap':
        return 200 + scrapGain(a.cardId) * (0.5 + W.scrap); // 强制销毁：优先压掉初始牌
      case 'targetDiscard':
        return targetDiscardScore(a);
      case 'eventChoice':
        return eventScore(a);
      default:
        return P.unknown;                                  // 未知动作：安全兜底
    }
  };

  // lethal：一击致胜绝对优先（team2v2 的 authority 为全队共享值，同样成立）。
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  let best = actions[0];
  let bestVal = -Infinity;
  for (const a of actions) {
    let s;
    try { s = score(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5; // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
