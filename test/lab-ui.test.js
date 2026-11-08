import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const PORT = 4499;
const URL = `http://127.0.0.1:${PORT}`;

async function ready(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('服务启动超时')), 6000);
    child.stdout.on('data', data => {
      if (String(data).includes('http://127.0.0.1')) { clearTimeout(timer); resolve(); }
    });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`服务提前退出 ${code}`)); });
  });
}

test('观战台实验室：HTML 按钮、对话框与全部挂载点齐备', () => {
  const html = read('public/index.html');
  for (const id of [
    'labBtn', 'labBadge', 'labDialog', 'closeLab', 'labHeadline', 'labSummary',
    'labRunTabs', 'labAudit', 'labTabs', 'labBody', 'labDownload', 'labRefresh'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `缺少挂载点 ${id}`);
  }
  assert.match(html, /class="tournament-dialog lab-dialog"/, '实验室对话框应复用现有看板样式');
  assert.match(html, /<script type="module" src="\/app\.js">/);
  // 原有面板的按钮与对话框必须原样保留
  for (const id of ['tournamentBtn', 'teamTournamentBtn', 'subagentsBtn', 'newMatchBtn']) {
    assert.match(html, new RegExp(`id="${id}"`), `原有按钮 ${id} 不应被删除`);
  }
});

test('观战台实验室：前端有刷新/渲染/四场切换与下载绑定', () => {
  const app = read('public/app.js');
  for (const pattern of [
    /async function refreshLab\(\)/, /function renderLab\(\)/,
    /api\('\/api\/lab'\)/, /\/api\/lab\/full\?run=/,
    /LAB_RUN_ORDER/, /function labBetaBoard\(/, /function labCloneBoard\(/,
    /function labNotesHtml\(/, /\$\('#labBtn'\)\.onclick/,
    /\$\('#labRefresh'\)\.onclick/, /refreshLab\(\)\]/,
    /setInterval\(\(\) => \{ if \(\$\('#labDialog'\)\.open\) refreshLab\(\); \}, 3000\)/
  ]) assert.match(app, pattern, `前端缺少 ${pattern}`);
  // 原有 1.5s 看板轮询不得被改动
  assert.match(app, /}, 1500\);/, '原有锦标赛看板轮询间隔应保持 1.5s');
  assert.match(app, /refreshTournament\(\);[\s\S]{0,120}refreshTeamTournament\(\);/);
  // 新增牌包后，锦标赛牌包勾选框改由 /api/options 动态生成，避免 HTML 与常量脱节
  assert.match(app, /function renderTourneySets\(\)/);
  assert.match(app, /renderOptions\(\);\s*\n\s*renderTourneySets\(\);/, '启动时应同时渲染牌包勾选框');
});

test('观战台实验室：服务端有白名单只读 API 与下载端点', () => {
  const server = read('src/server/server.js');
  assert.match(server, /const LAB_RUNS = Object\.freeze\(\[/);
  assert.match(server, /url\.pathname === '\/api\/lab'\)/);
  assert.match(server, /url\.pathname === '\/api\/lab\/full'\)/);
  assert.match(server, /LAB_RUNS\.find\(run => run\.key === key\)/, '下载端点必须用白名单校验');
  assert.match(server, /function readLab\(\)/);
  assert.match(server, /labCache\.signature/, '报告需要 mtime 缓存，避免每次请求解析 3MB JSON');
  assert.match(server, /function briefLabRun\(/, '看板不应把逐局明细一起返回');
  const css = read('public/tournament.css');
  for (const cls of ['.lab-dialog', '.lab-audit', '.lab-notes', '.lab-body', '.lab-run-tabs']) {
    assert.match(css, new RegExp(cls.replace('.', '\\.')), `缺少样式 ${cls}`);
  }
});

test('实验室 API：四场报告精简可读、结论一致、可下载完整报告', async () => {
  const child = spawn(process.execPath, ['src/server/server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    await ready(child);
    const response = await fetch(`${URL}/api/lab`);
    assert.equal(response.status, 200);
    const board = await response.json();
    assert.equal(board.format, 'star-realms-sim-2v2-lab-board');
    assert.equal(board.runs.length, 8);
    assert.equal(Object.keys(board.models).length, 12);
    assert.equal(board.summary.consistent, true);
    assert.equal(board.summary.championId, 'deepseekv41flash');
    assert.deepEqual(board.runs.filter(run => run.group === '3v3').map(run => run.key),
      ['hydra3-core', 'hydra3-all', 'emperor-core', 'emperor-all']);

    for (const run of board.runs) {
      assert.equal(run.missing, undefined, `${run.key} 报告应存在`);
      assert.equal(run.config.seasons, 12);
      assert.equal(run.audit.rematches, 0);
      assert.equal(run.audit.retries, 0);
      assert.equal(run.audit.seatBalanced, true);
      assert.equal(run.members.length, 12);
      assert.equal(run.contribution.rows.length, 12);
      assert.equal(run.seasons.length, 12);
      if (run.group === '3v3') {
        assert.equal(run.config.rounds, 3);
        assert.equal(run.config.bo, 6);
        assert.equal(run.audit.emperorBalanced, true);
        assert.equal(run.aggregate, null, '3V3 场次没有复制队聚合榜');
      } else {
        assert.equal(run.config.rounds, 5);
        assert.equal(run.config.bo, 8);
        if (run.experiment === 'clone') assert.equal(run.aggregate.length, 12);
        else assert.equal(run.aggregate, null);
      }
    }
    // 看板必须精简：八场合计远小于逐份完整报告之和（单份 0.6–3.8MB 级）
    assert.ok(JSON.stringify(board).length < 500000, '看板不应携带逐局明细');
    assert.ok(!JSON.stringify(board).includes('"winningTeam"'), '看板不应包含逐局胜负字段');

    const full = await fetch(`${URL}/api/lab/full?run=clone-core`);
    assert.equal(full.status, 200);
    assert.match(full.headers.get('content-disposition') || '', /attachment/);
    const report = await full.json();
    assert.equal(report.audit.playedGames, 2880);
    assert.equal(report.seasons[0].rounds[0].pairs[0].games.length, 8);

    const bad = await fetch(`${URL}/api/lab/full?run=../package.json`);
    assert.equal(bad.status, 400, '白名单之外的 run 必须拒绝');

    const page = await fetch(`${URL}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /id="labBtn"/);
  } finally {
    child.kill();
  }
});
