// 殖民战争 · step5preview —— 零依赖、只读决策的《星域奇航》AI 脚本
//
// 主题：把「同回合购得的强牌」尽快送进手牌、打出去、接上同盟链。
//
// 引擎里与主题直接相关的机制（均从 view / legalActions 只读识别，不依赖内部字段）：
//   · toHandIfFaction（入手牌）：warningBeacon / colonySeedShip / plasmaVent /
//     emperorsDreadnaught 等牌被「获得」时，若本回合已打出过同阵营牌，会直接进入
//     手牌而不是弃牌堆 —— 于是本回合就能打出，并立刻参与同盟链。
//   · nextAcquireToHand / topDeckNextAny / topDeckNextShip：Factory World、
//     Federation Shipyard、tradeMission 等让「下一张获得的牌」入手牌或置牌库顶。
//   · 免费获得（acquireCheapFree / acquireShipFree / acquireFreeMax）：Moonwurm、
//     Leviathan 的同盟会把廉价牌直接「置入手牌」，Blob Carrier 置于牌库顶，
//     Parasite 的选择效果免费获得一张牌。
//   · copyBase / copyShip：隐匿尖塔、隐匿针舰在 play 动作里带 copy 字段，
//     复制目标的阵营会加入本牌，可用来接上同盟链。
//   · Command Center（指挥中心）：在场时每打出一艘帝国飞船额外 +2 战斗。
//
// 设计：双层打分。
//   1) 通用估值层（baseline）：lethal、拔前哨、出牌、同盟、有价值购买、削血攻击、
//      牌组压缩、2V2 预留、待决选择 —— 任何模式/扩展组合都成立。
//   2) 殖民战争加权层：仅在检测到扩展牌包时叠加，专门奖励「入手牌购买」、
//      「铺阵营的出牌」、「免费获得且入手牌」、「复制接链」、「指挥中心供能」等。
//   无扩展（纯 core）时加权层完全关闭，等价于纯通用估值，达成「回退」。
//
// 约束：不改 view / legalActions（深冻结）及其任何子对象；不 sort/push/splice 输入；
// 始终原样返回 legalActions 中的一个对象；单一 for 循环无递归、无 while，不会死循环；
// 所有字段访问都做防御性兜底，绝不抛异常。

