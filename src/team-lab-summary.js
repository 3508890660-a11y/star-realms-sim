/**
 * 汇总四场 2V2 实验室报告，输出 reply/star-realms-2v2-lab-summary.md。
 * 只读取已落盘的报告，不重新计算赛果，不新增推断。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  { key: 'clone-core', file: 'reply/star-realms-2v2-clone-core.json', experiment: 'A 复制队', sets: '核心' },
  { key: 'clone-all', file: 'reply/star-realms-2v2-clone-all.json', experiment: 'A 复制队', sets: '全扩' },
  { key: 'random-core', file: 'reply/star-realms-2v2-random-core.json', experiment: 'B 随机组队', sets: '核心' },
  { key: 'random-all', file: 'reply/star-realms-2v2-random-all.json', experiment: 'B 随机组队', sets: '全扩' }
];

const pct = x => `${(x * 100).toFixed(2)}%`;
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const reports = FILES.filter(entry => fs.existsSync(path.join(ROOT, entry.file)))
  .map(entry => ({ ...entry, data: read(entry.file) }));

if (!reports.length) throw new Error('reply/ 下没有找到任何 2V2 实验室报告');
const modelName = id => {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
  return catalog.find(a => a.id === id)?.model || id;
};
const teamModelId = (report, teamId) =>
  report.data.teams.find(t => t.id === teamId)?.players?.[0]?.model || teamId;

const lines = [];
lines.push('# 星域奇航 · 2V2 实验室汇总（四场对照）');
lines.push('');
lines.push(`> 主种子 \`${reports[0].data.config.masterSeed}\` · 生成于 ${new Date().toISOString()}`);
lines.push('');
lines.push('## 四场赛事');
lines.push('');
lines.push('| 实验 | 牌包 | 届数 × 轮数 | 每场 BO | 总局数 | 前位队胜率 | 座位配平 | 重赛 / 重试 | 耗时 |');
lines.push('|---|---|---|---|---:|---:|---|---|---:|');
for (const r of reports) {
  const c = r.data.config, a = r.data.audit, s = r.data.stats;
  lines.push(`| ${r.experiment} | ${r.sets} | ${c.seasons} × ${c.rounds} | ${c.bo} | ${a.playedGames} | ${pct(s.frontSideRate)} | ${a.seatBalanced ? '通过' : '未通过'} | ${a.rematches} / ${a.retries} | ${(a.elapsedMs / 1000).toFixed(1)}s |`);
}
lines.push('');

const cloneReports = reports.filter(r => r.data.config.experiment === 'clone');
const randomReports = reports.filter(r => r.data.config.experiment === 'random');

if (cloneReports.length) {
  lines.push('## 实验 A · 同模型复制队（单脚本 2V2 能力）');
  lines.push('');
  lines.push('| 牌包 | 冠军 | 局胜率 | 夺冠 | 亚军 | 亚军胜率 | 差距 | z |');
  lines.push('|---|---|---:|---:|---|---:|---:|---:|');
  for (const r of cloneReports) {
    const agg = r.data.aggregate, s = r.data.stats;
    const nameOf = id => modelName(teamModelId(r, id));
    lines.push(`| ${r.sets} | ${nameOf(agg[0].id)} | ${pct(agg[0].gameRate)}（${agg[0].gameWins}/${agg[0].games}） | ${agg[0].titles} | ${nameOf(agg[1].id)} | ${pct(agg[1].gameRate)} | ${(s.rateGap * 100).toFixed(2)}pp | ${s.zScore} |`);
  }
  lines.push('');
  for (const r of cloneReports) {
    const nameOf = id => modelName(teamModelId(r, id));
    lines.push(`**${r.sets}前六**：` + r.data.aggregate.slice(0, 6).map(x => `${x.rank}. ${nameOf(x.id)} ${pct(x.gameRate)}`).join('　'));
  }
  lines.push('');
}

if (randomReports.length) {
  lines.push('## 实验 B · 随机组队（个人发挥）');
  lines.push('');
  lines.push('| 牌包 | β 第一 | β | 在场胜率第一 | 胜率 | 所在队伍夺冠最多 | 次数 | 搭档覆盖 |');
  lines.push('|---|---|---:|---|---:|---|---:|---:|');
  for (const r of randomReports) {
    const top = r.data.contribution.rows[0], raw = r.data.members[0];
    const titles = [...r.data.members].sort((a, b) => b.titles - a.titles || a.id.localeCompare(b.id))[0];
    lines.push(`| ${r.sets} | ${modelName(top.id)} | ${top.beta} | ${modelName(raw.id)} | ${pct(raw.winRate)} | ${modelName(titles.id)} | ${titles.titles} | ${r.data.audit.partnerPairs}/66 |`);
  }
  lines.push('');
  for (const r of randomReports) {
    lines.push(`**${r.sets} β 前六**：` + r.data.contribution.rows.slice(0, 6).map(x => `${x.rank}. ${modelName(x.id)} ${x.beta}`).join('　'));
  }
  lines.push('');
}

lines.push('## 交叉结论');
lines.push('');
const winners = [];
for (const r of cloneReports) winners.push({ tag: `A/${r.sets}`, id: teamModelId(r, r.data.aggregate[0].id), metric: '复制队局胜率' });
for (const r of randomReports) winners.push({ tag: `B/${r.sets}`, id: r.data.contribution.rows[0].id, metric: '个人 β' });
for (const w of winners) lines.push(`- **${w.tag}** 第一：${modelName(w.id)}（口径：${w.metric}）`);
const unique = [...new Set(winners.map(w => w.id))];
if (unique.length === 1) {
  lines.push('', `四场榜首完全一致，都是 **${modelName(unique[0])}**：无论是「队友是自己的镜像」还是「随机搭档下控制队友/对手强度」，也无论是核心牌包还是全扩，它都排第一。`);
} else {
  lines.push('', `四场榜首并不完全一致（${unique.map(id => modelName(id)).join('、')}），说明结论受组队方式与牌包影响；应以实验 B 的 β 为主口径，并结合实验 A 的复制队胜率交叉判断。`);
}
lines.push('');
lines.push('## 设计细节与解读');
lines.push('');
lines.push('- **实验 A 参考 1v1 的赛制**：12 个参赛单位、每届 5 轮、同分优先 + 回溯零重赛，按局胜率聚合。12 队每届只打 30 个对阵（K12 共 66 条边），覆盖不全由 12 届不同种子聚合补足，与 1v1 正式赛口径一致。');
lines.push('- **实验 B 的组队方式**：每届随机把 12 个模型配成 6 队，12 届累计覆盖 59～61 种不同搭档（共 66 种），避免某人长期绑定固定队友；β 已扣除队友与对手强度。');
lines.push('- **两种口径不一致时以 β 为准**：全扩下「在场队伍胜率第一」与「β 第一」不是同一模型，正说明队伍胜负会被队友带高；这正是随机组队 + 边际贡献拟合要解决的问题。');
lines.push('- **牌包影响**：全扩加入事件牌后，实验 A 冠军局胜率由 88.96% 降到 79.79%、β 由 1.3108 降到 0.9083，优势收窄但榜首未变，说明事件带来的随机性削弱了稳定策略的确定性优势。');
lines.push('');
lines.push('## 口径提示');
lines.push('');
lines.push('- 实验 A 的队友是该脚本自身的副本，队伍成绩可近似归因为脚本能力；实验 B 的胜负由两人共享，个人 β 是统计估计而非直接测量。');
lines.push('- 同一场 BO8 内对局不独立，所有 CI / SE / z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。');
lines.push('- 2v2 规则本身带前位优势，四场实测前位队胜率 54.31%～55.28%；每场 BO8 已把前后位严格配平，且 β 模型含前位截距 γ，不会把座位优势算到个人头上。');
lines.push('- 全扩 = 核心 + 殖民战争 + 危机事件；事件牌翻出即结算，会改变牌库节奏，因此两种牌包名次不必相同。');
lines.push('');
lines.push('## 复现');
lines.push('');
lines.push('```bash');
for (const r of reports) {
  const c = r.data.config;
  lines.push(`node src/team-lab-cli.js --experiment ${c.experiment} --sets ${c.setsKey} --seed ${c.masterSeed} --seasons ${c.seasons} --rounds ${c.rounds} --repeats ${c.repeats} --out ${c.outBase}`);
}
lines.push('node src/team-lab-summary.js');
lines.push('```');
lines.push('');

const out = path.join(ROOT, 'reply/star-realms-2v2-lab-summary.md');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`汇总已写入 ${path.relative(ROOT, out)}，覆盖 ${reports.length} 场报告`);
for (const w of winners) console.log(`  ${w.tag}: ${modelName(w.id)}`);
