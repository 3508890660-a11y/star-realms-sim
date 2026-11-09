// 2026-11-09 3V3 同模型复制队四场：编排启动与产物收集。
// 口径对齐 2V2 实验 A：12 支三人复制队、12 届 × 5 轮瑞士轮、BO6、主种子 mode-3v3-2026-11-08。
// 只负责启动/记录，不改规则、不覆盖 3V3 随机组队四场报告。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reply', 'mode-clone-20261109');
const LOG_DIR = path.join(OUT, 'logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const SEED = 'mode-3v3-2026-11-08';
const JOBS = ['hydra3', 'emperor'].flatMap(mode => ['core', 'all'].map(sets => ({
  key: `${mode}-${sets}`,
  label: `3V3 复制队 · ${mode === 'hydra3' ? '三头龙' : '大将战'} · ${sets === 'core' ? '核心' : '全扩(6包)'}`,
  args: [
    'src/mode-lab-cli.js', '--mode', mode, '--sets', sets,
    '--seasons', '12', '--rounds', '5', '--repeats', '1',
    '--seed', SEED,
    '--run-id', `clone3-20261109-${mode}-${sets}`,
    '--out', `reply/star-realms-3v3-clone-${mode}-${sets}`,
    '--quiet', 'true'
  ],
  produces: [`reply/star-realms-3v3-clone-${mode}-${sets}.json`, `reply/star-realms-3v3-clone-${mode}-${sets}.md`]
})));

const manifest = {
  round: 'mode-clone-20261109',
  startedAt: new Date().toISOString(),
  finishedAt: null,
  note: '3V3 同模型复制队四场：12 支三人复制队、12 届 × 5 轮瑞士轮、BO6。主种子沿用 3V3 随机组队四场；不改动既有报告。',
  design: {
    experiment: 'clone3', teams: 12, playersPerTeam: 3,
    seasons: 12, rounds: 5, matchesPerRound: 6, bo: 6,
    expectedGamesPerRun: 12 * 5 * 6 * 6,
    seed: SEED
  },
  concurrency: 4,
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
    child.on('error', error => log.write(`\n[spawn error] ${error.message}\n`));
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
const workers = Array.from({ length: Math.min(4, JOBS.length) }, async () => {
  while (queue.length) await runJob(queue.shift());
});
await Promise.all(workers);
manifest.finishedAt = new Date().toISOString();
manifest.allSucceeded = manifest.jobs.every(job => job.status === 'completed');
save();
console.log(`ALL DONE succeeded=${manifest.allSucceeded} finishedAt=${manifest.finishedAt}`);
process.exit(manifest.allSucceeded ? 0 : 1);
