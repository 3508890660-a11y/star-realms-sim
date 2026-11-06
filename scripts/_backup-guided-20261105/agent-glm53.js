// GLM5.3 · 舰队协同 —— 零依赖、只读决策 AI（执行模型 ID：glm-5.3）
//
// 策略主题：同阵营聚集、同盟触发、连锁购买与出牌顺序。
//   1) 阵营普查：统计手牌 / 弃牌 / 场上的阵营分布，得到牌组主导阵营与场上阵营；
//   2) 同盟点火：估计每张牌打出后能新点亮多少个未触发的同盟能力，点火越多越优先；
//   3) 连锁出牌：抽牌 / 免费获得 / 获得资源的牌优先，让本回合继续有牌可打；
//   4) 聚集购买：偏好与牌组主导阵营一致、带同盟能力的卡，放大后续回合的协同；
//   5) 通用骨架：lethal → 拆阻挡直伤的敌方前哨 → 出牌与同盟 → 有价值购买 →
//      削血攻击 → 2V2 资源预留 → 兜底 → 结束回合。
//
// 兼容 standard / ffa / hunter / firstBlood / team2v2 与 core / colonyWars / events
// 的任意组合；只依赖通用字段（factions / cost / type / outpost / defense / text），
// 不硬编码卡名。任何决策点都返回 legalActions 中的原对象引用，绝不修改冻结数据，
// 未知动作、未知事件一律进入安全兜底档，配合反停滞记忆杜绝死循环。

export const meta = {
  name: 'GLM5.3 · 舰队协同',
  description: 'glm-5.3 · 舰队协同策略：以同阵营聚集、同盟触发与连锁出牌/购买为核心，含 lethal、拆前哨、2V2 transfer 与事件待决兜底，兼容五种模式与任意牌包组合。'
};

const T = {
  outpostBreak: 13000, // 摧毁阻挡直伤的敌方前哨
  play: 12000,         // 出牌（叠加同盟点火加成后为实际最高频动作）
  allyAbility: 11000,  // 已触发的同盟能力
  primaryAbility: 10800,
  optionalAbility: 10600,
  destroyBase: 10000,  // 摧毁敌方普通基地
  buy: 9500,
  attackPlayer: 9000,  // 对玩家倾泻战斗
  scrapAbility: 6200,  // 销毁能力（会失去自身，谨慎）
  transfer: 5600,      // 2V2 预留余量给队友
  attackChip: 5200,    // 未摧毁的基地削血（本回合末清零，仅兜底）
  unknown: 3000,       // 未知动作安全兜底
  endTurn: 0
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v)) ? v : d;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const arr = v => Array.isArray(v) ? v : [];

export function chooseAction(input) {
  const actions = Array.isArray(input && input.legalActions) ? input.legalActions : [];
  if (!actions.length) return actions[0];
  try {
    return decide(input, actions);
  } catch (err) {
    // 兜底：任何异常都退化为「lethal → 首个非 endTurn → 首个动作」，兜底本身绝不抛错
    try {
      const ps = (input.view && input.view.players) || [];
      const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
        ps[a.targetId] && typeof ps[a.targetId].authority === 'number' &&
        a.amount >= ps[a.targetId].authority);
      if (lethal) return lethal;
    } catch (err2) { /* 继续兜底 */ }
    return actions.find(a => a && a.type !== 'endTurn') || actions[0];
  }
}

