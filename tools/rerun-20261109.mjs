// 2026-11-09 全量重跑编排：用修订后 12 份脚本、与旧报告完全相同的主种子与参数重跑 10 场赛制。
// 只负责启动/收集，不改规则、不改动旧报告；进度写 reply/rerun-20261109/manifest.json。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reply', 'rerun-20261109');
const LOG_DIR = path.join(OUT, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const JOBS = [
  {
    key: 'swiss-core',
    label: '1v1 瑞士轮 · 核心',
    args: ['src/tourney-cli.js', '--seed', 'swiss-2026-11-05', '--seasons', '12', '--rounds', '5', '--per-side', '5', '--sets', 'core', '--run-id', 'refresh-20261109-swiss-core', '--quiet', 'true'],
    produces: ['tournaments/latest.json', 'tournaments/latest.md', 'tournaments/refresh-20261109-swiss-core.json', 'tournaments/refresh-20261109-swiss-core.md']
  },
  {
    key: 'team-swiss-core',
    label: '2V2 组队瑞士轮 · 核心',
    args: ['src/team-tourney-cli.js', '--seed', 'swiss-2026-11-05', '--seasons', '12', '--rounds', '5', '--repeats', '1', '--sets', 'core', '--run-id', 'refresh-20261109-team-core', '--quiet', 'true'],
    produces: ['tournaments/team-latest.json', 'tournaments/team-latest.md', 'tournaments/refresh-20261109-team-core.json', 'tournaments/refresh-20261109-team-core.md']
  },
  {
    key: 'lab-clone-core',
    label: '2V2 实验室 A · 复制队 · 核心',
    args: ['src/team-lab-cli.js', '--experiment', 'clone', '--sets', 'core', '--seed', 'lab-2v2-2026-11-06', '--seasons', '12', '--rounds', '5', '--run-id', 'refresh-20261109-clone-core', '--out', 'reply/star-realms-2v2-clone-core', '--quiet', 'true'],
    produces: ['reply/star-realms-2v2-clone-core.json', 'reply/star-realms-2v2-clone-core.md']
  },
  {
    key: 'lab-clone-all',
    label: '2V2 实验室 A · 复制队 · 全扩(3包)',
    args: ['src/team-lab-cli.js', '--experiment', 'clone', '--sets', 'all', '--seed', 'lab-2v2-2026-11-06', '--seasons', '12', '--rounds', '5', '--run-id', 'refresh-20261109-clone-all', '--out', 'reply/star-realms-2v2-clone-all', '--quiet', 'true'],
    produces: ['reply/star-realms-2v2-clone-all.json', 'reply/star-realms-2v2-clone-all.md']
  },
  {
    key: 'lab-random-core',
    label: '2V2 实验室 B · 随机组队 · 核心',
    args: ['src/team-lab-cli.js', '--experiment', 'random', '--sets', 'core', '--seed', 'lab-2v2-2026-11-06', '--seasons', '12', '--rounds', '5', '--run-id', 'refresh-20261109-random-core', '--out', 'reply/star-realms-2v2-random-core', '--quiet', 'true'],
    produces: ['reply/star-realms-2v2-random-core.json', 'reply/star-realms-2v2-random-core.md']
  },
  {
    key: 'lab-random-all',
    label: '2V2 实验室 B · 随机组队 · 全扩(3包)',
    args: ['src/team-lab-cli.js', '--experiment', 'random', '--sets', 'all', '--seed', 'lab-2v2-2026-11-06', '--seasons', '12', '--rounds', '5', '--run-id', 'refresh-20261109-random-all', '--out', 'reply/star-realms-2v2-random-all', '--quiet', 'true'],
    produces: ['reply/star-realms-2v2-random-all.json', 'reply/star-realms-2v2-random-all.md']
  },
  {
    key: 'hydra3-core',
    label: '3V3 三头龙 · 核心',
    args: ['src/mode-tourney-cli.js', '--mode', 'hydra3', '--sets', 'core', '--seasons', '12', '--seed', 'mode-3v3-2026-11-08', '--run-id', 'refresh-20261109-hydra3-core', '--out', 'reply/star-realms-hydra3-core', '--quiet', 'true'],
    produces: ['reply/star-realms-hydra3-core.json', 'reply/star-realms-hydra3-core.md']
  },
  {
    key: 'hydra3-all',
    label: '3V3 三头龙 · 全扩(6包)',
    args: ['src/mode-tourney-cli.js', '--mode', 'hydra3', '--sets', 'all', '--seasons', '12', '--seed', 'mode-3v3-2026-11-08', '--run-id', 'refresh-20261109-hydra3-all', '--out', 'reply/star-realms-hydra3-all', '--quiet', 'true'],
    produces: ['reply/star-realms-hydra3-all.json', 'reply/star-realms-hydra3-all.md']
  },
  {
    key: 'emperor-core',
    label: '3V3 大将战 · 核心',
    args: ['src/mode-tourney-cli.js', '--mode', 'emperor', '--sets', 'core', '--seasons', '12', '--seed', 'mode-3v3-2026-11-08', '--run-id', 'refresh-20261109-emperor-core', '--out', 'reply/star-realms-emperor-core', '--quiet', 'true'],
    produces: ['reply/star-realms-emperor-core.json', 'reply/star-realms-emperor-core.md']
  },
  {
    key: 'emperor-all',
    label: '3V3 大将战 · 全扩(6包)',
    args: ['src/mode-tourney-cli.js', '--mode', 'emperor', '--sets', 'all', '--seasons', '12', '--seed', 'mode-3v3-2026-11-08', '--run-id', 'refresh-20261109-emperor-all', '--out', 'reply/star-realms-emperor-all', '--quiet', 'true'],
    produces: ['reply/star-realms-emperor-all.json', 'reply/star-realms-emperor-all.md']
  }
];

const manifest = {
  round: 'refresh-20261109',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  note: '修订后 12 份脚本；主种子与赛制参数与修订前正式报告完全一致。修订前基线见 reply/baseline-before-refresh/ 与 git 72f646f。',
  concurrency: 5,
  jobs: JOBS.map(job => ({ ...job, status: 'queued', exitCode: null, startedAt: null, finishedAt: null, log: `logs/${job.key}.log` }))
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
const save = () => fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

function runJob(job) {
  return new Promise(resolve => {
    const entry = manifest.jobs.find(item => item.key === job.key);
    entry.status = 'running';
    entry.startedAt = new Date().toISOString();
    save();
    const log = fs.createWriteStream(path.join(LOG_DIR, `${job.key}.log`));
    const child = spawn(process.execPath, job.args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on('error', error => { log.write(`\n[spawn error] ${error.message}\n`); });
    child.on('close', code => {
      log.end(`\n[exit ${code}] ${new Date().toISOString()}\n`);
      entry.status = code === 0 ? 'completed' : 'failed';
      entry.exitCode = code;
      entry.finishedAt = new Date().toISOString();
      save();
      console.log(`${job.key}: exit ${code}`);
      resolve(code);
    });
  });
}

const queue = [...JOBS];
const workers = Array.from({ length: Math.min(5, JOBS.length) }, async () => {
  while (queue.length) {
    const job = queue.shift();
    await runJob(job);
  }
});
const codes = await Promise.all(workers);
manifest.finishedAt = new Date().toISOString();
manifest.allSucceeded = manifest.jobs.every(job => job.status === 'completed');
save();
console.log(`ALL DONE succeeded=${manifest.allSucceeded} finishedAt=${manifest.finishedAt}`);
process.exit(manifest.allSucceeded ? 0 : 1);
