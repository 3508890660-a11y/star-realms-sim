import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { canAttackPlayer, canTargetBase, teamOf, isEmperor, oppositeSeat, admiralSeats, MODES, TEAM_SPECS } from '../src/engine/modes.js';

const six = () => Array.from({ length: 6 }, (_, i) => ({ name: `P${i + 1}`, script: 'tactical' }));
const four = () => Array.from({ length: 4 }, (_, i) => ({ name: `P${i + 1}`, script: 'tactical' }));
const make = mode => createGame({ mode, seed: `${mode}-test`, players: six() });
const make4 = mode => createGame({ mode, seed: `${mode}-test`, players: four() });

test('双头龙：先手队全员 3 张、后手队全员 5 张', () => {
  const g = make4('team2v2');
  assert.deepEqual(g.state.teams.map(t => t.players), [[0, 2], [1, 3]]);
  assert.deepEqual(g.state.players.map(p => p.hand.length), [3, 5, 3, 5]);
});

test('团队模式整队轮流：队友连续行动完才换另一队', () => {
  const g = make('hydra3');
  const order = [g.state.activePlayer];
  for (let i = 0; i < 6; i++) { g.endTurn(); order.push(g.state.activePlayer); }
  assert.deepEqual(order, [0, 2, 4, 1, 3, 5, 0]);

  const h = make4('team2v2');
  const order4 = [h.state.activePlayer];
  for (let i = 0; i < 4; i++) { h.endTurn(); order4.push(h.state.activePlayer); }
  assert.deepEqual(order4, [0, 2, 1, 3, 0]);
});

test('团队模式：队内基地伤害累计可合击，换队后清零', () => {
  const g = make('hydra3');
  const s = g.state;
  const base = g.makeCard('battleStation', 1);
  s.players[1].inPlay.push(base);
  s.activePlayer = 0; s.players[0].combat = 3;
  const first = g.legalActions().find(a => a.type === 'attack' && a.targetType === 'base' && a.targetId === base);
  assert.equal(first.amount, 3);
  g.applyAction(first);
  assert.equal(s.damage[base], 3);

  g.endTurn();
  assert.equal(s.activePlayer, 2, '队内应直接轮到队友');
  assert.equal(s.damage[base], 3, '队友行动时伤害必须保留');
  s.players[2].combat = 2;
  const second = g.legalActions().find(a => a.type === 'attack' && a.targetType === 'base' && a.targetId === base);
  assert.ok(second, '队友应能接着打同一座基地');
  assert.equal(second.amount, 2, '只需补掉剩余 2 点防御');
  g.applyAction(second);
  assert.equal(s.players[1].inPlay.includes(base), false, '合并战斗应拆掉基地');

  // 换一座基地验证「队末换队时才清零」
  const other = g.makeCard('battleStation', 1);
  s.players[1].inPlay.push(other);
  s.players[2].combat = 2;
  const third = g.legalActions().find(a => a.type === 'attack' && a.targetType === 'base' && a.targetId === other);
  g.applyAction(third);
  assert.equal(s.damage[other], 2);
  g.endTurn();
  assert.equal(s.activePlayer, 4, '仍在同一队');
  assert.equal(s.damage[other], 2, '同队内伤害继续保留');
  g.endTurn();
  assert.equal(s.activePlayer, 1, '换到另一队');
  assert.equal(s.damage[other], undefined, '换队后基地伤害清零');
});

test('团队模式：队末才弃手补牌，队内队友保留手牌', () => {
  const g = make('hydra3');
  const s = g.state;
  const before = s.players[0].hand.length;
  assert.equal(before, 3, '先手队开局 3 张');
  g.endTurn();
  assert.equal(s.players[0].hand.length, before, '队内换人不应弃手补牌');
  g.endTurn();
  g.endTurn();
  assert.equal(s.activePlayer, 1, '换到另一队');
  for (const id of [0, 2, 4]) assert.equal(s.players[id].hand.length, 5, `队友 ${id} 队末应补到 5 张`);
});

