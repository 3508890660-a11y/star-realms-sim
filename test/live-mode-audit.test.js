// 实况对局回归：每次用「当前时间」做种子新建对局，因此每次跑的都是新局，
// 不是回放既有报告。两个脚本各自独立重算规则，不调用被测函数。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT, encoding: 'utf8', timeout: 180000
  });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

test('引擎层实况对局：行动顺序与攻击目标逐次核对通过', () => {
  const { status, stdout } = run('tools/live-match-trace.mjs');
  assert.equal(status, 0, stdout);
  assert.match(stdout, /总判定：5 局全部通过/);
  assert.match(stdout, /提督越位 0 次/);
  assert.match(stdout, /合法集不符 0 次/);
  // 至少要有一局真的出现「对位阵亡后放行打大将」，否则只验证了禁令没验证放行
  const unlocks = [...stdout.matchAll(/对位阵亡后规则放行打大将：(\d+) 次/g)].map(m => Number(m[1]));
  assert.ok(unlocks.length >= 3, '应有三个大将战局面');
  assert.ok(unlocks.some(n => n > 0), '至少一局应出现对位阵亡后放行打大将');
});

test('Web 层实况对局：界面拿到的合法攻击目标与规则重算一致', () => {
  const { status, stdout } = run('tools/web-live-check.mjs');
  assert.equal(status, 0, stdout);
  assert.match(stdout, /总判定：通过/);
  assert.match(stdout, /合法集不符 0 次/);
  assert.match(stdout, /对位存活却可打大将 0 次/);
});
