// MiniMax M3.1flash · 牌组压缩
// ----------------------------------------------------------------------------
// 零依赖脚本：不使用 import / require，不读写冻结的 view / legalActions。
// 每一次决策都从 legalActions 里原样挑出一个对象返回，绝不自造动作。
//
// 策略主题「牌组压缩」：
//   1) 玩家自己的牌库开局就是 8 张侦察艇 + 2 张毒蛇战机，牌组里真正拖后腿的
//      就是这些初始废牌。只要出现能永久销毁自有牌的时机（可销毁手牌 / 弃牌堆
//      的能力、强制销毁、彗星事件、自身销毁能力），优先把它们从牌组里拿掉。
//   2) 过牌与弃牌循环是压缩的放大器：抽牌看到好牌、弃牌把废牌送出视线，
//      所以「抽 N 张 / 弃至多两张再抽等量 / 弃牌换资源」权重偏高。
//   3) 贸易只花在净收益为正的牌上；纯粹稀释牌组的便宜牌与探索者优先级最低。
//   4) 牌面价值从规则文本粗估（贸易 / 战斗 / 权威 / 抽牌 / 同盟 / 摧毁基地 /
//      免费获得 / 可销毁自有牌），不硬编码完整卡表，任意牌包通用。
//
// 适配 standard / ffa / hunter / firstBlood / team2v2 五种模式，
// 以及 core / colonyWars / events 的任意组合。

export const meta = {
  name: 'MiniMax M3.1flash · 牌组压缩',
  description: 'minimax-m3.1-flash 牌组压缩策略：优先永久销毁 Scout/Viper/Explorer 等低效牌，重视抽牌与弃牌循环，贸易只投入净收益为正的牌；适配 standard/ffa/hunter/firstBlood/team2v2 与 core/colonyWars/events 任意组合，并安全兜底全部待决与未知动作。'
};

// ---------------------------------------------------------------------------
// 分层优先级。层间距远大于层内修正量，保证「层」的顺序永远稳定，
// 修正量只用来在层内择优。
// ---------------------------------------------------------------------------
const TIERS = {
  outpostBreak: 340000, // 拆掉阻挡直伤的敌方前哨
  play: 290000,          // 打出手牌 / 使用能力
  ally: 275000,          // 同盟能力
  abilityOther: 260000,  // 主要 / 可选能力
  buy: 240000,           // 有价值的购买
  attackPlayer: 220000,  // 对玩家造成伤害
  attackBase: 200000,    // 拆基地 / 削基地血
  junkPlay: 130000,      // 打初始废牌（收益打折）
  transfer: 120000,      // 2V2 资源预留
  fallback: 100000,      // 未知动作 / 不划算的购买兜底
  noop: -6000,           // 空转动作（白白消耗一次能力），宁可结束回合
  endTurn: -5000         // 结束回合
};

// 内部价值刻度：1 点战斗 ≈ 1 点伤害 ≈ 0.9 点贸易 ≈ 1.2 点权威 ≈ 2.5 点抽牌。
const POINTS = { trade: 0.9, combat: 1, authority: 1.2, draw: 2.5 };
const SCALE = 12; // 内部点数 → 分数修正的换算系数

// 压缩权重：销毁废牌的奖励，以及销毁好牌的惩罚（惩罚更陡，宁可不用这能力）。
const THIN_REWARD = 200;
const THIN_LOSS = 1200;

const FACTION_WORDS = {
  虫群: 'blob',
  机械教团: 'machine',
  星际帝国: 'empire',
  贸易联邦: 'federation'
};

const num = (value, fallback) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

function sumOf(text, re) {
  let total = 0;
  for (const match of String(text).matchAll(re)) total += Number(match[1]) || 0;
  return total;
}

// 把一段规则文本折算成内部点数。
function pointsOf(snippet) {
  const text = typeof snippet === 'string' ? snippet : '';
  let value =
    sumOf(text, /获得\s*(\d+)\s*贸易/g) * POINTS.trade +
    sumOf(text, /获得\s*(\d+)\s*战斗/g) * POINTS.combat +
    sumOf(text, /获得\s*(\d+)\s*权威/g) * POINTS.authority +
    sumOf(text, /抽\s*(\d+)\s*张/g) * POINTS.draw;
  if (/再抽等量牌|抽等量/.test(text)) value += POINTS.draw * 2;
  return value;
}