test('三头龙：6 人两队各 3 人，共享 100 权威', () => {
  assert.equal(MODES.hydra3.min, 6);
  assert.equal(TEAM_SPECS.hydra3.authority, 100);
  const g = make('hydra3');
  const s = g.state;
  assert.equal(s.players.length, 6);
  assert.deepEqual(s.teams.map(t => t.players), [[0, 2, 4], [1, 3, 5]]);
  assert.equal(s.teams[0].authority, 100);
  assert.equal(s.teams[1].authority, 100);
  for (const p of s.players) assert.equal(p.authority, 100);
  assert.equal(teamOf(s, 4), 0);
  assert.equal(teamOf(s, 5), 1);
  // 先手队 3 张、后手队 5 张
  assert.deepEqual(s.players.map(p => p.hand.length), [3, 5, 3, 5, 3, 5]);
});

test('三头龙：队友可转移资源，前哨保护全队', () => {
  const g = make('hydra3');
  g.state.players[0].trade = 3;
  const moves = g.legalActions().filter(a => a.type === 'transfer');
  assert.ok(moves.length > 0);
  assert.ok(moves.every(a => [2, 4].includes(a.targetId)), '只能转给同队队友');
  g.transfer({ type: 'transfer', targetId: 2, resource: 'trade', amount: 2 });
  assert.equal(g.state.players[2].reserve.trade, 2);
  // 队友 4 场上放一座前哨，全队都应视为有前哨保护
  const outpost = g.makeCard('battleStation', 4);
  g.state.players[4].inPlay.push(outpost);
  assert.equal(g.teamHasOutpost(0), true);
  assert.equal(g.teamHasOutpost(1), false);
});

test('大将战：大将 60 权威、提督 50，队内交替座位', () => {
  const g = make('emperor');
  const s = g.state;
  assert.deepEqual(s.emperors, [0, 1]);
  assert.deepEqual(s.teams.map(t => t.players), [[0, 2, 4], [1, 3, 5]]);
  assert.equal(s.players[0].authority, 60);
  assert.equal(s.players[1].authority, 60);
  for (const id of [2, 3, 4, 5]) assert.equal(s.players[id].authority, 50);
  assert.equal(isEmperor(s, 0), true);
  assert.equal(isEmperor(s, 2), false);
});

test('大将战：提督只能打对面提督，对面提督阵亡后才可打大将', () => {
  const g = make('emperor');
  const s = g.state;
  // 提督 2 的对位是 3
  assert.equal(canAttackPlayer(s, 2, 3), true);
  assert.equal(canAttackPlayer(s, 2, 1), false, '不能越过对面提督直接打大将');
  assert.equal(canAttackPlayer(s, 2, 5), false, '不能打非对位提督');
  assert.equal(canAttackPlayer(s, 2, 0), false, '不能打自己队的大将');
  // 大将可打任意敌方
  for (const target of [1, 3, 5]) assert.equal(canAttackPlayer(s, 0, target), true);
  // 对面提督 3 阵亡后，提督 2 可以打大将 1
  s.players[3].eliminated = true;
  assert.equal(canAttackPlayer(s, 2, 1), true);
  assert.equal(canAttackPlayer(s, 2, 5), false, '对面提督阵亡后只解锁敌方大将，不能打其他提督');
  // 基地目标遵循同一限制
  assert.equal(canTargetBase(s, 2, 0), false);
  assert.equal(canTargetBase(s, 2, 1), true);
});

