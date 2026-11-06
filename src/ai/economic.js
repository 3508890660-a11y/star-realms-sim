export const meta = { id: 'economic', name: '贸易演算', description: '偏好贸易、过牌与牌组压缩，攻击权重较低的内置实验 AI。' };

export function chooseAction({ view, legalActions, playerId, random }) {
  const me = view.players[playerId];
  const rank = action => {
    if (action.type === 'endTurn') return -1000;
    if (action.type === 'discard' || action.type === 'selectScrap') {
      const c = view.cards[action.cardId];
      return -(c?.cost || 0) * 10 - (c && !['scout', 'viper'].includes(c.id) ? 50 : 0);
    }
    if (action.type === 'targetDiscard') return 50;
    if (action.type === 'attack') {
      if (action.targetType === 'player' && action.amount >= view.players[action.targetId].authority) return 100000;
      return action.targetType === 'base' ? 500 + action.amount * 5 : 100 + action.amount;
    }
    if (action.type === 'play') return 1200 + (view.cards[action.cardId]?.cost || 0);
    if (action.type === 'ability') return action.ability === 'scrap' ? 20 : 900;
    if (action.type === 'buy') {
      const c = action.explorer ? null : view.cards[view.tradeRow[action.row]];
      return 700 + (c?.cost || 0) * 40 + (/贸易|抽/.test(c?.text || '') ? 150 : 0) + (me.trade >= 6 ? 50 : 0);
    }
    return 0;
  };
  return legalActions.reduce((best, action) => !best || rank(action) + random() * 0.01 > rank(best) ? action : best, null);
}
