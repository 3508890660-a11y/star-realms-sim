// 策略名称：闪电压制（Lightning Suppression）
// 选择理由（一句话）：权威竞速中抢先输出与卡差收益最大，用低费高战斗牌持续打脸、顺手销毁基础牌精简牌库，不给对手拖入后期成型的机会。
// 本轮更新：按 PROGRAM-UPDATES 1–6 适配 7 种模式与 6 牌包任意组合，新增大将战 moveCard、双同盟、choice/row/rows/targets 动作估值，并按整队轮流与队末清算修正合击/转移口径。

export const meta = {
  name: 'MIMO-v2.6-pro · 闪电压制',
  description: 'mimo-v2.6-pro 自选策略「闪电压制」：权威竞速下伤害与卡差收益最大，优先低费高效战斗牌打脸施压、销毁基础牌精简牌库，不给对手拖后期的机会。'
};

// —— 卡牌文本估值（零依赖，仅解析 view.cards 的可见字段与规则文本）——
const numSum = (text, re) => {
  let m, sum = 0;
  re.lastIndex = 0;
  while ((m = re.exec(text))) sum += parseInt(m[1], 10) || 1;
  return sum;
};

const textValue = (text) => {
  if (!text) return 0;
  let v = 0;
  v += numSum(text, /抽\s*(\d)\s*张/g) * 4;
  v += numSum(text, /(\d+)\s*战斗/g) * 2.4;
  v += numSum(text, /(\d+)\s*贸易/g) * 1.3;
  v += numSum(text, /(\d+)\s*权威/g) * 1.1;
  if (/双同盟/.test(text)) v += 2;
  if (/同盟/.test(text)) v += 1.2;
  if (/前哨/.test(text)) v += 1.2;
  if (/摧毁|销毁/.test(text)) v += 1.5;
  if (/弃.*对手|对手.*弃/.test(text)) v += 1.2;
  return v;
};

// 分支文本：兼容「选择：A；或 B」「选择：A或 B」与新包「A 或 B」三种写法。
const choiceSegment = (text, choice) => {
  if (!text) return '';
  const lines = String(text).split(/\n|。/).map(s => s.trim()).filter(Boolean);
  const line = lines.find(seg => /选择：/.test(seg))
    || lines.find(seg => /或/.test(seg) && !/和\/或/.test(seg))
    || lines[0] || '';
  const segs = line.replace(/^选择：\s*/, '').split(/；或|或/).map(s => s.trim()).filter(Boolean);
  if (segs.length <= 1) return line;
  return segs[Math.min(Math.max(choice | 0, 0), segs.length - 1)] || line;
};

const isStarter = (view, uid) => {
  const c = view.cards[uid];
  return !!c && c.type === 'ship' && (c.cost === null || c.cost === undefined);
};

const cardScore = (view, uid) => {
  const c = view.cards[uid];
  if (!c) return 0;
  return textValue(c.text) + (c.type === 'base' ? 1.5 : 0) + (c.outpost ? 0.5 : 0);
};

// 摧毁敌方基地的价值：解除对手防御/产能并打开打脸通道。
const baseThreat = (view, uid) => {
  const c = view.cards[uid];
  if (!c) return 6;
  return 6 + cardScore(view, uid) * 0.7 + (c.outpost ? 4 : 0);
};

// mode: 'scrap' 销毁（留基础牌、弃基础牌）；'cycle' 弃牌循环；'gainCost' 按费用得战斗
const targetsScore = (view, targets, mode) => {
  let s = 0;
  for (const uid of targets || []) {
    const c = view.cards[uid];
    if (mode === 'gainCost') s += 2 + (c && c.cost ? c.cost : 0) * 0.9;
    else if (mode === 'cycle') s += 2 - cardScore(view, uid) * 0.4;
    else if (isStarter(view, uid)) s += 6;
    else s -= cardScore(view, uid) * 0.6;
  }
  return s;
};

const synergy = (view, me, faction) => {
  if (!faction || faction === 'neutral') return 0;
  const mine = [...(me.hand || []), ...(me.discard || []), ...(me.inPlay || [])];
  return mine.some(uid => {
    const c = view.cards[uid];
    return c && (c.faction === faction || (c.factions || []).includes(faction));
  }) ? 2.5 : 0;
};

// team2v2 / hydra3 / emperor 都是整队轮流、队末清算（见 engine.js endTurn）。
const isTeamLike = (view) => view.mode === 'team2v2' || view.mode === 'hydra3' || view.mode === 'emperor';

