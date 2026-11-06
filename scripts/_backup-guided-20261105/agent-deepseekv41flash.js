// deepseek v4.1flash · 事件响应 AI
// 零依赖、只读决策：只读取 view / legalActions / context，只写入本座位私有的 memory。
// 任何分支都原样返回 legalActions 中的对象引用，不克隆、不拼造、不排序冻结数组。
// 兼容 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events 的任意组合。
//
// 策略主题「事件响应」：
//   1. 为 blackHole / bombardment / comet / warpJump 四类事件分别建立「权威当量」估值；
//   2. 权威越低，每点权威损失折算的价值越高，宁可弃牌或拆基地也不吃权威伤害；
//   3. 事件结算后开一个短衰减窗口，抬高出牌与购买权重，尽快把节奏抢回来；
//   4. 常规回合按 出牌 → 购买 → 攻击 → 队友预留 → 结束 的分层落地，未知动作一律安全兜底。

export const meta = {
  name: 'deepseek v4.1flash · 事件响应',
  description: 'deepseek-v4.1-flash 编排的事件响应型 AI：对黑洞、轨道轰击、彗星、跃迁四类事件逐项估值，低权威时优先弃牌或摧毁基地以避免权威损失，事件结算后用短衰减窗口快速恢复出牌与购买节奏；全模式、全牌包、全待决动作与未知动作均安全兜底，零依赖且只读。'
};

