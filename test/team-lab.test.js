import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCloneTeams, buildRandomTeams, wilson, fitContribution,
  memberStats, auditSeatBalance, modelsOfSeats
} from '../src/engine/team-lab.js';
import {
  makeArrangementPlan, auditArrangementPlan, seatArrangements
} from '../src/engine/team-swiss.js';
import { shuffleWithRandom } from '../src/engine/swiss.js';
import { randomFrom } from '../src/engine/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;

test('实验 A：12 支复制队，每队是同一脚本的两个独立副本', () => {
  const teams = buildCloneTeams(catalog());
  assert.equal(teams.length, 12);
  assert.equal(new Set(teams.map(t => t.model)).size, 12);
  const seats = teams.flatMap(t => t.players.map(p => p.id));
  assert.equal(seats.length, 24);
  assert.equal(new Set(seats).size, 24, '24 个座位必须可区分');
  for (const team of teams) {
    assert.equal(team.players.length, 2);
    assert.equal(team.players[0].script, team.players[1].script, '两个副本必须指向同一份脚本');
    assert.equal(team.players[0].model, team.players[1].model);
    assert.notEqual(team.players[0].id, team.players[1].id);
    assert.ok(fs.existsSync(path.join(ROOT, 'scripts', team.players[0].script.slice(7))));
  }
});

test('实验 A：复制队的 8 种座位排列依然严格配平', () => {
  const teams = buildCloneTeams(catalog());
  const plan = makeArrangementPlan(teams[0], teams[1], 1, randomFrom('clone-seats'));
  assert.equal(plan.length, 8);
  assert.equal(new Set(seatArrangements(teams[0], teams[1]).map(x => x.key)).size, 8);
  const audit = auditArrangementPlan(plan, teams[0], teams[1]);
  assert.equal(audit.balanced, true);
  assert.equal(new Set(Object.values(audit.seats)).size, 1);
  const bySeatId = new Map([...teams[0].players, ...teams[1].players].map(p => [p.id, p]));
  for (const item of plan) {
    const models = modelsOfSeats(item.seats, bySeatId);
    const aIsFront = item.frontTeam === teams[0].id;
    assert.deepEqual([models[0], models[2]], [aIsFront ? teams[0].model : teams[1].model, aIsFront ? teams[0].model : teams[1].model]);
    assert.deepEqual([models[1], models[3]], [aIsFront ? teams[1].model : teams[0].model, aIsFront ? teams[1].model : teams[0].model]);
  }
});

test('实验 B：每届随机组队 6 队、12 模型不重不漏，且同种子可复现', () => {
  const list = catalog();
  const a = buildRandomTeams(list, 1, 'lab-seed');
  const b = buildRandomTeams(list, 1, 'lab-seed');
  assert.equal(a.teams.length, 6);
  const ids = a.teams.flatMap(t => t.players.map(p => p.id));
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
  assert.deepEqual(a.pairs, b.pairs, '同种子同届必须完全复现');
  for (const team of a.teams) assert.notEqual(team.players[0].id, team.players[1].id);
  const c = buildRandomTeams(list, 2, 'lab-seed');
  assert.notDeepEqual(a.pairs, c.pairs, '不同届应当重新组队');
});

