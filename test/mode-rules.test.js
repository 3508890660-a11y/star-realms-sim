import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('规则探针：攻击目标、提督对位、前哨保护、整队轮流与队末补牌', () => {
  const probe = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'probe-attack-targets.mjs')], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000
  });
  assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}`);
  assert.match(probe.stdout, /构造局面检查全部通过/);
});
