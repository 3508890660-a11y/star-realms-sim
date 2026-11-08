// 策略名称：薄牌护城河（Lean Deck Rampart）
// 选择理由：牌组压缩带来复利、权威增益等效永久回血，二者构成的护城河比一次性战斗爆发更稳；待对手攻势衰竭或出现斩杀窗口再以战斗临界终结。
// 本轮更新：按 2026-11-08 程序更新 §1–§6 适配 7 模式/6 牌包、团队整队轮流与队末清算、大将战个人权威与 moveCard、double 同盟及带 choice/row/rows/targets/targetId 的新动作与未知动作兜底。

export const meta = {
  name: 'hy4 · 薄牌护城河',
  description: 'hy4std｜薄牌护城河｜以销毁废牌做复利、集中阵营滚经济、权威增益拉出不可击穿血线，仅在斩杀窗口或血线告急时切换攻防；本轮按新版程序补齐 7 模式、6 牌包、团队回合、大将战与新动作方言的适配，比堆一次性战斗更稳。'
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const isArr = Array.isArray;

// 从可见卡面 text 反写通用效果估值；未知卡、未知方言一律安全回退零值。
function textEffects(text) {
  const e = { trade: 0, combat: 0, authority: 0, draw: 0, scrap: 0, discard: 0, acquire: 0, destroyBase: 0 };
  if (typeof text !== 'string' || !text) return e;
  try {
    let m;
    const res = /(\d+)\s*(贸易|战斗|权威)/g;
    while ((m = res.exec(text)) !== null) {
      const n = num(parseInt(m[1], 10), 0);
      if (m[2] === '贸易') e.trade += n;
      else if (m[2] === '战斗') e.combat += n;
      else e.authority += n;
    }
    const dr = /抽\s*(\d+)\s*张牌/g;
    while ((m = dr.exec(text)) !== null) e.draw += num(parseInt(m[1], 10), 0);
    // 免费/降价获取（「费用不超过 N」）给一个近似价值，覆盖 frontier / crisis 新牌包。
    const ac = /费用不超过\s*(\d+)/g;
    while ((m = ac.exec(text)) !== null) e.acquire += Math.max(2, num(parseInt(m[1], 10), 0) * 0.6);
    if (/弃\s*\d+\s*张牌|目标对手弃|弃牌/.test(text)) e.discard += 1;
    if (/销毁/.test(text)) e.scrap += 1;
    if (/摧毁目标基地|摧毁一座|可摧毁/.test(text)) e.destroyBase += 1;
  } catch (_) {
    // 文本解析失败时按零值回退
  }
  return e;
}

function splitChoices(text) {
  if (typeof text !== 'string' || !text) return [];
  try {
    const m = text.match(/选择[：:]([\s\S]+)$/);
    if (!m) return [];
    return m[1].split(/；或|或|；/).map(s => s.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function choiceEffects(text, choice) {
  const opts = splitChoices(text);
  const idx = num(choice, 0);
  if (opts.length && idx >= 0 && idx < opts.length) return textEffects(opts[idx]);
  return textEffects(text);
}

function factionsOf(c) {
  if (!c) return [];
  if (isArr(c.factions) && c.factions.length) return c.factions;
  return c.faction && c.faction !== 'neutral' ? [c.faction] : [];
}

function cardValue(view, uid) {
  const c = view && view.cards ? view.cards[uid] : null;
  if (!c) return 0; // 隐藏卡实例 / 交易行空位一律判空
  const id = c.id;
  if (id === 'scout') return 0.3;   // 写死的起始牌值仅作特例，其余全部走通用字段
  if (id === 'viper') return 0.4;
  if (id === 'explorer') return 1.4;
  let v = num(c.cost, 0);
  if (c.type === 'base') v += 1.5 + num(c.defense, 0) * 0.15;
  if (c.outpost) v += 1.2;
  const e = textEffects(c.text);
  v += e.trade * 0.22 + e.combat * 0.2 + e.authority * 0.26 + e.draw * 0.5
     + e.scrap * 0.35 + e.discard * 0.3 + e.acquire * 0.25 + e.destroyBase * 0.3;
  return v;
}

function junkValue(view, uid) {
  const c = view && view.cards ? view.cards[uid] : null;
  if (!c) return 0;
  const id = c.id;
  if (id === 'scout' || id === 'viper') return 3; // 薄牌：优先销毁起始废牌
  if (id === 'explorer') return 1.2;
  if (num(c.cost, 0) <= 1 && c.type === 'ship') return 0.4;
  return -cardValue(view, uid);
}

function factionSynergy(view, playerId, faction) {
  if (!faction || faction === 'neutral') return 0;
  const me = view && view.players ? view.players[playerId] : null;
  if (!me) return 0;
  let n = 0;
  for (const zone of ['hand', 'discard', 'inPlay']) {
    const list = me[zone];
    if (!isArr(list)) continue;
    for (const uid of list) {
      const c = view.cards ? view.cards[uid] : null;
      if (!c) continue;
      if (factionsOf(c).indexOf(faction) >= 0) n++;
    }
  }
  return n;
}

function allyBonus(view, playerId, card) {
  if (!card) return 0;
  const fs = factionsOf(card);
  if (!fs.length) return 0;
  const me = view && view.players ? view.players[playerId] : null;
  const inPlay = me && isArr(me.inPlay) ? me.inPlay : [];
  for (const uid of inPlay) {
    const c = view.cards ? view.cards[uid] : null;
    if (!c) continue;
    const of = factionsOf(c);
    for (const f of fs) {
      if (f && f !== 'neutral' && of.indexOf(f) >= 0) return 3;
    }
  }
  return 0;
}

function buildCtx(view, playerId, legalActions) {
  const players = view && isArr(view.players) ? view.players : [];
  const me = players[playerId] || {};
  const myTeam = me.team;
  // 团队/大将模式的 team 为 0/1，混战为 null：用视图字段分敌友，不按座位奇偶硬推。
  const teamPlay = myTeam === 0 || myTeam === 1;
  const emperorMode = view && view.mode === 'emperor';
  const emperors = view && isArr(view.emperors) ? view.emperors : [];

  const myAuth = num(me.authority, 50);
  const myTrade = num(me.trade, 0);
  const myCombat = num(me.combat, 0);

  const opps = [];
  let refAuth = myAuth;
  for (let i = 0; i < players.length; i++) {
    const p = players[i] || {};
    if (p.eliminated) continue;
    const a = num(p.authority, myAuth);
    if (a > refAuth) refAuth = a;
    if (i === playerId) continue;
    const enemy = teamPlay ? p.team !== myTeam : true;
    if (enemy) opps.push({ id: i, authority: a, handCount: num(p.handCount, 0) });
  }
  refAuth = Math.max(1, refAuth);
  const minOppAuth = opps.length ? Math.min.apply(null, opps.map(o => o.authority)) : refAuth;

  // 相对血线：以全场最高权威动态伸缩，不再写死 50/34（适配 60 / 75 / 100 的共享血）。
  const danger = 0.62 * refAuth;
  const guard = clamp((danger - myAuth) / danger + 0.15, 0.1, 1.6);

  // 整队轮流下，同队且座位更大者会在本队回合内紧接着行动。
  let teammatesAfter = 0;
  if (teamPlay) {
    for (let i = playerId + 1; i < players.length; i++) {
      const p = players[i] || {};
      if (!p.eliminated && p.team === myTeam) teammatesAfter++;
    }
  }

  // 斩杀窗口：只认 legalActions 实际给出的玩家攻击动作与金额（信任引擎过滤，不自行推导可打谁）。
  let lethal = false;
  for (let i = 0; i < legalActions.length; i++) {
    const a = legalActions[i];
    if (a && a.type === 'attack' && a.targetType === 'player') {
      const ta = num((players[a.targetId] || {}).authority, refAuth);
      if (num(a.amount, 0) >= ta) { lethal = true; break; }
    }
  }
  const nearKill = !lethal && minOppAuth <= myCombat + 6;
  const aggro = lethal ? 3 : (nearKill ? 1.7 : (myAuth < 0.36 * refAuth ? 1.15 : 0.7));
  const greed = lethal ? 0.25 : clamp(1.2 - guard * 0.45, 0.3, 1.15);

  const handLeft = isArr(me.hand) ? me.hand.length : 0;
  const played = isArr(me.playedThisTurn) ? me.playedThisTurn.length : 0;
  const total = handLeft + played;
  const progress = total > 0 ? played / total : 1;

  return { players, me, myAuth, myTrade, myCombat, opps, minOppAuth, refAuth, guard,
           lethal, aggro, greed, progress, teamPlay, emperorMode, emperors, myTeam, teammatesAfter };
}

function scoreEventChoice(view, ctx, a) {
  const cards = view && view.cards ? view.cards : {};
  const targets = isArr(a.targets) ? a.targets : [];
  switch (a.eventId) {
    case 'blackHole': {
      let loss = 0;
      for (const uid of targets) loss += cardValue(view, uid);
      loss += 4 * (2 - targets.length) * ctx.guard * 0.7;
      return 40 - loss;
    }
    case 'comet': {
      let s = 20 + targets.length * 2;
      for (const uid of targets) s += junkValue(view, uid) * 2; // 优先销毁废牌
      return s;
    }
    case 'bombardment': {
      if (a.pay) return 30 - 6 * ctx.guard * 0.7;
      const c = cards[a.baseId] || {};
      let loss = 2 + cardValue(view, a.baseId) * 1.4;
      if (c.outpost) loss += 6;
      return 30 - loss;
    }
    case 'warpJump': {
      const cs = isArr(a.cards) ? a.cards : [];
      let s = 22;
      for (const uid of cs) s -= cardValue(view, uid) * 2;
      return s;
    }
    default:
      return 10;
  }
}

function scoreAction(view, playerId, ctx, a) {
  if (!a || typeof a !== 'object') return -1;
  const players = ctx.players;
  const cards = view && view.cards ? view.cards : {};
  const tradeRow = view && isArr(view.tradeRow) ? view.tradeRow : [];
  const rowValue = r => (r !== undefined && r !== null) ? cardValue(view, tradeRow[r]) : 0;

  switch (a.type) {
    case 'attack': {
      if (a.targetType === 'player') {
        const ta = num((players[a.targetId] || {}).authority, ctx.refAuth);
        const amt = num(a.amount, 0);
        if (amt >= ta) return 10000 + (ctx.refAuth - amt); // 斩杀（团队模式含整队权威归零）
        let s = 16 + amt * ctx.aggro + (ta < 0.3 * ctx.refAuth ? 8 : 0);
        // 大将战：压制敌方大将即逼近胜利条件；目标只取自 legalActions 的 targetId。
        if (ctx.emperorMode && ctx.emperors.indexOf(a.targetId) >= 0
            && num((players[a.targetId] || {}).team, -1) !== ctx.myTeam) s += 26;
        s *= 0.3 + 0.7 * ctx.progress;
        return s;
      }
      // 攻击基地：队末才清伤害，队友可合击同一座；全队共享前哨保护，拆前哨为整队解锁玩家攻击。
      const c = cards[a.targetId];
      let s = 16 + num(c && c.cost, 0) * 0.5 + num(c && c.defense, 0) * 0.5;
      if (c && c.outpost) s += ctx.teamPlay ? 30 : 26;
      if (ctx.teamPlay) s *= 1 + 0.25 * ctx.teammatesAfter;
      if (ctx.lethal) s *= 0.4;
      return s;
    }
    case 'play': {
      const c = cards[a.cardId] || {};
      const e = a.choice !== undefined ? choiceEffects(c.text, a.choice) : textEffects(c.text);
      let s = 12;
      s += e.trade * (0.5 + 0.7 * ctx.greed);
      s += e.combat * 0.45 * ctx.aggro;
      s += e.authority * 0.5 * ctx.guard;
      s += e.draw * 1.2;
      s += e.acquire * 0.6 + e.destroyBase * 0.5;
      s += allyBonus(view, playerId, c); // 集中阵营滚经济
      if (c.type === 'base') s += 3 + num(c.defense, 0) * 0.2;
      if (c.outpost) s += 3 * ctx.guard;
      if (a.copy) s += 2;
      if (a.row !== undefined && a.row !== null) s += 2 + rowValue(a.row) * 0.9; // choice+row 免费获取
      return s;
    }
    case 'ability': {
      const c = cards[a.cardId] || {};
      // choice / row / rows / targets / targetId 的通用奖励，任何分支都适用，不因新增字段而崩。
      let extra = 0;
      if (a.row !== undefined && a.row !== null) extra += 2 + rowValue(a.row) * 0.9;
      if (isArr(a.rows)) for (const r of a.rows) extra += 2 + rowValue(r) * 0.9;
      if (a.targetId !== undefined && a.targetId !== null) extra += 8;
      if (isArr(a.targets)) {
        for (const uid of a.targets) extra += junkValue(view, uid) > 0 ? 2 : -2;
      }
      const e = a.choice !== undefined ? choiceEffects(c.text, a.choice) : textEffects(c.text);
      switch (a.ability) {
        case 'ally': {
          // double:true 的双同盟：当作一次额外同盟机会，给加成且绝不崩。
          let s = 11 + (a.double ? 4 : 0) + extra;
          s += e.trade * 0.3 + e.combat * 0.3 * ctx.aggro + e.authority * 0.4 * ctx.guard + e.draw * 0.8;
          return s;
        }
        case 'primary': {
          let s = 9 + extra;
          s += e.trade * 0.3 + e.combat * 0.3 * ctx.aggro + e.authority * 0.4 * ctx.guard + e.draw * 0.8;
          if (a.resource === 'combat') s += 2 * ctx.aggro;
          else if (a.resource === 'trade') s += 1;
          return s;
        }
        case 'optional': {
          if (isArr(a.targets)) return extra + ctx.guard;  // 销毁废牌为主
          if (isArr(a.rows)) return 3 + extra;             // 销毁交易行多张
          if (a.row !== undefined && a.row !== null) return 3 + extra;
          return 4 + extra;
        }
        case 'scrap': {
          let s = 7 + e.trade * 0.2 + e.combat * 0.25 * ctx.aggro + e.draw * 0.6 + extra;
          if (c.type === 'base') s -= 3;
          return s;
        }
        default:
          return 6 + extra; // 未知 ability 种类兜底
      }
    }
    case 'buy': {
      if (a.explorer) return 6 * ctx.greed + (ctx.myTrade <= 3 ? 3 : 0);
      const c = cards[tradeRow[a.row]];
      if (!c) return 0; // 交易行空位 / 隐藏卡判空
      let v = cardValue(view, tradeRow[a.row]);
      const syn = factionSynergy(view, playerId, c.faction);
      v *= 1 + Math.min(syn, 6) * 0.08;
      let s = v * (1.5 * ctx.greed + 0.4);
      // 团队模式队末才弃手补牌，放宽对末段出牌的惩罚。
      s *= ctx.teamPlay ? (0.55 + 0.45 * ctx.progress) : (0.35 + 0.65 * ctx.progress);
      return s;
    }
    case 'transfer': {
      // 整队轮流：预留资源在紧接着行动的队友回合开始到账；队末才清伤害使战斗可合击。
      let s = 7 + num(a.amount, 0) * 0.14;
      const t = players[a.targetId] || {};
      if (a.targetId > playerId && num(t.team, -1) === ctx.myTeam) s += 3; // 本队回合内后续行动者，立即到账
      if (a.resource === 'combat') s += 4 * ctx.aggro;
      else s += 1;
      return s;
    }
    case 'moveCard': {
      // 大将战：花 1 贸易把弃牌堆一张牌交给相邻队友；队友连续行动、队末才弃手，本轮即可再用。
      const v = cards[a.cardId] ? cardValue(view, a.cardId) : 0;
      return 6 + v * 0.4;
    }
    case 'discard':
    case 'selectScrap':
      return 24 - cardValue(view, a.cardId) * 2; // 优先弃 / 销毁废牌
    case 'targetDiscard': {
      const p = players[a.targetId] || {};
      return 12 + num(p.handCount, 0) * 1.2 + num(p.authority, ctx.refAuth) * 0.02;
    }
    case 'eventChoice':
      return scoreEventChoice(view, ctx, a);
    case 'endTurn':
      return 0;
    default:
      // 任何未知动作类型一律打分兜底，不抛异常；低于常规动作以免喧宾夺主。
      return 0.5;
  }
}

export function chooseAction(args) {
  const input = args || {};
  const legalActions = input.legalActions;
  if (!isArr(legalActions) || legalActions.length === 0) {
    return isArr(legalActions) ? legalActions[0] : undefined;
  }
  try {
    const view = input.view || {};
    const playerId = input.playerId;
    const ctx = buildCtx(view, playerId, legalActions);
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < legalActions.length; i++) {
      let s;
      try {
        s = scoreAction(view, playerId, ctx, legalActions[i]);
      } catch (_) {
        s = -1;
      }
      if (typeof s !== 'number' || !Number.isFinite(s)) s = -1;
      if (s > bestScore) {
        bestScore = s;
        bestIdx = i;
      }
    }
    return legalActions[bestIdx];
  } catch (_) {
    return legalActions[0];
  }
}