const num = (value, fallback) =>
  (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
const cut = (value, low, high) => (value < low ? low : (value > high ? high : value));

export function chooseAction(input) {
  const actions = Array.isArray(input && input.legalActions) ? input.legalActions : [];
  if (!actions.length) return actions[0];

  const view = (input && input.view) || {};
  const playerId = num(input && input.playerId, 0);
  const rnd = (input && typeof input.random === 'function') ? input.random : () => 0.5;
  const ctx = (input && input.context) || {};
  const players = Array.isArray(view.players) ? view.players : [];
  const cards = view.cards || {};
  const damage = view.damage || {};
  const tradeRow = Array.isArray(view.tradeRow) ? view.tradeRow : [];
  const me = players[playerId] || {};
  const mode = ctx.mode || view.mode || 'standard';
  const turn = num(ctx.turn, num(view.turn, 1));
  const pend = view.pending || null;
  const myHand = Array.isArray(me.hand) ? me.hand : [];
  const myDiscard = Array.isArray(me.discard) ? me.discard : [];
  const myPlay = Array.isArray(me.inPlay) ? me.inPlay : [];
  const isTeam = mode === 'team2v2';
  const startAuth = isTeam ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTrade = num(me.trade, 0);
  const myCombat = num(me.combat, 0);

  // ---------- 记忆：事件计数与「事件后回节奏」窗口 ----------
  const mem = (input && input.memory && typeof input.memory === 'object') ? input.memory : null;
  const isEventDecision = !!(pend && (pend.type === 'eventChoice' || pend.kind));
  if (mem) {
    mem.calls = num(mem.calls, 0) + 1;
    if (isEventDecision) {
      mem.events = num(mem.events, 0) + 1;
      mem.lastEvent = (pend && (pend.eventId || pend.kind)) || 'unknown';
      mem.recover = 6;
    } else {
      mem.recover = Math.max(0, num(mem.recover, 0) - 1);
      if (mem.events == null) mem.events = 0;
      if (mem.lastEvent == null) mem.lastEvent = '';
    }
  }
  const recover = mem ? num(mem.recover, 0) : 0;
  const recoverRate = cut(recover / 6, 0, 1);

  // ---------- 风险与节奏 ----------
  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (!isTeam || p.team !== me.team));
  const enemyAuths = opponents.map(p => num(p.authority, startAuth));
  const minEnemy = enemyAuths.length ? Math.min.apply(null, enemyAuths) : startAuth;
  const avgEnemy = enemyAuths.length
    ? enemyAuths.reduce((sum, x) => sum + x, 0) / enemyAuths.length
    : startAuth;

  // risk：0 表示健康，1 表示只剩不到一半权威；每点权威损失在低血时更贵
  const risk = cut((startAuth * 0.58 - myAuth) / (startAuth * 0.58), 0, 1);
  const authWeight = 4.2 + 11 * risk + (myAuth <= 8 ? 12 : 0);
  const strike = cut(0.5 + (myAuth - avgEnemy) / 110 - risk * 0.22 + (turn > 14 ? 0.06 : 0), 0.32, 0.72);
  const finisher = minEnemy <= myCombat + 4;

  // ---------- 卡牌画像：只依赖公开字段，兼容任意牌包 ----------
  const cardOf = uid => (uid != null && cards[uid]) || null;

  const traitCache = new Map();
  const traits = uid => {
    if (traitCache.has(uid)) return traitCache.get(uid);
    const c = cardOf(uid);
    const text = c && typeof c.text === 'string' ? c.text : '';
    const grab = re => {
      let total = 0;
      for (const m of text.matchAll(re)) total += Number(m[1]) || 0;
      return total;
    };
    const t = {
      trade: grab(/(\d+)\s*贸易/g),
      combat: grab(/(\d+)\s*战斗/g),
      auth: grab(/(\d+)\s*权威/g),
      draw: grab(/抽\s*(\d+)\s*张/g),
      discard: grab(/弃\s*(\d+)\s*张/g),
      drawAny: /抽/.test(text),
      scrapAny: /销毁/.test(text),
      destroyAny: /摧毁/.test(text),
      freeAny: /免费|置入手牌|置于牌库顶/.test(text),
      allyAny: /同盟/.test(text)
    };
    traitCache.set(uid, t);
    return t;
  };

  const isStarter = uid => {
    const c = cardOf(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  const worthCache = new Map();
  const worth = uid => {
    if (worthCache.has(uid)) return worthCache.get(uid);
    const c = cardOf(uid);
    if (!c) { worthCache.set(uid, 2); return 2; }
    if (c.id === 'scout') { worthCache.set(uid, 1.1); return 1.1; }
    if (c.id === 'viper') { worthCache.set(uid, 1.4); return 1.4; }
    if (c.id === 'explorer') { worthCache.set(uid, 2.3); return 2.3; }
    if (c.type === 'event') { worthCache.set(uid, 0); return 0; }
    const t = traits(uid);
    const cost = num(c.cost, 3);
    let w = 1.6 + 0.5 * cost;
    w += t.trade * 0.75;
    w += t.combat * (0.55 + 0.6 * strike);
    w += t.auth * (1.25 + 1.7 * risk);          // 事件主题：回血/保命更值钱
    w += t.draw * 1.9 + (t.drawAny ? 0.7 : 0);
    w += t.discard * 1.25;
    if (c.outpost) w += 3.1 + 1.4 * risk;       // 前哨是事件与直伤的双重缓冲
    else if (c.type === 'base') w += 1.5 + 0.7 * risk;
    if (t.allyAny) w += 1.4;
    if (t.scrapAny) w += 0.8;
    if (t.destroyAny) w += 1.4;
    if (t.freeAny) w += 1.7;
    worthCache.set(uid, w);
    return w;
  };

  const factionKeys = uid => {
    const c = cardOf(uid);
    if (!c) return [];
    if (Array.isArray(c.factions) && c.factions.length) return c.factions;
    return c.faction ? [c.faction] : [];
  };

  const ownerOf = uid => {
    for (const p of players) {
      if (p && Array.isArray(p.inPlay) && p.inPlay.indexOf(uid) >= 0) return p;
    }
    return null;
  };

  const boardAuth = p => num(p && p.authority, startAuth);

  const outpostCount = p => (p && Array.isArray(p.inPlay)
    ? p.inPlay.filter(uid => !!(cardOf(uid) || {}).outpost).length
    : 0);

  // 摧毁基地的收益：敌方前哨价值最高（拔掉直伤护盾），自己的基地为负
  const razeValue = uid => {
    if (!uid) return 0;
    const c = cardOf(uid);
    if (!c) return 0;
    const owner = ownerOf(uid);
    if (owner && owner.id === playerId) return -9;
    let v = c.outpost ? 15 + 11 * strike : 4;
    v += (startAuth - boardAuth(owner)) * 0.25;
    return v;
  };

  const handFactions = new Set();
  const playFactions = new Set();
  for (const uid of myHand) for (const f of factionKeys(uid)) handFactions.add(f);
  for (const uid of myPlay) for (const f of factionKeys(uid)) playFactions.add(f);

  const duplicateInHand = uid => {
    const c = cardOf(uid);
    if (!c) return 1;
    let n = 0;
    for (const x of myHand) {
      const cx = cardOf(x);
      if (cx && cx.id === c.id) n++;
    }
    return n || 1;
  };

  // 读取「选择：A 或 B」的分支文本，用于判断 choice 序号对应的效果
  const choiceParts = text => {
    const m = String(text || '').match(/选择\s*[：:]?\s*([^。]+)/);
    if (!m) return [];
    return m[1].split(/[或；;，,]/).map(s => s.trim()).filter(Boolean);
  };
  const choiceValue = (action, card) => {
    if (!card || action.choice === undefined) return 0;
    const parts = choiceParts(card.text);
    const seg = parts[action.choice] || '';
    let v = 0;
    if (seg.indexOf('战斗') >= 0) v += 3.4 * strike;
    if (seg.indexOf('贸易') >= 0) v += 2.4 * (1 - strike);
    if (seg.indexOf('权威') >= 0) v += 1.8 + 3 * risk;
    if (seg.indexOf('免费') >= 0) v += 5;
    if (seg.indexOf('摧毁') >= 0) v += 4;
    if (seg.indexOf('销毁') >= 0) v += 1.5;
    return v;
  };

  // ---------- 四类事件：以「权威当量 + 手牌折损」统一结算 ----------
  const eventValue = action => {
    const eventId = action.eventId || (pend && (pend.eventId || pend.kind)) || '';
    const targets = Array.isArray(action.targets) ? action.targets : [];

    if (eventId === 'blackHole') {
      // 弃至多两张手牌；每少弃一张失去 4 权威（引擎保证权威不低于 1）。
      const missing = Math.max(0, 2 - targets.length);
      const realLoss = Math.min(4 * missing, Math.max(0, myAuth - 1));
      let v = -realLoss * authWeight;
      for (const uid of targets) v -= 0.5 * worth(uid); // 只是进弃牌堆，折价计
      if (missing > 0 && myHand.length > targets.length) v -= 2 * missing;
      if (myAuth - realLoss <= 3) v -= 45; // 掉到 3 以下等于半只脚出局
      return v;
    }

    if (eventId === 'bombardment') {
      // 摧毁一座己方基地，或失去 6 权威；基地会进弃牌堆，权威不会自己回来。
      if (action.pay || (action.baseId === undefined && !targets.length)) {
        const realLoss = Math.min(6, Math.max(0, myAuth - 1));
        let v = -realLoss * authWeight - 8;
        if (myAuth - 6 <= 3) v -= 120;
        return v;
      }
      const c = cardOf(action.baseId);
      let v = -0.42 * worth(action.baseId);
      if (c && c.outpost) v -= 2.6;
      v += 4; // 拆自己基地虽然疼，但比掉 6 权威便宜
      return v;
    }

    if (eventId === 'comet') {
      // 销毁手牌或弃牌堆至多两张：优先压掉初始牌与弃牌堆里的废牌。
      let v = 0;
      for (const uid of targets) {
        const inDiscard = myDiscard.indexOf(uid) >= 0;
        const w = worth(uid);
        v += inDiscard ? 5.5 : 1.8;
        if (isStarter(uid)) v += 8.5;
        else if (w > 3.4) v -= (w - 3.4) * 2.2;
      }
      v += targets.length * 0.7;
      return v;
    }

    if (eventId === 'warpJump') {
      // 抽三放二回牌库顶：最好的一张留在手里本回合打掉，其余两张顶回牌库。
      const back = Array.isArray(action.cards) ? action.cards : [];
      const drawn = Array.isArray(pend && pend.drawn) ? pend.drawn : null;
      let kept = null;
      if (drawn) kept = drawn.find(uid => back.indexOf(uid) < 0) || null;
      let v = 0;
      if (kept) v += 0.95 * worth(kept);
      for (const uid of back) v += 0.3 * worth(uid);
      if (back.length >= 2 && worth(back[0]) >= worth(back[1])) v += 0.4;
      return v;
    }

    return 0; // 其他事件：中性，交给兜底
  };

  // ---------- 待决动作 ----------
  const pendingValue = action => {
    if (!action || typeof action !== 'object') return null;
    switch (action.type) {
      case 'discard': // 被迫弃牌：丢最便宜的，重复牌更舍得
        return -10 * worth(action.cardId) + (duplicateInHand(action.cardId) > 1 ? 2 : 0) + (isStarter(action.cardId) ? 3 : 0);
      case 'selectScrap': // 强制销毁：优先永久压掉初始牌
        return -10 * worth(action.cardId) + (isStarter(action.cardId) ? 26 : 0) + (duplicateInHand(action.cardId) > 1 ? 2 : 0);
      case 'targetDiscard': {
        const t = players[action.targetId] || {};
        const auth = boardAuth(t);
        const handCount = num(t.handCount, Array.isArray(t.hand) ? t.hand.length : 0);
        return 20 + auth * 0.3 + (Array.isArray(t.inPlay) ? t.inPlay.length : 0) * 1.8 + handCount * 1.2;
      }
      case 'eventChoice':
        return eventValue(action);
      default:
        return null; // 未知待决：不主动选，最后兜底第一个合法动作
    }
  };

  if (pend) {
    let best = null;
    let bestValue = -Infinity;
    for (const action of actions) {
      let v = null;
      try { v = pendingValue(action); } catch (err) { v = null; }
      if (v === null || !Number.isFinite(v)) continue;
      v += rnd() * 0.3;
      if (v > bestValue) { bestValue = v; best = action; }
    }
    return best || actions[0];
  }

  // ---------- 主回合：一次性致胜优先 ----------
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= num((players[a.targetId] || {}).authority, Infinity));
  if (lethal) return lethal;

  const baseLeft = uid => Math.max(1, num((cardOf(uid) || {}).defense, 4) - num(damage[uid], 0));
  const goodAttacks = actions.filter(a => {
    if (!a || a.type !== 'attack') return false;
    if (a.targetType === 'player') return true;
    return num(a.amount, 0) >= baseLeft(a.targetId);
  });

  const canBuyReal = actions.some(a => a && a.type === 'buy' && !a.explorer);

  const scorePlay = a => {
    const c = cardOf(a.cardId);
    if (!c) return 400;
    const t = traits(a.cardId);
    let s = 400 + 0.45 * worth(a.cardId);
    s += t.trade * (0.85 + 0.35 * (1 - strike));
    s += t.combat * (0.7 + 0.5 * strike);
    s += t.auth * (1.1 + 1.7 * risk);
    s += t.draw * 0.9;
    if (a.copy != null) s += 0.3 * worth(a.copy);
    if (a.row !== undefined) s += 0.9 * worth(tradeRow[a.row]);
    const fs = factionKeys(a.cardId);
    if (fs.some(f => playFactions.has(f))) s += 1.5;      // 立刻触发同盟
    else if (fs.some(f => handFactions.has(f))) s += 0.4; // 为后续同盟铺路
    s += choiceValue(a, c);
    if (recoverRate > 0) s += (t.trade + 2 * t.draw) * 0.5 * recoverRate;
    return s;
  };

  const scoreAbility = a => {
    const c = cardOf(a.cardId);
    if (!c) return 8;
    const t = traits(a.cardId);

    if (a.ability === 'ally') {
      let s = 432;
      if (a.row !== undefined) s += 1.2 * worth(tradeRow[a.row]);
      if (a.targetId) s += razeValue(a.targetId) + 6;
      for (const uid of (Array.isArray(a.targets) ? a.targets : [])) s -= 0.4 * worth(uid);
      return s;
    }

    if (a.ability === 'primary') {
      let s = 416;
      if (a.resource === 'combat') s += 3 * strike;
      if (a.resource === 'trade') s += 2.5 * (1 - strike);
      const targets = Array.isArray(a.targets) ? a.targets : null;
      if (targets) {
        for (const uid of targets) s -= 0.75 * worth(uid);
        s += targets.length * 1.8; // 弃牌再抽 / 循环，本身有滤牌价值
      }
      if (a.targetId) s += razeValue(a.targetId);
      if (a.row !== undefined) s += worth(tradeRow[a.row]);
      if (Array.isArray(a.rows)) s += a.rows.length * 0.6;
      s += choiceValue(a, c);
      return s;
    }

    if (a.ability === 'optional') {
      const touched = a.targets !== undefined || a.targetId !== undefined ||
        a.row !== undefined || a.rows !== undefined || a.resource !== undefined;
      if (!touched) return 6; // 空可选，等价于跳过，压到出牌之下
      let s = 404;
      for (const uid of (Array.isArray(a.targets) ? a.targets : [])) {
        const inDiscard = myDiscard.indexOf(uid) >= 0;
        s += inDiscard ? 4.2 : -1.4;
        s -= 0.35 * worth(uid);
        if (isStarter(uid)) s += 3;
      }
      if (a.targetId) s += razeValue(a.targetId);
      if (a.row !== undefined) s += 1.4 + 0.3 * worth(tradeRow[a.row]);
      if (Array.isArray(a.rows)) s += a.rows.length * 0.8;
      return s;
    }

    if (a.ability === 'scrap') {
      // 销毁自身是永久损失，只在终局补刀或牌本身很廉价时考虑
      let s = 10 + 1.2 * t.combat + 0.6 * t.trade + 1.4 * t.draw - 2.4 * worth(a.cardId);
      if (a.targetId) s += 1.4 * razeValue(a.targetId);
      if (finisher) s += 28;
      return s;
    }

    return 5;
  };

  const scoreBuy = a => {
    if (a.explorer) {
      let s = 320 - 15;
      if (myTrade >= 6) s += 5;
      if (risk > 0.4) s -= 5;
      return s;
    }
    const uid = tradeRow[a.row];
    const c = cardOf(uid);
    if (!c) return 305;
    const t = traits(uid);
    const cost = num(c.cost, 3);
    let s = 320 + 2.4 * worth(uid) - 1.05 * cost;
    if (factionKeys(uid).some(f => playFactions.has(f) || handFactions.has(f))) s += 2;
    if (c.outpost) s += 2 + 2.2 * risk;
    s += t.auth * (0.6 + 1.2 * risk);      // 事件常打权威，回血牌优先
    if (recoverRate > 0) s += 1.6;         // 事件后尽快补牌
    return s;
  };

  const scoreAttack = a => {
    if (a.targetType === 'player') {
      const t = players[a.targetId] || {};
      const auth = boardAuth(t);
      const amount = num(a.amount, 0);
      if (amount >= auth) return 1e9;
      let s = 210 + amount * (5 + 4 * strike);
      s += (startAuth - auth) * 0.35;
      if (mode === 'ffa') s += (auth - avgEnemy) * 0.25;
      if (isTeam) s -= outpostCount(t) * 1.5;
      return s;
    }
    if (a.targetType === 'base') {
      const c = cardOf(a.targetId);
      if (!c) return 210;
      const amount = num(a.amount, 0);
      if (amount >= baseLeft(a.targetId)) {
        const owner = ownerOf(a.targetId);
        let s = 242 + razeValue(a.targetId);
        s += (startAuth - boardAuth(owner)) * 0.2;
        return s;
      }
      // 未击破的基地伤害会在回合末清空，几乎等于浪费
      return 200 + amount * 0.3;
    }
    return 200;
  };

  const scoreTransfer = a => {
    if (!isTeam) return null;
    const amount = num(a.amount, 0);
    if (amount <= 0) return null;
    if (a.resource === 'combat') {
      if (goodAttacks.length) return null; // 还有有效输出，先打
      return 300 + amount * 0.8;
    }
    if (a.resource === 'trade') {
      if (canBuyReal) return null;         // 有真卡可买，先买
      if (myTrade < 2) return null;
      return 300 + amount * 0.8;
    }
    return null;
  };

  let best = null;
  let bestScore = -Infinity;
  let endTurn = null;
  for (const action of actions) {
    if (!action || typeof action !== 'object') continue;
    if (action.type === 'endTurn') { endTurn = action; continue; }
    let s = null;
    try {
      switch (action.type) {
        case 'play': s = scorePlay(action); break;
        case 'ability': s = scoreAbility(action); break;
        case 'buy': s = scoreBuy(action); break;
        case 'attack': s = scoreAttack(action); break;
        case 'transfer': s = scoreTransfer(action); break;
        default: s = null; // 未知动作：不主动执行，交给兜底
      }
    } catch (err) {
      s = null;
    }
    if (s === null || !Number.isFinite(s)) continue;
    const total = s + rnd() * 0.4;
    if (total > bestScore) { bestScore = total; best = action; }
  }

  if (best && bestScore > 0.5) return best;
  if (endTurn) return endTurn;
  return actions[0];
}
