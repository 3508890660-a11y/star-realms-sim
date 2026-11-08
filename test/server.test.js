import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4498;
const URL = `http://127.0.0.1:${PORT}`;

async function ready(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('服务启动超时')), 5000);
    child.stdout.on('data', data => {
      if (String(data).includes('http://127.0.0.1')) { clearTimeout(timer); resolve(); }
    });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`服务提前退出 ${code}`)); });
  });
}

async function json(pathname, options) {
  const response = await fetch(URL + pathname, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  assert.ok(response.ok, JSON.stringify(data));
  return data;
}

test('Web 服务支持独立脚本、人类视角、单步与回放导出', async () => {
  const child = spawn(process.execPath, ['src/server/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await ready(child);
    const health = await json('/api/health'); assert.equal(health.ok, true);
    const options = await json('/api/options');
    assert.equal(options.modes.length, 7); assert.equal(options.expansions.length, 6);
    const factory = await json('/api/subagents'); assert.equal(factory.agents.length, 12);
    assert.ok(factory.agents.some(agent => agent.designNote.length > 100));
    const tournament = await json('/api/tournament');
    assert.equal(typeof tournament.running, 'boolean');
    assert.ok('progress' in tournament && 'result' in tournament);
    assert.ok(tournament.result === null || tournament.result.aggregate.length === 12);
    await json('/api/match', { method: 'POST', body: JSON.stringify({ mode: 'standard', seed: 'server-test', autoRun: false, players: [{ name: '人类', script: 'human' }, { name: 'AI', script: 'tactical' }], expansions: { sets: ['core', 'events'] } }) });
    const view = await json('/api/match?perspective=0');
    assert.equal(view.waitingForHuman, true); assert.ok(view.legalActions.length > 0);
    assert.equal(view.state.players[1].hand.length, 0); assert.equal(view.state.players[1].handCount, 5);
    const play = view.legalActions.find(a => a.type === 'play');
    await json('/api/action', { method: 'POST', body: JSON.stringify({ playerId: 0, action: play }) });
    await json('/api/action', { method: 'POST', body: JSON.stringify({ playerId: 0, action: { type: 'endTurn' } }) });
    await json('/api/control', { method: 'POST', body: JSON.stringify({ command: 'step' }) });
    const spectator = await json('/api/match?perspective=spectator');
    assert.equal(spectator.history.length, 3); assert.equal(spectator.history[2].playerId, 1);
    const replay = await json('/api/replay'); assert.equal(replay.actions.length, 3); assert.equal(replay.config.seed, 'server-test');
    const page = await fetch(URL + '/'); assert.equal(page.status, 200); assert.match(await page.text(), /STAR REALMS/);
  } finally {
    child.kill();
  }
});