// 击杀收益：血线一律读 players[targetId].authority（大将战 teams[].authority 为 0，不作数）。
const killBonus = (view, me, targetId) => {
  const mode = view.mode;
  if (mode === 'emperor') {
    // 斩将直接终局；提督阵亡只解锁大将并移交一张牌，仍是重击但非终局。
    return (view.emperors || []).includes(targetId) ? 6000 : 3200;
  }
  if (mode === 'team2v2' || mode === 'hydra3') return 6000; // 共享权威归零即全队失败
  if (mode === 'firstBlood') return 6000; // 任一玩家败北立即终局
  const myTeam = me ? me.team : null;
  const remaining = (view.players || []).filter(p =>
    !p.eliminated && p.id !== targetId && !(me && p.id === me.id) &&
    (!isTeamLike(view) || p.team !== myTeam)
  ).length;
  return remaining === 0 ? 6000 : 3000;
};

function scoreAction(view, action, me) {
  const cards = view.cards;
  switch (action.type) {
    case 'discard':
      return -cardScore(view, action.cardId);
    case 'selectScrap':
      // 强制销毁：优先销毁基础牌精简牌库
      return isStarter(view, action.cardId) ? 8 : -cardScore(view, action.cardId) * 0.6;
    case 'targetDiscard': {
      const t = view.players[action.targetId];
      return t ? t.handCount * 3 - t.authority * 0.05 : 0;
    }
    case 'eventChoice': {
      const id = action.eventId;
      if (id === 'blackHole') {
        const len = (action.targets || []).length;
        return len * 5 - (action.targets || []).reduce((s, uid) => s + cardScore(view, uid) * 0.6, 0);
      }
      if (id === 'comet') {
        return (action.targets || []).reduce((s, uid) => {
          if (isStarter(view, uid)) return s + 7 + ((me.discard || []).includes(uid) ? 2 : 0);
          return s - cardScore(view, uid) * 0.5;
        }, 10);
      }
      if (id === 'warpJump') {
        const cs = action.cards || [];
        return 40 - (cardScore(view, cs[0]) + cardScore(view, cs[1]) * 1.2);
      }
      if (id === 'bombardment') {
        return action.pay ? 1 : 8 - cardScore(view, action.baseId) * 0.9;
      }
      return 15;
    }
    case 'play': {
      const c = cards[action.cardId];
      const seg = action.choice !== undefined ? choiceSegment(c && c.text, action.choice) : (c ? c.text : '');
      let v = 700 + textValue(seg);
      if (/抽/.test(seg)) v += 30;
      if (action.copy) v += 20 + textValue(cards[action.copy] && cards[action.copy].text) * 0.5;
      if (action.row !== undefined && view.tradeRow && view.tradeRow[action.row]) {
        const rowUid = view.tradeRow[action.row];
        const rc = cards[rowUid];
        if (/销毁交易行/.test(seg)) {
          // 销毁交易行按费用得战斗：优先挑费用高的行卡
          v += 8 + (rc && rc.cost ? rc.cost : 0) * 1.2;
        } else {
          // 免费获取（acquireFreeMax / acquireCheapFree）
          v += 10 + cardScore(view, rowUid) * 0.8;
        }
      }
      return v;
    }
    case 'ability': {
      const c = cards[action.cardId];
      const text = c ? c.text : '';
      const kind = action.ability;
      const gainCost = /等同于其费用/.test(text);
      const scrapRowLike = /销毁交易行/.test(text);
      if (kind === 'ally') {
        let v = 850;
        if (action.double) v += 15; // 双同盟：一次额外的同盟能力
        if (action.row !== undefined && view.tradeRow && view.tradeRow[action.row]) {
          const rowUid = view.tradeRow[action.row];
          const rc = cards[rowUid];
          if (scrapRowLike) v += 4 + (rc && rc.cost ? rc.cost : 0) * 0.7;
          else v += 10 + cardScore(view, rowUid) * 0.6;
        }
        if (action.targetId) v += 8 + baseThreat(view, action.targetId);
        if (action.targets) {
          v += targetsScore(view, action.targets, gainCost ? 'gainCost' : /销毁/.test(text) ? 'scrap' : 'cycle');
        }
        return v;
      }
      if (kind === 'primary') {
        const seg = action.choice !== undefined ? choiceSegment(text, action.choice) : text;
        let v = 800 + textValue(seg);
        if (/抽/.test(seg)) v += 20;
        if (action.targets) {
          const mode = gainCost ? 'gainCost'
            : (/弃|回收/.test(text) && !/销毁/.test(text)) ? 'cycle' : 'scrap';
          v += targetsScore(view, action.targets, mode);
          if (/抽/.test(text)) v += (action.targets || []).length * 3;
        }
        // depot：弃牌换资源，战斗比贸易更贴合压制
        if (action.resource === 'combat') v += 12;
        else if (action.resource === 'trade') v += 4;
        if (action.row !== undefined && view.tradeRow && view.tradeRow[action.row]) {
          const rowUid = view.tradeRow[action.row];
          const rc = cards[rowUid];
          if (/销毁交易行/.test(seg)) v += 8 + (rc && rc.cost ? rc.cost : 0) * 1.1;
          else v += 10 + cardScore(view, rowUid) * 0.8;
        }
        return v;
      }
      if (kind === 'optional') {
        let v = 560;
        if (action.targets) {
          const mode = gainCost ? 'gainCost' : /销毁/.test(text) ? 'scrap' : 'cycle';
          const s = targetsScore(view, action.targets, mode);
          if (s < -5) return -50; // 强行销毁好牌不如不发动
          v += s;
        }
        // optional 的 row / rows 一律是销毁交易行（scrapRow）
        const rowValue = (r) => {
          const rowUid = view.tradeRow && view.tradeRow[r];
          const rc = cards[rowUid];
          return rowUid ? 3 + (rc && rc.cost ? rc.cost : 0) * 0.7 : 0;
        };
        if (action.row !== undefined) v += rowValue(action.row);
        if (action.rows) for (const r of action.rows) v += rowValue(r);
        if (action.targetId) v += 8 + baseThreat(view, action.targetId);
        return v;
      }
      if (kind === 'scrap') {
        const isShip = c && c.type === 'ship';
        let v = (isShip ? 740 : 320) + textValue(text) * 0.6;
        if (/战斗/.test(text)) v += 30;
        if (action.targetId) v += 8 + baseThreat(view, action.targetId);
        return v;
      }
      return 500;
    }
    case 'buy': {
      if (action.explorer) return 233;
      const uid = view.tradeRow && view.tradeRow[action.row];
      if (!uid) return 50;
      const c = cards[uid];
      return 240 + cardScore(view, uid) - (c && c.cost ? c.cost * 0.3 : 0) + synergy(view, me, c && c.faction);
    }
    case 'attack': {
      const t = view.players[action.targetId];
      if (action.targetType === 'player') {
        if (t && action.amount >= t.authority) return killBonus(view, me, action.targetId);
        let v = 950 + action.amount * 1.5;
        // 大将战：大将个人权威才是胜负线，削将优先
        if (view.mode === 'emperor' && (view.emperors || []).includes(action.targetId)) v += 120;
        return v;
      }
      const bc = cards[action.targetId];
      const dealt = (view.damage && view.damage[action.targetId]) || 0;
      const needed = bc ? Math.max(1, (bc.defense || 1) - dealt) : 1;
      if (action.amount >= needed) return 860 + baseThreat(view, action.targetId);
      let v = 400 + cardScore(view, action.targetId) * 0.3 + action.amount * 0.2;
      // 整队轮流：基地伤害队末才清零，队友可在本轮接着补刀
      if (isTeamLike(view)) v += 40;
      return v;
    }
    case 'transfer': {
      // 本人行动结束即清零贸易/战斗，转给队友是唯一不浪费的方式
      let v = 130 + action.amount * 0.6;
      if (action.resource === 'combat') v += 15;
      const target = view.players[action.targetId];
      // 整队按座位升序行动：座位靠后的队友本队这轮稍后即到账
      if (target && me && target.id > me.id) v += 20;
      return v;
    }
    case 'moveCard': {
      // 大将战：花 1 贸易把弃牌堆一张牌交给队内相邻队友
      let v = 60 + cardScore(view, action.cardId) * 0.5;
      if (isStarter(view, action.cardId)) v -= 10; // 别把基础牌塞进队友牌库
      return v;
    }
    case 'endTurn':
      return 0;
    default:
      return 1; // 未知动作安全兜底
  }
}

export async function chooseAction({ view, legalActions, playerId, random, memory }) {
  if (memory) memory.calls = (memory.calls || 0) + 1;
  if (!legalActions || !legalActions.length) return undefined;
  const me = view.players[playerId] || {};
  let best = null;
  let bestScore = -Infinity;
  for (const action of legalActions) {
    let s;
    try {
      s = scoreAction(view, action, me);
    } catch (e) {
      s = 1;
    }
    if (typeof s !== 'number' || Number.isNaN(s)) s = 1;
    if (s > bestScore || (s === bestScore && best && random() < 0.5)) {
      bestScore = s;
      best = action;
    }
  }
  return best || legalActions[0];
}
