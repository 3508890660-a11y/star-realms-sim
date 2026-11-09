// 从一组官方报告里抽取可比较的关键指标，用于「修订前后」对照。
// 用法: node tools/rerun-metrics.mjs <报告目录> <输出 json 路径>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(ROOT, process.argv[2] || 'reply');
const outFile = path.resolve(ROOT, process.argv[3] || 'reply/rerun-metrics.json');

const FILES = {
  swiss: 'star-realms-swiss-report3.json',
  teamSwiss: 'star-realms-team-swiss-report2.json',
  labCloneCore: 'star-realms-2v2-clone-core.json',
  labCloneAll: 'star-realms-2v2-clone-all.json',
  labRandomCore: 'star-realms-2v2-random-core.json',
  labRandomAll: 'star-realms-2v2-random-all.json',
  hydra3Core: 'star-realms-hydra3-core.json',
  hydra3All: 'star-realms-hydra3-all.json',
  emperorCore: 'star-realms-emperor-core.json',
  emperorAll: 'star-realms-emperor-all.json'
};

const read = key => {
  const file = path.join(dir, FILES[key]);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
};
const round = (v, n = 4) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(n)) : null);
const topBy = (rows, field) => rows && rows.length
  ? [...rows].sort((a, b) => (b[field] ?? -Infinity) - (a[field] ?? -Infinity))[0]
  : null;

function swissOf(j) {
  if (!j) return null;
  const top = j.aggregate?.[0] || null;
  return {
    champion: j.champion ?? null,
    championTitles: j.stats?.championTitles ?? null,
    topId: top?.id ?? null,
    topGameRate: round(top?.gameRate),
    topGames: top?.games ?? null,
    topTitles: top?.titles ?? null,
    firstSideRate: round(j.stats?.firstSideRate),
    totalGames: j.audit?.totalGames ?? null,
    playedGames: j.audit?.playedGames ?? null,
    rematches: j.audit?.rematches ?? null,
    retries: j.audit?.retries ?? null,
    significant95: j.stats?.significant95 ?? null,
    zScore: round(j.stats?.zScore)
  };
}

function teamSwissOf(j) {
  if (!j) return null;
  const top = j.aggregate?.[0] || null;
  return {
    champion: j.champion ?? null,
    championTitles: j.stats?.championTitles ?? null,
    topId: top?.id ?? null,
    topGameRate: round(top?.gameRate),
    topGameWins: top?.gameWins ?? null,
    topGames: top?.games ?? null,
    topTitles: top?.titles ?? null,
    frontSideRate: round(j.stats?.frontSideRate),
    totalGames: j.audit?.totalGames ?? null,
    playedGames: j.audit?.playedGames ?? null,
    rematches: j.audit?.rematches ?? null,
    retries: j.audit?.retries ?? null,
    significant95: j.stats?.significant95 ?? null
  };
}

function labOf(j) {
  if (!j) return null;
  const member = topBy(j.members, 'winRate');
  const beta = topBy(j.contribution?.rows, 'beta');
  const agg = j.aggregate?.[0] || null;
  return {
    champion: j.champion ?? null,
    topAggregateId: agg?.id ?? null,
    topMemberId: member?.id ?? null,
    topMemberWinRate: round(member?.winRate),
    topBetaId: beta?.id ?? null,
    topBeta: round(beta?.beta),
    topBetaZ: round(beta?.z),
    frontSideRate: round(j.stats?.frontSideRate),
    totalGames: j.audit?.totalGames ?? null,
    playedGames: j.audit?.playedGames ?? null,
    rematches: j.audit?.rematches ?? null,
    retries: j.audit?.retries ?? null,
    seatBalanced: j.audit?.seatBalanced ?? null
  };
}

function modeOf(j) {
  if (!j) return null;
  const member = topBy(j.members, 'winRate');
  const beta = topBy(j.contribution?.rows, 'beta');
  return {
    topMemberId: member?.id ?? null,
    topMemberWinRate: round(member?.winRate),
    topBetaId: beta?.id ?? null,
    topBeta: round(beta?.beta),
    topBetaZ: round(beta?.z),
    frontSideRate: round(j.stats?.frontSideRate),
    totalGames: j.audit?.totalGames ?? null,
    playedGames: j.audit?.playedGames ?? null,
    rematches: j.audit?.rematches ?? null,
    retries: j.audit?.retries ?? null,
    seatBalanced: j.audit?.seatBalanced ?? null,
    emperorBalanced: j.audit?.emperorBalanced ?? null
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  sourceDir: path.relative(ROOT, dir).replace(/\\/g, '/'),
  swiss: swissOf(read('swiss')),
  teamSwiss: teamSwissOf(read('teamSwiss')),
  lab: {
    'clone-core': labOf(read('labCloneCore')),
    'clone-all': labOf(read('labCloneAll')),
    'random-core': labOf(read('labRandomCore')),
    'random-all': labOf(read('labRandomAll'))
  },
  modes: {
    'hydra3-core': modeOf(read('hydra3Core')),
    'hydra3-all': modeOf(read('hydra3All')),
    'emperor-core': modeOf(read('emperorCore')),
    'emperor-all': modeOf(read('emperorAll'))
  }
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
