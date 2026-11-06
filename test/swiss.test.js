import test from 'node:test';
import assert from 'node:assert/strict';
import { randomFrom } from '../src/engine/rng.js';
import {
  shuffleWithRandom, makeGameSeeds, pairRound, pairKey,
  matchScore, rankPlayers, aggregateSeasons, seededOrder
} from '../src/engine/swiss.js';

const IDS = ['hy4', 'hy3', 'glm53', 'glm53flash', 'minimaxm3', 'minimaxm31flash',
  'kimi31pro', 'kimi28preview', 'deepseekv41flash', 'deepseekv4pro', 'step5preview', 'mimov26pro'];
const entrants = IDS.map(id => ({ id }));

test('初始随机排序由种子决定，同种子可复现、异种子会改变顺序', () => {
  const a = shuffleWithRandom(IDS, randomFrom('seed:entrants'));
  const b = shuffleWithRandom(IDS, randomFrom('seed:entrants'));
  const c = shuffleWithRandom(IDS, randomFrom('other:entrants'));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual([...a].sort(), [...IDS].sort());
});

test('局种子表按轮/场/局生成且全局互不相同', () => {
  const table = makeGameSeeds('master', 5, 6, 5);
  assert.equal(table.length, 5);
  assert.equal(table[0].length, 6);
  assert.equal(table[0][0].length, 10);
  const all = table.flat(2);
  assert.equal(all.length, 300);
  assert.equal(new Set(all).size, 300);
  assert.deepEqual(makeGameSeeds('master', 5, 6, 5).flat(2), all);
  assert.notDeepEqual(makeGameSeeds('master2', 5, 6, 5).flat(2), all);
});

test('同分随机排序按场分降序、组内顺序由种子打乱', () => {
  const standings = [
    { id: 'a', mp: 1 }, { id: 'b', mp: 1 }, { id: 'c', mp: 1 },
    { id: 'd', mp: 0.5 }, { id: 'e', mp: 0 }
  ];
  const order = seededOrder(standings, randomFrom('m:pair:r2'));
  assert.deepEqual(order.slice(3).map(x => x.id), ['d', 'e']);
  assert.equal(order.slice(0, 3).length, 3);
  assert.notDeepEqual(order.map(x => x.id), ['a', 'b', 'c', 'd', 'e']);
});

test('5 轮 12 人瑞士轮：每轮 6 场、每人恰好一次、无重赛', () => {
  const standings = new Map(IDS.map(id => [id, { id, mp: 0 }]));
  const played = new Set();
  const allPairs = [];
  for (let round = 1; round <= 5; round++) {
    const { pairs, bye, order } = pairRound({
      standings: [...standings.values()], played, round, masterSeed: 'sim'
    });
    assert.equal(pairs.length, 6);
    assert.equal(bye, null);
    assert.equal(order.length, 12);
    assert.equal(new Set(pairs.flatMap(p => [p.a, p.b])).size, 12);
    for (const pair of pairs) {
      assert.equal(pair.rematch, false, `第 ${round} 轮出现重赛 ${pair.a}/${pair.b}`);
      played.add(pairKey(pair.a, pair.b));
      allPairs.push(pair);
    }
    // 用固定的胜负结果推进积分，模拟真实赛程
    for (const pair of pairs) {
      standings.get(pair.a).mp += 1;
      standings.get(pair.b).mp += 0;
    }
  }
  assert.equal(allPairs.length, 30);
  assert.equal(played.size, 30);
});

test('BO10 计分、平局场分与排名破同分', () => {
  assert.deepEqual(matchScore(7, 3, 10), { aWins: 7, bWins: 3, mpA: 1, mpB: 0, drawn: false });
  assert.deepEqual(matchScore(3, 7, 10), { aWins: 3, bWins: 7, mpA: 0, mpB: 1, drawn: false });
  assert.deepEqual(matchScore(5, 5, 10), { aWins: 5, bWins: 5, mpA: 0.5, mpB: 0.5, drawn: true });
  assert.throws(() => matchScore(5, 4, 10), /守恒/);

  const mk = (a, b, aWins, bWins) => ({
    a, b, ...matchScore(aWins, bWins, 10),
    turnsA: 100, turnsB: 100, actionsA: 1000, actionsB: 1000,
    firstWinsA: 5, firstGamesA: 5, secondWinsA: Math.max(0, aWins - 5), secondGamesA: 5,
    firstWinsB: 5, firstGamesB: 5, secondWinsB: Math.max(0, bWins - 5), secondGamesB: 5
  });
  // 三人各打两场，a 与 c 场分相同，用局分与 Buchholz 分出先后
  const matches = [mk('a', 'b', 6, 4), mk('a', 'c', 5, 5), mk('c', 'b', 6, 4)];
  const rows = rankPlayers({ entrants: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], matches, masterSeed: 'rank' });
  assert.equal(rows[0].id, 'a');
  assert.equal(rows[0].mp, 1.5);
  assert.equal(rows[0].gameWins, 11);
  assert.equal(rows[0].games, 20);
  assert.equal(rows[1].id, 'c');
  assert.equal(rows[2].id, 'b');
  assert.equal(rows.reduce((sum, r) => sum + r.mp, 0), 3);
  assert.equal(rows.reduce((sum, r) => sum + r.gameWins, 0), 30);
});

test('多届聚合按局胜率排序并守恒', () => {
  const mkSeason = (rankMap, wins) => ({
    standings: IDS.map(id => ({
      id, rank: rankMap[id], mp: wins[id] > 25 ? 5 : 2,
      gameWins: wins[id], games: 50, buchholz: 20,
      firstWins: Math.floor(wins[id] / 2), firstGames: 25,
      secondWins: wins[id] - Math.floor(wins[id] / 2), secondGames: 25
    }))
  });
  const rankMap = Object.fromEntries(IDS.map((id, i) => [id, i + 1]));
  const wins = Object.fromEntries(IDS.map((id, i) => [id, 40 - i]));
  const seasons = [mkSeason(rankMap, wins), mkSeason(rankMap, wins)];
  const rows = aggregateSeasons(seasons, entrants);
  assert.equal(rows.length, 12);
  assert.equal(rows[0].id, 'hy4');
  assert.equal(rows[0].games, 100);
  assert.equal(rows[0].gameWins, 80);
  assert.equal(rows[0].avgRank, 1);
  assert.equal(rows[0].titles, 2);
  assert.equal(rows.reduce((sum, r) => sum + r.gameWins, 0), seasons.length * IDS.reduce((s, id) => s + wins[id], 0));
});
