// ============================================================================
// 殖民战争 · step5preview
// 执行模型 ID：step-5-preview（显示名 step5preview）
//
// 策略主题：殖民战争 —— 把「购买」变成「即买即用」的扩张闭环。
//
// 引擎内与主题相关的四类机制（全部通过 view.cards[].text 等公开字段只读识别，
// 不依赖引擎内部字段、不硬编码内部 id）：
//   1) 获得即入手牌：警戒信标/殖民播种舰/等离子喷口/皇帝无畏舰 的
//      「若本回合打出过 X 牌，获得时可置入手牌」，以及工厂世界主要能力
//      带来的下一张置入手牌。买到且本回合已铺过同阵营 → 直接进手牌 →
//      当回合打出 → 立即并入同盟链。
//   2) 免费获得：寄生体「免费获得一张费用不高于 6 的牌」、月蚀巨虫/利维坦
//      同盟「免费获得一张牌并置入手牌」、虫群母舰同盟「免费获得一艘飞船
//      并置于牌库顶」。
//   3) 复制接链：隐匿尖塔 copyBase（复制任意基地并额外获得其阵营）、
//      隐匿针舰 copyShip（复制本回合打出的飞船并获得其阵营）。
//   4) Command Center：在场时每打出一艘星际帝国飞船额外 +2 战斗，
//      因此帝国飞船的打出/购买都获得加权。
//
// 结构：双层打分。
//   通用估值层 —— lethal、拆前哨、出牌、同盟、购买、削血、2V2 预留、
//                 待决选择、未知动作兜底。任何模式/扩展组合下都成立。
//   殖民加权层 —— 仅在检测到 colonyWars 扩展时叠加：铺阵营点火、入手牌
//                 购买、免费获得且入手、复制接链、指挥中心供能。
//   纯 core 对局时加权层自动关闭，等价于通用估值。
//
// 安全约束：零依赖（不加载任何外部模块）；只读 view/legalActions 及其子对象，
// 不 sort/不改写输入数组；始终原样返回 legalActions 中的元素；全部循环有界、
// 逐动作 try/catch 兜底，绝不抛异常或死循环。
// ============================================================================

export const meta = {
  name: '殖民战争 · step5preview',
  description: '殖民战争（step-5-preview）：识别「获得即入手牌、免费获得、copyBase/copyShip 复制接链、Command Center 供能」四类殖民机制，优先铺阵营点火，让新购强牌当回合打出并接入同盟链；无 colonyWars 时回退通用估值。兼容 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合，安全处理全部待决动作与未知动作。'
};

// ---------- 安全基础工具 ----------
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// 从中文卡面文本汇总数字，例如 /(\d+)\s*贸易/g 汇总所有贸易点
const sumNums = (text, re) => {
  let sum = 0;
  for (const m of String(text).matchAll(re)) sum += Number(m[1]) || 0;
  return sum;
};

// ---------- 阵营与机制识别（纯文本，零依赖） ----------
// 卡面阵营词 → 引擎阵营 id（仅用于解析文本，不读引擎内部枚举）
const FACTION_WORD = {
  '机械教团': 'machine',
  '贸易联邦': 'federation',
  '虫群': 'blob',
  '星际帝国': 'empire'
};

const factionsOf = def => {
  if (!def) return [];
  if (Array.isArray(def.factions) && def.factions.length) return def.factions;
  const f = def.faction;
  return (f && f !== 'neutral') ? [f] : [];
};

const isStarter = def => !!def && (def.id === 'scout' || def.id === 'viper' ||
  def.name === '侦察艇' || def.name === '毒蛇战机' || def.en === 'Scout' || def.en === 'Viper');
const isExplorer = def => !!def && (def.id === 'explorer' ||
  def.name === '探索者' || def.en === 'Explorer');

// 「若本回合打出过 X 牌，获得时可置入手牌」→ 返回需要点火的阵营；否则 null。
// 覆盖警戒信标/殖民播种舰/等离子喷口/皇帝无畏舰四张入手牌。
const acquireToHandFaction = def => {
  if (!def) return null;
  const t = def.text || '';
  if (t.indexOf('置入手牌') < 0) return null;
  if (t.indexOf('本回合打出过') < 0 && t.indexOf('获得时可置入手牌') < 0) return null;
  for (const key in FACTION_WORD) {
    if (t.indexOf(key) >= 0) return FACTION_WORD[key];
  }
  return def.faction || null;
};

