import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const readBytes = file => fs.readFileSync(path.join(ROOT, file));

// 回归护栏：服务曾依赖会话后台任务，会话中断后 4397 无监听，界面「新建对局」自然失效。
test('start-server.bat：存在、纯 ASCII、全 CRLF、含启动与端口检测', () => {
  const bytes = readBytes('start-server.bat');
  assert.ok(bytes.length > 200);
  assert.equal(bytes.filter(byte => byte > 127).length, 0, 'bat 不能含非 ASCII 字符（编码会损坏中文路径）');
  const crlf = (bytes.toString('latin1').match(/\r\n/g) || []).length;
  const lf = (bytes.toString('latin1').match(/\n/g) || []).length;
  assert.equal(crlf, lf, 'bat 必须全部为 CRLF');
  const text = bytes.toString('ascii');
  assert.match(text, /%USERPROFILE%/, '用环境变量定位 node，避免硬编码含中文的路径');
  assert.match(text, /src\\server\\server\.js/);
  assert.match(text, /findstr ":4397"/, '需检测端口，避免重复启动报 EADDRINUSE');
  assert.match(text, /start "" http:\/\/127\.0\.0\.1:4397/);
});

test('服务离线提示：页面有横幅、前端有 setOffline 与自动重连', () => {
  const html = read('public/index.html');
  assert.match(html, /id="offlineBanner"/);
  assert.match(html, /id="offlineMessage"/);
  assert.match(html, /start-server\.bat/);
  const css = read('public/styles.css');
  assert.match(css, /\.offline-banner\{/);
  assert.match(css, /\.hidden\{display:none!important\}/);
  const app = read('public/app.js');
  assert.match(app, /function setOffline\(/);
  assert.match(app, /setOffline\(false\)/, '读取成功时必须隐藏横幅');
  assert.match(app, /setOffline\(true/, '读取失败时必须显示横幅');
  assert.match(app, /setInterval\(\(\) => \{[\s\S]{0,200}offlineBanner/, '离线时需要自动重试');
});
