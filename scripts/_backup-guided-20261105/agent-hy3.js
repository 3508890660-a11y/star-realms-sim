// hy3 · 极速压制 —— 零依赖、只读决策脚本。
// 适配 standard / ffa / hunter / firstBlood / team2v2 五种模式，
// 以及 core / colonyWars / events 的任意组合。
// 不修改 view / legalActions（二者均为深冻结对象），不引入任何依赖。
// 始终原样返回 legalActions 数组中的某个对象引用，绝不抛异常或死循环。
//
// 策略主题「极速压制」：低费战斗、前哨突破、lethal 优先，
// 在最短回合内尽快压低对手权威。固定优先级层级（评分大间隔）：
//   lethal > 摧毁敌方前哨（解锁对玩家直伤）> 打出廉价战斗牌 / 同盟触发
//   > 对玩家削血 > 摧毁普通基地 > 低费购买补强 > 2V2 资源预留 > 未知动作兜底 > 结束回合。
// 所有待决（discard / selectScrap / targetDiscard / eventChoice）与未知动作均安全兜底。

export const meta = {
  name: 'hy3 极速压制',
  description: '模型 hy3 驱动：极速压制策略——低费战斗、前哨突破、lethal 优先，在最短回合内尽快压低对手权威。适配全模式与 core/colonyWars/events 任意组合，所有待决与未知动作均安全兜底。'
};

// ---------- 小工具（纯函数，无副作用） ----------
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const PENDING_TYPES = ['discard', 'selectScrap', 'targetDiscard', 'eventChoice'];

// 卡牌估值：极速压制取向——重战斗、重廉价、轻经济与防守。
function cardWorth(uid, getCard) {
  const c = getCard(uid);
  if (!c) return 1;
  if (c.id === 'scout') return 0.5;    // 贸易：非极速压制偏好
  if (c.id === 'viper') return 2.0;    // 廉价战斗：核心
  if (c.id === 'explorer') return 1.5;
  const text = typeof c.text === 'string' ? c.text : '';
  const grab = (re) => {
    let s = 0;
    for (const m of String(text).matchAll(re)) s += Number(m[1]) || 0;
    return s;
  };
  let w = 1;
  w += grab(/(\d+)\s*战斗/g) * 2.5;   // 战斗权重最高
  w += grab(/(\d+)\s*抽\s*张/g) * 1.5;
  w += grab(/(\d+)\s*弃\s*张/g) * 1.5; // 逼对手弃牌视同加速
  w += grab(/(\d+)\s*权威/g) * 1.0;
  w += grab(/(\d+)\s*贸易/g) * 0.5;    // 贸易仅轻量
  if (/同盟/.test(text)) w += 1.5;
  if (/销毁|摧毁/.test(text)) w += 1.2;
  if (/免费|置于牌库顶|置入手牌|获得时可/.test(text)) w += 2.0;
  if (c.outpost) w += 0.3;             // 防守基地：极速压制不优先
  const cost = (typeof c.cost === 'number' && Number.isFinite(c.cost)) ? c.cost : 3;
  w *= (1.3 - Math.min(7, Math.max(1, cost)) * 0.08); // 强偏好廉价牌
  return Math.max(0.2, w);
}

// ---------- 待决动作打分 ----------
function scorePending(a, players, playerId, getCard) {
  switch (a.type) {
    case 'discard': // 我是弃牌者：弃掉最差的一张（分数最高=最想弃）
      return -cardWorth(a.cardId, getCard) * 10;
    case 'selectScrap': // 强制销毁：优先压掉最差牌
      return 100 - cardWorth(a.cardId, getCard) * 10;
    case 'targetDiscard': { // 让手牌多 / 威胁大的对手弃牌，加速压制
      const t = players[a.targetId] || {};
      const hc = num(t.handCount, (t.hand || []).length || 0);
      const threat = (t.inPlay || []).length;
      return 100 + hc * 10 + threat * 3;
    }
    case 'eventChoice':
      return scoreEvent(a, players, playerId, getCard);
    default:
      return 0; // 未知待决：中性兜底
  }
}

// 事件待决：激进取向，尽量不拖慢自身节奏、保住权威。
function scoreEvent(a, players, playerId, getCard) {
  const ev = a.eventId || (a.payload && a.payload.eventId) || '';
  if (ev === 'blackHole') {
    const targets = Array.isArray(a.targets) ? a.targets : [];
    let cost = 0;
    for (const uid of targets) cost += cardWorth(uid, getCard);
    const missing = Math.max(0, 2 - targets.length);
    const t = players[playerId] || {};
    const myAuth = num(t.authority, 50);
    const loss = myAuth - Math.max(1, myAuth - 4 * missing);
    return -(cost * 0.5 + loss); // 权威对极速压制同样珍贵
  }
  if (ev === 'bombardment') {
    if (a.pay) return -6;                 // 失去 6 权威
    if (a.baseId) {
      const c = getCard(a.baseId);
      return -(cardWorth(a.baseId, getCard) * 0.4 + (c && c.outpost ? 2 : 0.5));
    }
    return -1;
  }
  if (ev === 'comet') {
    const targets = Array.isArray(a.targets) ? a.targets : [];
    let benefit = 0;
    for (const uid of targets) {
      const c = getCard(uid);
      if (c && (c.id === 'scout' || c.id === 'viper')) benefit += 30; // 压掉初始牌
      else {
        const w = cardWorth(uid, getCard);
        benefit += w <= 3.5 ? 8 : -w * 3;
      }
    }
    return benefit;
  }
  if (ev === 'warpJump') {
    const cs = Array.isArray(a.cards) ? a.cards : [];
    let s = 0;
    for (const uid of cs) s -= cardWorth(uid, getCard) * 3; // 把差的放回牌库顶
    return s;
  }
  return 0; // 未知事件：中性兜底
}

