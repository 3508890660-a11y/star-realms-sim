// MiniMax M3 · 贸易滚雪球（模型 ID：minimax-m3-pay）
// ---------------------------------------------------------------------------
// 设计要点（详见 subagent-progress/minimaxm3.md）：
//   1. 贸易是「投资货币」：本回合的贸易会清零，但贸易换来的牌会进入牌库循环，
//      基地（base）永久留在场上且每回合都能再次发动主要能力 —— 这才是真正的复利。
//   2. 因此按「剩余回合数」建立经济曲线：
//      前期（压缩+播种）→ 中期（加厚永久引擎、买高费牌）→ 后期（兑现为战斗与权威）。
//   3. 权威即生命：事件里宁可少弃牌也要保命；战斗在对手无前哨时才是有效伤害。
//
// 约束：
//   - 零依赖：单文件自包含，不引入任何外部模块。
//   - 只读 view / legalActions / context（均为深冻结对象），仅写本座位私有 memory。
//   - 始终原样返回 legalActions 中的某一个对象引用。
//   - 任何未知动作类型都安全兜底；不抛异常、不死循环、不修改冻结对象。

export const meta = {
  name: 'MiniMax M3 · 贸易滚雪球',
  description:
    'minimax-m3-pay · 贸易滚雪球：把贸易当作投资货币，按剩余回合数建立经济曲线 —— 前期压缩废牌并播种贸易引擎，中期用高费牌加厚永久基地，后期把经济兑现为战斗与权威直伤；对手前哨未拆则先拆前哨解锁直伤。全模式、全牌包、全部待决与未知动作均安全兜底。'
};

// ===========================================================================
// 一、通用小工具
// ===========================================================================

const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
const NUM_TOK = '[\\d一二两三四五六七八九十]+';

const numTok = (tok) => (/^\d+$/.test(tok) ? Number(tok) : (CN_NUM[tok] || 0));

/** 统计文本中「N 贸易 / N 战斗 / N 权威」之和。 */
function sumUnit(text, unit) {
  if (!text) return 0;
  const re = new RegExp('(' + NUM_TOK + ')\\s*' + unit, 'g');
  let total = 0;
  let m;
  while ((m = re.exec(text)) !== null) total += numTok(m[1]);
  return total;
}

/** 统计文本中「抽 N 张」的次数之和。 */
function sumDraw(text) {
  if (!text) return 0;
  const re = new RegExp('抽\\s*(' + NUM_TOK + ')\\s*张', 'g');
  let total = 0;
  let m;
  while ((m = re.exec(text)) !== null) total += numTok(m[1]);
  return total;
}

// ===========================================================================
// 二、规则文本解析（不依赖引擎内部数据，仅用 view.cards 暴露的 text）
// ===========================================================================

const blankEff = () => ({ trade: 0, combat: 0, auth: 0, draw: 0 });
const blankFlags = () => ({
  free: false,      // 免费获得
  top: false,       // 置于牌库顶
  toHand: false,    // 置入手牌
  destroyBase: false,
  scrapRow: false,
  scrapOwn: false,
  toHandIfFaction: false,
  conditional: false,
  outOfTurn: false  // 回合结束前才生效（隐匿尖塔一类）
});

  const addEff = (target, src) => {
    target.trade += src.trade;
    target.combat += src.combat;
    target.auth += src.auth;
    target.draw += src.draw;
    return target;
  };

function addFlags(target, src) {
  for (const key of Object.keys(src)) if (src[key]) target[key] = true;
  return target;
}

/** 解析一个句子段，得到数值效果与关键词标记。 */
function parseSegment(seg) {
  const eff = blankEff();
  const flags = blankFlags();
  eff.trade = sumUnit(seg, '贸易');
  eff.combat = sumUnit(seg, '战斗');
  eff.auth = sumUnit(seg, '权威');
  eff.draw = sumDraw(seg);
  if (/免费获得/.test(seg)) flags.free = true;
  if (/置于牌库顶|置入牌库顶/.test(seg)) flags.top = true;
  if (/置入手牌/.test(seg)) flags.toHand = true;
  if (/摧毁(?:目标|一座|任意)?(?:己方)?基地|摧毁场上/.test(seg)) flags.destroyBase = true;
  if (/销毁交易行/.test(seg)) flags.scrapRow = true;
  if (/销毁手牌|销毁弃牌堆|弃至多|弃\s*\d+\s*张牌/.test(seg)) flags.scrapOwn = true;
  if (/获得时可置入手牌/.test(seg)) flags.toHandIfFaction = true;
  if (/若|每|至少/.test(seg)) flags.conditional = true;
  if (/本回合结束时前|回合结束前/.test(seg)) flags.outOfTurn = true;
  return { eff, flags };
}

