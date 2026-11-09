import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCloneTrios } from '../src/engine/team-lab.js';
import { MatchRunner } from '../src/engine/runner.js';
import { seatPlan } from '../src/mode-tourney-cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
const cloneTeams = buildCloneTrios(catalog);

const REPORTS = [
  'reply/star-realms-3v3-clone-hydra3-core.json',
  'reply/star-realms-3v3-clone-hydra3-all.json',
  'reply/star-realms-3v3-clone-emperor-core.json',
  'reply/star-realms-3v3-clone-emperor-all.json'
];

test('复制队构造：12 支三人队，座位 id 唯一且同一队共用一份脚本', () => {
  assert.equal(cloneTeams.length, 12);
  const seats = cloneTeams.flatMap(team => team.players.map(player => player.id));
  assert.equal(seats.length, 36);
  assert.equal(new Set(seats).size, 36);
  for (const team of cloneTeams) {
    assert.equal(team.players.length, 3);
    const scripts = new Set(team.players.map(player => player.script));
    assert.equal(scripts.size, 1);
    assert.equal(new Set(team.players.map(player => player.model)).size, 1);
  }
});

test('复制队座位/大将轮换：BO6 覆盖 6 个座位，每人各当 2 次大将', () => {
  const plan = seatPlan(cloneTeams[0], cloneTeams[1], 6, 0);
  assert.equal(plan.length, 6);
  const seatCount = new Map();
  const seatMatrix = new Map();
  const emperorCount = new Map();
  for (const game of plan) {
    game.seats.forEach((player, seat) => {
      seatCount.set(player.id, (seatCount.get(player.id) || 0) + 1);
      if (!seatMatrix.has(player.id)) seatMatrix.set(player.id, new Map());
      const row = seatMatrix.get(player.id);
      row.set(seat, (row.get(seat) || 0) + 1);
    });
    for (const seat of game.emperors) {
      const id = game.seats[seat].id;
      emperorCount.set(id, (emperorCount.get(id) || 0) + 1);
    }
  }
  assert.equal(seatCount.size, 6);
  assert.deepEqual([...new Set(seatCount.values())], [6]);
  for (const row of seatMatrix.values()) {
    assert.equal(row.size, 6);
    assert.deepEqual([...new Set(row.values())], [1]);
  }
  assert.equal(emperorCount.size, 6);
  assert.deepEqual([...new Set(emperorCount.values())], [2]);
});

test('复制队单局：三头龙可正常跑完且胜队只有 0/1', async () => {
  const plan = seatPlan(cloneTeams[0], cloneTeams[1], 1, 0)[0];
  const runner = await MatchRunner.create({
    mode: 'hydra3',
    seed: 'test-3v3-clone-single',
    expansions: { sets: ['core'] },
    players: plan.seats.map(player => ({ name: player.display, script: player.script }))
  });
  const result = await runner.runToEnd(200000);
  assert.ok(result.winningTeam === 0 || result.winningTeam === 1);
  assert.ok(result.turns > 0);
});

for (const file of REPORTS) {
  test(`账目守恒：${path.basename(file)}`, () => {
    const report = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const { config, audit, stats, aggregate, members, contribution, seasons, teams } = report;
    assert.equal(report.format, 'star-realms-sim-3v3-lab');
    assert.equal(config.experiment, 'clone');
    assert.equal(config.teamKind, 'clone3');
    assert.equal(config.teamCount, 12);
    assert.equal(config.playersPerTeam, 3);
    assert.equal(config.rounds, 5);
    assert.equal(config.matchesPerRound, 6);
    assert.equal(config.bo, 6);
    assert.equal(config.masterSeed, 'mode-3v3-2026-11-08');
    assert.equal(audit.totalGames, config.seasons * config.rounds * config.matchesPerRound * config.bo);
    assert.equal(audit.playedGames, audit.totalGames);
    assert.equal(audit.rematches, 0);
    assert.equal(audit.retries, 0);
    assert.equal(audit.infeasibleRounds, 0);
    assert.equal(audit.seatBalanced, true);
    assert.equal(audit.seatDistinctCounts.length, 1);
    assert.equal(audit.perModelGames, config.seasons * config.rounds * config.bo);
    assert.equal(audit.perModelSeatAppearances, audit.perModelGames * 3);
    if (config.mode === 'emperor') {
      assert.equal(audit.emperorBalanced, true);
      assert.equal(audit.emperorSeatBalanced, true);
      assert.equal(audit.emperorSeatDistinctCounts.length, 1);
    }
    assert.equal(teams.length, 12);
    assert.equal(aggregate.length, 12);
    assert.equal(seasons.length, config.seasons);
    for (const season of seasons) {
      assert.equal(season.audit.games, config.rounds * config.matchesPerRound * config.bo);
      assert.equal(season.audit.matches, config.rounds * config.matchesPerRound);
      assert.equal(season.audit.rematches, 0);
    }
    assert.equal(aggregate.reduce((sum, row) => sum + row.titles, 0), config.seasons);
    assert.equal(members.length, 12);
    assert.ok(members.every(row => row.games === audit.perModelGames));
    assert.ok(members.every(row => row.seatAppearances === row.games * 3));
    assert.equal(contribution.samples, audit.playedGames);
    assert.equal(contribution.converged, true);
    assert.ok(stats.frontSideRate > 0 && stats.frontSideRate < 1);
    assert.ok(aggregate[0].gameRate >= aggregate[1].gameRate);
    assert.ok(report.champion && report.champion.vendor);
  });
}
