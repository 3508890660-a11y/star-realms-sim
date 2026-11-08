import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadScript } from '../src/ai/loader.js';
import { MatchRunner } from '../src/engine/runner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8'));

const MODES = [
  { mode: 'standard', count: 2 },
  { mode: 'ffa', count: 3 },
  { mode: 'hunter', count: 3 },
  { mode: 'firstBlood', count: 3 },
  { mode: 'team2v2', count: 4 },
  { mode: 'hydra3', count: 6 },
  { mode: 'emperor', count: 6 }
];

// 七个牌包组合轮转，保证 core / colonyWars / events / frontiers / crisisFleets / crisisBases 全部被跑到。
const PACKS = [
  ['core'],
  ['colonyWars'],
  ['core', 'events'],
  ['frontiers', 'events'],
  ['crisisFleets'],
  ['crisisBases', 'events'],
  ['core', 'colonyWars', 'events', 'frontiers', 'crisisFleets', 'crisisBases']
];

const BUILTINS = ['tactical', 'economic', 'random'];

test('按程序更新重启：12 份脚本的元数据与更新说明齐备', async () => {
  assert.equal(CATALOG.strategyMode, 'program-update');
  assert.equal(CATALOG.round, 'program-update-2026-11-08');
  for (const agent of CATALOG.agents) {
    const script = `script:${path.basename(agent.file)}`;
    const module = await loadScript(script);
    assert.ok(module.meta.name.toLowerCase().includes(agent.model.toLowerCase()), `${agent.id} meta.name 缺少显示名`);
    assert.ok(module.meta.description.includes(agent.modelId), `${agent.id} meta.description 缺少模型 ID`);
    const source = fs.readFileSync(path.join(ROOT, agent.file), 'utf8');
    assert.ok(source.split(/\r?\n/).slice(0, 8).some(line => line.includes('本轮更新')), `${agent.id} 缺少本轮更新注释`);
    assert.ok(!/(^|\n)\s*(import\s+[^;\n]*\sfrom\s|import\s*\(|require\s*\()/.test(source), `${agent.id} 违反零依赖`);
    const note = fs.readFileSync(path.join(ROOT, 'subagent-progress', `${agent.id}.md`), 'utf8');
    assert.ok(note.includes('附录 · 2026-11-08 按程序更新修订'), `${agent.id} 设计说明未附更新记录`);
  }
});

test('按程序更新重启：12 份脚本 × 7 模式 × 7 牌包组合均可完成对局', async () => {
  for (const [agentIndex, agent] of CATALOG.agents.entries()) {
    const script = `script:${path.basename(agent.file)}`;
    for (const [modeIndex, { mode, count }] of MODES.entries()) {
      const sets = PACKS[(agentIndex + modeIndex) % PACKS.length];
      const players = Array.from({ length: count }, (_, seat) => ({
        name: `${agent.id}-${mode}-P${seat}`,
        script: seat === 0 ? script : BUILTINS[seat % BUILTINS.length]
      }));
      const runner = await MatchRunner.create({
        mode,
        seed: `refresh-${agent.id}-${mode}-${sets.join('+')}`,
        expansions: { sets },
        players
      });
      const result = await runner.runToEnd(40000);
      assert.equal(runner.game.state.status, 'finished', `${agent.id} 在 ${mode} + ${sets.join('+')} 未能完成对局`);
      assert.ok(Number.isInteger(result.winner), `${agent.id} 在 ${mode} 没有产生胜者`);
      assert.deepEqual(result.sets.slice().sort(), sets.slice().sort(), `${agent.id} 牌包组合未按配置生效`);
    }
  }
});