const parseCache = new Map();

/**
 * 解析整张牌的规则文本。
 * 返回 { primary, ally, scrap, options, flags }
 *   primary / ally / scrap —— 合并后的数值效果（对象）
 *   options              —— 「选择：」分支数组，每项为 { eff, flags }
 *   flags                —— 整张牌的关键词标记（并集）
 */
function parseCard(text) {
  const raw = String(text || '');
  if (parseCache.has(raw)) return parseCache.get(raw);

  const result = {
    primary: blankEff(),
    ally: blankEff(),
    scrap: blankEff(),
    options: null,
    flags: blankFlags()
  };

  const segments = raw.split('。').map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    let body = seg;
    let slot = 'primary';
    if (/^同盟[：:]/.test(seg)) { slot = 'ally'; body = seg.replace(/^同盟[：:]\s*/, ''); }
    else if (/^销毁[：:]/.test(seg)) { slot = 'scrap'; body = seg.replace(/^销毁[：:]\s*/, ''); }
    else if (/^选择[：:]/.test(seg)) {
      const body2 = seg.replace(/^选择[：:]\s*/, '');
      const parts = body2.split(/\s*(?:；\s*)?或\s*/).filter(p => p.trim().length);
      result.options = parts.map(p => parseSegment(p));
      for (const opt of result.options) addFlags(result.flags, opt.flags);
      continue;
    }
    const parsed = parseSegment(body);
    addEff(result[slot], parsed.eff);
    addFlags(result.flags, parsed.flags);
  }

  if (parseCache.size > 4000) parseCache.clear();
  parseCache.set(raw, result);
  return result;
}

// ===========================================================================
// 三、动作优先级基准（大间隔分层，保证行为稳定可解释）
// ===========================================================================

const P = {
  pending: 1000000, // 待决强制响应（此时 legalActions 只会包含待决动作）
  outpostBreak: 9000, // 拆掉阻止直伤的敌方前哨
  ally: 8200,          // 同盟能力
  primary: 7600,       // 基地主要能力（贸易引擎的每回合收益）
  play: 7000,          // 打出卡牌
  buy: 6500,           // 购买
  attack: 6000,        // 削血（攻击玩家）
  baseAttack: 5600,    // 攻击基地
  transfer: 5000,      // 2V2 资源预留
  optional: 4200,      // 可选能力
  scrap: 4000,         // 销毁自身能力
  endTurn: 100,
  unknown: 50
};

// 探索者固定收益（核心牌，牌库外永远存在，可直接引用其公开数值）
const EXPLORER = { cost: 2, eff: { trade: 2, combat: 0, auth: 0, draw: 0 }, scrapEff: { trade: 0, combat: 2 } };

/**
 * 选择最优动作：返回 legalActions 中的对象引用（绝不复制、绝不改造）。
 */
