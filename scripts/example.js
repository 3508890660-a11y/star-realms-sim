// 用户 AI 脚本示例。保存后刷新页面即可在座位下拉框中选择。
// 脚本在本机 Node.js 进程内执行，只运行你信任的脚本。
export const meta = {
  name: '示例：廉价快攻',
  description: '优先打出卡牌和攻击，购买时偏好低费战斗牌。'
};

export function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  memory.calls = (memory.calls || 0) + 1;
  const nonEnd = legalActions.filter(a => a.type !== 'endTurn');
  if (!nonEnd.length) return legalActions[0];

  const lethal = nonEnd.find(a => a.type === 'attack' && a.targetType === 'player' && a.amount >= view.players[a.targetId].authority);
  if (lethal) return lethal;

  const mandatory = nonEnd.filter(a => ['discard', 'selectScrap', 'targetDiscard'].includes(a.type));
  if (mandatory.length) return mandatory[Math.floor(random() * mandatory.length)];

  const play = nonEnd.find(a => a.type === 'play');
  if (play) return play;

  const attack = nonEnd.filter(a => a.type === 'attack').sort((a, b) => b.amount - a.amount)[0];
  if (attack && random() < 0.8) return attack;

  const buy = nonEnd.filter(a => a.type === 'buy').sort((a, b) => {
    const cardA = a.explorer ? null : view.cards[view.tradeRow[a.row]];
    const cardB = b.explorer ? null : view.cards[view.tradeRow[b.row]];
    return (cardA?.cost || 2) - (cardB?.cost || 2);
  })[0];
  return buy || nonEnd.find(a => a.type === 'ability') || legalActions.find(a => a.type === 'endTurn');
}
