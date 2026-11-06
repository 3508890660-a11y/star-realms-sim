export const meta = { id: 'random', name: '随机漫游', description: '随机选择合法动作；适合冒烟测试与基线对照。' };

export function chooseAction({ legalActions, random }) {
  if (!legalActions.length) throw new Error('没有合法动作');
  const nonEnd = legalActions.filter(action => action.type !== 'endTurn');
  const pool = nonEnd.length && random() < 0.94 ? nonEnd : legalActions;
  return pool[Math.floor(random() * pool.length)];
}
