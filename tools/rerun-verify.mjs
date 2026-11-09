// 校验 2026-11-09 全量重跑的 10 份报告：账目守恒、零重赛/重试、逐局种子唯一、胜者唯一、赛制与修订前一致。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_COMMIT = '72f646f';
const FILES = [
  ['swiss', 'star-realms-swiss-report3.json'],
  ['teamSwiss', 'star-realms-team-swiss-report2.json'],
  ['lab-clone-core', 'star-realms-2v2-clone-core.json'],
  ['lab-clone-all', 'star-realms-2v2-clone-all.json'],
  ['lab-random-core', 'star-realms-2v2-random-core.json'],
  ['lab-random-all', 'star-realms-2v2-random-all.json'],
  ['hydra3-core', 'star-realms-hydra3-core.json'],
  ['hydra3-all', 'star-realms-hydra3-all.json'],
  ['emperor-core', 'star-realms-emperor-core.json'],
  ['emperor-all', 'star-realms-emperor-all.json']
];
const CONFIG_KEYS = ['masterSeed', 'seasons', 'rounds', 'repeats', 'perSide', 'bo', 'matchesPerRound', 'mode', 'experiment', 'setsKey', 'sets'];

const results = [];
for (const [key, file] of FILES) {
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'reply', file), 'utf8'));
  let before = null;
  try {
    before = JSON.parse(execFileSync('git', ['show', `${BASE_COMMIT}:reply/${file}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' }));
  } catch { /* 旧版本不存在时跳过配置比对 */ }
  const failures = [];
  const audit = now.audit || {};
  if (audit.playedGames !== audit.totalGames) failures.push(`局数不守恒 ${audit.playedGames}/${audit.totalGames}`);
  for (const field of ['rematches', 'retries', 'infeasibleRounds']) {
    if ((audit[field] ?? 0) !== 0) failures.push(`${field}=${audit[field]}`);
  }
  for (const field of ['seatBalanced', 'emperorBalanced', 'plansBalanced']) {
    if (audit[field] === false) failures.push(`${field}=false`);
  }
  if (Array.isArray(now.seasons) && now.config?.seasons && now.seasons.length !== now.config.seasons) {
    failures.push(`届数 ${now.seasons.length} != ${now.config.seasons}`);
  }

  const seeds = [];
  let games = 0;
  let missingWinner = 0;
  for (const season of now.seasons || []) {
    for (const round of season.rounds || []) {
      for (const pair of round.pairs || []) {
        for (const game of pair.games || []) {
          games++;
          if (game.seed === undefined || game.seed === null) failures.push(`第 ${games} 局缺种子`);
          else seeds.push(String(game.seed));
          const hasWinner = (game.winnerId !== undefined && game.winnerId !== null)
            || (game.winningTeam === 0 || game.winningTeam === 1);
          if (!hasWinner) missingWinner++;
        }
      }
    }
  }
  if (missingWinner) failures.push(`${missingWinner} 局没有胜者`);
  if (games !== audit.playedGames) failures.push(`逐局记录 ${games} != 账目 ${audit.playedGames}`);
  const uniqueSeeds = new Set(seeds).size;
  if (uniqueSeeds !== seeds.length) failures.push(`逐局种子重复 ${seeds.length - uniqueSeeds} 个`);

  const configDiff = [];
  if (before) {
    for (const field of CONFIG_KEYS) {
      const a = JSON.stringify(before.config?.[field] ?? null);
      const b = JSON.stringify(now.config?.[field] ?? null);
      if (a !== b) configDiff.push(`${field}: ${a} -> ${b}`);
    }
    if (configDiff.length) failures.push(`赛制/主种子与修订前不一致: ${configDiff.join('; ')}`);
  }

  results.push({
    key, file,
    ok: failures.length === 0,
    masterSeed: now.config?.masterSeed ?? null,
    totalGames: audit.totalGames ?? null,
    playedGames: audit.playedGames ?? null,
    gamesTraversed: games,
    uniqueSeeds,
    rematches: audit.rematches ?? 0,
    retries: audit.retries ?? 0,
    seatBalanced: audit.seatBalanced ?? null,
    emperorBalanced: audit.emperorBalanced ?? null,
    configMatchesBaseline: before ? configDiff.length === 0 : null,
    configDiff,
    generatedAt: now.generatedAt ?? null,
    failures
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  baselineCommit: BASE_COMMIT,
  reports: results.length,
  allOk: results.every(r => r.ok),
  totalGames: results.reduce((sum, r) => sum + (r.playedGames || 0), 0),
  results
};
const out = path.join(ROOT, 'reply', 'rerun-20261109', 'verification.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
for (const r of results) console.log(`${r.key.padEnd(18)} ok=${String(r.ok).padEnd(5)} games=${String(r.playedGames).padEnd(6)} seeds=${String(r.uniqueSeeds).padEnd(6)} cfgSame=${r.configMatchesBaseline} ${r.failures.join(' | ')}`);
console.log(`ALL OK = ${report.allOk} · 合计 ${report.totalGames} 局`);
process.exit(report.allOk ? 0 : 1);