export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return { type: 'endTurn' };

  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const ctx = context || {};
  const mode = ctx.mode || v.mode || 'standard';
  const turn = Number(ctx.turn != null ? ctx.turn : v.turn) || 1;
  const mem = memory && typeof memory === 'object' ? memory : {};
  mem.calls = (Number(mem.calls) || 0) + 1;

  const info = (uid) => (uid != null && cards[uid]) || null;
  const effOf = (uid) => {
    const c = info(uid);
    return c ? parseCard(c.text) : null;
  };
  const factionsOf = (uid) => {
    const c = info(uid);
    if (!c) return [];
    if (Array.isArray(c.factions) && c.factions.length) return c.factions;
    if (c.faction && c.faction !== 'neutral') return [c.faction];
    return [];
  };

  // -------------------------------------------------------------------------
  // 局势基线
  // -------------------------------------------------------------------------
  const playerCount = Math.max(2, players.length || (mode === 'team2v2' ? 4 : 2));
  const rounds = Math.max(1, turn / playerCount); // state.turn 按每次结束回合自增
  const roundLimit = mode === 'team2v2' ? 13 : mode === 'standard' ? 12 : 10;
  const horizon = Math.min(12, Math.max(1, roundLimit - rounds)); // 我方剩余回合数
  const invest = Math.max(0, Math.min(1, 1.3 - rounds / (roundLimit * 0.62))); // 前期高、后期归零
  const cash = Math.max(0, Math.min(1, (rounds - roundLimit * 0.45) / (roundLimit * 0.45)));
  const sets = (v.expansions && Array.isArray(v.expansions.sets)) ? v.expansions.sets : [];
  const hasEvents = sets.includes('events');

  const myTeam = me.team != null ? me.team : null;
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated && (myTeam == null || p.team !== myTeam));
  const myAuth = Number(me.authority) || 0;
  const enemyAuth = opponents.length ? Math.min(...opponents.map(p => Number(p.authority) || 0)) : 0;

  // 我方手牌 / 弃牌 / 场上 / 牌库
  const myHand = Array.isArray(me.hand) ? me.hand : [];
  const myDiscard = Array.isArray(me.discard) ? me.discard : [];
  const myInPlay = Array.isArray(me.inPlay) ? me.inPlay : [];
  const deckCount = Number(me.deckCount) || 0;
  const totalCards = Math.max(1, deckCount + myDiscard.length + myHand.length + myInPlay.length);
  const playsPerCard = Math.min(6, (horizon * 5) / totalCards); // 一张牌在剩余回合内的期望被使用次数

  // 阵营协同：我方已有的阵营与本回合已打出的阵营
  const ownFactions = new Set();
  for (const uid of myInPlay.concat(myHand)) for (const f of factionsOf(uid)) ownFactions.add(f);
  const playedFactions = new Set();
  for (const uid of (Array.isArray(me.playedThisTurn) ? me.playedThisTurn : [])) for (const f of factionsOf(uid)) playedFactions.add(f);

  // 我方已建成的永久贸易引擎（场上基地的主要能力）
  let baseIncome = 0;
  for (const uid of myInPlay) {
    const c = info(uid);
    if (!c || c.type !== 'base') continue;
    const p = parseCard(c.text);
    const opt = p.options && p.options.length ? Math.max(...p.options.map(o => o.eff.trade)) : 0;
    baseIncome += Math.max(p.primary.trade, opt);
  }
  const hasOutpost = myInPlay.some(uid => { const c = info(uid); return !!(c && c.outpost); });

  // 单位换算：贸易只在「本回合还有值得买的东西」时才值钱；权威即生命
  const AUTH_UNIT = 2.0;
  const DRAW_UNIT = 3.0;
  const COMBAT_UNIT = 0.95;
  const OUTPOST_DEFENSE = 2.6;

  // -------------------------------------------------------------------------
  // 卡片价值
  // -------------------------------------------------------------------------
  const bodyValue = (eff, tradeUnit) =>
    eff.trade * tradeUnit + eff.combat * COMBAT_UNIT + eff.auth * AUTH_UNIT + eff.draw * DRAW_UNIT;

  /** 条件触发的效果（若…/每…）只按期望的一半计入，避免高估。 */
  const bodyValueCond = (eff, flags, tradeUnit) => {
    const raw = bodyValue(eff, tradeUnit);
    return flags && flags.conditional ? raw * 0.5 : raw;
  };

  /** 同盟潜力：阵营能对上才有价值。 */
  const allyValue = (uid, eff, tradeUnit) => {
    if (!eff) return 0;
    const raw = bodyValue(eff, tradeUnit);
    if (raw <= 0) return 0;
    const fs = factionsOf(uid);
    const synergy = fs.length ? fs.some(f => ownFactions.has(f)) : false;
    const anyFaction = /所有阵营的同盟/.test(String((info(uid) || {}).text || ''));
    const rate = synergy || anyFaction ? 1.1 : 0.45;
    return raw * rate;
  };

  /** 基地的长期引擎价值：每回合可再次发动主要能力。 */
  const engineValue = (uid, tradeUnit) => {
    const c = info(uid);
    if (!c || c.type !== 'base') return 0;
    const p = parseCard(c.text);
    let perTurn = p.primary.trade * tradeUnit + p.primary.auth * AUTH_UNIT + p.primary.draw * DRAW_UNIT * 0.6;
    if (p.options && p.options.length) {
      for (const opt of p.options) {
        perTurn = Math.max(perTurn, opt.eff.trade * tradeUnit + opt.eff.auth * AUTH_UNIT + opt.eff.draw * DRAW_UNIT * 0.6);
      }
    }
    return perTurn * Math.min(horizon, 8) * invest * 0.55;
  };

  /** 整张牌（含获取节奏、前哨、同盟）的综合价值。 */
  const cardValue = (uid, tradeUnit) => {
    const c = info(uid);
    if (!c) return 0;
    const p = parseCard(c.text);
    const eff = p.primary;
    let val = bodyValueCond(eff, p.flags, tradeUnit);
    if (c.type === 'base') val += engineValue(uid, tradeUnit);
    else val += bodyValueCond(eff, p.flags, tradeUnit) * (playsPerCard - 1) * 0.55; // 飞船会回到牌库循环
    val += allyValue(uid, p.ally, tradeUnit);
    if (p.flags.free) val += 2.4;
    if (p.flags.top) val += 1.0;
    if (p.flags.toHand) val += 1.4;
    if (p.flags.toHandIfFaction && playedFactions.size) {
      const text = String(c.text || '');
      const names = { blob: '虫群', machine: '机械教团', empire: '星际帝国', federation: '贸易联邦' };
      const hit = Object.keys(names).some(f => playedFactions.has(f) && text.includes(names[f]));
      if (hit) val += 3.2; // 买入即入手牌，本回合就能再打出
    }
    if (c.outpost) {
      val += hasOutpost ? OUTPOST_DEFENSE * 0.4 : OUTPOST_DEFENSE;
      if (c.type === 'base' && (p.primary.trade > 0 || (p.options || []).some(o => o.eff.trade > 0))) val += 1.6;
    }
    if (p.flags.destroyBase) val += 1.8 + 2.2 * cash;
    if (p.flags.scrapOwn && !c.outpost) val += 0.5;
    return val;
  };

  // -------------------------------------------------------------------------
  // 购买候选（先粗算，用 provisional 贸易单价；再据此确定真实贸易单价）
  // -------------------------------------------------------------------------
  const buyTargets = [];
  for (const a of actions) {
    if (!a || a.type !== 'buy') continue;
    if (a.explorer) {
      const value = EXPLORER.eff.trade * 1.0 * (playsPerCard * 0.55 + 0.3) + 1.4;
      buyTargets.push({ action: a, cost: EXPLORER.cost, value: value, label: '探索者' });
      continue;
    }
    const uid = (v.tradeRow || [])[a.row];
    const c = info(uid);
    if (!c) continue;
    const cost = Number(c.cost);
    if (!Number.isFinite(cost)) continue;
    buyTargets.push({ action: a, cost: cost, value: cardValue(uid, 1.0), label: c.name || '', uid });
  }
  const provisional = buyTargets.length
    ? Math.max(...buyTargets.map(t => (t.value - t.cost) / Math.max(1, t.cost)))
    : 0;
  const tradeUnit = buyTargets.some(t => t.value - t.cost > 0.2) ? 1.0 : 0.25;

  // 重算购买价值（用真实贸易单价）
  for (const t of buyTargets) {
    if (t.uid != null) t.value = cardValue(t.uid, tradeUnit);
    else t.value = EXPLORER.eff.trade * tradeUnit * (playsPerCard * 0.55 + 0.3) + 1.4;
    t.net = t.value - t.cost - 0.3; // 0.3 为「买牌使牌库变大、循环变慢」的稀释代价
  }
  const bestBuy = buyTargets.length
    ? buyTargets.reduce((best, t) => (best === null || t.net > best.net ? t : best), null)
    : null;

  // -------------------------------------------------------------------------
  // 各动作评分
  // -------------------------------------------------------------------------
  /**
   * 摧毁一座敌方基地的收益。
   * 关键规则：只要对手还控制着任意一座前哨，就无法直接攻击其玩家（直伤被封锁）。
   * 因此「拆掉最后一个前哨」的价值远高于拆普通基地，必须排在出牌之前。
   */
  const baseKillBonus = (targetId) => {
    const tc = info(targetId);
    if (!tc) return { tier: P.baseAttack, bonus: 0 };
    const owner = tc.owner != null ? players[tc.owner] : null;
    const ownerInPlay = (owner && Array.isArray(owner.inPlay)) ? owner.inPlay : [];
    const outposts = ownerInPlay.filter(uid => { const cc = info(uid); return !!(cc && cc.outpost); });
    if (tc.outpost) {
      // 拆掉最后一个前哨 → 立刻解锁对玩家的直伤
      if (outposts.length <= 1) return { tier: P.outpostBreak, bonus: 140 };
      return { tier: P.outpostBreak - 400, bonus: 60 }; // 还有其它前哨，先拆哪一个都行
    }
    // 普通基地：拆掉对方的贸易引擎，收益随其引擎价值上升
    return { tier: P.baseAttack, bonus: 160 + Math.min(400, cardValue(targetId, tradeUnit) * 12) };
  };

  const scoreAttack = (a) => {
    if (a.targetType === 'base') {
      const c = info(a.targetId);
      const def = Number(c && c.defense) || 1;
      const dmg = Number((v.damage || {})[a.targetId]) || 0;
      const need = Math.max(1, def - dmg);
      const amount = Number(a.amount) || 0;
      if (amount < need) return P.baseAttack - 500; // 本回合打不掉的伤害回合后清零，纯浪费
      const { tier, bonus } = baseKillBonus(a.targetId);
      return tier + bonus + amount * 2;
    }

    const target = players[a.targetId] || {};
    const auth = Number(target.authority) || 0;
    const amount = Number(a.amount) || 0;
    let s = P.attack + amount * (AUTH_UNIT * 0.95);
    // 集火最接近出局的对手
    const lowest = opponents.length ? Math.min(...opponents.map(p => Number(p.authority) || 0)) : 0;
    if (auth <= lowest + 0.5) s += 90;
    if (mode === 'firstBlood' && a.targetId === 0) s += 60;
    if (myAuth <= 18 && auth <= 25) s += 40;
    return s;
  };

  const scoreAbility = (a) => {
    const c = info(a.cardId);
    const p = c ? parseCard(c.text) : null;
    if (!p) return P.unknown;
    const kind = a.ability;

    if (kind === 'primary') {
      // 基地主要能力：立即收益 + 摧毁自身卡牌的代价
      const opt = (p.options && p.options.length && a.choice != null) ? p.options[a.choice] : null;
      const eff = opt ? opt.eff : p.primary;
      let gain = bodyValue(eff, tradeUnit);
      let cost = 0;
      const targets = Array.isArray(a.targets) ? a.targets : null;
      if (targets && targets.length) {
        for (const uid of targets) cost += cardValue(uid, tradeUnit) * 0.85;
        if (p.primary.draw > 0) gain += p.primary.draw * DRAW_UNIT;
      }
      if (a.resource) {
        const amount = 2 * (targets ? targets.length : 0);
        gain += amount * (a.resource === 'combat' ? COMBAT_UNIT : tradeUnit);
      }
      if (kind === 'primary' && c && c.type === 'base' && p.primary.scrapOwnMandatory) gain += 2.5;
      return P.primary + gain - cost;
    }

    if (kind === 'ally') {
      let gain = allyValue(a.cardId, p.ally, tradeUnit);
      const targets = Array.isArray(a.targets) ? a.targets : null;
      if (targets && targets.length) {
        for (const uid of targets) gain -= cardValue(uid, tradeUnit) * 0.85;
      }
      if (a.row !== undefined) {
        const uid = (v.tradeRow || [])[a.row];
        gain += uid ? cardValue(uid, tradeUnit) + 2.0 : 1.0;
      }
      if (a.targetId != null) {
        const { tier, bonus } = baseKillBonus(a.targetId);
        gain += tier - P.ally + bonus;
      }
      if (a.rows && a.rows.length) gain += 20; // 多张交易行同时处理，收益略高
      return P.ally + gain;
    }

    if (kind === 'optional') {
      // 可选能力：多为销毁己方废牌 / 销毁交易行 / 摧毁敌方基地
      const targets = Array.isArray(a.targets) ? a.targets : null;
      let gain = 0;
      if (targets && targets.length) {
        for (const uid of targets) {
          const cc = info(uid);
          const junk = cc && (cc.id === 'scout' || cc.id === 'viper');
          gain += junk ? 120 : -cardValue(uid, tradeUnit) * 80;
        }
      }
      if (a.row !== undefined || (Array.isArray(a.rows) && a.rows.length)) gain += 30; //  denying 对手的交易行选择
      if (a.targetId != null) {
        const { tier, bonus } = baseKillBonus(a.targetId);
        gain += tier - P.optional + bonus;
      }
      return P.optional + gain;
    }

    if (kind === 'scrap') {
      // 销毁自身：换战斗/贸易，代价是失去这张牌
      let gain = bodyValue(p.scrap, tradeUnit);
      if (p.flags.destroyBase && a.targetId != null) {
        const { tier, bonus } = baseKillBonus(a.targetId);
        gain += tier - P.scrap + bonus;
      }
      gain -= cardValue(a.cardId, tradeUnit) * 0.9;
      return P.scrap + gain;
    }

    return P.unknown;
  };

  const scorePlay = (a) => {
    const c = info(a.cardId);
    if (!c) return P.unknown;
    const p = parseCard(c.text);
    let val = 0;

    // 出牌立即收益（主要能力；「选择：」分支按 choice 取）
    const opt = (p.options && p.options.length && a.choice != null) ? p.options[a.choice] : null;
    const eff = opt ? opt.eff : p.primary;
    let gain = opt ? bodyValue(eff, tradeUnit) : bodyValueCond(eff, p.flags, tradeUnit);
    if (opt && opt.flags.free) gain += 1.5;
    if (c.type === 'base') {
      gain += engineValue(a.cardId, tradeUnit); // 永久引擎
    } else {
      gain += (opt ? bodyValue(eff, tradeUnit) : bodyValueCond(eff, p.flags, tradeUnit)) * (playsPerCard - 1) * 0.5;
    }
    val += gain;

    // 同盟触发由独立的 ability 动作处理，这里只计触发概率带来的价值
    val += allyValue(a.cardId, p.ally, tradeUnit) * 0.35;

    // 复制动作：复制到强力牌价值很高
    if (a.copy) val += cardValue(a.copy, tradeUnit) + 2.5;

    // 免费获得（acquireFreeMax）：额外拿到一张牌
    if (a.row !== undefined) {
      const uid = (v.tradeRow || [])[a.row];
      val += uid ? cardValue(uid, tradeUnit) + 2.0 : 1.0;
    }

    // 耗资源的出牌在「贸易有去处」时才值得
    return P.play + val;
  };

  const scoreBuy = (a) => {
    const target = buyTargets.find(t => t.action === a);
    if (!target) return P.unknown;
    if (target.net <= 0) return P.buy - 400; // 不划算的购买留到确实没别的事可做时再考虑
    return P.buy + target.net * 60;
  };

  const scoreTransfer = (a) => {
    if (mode !== 'team2v2') return P.unknown;
    const teammate = players[a.targetId] || {};
    const amount = Number(a.amount) || 0;
    const resource = a.resource === 'combat' ? 'combat' : 'trade';
    const theirAmount = Number(teammate[resource]) || 0;
    let surplus = 0;
    if (resource === 'trade') {
      // 只把自己花不掉的贸易转出去（最划算的一笔购买成本之外）
      const keep = bestBuy && bestBuy.net > 0 ? bestBuy.cost : 0;
      surplus = Math.max(0, (Number(me.trade) || 0) - keep);
    } else {
      // 战斗只有在我完全无法有效攻击时才转给队友
      surplus = 0;
    }
    if (amount > surplus) return P.transfer - 300;
    const need = theirAmount <= 0 ? 1.6 : theirAmount <= 2 ? 1.0 : 0.4;
    return P.transfer + amount * 12 * need;
  };

  const scoreDiscard = (a) => {
    // 强制弃牌：丢掉最没价值的牌（弃牌进弃牌堆，可回收，代价打折）
    const c = info(a.cardId);
    const junk = c && (c.id === 'scout' || c.id === 'viper');
    return P.pending - (junk ? 10 : 60 + cardValue(a.cardId, tradeUnit) * 20);
  };

  const scoreSelectScrap = (a) => {
    // 强制销毁：优先销毁废牌，好牌绝不误伤
    const c = info(a.cardId);
    const junk = c && (c.id === 'scout' || c.id === 'viper');
    return P.pending - (junk ? 5 : 90 + cardValue(a.cardId, tradeUnit) * 30);
  };

  const scoreTargetDiscard = (a) => {
    const t = players[a.targetId] || {};
    const handCount = Number(t.handCount) || 0;
    const inPlayCount = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
    let s = P.pending + handCount * 30 + inPlayCount * 12;
    if (mode === 'firstBlood' && a.targetId === 0) s += 80;
    return s;
  };

  const scoreEventChoice = (a) => {
    const eventId = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    const base = P.pending;

    if (eventId === 'blackHole') {
      // 每少弃一张牌失去 4 权威；弃牌可回收，代价打折
      const targets = Array.isArray(a.targets) ? a.targets : [];
      const missing = 2 - targets.length;
      const authorityLoss = missing * 4 * AUTH_UNIT;
      let cardLoss = 0;
      for (const uid of targets) cardLoss += cardValue(uid, tradeUnit) * 0.3;
      return base - authorityLoss - cardLoss;
    }
    if (eventId === 'bombardment') {
      // 摧毁己方基地 或 失去 6 权威
      if (a.pay) return base - 6 * AUTH_UNIT;
      const c = info(a.baseId);
      const loss = c ? cardValue(a.baseId, tradeUnit) * 0.9 : 6 * AUTH_UNIT;
      return base - loss;
    }
    if (eventId === 'comet') {
      // 可永久销毁至多两张牌：只销毁废牌
      const targets = Array.isArray(a.targets) ? a.targets : [];
      let s = base;
      for (const uid of targets) {
        const c = info(uid);
        const junk = c && (c.id === 'scout' || c.id === 'viper');
        s += junk ? 120 : -cardValue(uid, tradeUnit) * 40;
      }
      return s;
    }
    if (eventId === 'warpJump') {
      // 抽三张后选两张放回牌库顶：把最差的两张放回去，较好的那张先被抽到
      const cardsBack = Array.isArray(a.cards) ? a.cards : [];
      let s = base;
      for (const uid of cardsBack) s -= cardValue(uid, tradeUnit) * 22;
      if (cardsBack.length >= 2) {
        const v0 = cardValue(cardsBack[0], tradeUnit);
        const v1 = cardValue(cardsBack[1], tradeUnit);
        s += (v0 - v1) * 8; // 牌库顶先抽到的应该是两张里较好的那张
      }
      return s;
    }
    if (eventId === 'supernova' || eventId === 'galacticSummit' || eventId === 'quasar' || eventId === 'tradeMission') {
      return base; // 无选择的事件
    }
    return base; // 未知事件：中性兜底
  };

  const score = (a) => {
    if (!a || typeof a !== 'object') return P.unknown;
    switch (a.type) {
      case 'play': return scorePlay(a);
      case 'ability': return scoreAbility(a);
      case 'buy': return scoreBuy(a);
      case 'attack': return scoreAttack(a);
      case 'transfer': return scoreTransfer(a);
      case 'discard': return scoreDiscard(a);
      case 'selectScrap': return scoreSelectScrap(a);
      case 'targetDiscard': return scoreTargetDiscard(a);
      case 'eventChoice': return scoreEventChoice(a);
      case 'endTurn': return P.endTurn;
      default: return P.unknown;
    }
  };

  // -------------------------------------------------------------------------
  // 一击致命：绝对优先
  // -------------------------------------------------------------------------
  for (const a of actions) {
    if (!a || a.type !== 'attack' || a.targetType !== 'player') continue;
    const target = players[a.targetId];
    if (!target) continue;
    const auth = Number(target.authority);
    if (Number.isFinite(auth) && (Number(a.amount) || 0) >= auth) return a;
  }

  // -------------------------------------------------------------------------
  // 统一择优
  // -------------------------------------------------------------------------
  let best = null;
  let bestScore = -Infinity;
  for (const a of actions) {
    let s;
    try { s = score(a); } catch (err) { s = P.unknown; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = P.unknown;
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (!best) best = actions[0];

  // 记忆：仅用于本座位私有的阶段与行为统计，便于后续调参与看板观察
  mem.lastTurn = turn;
  mem.lastMode = mode;
  mem.baseIncome = baseIncome;
  mem.phase = rounds <= roundLimit * 0.4 ? '播种' : (rounds <= roundLimit * 0.72 ? '加厚' : '兑现');

  return best;
}
