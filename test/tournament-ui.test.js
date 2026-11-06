import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

// 回归护栏：曾经 HTML 的牌包容器只有 class="tourney-sets"，而前端用 #tourneySets 取值，
// 导致永远拿到 0 个勾选项，点击「启动新赛」直接提示「至少勾选一个牌包」且请求发不出去。
test('瑞士轮启动配置：牌包容器必须能被前端选择器找到', () => {
  const html = read('public/index.html');
  assert.match(html, /id="tourneySets"/, '牌包容器缺少 tourneySets id');
  const start = html.indexOf('id="tourneySets"');
  const box = html.slice(start, start + 700);
  for (const set of ['core', 'colonyWars', 'events']) {
    assert.ok(box.includes(`value="${set}"`), `牌包容器缺少 ${set} 勾选框`);
  }
  const app = read('public/app.js');
  assert.match(app, /function tourneySetInputs\(\)/, '前端缺少统一的牌包读取函数');
  assert.match(app, /querySelector\('#tourneySets'\)/);
  assert.match(app, /\.tourney-sets/, '前端需要 class 兜底，避免 id 再次丢失时彻底失效');
  const startFn = app.slice(app.indexOf('async function startTournament'));
  assert.match(startFn.slice(0, 500), /tourneySetInputs\(\)/, '启动函数必须使用牌包读取函数');
});

test('瑞士轮启动配置：服务端届数上限不小于界面可选值', () => {
  const html = read('public/index.html');
  assert.match(html, /<option>12<\/option>/, '界面应提供 12 届选项');
  const server = read('src/server/server.js');
  const match = server.match(/clampInt\(input\.seasons,\s*1,\s*(\d+)/);
  assert.ok(match, '服务端届数上限需可定位');
  assert.ok(Number(match[1]) >= 12, `服务端上限 ${match[1]} 小于界面可选的 12，会被静默截断`);
  assert.match(server, /activeTournament/, '服务端需保有运行中子进程的引用以防重复启动');
  assert.match(server, /status: 'running', config/, '服务端受理后应立即写入 running 进度');
});