// 解析卡面规则文本：主段 / 同盟段 / 销毁段，以及「选择：」的多个分支。
function parseCard(text) {
  const raw = typeof text === 'string' ? text : '';
  const primaryParts = [];
  const allyParts = [];
  const scrapParts = [];
  for (const segment of raw.split('。')) {
    const piece = segment.trim();
    if (!piece) continue;
    if (piece.includes('同盟')) allyParts.push(piece);
    else if (/^销毁[：:]/.test(piece)) scrapParts.push(piece);
    else primaryParts.push(piece);
  }
  const primaryText = primaryParts.join('。');
  const allyText = allyParts.join('。');
  const scrapText = scrapParts.join('。');

  let options = [];
  const choiceMatch = primaryText.match(/选择[：:]([^。]*)/);
  if (choiceMatch) {
    const body = choiceMatch[1];
    const bySemicolon = body.split('；').map(part => part.replace(/^或/, '').trim()).filter(Boolean);
    options = bySemicolon.length >= 2 ? bySemicolon : body.split('或').map(part => part.trim()).filter(Boolean);
  }

  return {
    raw,
    primaryText,
    allyText,
    scrapText,
    options,
    ally: allyParts.length > 0,
    scrapOwn: /销毁[^。]*?(手牌|弃牌堆)/.test(raw),
    destroyBase: /摧毁目标基地/.test(raw),
    free: /免费获得/.test(raw),
    topDeck: /置于牌库顶/.test(raw),
    recycle: /再抽等量牌|抽等量/.test(raw),
    discardThenDraw: /弃[^。]*?然后抽/.test(raw),
    depot: /每弃一张/.test(raw),
    drawPerScrap: /每销毁一张[^。]*?抽/.test(raw),
    combatPerScrap: /每销毁一张[^。]*?战斗/.test(raw)
  };
}

// 废牌程度：1 = 纯拖后腿的初始牌，0 = 值得留在牌组里的牌。
const JUNK_BY_ID = { scout: 1, viper: 0.95, explorer: 0.6 };

function junkLevel(id, parse, cost) {
  const known = JUNK_BY_ID[id];
  if (known !== undefined) return known;
  const useful =
    parse.ally ||
    parse.scrapOwn ||
    parse.destroyBase ||
    parse.free ||
    parse.recycle ||
    parse.discardThenDraw ||
    parse.depot ||
    parse.drawPerScrap ||
    parse.combatPerScrap ||
    pointsOf(parse.primaryText) >= POINTS.draw;
  if (useful) return 0;
  if (cost <= 1) return 0.35;
  if (cost <= 2) return 0.2;
  if (cost <= 3) return 0.1;
  return 0.04;
}

// 留牌价值：这张牌留在牌组里、留在场上还有多少价值。
function keepValue(parse, cost, isBase, isOutpost) {
  let value = cost * 0.22;
  if (pointsOf(parse.primaryText) >= POINTS.draw) value += 2;
  if (parse.ally) value += 1.4;
  if (isOutpost) value += 1.8;
  if (parse.scrapOwn) value += 2.2;
  if (parse.destroyBase) value += 1.4;
  if (parse.free) value += 1.2;
  if (parse.recycle || parse.discardThenDraw) value += 1.2;
  if (isBase) value += 0.8;
  return value;
}

