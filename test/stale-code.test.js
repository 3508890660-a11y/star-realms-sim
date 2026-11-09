// 「服务端在跑旧代码」检测的回归测试。
// 真实事故：modes.js 改完后，4397 上的旧进程仍按 (座位+1)%6 判对位，
// 界面上 5 号提督开局就能打 0 号大将，看起来像修复没生效。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createCodeStamp } from '../src/server/code-stamp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('代码戳：文件比进程新才算过期，且能区分先后', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-stamp-'));
  const file = path.join(dir, 'engine.js');
  fs.writeFileSync(file, '// v1\n', 'utf8');
  const bootedAt = Date.now();
  const before = new Date(bootedAt - 60_000);
  fs.utimesSync(file, before, before); // 明确落在启动之前，避开同毫秒写入
  const stale = createCodeStamp({ root: dir, files: ['engine.js'], bootedAt, cacheMs: 0 });

  assert.equal(stale(), null, '刚启动时不应报过期');

  // 把 mtime 推到启动之后
  const future = new Date(bootedAt + 60_000);
  fs.utimesSync(file, future, future);
  const reported = stale();
  assert.ok(reported, '文件更新后应报告过期');
  assert.equal(reported.changed.length, 1);
  assert.equal(reported.changed[0].file, 'engine.js');
  assert.equal(reported.bootedAt, new Date(bootedAt).toISOString());

  // 再改回启动之前
  const past = new Date(bootedAt - 60_000);
  fs.utimesSync(file, past, past);
  assert.equal(stale(), null, 'mtime 回到启动前则不再报过期');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('代码戳：缺文件不影响判定', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-stamp-'));
  const filePath = path.join(dir, 'a.js');
  fs.writeFileSync(filePath, '// a\n', 'utf8');
  const bootedAt = Date.now();
  const before = new Date(bootedAt - 60_000);
  fs.utimesSync(filePath, before, before);
  const stale = createCodeStamp({ root: dir, files: ['a.js', 'missing.js'], bootedAt, cacheMs: 0 });
  assert.equal(stale(), null, '缺文件不应被当成过期');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('服务端：/api/options 与对局快照都带上 codeStale 字段', async () => {
  const port = 4600 + Math.floor(Math.random() * 90);
  const child = spawn(process.execPath, ['src/server/server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    let options = null;
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/options`);
        options = await res.json();
        break;
      } catch {
        await sleep(120);
      }
    }
    assert.ok(options, '服务应能在超时前就绪');
    assert.ok('codeStale' in options, '/api/options 必须暴露 codeStale');
    assert.equal(options.codeStale, null, '刚启动的服务不应报旧代码');

    // 未创建对局时 /api/match 返回空壳，仍应带字段
    const snapRes = await fetch(`http://127.0.0.1:${port}/api/match?perspective=0`);
    const snapshot = await snapRes.json();
    assert.ok('codeStale' in snapshot, '/api/match 快照必须暴露 codeStale');
  } finally {
    child.kill();
  }
});
