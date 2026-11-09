/**
 * 6 人模式（三头龙 / 大将战）四场正式赛的横向汇总。
 * 只读取 reply/ 下已落盘报告，不重跑对局。
 *
 * 用法：node src/mode-summary.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = [
  { key: 'hydra3-core', file: 'reply/star-realms-hydra3-core.json' },
  { key: 'hydra3-all', file: 'reply/star-realms-hydra3-all.json' },
  { key: 'emperor-core', file: 'reply/star-realms-emperor-core.json' },
  { key: 'emperor-all', file: 'reply/star-realms-emperor-all.json' }
];

const pct = x => `${(x * 100).toFixed(2)}%`;
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
const nameOf = id => catalog.find(agent => agent.id === id)?.model || id;

const loaded = RUNS.map(run => {
  const file = path.join(ROOT, run.file);
  if (!fs.existsSync(file)) throw new Error(`缺少报告：${run.file}`);
  return { ...run, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
});

const lines = [];
lines.push('# 星域奇航 · 3V3 模式赛汇总（三头龙 / 大将战）');
lines.push('');
const seed = loaded[0].data.config.masterSeed;
const totalGames = loaded.reduce((sum, run) => sum + run.data.audit.playedGames, 0);
lines.push(`> 四场正式赛 · 主种子 \`${seed}\` · 合计 ${totalGames} 局 · 12 届 × 完整单循环（3 轮 × 2 场）× BO6`);
lines.push('');
lines.push('> 规则修正（2026-11-08）：① 大将战提督对位改为「两队提督按队内座位序配对」，旧实现用「座位 +1」会让一名提督越过对位直击敌方大将；② 团队模式（Hydra / Emperor）改为官方「整队轮流」——同队队友连续行动，弃手、补牌与基地伤害在队伍回合结束时结算。');
lines.push('> 脚本版本：2026-11-09 使用 2026-11-08 按程序更新修订的 12 份脚本（隔离轮）、同一主种子重跑。本文件只读取 `reply/` 当前落盘报告，重跑即更新；修订前基线见 `reply/baseline-before-refresh/`。');
lines.push('');

const tops = loaded.map(run => {
  const top = run.data.contribution.rows[0];
  const memberOf = new Map(run.data.members.map(row => [row.id, row]));
  return {
    key: run.key,
    mode: run.data.config.mode,
    sets: run.data.config.setsKey,
    champion: top.id,
    beta: top.beta,
    betaRate: memberOf.get(top.id)?.winRate ?? 0,
    betaGames: memberOf.get(top.id)?.games ?? 0,
    rateTop: run.data.members[0].id,
    rate: run.data.members[0].winRate,
    titles: [...run.data.members].sort((a, b) => b.titles - a.titles)[0].id,
    games: run.data.audit.playedGames,
    frontRate: run.data.stats.frontSideRate
  };
});
const unique = [...new Set(tops.map(t => t.champion))];

lines.push('## 结论');
lines.push('');
if (unique.length === 1) {
  lines.push(`**四场个人边际贡献第一完全一致：${nameOf(unique[0])}**（β 口径：控制队友与对手强度后的边际贡献）。`);
} else {
  lines.push(`四场第一不完全一致：${tops.map(t => `${t.key} → ${nameOf(t.champion)}`).join('；')}。`);
}
lines.push('');
lines.push(`三头龙：核心 β ${tops[0].beta}（该模型在场胜率 ${pct(tops[0].betaRate)}）→ 全扩 β ${tops[1].beta}（${pct(tops[1].betaRate)}）。`);
lines.push(`大将战：核心 β ${tops[2].beta}（${pct(tops[2].betaRate)}）→ 全扩 β ${tops[3].beta}（${pct(tops[3].betaRate)}）。`);
const zTop = loaded.flatMap(run => run.data.contribution.rows.map(row => Math.abs(row.z ?? 0)));
const maxZ = Math.max(...zTop).toFixed(3);
lines.push('');
lines.push(`> 显著性提示：单场只有 ${loaded[0].data.audit.playedGames} 局，四场全部 β 的最大 |z| 为 ${maxZ}，` +
  `${Number(maxZ) >= 1.96 ? '至少有一个名次差异达到 95% 显著。' : '均未达到 95% 显著——榜首与其后的差距仍在抽样波动范围内，不能据此断言强弱排序。'}`);
lines.push('');

lines.push('## 四场总览');
lines.push('');
lines.push('| 赛事 | 模式 | 牌包 | 局数 | 个人 β 第一 | β | 在场胜率第一 | 队伍夺冠最多 | 前位胜率 |');
lines.push('|---|---|---|---:|---|---:|---|---|---:|');
for (const row of tops) {
  lines.push(`| \`${row.key}\` | ${row.mode === 'emperor' ? '大将战' : '三头龙'} | ${row.sets === 'all' ? '全扩' : '核心'} | ${row.games} | ${nameOf(row.champion)} | ${row.beta} | ${nameOf(row.rateTop)} ${pct(row.rate)} | ${nameOf(row.titles)} | ${pct(row.frontRate)} |`);
}
lines.push('');

lines.push('## 各场前三（β）');
lines.push('');
for (const run of loaded) {
  lines.push(`### ${run.key}（${run.data.config.mode === 'emperor' ? '大将战' : '三头龙'} · ${run.data.config.setsKey === 'all' ? '全扩' : '核心'}）`);
  lines.push('');
  lines.push('| 名次 | 模型 | β | e^β | 近似 z | 在场胜率 | 参与局 | 队伍夺冠 |');
  lines.push('|---:|---|---:|---:|---:|---:|---:|---:|');
  const memberOf = new Map(run.data.members.map(row => [row.id, row]));
  for (const row of run.data.contribution.rows.slice(0, 3)) {
    const member = memberOf.get(row.id) || {};
    lines.push(`| ${row.rank} | ${nameOf(row.id)} | ${row.beta} | ${row.odds} | ${row.z ?? '—'} | ${pct(member.winRate ?? 0)} | ${member.games ?? '—'} | ${member.titles ?? '—'} |`);
  }
  lines.push('');
}

lines.push('## 口径与局限');
lines.push('');
lines.push('- 每届随机分成 4 队、每队 3 人；跨届队伍不同，个人 β 依赖「随机组队让队友/对手强度在期望上抵消」。');
lines.push('- 每场 BO6：前位 3 局 / 后位 3 局，队内座位逐局轮换，每名队员在 6 个座位各坐 1 次；大将战另让每人各当 2 次大将。');
lines.push('- 同一场 BO6 内对局不独立，SE / z 仅为近似参考；结论只适用于本赛制、本牌包与这组种子。');
lines.push('- 全扩 = 核心 + 殖民战争 + 危机事件 + Frontiers + 危机：舰队与要塞 + 危机：基地与战列舰。');
lines.push('');

const out = path.join(ROOT, 'reply/star-realms-3v3-summary.md');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`已生成 ${path.relative(ROOT, out)}`);
console.log(lines.slice(0, 12).join('\n'));