test('实验 B：跨届搭档覆盖随届数增加并趋于均衡', () => {
  const list = catalog();
  const counts = new Map();
  for (let s = 1; s <= 12; s++) {
    const { pairs } = buildRandomTeams(list, s, 'balance-seed', counts);
    for (const [x, y] of pairs) {
      const key = [x, y].sort().join('|');
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  assert.ok(counts.size >= 50, `12 届应覆盖多数搭档组合，实际 ${counts.size}`);
  assert.ok(Math.max(...counts.values()) <= 6, '同一对搭档不应被过度重复');
});

test('在场统计：胜负、搭档、对手、座位分布逐项守恒', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const games = [
    { models: ['a', 'b', 'c', 'd'], winningTeam: 0 },  // 前位队 a+c 胜
    { models: ['b', 'a', 'd', 'c'], winningTeam: 1 }   // 后位队 a+c 胜
  ];
  const rows = memberStats(games, ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  assert.equal(byId.get('a').games, 2);
  assert.equal(byId.get('a').wins, 2);
  assert.equal(byId.get('b').wins, 0);
  assert.deepEqual(byId.get('a').seats, [1, 1, 0, 0]);
  assert.equal(byId.get('a').partnerCount, 1);
  assert.equal(byId.get('a').partnerCounts.c, 2);
  assert.equal(byId.get('a').opponentCounts.b, 2);
  assert.equal(byId.get('a').opponentCounts.d, 2);
  assert.equal(byId.get('a').frontRate, 1);
  assert.equal(rows.reduce((sum, r) => sum + r.games, 0), 8);
  assert.equal(rows.reduce((sum, r) => sum + r.wins, 0), 4);
  assert.equal(auditSeatBalance(rows).balanced, false, '2 局样本不会让 4 个座位都等频');
});

test('Wilson 区间：边界与单调性', () => {
  assert.deepEqual(wilson(0, 0), [0, 0]);
  const [lo, hi] = wilson(50, 100);
  assert.ok(lo < 0.5 && hi > 0.5);
  assert.ok(wilson(90, 100)[0] > wilson(50, 100)[0]);
});

test('边际贡献 β：合成数据能还原真实强弱顺序与前位优势', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const truth = { a: 1.2, b: 0.8, c: 0.3, d: -0.2, e: -0.7, f: -1.4 };
  const random = randomFrom('fit-synthetic');
  const games = [];
  for (let i = 0; i < 6000; i++) {
    const order = shuffleWithRandom(ids, random);
    const m = [order[0], order[1], order[2], order[3]];
    const score = truth[m[0]] + truth[m[2]] - truth[m[1]] - truth[m[3]] + 0.2;
    const p = 1 / (1 + Math.exp(-score));
    games.push({ models: m, winningTeam: random() < p ? 0 : 1 });
  }
  const fit = fitContribution(games, ids);
  assert.equal(fit.converged, true);
  assert.equal(fit.samples, 6000);
  assert.equal(fit.rows[0].id, 'a');
  assert.equal(fit.rows.at(-1).id, 'f');
  assert.deepEqual(fit.rows.slice(0, 3).map(r => r.id).sort(), ['a', 'b', 'c']);
  assert.ok(fit.frontAdvantage > 0, '正的前位优势应被截距 γ 捕获');
  assert.ok(fit.rows[0].se > 0);
  assert.ok(Math.abs(fit.rows.reduce((sum, r) => sum + r.beta, 0)) < 1e-6, 'β 应中心化为 0');
});

test('座位配平审计：等频样本通过，不等频样本不通过', () => {
  const balanced = [{ seats: [2, 2, 2, 2] }, { seats: [2, 2, 2, 2] }];
  assert.equal(auditSeatBalance(balanced).balanced, true);
  const skewed = [{ seats: [3, 1, 2, 2] }, { seats: [2, 2, 2, 2] }];
  assert.equal(auditSeatBalance(skewed).balanced, false);
});

test('正式实验报告：四场账目守恒、零重赛、座位与个人统计一致', () => {
  const files = [
    'reply/star-realms-2v2-clone-core.json',
    'reply/star-realms-2v2-clone-all.json',
    'reply/star-realms-2v2-random-core.json',
    'reply/star-realms-2v2-random-all.json'
  ];
  const present = files.filter(f => fs.existsSync(path.join(ROOT, f)));
  if (!present.length) return;   // 正式赛尚未运行时跳过
  for (const file of present) {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    const c = r.config, a = r.audit;
    assert.equal(a.playedGames, a.totalGames, `${file} 局数不守恒`);
    assert.equal(a.playedGames, c.seasons * c.rounds * c.matchesPerRound * c.bo);
    assert.equal(a.rematches, 0, `${file} 出现重赛`);
    assert.equal(a.retries, 0, `${file} 出现异常重试`);
    assert.equal(a.infeasibleRounds, 0, `${file} 出现前瞻回退`);
    assert.equal(a.seatBalanced, true, `${file} 座位未配平`);
    assert.equal(r.seasons.length, c.seasons);
    assert.equal(r.members.length, 12);
    assert.equal(r.contribution.rows.length, 12);
    assert.equal(r.contribution.samples, a.playedGames);
    assert.ok(r.members.every(m => m.games === a.perModelGames), `${file} 每人在场局数不等`);
    assert.equal(a.perModelGames, c.seasons * c.rounds * c.bo);
    for (const s of r.seasons) {
      assert.equal(s.audit.rematches, 0);
      for (const round of s.rounds) {
        for (const match of round.pairs) {
          assert.equal(match.games.length, c.bo);
          assert.equal(match.aWins + match.bWins, c.bo);
          for (const game of match.games) {
            assert.equal(game.models.length, 4);
            assert.ok([0, 1].includes(game.winningTeam));
            assert.ok([match.a, match.b].includes(game.winnerId));
          }
        }
      }
    }
    if (c.experiment === 'clone') {
      assert.equal(r.aggregate.length, 12);
      assert.equal(r.aggregate[0].id, r.champion.id);
      assert.ok(r.teams.every(t => t.players[0].script === t.players[1].script));
    } else {
      assert.equal(r.aggregate, null);
      assert.ok(a.partnerPairs >= 50, `${file} 跨届搭档覆盖不足`);
    }
  }
});
