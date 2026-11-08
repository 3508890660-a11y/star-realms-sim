// 策略名称：闪电压制（Lightning Suppression）
// 选择理由（一句话）：1v1 权威竞速中抢先输出与卡差收益最大，用低费高战斗牌持续打脸、顺手销毁基础牌精简牌库，不给对手拖入后期成型的机会。

export const meta = {
  name: 'MIMO-v2.6-pro · 闪电压制',
  description: 'mimo-v2.6-pro 自选策略「闪电压制」：1v1 权威竞速下伤害与卡差收益最大，优先低费高效战斗牌打脸施压、销毁基础牌精简牌库，不给对手拖后期的机会。'
};

// —— 卡牌文本估值（零依赖，仅正则解析 view.cards 的规则文本）——
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
  if (/同盟/.test(text)) v += 1.2;
  if (/前哨/.test(text)) v += 1.2;
  if (/摧毁/.test(text)) v += 1.5;
  if (/弃.*对手|对手.*弃/.test(text)) v += 1.2;
  return v;
};

const choiceSegment = (text, choice) => {
  const m = /选择：([^。]+)/.exec(text || '');
  if (!m) return text || '';
  const segs = m[1].split(/；或|或/);
  return segs[Math.min(Math.max(choice, 0), segs.length - 1)] || text || '';
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

// mode: 'scrap' 销毁目标（留基础牌、弃基础牌）；'cycle' 弃牌循环（弃弱牌换抽牌）
const targetsScore = (view, targets, mode) => {
  let s = 0;
  for (const uid of targets || []) {
    if (mode === 'cycle') s += 2 - cardScore(view, uid) * 0.4;
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

function scoreAction(view, action, me) {
  const cards = view.cards;
  switch (action.type) {
    case 'discard':
      return -cardScore(view, action.cardId);
    case 'selectScrap':
      return -cardScore(view, action.cardId);
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
        const mine = [...(me.hand || []), ...(me.discard || [])];
        return (action.targets || []).reduce((s, uid) => {
          if (isStarter(view, uid)) return s + 7 + (me.discard && me.discard.includes(uid) ? 2 : 0);
          return s - cardScore(view, uid) * 0.5;
        }, 10);
      }
      if (id === 'warpJump') {
        const cs = action.cards || [];
        return 40 - (cardScore(view, cs[0]) + cardScore(view, cs[1]) * 1.2);
      }
      if (id === 'bombardment') {
        return action.pay ? 0 : 8 - cardScore(view, action.baseId) * 0.9;
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
        v += 10 + cardScore(view, view.tradeRow[action.row]) * 0.5;
      }
      return v;
    }
    case 'ability': {
      const c = cards[action.cardId];
      const text = c ? c.text : '';
      const kind = action.ability;
      if (kind === 'ally') {
        let v = 850;
        if (action.row !== undefined && view.tradeRow && view.tradeRow[action.row]) {
          v += cardScore(view, view.tradeRow[action.row]);
        }
        if (action.targetId) v += 4 + cardScore(view, action.targetId);
        if (action.targets) v += targetsScore(view, action.targets, 'scrap');
        return v;
      }
      if (kind === 'primary') {
        const seg = action.choice !== undefined ? choiceSegment(text, action.choice) : text;
        let v = 800 + textValue(seg);
        if (/抽/.test(seg)) v += 20;
        if (action.targets) {
          const cycle = /弃|回收/.test(text) && !/销毁/.test(text);
          v += targetsScore(view, action.targets, cycle ? 'cycle' : 'scrap');
          if (/抽/.test(text)) v += (action.targets || []).length * 3;
        }
        return v;
      }
      if (kind === 'optional') {
        let v = 560;
        if (action.targets) {
          const s = targetsScore(view, action.targets, /销毁/.test(text) ? 'scrap' : 'cycle');
          if (s < -5) return 100;
          v += s;
        }
        if (action.row !== undefined && view.tradeRow && view.tradeRow[action.row]) {
          v += 2 + cardScore(view, view.tradeRow[action.row]) * 0.6;
        }
        if (action.rows) {
          for (const r of action.rows) {
            if (view.tradeRow && view.tradeRow[r]) v += 2 + cardScore(view, view.tradeRow[r]) * 0.6;
          }
        }
        if (action.targetId) v += 4 + cardScore(view, action.targetId);
        return v;
      }
      if (kind === 'scrap') {
        const isShip = c && c.type === 'ship';
        let v = (isShip ? 780 : 300) + textValue(text) * 0.6;
        if (action.targetId) v += 6 + cardScore(view, action.targetId);
        return v;
      }
      return 500;
    }
    case 'buy': {
      if (action.explorer) return 233;
      const uid = view.tradeRow && view.tradeRow[action.row];
      if (!uid) return 50;
      const c = cards[uid];
      let v = 240 + cardScore(view, uid) - (c && c.cost ? c.cost * 0.3 : 0) + synergy(view, me, c && c.faction);
      return v;
    }
    case 'attack': {
      const t = view.players[action.targetId];
      if (action.targetType === 'player') {
        if (t && action.amount >= t.authority) return 5000;
        return 950 + action.amount * 1.5;
      }
      const bc = cards[action.targetId];
      const dealt = (view.damage && view.damage[action.targetId]) || 0;
      const needed = bc ? Math.max(1, (bc.defense || 1) - dealt) : 1;
      const kills = action.amount >= needed;
      return kills
        ? 860 + cardScore(view, action.targetId)
        : 400 + cardScore(view, action.targetId) * 0.3 + action.amount * 0.2;
    }
    case 'transfer':
      return 120 + action.amount * 0.5;
    case 'endTurn':
      return 0;
    default:
      return 1;
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