export const meta = {
  name: '殖民战争 · step5preview',
  description: '殖民战争主题：识别 toHandIfFaction/入手牌、免费获得、copyBase、Command Center 等扩展机制，优先让同回合购得的强牌立即参与同盟链；无扩展时回退通用估值。适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合，安全处理全待决与未知动作。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 「获得时可置入手牌」的卡牌 → 其所需阵营恰为该牌自身阵营（见 expansions.js）。
const TOHAND = {
  warningBeacon: 'machine',
  colonySeedShip: 'federation',
  plasmaVent: 'blob',
  emperorsDreadnaught: 'empire'
};
const FACTION_OF_TEXT = {
  '机械教团': 'machine', '贸易联邦': 'federation', '虫群': 'blob', '星际帝国': 'empire'
};

// 返回该卡入手牌所需的阵营；非入手牌卡返回 null。以 id 为主、文本为兜底。
const toHandFaction = def => {
  if (!def) return null;
  if (TOHAND[def.id]) return TOHAND[def.id];
  const t = def.text || '';
  if (def.set === 'colonyWars' && /置入手牌/.test(t) && /本回合打出过/.test(t)) {
    for (const key in FACTION_OF_TEXT) if (t.includes(key)) return FACTION_OF_TEXT[key];
    return def.faction || null;
  }
  return null;
};

const isCommandCenter = def => !!def && (def.id === 'commandCenter' || /帝国飞船/.test(def.text || ''));
const isCopyBaseCard = def => !!def && (def.id === 'stealthTower' || /复制[^。]*基地/.test(def.text || ''));
const isStarter = def => !!def && (def.id === 'scout' || def.id === 'viper');

const sumNums = (text, re) => {
  let s = 0;
  for (const m of String(text).matchAll(re)) s += Number(m[1]) || 0;
  return s;
};

// 稳健的扩展检测：优先读 view.expansions，缺失时扫描可见卡牌的 set 字段。
function detectExpansions(v) {
  let colony = false;
  let events = false;
  const ex = v && v.expansions;
  if (ex && typeof ex === 'object') {
    colony = !!ex.colonyWars || (Array.isArray(ex.sets) && ex.sets.includes('colonyWars'));
    events = !!ex.events || (Array.isArray(ex.sets) && ex.sets.includes('events'));
  }
  if (!colony || !events) {
    const cs = (v && v.cards) || {};
    for (const uid in cs) {
      const set = cs[uid] && cs[uid].set;
      if (set === 'colonyWars') colony = true;
      else if (set === 'events') events = true;
    }
  }
  return { colony, events, any: colony || events };
}

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myTeam = me.team;

  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const factionsOf = def => {
    if (!def) return [];
    if (Array.isArray(def.factions)) return def.factions;
    return def.faction && def.faction !== 'neutral' ? [def.faction] : [];
  };

  // ---------- 血量差 → 攻防倾向（通用，带记忆平滑，适应对局节奏） ----------
  const enemies = players.filter((p, i) => p && i !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const enemyAuths = enemies.map(p => num(p.authority, startAuth));
  const avgEnemy = enemyAuths.length ? enemyAuths.reduce((a, b) => a + b, 0) / enemyAuths.length : startAuth;
  const myAuth = num(me.authority, startAuth);
  let aggro = clamp(0.5 + (myAuth - avgEnemy) / 45, 0.1, 0.9);
  aggro = clamp(aggro + clamp((turn - 6) / 40, 0, 0.2), 0.1, 0.95);
  if (memory && typeof memory === 'object') {
    aggro = clamp(0.7 * num(memory._aggro, aggro) + 0.3 * aggro, 0.1, 0.95);
    try { memory._aggro = aggro; memory.calls = num(memory.calls, 0) + 1; } catch (err) { /* 记忆被冻结时忽略 */ }
  }
  const guard = 1 - aggro;
  const authW = 1 + 2 * guard;

  // ---------- 通用卡牌估值（纯文本启发式，无扩展同样可用） ----------
  const profile = def => {
    const t = (def && def.text) || '';
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
  const cardValue = def => {
    if (!def) return 1;
    const id = def.id;
    if (id === 'scout') return 1.0 + 0.6 * guard;
    if (id === 'viper') return 1.1 + 0.6 * aggro;
    if (id === 'explorer') return 2.2 + 0.6 * guard;
    const cost = num(def.cost, 3);
    const e = profile(def.text);
    let val = 3;
    val += e.trade * (1.0 + 0.4 * guard);
    val += e.draw * 2.6 + (e.drawWord ? 2 : 0);
    val += e.authority * (1.1 + 1.4 * guard);
    val += e.combat * (0.6 + 1.2 * aggro);
    val += e.discardOpp * 2.2;
    if (def.outpost) val += 3 + 3 * guard;
    else if (def.type === 'base') val += 2 + 1.5 * guard;
    if (e.ally) val += 2.5;
    if (e.scrap || e.discard) val += 1.5;
    if (e.destroyBase) val += 2;
    if (e.free) val += 3;
    if (def.faction && def.faction !== 'neutral') val += 0.5;
    val *= (1 - clamp(cost, 1, 8) * 0.018);
    return val;
  };

  // 弃牌/销毁自有牌时的质量：优先压掉初始牌压缩牌组，别毁掉好牌。
  const targetQuality = targets => {
    let q = 0;
    for (const uid of targets || []) {
      const d = cardInfo(uid);
      if (isStarter(d)) q += 30;
      else { const cv = cardValue(d); q += cv <= 3.2 ? 8 : -cv * 3; }
    }
    return q;
  };

  // ---------- 殖民战争上下文（只读推导） ----------
  const { colony: hasColony } = detectExpansions(v);
  const primedFactions = new Set();   // 本回合已打出的阵营（决定入手牌是否触发）
  for (const uid of (Array.isArray(me.playedThisTurn) ? me.playedThisTurn : [])) {
    for (const f of factionsOf(cardInfo(uid))) primedFactions.add(f);
  }
  const inPlayFactionCount = {};      // 我方场上各阵营牌数（同盟链规模）
  const myInPlay = Array.isArray(me.inPlay) ? me.inPlay : [];
  for (const uid of myInPlay) {
    for (const f of factionsOf(cardInfo(uid))) inPlayFactionCount[f] = (inPlayFactionCount[f] || 0) + 1;
  }
  const commandActive = myInPlay.some(uid => isCommandCenter(cardInfo(uid)));
  // 交易行里买得起的「入手牌」卡所需的阵营：用于奖励「铺阵营」的出牌。
  const neededFactions = new Set();
  const tradeRow = Array.isArray(v.tradeRow) ? v.tradeRow : [];
  for (let row = 0; row < tradeRow.length; row++) {
    const d = cardInfo(tradeRow[row]);
    const f = toHandFaction(d);
    if (f && num(me.trade, 0) >= num(d && d.cost, 99)) neededFactions.add(f);
  }

  // 复制类 play 的取值：复制强牌 + 与场上同阵营接上同盟链 + 前哨额外价值。
  const copySynergy = a => {
    const cd = cardInfo(a.copy);
    if (!cd) return 0;
    let s = cardValue(cd) * 0.12 + 4;
    for (const f of factionsOf(cd)) s += 22 * (inPlayFactionCount[f] || 0);
    if (cd.outpost) s += 18;
    return s;
  };

  // 可被攻击玩家中的最低权威（自动适配 hunter/firstBlood/team2v2 的合法目标）。
  const atkTargets = actions.filter(a => a && a.type === 'attack' && a.targetType === 'player')
    .map(a => a.targetId);
  const atkAuth = atkTargets.map(id => num((players[id] || {}).authority, startAuth));
  const minAtkAuth = atkAuth.length ? Math.min(...atkAuth) : startAuth;

  // ---------- 优先级基线（大间隔保证稳定次序） ----------
  const OFF = {
    outpost: 920000,      // 摧毁敌方前哨
    play: 700000,         // 打出（含入手牌、复制、免费获得）
    ally: 660000,         // 同盟
    primary: 620000,      // 主要能力
    optional: 600000,     // 可选能力
    destroyBase: 565000,  // 摧毁普通敌方基地
    scrap: 560000,        // 销毁能力
    buy: 500000,          // 购买
    playerAtk: 180000,    // 对玩家削血
    chipBase: 130000,     // 未摧毁基地削血
    transfer: 100000,     // 2V2 预留余量给队友
    unknown: 40000,       // 未知动作安全兜底
    endTurn: -1000000,
    noop: -1100000        // 空目标可选能力≈空操作，排在结束回合之后，避免空转
  };

  // lethal：一击致胜，绝对优先。attack 动作已由引擎过滤为合法目标（含前哨/模式限制）。
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  // ---------- 事件待决选择 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = Math.max(0, 2 - targets.length);
      const loss = myAuth - Math.max(1, myAuth - 4 * missing); // 权威下限 1
      let cost = 0;
      for (const uid of targets) cost += cardValue(cardInfo(uid)); // 弃掉的牌可回收，折半
      return -(cost * 0.5 + loss * authW);
    }
    if (ev === 'bombardment') {
      if (a.pay) return -(myAuth - Math.max(1, myAuth - 6)) * authW;
      if (a.baseId) {
        const d = cardInfo(a.baseId); // 己方基地被毁后进入弃牌堆，可回归
        return -(cardValue(d) * 0.4 + (d && d.outpost ? 2 : 0.5));
      }
      return -1;
    }
    if (ev === 'comet') {
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      for (const uid of targets) {
        if (isStarter(cardInfo(uid))) benefit += 40;           // 永久销毁：优先压初始牌
        else { const cv = cardValue(cardInfo(uid)); benefit += cv <= 3.5 ? 10 : -cv * 4; }
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) s -= cardValue(cardInfo(uid)) * 3; // 把最差两张放回牌库顶
      if (cs.length >= 2 && cardValue(cardInfo(cs[0])) >= cardValue(cardInfo(cs[1]))) s += 0.5;
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择（discard / selectScrap / targetDiscard / eventChoice） ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard':       // 我是弃牌者：弃掉手里最差的一张
        return -cardValue(cardInfo(a.cardId)) * 10;
      case 'selectScrap':   // 强制销毁：优先永久压掉初始牌以压缩牌组
        return 200 - cardValue(cardInfo(a.cardId)) * 10 + (isStarter(cardInfo(a.cardId)) ? 500 : 0);
      case 'targetDiscard': { // 我是施动者：挑手牌多/威胁大的对手弃牌
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
      case 'transfer': // 回合末清零的余量，优先一次预留较大额度给队友
        return OFF.transfer + num(a.amount, 0) * 2;

      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const d = cardInfo(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(d && d.defense, 1);
          const destroyed = (dmg + amt) >= def;
          const outpost = !!(d && d.outpost);
          if (destroyed) {
            const cv = cardValue(d) * 0.6;
            if (outpost) return OFF.outpost + 40000 * guard + amt * 3 + cv;
            return OFF.destroyBase + amt * 3 + cv;
          }
          return OFF.chipBase + amt * 2 + (outpost ? 40 : 0);
        }
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = OFF.playerAtk + amt * (6 + 20 * aggro);
        s += (startAuth - auth) * 0.5;
        if (auth <= minAtkAuth + 1) s += 40; // 聚焦最弱/最接近出局者
        return s;
      }

      case 'play': {
        const d = cardInfo(a.cardId) || {};
        let s = OFF.play + cardValue(d) * 1.5;
        if (a.copy) s += copySynergy(a);                                    // 复制接链
        if (a.row !== undefined) s += cardValue(cardInfo(tradeRow[a.row])) * 1.2; // 免费获得
        if (a.choice !== undefined) s += 3;
        if (hasColony) {
          const fs = factionsOf(d);
          let overlap = 0;
          for (const f of fs) overlap += (inPlayFactionCount[f] || 0);
          s += 6000 + overlap * 9000;                                      // 同盟链：同阵营越厚越优先打
          for (const f of fs) if (!primedFactions.has(f) && neededFactions.has(f)) s += 22000; // 铺阵营，为入手牌购买做准备
          if (toHandFaction(d) || me.nextAcquireToHand) s += 9000;          // 刚入手的强牌，本回合立刻打
          if (commandActive && (d.faction === 'empire' || fs.includes('empire')) && d.type === 'ship') s += 11000; // 指挥中心供能
          if (isCopyBaseCard(d) && a.copy) s += 14000;                      // copyBase：复制一座能接链的基地
          if (a.row !== undefined) {                                        // primaryChoice 的免费获得（Parasite）
            const rd = cardInfo(tradeRow[a.row]);
            const forceHand = (rd && toHandFaction(rd) && primedFactions.has(toHandFaction(rd))) ||
              !!me.nextAcquireToHand || !!me.topDeckNextAny;
            s += 4000 + cardValue(rd) * 6 + (forceHand ? 12000 : 0);
          }
        }
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
        if (hasRow) val += 70;        // 销毁交易行 / 免费获得
        if (hasTargetId) val += 110;  // 摧毁敌方基地
        if (a.resource) val += 6;
        if (targets && targets.length) val += targetQuality(targets);
        if (emptyTargets && !hasRow && !hasTargetId && a.choice === undefined) return OFF.noop;
        if (emptyTargets) val -= 300;
        if (a.choice !== undefined) val += 3;
        if (a.ability === 'scrap') val -= cardValue(cardInfo(a.cardId)) * 0.35; // 销毁自身会失去这张牌
        if (hasColony) {
          const srcText = (cardInfo(a.cardId) || {}).text || '';
          if (a.ability === 'ally') {
            val += 9000; // 同盟链本就是殖民战争核心，优先触发
            if (a.row !== undefined && /免费获得/.test(srcText)) {
              const rd = cardInfo(tradeRow[a.row]);
              const forceHand = /置入手牌/.test(srcText) || !!me.nextAcquireToHand ||
                (rd && toHandFaction(rd) && primedFactions.has(toHandFaction(rd)));
              val += 16000 + cardValue(rd) * 16 + (forceHand ? 34000 : 0); // 免费获得；入手牌则当回合可打
            } else if (a.row !== undefined) {
              val += 3000; // 同盟销毁交易行
            }
            if (a.targetId) val += 4000; // 同盟摧毁基地
          }
          if (Array.isArray(a.rows) && a.rows.length) { // 销毁交易行：清掉自己买不到的强牌
            for (const r of a.rows) val += cardValue(cardInfo(tradeRow[r])) * 2;
          }
        }
        return base + val;
      }

      case 'buy': {
        if (a.explorer) return OFF.buy - 30; // 探索者：低优先经济填充
        const d = cardInfo(tradeRow[a.row]);
        if (!d) return OFF.buy - 60;
        let s = OFF.buy + cardValue(d) * 14;
        const fs = factionsOf(d);
        for (const f of fs) if (inPlayFactionCount[f] || primedFactions.has(f)) s += 12; // 同盟潜力（通用）
        if (hasColony) {
          const th = toHandFaction(d);
          const primed = th && primedFactions.has(th);
          const goesHand = !!primed || !!me.nextAcquireToHand; // 获得即入手牌
          const topDeck = !!me.topDeckNextAny || (d.type === 'ship' && !!me.topDeckNextShip);
          if (goesHand) s += 55000 + cardValue(d) * 36;        // 本回合即可打出、立刻并入同盟链
          else if (topDeck) s += 11000 + cardValue(d) * 8;     // 下回合上手，仍优先
          if (th && !primed) s += 7000;                         // 是入手牌卡：待铺好同阵营再买
          for (const f of fs) if (inPlayFactionCount[f] || primedFactions.has(f)) s += 3500;
          if (commandActive && (d.faction === 'empire' || fs.includes('empire')) && d.type === 'ship') s += 10000; // 为指挥中心供能
          if (isCommandCenter(d)) s += 14000;                  // 指挥中心本身是核心引擎
        }
        return s;
      }

      default:
        return OFF.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  // ---------- 统一择优：始终返回 legalActions 中的原始对象，绝不修改输入 ----------
  const PENDING = new Set(['discard', 'selectScrap', 'targetDiscard', 'eventChoice']);
  const usePending = !!v.pending || actions.some(a => a && PENDING.has(a.type));
  const scoreFn = usePending ? pendingScore : mainScore;

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
