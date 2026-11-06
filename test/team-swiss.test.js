import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TEAM_DEFS, buildTeams, seatArrangements, makeArrangementPlan,
  winnerTeamId, auditArrangementPlan, pairRoundTeams,
  randomFrom, pairRound, pairKey, matchScore, rankPlayers, aggregateSeasons
} from '../src/engine/team-swiss.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
const teams = () => buildTeams(catalog());

test('6 支队伍：5 支同厂配对 + 1 支混编，12 个模型不重不漏', () => {
  const list = teams();
  assert.equal(list.length, 6);
  assert.equal(list.filter(t => t.kind === 'same-vendor').length, 5);
  assert.equal(list.filter(t => t.kind === 'mixed').length, 1);
  assert.deepEqual(list.at(-1).id, 'team-mixed');
  assert.deepEqual(list.at(-1).players.map(p => p.id).sort(), ['mimov26pro', 'step5preview']);
  const ids = list.flatMap(t => t.players.map(p => p.id));
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  const expected = new Set(TEAM_DEFS.flatMap(t => t.members));
  assert.deepEqual(new Set(ids), expected);
  for (const team of list) {
    assert.equal(team.players.length, 2);
    for (const player of team.players) {
      assert.ok(player.script.startsWith('script:agent-'));
      assert.ok(player.model.length > 0);
    }
  }
});

test('8 种座位排列完整覆盖，且引擎队伍归属正确', () => {
  const [a, b] = teams();
  const plans = seatArrangements(a, b);
  assert.equal(plans.length, 8);
  assert.equal(new Set(plans.map(p => p.key)).size, 8);
  for (const plan of plans) {
    assert.equal(plan.seats.length, 4);
    assert.equal(new Set(plan.seats).size, 4, '4 个座位必须是 4 个不同模型');
    const front = [plan.seats[0], plan.seats[2]];
    const back = [plan.seats[1], plan.seats[3]];
    const aIds = a.players.map(p => p.id);
    assert.equal(front.every(id => aIds.includes(id)) || back.every(id => aIds.includes(id)), true, '同队必须占 0/2 或 1/3');
    assert.equal(plan.frontTeam, plan.leader === 0 ? a.id : b.id);
    assert.equal(plan.backTeam, plan.leader === 0 ? b.id : a.id);
  }
});

test('座位配平：每队前位一半、每人本队前位一半、每个模型在每个座位次数相同', () => {
  const [a, b] = teams();
  for (const repeats of [1, 2, 3]) {
    const plan = makeArrangementPlan(a, b, repeats, randomFrom(`balance:${repeats}`));
    const audit = auditArrangementPlan(plan, a, b);
    assert.equal(plan.length, 8 * repeats);
    assert.equal(audit.balanced, true, `repeats=${repeats} 未配平`);
    assert.equal(audit.front[a.id], 4 * repeats);
    assert.equal(audit.front[b.id], 4 * repeats);
    for (const id of [...a.players, ...b.players].map(p => p.id)) {
      assert.equal(audit.lead[id], 4 * repeats);
      // 每个模型每局都上场，8*repeats 局分摊到 4 个座位 → 每座位 2*repeats 次
      for (let seat = 0; seat < 4; seat++) assert.equal(audit.seats[`${id}@${seat}`], 2 * repeats);
    }
  }
});

test('同种子生成完全相同的排列顺序，不同种子可产生不同顺序', () => {
  const [a, b] = teams();
  const p1 = makeArrangementPlan(a, b, 1, randomFrom('seat-seed'));
  const p2 = makeArrangementPlan(a, b, 1, randomFrom('seat-seed'));
  assert.deepEqual(p1.map(x => x.key), p2.map(x => x.key));
  const keys = new Set();
  for (let i = 0; i < 12; i++) keys.add(makeArrangementPlan(a, b, 1, randomFrom(`seat-${i}`)).map(x => x.key).join(','));
  assert.ok(keys.size > 1, '不同种子应能洗出不同顺序');
});

