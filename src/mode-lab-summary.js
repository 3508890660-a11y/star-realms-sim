/**
 * 3V3 同模型复制队四场（三头龙 / 大将战 × 核心 / 全扩）的横向汇总。
 * 只读取 reply/ 下已落盘报告，不重跑对局。
 *
 * 用法：node src/mode-lab-summary.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = [
  { key: 'hydra3-core', mode: 'hydra3', sets: 'core', file: 'reply/star-realms-3v3-clone-hydra3-core.json' },
  { key: 'hydra3-all', mode: 'hydra3', sets: 'all', file: 'reply/star-realms-3v3-clone-hydra3-all.json' },
  { key: 'emperor-core', mode: 'emperor', sets: 'core', file: 'reply/star-realms-3v3-clone-emperor-core.json' },
  { key: 'emperor-all', mode: 'emperor', sets: 'all', file: 'reply/star-realms-3v3-clone-emperor-all.json' }
];

const pct = x => `${(x * 100).toFixed(2)}%`;
const modeName = mode => (mode === 'emperor' ? '大将战' : '三头龙');
const setsName = sets => (sets === 'all' ? '全扩（6 包）' : '核心');

const loaded = RUNS.map(run => {
  const file = path.join(ROOT, run.file);
  if (!fs.existsSync(file)) throw new Error(`缺少报告：${run.file}`);
  return { ...run, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
});

const lines = [];
lines.push('# 星域奇航 · 3V3 同模型复制队汇总（三头龙 / 大将战）');
lines.push('');
const seed = loaded[0].data.config.masterSeed;
const totalGames = loaded.reduce((sum, run) => sum + run.data.audit.playedGames, 0);
lines.push(`> 四场 · 主种子 \`${seed}\` · 合计 ${totalGames} 局 · 每场 12 届 × 5 轮瑞士轮 × 6 场 × BO6`);
lines.push('');
lines.push('> 口径：与 2V2「实验 A 同模型复制队」一致——12 支队伍，每队由**同一份脚本的三个副本**组成，队友是自己的镜像，因此队伍成绩可近似归因为该脚本的 3V3 能力。逐局座位在 6 个座位轮换，大将战每人每场当 2 次大将。');
lines.push('> 脚本版本：2026-11-08 按程序更新修订的 12 份脚本（隔离轮，无结果泄漏）。本文件只读取 `reply/` 当前落盘报告，重跑即更新。');
lines.push('');

const rows = loaded.map(run => {
  const data = run.data;
  const top = data.aggregate?.[0];
  const second = data.aggregate?.[1];
  const team = data.teams.find(t => t.id === top?.id);
  return {
    key: run.key, mode: run.mode, sets: run.sets,
    champion: team?.vendor || top?.id || '—',
    modelId: team?.players?.[0]?.model || null,
    rate: top?.gameRate ?? 0,
    wins: top?.gameWins ?? 0,
    games: top?.games ?? 0,
    titles: top?.titles ?? 0,
    ci: data.stats?.championCI95 || [0, 0],
    second: second ? (data.teams.find(t => t.id === second.id)?.vendor || second.id) : '—',
    secondRate: second?.gameRate ?? 0,
    gap: data.stats?.rateGap ?? 0,
    z: data.stats?.zScore ?? 0,
    significant: !!data.stats?.significant95,
    frontRate: data.stats?.frontSideRate ?? 0,
    played: data.audit?.playedGames ?? 0,
    rematches: data.audit?.rematches ?? 0,
    retries: data.audit?.retries ?? 0,
    fallbacks: data.audit?.infeasibleRounds ?? 0,
    seatBalanced: !!data.audit?.seatBalanced,
    emperorSeatBalanced: data.audit?.emperorSeatBalanced
  };
});

const sameChampion = new Set(rows.map(r => r.champion)).size === 1;
lines.push('## 结论');
lines.push('');
if (sameChampion) {
  lines.push(`**四场复制队冠军完全一致：${rows[0].champion}**（局胜率口径，队友是该脚本自身的三个副本）。`);
} else {
  lines.push(`四场复制队冠军不完全一致：${rows.map(r => `${r.key} → ${r.champion}`).join('；')}。`);
}
lines.push('');
for (const mode of ['hydra3', 'emperor']) {
  const pair = rows.filter(r => r.mode === mode);
  const a = pair.find(r => r.sets === 'core');
  const b = pair.find(r => r.sets === 'all');
  if (a && b) {
    lines.push(`${modeName(mode)}：核心 ${a.champion} ${pct(a.rate)} → 全扩 ${b.champion} ${pct(b.rate)}` +
      `${a.champion === b.champion ? '（榜首未变）' : '（榜首易主）'}；前位胜率 ${pct(a.frontRate)} / ${pct(b.frontRate)}。`);
  }
}
const maxZ = Math.max(...rows.map(r => Math.abs(r.z)));
lines.push('');
lines.push(`> 显著性提示：每场 ${rows[0].played} 局，四场冠亚差的最大 |z| = ${maxZ.toFixed(3)}，` +
  `${maxZ >= 1.96 ? '至少一场达到 95% 显著。' : '均未达到 95% 显著——冠亚差距仍在抽样波动范围内，不能据此断言强弱排序。'}`);
lines.push('');

lines.push('## 四场总览');
lines.push('');
lines.push('| 赛事 | 模式 | 牌包 | 局数 | 复制队冠军 | 局胜率 | Wilson 95% CI | 亚军 | 冠亚差 | 近似 z | 夺冠 | 前位胜率 |');
lines.push('|---|---|---|---:|---|---:|---|---|---:|---:|---:|---:|');
for (const r of rows) {
  lines.push(`| \`${r.key}\` | ${modeName(r.mode)} | ${setsName(r.sets)} | ${r.played} | ${r.champion} | ${pct(r.rate)} | [${pct(r.ci[0])}, ${pct(r.ci[1])}] | ${r.second} ${pct(r.secondRate)} | ${(r.gap * 100).toFixed(2)}pp | ${r.z}${r.significant ? ' *' : ''} | ${r.titles}/12 | ${pct(r.frontRate)} |`);
}
lines.push('');
lines.push('> `*` 表示两比例近似 z ≥ 1.96。CI 与 z 均按独立局近似，同一场 BO6 内对局并不独立。');
lines.push('');

lines.push('## 各场前三（复制队局胜率）');
lines.push('');
for (const run of loaded) {
  lines.push(`### ${run.key}（${modeName(run.mode)} · ${setsName(run.sets)}）`);
  lines.push('');
  lines.push('| 名次 | 模型 | 局胜率 | 局胜/总局 | 夺冠 | 平均名次 | 累计 MP |');
  lines.push('|---:|---|---:|---:|---:|---:|---:|');
  for (const row of run.data.aggregate.slice(0, 3)) {
    const team = run.data.teams.find(t => t.id === row.id);
    lines.push(`| ${row.rank} | ${team?.vendor || row.id} | ${pct(row.gameRate)} | ${row.gameWins}/${row.games} | ${row.titles} | ${row.avgRank} | ${row.mp} |`);
  }
  lines.push('');
}

lines.push('## 账目校验');
lines.push('');
lines.push('| 赛事 | 计划/实际局数 | 重赛 | 重试 | 配对回退 | 六座配平 | 大将按副本配平 |');
lines.push('|---|---:|---:|---:|---:|---|---|');
for (const r of rows) {
  const run = loaded.find(x => x.key === r.key).data;
  lines.push(`| \`${r.key}\` | ${run.audit.totalGames}/${run.audit.playedGames} | ${r.rematches} | ${r.retries} | ${r.fallbacks} | ${r.seatBalanced ? '通过' : '未通过'} | ${r.emperorSeatBalanced === undefined ? '—' : (r.emperorSeatBalanced ? '通过' : '未通过')} |`);
}
lines.push('');

lines.push('## 口径与局限');
lines.push('');
lines.push('- 复制队里三个副本使用同一份脚本，各自拥有独立的 `memory` 与随机流；它测的是**该脚本在自协同配置下的强度**，不等于随机组队时的个人发挥。');
lines.push('- 赛制参考 1v1 瑞士轮 / 2V2 实验 A：12 个参赛单位、每届 5 轮 × 6 场、场分胜 1 / 平 0.5 / 负 0，同分优先 + 回溯零重赛；聚合榜按局胜率排序。');
lines.push('- β 表只作辅助：同一模型在一局占 3 个座位，线性预测器里 β 被计入 3 次，数值不可与随机组队 3V3 的 β 直接比较。');
lines.push('- 同一场 BO6 内对局不独立，CI / z 仅作近似参考；结论只适用于本赛制、本牌包与这组种子。');
lines.push('- 全扩 = 核心 + 殖民战争 + 危机事件 + Frontiers + 危机：舰队与要塞 + 危机：基地与战列舰。');
lines.push('');

const out = path.join(ROOT, 'reply/star-realms-3v3-clone-summary.md');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`已生成 ${path.relative(ROOT, out)}`);
console.log(lines.slice(0, 14).join('\n'));