// ---------- 主阶段动作打分 ----------
function scoreMain(a, v, me, players, playerId, getCard) {
  if (!a || typeof a !== 'object') return 5e4; // 未知动作：安全兜底
  const startAuth = (v.mode === 'team2v2') ? 75 : 50;
  const myAuth = num(me.authority, startAuth);

  switch (a.type) {
    case 'endTurn':
      return -1e6; // 绝对最后选择

    case 'transfer': {
      // 2V2 把回合末会清零的余量预留给队友；极速压制不偏好，但也不浪费
      return 1e4 + num(a.amount, 0);
    }

    case 'attack': {
      const amt = num(a.amount, 0);
      if (a.targetType === 'base') {
        const c = getCard(a.targetId);
        const outpost = !!(c && c.outpost);
        const dmg = num((v.damage || {})[a.targetId], 0);
        const def = num(c && c.defense, 1);
        const destroyed = (dmg + amt) >= def;
        if (destroyed) return outpost ? 9.5e5 : 6.0e5; // 摧毁前哨可解锁对玩家直伤
        return outpost ? 4.5e5 : 1.6e5;                // 削前哨清路优先于削普通基地
      }
      // 对玩家：聚焦最弱/最接近出局者，金额越大越好
      const t = players[a.targetId] || {};
      const auth = num(t.authority, startAuth);
      return 5.2e5 + amt * 8 + (startAuth - auth) * 0.5;
    }

    case 'play': {
      let s = 7.0e5 + cardWorth(a.cardId, getCard) * 1.5;
      if (a.copy) s += 40;                                  // 复制强力牌
      if (a.row !== undefined) {
        const uid = (v.tradeRow || [])[a.row];
        if (uid) s += cardWorth(uid, getCard) * 1.2;        // 免费获得
      }
      if (a.choice !== undefined) s += 3;                   // 选择效果：抖动择优
      return s;
    }

    case 'ability': {
      const off = { ally: 7.2e5, primary: 6.8e5, optional: 6.0e5, scrap: 5.6e5 };
      let base = off[a.ability];
      if (base === undefined) base = 5e4;
      let val = 0;
      if (a.targetId !== undefined && a.targetId !== null) {
        const tc = getCard(a.targetId);
        val += (tc && tc.outpost) ? 380 : 110;              // 能力直摧毁前哨=突破
      }
      if (a.row !== undefined || (Array.isArray(a.rows) && a.rows.length)) val += 90;
      const targets = Array.isArray(a.targets) ? a.targets : null;
      if (targets && targets.length) {
        let g = 8;                                          // 弃/回收/销毁：滤掉差牌
        for (const uid of targets) {
          const c = getCard(uid);
          if (c && (c.id === 'scout' || c.id === 'viper')) g += 28;
          else {
            const w = cardWorth(uid, getCard);
            g += w <= 3.5 ? 5 : -w * 2;
          }
        }
        val += g;
      } else if (a.choice === undefined && a.targetId === undefined && a.row === undefined && !Array.isArray(a.rows)) {
        return 1e4; // 近似空操作，尽量不做
      }
      if (a.choice !== undefined) val += 3;
      if (a.ability === 'scrap') val -= cardWorth(a.cardId, getCard) * 0.35; // 销毁自身会失去此牌
      return base + val;
    }

    case 'buy': {
      if (a.explorer) return 4.5e5 - 40;                    // 探索者：低优先经济填充
      const uid = (v.tradeRow || [])[a.row];
      if (!uid) return 4.5e5 - 60;
      return 4.5e5 + cardWorth(uid, getCard) * 15;          // 卡牌价值已含强廉价偏好
    }

    default:
      return 5e4; // 未知动作：安全兜底，仍返回合法动作
  }
}

// ---------- 对外入口 ----------
export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return undefined; // 安全兜底（理论不会发生）

  const rnd = typeof random === 'function' ? random : Math.random;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const getCard = uid => (uid != null && cards[uid]) || null;

  // lethal：一击致胜，绝对优先（不依赖打分层级，直接命中）
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  let best = actions[0];
  let bestScore = -Infinity;
  for (const a of actions) {
    let s;
    try {
      s = (a && PENDING_TYPES.includes(a.type))
        ? scorePending(a, players, playerId, getCard)
        : scoreMain(a, v, me, players, playerId, getCard);
    } catch (err) {
      s = 0; // 任何异常都不抛出，降级为中性分
    }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = 0;
    s += rnd() * 0.5; // 极小抖动，仅用于打破完全平分
    if (s > bestScore) { bestScore = s; best = a; }
  }

  if (memory && typeof memory === 'object') memory.calls = (memory.calls || 0) + 1;
  return best; // 始终返回 legalActions 中的原始对象引用
}
