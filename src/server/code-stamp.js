// 服务端「代码是否比进程新」的检测。
// 起因：改动 modes.js 之后，4397 上仍在跑的旧进程按旧规则判对位，
// 界面上看起来就像 bug 没修好。这里在启动时记下时间戳，之后每次查询
// 对比文件 mtime，让界面能直接提示「先重启服务」。
import fs from 'node:fs';
import path from 'node:path';

export function createCodeStamp({ root, files, bootedAt = Date.now(), cacheMs = 2000 }) {
  let cache = null;
  return function stale(now = Date.now()) {
    if (cache && now - cache.at < cacheMs) return cache.value;
    const changed = [];
    for (const file of files) {
      let stat;
      try {
        stat = fs.statSync(path.join(root, file));
      } catch {
        continue; // 文件被删或改名，不影响判定
      }
      if (stat.mtimeMs > bootedAt) changed.push({ file, mtime: new Date(stat.mtimeMs).toISOString() });
    }
    const value = changed.length
      ? { bootedAt: new Date(bootedAt).toISOString(), changed }
      : null;
    cache = { at: now, value };
    return value;
  };
}
