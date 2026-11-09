/**
 * 3V3 复制队四场账目校验：局数守恒、零重赛/重试/配对回退、座位与大将配平、
 * 每届局数一致、冠军数守恒、配置与 manifest 一致。
 * 用法：node tools/mode-clone-verify.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reply', 'mode-clone-20261109');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'));
const EXPECTED = MANIFEST.design;

const files = [
  ['hydra3', 'core'], ['hydra3', 'all'], ['emperor', 'core'], ['emperor', 'all']
].map(([mode, sets]) => ({
  key: `${mode}-${sets}`,
  file: `reply/star-realms-3v3-clone-${mode}-${sets}.json`,
  mode, sets
}));

const results = [];
let allPassed = true;
for (const entry of files) {
  const checks = [];
  const add = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail });
    if (!ok) allPassed = false;
  };
  const full = path.join(ROOT, entry.file);
  if (!fs.existsSync(full)) {
    add('报告存在', false, entry.file);
    results.push({ ...entry, checks });
    continue;
  }
  const report = JSON.parse(fs.readFileSync(full, 'utf8'));
  const { config, audit, stats, aggregate, members, seasons, teams } = report;
  add('格式', report.format === 'star-realms-sim-3v3-lab', report.format);
  add('实验类型', config.experiment === 'clone' && config.teamKind === 'clone3', `${config.experiment}/${config.teamKind}`);
  add('模式/牌包', config.mode === entry.mode && config.setsKey === entry.sets, `${config.mode}/${config.setsKey}`);
  add('主种子', config.masterSeed === EXPECTED.seed, config.masterSeed);
  add('规模', config.teamCount === EXPECTED.teams && config.playersPerTeam === EXPECTED.playersPerTeam
    && config.seasons === EXPECTED.seasons && config.rounds === EXPECTED.rounds
    && config.matchesPerRound === EXPECTED.matchesPerRound && config.bo === EXPECTED.bo,
  `${config.teamCount} 队 × ${config.playersPerTeam} 人 / ${config.seasons} 届 × ${config.rounds} 轮 × ${config.matchesPerRound} 场 / BO${config.bo}`);
  add('总局数守恒', audit.playedGames === audit.totalGames && audit.totalGames === EXPECTED.expectedGamesPerRun,
    `${audit.playedGames}/${audit.totalGames}（预期 ${EXPECTED.expectedGamesPerRun}）`);
  add('零重赛/重试/回退', audit.rematches === 0 && audit.retries === 0 && audit.infeasibleRounds === 0,
    `rematch=${audit.rematches} retry=${audit.retries} fallback=${audit.infeasibleRounds}`);
  add('六座配平', audit.seatBalanced && audit.seatDistinctCounts.length === 1, JSON.stringify(audit.seatDistinctCounts));
  if (entry.mode === 'emperor') {
    add('大将按模型配平', audit.emperorBalanced, String(audit.emperorBalanced));
    add('大将按副本配平', audit.emperorSeatBalanced && audit.emperorSeatDistinctCounts.length === 1, JSON.stringify(audit.emperorSeatDistinctCounts));
  }
  add('每模型局数', members.length === 12 && members.every(row => row.games === audit.perModelGames),
    `${members.length} 人 / 每人 ${audit.perModelGames} 局`);
  add('每模型座位数', members.every(row => row.seatAppearances === row.games * 3),
    `每人 ${audit.perModelSeatAppearances} 次`);
  add('每届局数', seasons.length === config.seasons && seasons.every(season => season.audit.games === config.rounds * config.matchesPerRound * config.bo && season.audit.matches === config.rounds * config.matchesPerRound),
    `${seasons.length} 届 / 每届 ${seasons[0]?.audit?.games} 局`);
  add('冠军数守恒', aggregate.reduce((sum, row) => sum + row.titles, 0) === config.seasons,
    `${aggregate.reduce((sum, row) => sum + row.titles, 0)}/${config.seasons}`);
  add('队伍数', teams.length === 12, String(teams.length));
  add('前位胜率合理', stats.frontSideRate > 0 && stats.frontSideRate < 1, `${(stats.frontSideRate * 100).toFixed(2)}%`);
  results.push({
    key: entry.key, file: entry.file, checks,
    summary: {
      champion: report.champion?.vendor,
      gameRate: report.champion?.gameRate,
      ci95: stats.championCI95,
      rateGap: stats.rateGap,
      z: stats.zScore,
      frontSideRate: stats.frontSideRate,
      elapsedMs: audit.elapsedMs
    }
  });
  console.log(`${entry.key}: ${checks.every(c => c.ok) ? 'PASS' : 'FAIL'} · ${report.champion?.vendor} ${(report.champion?.gameRate * 100).toFixed(2)}% · ${audit.playedGames} 局`);
  for (const check of checks.filter(c => !c.ok)) console.log(`  ✗ ${check.name}: ${check.detail}`);
}

const verification = {
  round: 'mode-clone-20261109',
  generatedAt: new Date().toISOString(),
  allPassed,
  expected: EXPECTED,
  runs: results
};
fs.writeFileSync(path.join(OUT, 'verification.json'), JSON.stringify(verification, null, 2), 'utf8');
console.log(`\n${allPassed ? '✅ 四场账目全部通过' : '❌ 存在未通过项'}；verification.json 已写入 reply/mode-clone-20261109/`);
process.exit(allPassed ? 0 : 1);
