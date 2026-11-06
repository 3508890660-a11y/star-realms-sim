import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'tournaments', 'latest.json');

test('正式赛报告：BO10、先后手、场次、种子与聚合全部守恒', {
  skip: fs.existsSync(FILE) ? false : '尚无正式赛报告'
}, () => {
  const report = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const { config, seasons, aggregate, audit, entrants } = report;
  const perSide = config.perSide;
  const bo = perSide * 2;

  assert.equal(config.entrantCount, 12);
  assert.equal(aggregate.length, 12);
  assert.equal(audit.totalGames, audit.playedGames);
  assert.equal(audit.seasons, seasons.length);
  assert.equal(audit.totalGames, seasons.length * config.rounds * config.matchesPerRound * bo);
  assert.equal(audit.rematches, 0, '正式赛不应出现重赛');

  const allSeeds = [];
  let seasonGames = 0;
  for (const season of seasons) {
    assert.equal(season.standings.length, 12);
    assert.equal(season.rounds.length, config.rounds);
    assert.equal(season.audit.games, config.rounds * config.matchesPerRound * bo);
    seasonGames += season.audit.games;
    const perEntrant = new Map(entrants.map(e => [e.id, { games: 0, first: 0, second: 0, wins: 0 }]));

    for (const round of season.rounds) {
      assert.equal(round.pairs.length, config.matchesPerRound);
      assert.equal(new Set(round.pairs.flatMap(m => [m.a, m.b])).size, 12, '每轮每人恰好一次');
      for (const match of round.pairs) {
        assert.equal(match.games.length, bo);
        assert.equal(match.aWins + match.bWins, bo);
        assert.equal(match.mpA + match.mpB, 1);
        assert.equal(match.firstGamesA, perSide);
        assert.equal(match.firstGamesB, perSide);
        const firstHalf = match.games.slice(0, perSide);
        const secondHalf = match.games.slice(perSide);
        assert.ok(firstHalf.every(g => g.first === match.a && g.second === match.b), 'A 先手 BO5');
        assert.ok(secondHalf.every(g => g.first === match.b && g.second === match.a), 'B 先手 BO5');
        for (const game of match.games) {
          allSeeds.push(game.seed);
          assert.ok(game.winnerId === match.a || game.winnerId === match.b);
          perEntrant.get(match.a).games++;
          perEntrant.get(match.b).games++;
          perEntrant.get(game.first).first++;
          perEntrant.get(game.second).second++;
          perEntrant.get(game.winnerId).wins++;
        }
      }
    }
    for (const [id, row] of perEntrant) {
      assert.equal(row.games, config.rounds * bo, `${id} 单届局数`);
      assert.equal(row.first, config.rounds * perSide, `${id} 先手局数`);
      assert.equal(row.second, config.rounds * perSide, `${id} 后手局数`);
    }
    assert.equal([...perEntrant.values()].reduce((sum, row) => sum + row.wins, 0), season.audit.games, '每局恰有一个胜者');
  }

  assert.equal(seasonGames, audit.totalGames);
  assert.equal(new Set(allSeeds).size, allSeeds.length, '每局随机种子互不相同');
  for (const row of aggregate) {
    assert.equal(row.games, seasons.length * config.rounds * bo);
    assert.equal(row.firstGames + row.secondGames, row.games);
    assert.equal(row.firstGames, row.secondGames);
  }
  assert.equal(aggregate.reduce((sum, row) => sum + row.gameWins, 0), audit.totalGames, '全局每局恰有一个胜者');
});
