import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'tournaments', 'team-latest.json'), 'utf8'));

test('组队赛正式报告：6 队构成与配置', () => {
  assert.equal(report.format, 'star-realms-team-swiss');
  assert.equal(report.config.mode, 'team2v2');
  assert.equal(report.config.teamCount, 6);
  assert.equal(report.teams.length, 6);
  assert.equal(report.teams.filter(t => t.kind === 'same-vendor').length, 5);
  assert.equal(report.teams.filter(t => t.kind === 'mixed').length, 1);
  assert.deepEqual(report.teams.at(-1).players.map(p => p.id), ['step5preview', 'mimov26pro']);
  const ids = report.teams.flatMap(t => t.players.map(p => p.id));
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
});

test('组队赛正式报告：1440 局守恒、零重赛、零重试、座位完全配平', () => {
  const { config, audit, stats } = report;
  assert.equal(config.seasons, 12);
  assert.equal(config.rounds, 5);
  assert.equal(config.bo, 8);
  assert.equal(audit.totalGames, 12 * 5 * 3 * 8);
  assert.equal(audit.playedGames, audit.totalGames);
  assert.equal(audit.rematches, 0, '前瞻配对后不应有重赛');
  assert.equal(audit.retries, 0);
  assert.equal(audit.infeasibleRounds, 0, '不应出现前瞻无解回退');
  assert.equal(audit.plansBalanced, true);
  assert.equal(stats.seatBalanced, true);
  assert.equal(stats.totalGames, audit.totalGames);
  assert.ok(stats.frontSideRate > 0 && stats.frontSideRate < 1);
});

test('组队赛正式报告：逐局种子唯一、8 种座位排列各一次、胜者唯一', () => {
  const seeds = new Set();
  let games = 0;
  for (const season of report.seasons) {
    assert.equal(season.rounds.length, 5);
    const playedPairs = new Set();
    for (const round of season.rounds) {
      assert.equal(round.pairs.length, 3);
      for (const match of round.pairs) {
        assert.equal(match.rematch, false);
        const key = [match.a, match.b].sort().join('|');
        assert.equal(playedPairs.has(key), false, `同届重复对阵 ${key}`);
        playedPairs.add(key);
        assert.equal(match.games.length, report.config.bo);
        assert.equal(new Set(match.games.map(g => g.arrangement)).size, 8, '8 种座位排列必须各出现一次');
        assert.equal(match.aWins + match.bWins, match.games.length);
        for (const game of match.games) {
          games++;
          assert.equal(seeds.has(game.seed), false, `重复局种子 ${game.seed}`);
          seeds.add(game.seed);
          assert.ok(game.winnerId === match.a || game.winnerId === match.b, '胜者必须是参赛两队之一');
          assert.equal(game.seats.length, 4);
          assert.equal(new Set(game.seats).size, 4);
        }
      }
    }
    assert.equal(playedPairs.size, 15, '6 队单循环应有 15 个不同对阵');
  }
  assert.equal(games, report.audit.totalGames);
  assert.equal(seeds.size, games);
});

test('组队赛正式报告：聚合账目与每队局数一致', () => {
  const perTeam = 12 * 5 * 8;
  assert.equal(report.audit.perTeamGames, perTeam);
  for (const row of report.aggregate) {
    assert.equal(row.games, perTeam);
    assert.ok(row.gameWins >= 0 && row.gameWins <= row.games, '局胜数不得超出总局数');
    assert.ok(Math.abs(row.gameRate - row.gameWins / row.games) < 0.0001);
    assert.equal(row.firstGames + row.secondGames, perTeam);
  }
  assert.equal(report.aggregate.reduce((sum, row) => sum + row.gameWins, 0), report.audit.totalGames);
  assert.equal(report.champion.id, report.aggregate[0].id);
  assert.equal(report.memberStats.length, 12);
});
