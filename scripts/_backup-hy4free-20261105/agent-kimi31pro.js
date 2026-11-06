// KIMI 3.1pro · 局面推演 —— 零依赖、只读决策。
// 适配 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events 任意组合。
// 不修改 view、legalActions、context 等冻结对象；始终原样返回 legalActions 中的某一个对象。
//
// 策略主题「局面推演」：
//   1. 从可见视图构建「局面画像」：模式、回合阶段、权威差、敌方前哨、牌组质量均值、剩余资源。
//   2. 把画像折算成一组边际权重（削敌权威 / 己方回血 / 战斗 / 贸易 / 牌组 / 前哨 / 场面 / 过牌 / 干扰 / 团队）。
//   3. 对每个合法动作做一步推演，估计它在各因子上的增量，加权求和得到「潜在收益」。
//   4. 按潜在收益降序排序，取第一项原样返回；对高风险事件选择施加保守修正。
//   5. 座位私有 memory 用于平滑攻防倾向、记录权威趋势与抑制重复振荡，杜绝空转。

export const meta = {
  name: 'KIMI 3.1pro · 局面推演',
  description: 'KIMI 3.1pro 局面推演：以模式、回合、权威差、前哨、牌组质量与剩余资源构建局面画像，对每类动作做一步收益推演并按潜在收益排序；高风险事件保守修正，全模式、全扩展、全待决与未知动作安全兜底。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const LETHAL = 1e7;   // 一击致胜：绝对优先
const NOOP = -60;     // 近似空操作：尽量不做
const UNKNOWN = -4;   // 未知动作：中性偏保守兜底

function decide({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return actions[0];

  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const cards = v.cards || {};
  const players = Array.isArray(v.players) ? v.players : [];
  const me = players[playerId] || {};
  const ctx = context || {};
  const cardInfo = uid => (uid != null && cards[uid]) || null;
  const isStarter = uid => {
    const c = cardInfo(uid);
    return !!c && (c.id === 'scout' || c.id === 'viper');
  };

  // ---------- 卡牌静态估值与效果画像 ----------
  const profile = text => {
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
      draw: sum(/抽\s*(\d+)\s*张/g) + (t.match(/抽牌/g) || []).length,
      discardOpp: sum(/弃\s*(\d+)\s*张牌/g),
      ally: /同盟/.test(t),
      scrap: /销毁/.test(t),
      destroyBase: /摧毁/.test(t),
      outpost: /前哨/.test(t),
      free: /免费|置于牌库顶|置入手牌/.test(t)
    };
  };
  const cardVal = uid => {
    const c = cardInfo(uid);
    if (!c) return 1.2;
    if (c.id === 'scout') return 1.0;
    if (c.id === 'viper') return 1.1;
    if (c.id === 'explorer') return 2.0;
    const e = profile(c.text);
    let val = 2.2;
    val += e.trade * 0.55 + e.combat * 0.5 + e.authority * 0.7;
    val += e.draw * 1.5 + e.discardOpp * 1.2;
    if (c.type === 'base') val += c.outpost ? 3.2 : 1.8;
    if (e.ally) val += 1.4;
    if (e.scrap) val += 0.7;
    if (e.destroyBase) val += 1.2;
    if (e.free) val += 1.6;
    if (c.faction && c.faction !== 'neutral') val += 0.4;
    val += clamp(num(c.cost, 3), 0, 8) * 0.22;
    return clamp(val, 1, 22);
  };

  // ---------- 局面画像 ----------
  const mode = ctx.mode || v.mode || 'standard';
  const turn = num(ctx.turn != null ? ctx.turn : v.turn, 1);
  const ex = v.expansions || {};
  const sets = Array.isArray(ex.sets) ? ex.sets : [];
  const hasEvents = !!ex.events || sets.includes('events');
  const isTeam = mode === 'team2v2';
  const startAuth = isTeam ? 75 : 50;
  const myAuth = num(me.authority, startAuth);
  const myTeam = me.team;

  const opponents = players.filter(p => p && p.id !== playerId && !p.eliminated &&
    (myTeam == null || p.team !== myTeam));
  const auths = opponents.map(p => num(p.authority, startAuth));
  const minEnemy = auths.length ? Math.min(...auths) : startAuth;
  const avgEnemy = auths.length ? auths.reduce((a, b) => a + b, 0) / auths.length : startAuth;

  const trade = num(me.trade, 0);
  const combat = num(me.combat, 0);
  const explorers = num(v.explorers, 0);
  const tradeDeckCount = num(v.tradeDeckCount, 0);
  const eventRemaining = num(v.eventCardsRemaining, 0);

  const enemyOutposts = opponents.reduce((n, p) =>
    n + (Array.isArray(p.inPlay) ? p.inPlay.filter(uid => cardInfo(uid) && cardInfo(uid).outpost).length : 0), 0);

  const myCards = [];
  for (const zone of [me.hand, me.discard, me.inPlay]) {
    if (Array.isArray(zone)) for (const uid of zone) myCards.push(uid);
  }
  const deckCount = num(me.deckCount, 0);
  const visSum = myCards.reduce((s, uid) => s + cardVal(uid), 0);
  const visAvg = myCards.length ? visSum / myCards.length : 1.5;
  const total = deckCount + myCards.length;
  const avgVal = total ? (visSum + deckCount * clamp(visAvg, 1.0, 2.6)) / total : 1.5;

  const early = clamp((6 - turn) / 5, 0, 1);
  const late = clamp((turn - 8) / 10, 0, 1);
  const danger = clamp((startAuth - myAuth) / startAuth, 0, 1);
  const lead = clamp((myAuth - avgEnemy) / (startAuth * 0.6), -1, 1);

  // ---------- 座位私有记忆：趋势推演与振荡抑制 ----------
  const mem = (memory && typeof memory === 'object') ? memory : null;
  let aggro = clamp(0.5 + 0.45 * lead + 0.18 * late - 0.35 * danger, 0.1, 0.95);
  let trendDef = 0;
  if (mem) {
    aggro = clamp(0.65 * num(mem._aggro, aggro) + 0.35 * aggro, 0.1, 0.95);
    mem._aggro = aggro;
    mem.calls = num(mem.calls, 0) + 1;
    const delta = myAuth - num(mem._lastAuth, myAuth);
    const t = 0.6 * num(mem._authTrend, 0) + 0.4 * delta;
    mem._authTrend = t;
    mem._lastAuth = myAuth;
    trendDef = clamp(-t / 8, 0, 0.45); // 持续掉血 → 提高防守权重
  }
  const riskAversion = 1 + 0.5 * danger + (hasEvents ? 0.4 : 0) + trendDef;

  // ---------- 多因素边际权重（模式 / 回合 / 权威差 / 前哨 / 牌组质量 / 剩余资源） ----------
  let dmgW = 6 + 9 * aggro;
  let healW = 4 + 8 * danger;
  let deckW = (7.5 + 6.5 * early) * (1 - 0.4 * late);
  let tradeW = 1.1 + 1.4 * early;
  let outpostW = 6 + 5 * danger;
  let boardW = 2.5 + 2 * early;
  let handW = 2.0 + 1.6 * early;
  const disruptW = 3.0;
  let teamW = 1.6;

  if (mode === 'standard') dmgW *= 1.05;
  if (mode === 'ffa') { dmgW *= 0.82; deckW *= 1.2; handW *= 1.1; }
  if (mode === 'hunter' || mode === 'firstBlood') { dmgW *= 1.12; outpostW *= 1.1; }
  if (mode === 'firstBlood' && playerId === 0) { healW *= 1.7; outpostW *= 1.5; dmgW *= 0.8; }
  if (isTeam) { teamW = 3.0; dmgW *= 1.06; healW *= 1.15; }
  if (myAuth <= 10) { healW *= 1.8; outpostW *= 1.4; dmgW *= 0.9; }
  if (trendDef > 0) { healW *= 1 + trendDef; outpostW *= 1 + trendDef * 0.8; dmgW *= 1 - trendDef * 0.25; }
  let combatW = 0.72 * dmgW;                 // 战斗资源的边际价值≈可转化伤害的七成
  if (enemyOutposts > 0) { combatW *= 0.62; outpostW += combat > 0 ? 4.5 : 1.5; }
  if (hasEvents) { healW *= 1.2; outpostW *= 1.15; }
  if (eventRemaining > 0) healW *= 1 + Math.min(0.25, eventRemaining * 0.02);
  if (tradeDeckCount < 10) deckW *= 0.85;
  if (explorers <= 0) tradeW *= 0.9;

  const W = {
    dmg: dmgW, heal: healW, combat: combatW, trade: tradeW, deck: deckW,
    outpost: outpostW, board: boardW, hand: handW, disrupt: disruptW, team: teamW
  };

  // 类别偏置：回合节奏（先兑现手牌与免费能力，再购买、再攻击）
  const bias = {
    play: 1.2 + 1.2 * early - 0.6 * late,
    buy: 0.8 + 2.2 * early - 1.2 * late,
    ability: 6.0,
    attack: (mode === 'ffa' ? -0.6 : 0.4) + 1.2 * late,
    transfer: 0.2
  };

  // ---------- 合法动作概览（用于「资源是否会被浪费」的推演） ----------
  const hasBuy = actions.some(a => a && a.type === 'buy');
  const destroysBase = a => {
    const c = cardInfo(a.targetId);
    return num((v.damage || {})[a.targetId], 0) + num(a.amount, 0) >= num(c && c.defense, 1);
  };
  const hasProdAttack = actions.some(a => a && a.type === 'attack' &&
    (a.targetType === 'player' || destroysBase(a)));
  const productive = actions.filter(a => a && (a.type === 'play' || a.type === 'ability')).length;

  // ---------- 一步推演：把动作折算为各因子增量 ----------
  const deltas = () => ({
    dmg: 0, heal: 0, combat: 0, trade: 0, deck: 0, outpost: 0, myOutpost: 0,
    board: 0, hand: 0, disrupt: 0, team: 0, risk: 0, bias: 0
  });

  // 高风险事件的保守修正：权威损失全价计风险，可回收损失折价，永久损失好牌重罚。
  const projectEvent = (a, d) => {
    const kind = a.eventId || (v.pending && (v.pending.kind || v.pending.eventId)) || '';
    const targets = Array.isArray(a.targets) ? a.targets : [];
    const putBack = Array.isArray(a.cards) ? a.cards : [];
    const authRisk = W.heal * 1.8 * riskAversion;
    switch (kind) {
      case 'blackHole': {
        const missing = Math.max(0, 2 - targets.length);
        const loss = myAuth - Math.max(1, myAuth - 4 * missing);
        d.risk -= loss * authRisk;                         // 少弃牌即掉权威：保守加权
        for (const uid of targets) d.risk -= cardVal(uid) * 0.35; // 弃牌可回收，折价计损失
        break;
      }
      case 'bombardment': {
        if (a.pay) {
          const loss = myAuth - Math.max(1, myAuth - 6);
          d.risk -= loss * authRisk;
        } else if (a.baseId) {
          const c = cardInfo(a.baseId);
          d.risk -= cardVal(a.baseId) * 0.45 + (c && c.outpost ? 3 : 0.6); // 基地进弃牌堆可回归
        } else d.risk -= 1;
        break;
      }
      case 'comet': {
        for (const uid of targets) {
          const cv = cardVal(uid);
          const diff = avgVal - cv;
          if (isStarter(uid)) d.deck += 1.6 + Math.max(0, diff) * 0.4;   // 压缩初始牌
          else if (diff >= 0) d.deck += diff * 0.5;
          else d.risk -= (cv - avgVal) * 8 + 10;                           // 保守：绝不销毁好牌
        }
        break;
      }
      case 'warpJump': {
        for (const uid of putBack) d.risk -= cardVal(uid) * 0.45;          // 把最差两张放回牌库顶
        break;
      }
      default: {
        for (const uid of [...targets, ...putBack]) d.risk -= cardVal(uid) * 0.5;
        if (a.pay) d.risk -= 6 * authRisk * 0.6;
        if (a.baseId) d.risk -= cardVal(a.baseId) * 0.35;
        if (!targets.length && !putBack.length && !a.pay && !a.baseId) d.bias += 1; // 未知事件：安全跳过
        break;
      }
    }
    return d;
  };

  const project = a => {
    const d = deltas();
    if (!a || typeof a !== 'object') { d.bias = UNKNOWN; return d; }
    switch (a.type) {
      case 'endTurn': {
        const waste = (hasBuy ? trade : 0) * W.trade + (hasProdAttack ? combat : 0) * W.combat;
        d.bias = -2 - 0.8 * waste;   // 回合末清零的余量是机会成本
        return d;
      }
      case 'attack': {
        const amt = num(a.amount, 0);
        d.combat = -amt;
        if (a.targetType === 'base') {
          const c = cardInfo(a.targetId);
          const def = num(c && c.defense, 1);
          const destroyed = num((v.damage || {})[a.targetId], 0) + amt >= def;
          if (destroyed) {
            d.board = c && c.outpost ? 1.6 : 0.8;
            if (c && c.outpost) d.outpost = 1;   // 拔除前哨：解锁对玩家攻击
          }
          // 未摧毁的削减伤害回合末清零，不记收益
        } else {
          const t = players[a.targetId] || {};
          const auth = num(t.authority, startAuth);
          d.dmg = amt + (startAuth - auth) * 0.04;
          if (amt >= auth) d.bias += LETHAL;
          if (auth <= minEnemy + 1) d.bias += 6;   // 集火最弱 / 最接近出局者
        }
        d.bias += bias.attack;
        return d;
      }
      case 'play': {
        const src = cardInfo(a.copy) || cardInfo(a.cardId);
        const e = profile(src && src.text);
        const k = a.choice !== undefined ? 0.7 : 1;   // 选择型主能力按七折算
        d.trade += e.trade * k;
        d.combat += e.combat * k;
        d.heal += e.authority * k;
        d.hand += e.draw * k;
        d.disrupt += e.discardOpp * k;
        if (e.destroyBase) d.board += 0.9;
        if (a.copy) { d.deck += 0.6; d.bias += 2; }
        if (a.row !== undefined) {
          d.deck += (cardVal((v.tradeRow || [])[a.row]) - avgVal) * 1.0;  // 免费获得
          d.bias += 4;
        }
        if (src && src.type === 'base') d.board += 0.8;
        if (src && src.outpost) d.myOutpost += 1;
        if (a.choice !== undefined) d.bias += num(a.choice, 0) * 0.02;
        d.bias += bias.play;
        return d;
      }
      case 'ability': {
        const c = cardInfo(a.cardId);
        const kind = a.ability;
        let txt = c ? c.text : '';
        if (kind === 'ally') { const i = txt.indexOf('同盟'); txt = i >= 0 ? txt.slice(i) : txt; }
        else if (kind === 'scrap') { const i = txt.indexOf('销毁：'); txt = i >= 0 ? txt.slice(i) : txt; }
        else if (kind === 'optional') txt = '';   // 可选能力以 targets / rows / targetId 为准
        const e = profile(txt);
        d.trade += e.trade; d.combat += e.combat; d.heal += e.authority;
        d.hand += e.draw; d.disrupt += e.discardOpp;
        if (a.targetId !== undefined && a.targetId !== null) {
          const bc = cardInfo(a.targetId);
          if (bc) { d.board += 0.8; if (bc.outpost) d.outpost += 1; }
          else d.board += 0.5;
        }
        const rows = Array.isArray(a.rows) ? a.rows : (a.row !== undefined ? [a.row] : []);
        for (const r of rows) {
          const uid = (v.tradeRow || [])[r];
          if (kind === 'ally' || e.free) d.deck += (cardVal(uid) - avgVal) * 0.9;  // 免费获得
          else d.board += 0.25 + cardVal(uid) * 0.04;                              // 销毁交易行：干扰
        }
        const targets = Array.isArray(a.targets) ? a.targets : [];
        for (const uid of targets) d.deck += (avgVal - cardVal(uid)) * (kind === 'optional' ? 1.0 : 0.55);
        if (a.resource) {
          const amt = 2 * targets.length;
          if (a.resource === 'combat') d.combat += amt; else d.trade += amt;
        }
        if (kind === 'scrap') d.deck += (avgVal - cardVal(a.cardId)) * 0.45;  // 失去自身牌
        const magnitude = Math.abs(d.trade) + Math.abs(d.combat) + Math.abs(d.heal) +
          Math.abs(d.deck) + Math.abs(d.hand) + Math.abs(d.board) + Math.abs(d.disrupt) +
          Math.abs(d.outpost) + Math.abs(d.myOutpost);
        if (magnitude < 0.001 && a.choice === undefined) d.bias += NOOP;  // 近似空操作
        d.bias += bias.ability + (kind === 'ally' ? 1.5 : 0);
        return d;
      }
      case 'buy': {
        const uid = a.explorer ? null : (v.tradeRow || [])[a.row];
        const c = a.explorer ? null : cardInfo(uid);
        const cv = a.explorer ? 2.0 : cardVal(uid);
        const cost = a.explorer ? 2 : num(c && c.cost, 2);
        d.trade -= cost;
        d.deck += cv - avgVal;
        if (!a.explorer && c && c.type === 'base') d.board += 0.7;
        if (!a.explorer && c && c.outpost) d.myOutpost += 1;
        if (!a.explorer && c && Array.isArray(c.factions)) {
          const owned = new Set();
          for (const u of (Array.isArray(me.inPlay) ? me.inPlay : [])) {
            const ic = cardInfo(u);
            if (ic && Array.isArray(ic.factions)) for (const f of ic.factions) owned.add(f);
          }
          if (c.factions.some(f => owned.has(f))) d.deck += 0.9;  // 阵营协同 / 同盟潜力
        }
        // 先兑现手牌与免费能力，再购买：仍有可用动作时压低购买优先级
        if (productive > 0) d.bias -= Math.min(60, 18 * productive);
        d.bias += bias.buy;
        return d;
      }
      case 'transfer': {
        const amt = num(a.amount, 0);
        d.team += amt * 0.15;              // 资源转入队友预留，不会在回合末清零
        d.bias += 0.2 * amt + bias.transfer;
        return d;
      }
      case 'discard': {
        d.bias -= cardVal(a.cardId) * 1.6;   // 我是弃牌者：弃掉最差的一张
        return d;
      }
      case 'selectScrap': {
        d.deck += (avgVal - cardVal(a.cardId)) * 1.2;  // 永久移除：压掉差牌即提升牌组质量
        d.bias += isStarter(a.cardId) ? 10 : 0;
        return d;
      }
      case 'targetDiscard': {
        const t = players[a.targetId] || {};
        const auth = num(t.authority, startAuth);
        const hc = num(t.handCount, Array.isArray(t.hand) ? t.hand.length : 0);
        const threat = Array.isArray(t.inPlay) ? t.inPlay.length : 0;
        d.bias += W.disrupt + hc * 0.8 + threat * 0.6 + (startAuth - auth) * 0.12;
        return d;
      }
      case 'eventChoice':
        return projectEvent(a, d);
      default:
        d.bias = UNKNOWN;   // 未知动作：安全兜底
        return d;
    }
  };

  const evaluate = d =>
    W.dmg * d.dmg + W.heal * d.heal + W.combat * d.combat + W.trade * d.trade +
    W.deck * d.deck + W.outpost * (d.outpost + 0.7 * d.myOutpost) +
    W.board * d.board + W.hand * d.hand + W.disrupt * d.disrupt +
    W.team * d.team + d.risk + d.bias;

  const lastSig = mem ? mem._lastSig : null;
  const rep = mem ? num(mem._repeat, 0) : 0;
  const scored = [];
  for (const a of actions) {
    let s;
    try { s = evaluate(project(a)); } catch (err) { s = UNKNOWN; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = UNKNOWN;
    // 极端情况下打破「同一动作反复出现」的振荡，上限很小，不影响主要排序
    if (lastSig && rep >= 3) {
      try { if (JSON.stringify(a) === lastSig) s -= Math.min(24, (rep - 2) * 4); } catch (err) { /* 忽略 */ }
    }
    s += rnd() * 0.001;   // 极小抖动，仅用于打破完全平分
    scored.push({ a, s });
  }
  scored.sort((x, y) => y.s - x.s);
  const best = scored[0].a;   // 仍是 legalActions 中的原始对象

  if (mem) {
    let sig;
    try { sig = JSON.stringify(best); } catch (err) { sig = String(best && best.type); }
    if (sig === mem._lastSig) mem._repeat = num(mem._repeat, 0) + 1;
    else { mem._lastSig = sig; mem._repeat = 1; }
  }
  return best;
}

export function chooseAction(opts) {
  try {
    return decide(opts);
  } catch (err) {
    const a = Array.isArray(opts && opts.legalActions) ? opts.legalActions : [];
    return a[0];   // 兜底：仍返回一个合法动作
  }
}
