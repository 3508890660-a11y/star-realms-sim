// KIMI 2.8preview · 基地控制 —— 零依赖、只读决策脚本。
// 适配 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events 的任意组合。
// 核心命题：前哨是局面的「闸门」——己方前哨挡住直伤，敌方前哨挡住输出。
//   · 购买与部署己方前哨是仅次于 lethal 的最高优先；
//   · 拆塔按「防御缺口（defense − 已受伤害）」与「拆解后剩余战斗」排序，缺口最小者优先；
//   · 未摧毁基地的伤害回合末清零，因此对打不掉的基地一律不浪费战斗。
// 所有决策点均只读冻结的 view / legalActions，并原样返回 legalActions 中的对象引用；
// 未知动作、未知事件一律安全打分兜底，绝不抛异常、绝不死循环。

export const meta = {
  name: 'KIMI 2.8preview · 基地控制',
  description: 'KIMI 2.8preview 基地控制：把前哨视为核心资产——优先购买与部署己方前哨、按防御缺口与剩余战斗拆除敌方前哨；未摧毁基地伤害清零故不空耗战斗。全模式、全扩展、全待决与未知动作安全兜底，零依赖只读。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const list = v => (Array.isArray(v) ? v : []);

const LETHAL = 1e7;    // 一击致胜：绝对优先
const UNKNOWN = -900;  // 未知动作：保留给「仅剩未知动作」的场景

// ---------- 卡牌静态估值 ----------
function effectProfile(text) {
  const t = typeof text === 'string' ? text : '';
  const sum = re => {
    let s = 0;
    for (const m of t.matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  return {
    trade: sum(/(\d+)\s*贸易/g),
    combat: sum(/(\d+)\s*战斗/g),
    authority: sum(/(\d+)\s*权威/g),
    draw: sum(/抽\s*(\d+)\s*张/g),
    discardOpp: sum(/对手弃\s*(\d+)\s*张/g) + sum(/弃\s*(\d+)\s*张牌/g),
    destroyBase: /摧毁/.test(t),
    outpost: /前哨/.test(t),
    free: /免费|置入手牌|置于牌库顶/.test(t),
    ally: /同盟/.test(t),
    scrap: /销毁/.test(t)
  };
}

function makeCardTools(cards) {
  const info = uid => (uid == null ? null : cards[uid]) || null;
  const isStarter = uid => {
    const c = info(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };
  const value = uid => {
    const c = info(uid);
    if (!c) return 1.2;
    if (c.id === 'scout') return 1.0;
    if (c.id === 'viper') return 1.1;
    if (c.id === 'explorer') return 2.0;
    const e = effectProfile(c.text);
    let val = 2.0;
    val += e.trade * 0.6 + e.combat * 0.55 + e.authority * 0.7;
    val += e.draw * 1.6 + e.discardOpp * 1.3;
    if (c.type === 'base') val += c.outpost ? 4.2 : 2.0;   // 前哨权重最高
    if (e.destroyBase) val += 1.6;                          // 拆塔能力是核心
    if (e.free) val += 1.5;
    if (e.ally) val += 1.0;
    val += clamp(num(c.cost, 3), 0, 8) * 0.25;
    return clamp(val, 1, 22);
  };
  return { info, isStarter, value };
}

function decide({ view, legalActions, playerId, random, memory, context } = {}) {
  const acts = Array.isArray(legalActions) ? legalActions : [];
  if (!acts.length) return acts[0];
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const ctx = context || {};
  const rnd = typeof random === 'function' ? random : () => 0.5;
  const { info, isStarter, value } = makeCardTools(cards);

  const mode = ctx.mode || v.mode || 'standard';
  const isTeam = mode === 'team2v2';
  const startAuth = isTeam ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTeam = me.team;
  const myInPlay = list(me.inPlay);

  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const minEnemyAuth = opponents.length
    ? Math.min(...opponents.map(p => num(p.authority, startAuth)))
    : startAuth;

  const trade = num(me.trade, 0);
  const combat = num(me.combat, 0);
  const damageMap = v.damage || {};

  // 己方前哨数：没有闸门时显著提高买塔/部署权重
  const myOutposts = myInPlay.filter(uid => {
    const c = info(uid);
    return c && c.outpost;
  }).length;

  // 局面倾向：危险度与回合阶段
  const danger = clamp((startAuth - myAuth) / startAuth, 0, 1);
  const late = clamp((num(ctx.turn, 1) - 8) / 10, 0, 1);

  // memory：平滑「买塔倾向」，避免相邻回合抖动
  const mem = (memory && typeof memory === 'object') ? memory : null;
  let buyBaseBias = clamp(1.15 + danger * 0.9 - late * 0.25 + (myOutposts === 0 ? 0.8 : 0), 0.6, 2.6);
  if (mem) {
    buyBaseBias = clamp(0.6 * num(mem._baseBias, buyBaseBias) + 0.4 * buyBaseBias, 0.6, 2.6);
    mem._baseBias = buyBaseBias;
    mem.calls = num(mem.calls, 0) + 1;
  }
  // 首位玩家在 firstBlood 中最容易被集火：更重视闸门与回血
  const selfPreserve = mode === 'firstBlood' && playerId === 0 ? 1.5 : 1.0;

  // ---------- 合法动作上下文 ----------
  const hasBuy = acts.some(a => a && a.type === 'buy');
  const baseGap = uid => {
    const c = info(uid);
    return num(c && c.defense, 1) - num(damageMap[uid], 0);
  };

  // ---------- 事件选择估值 ----------
  function scoreEvent(a) {
    const kind = a.eventId || (v.pending && (v.pending.eventId || v.pending.kind)) || '';
    const targets = list(a.targets);
    const putBack = list(a.cards);
    switch (kind) {
      case 'blackHole': {
        // 弃两张可回收牌，或弃更少但失血：按「损失 = 弃牌折价 + 失血」最小化
        let cost = 0;
        for (const uid of targets) cost += value(uid) * 0.5;
        const missing = Math.max(0, 2 - targets.length);
        cost += missing * 6 * (1 + danger);
        return -cost;
      }
      case 'bombardment': {
        if (a.pay) return -(myAuth > 8 ? 8 : 14) * selfPreserve;   // 宁可付权威保前哨
        if (a.baseId) {
          const c = info(a.baseId);
          if (!c) return -10;
          if (c.outpost) return -500 * selfPreserve;               // 绝不拆自己前哨
          return -(value(a.baseId) * 0.5 + 2);
        }
        return -20;
      }
      case 'comet': {
        // 只接受销毁初始牌；销毁好牌重罚
        let s = 0;
        for (const uid of targets) {
          if (isStarter(uid)) s += 6;
          else s -= value(uid) * 6 + 20;
        }
        return s;
      }
      case 'warpJump': {
        // 把估值最低的两张放回牌库顶（近似：放回的牌越少越好且越差越好）
        let s = 8;
        for (const uid of putBack) s -= value(uid) * 0.6;
        return s - putBack.length * 1.5;
      }
      default: {
        // 未知事件：无代价选项优先，其次弃差牌/便宜基地，付费回避
        let s = 0;
        for (const uid of targets) s -= value(uid) * 0.6;
        for (const uid of putBack) s -= value(uid) * 0.4;
        if (a.baseId) {
          const c = info(a.baseId);
          s -= c && c.outpost ? 300 : value(a.baseId) * 0.4;
        }
        if (a.pay) s -= 10 * selfPreserve;
        if (!targets.length && !putBack.length && !a.baseId && !a.pay) s += 2; // 安全跳过
        return s;
      }
    }
  }

  // ---------- 主决策打分 ----------
  function score(a) {
    if (!a || typeof a !== 'object') return UNKNOWN;
    switch (a.type) {
      case 'endTurn': {
        const waste = (hasBuy ? trade : 0) * 0.8 + combat * 0.4;
        return -20 - waste;
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'player') {
          const t = players[a.targetId] || {};
          const auth = num(t.authority, startAuth);
          if (amt >= auth) return LETHAL + amt;
          let s = amt * 6 + (startAuth - auth) * 0.15 + late * 4;
          if (auth <= minEnemyAuth + 1) s += 8;              // 集火最弱者
          return s;
        }
        // 攻击基地：只打本击可摧毁的，缺口最小者优先，保留剩余战斗
        const gap = baseGap(a.targetId);
        const c = info(a.targetId);
        const destroyed = amt >= gap;
        if (!destroyed) return -40 - amt * 0.2;               // 打不掉 = 浪费
        const leftover = combat - amt;
        let s = 200 + gap * 5 + leftover * 2.5;
        if (c && c.outpost) s += 120;                         // 拆前哨解锁直伤
        if (c && c.type === 'base' && !(c && c.outpost)) s -= 40;
        return s;
      }
      case 'play': {
        const c = info(a.copy) || info(a.cardId);
        if (!c) return 2;
        const e = effectProfile(c.text);
        let s = value(a.copy || a.cardId) * 1.2;
        if (c.type === 'base') s += c.outpost ? 60 * selfPreserve : 22;   // 部署闸门最高优先
        if (a.copy) s += 6;
        if (a.row !== undefined) s += value(list(v.tradeRow)[a.row]) * 1.1 + 6; // 免费获得
        if (a.choice !== undefined) s *= 0.85;               // 选择型主能力暂按折价
        return s;
      }
      case 'ability': {
        const c = info(a.cardId);
        const kind = a.ability;
        let txt = c ? c.text : '';
        if (kind === 'ally') { const i = txt.indexOf('同盟'); txt = i >= 0 ? txt.slice(i) : txt; }
        else if (kind === 'scrap') { const i = txt.indexOf('销毁'); txt = i >= 0 ? txt.slice(i) : ''; }
        else if (kind === 'optional') txt = '';
        const e = effectProfile(txt);
        let s = e.trade * 1.1 + e.combat * 1.0 + e.authority * 1.3 * selfPreserve;
        s += e.draw * 2.2 + e.discardOpp * 1.8;
        if (kind === 'ally') s += 4;                          // 同盟触发优先兑现
        if (a.targetId != null) {
          // 能力指定基地目标（多为摧毁）
          const bc = info(a.targetId);
          if (bc) {
            s += 90 + num(bc.defense, 1) * 4 + (bc.outpost ? 110 : 0);
          } else s += 40;
        }
        const rows = list(a.rows).length ? list(a.rows) : (a.row !== undefined ? [a.row] : []);
        for (const r of rows) {
          const uid = list(v.tradeRow)[r];
          if (kind === 'ally' || e.free) s += value(uid) * 1.0 + 5;   // 免费入手
          else s += 12;                                                // 销毁交易行干扰
        }
        const tgts = list(a.targets);
        for (const uid of tgts) {
          s += (3.2 - value(uid)) * (kind === 'optional' ? 1.2 : 0.7); // 弃差牌/拿低费
        }
        if (a.resource) s += tgts.length * 2.4;
        if (kind === 'scrap') s += (3.0 - value(a.cardId)) * 0.8 + (isStarter(a.cardId) ? 6 : 0);
        return s;
      }
      case 'buy': {
        let c = null;
        let cost;
        if (a.explorer) { cost = 2; }
        else {
          c = info(list(v.tradeRow)[a.row]);
          cost = num(c && c.cost, 99);
        }
        if (trade < cost) return -50;                           // 买不起（理论上不会出现）
        let s;
        if (a.explorer) {
          s = 10;                                               // Explorer 作经济/销毁润滑剂
        } else {
          const cv = value(list(v.tradeRow)[a.row]);
          s = cv * 2.2 - cost * 0.6;
          if (c) {
            if (c.outpost) s += 90 * buyBaseBias * selfPreserve;        // 买前哨最高优先
            else if (c.type === 'base') s += 34 * buyBaseBias;
            if (c.faction && myInPlay.some(uid => {
              const ic = info(uid);
              return ic && ic.faction === c.faction;
            })) s += 8;                                         // 与场上同阵营协同
          }
        }
        return s;
      }
      case 'transfer': {
        const amt = num(a.amount, 0);
        // 战斗优先自用于拆塔；富余时转给队友
        const needCombat = opponents.some(p =>
          list(p.inPlay).some(uid => {
            const c = info(uid);
            return c && c.outpost;
          }));
        if (a.resource === 'combat') return needCombat ? -30 : amt * 1.5;
        return amt * 1.2;
      }
      case 'discard': {
        // 我是弃牌者：弃最差的一张
        return -value(a.cardId) * 2.2;
      }
      case 'selectScrap': {
        // 强制销毁：压初始牌
        return (3.5 - value(a.cardId)) * 1.5 + (isStarter(a.cardId) ? 8 : 0);
      }
      case 'targetDiscard': {
        const t = players[a.targetId] || {};
        return 30 + num(t.handCount, 0) * 2 + list(t.inPlay).length * 3;
      }
      case 'eventChoice':
        return scoreEvent(a);
      default:
        return UNKNOWN;
    }
  }

  let best = null;
  let bestScore = -Infinity;
  for (const a of acts) {
    let s;
    try { s = score(a); } catch (err) { s = UNKNOWN; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = UNKNOWN;
    s += rnd() * 0.01;   // 打破完全平分
    if (s > bestScore) { bestScore = s; best = a; }
  }
  return best != null ? best : acts[0];
}

export function chooseAction(opts) {
  try {
    const a = decide(opts);
    if (a && typeof a === 'object') return a;
  } catch (err) { /* 落入兜底 */ }
  const fallback = Array.isArray(opts && opts.legalActions) ? opts.legalActions : [];
  return fallback[0];
}