test('引擎 winningTeam 到 A/B 队伍的映射', () => {
  const [a, b] = teams();
  for (const plan of seatArrangements(a, b)) {
    assert.equal(winnerTeamId(plan, a, b, 0), plan.frontTeam);
    assert.equal(winnerTeamId(plan, a, b, 1), plan.backTeam);
  }
  assert.throws(() => winnerTeamId(seatArrangements(a, b)[0], a, b, null), /未给出获胜队伍/);
});

test('6 队 5 轮瑞士轮：全程零重赛、每队恰好 5 场', () => {
  const list = teams();
  const standings = new Map(list.map(t => [t.id, { id: t.id, mp: 0 }]));
  const played = new Set();
  const matches = [];
  for (let round = 1; round <= 5; round++) {
    const { pairs, bye } = pairRound({ standings: [...standings.values()], played, round, masterSeed: 'team-pair-test' });
    assert.equal(bye, null, '6 队不应有轮空');
    assert.equal(pairs.length, 3);
    for (const pair of pairs) {
      assert.equal(pair.rematch, false, `第 ${round} 轮出现重赛`);
      assert.equal(played.has(pairKey(pair.a, pair.b)), false);
      played.add(pairKey(pair.a, pair.b));
      const score = matchScore(5, 3, 8);
      matches.push({ ...pair, ...score, games: [],
        firstWinsA: 3, firstGamesA: 4, secondWinsA: 2, secondGamesA: 4,
        firstWinsB: 3, firstGamesB: 4, secondWinsB: 2, secondGamesB: 4,
        turnsA: 0, turnsB: 0, actionsA: 0, actionsB: 0 });
      standings.get(pair.a).mp += score.mpA;
      standings.get(pair.b).mp += score.mpB;
    }
  }
  assert.equal(played.size, 15, '6 队单循环应有 15 个不同对阵');
  const appearances = new Map(list.map(t => [t.id, 0]));
  for (const match of matches) {
    appearances.set(match.a, appearances.get(match.a) + 1);
    appearances.set(match.b, appearances.get(match.b) + 1);
  }
  for (const [id, count] of appearances) assert.equal(count, 5, `${id} 应恰好打 5 场`);
  assert.equal([...standings.values()].reduce((sum, row) => sum + row.mp, 0), 15, '每场产生 1 场分');
  const ranked = rankPlayers({ entrants: list, matches, masterSeed: 'team-pair-test' });
  assert.equal(ranked.length, 6);
  assert.deepEqual(ranked.map(x => x.rank), [1, 2, 3, 4, 5, 6]);
  const aggregate = aggregateSeasons([{ standings: ranked }], list);
  assert.equal(aggregate.length, 6);
});

test('前瞻配对：20 届随机胜负下，5 轮全程零重赛且打满 15 个对阵', () => {
  const list = teams();
  const allIds = list.map(team => team.id);
  for (let season = 0; season < 20; season++) {
    const seed = `forward-${season}`;
    const standings = new Map(list.map(team => [team.id, { id: team.id, mp: 0 }]));
    const played = new Set();
    const results = randomFrom(`${seed}:results`);
    for (let r = 0; r < 5; r++) {
      const pairing = pairRoundTeams({
        standings: [...standings.values()], played,
        round: r + 1, roundsLeft: 5 - r, masterSeed: seed, allIds
      });
      assert.equal(pairing.infeasible, undefined, `第 ${season} 届 R${r + 1} 前瞻无解`);
      assert.equal(pairing.pairs.length, 3);
      for (const pair of pairing.pairs) {
        assert.equal(pair.rematch, false, `第 ${season} 届 R${r + 1} 出现重赛`);
        assert.equal(played.has(pairKey(pair.a, pair.b)), false);
        played.add(pairKey(pair.a, pair.b));
        const aWins = Math.floor(results() * 9);
        const score = matchScore(aWins, 8 - aWins, 8);
        standings.get(pair.a).mp += score.mpA;
        standings.get(pair.b).mp += score.mpB;
      }
    }
    assert.equal(played.size, 15);
  }
});
