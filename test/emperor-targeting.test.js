// 大将战目标规则回归：专门盯「提督越过对位直击敌方大将」这个曾经的 bug。
// 背景：旧实现用 opposite = (seat + 1) % 6，在大将坐在 0/1 号位时，
// 5 号提督的对位被算成 0 号大将，于是开局就能斩首。现在按「两队提督各自
// 按队内座位序一一配对」计算，且 attack() 会二次校验，非法目标无法落盘。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';

const SEATS = 6;

function makeGame(emperors) {
  const players = Array.from({ length: SEATS }, (_, i) => ({ name: `座位 ${i}`, script: 'script:agent-hy4.js' }));
  return createGame({
    mode: 'emperor',
    emperors,
    players,
    seed: `target-${emperors.join('-')}`,
    expansions: { sets: ['core'] }
  });
}

/** 让某座位持战并返回它当前能打到的玩家（引擎合法动作）。 */
function attackTargets(game, seat, combat = 3) {
  game.state.activePlayer = seat;
  game.state.players[seat].combat = combat;
  const targets = game.legalActions()
    .filter(action => action.type === 'attack' && action.targetType === 'player')
    .map(action => action.targetId);
  return [...new Set(targets)].sort((a, b) => a - b);
}

const admiralsOf = (emperors, team) =>
  [0, 1, 2, 3, 4, 5].filter(seat => seat % 2 === team && !emperors.includes(seat));

test('大将战：提督只能打对位提督，三种大将轮换都成立', () => {
  for (const emperors of [[0, 1], [2, 3], [4, 5]]) {
    const game = makeGame(emperors);
    const own = admiralsOf(emperors, 0);
    const rival = admiralsOf(emperors, 1);
    assert.equal(own.length, 2);
    assert.equal(rival.length, 2);
    own.forEach((seat, index) => {
      assert.deepEqual(attackTargets(game, seat), [rival[index]],
        `大将 ${emperors.join('/')}：提督 ${seat} 只应能打对位 ${rival[index]}`);
    });
    rival.forEach((seat, index) => {
      assert.deepEqual(attackTargets(game, seat), [own[index]],
        `大将 ${emperors.join('/')}：提督 ${seat} 只应能打对位 ${own[index]}`);
    });
  }
});

test('大将战：大将可打任何敌方玩家，但打不到队友', () => {
  for (const emperors of [[0, 1], [2, 3], [4, 5]]) {
    const game = makeGame(emperors);
    emperors.forEach((seat, index) => {
      const enemies = [0, 1, 2, 3, 4, 5].filter(id => id % 2 !== index);
      assert.deepEqual(attackTargets(game, seat), enemies,
        `大将 ${seat} 应能打全部敌方 ${enemies.join('/')}`);
    });
  }
});

test('大将战：对位提督阵亡后才解锁敌方大将', () => {
  const emperors = [0, 1];
  const game = makeGame(emperors);
  // 5 号（第二舰队提督）的对位是 4 号（第一舰队提督）
  assert.deepEqual(attackTargets(game, 5), [4], '对位存活时只能打 4 号');

  // 越过对位直击 0 号大将必须被拒绝：applyAction 的合法动作校验挡一层
  game.state.activePlayer = 5;
  game.state.players[5].combat = 3;
  assert.throws(
    () => game.applyAction({ type: 'attack', targetType: 'player', targetId: 0, amount: 1 }),
    /非法动作/,
    '对位存活时打敌方大将应被拒绝'
  );
  // attack() 自身再挡一层，防止绕过 applyAction 直接调用
  assert.throws(
    () => game.attack({ type: 'attack', targetType: 'player', targetId: 0, amount: 1 }),
    /该玩家当前不可攻击/,
    'attack() 自身也应拒绝越位目标'
  );
  assert.equal(game.state.players[0].authority, 60, '被拒绝的攻击不应扣任何权威');

  // 对位阵亡后解锁
  game.state.players[4].eliminated = true;
  game.state.players[4].authority = 0;
  assert.deepEqual(attackTargets(game, 5), [0], '对位阵亡后只应多出敌方大将，仍不能打另一名提督');
  game.state.activePlayer = 5;
  game.state.players[5].combat = 3;
  game.applyAction({ type: 'attack', targetType: 'player', targetId: 0, amount: 2 });
  assert.equal(game.state.players[0].authority, 58, '解锁后的攻击应正常结算');
});

test('大将战：attack() 二次校验拦截战斗值不足与非法伤害', () => {
  const game = makeGame([0, 1]);
  game.state.activePlayer = 5;
  game.state.players[5].combat = 2;
  assert.throws(() => game.attack({ type: 'attack', targetType: 'player', targetId: 4, amount: 3 }), /战斗值不足/);
  assert.throws(() => game.attack({ type: 'attack', targetType: 'player', targetId: 4, amount: 0 }), /正整数/);
  assert.throws(() => game.attack({ type: 'attack', targetType: 'player', targetId: 5, amount: 1 }), /不可攻击/);
  assert.equal(game.state.players[5].combat, 2, '被拒绝的攻击不应消耗战斗值');
});
