/**
 * 用当前 markdownReport 重新生成既有报告的 .md（不重跑对局、不改 JSON 数据）。
 * 用途：修正报告模板里的规则说明（如「整队轮流」），保持历史数字不动。
 * 用法：node tools/regen-report-md.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownReport as modeMarkdown } from '../src/mode-tourney-cli.js';
import { markdownReport as labMarkdown } from '../src/team-lab-cli.js';
import { markdownReport as cloneMarkdown } from '../src/mode-lab-cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODE_REPORTS = [
  'reply/star-realms-hydra3-core.json',
  'reply/star-realms-hydra3-all.json',
  'reply/star-realms-emperor-core.json',
  'reply/star-realms-emperor-all.json'
];
const LAB_REPORTS = [
  'reply/star-realms-2v2-clone-core.json',
  'reply/star-realms-2v2-clone-all.json',
  'reply/star-realms-2v2-random-core.json',
  'reply/star-realms-2v2-random-all.json'
];
const CLONE_REPORTS = [
  'reply/star-realms-3v3-clone-hydra3-core.json',
  'reply/star-realms-3v3-clone-hydra3-all.json',
  'reply/star-realms-3v3-clone-emperor-core.json',
  'reply/star-realms-3v3-clone-emperor-all.json'
];

let count = 0;
for (const file of MODE_REPORTS) {
  const jsonPath = path.join(ROOT, file);
  if (!fs.existsSync(jsonPath)) continue;
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const mdPath = jsonPath.replace(/\.json$/i, '.md');
  fs.writeFileSync(mdPath, modeMarkdown(report), 'utf8');
  console.log(`regenerated ${path.relative(ROOT, mdPath)}`);
  count++;
}
for (const file of LAB_REPORTS) {
  const jsonPath = path.join(ROOT, file);
  if (!fs.existsSync(jsonPath)) continue;
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const mdPath = jsonPath.replace(/\.json$/i, '.md');
  fs.writeFileSync(mdPath, labMarkdown(report), 'utf8');
  console.log(`regenerated ${path.relative(ROOT, mdPath)}`);
  count++;
}
for (const file of CLONE_REPORTS) {
  const jsonPath = path.join(ROOT, file);
  if (!fs.existsSync(jsonPath)) continue;
  const report = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const mdPath = jsonPath.replace(/\.json$/i, '.md');
  fs.writeFileSync(mdPath, cloneMarkdown(report), 'utf8');
  console.log(`regenerated ${path.relative(ROOT, mdPath)}`);
  count++;
}
console.log(`done: ${count} 份`);