export function chooseAction({ view, legalActions, playerId, random, memory, context } = {}) {
  const actions = Array.isArray(legalActions) ? legalActions : [];
  if (!actions.length) return undefined;
  const rnd = typeof random === 'function' ? random : () => 0.5;

  try {
    const v = view || {};
    const cards = v.cards || {};
    const players = Array.isArray(v.players) ? v.players : [];
    const me = players[playerId] || {};
    const mode = (context && context.mode) || v.mode || 'standard';
    const myTeam = me.team == null ? null : me.team;
    const damage = v.damage || {};
    const tradeRow = Array.isArray(v.tradeRow) ? v.tradeRow : [];

    // ---- 卡牌信息缓存（每次调用重建，避免跨局脏数据）----
    const infoCache = new Map();
    const infoOf = uid => {
      if (uid == null) return null;
      const key = String(uid);
      if (infoCache.has(key)) return infoCache.get(key);
      const raw = cards[uid] || null;
      const parse = parseCard(raw ? raw.text : '');
      const cost = num(raw ? raw.cost : 0, 0);
      const isBase = raw ? raw.type === 'base' : false;
      const isOutpost = raw ? !!raw.outpost : false;
      const info = {
        uid,
        id: raw ? raw.id : null,
        faction: raw ? raw.faction : null,
        type: raw ? raw.type : null,
        cost,
        defense: num(raw ? raw.defense : 0, 0),
        outpost: isOutpost,
        parse,
        junk: raw ? junkLevel(raw.id, parse, cost) : 0,
        keep: raw ? keepValue(parse, cost, isBase, isOutpost) : 0
      };
      infoCache.set(key, info);
      return info;
    };

    // 「选择：」分支估值：条件抽牌按已打出的同阵营张数折算。
    const optionValue = (info, choice) => {
      if (!info) return 0;
      const snippet = info.parse.options[choice] || '';
      let value = pointsOf(snippet);
      if (/每打出过/.test(snippet)) {
        for (const [word, faction] of Object.entries(FACTION_WORDS)) {
          if (!snippet.includes(word)) continue;
          let played = 0;
          for (const uid of me.playedThisTurn || []) {
            const other = infoOf(uid);
            if (other && other.faction === faction) played += 1;
          }
          value += played * POINTS.draw;
        }
      }
      return value;
    };

    // 这张牌「最多能给」的点数：用于购买估值与牌组总价值判断。
    const potentialGain = info => {
      if (!info) return 0;
      if (!info.parse.options.length) return pointsOf(info.parse.primaryText);
      return info.parse.options.reduce((best, option, index) => Math.max(best, optionValue(info, index)), 0);
    };

    // 打出这张牌「立刻到手」的点数：飞船打出手感即生效，基地要另外发动能力。
    const immediateGain = (info, choice) => {
      if (!info || info.type !== 'ship') return 0;
      if (choice !== undefined && info.parse.options.length > choice) return pointsOf(info.parse.options[choice]);
      return potentialGain(info);
    };

    // 牌的总价值：主要效果 + 同盟 + 销毁 + 结构加成（用于购买决策）。
    const cardValue = info => {
      if (!info) return 0;
      let value =
        potentialGain(info) +
        pointsOf(info.parse.allyText) * 0.5 +
        pointsOf(info.parse.scrapText) * 0.6;
      if (info.outpost) value += 1.2;
      if (info.parse.scrapOwn) value += 1.6;
      if (info.parse.destroyBase) value += 0.8;
      if (info.parse.free) value += 1;
      if (info.parse.topDeck) value += 0.5;
      return value;
    };

    // 买进牌组的稀释代价：每一次买入都会让牌组变厚。
    const dilutionCost = info => 2 + (info ? info.junk * 8 : 0);

    // 同盟协同：场上已有同阵营牌时，打出同阵营牌更值。
    const synergy = info => {
      if (!info || !info.faction || info.faction === 'neutral') return 0;
      let count = 0;
      for (const uid of me.inPlay || []) {
        const other = infoOf(uid);
        if (!other) continue;
        if (other.faction === info.faction) count += 1;
        else if (/视为所有阵营的同盟/.test(other.parse.raw)) count += 1;
      }
      return Math.min(count, 4);
    };

    const isEnemy = player => {
      if (!player) return false;
      if (player.id === playerId) return false;
      if (player.eliminated) return false;
      if (myTeam == null) return true;
      return player.team !== myTeam;
    };

    const enemies = players.filter(isEnemy);
    const enemyAuthorities = enemies.map(p => num(p.authority, 50));
    const lowestEnemy = enemyAuthorities.length ? Math.min(...enemyAuthorities) : 50;
    // 是否急需贸易（交易行里有买得起的牌）。
    let wantsTrade = false;
    for (const uid of tradeRow) {
      if (!uid) continue;
      const info = infoOf(uid);
      if (!info) continue;
      if (num(me.trade, 0) >= info.cost && info.cost > 0 && cardValue(info) > info.cost * POINTS.trade) {
        wantsTrade = true;
        break;
      }
    }

    // ---- 致命一击：绝对优先 ----
    for (const action of actions) {
      if (!action || action.type !== 'attack' || action.targetType !== 'player') continue;
      const target = players[action.targetId] || {};
      if (num(action.amount, 0) >= num(target.authority, Infinity)) return action;
    }

    // ---- 事件与待决选择 ----
    const scoreEventChoice = action => {
      const eventId = action.eventId || '';
      if (eventId === 'blackHole') {
        // 每少弃一张失去 4 权威：优先弃满两张，并尽量弃废牌。
        const targets = Array.isArray(action.targets) ? action.targets : [];
        let s = -(2 - targets.length) * 60;
        for (const uid of targets) {
          const info = infoOf(uid);
          if (!info) continue;
          s += info.junk * 40 - info.keep * 40;
        }
        return s;
      }
      if (eventId === 'bombardment') {
        if (action.pay) return -360; // 失去 6 权威
        const info = infoOf(action.baseId);
        return info ? 40 - info.keep * 20 : 20;
      }
      if (eventId === 'comet') {
        // 永久销毁手牌 / 弃牌堆：压缩的免费机会，优先销毁废牌。
        const targets = Array.isArray(action.targets) ? action.targets : [];
        let s = targets.length * 10;
        for (const uid of targets) {
          const info = infoOf(uid);
          if (!info) continue;
          s += info.junk * 60 - info.keep * 60;
        }
        return s;
      }
      if (eventId === 'warpJump') {
        // 把两张放回牌库顶、一张留在手里：留最好的那张。
        const cardsBack = Array.isArray(action.cards) ? action.cards : [];
        const drawn = v.pending && Array.isArray(v.pending.drawn) ? v.pending.drawn : [];
        const keptUid = drawn.find(uid => !cardsBack.includes(uid));
        const kept = infoOf(keptUid);
        const back = cardsBack.map(uid => infoOf(uid)).filter(Boolean);
        let s = kept ? kept.keep * 12 : 0;
        for (const info of back) s -= info.keep * 4;
        if (back.length === 2 && back[0].keep >= back[1].keep) s += 3;
        return s;
      }
      return 0; // 未知事件：中性兜底
    };

    const scorePending = action => {
      if (!action || typeof action !== 'object') return 0;
      switch (action.type) {
        case 'discard': {
          // 必须弃牌：弃掉最不值得留的一张（多为初始牌）。
          const info = infoOf(action.cardId);
          if (!info) return 0;
          return info.junk * 40 - info.keep * 40;
        }
        case 'selectScrap': {
          // 强制销毁：优先永久压掉废牌。
          const info = infoOf(action.cardId);
          if (!info) return 0;
          return info.junk * 60 - info.keep * 60;
        }
        case 'targetDiscard': {
          // 选谁弃牌：手牌多、权威低、场面强的对手最难受。
          const target = players[action.targetId] || {};
          const hand = num(target.handCount, 0);
          const authority = num(target.authority, 50);
          const board = Array.isArray(target.inPlay) ? target.inPlay.length : 0;
          return 1000 + hand * 6 + (50 - authority) * 0.4 + board * 1.5;
        }
        case 'eventChoice':
          return scoreEventChoice(action);
        default:
          return 0; // 未知待决动作：中性兜底
      }
    };

    // ---- 能力动作 ----
    const scoreAbility = action => {
      const info = infoOf(action.cardId);
      if (!info) return TIERS.abilityOther;
      const parse = info.parse;
      const targets = Array.isArray(action.targets) ? action.targets : null;

      // 销毁自身：永久把这张牌移出牌组（探索者销毁后回到供应堆）。
      if (action.ability === 'scrap') {
        let s = TIERS.abilityOther + pointsOf(parse.scrapText) * SCALE;
        if (info.outpost) s -= 60; // 自家前哨不该被自己销毁
        if (info.junk >= 0.5) s += 40; // 把废牌彻底移出牌组
        if (action.targetId != null) {
          const target = infoOf(action.targetId);
          if (target && target.outpost) s += TIERS.outpostBreak - TIERS.abilityOther; // 顺手拆敌方前哨
          else if (target) s += 40;
        }
        return s;
      }

      // 带自有牌目标：永久销毁（硬压缩）或弃牌（软压缩 / 过牌）。
      if (targets) {
        if (targets.length === 0) return TIERS.noop; // 空转，白白消耗一次能力
        if (parse.scrapOwn) {
          // 销毁低效牌 = 真正的牌组压缩；销毁好牌 = 净损失，宁可不用这能力。
          let s = TIERS.play;
          for (const uid of targets) {
            const target = infoOf(uid);
            if (!target) continue;
            s += target.junk * THIN_REWARD - target.keep * THIN_LOSS;
          }
          if (parse.drawPerScrap) s += targets.length * POINTS.draw * SCALE;
          if (parse.combatPerScrap) s += targets.length * POINTS.combat * SCALE;
          return s;
        }
        // 弃牌循环：把废牌送出视线并换来过牌 / 资源。
        let s = TIERS.play;
        for (const uid of targets) {
          const target = infoOf(uid);
          if (!target) continue;
          s += target.junk * THIN_REWARD * 0.3 - target.keep * THIN_LOSS * 0.3;
        }
        if (parse.recycle || parse.discardThenDraw) s += targets.length * POINTS.draw * SCALE * 0.5;
        if (parse.depot) {
          const perCard = action.resource === 'combat'
            ? POINTS.combat * (enemies.length ? 1.5 : 1)
            : POINTS.trade * (wantsTrade ? 1.5 : 1);
          s += targets.length * perCard * SCALE;
        }
        return s;
      }

      // 摧毁基地：敌方前哨挡着直伤，优先级最高。
      if (action.targetId != null) {
        const target = infoOf(action.targetId);
        if (target && target.outpost) return TIERS.outpostBreak + 30;
        return TIERS.abilityOther + 20 - (target ? target.keep * 10 : 0);
      }

      // 交易行相关：免费获得 > 销毁交易行。
      if (action.row !== undefined || Array.isArray(action.rows)) {
        const rows = action.row !== undefined ? [action.row] : action.rows || [];
        if (parse.free) {
          const rowInfo = infoOf(tradeRow[action.row]);
          return TIERS.play + 40 + (rowInfo ? cardValue(rowInfo) * SCALE : 0);
        }
        let s = TIERS.abilityOther - 5;
        for (const row of rows) {
          const rowInfo = infoOf(tradeRow[row]);
          if (!rowInfo) continue;
          s += rowInfo.junk * 6;
        }
        return s;
      }

      // 普通能力：按效果给资源估值。
      let s = action.ability === 'ally' ? TIERS.ally : TIERS.abilityOther;
      if (action.ability === 'ally') s += pointsOf(parse.allyText) * SCALE;
      else if (action.choice !== undefined && parse.options.length > action.choice) s += optionValue(info, action.choice) * SCALE;
      else s += pointsOf(parse.primaryText) * SCALE;
      if (parse.scrapOwn) s += 20; // 这张牌本身是压缩引擎
      return s;
    };

    // ---- 主阶段统一打分 ----
    const scoreMain = action => {
      if (!action || typeof action !== 'object') return TIERS.fallback;
      switch (action.type) {
        case 'endTurn':
          return TIERS.endTurn;
        case 'transfer': {
          // 回合末会清零的余量，留给队友；一次多转比多次小额更省动作。
          const teammate = players[action.targetId] || {};
          const amount = num(action.amount, 0);
          let s = TIERS.transfer + amount * 3;
          if (action.resource === 'trade') s += num(teammate.trade, 0) < 2 ? 30 : 0;
          else s += num(teammate.combat, 0) < 2 ? 30 : 0;
          return s;
        }
        case 'attack': {
          if (action.targetType === 'base') {
            const target = infoOf(action.targetId);
            if (!target) return TIERS.attackBase;
            const dealt = num(damage[action.targetId], 0);
            const kills = dealt + num(action.amount, 0) >= num(target.defense, 1);
            if (kills) {
              if (target.outpost) return TIERS.outpostBreak + 40;
              return TIERS.attackBase + 30 + target.keep * 10;
            }
            return TIERS.attackBase + 5 + num(action.amount, 0) * SCALE;
          }
          const target = players[action.targetId] || {};
          const authority = num(target.authority, 50);
          let s = TIERS.attackPlayer + num(action.amount, 0) * SCALE + (50 - authority) * 0.4;
          if (authority <= lowestEnemy + 2) s += 30; // 集火最接近出局者
          if (mode === 'firstBlood') s += 40; // 先血：击倒左邻即由我方胜出
          return s;
        }
        case 'play': {
          const info = infoOf(action.cardId);
          if (!info) return TIERS.fallback;
          if (info.junk >= 0.8) {
            // 初始废牌收益打折：能销毁就不打，打也只当填回合。
            return TIERS.junkPlay + immediateGain(info, action.choice) * SCALE;
          }
          let s = TIERS.play;
          s += immediateGain(info, action.choice) * SCALE;
          s += info.cost * 2;
          s += synergy(info) * 5;
          if (info.parse.scrapOwn) s += 30; // 打出后可以永久压缩
          if (info.parse.free) s += 12;
          if (info.parse.destroyBase) s += 12;
          if (action.copy) {
            const copied = infoOf(action.copy);
            if (copied) s += 40 + cardValue(copied) * SCALE + copied.cost * 2;
          }
          if (action.row !== undefined) {
            const rowInfo = infoOf(tradeRow[action.row]);
            if (rowInfo) s += 40 + cardValue(rowInfo) * SCALE + rowInfo.cost * 2;
          }
          return s;
        }
        case 'ability':
          return scoreAbility(action);
        case 'buy': {
          if (action.explorer) {
            // 探索者：稀释牌组且只能换 2 战斗，是压缩主题下最不该买的牌。
            return TIERS.fallback + 20;
          }
          const info = infoOf(tradeRow[action.row]);
          if (!info) return TIERS.fallback - 10;
          const net = cardValue(info) - info.cost * POINTS.trade - dilutionCost(info);
          if (net <= 0) return TIERS.fallback + net * 10;
          return TIERS.buy + net * SCALE;
        }
        default:
          return TIERS.fallback; // 未知动作：安全兜底，仍返回合法动作
      }
    };

    const pending = v.pending && typeof v.pending === 'object' ? v.pending : null;
    const score = pending ? scorePending : scoreMain;

    // ---- 择优：始终返回 legalActions 中的原始对象 ----
    let best = actions[0];
    let bestValue = -Infinity;
    for (const action of actions) {
      let value;
      try {
        value = score(action);
      } catch (err) {
        value = TIERS.fallback;
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) value = TIERS.fallback;
      value += rnd() * 0.4; // 极小抖动，仅打散完全同分的动作
      if (value > bestValue) {
        bestValue = value;
        best = action;
      }
    }

    // ---- 停滞保护：同一动作反复出现且状态没推进时收尾 ----
    if (memory && typeof memory === 'object') {
      try {
        const signature = JSON.stringify(best);
        memory.mmRepeat = memory.mmRepeatSig === signature ? num(memory.mmRepeat, 0) + 1 : 0;
        memory.mmRepeatSig = signature;
        if (num(memory.mmRepeat, 0) >= 3 && best && best.type !== 'endTurn') {
          const end = actions.find(a => a && a.type === 'endTurn');
          if (end) return end;
        }
      } catch (err) {
        /* 记忆不可写时忽略，绝不触碰冻结对象 */
      }
    }

    return best;
  } catch (err) {
    // 任何意外都退化成「返回第一个合法动作」，绝不抛错、绝不暂停对局。
    return actions[0];
  }
}