function decide({ view, legalActions, playerId, random, memory, context } = {}, actions) {
  const rnd = typeof random === 'function' ? random : () => 0.5;
  const v = view || {};
  const players = arr(v.players);
  const me = players[playerId] || {};
  const cards = v.cards || {};
  const mode = (context && context.mode) || v.mode || 'standard';
  const turn = num(context && context.turn, num(v.turn, 0));
  const startAuth = mode === 'team2v2' ? 75 : 50;
  const myTeam = me.team == null ? null : me.team;
  const early = turn < 12;

  const info = uid => (uid != null && cards[uid]) || null;
  const tradeRowAt = row => (arr(v.tradeRow))[num(row, -1)];
  const isStarter = uid => { const c = info(uid); return !!c && (c.id === 'scout' || c.id === 'viper'); };

  // —— 阵营普查：deckFactions 为长期聚集目标，fieldFactions 决定本回合同盟触发 ——
  const factionsOf = uid => {
    const c = info(uid);
    if (!c) return [];
    if (Array.isArray(c.factions) && c.factions.length) return c.factions.filter(f => f && f !== 'neutral');
    return c.faction && c.faction !== 'neutral' ? [c.faction] : [];
  };
  const deckFactions = Object.create(null);
  const fieldFactions = Object.create(null);
  const census = (list, table) => {
    for (const uid of arr(list)) {
      for (const f of factionsOf(uid)) table[f] = (table[f] || 0) + 1;
    }
  };
  census(me.hand, deckFactions);
  census(me.discard, deckFactions);
  census(me.inPlay, deckFactions);
  census(me.inPlay, fieldFactions);

  // —— 规则文本解析（core / colonyWars 通用口径）——
  const effectOf = uid => {
    const c = info(uid);
    const t = c && typeof c.text === 'string' ? c.text : '';
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
      draws: /抽/.test(t),
      ally: /同盟/.test(t),
      free: /免费|置于牌库顶|置入手牌/.test(t),
      destroy: /摧毁/.test(t)
    };
  };

  // —— 协同价值：效果强度 + 与己方阵营的聚集契合度 ——
  const cardValue = uid => {
    const c = info(uid);
    if (!c) return 2;
    if (c.id === 'scout' || c.id === 'viper') return 1;
    if (c.id === 'explorer') return 2;
    const e = effectOf(uid);
    let val = 2 + Math.min(num(c.cost, 3), 9) * 0.4;
    val += e.trade * 0.5 + e.combat * 0.45 + e.authority * 0.55;
    val += e.draw * 1.6 + (e.draws ? 0.8 : 0);
    if (c.type === 'base') val += c.outpost ? 1.8 : 1.0;
    if (e.ally) val += 1.4;   // 同盟能力 = 连锁节点
    if (e.free) val += 1.2;
    if (e.destroy) val += 0.8;
    let fit = 0;
    for (const f of factionsOf(uid)) fit += (deckFactions[f] || 0) + (fieldFactions[f] || 0) * 2;
    val += Math.min(fit, 8) * 0.45;
    return val;
  };

  // —— 同盟点火：打出这张牌预计新点亮的同盟能力数量 ——
  const triggered = (me && typeof me.triggered === 'object' && me.triggered) || {};
  const allyIgnition = uid => {
    const fs = factionsOf(uid);
    if (!fs.length) return 0;
    let lit = 0;
    if (effectOf(uid).ally && fs.some(f => (fieldFactions[f] || 0) > 0)) lit++;
    for (const other of arr(me.inPlay)) {
      if (other === uid || triggered[other]) continue;
      if (effectOf(other).ally && factionsOf(other).some(f => fs.includes(f))) lit++;
    }
    return lit;
  };

  const authOf = p => num((p || {}).authority, 9999);

  // ============ 主阶段动作打分 ============
  const mainScore = a => {
    switch (a.type) {
      case 'endTurn':
        return T.endTurn;

      case 'play': {
        let b = Math.min(cardValue(a.cardId) * 45, 620);
        b += Math.min(allyIgnition(a.cardId) * 260, 780);       // 同阵营连锁：核心加成
        const e = effectOf(a.cardId);
        if (e.draws) b += 130;                                   // 抽牌延长连锁
        b += Math.min(e.draw * 90, 270);
        b += Math.min(e.trade * 30, 120);
        b += Math.min(e.combat * 22, 110);
        if (e.free) b += 160;
        if (a.copy) b += Math.min(cardValue(a.copy) * 40, 500); // 复制本回合强牌
        if (a.row !== undefined) {                               // 选择效果中的免费获得
          const uid2 = tradeRowAt(a.row);
          if (uid2) b += Math.min(cardValue(uid2) * 50, 650);
        }
        return T.play + clamp(b, -400, 900);
      }

      case 'ability': {
        const kind = a.ability;
        let base = kind === 'ally' ? T.allyAbility
          : kind === 'primary' ? T.primaryAbility
          : kind === 'optional' ? T.optionalAbility
          : kind === 'scrap' ? T.scrapAbility
          : T.unknown;
        // 显式 targetId:null 是「摧毁目标基地」类销毁能力的空选项，近似无操作
        if (kind === 'scrap' && a.targetId === null) return -500;
        let b = 0;
        const own = cardValue(a.cardId);
        const e = effectOf(a.cardId);
        if (a.targetId != null) {
          // 摧毁敌方基地（可选能力 / 同盟 / 销毁能力）：不花战斗，价值极高
          const c = info(a.targetId);
          b += 250 + Math.min(cardValue(a.targetId) * 40, 500);
          base = c && c.outpost ? T.outpostBreak : T.destroyBase;
          if (kind === 'scrap') b -= Math.min(own * 40, 420);    // 销毁能力会失去自身
        } else if (kind === 'scrap') {
          // 普通销毁能力：换取资源但永久失去该牌
          b += Math.min(e.combat * 25, 100) + Math.min(e.trade * 25, 100) + Math.min(e.draw * 90, 200);
          b -= Math.min(own * 25, 250);
        }
        if (a.row !== undefined) {                                // 销毁交易行一张牌
          b += 150 - Math.min(cardValue(tradeRowAt(a.row)) * 40, 420);
        }
        if (Array.isArray(a.rows)) {
          for (const r of a.rows) b += 75 - Math.min(cardValue(tradeRowAt(r)) * 20, 200);
        }
        if (Array.isArray(a.targets)) {
          if (!a.targets.length) b -= 350;                        // 什么都不选近似空操作
          else for (const uid of a.targets) {
            b += isStarter(uid) ? 150 : -Math.min(cardValue(uid) * 38, 400); // 压缩优先、好牌不弃
          }
        }
        if (a.resource) b += early ? (a.resource === 'trade' ? 60 : 10) : (a.resource === 'combat' ? 60 : 10);
        if (kind === 'ally') {
          b += Math.min(e.draw * 90, 270);
          if (e.free) b += 150;
          b += Math.min(e.combat * 15, 60);
          if (e.destroy) b += 80;
        }
        return base + clamp(b, -900, 900);
      }

      case 'buy': {
        if (a.explorer) return T.buy - 400;                       // 探索者：低价值填充
        const uid = tradeRowAt(a.row);
        if (!uid) return T.buy - 500;
        const e = effectOf(uid);
        let b = Math.min(cardValue(uid) * 55, 780);
        if (factionsOf(uid).some(f => (fieldFactions[f] || 0) > 0)) b += 120; // 与场上阵营呼应
        if (!early) b += Math.min(e.combat * 12, 140);            // 后期偏战斗
        else b += Math.min(e.trade * 14, 120);                    // 前期偏经济
        if (cardValue(uid) < 5 && turn >= 8) b -= 4500;           // 垃圾购买门槛：宁可不买
        return T.buy + clamp(b, -3200, 900);
      }

      case 'attack': {
        const amt = num(a.amount, 0);
        if (a.targetType === 'base') {
          const c = info(a.targetId);
          const dmg = num((v.damage || {})[a.targetId], 0);
          const def = num(c && c.defense, 5);
          const outpost = !!(c && c.outpost);
          if (dmg + amt >= def) {
            if (outpost) return T.outpostBreak + 200 + Math.min(def, 12) * 40;
            return T.destroyBase + Math.min(cardValue(a.targetId) * 30, 420);
          }
          return T.attackChip + (outpost ? 60 : 0);               // 未摧毁的削血回合末清零
        }
        const p = players[a.targetId] || {};
        const auth = authOf(p);
        let b = Math.min(amt * 34, 680);                          // 倾尽全部战斗
        b += Math.min(Math.max(startAuth - auth, 0), startAuth) * 6; // 聚焦残血
        if (auth - amt <= 8) b += 150;
        return T.attackPlayer + clamp(b, 0, 900);
      }

      case 'transfer': {                                          // 2V2：余量预留给队友
        const p = players[a.targetId] || {};
        if (p.eliminated) return T.transfer - 4000;               // 不预留给出局队友
        let b = Math.min(num(a.amount, 0) * 30, 600);
        if (a.resource === 'combat') b += 30;                     // 战斗无法留存，优先接续
        return T.transfer + clamp(b, 0, 700);
      }

      default:
        return T.unknown;                                         // 未知动作：安全兜底
    }
  };

  // ============ 待决动作打分 ============
  const eventScore = a => {
    switch (a.eventId) {
      case 'blackHole': {                                         // 弃至多 2 张，每少弃失 4 权威
        const ts = Array.isArray(a.targets) ? a.targets : [];
        let cost = 0;
        for (const uid of ts) cost += cardValue(uid);
        const missing = Math.max(0, 2 - ts.length);
        return 400 - cost * 60 - missing * 340;
      }
      case 'bombardment': {                                       // 摧毁自己一座基地，或失 6 权威
        if (a.pay) return -260;
        const c = info(a.baseId);
        let cost = Math.min(cardValue(a.baseId) * 70, 900);
        if (c && c.outpost) cost += 380;                          // 前哨有保护价值，尽量不弃
        return 200 - cost;
      }
      case 'comet': {                                             // 永久销毁至多 2 张：只销初始/低值牌
        const ts = Array.isArray(a.targets) ? a.targets : [];
        let s = 60;
        for (const uid of ts) s -= isStarter(uid) ? 0 : Math.min(cardValue(uid) * 60, 700);
        return s;
      }
      case 'warpJump': {                                          // 抽 3 放 2 回牌库顶：差牌放回
        const cs = Array.isArray(a.cards) ? a.cards : [];
        let s = 100;
        for (const uid of cs) s -= Math.min(cardValue(uid) * 70, 800);
        if (cs.length >= 2 && cardValue(cs[0]) >= cardValue(cs[1])) s += 40;
        return s;
      }
      default:
        return 0;                                                 // 未知事件：中性兜底
    }
  };

  const pendingScore = a => {
    switch (a.type) {
      case 'discard':                                             // 弃价值最低的牌
        return -cardValue(a.cardId) * 80;
      case 'selectScrap':                                         // 强制销毁：销初始/低值牌
        return -cardValue(a.cardId) * 80 - (isStarter(a.cardId) ? 60 : 0);
      case 'targetDiscard': {                                     // 指定对手弃牌：挑手多、非队友
        const p = players[a.targetId] || {};
        if (myTeam != null && p.team === myTeam) return -2000;
        return 400 + num(p.handCount, 0) * 45 + arr(p.inPlay).length * 30;
      }
      case 'eventChoice':
        return eventScore(a);
      default:
        return 0;                                                 // 未知待决：中性兜底
    }
  };

  const PENDING = { discard: 1, selectScrap: 1, targetDiscard: 1, eventChoice: 1 };
  const score = a => {
    if (!a || typeof a !== 'object') return T.unknown;
    if (PENDING[a.type]) return pendingScore(a);
    if (v.pending) return 0;                                      // 待决期出现未知类型
    return mainScore(a);
  };

  // —— lethal：一击致胜绝对优先（team2v2 的 authority 为全队共享镜像，同样成立）——
  const lethal = actions.find(a => a && a.type === 'attack' && a.targetType === 'player' &&
    num(a.amount, 0) >= authOf(players[a.targetId]));
  if (lethal) return lethal;

  // —— 只读择优：手动扫最大值，不排序、不修改 legalActions ——
  let best = actions[0];
  let bestScore = -Infinity;
  for (let i = 0; i < actions.length; i++) {
    let s;
    try { s = score(actions[i]); } catch (err) { s = null; }
    if (typeof s !== 'number' || !Number.isFinite(s)) s = v.pending ? 0 : T.unknown;
    s += (rnd() - 0.5) * 0.9;                                     // 极小抖动仅打破平分
    if (s > bestScore) { bestScore = s; best = actions[i]; }
  }

  // —— 反停滞：同一动作被连续选中过多次时强制结束回合，杜绝未知动作死循环 ——
  if (memory && typeof memory === 'object') {
    try {
      memory.calls = num(memory.calls, 0) + 1;
      let sig = '';
      try { sig = JSON.stringify(best); } catch (err) { sig = String(best && best.type); }
      if (sig && sig === memory.lastSig) memory.stall = num(memory.stall, 0) + 1;
      else { memory.lastSig = sig; memory.stall = 0; }
      if (memory.stall >= 8) {
        const end = actions.find(a => a && a.type === 'endTurn');
        if (end) { memory.stall = 0; return end; }
      }
    } catch (err) { /* memory 不可写时忽略 */ }
  }

  return best;
}