// 指挥中心：在场时每打出一艘星际帝国飞船额外获得战斗
const isCommandCenter = def => !!def &&
  /每打出/.test(def.text || '') && /星际帝国飞船/.test(def.text || '');

// 隐匿尖塔：复制场上任意一座基地，并额外获得其阵营
const isCopyBase = def => !!def && /复制/.test(def.text || '') && /基地/.test(def.text || '');
// 隐匿针舰：复制本回合打出的另一艘飞船，并获得其阵营
const isCopyShip = def => !!def && /复制/.test(def.text || '') && /飞船/.test(def.text || '');
// 「免费获得」类效果（寄生体主要选择、月蚀巨虫/利维坦/虫群母舰同盟）
const hasFreeAcquire = def => !!def && /免费获得/.test(def.text || '');
// 「置入手牌/置于牌库顶」类的下一张获得修饰
const hasAcquireModifier = def => !!def &&
  (/下一张获得/.test(def.text || '') || /置于牌库顶/.test(def.text || ''));

// 扩展检测：优先 view.expansions，缺失时扫描可见卡牌的 set 字段兜底
function detectColonyWars(v) {
  const ex = v && v.expansions;
  if (ex && typeof ex === 'object') {
    if (ex.colonyWars) return true;
    if (Array.isArray(ex.sets) && ex.sets.indexOf('colonyWars') >= 0) return true;
  }
  const cs = (v && v.cards) || {};
  for (const uid in cs) {
    if (cs[uid] && cs[uid].set === 'colonyWars') return true;
  }
  return false;
}

