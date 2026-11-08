import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { canAttackPlayer, canTargetBase, teamOf, isEmperor, MODES, TEAM_SPECS } from '../src/engine/modes.js';

const six = () => Array.from({ length: 6 }, (_, i) => ({ name: `P${i + 1}`, script: 'tactical' }));
const make = mode => createGame({ mode, seed: `${mode}-test`, players: six() });

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
