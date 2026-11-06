import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listScripts, loadScript } from '../src/ai/loader.js';
import { MatchRunner } from '../src/engine/runner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8'));

test('12 个模型脚本全部可加载且 meta 与设计说明齐备', async () => {
  const scripts = await listScripts();
  assert.equal(CATALOG.agents.length, 12);
  for (const agent of CATALOG.agents) {
    const id = `script:${path.basename(agent.file)}`;
    const found = scripts.find(script => script.id === id);
    assert.ok(found && !found.error, `${agent.model} 脚本未通过加载：${found?.description || ''}`);
    const module = await loadScript(id);
    assert.equal(typeof module.chooseAction, 'function');
    assert.ok(module.meta.name.toLowerCase().includes(agent.model.toLowerCase()), `${agent.model} 的 meta.name 未标注模型`);
    assert.ok(fs.existsSync(path.join(ROOT, agent.file)), `${agent.file} 不存在`);
    assert.ok(fs.readFileSync(path.join(ROOT, 'subagent-progress', `${agent.id}.md`), 'utf8').length > 100);
  }
});

test('12 个模型脚本在多种模式与扩展组合中均可完成对局', async () => {
  const modes = ['standard', 'ffa', 'hunter', 'firstBlood', 'team2v2'];
  const combinations = [
    ['core'], ['colonyWars'], ['core', 'events'],
    ['colonyWars', 'events'], ['core', 'colonyWars', 'events']
  ];
  for (const [index, agent] of CATALOG.agents.entries()) {
    const mode = modes[index % modes.length];
    const count = mode === 'standard' ? 2 : mode === 'team2v2' ? 4 : 3;
    const script = `script:${path.basename(agent.file)}`;
    const players = Array.from({ length: count }, (_, i) => ({ name: `${agent.id}-P${i}`, script: i === 0 ? script : ['tactical', 'economic', 'random', 'tactical'][i] }));
    const runner = await MatchRunner.create({ mode, seed: `agent-${agent.id}`, expansions: { sets: combinations[index % combinations.length] }, players });
    const result = await runner.runToEnd(40000);
    assert.equal(runner.game.state.status, 'finished', `${agent.model} 在 ${mode} 未能完成对局`);
    assert.ok(Number.isInteger(result.winner));
  }
});
