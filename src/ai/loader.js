import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import * as random from './random.js';
import * as tactical from './tactical.js';
import * as economic from './economic.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const builtins = new Map([['random', random], ['tactical', tactical], ['economic', economic]]);

export async function listScripts() {
  const result = [...builtins.values()].map(module => ({ ...module.meta, builtin: true }));
  if (!fs.existsSync(SCRIPTS_DIR)) return result;
  for (const file of fs.readdirSync(SCRIPTS_DIR).filter(file => /\.m?js$/.test(file)).sort()) {
    try {
      const module = await import(`${pathToFileURL(path.join(SCRIPTS_DIR, file)).href}?v=${fs.statSync(path.join(SCRIPTS_DIR, file)).mtimeMs}`);
      result.push({ id: `script:${file}`, name: module.meta?.name || file, description: module.meta?.description || '用户脚本', builtin: false });
    } catch (error) {
      result.push({ id: `script:${file}`, name: `${file}（加载失败）`, description: error.message, builtin: false, error: true });
    }
  }
  return result;
}

export async function loadScript(id) {
  if (id === 'human') return null;
  if (builtins.has(id)) return builtins.get(id);
  if (!id?.startsWith('script:') || !/^script:[a-zA-Z0-9_.-]+\.m?js$/.test(id)) throw new Error(`非法脚本标识: ${id}`);
  const file = path.join(SCRIPTS_DIR, id.slice(7));
  if (!fs.existsSync(file)) throw new Error(`脚本不存在: ${id}`);
  const module = await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);
  if (typeof module.chooseAction !== 'function') throw new Error(`${id} 必须导出 chooseAction()`);
  return { ...module, meta: { id, name: module.meta?.name || id, description: module.meta?.description || '用户脚本' } };
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
