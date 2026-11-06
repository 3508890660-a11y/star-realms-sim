export const meta = { id: 'tactical', name: '战术核心', description: '优先 lethal、前哨、牌组压缩、同盟与高价值购买；内置较强策略。' };

const card = (view, uid) => view.cards[uid];
const cost = (view, uid) => card(view, uid)?.cost ?? 0;

function score(view, action, playerId, random) {
  const me = view.players[playerId];
  const noise = random() * 0.001;
  if (action.type === 'endTurn') return -10000;
  if (action.type === 'transfer') return -50 + action.amount * 0.1;
  if (action.type === 'eventChoice') {
    const targets = action.targets || action.cards || [];
    const value = targets.reduce((sum, uid) => sum - cost(view, uid) * 10, 0);
    if (action.eventId === 'blackHole') return value + targets.length * 120;
    if (action.eventId === 'comet') return value + targets.length * 80;
    if (action.eventId === 'bombardment') return action.pay ? -200 : 100;
    if (action.eventId === 'warpJump') return value;
    return 0;
  }
  if (action.type === 'discard') return -cost(view, action.cardId) * 20 - (card(view, action.cardId)?.text?.length || 0);
  if (action.type === 'selectScrap') {
    const id = card(view, action.cardId)?.id;
    return ['scout', 'viper'].includes(id) ? 900 : 100 - cost(view, action.cardId) * 30;
  }
  if (action.type === 'targetDiscard') {
    const target = view.players[action.targetId];
    return 500 + (50 - target.authority) + target.handCount * 4;
  }
  if (action.type === 'attack') {
    if (action.targetType === 'player') {
      const target = view.players[action.targetId];
      if (action.amount >= target.authority) return 100000 + action.amount;
      return 1000 + action.amount * 20;
    }
    const target = card(view, action.targetId);
    const destroyed = (view.damage[action.targetId] || 0) + action.amount >= (target?.defense || 1);
    return 650 + action.amount * 8 + (destroyed ? 180 : 0) + (target?.outpost ? 250 : 0);
  }
  if (action.type === 'play') {
    const target = card(view, action.cardId);
    let value = 800 + cost(view, action.cardId) * 12;
    if (action.copy) value += cost(view, action.copy) * 25;
    if (action.choice !== undefined && target?.id === 'patrolMech') {
      value += me.trade < 4 && action.choice === 0 ? 20 : 0;
    }
    return value;
  }
  if (action.type === 'buy') {
    if (action.explorer) return me.trade >= 2 ? 180 : 0;
    const uid = view.tradeRow[action.row];
    const target = card(view, uid);
    const sameFaction = me.inPlay.filter(id => card(view, id)?.faction === target?.faction).length;
    let value = 400 + (target?.cost || 0) * 36 + sameFaction * 18;
    if (target?.type === 'base') value += target.outpost ? 90 : 35;
    if (/抽|同盟/.test(target?.text || '')) value += 35;
    return value;
  }
  if (action.type === 'ability') {
    const target = card(view, action.cardId);
    let value = { ally: 720, primary: 700, optional: 620, scrap: 80 }[action.ability] || 100;
    if (action.ability === 'ally' && /免费|置于牌库顶/.test(target?.text || '')) value += 120;
    if (action.targets?.length) {
      value += action.targets.filter(uid => ['scout', 'viper'].includes(card(view, uid)?.id)).length * 200;
      value -= action.targets.filter(uid => cost(view, uid) >= 4).length * 500;
    }
    if (action.targetId || action.row !== undefined) value += 100;
    if (action.ability === 'scrap' && me.combat < 5) value -= 50;
    return value;
  }
  return 0;
}

export function chooseAction({ view, legalActions, playerId, random }) {
  if (!legalActions.length) throw new Error('没有合法动作');
  return legalActions.reduce((best, action) => {
    const value = score(view, action, playerId, random) + random() * 0.001;
    return !best || value > best.value ? { action, value } : best;
  }, null).action;
}