test('大将战：三种大将轮换下，提督未解决对面提督前都不能打敌方大将', () => {
  for (const emperors of [[0, 1], [2, 3], [4, 5]]) {
    const g = createGame({ mode: 'emperor', seed: `emperor-pair-${emperors.join('')}`, players: six(), emperors });
    const s = g.state;
    const admirals = [0, 1, 2, 3, 4, 5].filter(id => !isEmperor(s, id));
    assert.equal(admirals.length, 4, `轮换 ${emperors} 应有两队各两名提督`);

    // 对位必须是「提督↔提督」的互映射，四名提督两两成对
    const pairs = new Set();
    for (const id of admirals) {
      const opposite = oppositeSeat(s, id);
      assert.notEqual(opposite, null, `提督 ${id} 必须有对位`);
      assert.equal(isEmperor(s, opposite), false, '提督的对位必须是提督，不能是大将');
      assert.equal(oppositeSeat(s, opposite), id, '对位必须互为映射');
      assert.equal(teamOf(s, opposite) !== teamOf(s, id), true, '对位必须在敌方');
      pairs.add([id, opposite].sort((a, b) => a - b).join('-'));
    }
    assert.equal(pairs.size, 2, '四个提督应恰好配成两对');

    for (const id of admirals) {
      const opposite = oppositeSeat(s, id);
      const enemyEmperor = s.emperors[1 - teamOf(s, id)];
      assert.equal(canAttackPlayer(s, id, enemyEmperor), false, `座位 ${id} 不得越过对面提督直接打大将`);
      assert.equal(canTargetBase(s, id, enemyEmperor), false, `座位 ${id} 不得越过对面提督打大将的基地`);
      assert.equal(canAttackPlayer(s, id, opposite), true, `座位 ${id} 应能打对位提督 ${opposite}`);
      assert.equal(canTargetBase(s, id, opposite), true);
      // 非对位的敌方提督永远打不到
      for (const other of admirals) {
        if (other === id || other === opposite) continue;
        if (teamOf(s, other) === teamOf(s, id)) continue;
        assert.equal(canAttackPlayer(s, id, other), false, `座位 ${id} 不应能打非对位提督 ${other}`);
        assert.equal(canTargetBase(s, id, other), false);
      }
      // 对位提督阵亡后，才解锁敌方大将（以及大将的基地）
      s.players[opposite].eliminated = true;
      assert.equal(canAttackPlayer(s, id, enemyEmperor), true, `对位提督阵亡后座位 ${id} 应能打大将`);
      assert.equal(canTargetBase(s, id, enemyEmperor), true);
      s.players[opposite].eliminated = false;
    }

    // 大将可攻击/指定任何敌方玩家与基地
    for (const emperor of s.emperors) {
      for (const target of [0, 1, 2, 3, 4, 5]) {
        if (teamOf(s, target) === teamOf(s, emperor)) continue;
        assert.equal(canAttackPlayer(s, emperor, target), true, `大将 ${emperor} 应能打 ${target}`);
        assert.equal(canTargetBase(s, emperor, target), true);
      }
    }
  }
});

test('大将战：提督的实际攻击动作里不会出现敌方大将', () => {
  const g = createGame({ mode: 'emperor', seed: 'emperor-actions', players: six(), emperors: [0, 1] });
  const s = g.state;
  // 座位 5 是提督，对位是 4；给它战斗点后只应出现「打 4」的玩家目标
  s.activePlayer = 5;
  s.players[5].combat = 5;
  const targets = g.legalActions()
    .filter(action => action.type === 'attack' && action.targetType === 'player')
    .map(action => action.targetId);
  assert.ok(targets.length > 0, '应有攻击玩家的动作');
  assert.deepEqual([...new Set(targets)], [oppositeSeat(s, 5)]);
  assert.equal(targets.includes(s.emperors[0]), false, '不得出现敌方大将');

  // 大将 0 的动作里应包含全部三名敌方座位
  s.activePlayer = 0;
  s.players[0].combat = 5;
  const emperorTargets = new Set(g.legalActions()
    .filter(action => action.type === 'attack' && action.targetType === 'player')
    .map(action => action.targetId));
  assert.deepEqual([...emperorTargets].sort((a, b) => a - b), [1, 3, 5]);
});

test('大将战：大将阵亡全队失败，提督阵亡只淘汰个人并移一张牌给大将', () => {
  const g = make('emperor');
  const s = g.state;
  const before = s.players[2].discard.length + s.players[2].hand.length + s.players[2].deck.length;
  g.eliminate(2, 0);
  assert.equal(s.players[2].eliminated, true);
  assert.equal(s.status, 'playing', '提督阵亡不应结束对局');
  assert.ok(before > 0);
  assert.ok(s.players[0].discard.length >= 1, '应有一张牌移交给本队大将');

  const g2 = make('emperor');
  g2.eliminate(1, 0);
  assert.equal(g2.state.status, 'finished');
  assert.equal(g2.state.winningTeam, 0);
  assert.match(g2.state.winReason, /大将/);
});

test('大将战：花 1 贸易把弃牌堆一张交给相邻队友', () => {
  const g = make('emperor');
  const s = g.state;
  const uid = g.makeCard('scout', 0);
  s.players[0].discard.push(uid);
  s.players[0].trade = 1;
  const action = g.legalActions().find(a => a.type === 'moveCard' && a.cardId === uid);
  assert.ok(action, '应提供移牌动作');
  assert.ok([2, 4].includes(action.targetId));
  g.moveCard(action);
  assert.equal(s.players[0].trade, 0);
  assert.equal(s.players[0].discard.includes(uid), false);
  assert.equal(s.players[action.targetId].discard.includes(uid), true);
  assert.equal(s.cards[uid].owner, action.targetId);
});