// ---------- 卡面画像与通用估值（纯文本启发式，无扩展同样可用） ----------
function profile(def) {
  const t = (def && def.text) || '';
  const m = t.match(/目标对手弃\s*(\d+)\s*张/);
  return {
    trade: sumNums(t, /(\d+)\s*贸易/g),
    combat: sumNums(t, /(\d+)\s*战斗/g),
    authority: sumNums(t, /(\d+)\s*权威/g),
    draw: sumNums(t, /抽\s*(\d+)\s*张/g),
    drawWord: t.indexOf('抽') >= 0,
    discardOpp: m ? (Number(m[1]) || 1) : (t.indexOf('目标对手弃') >= 0 ? 1 : 0),
    ally: t.indexOf('同盟') >= 0,
    scrap: t.indexOf('销毁') >= 0,
    destroyBase: t.indexOf('摧毁') >= 0,
    freeAcquire: t.indexOf('免费获得') >= 0
  };
}

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0]; // 无合法动作时无可返回（引擎不会出现）

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num((context && context.turn) || v.turn, 1);
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myTeam = me.team;
  const myAuth = num(me.authority, startAuth);
  const myTrade = num(me.trade, 0);
  const tradeRow = Array.isArray(v.tradeRow) ? v.tradeRow : [];
  const damageMap = v.damage || {};
  const hasColony = detectColonyWars(v);

  const cardInfo = uid => (uid != null && cards[uid]) || null;

  // ---------- 攻防倾向：血量差 + 回合数推进，带记忆平滑 ----------
  const enemies = players.filter((p, i) => p && i !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const enemyAuths = enemies.map(p => num(p.authority, startAuth));
  const avgEnemy = enemyAuths.length
    ? enemyAuths.reduce((a, b) => a + b, 0) / enemyAuths.length
    : startAuth;
  let aggro = clamp(0.5 + (myAuth - avgEnemy) / 45, 0.15, 0.85);
  aggro = clamp(aggro + clamp((turn - 6) / 30, 0, 0.25), 0.1, 0.9);
  if (memory && typeof memory === 'object') {
    try {
      aggro = clamp(0.7 * num(memory.aggro, aggro) + 0.3 * aggro, 0.1, 0.9);
      memory.aggro = aggro;
      memory.calls = num(memory.calls, 0) + 1;
    } catch (err) { /* 记忆对象被冻结时忽略 */ }
  }
  const guard = 1 - aggro;          // 防守倾向（落后时升高）
  const authW = 1 + 2 * guard;      // 权威损失权重（落后时更惜血）

  // ---------- 通用卡牌估值（带本次决策内缓存） ----------
  const valueCache = new Map();
  const cardValue = def => {
    if (!def) return 1;
    if (def.id === 'scout' || def.name === '侦察艇' || def.en === 'Scout') return 1.0 + 0.7 * guard;
    if (def.id === 'viper' || def.name === '毒蛇战机' || def.en === 'Viper') return 1.2 + 0.8 * aggro;
    if (isExplorer(def)) return 2.2 + 0.6 * guard;
    const e = profile(def);
    const cost = num(def.cost, 3);
    let val = 2.5;
    val += e.trade * (1.0 + 0.5 * guard);
    val += e.draw * 2.8 + (e.drawWord ? 1.5 : 0);
    val += e.authority * (1.0 + 1.5 * guard);
    val += e.combat * (0.7 + 1.1 * aggro);
    val += e.discardOpp * 2.4;
    if (def.outpost) val += 2.5 + 3 * guard;
    else if (def.type === 'base') val += 1.5 + 1.5 * guard;
    if (e.ally) val += 2.2;
    if (e.scrap) val += 1.2;
    if (e.destroyBase) val += 1.8;
    if (e.freeAcquire) val += 2.5;
    const fs = factionsOf(def);
    if (fs.length) val += 0.4;
    val *= 1 - clamp(cost, 1, 8) * 0.02;
    return val;
  };
  const valueOf = uid => {
    if (uid == null) return 1;
    if (valueCache.has(uid)) return valueCache.get(uid);
    const val = cardValue(cardInfo(uid));
    valueCache.set(uid, val);
    return val;
  };

  // 本回合能否打得出一张牌（费用够即视为可立即发挥作用）
  const canAfford = def => {
    if (!def) return false;
    const cost = def.cost;
    return typeof cost === 'number' && cost <= myTrade;
  };

  // ---------- 殖民战争上下文（只读推导） ----------
  // 本回合已打出的阵营：决定入手牌购买能否「即买即打」
  const primedFactions = new Set();
  const playedThisTurn = Array.isArray(me.playedThisTurn) ? me.playedThisTurn : [];
  for (const uid of playedThisTurn) {
    for (const f of factionsOf(cardInfo(uid))) primedFactions.add(f);
  }
  // 我方场上各阵营牌数：同盟链厚度
  const inPlayFactionCount = {};
  const myInPlay = Array.isArray(me.inPlay) ? me.inPlay : [];
  for (const uid of myInPlay) {
    for (const f of factionsOf(cardInfo(uid))) inPlayFactionCount[f] = (inPlayFactionCount[f] || 0) + 1;
  }
  // 指挥中心是否已在场（帝国飞船加成交付）
  const commandActive = myInPlay.some(uid => isCommandCenter(cardInfo(uid)));
  // 下一张获得将入手牌/置牌库顶的标记（工厂世界、联邦船坞、中央总署、货运舰等）
  const nextToHand = !!me.nextAcquireToHand;
  const nextTopAny = !!me.topDeckNextAny;
  const nextTopShip = !!me.topDeckNextShip;
  // 买得起但尚未点火的入手牌卡所需阵营：铺阵营（点火）的明确目标
  const neededFactions = new Set();
  for (let row = 0; row < tradeRow.length; row++) {
    const d = cardInfo(tradeRow[row]);
    const need = acquireToHandFaction(d);
    if (need && need !== 'any' && !primedFactions.has(need) && canAfford(d)) {
      neededFactions.add(need);
    }
  }

  // 弃牌/销毁自有牌的质量：优先压掉初始牌，别毁掉好牌
  const targetQuality = targets => {
    let q = 0;
    for (const uid of (Array.isArray(targets) ? targets : [])) {
      const d = cardInfo(uid);
      if (isStarter(d)) q += 25;
      else {
        const cv = valueOf(uid);
        q += cv <= 3.5 ? 6 : -cv * 2;
      }
    }
    return q;
  };

  // 复制目标的价值：被复制牌的强度 + 与我方同盟链的契合度 + 前哨附加值
  const copySynergy = copyUid => {
    const cd = cardInfo(copyUid);
    if (!cd) return 0;
    let s = valueOf(copyUid) * 0.15 + 6;
    for (const f of factionsOf(cd)) s += 20 * (inPlayFactionCount[f] || 0);
    if (cd.outpost) s += 15;
    return s;
  };

  // 可攻击玩家目标中的最低权威（自动适配 hunter/firstBlood/ffa/team2v2 合法目标）
  const atkTargets = actions.filter(a => a && a.type === 'attack' && a.targetType === 'player')
    .map(a => a.targetId);
  const minAtkAuth = atkTargets.length
    ? Math.min(...atkTargets.map(id => num((players[id] || {}).authority, startAuth)))
    : startAuth;

  // ---------- 优先级梯队（大间隔保证稳定次序，梯队内增益不越界） ----------
  const T = {
    outpostBreak: 1000000,  // 攻击将摧毁敌方前哨（解开打脸封锁）
    play: 800000,           // 打出（含入手牌、复制、免费获得选择）
    ally: 700000,           // 同盟能力
    primary: 620000,        // 主要能力
    optional: 600000,       // 可选能力
    baseBreak: 560000,      // 攻击将摧毁普通敌方基地
    scrap: 540000,          // 销毁能力
    buy: 460000,            // 购买
    playerAtk: 200000,      // 对玩家削血
    chipBase: 140000,       // 攻击基地但不足以摧毁
    transfer: 100000,       // 2V2 预留资源给队友
    unknown: 20000,         // 未知动作安全兜底
    endTurn: -1000000,
    noop: -1100000          // 空操作（弃 0 张换 0 收益之类），排在结束回合之后
  };

  // ---------- lethal：一击致胜，绝对优先（引擎已按模式过滤合法目标） ----------
  for (const a of actions) {
    if (a && a.type === 'attack' && a.targetType === 'player' &&
      num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity)) {
      return a;
    }
  }

  // ---------- 事件待决估值 ----------
  const eventScore = a => {
    const ev = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    if (ev === 'blackHole') {
      // 每少弃一张失去 4 权威（不低于 1）；弃掉的牌只是进弃牌堆，可回收
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const authLoss = Math.min(4 * (2 - targets.length), Math.max(0, myAuth - 1));
      let cardLoss = 0;
      for (const uid of targets) cardLoss += valueOf(uid);
      return -(authLoss * authW + cardLoss * 0.4);
    }
    if (ev === 'bombardment') {
      // 摧毁一座己方基地（进弃牌堆可回收）或失去 6 权威
      if (a.pay) return -Math.min(6, Math.max(0, myAuth - 1)) * authW;
      if (a.baseId) {
        const d = cardInfo(a.baseId);
        return -(valueOf(a.baseId) * 0.35 + (d && d.outpost ? 2.5 * guard : 0));
      }
      return -1;
    }
    if (ev === 'comet') {
      // 永久销毁至多两张：初始牌是纯压缩收益，好牌别毁
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let benefit = 0;
      const handSet = new Set(Array.isArray(me.hand) ? me.hand : []);
      for (const uid of targets) {
        if (isStarter(cardInfo(uid))) benefit += 40;
        else benefit -= valueOf(uid) * (handSet.has(uid) ? 1.2 : 1.0);
      }
      return benefit;
    }
    if (ev === 'warpJump') {
      // 抽 3 选 2 按序放回牌库顶：优先放回本回合用不上、价值低的牌
      const cs = Array.isArray(a.cards) ? a.cards : [];
      let s = 0;
      for (const uid of cs) {
        const d = cardInfo(uid);
        const cv = valueOf(uid);
        s -= canAfford(d) ? cv : cv * 0.3;
      }
      if (cs.length >= 2 && valueOf(cs[0]) >= valueOf(cs[1])) s += 0.05; // 好牌放更上面先摸
      return s;
    }
    return 0; // 未知事件：中性兜底
  };

  // ---------- 待决选择（discard / selectScrap / targetDiscard / eventChoice） ----------
  const pendingScore = a => {
    if (!a || typeof a !== 'object') return 0;
    switch (a.type) {
      case 'discard': {
        // 被迫弃牌：弃掉本回合最用不上的一张（初始牌与高费未启动牌优先）
        const d = cardInfo(a.cardId);
        const cv = valueOf(a.cardId);
        return -(canAfford(d) ? cv : cv * 0.35) * 10;
      }
      case 'selectScrap': {
        // 被迫永久销毁一张手牌：优先初始牌
        const d = cardInfo(a.cardId);
        if (isStarter(d)) return 40;
        return 10 - valueOf(a.cardId) * 4;
      }
      case 'targetDiscard': {
        // 我是施动者：挑手牌多、威胁大、血最少的对手
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, Array.isArray(t.hand) ? t.hand.length : 0);
        const threat = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
        return 50 + hc * 6 + threat * 2 + (startAuth - auth) * 0.5;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0; // 未知待决动作：中性兜底
    }
  };

  // ---------- 主阶段动作 ----------
  const mainScore = a => {
    if (!a || typeof a !== 'object') return T.unknown;
    switch (a.type) {
      case 'endTurn':
        return T.endTurn;

      case 'transfer': {
        // 回合末清零的余量：优先把贸易留给队友（他可能买得起我买不起的牌）
        const tm = players[a.targetId] || {};
        let s = T.transfer + num(a.amount, 0) * 2 + (a.resource === 'trade' ? 3 : 0);
        const hasRealBuy = actions.some(x => x && x.type === 'buy' && !x.explorer);
        if (!hasRealBuy && a.resource === 'trade') {
          const tmTrade = num(tm.trade, 0) + num(a.amount, 0);
          for (let r = 0; r < tradeRow.length; r++) {
            const d = cardInfo(tradeRow[r]);
            if (d && num(d.cost, 99) <= tmTrade && valueOf(tradeRow[r]) > 6) { s += 25000; break; }
          }
        }
        return s;
      }

      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const d = cardInfo(a.targetId);
          const dmg = num(damageMap[a.targetId], 0);
          const defense = num(d && d.defense, 1);
          const destroyed = (dmg + amt) >= defense;
          const cv = valueOf(a.targetId) * 0.6;
          if (destroyed) {
            if (d && d.outpost) return T.outpostBreak + 40000 * guard + amt * 3 + cv;
            return T.baseBreak + amt * 3 + cv;
          }
          return T.chipBase + amt * 2 + (d && d.outpost ? 30 : 0);
        }
        // 攻击玩家：聚焦最弱/最接近出局者
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        let s = T.playerAtk + amt * (6 + 20 * aggro) + (startAuth - auth) * 0.5;
        if (auth <= minAtkAuth + 1) s += 40;
        return s;
      }

      case 'play': {
        const d = cardInfo(a.cardId) || {};
        let s = T.play + valueOf(a.cardId) * 1.5;
        if (a.copy) s += copySynergy(a.copy);                                      // 复制接链
        if (a.row !== undefined) {                                                 // 免费获得选择（如寄生体）
          const rd = cardInfo(tradeRow[a.row]);
          const goesHand = (acquireToHandFaction(rd) && primedFactions.has(acquireToHandFaction(rd))) || nextToHand;
          s += 4000 + valueOf(tradeRow[a.row]) * 6 + (goesHand ? 12000 : 0);
        }
        if (a.choice !== undefined) s += 2;
        if (hasColony) {
          const fs = factionsOf(d);
          let overlap = 0;
          for (const f of fs) overlap += (inPlayFactionCount[f] || 0);
          s += 6000 + overlap * 3000;                                              // 同盟链：同阵营越厚越优先打
          let primes = false;
          for (const f of fs) if (neededFactions.has(f)) primes = true;
          if (primes) s += 25000;                                                  // 铺阵营点火：让入手牌购买即买即打
          if (acquireToHandFaction(d)) s += 6000;                                  // 入手牌是即战力，优先打出去
          if (commandActive && fs.indexOf('empire') >= 0 && d.type === 'ship') s += 12000; // 指挥中心供能
          if (a.copy && (isCopyBase(d) || isCopyShip(d))) s += 15000;              // 复制接链核心
        }
        return s;
      }

      case 'ability': {
        const kindTier = { ally: T.ally, primary: T.primary, optional: T.optional, scrap: T.scrap };
        const tier = kindTier[a.ability];
        const base = tier === undefined ? T.unknown : tier;
        const targets = Array.isArray(a.targets) ? a.targets : null;
        const emptyTargets = targets !== null && targets.length === 0;
        const rows = Array.isArray(a.rows) ? a.rows : null;
        const hasRow = a.row !== undefined || (rows !== null && rows.length > 0);
        const hasTargetId = a.targetId !== undefined && a.targetId !== null;
        let val = 0;
        if (a.row !== undefined) {
          const rd = cardInfo(tradeRow[a.row]);
          if (a.ability === 'ally' && rd) {
            val += 60000 + valueOf(tradeRow[a.row]) * 20;                          // 同盟免费获得
            if (/置入手牌/.test((cardInfo(a.cardId) || {}).text || '')) val += 40000; // 免费获得且立即入手
          } else if (rd) {
            val += 3000 + valueOf(tradeRow[a.row]) * 2;                            // 同盟/可选销毁交易行
          }
        }
        if (rows) {
          for (const r of rows) val += valueOf(tradeRow[r]) * 2;                   // 销毁交易行至多两张
        }
        if (hasTargetId) {
          const td = cardInfo(a.targetId);
          val += 5000 + valueOf(a.targetId) * 0.5 + (td && td.outpost ? 3000 : 0); // 摧毁敌方基地
        }
        if (targets && targets.length) val += targetQuality(targets);              // 弃/销目标的质量
        if (emptyTargets) val -= 400;                                              // 空目标≈空转
        if (a.choice !== undefined) val += 2;
        if (a.resource) val += 3;
        if (a.ability === 'scrap') val -= valueOf(a.cardId) * 0.35;                // 销毁自身会失去这张牌
        if (hasColony) {
          const srcText = (cardInfo(a.cardId) || {}).text || '';
          if (a.ability === 'ally') {
            val += 8000;                                                           // 同盟链是殖民战争核心
            if (hasTargetId) val += 8000;
          }
          if (a.ability === 'primary' && hasAcquireModifier(cardInfo(a.cardId))) {
            // 工厂世界（下一张置入手牌）/ 联邦船坞、中央总署、货运舰（置牌库顶）
            val += /下一张获得/.test(srcText) && /置入手牌/.test(srcText) ? 25000 : 8000;
          }
          if (a.ability === 'optional' && /免费获得/.test(srcText)) val += 5000;
        }
        return base + val;
      }

      case 'buy': {
        if (a.explorer) return T.buy - 40; // 探索者：低价经济填充，低于一切真实购买
        const d = cardInfo(tradeRow[a.row]);
        if (!d) return T.buy - 60;
        let s = T.buy + valueOf(tradeRow[a.row]) * 14;
        const fs = factionsOf(d);
        for (const f of fs) {
          if (inPlayFactionCount[f] || primedFactions.has(f)) s += 10;             // 同盟潜力（通用）
        }
        if (hasColony) {
          const need = acquireToHandFaction(d);
          const primed = need && need !== 'any' && primedFactions.has(need);
          const goesHand = !!primed || nextToHand;                                 // 获得即入手牌
          const topDeck = nextTopAny || (d.type === 'ship' && nextTopShip);
          if (goesHand) s += 55000 + valueOf(tradeRow[a.row]) * 30;                // 本回合即可打出、立刻并入同盟链
          else if (topDeck) s += 10000 + valueOf(tradeRow[a.row]) * 8;             // 下回合置顶上手
          if (need && !primed) s += 6000;                                          // 入手牌卡但未点火：仍值得买
          for (const f of fs) {
            if (inPlayFactionCount[f] || primedFactions.has(f)) s += 3500;
          }
          if (commandActive && fs.indexOf('empire') >= 0 && d.type === 'ship') s += 9000; // 为指挥中心供能
          if (isCommandCenter(d)) s += 15000;                                      // 指挥中心本身是核心引擎
          if (isCopyBase(d) || isCopyShip(d)) s += 8000;                           // 复制接链潜力
          if (hasFreeAcquire(d)) s += 4000;
        }
        return s;
      }

      default:
        return T.unknown; // 未知动作：安全兜底，仍返回合法动作
    }
  };

  // ---------- 统一择优：始终原样返回 legalActions 中的对象 ----------
  const PENDING_TYPES = new Set(['discard', 'selectScrap', 'targetDiscard', 'eventChoice']);
  const isPending = !!v.pending || actions.some(a => a && PENDING_TYPES.has(a.type));
  const scoreFn = isPending ? pendingScore : mainScore;

  let best = actions[0];
  let bestVal = -Infinity;
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    let s = 0;
    try { s = scoreFn(a); } catch (err) { s = 0; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd(); // 极小抖动，仅用于打破完全平分
    if (s > bestVal) { bestVal = s; best = a; }
  }
  return best;
}
