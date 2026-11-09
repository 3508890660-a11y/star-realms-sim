// 生成实况对局报告：直接跑两个核对脚本，把真实输出嵌进 markdown，避免手抄数字。
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const run = script => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 300000 });
  return { status: result.status, out: (result.stdout || '') + (result.stderr || '') };
};

const live = run('tools/live-match-trace.mjs');
const web = run('tools/web-live-check.mjs');

const pick = (text, re) => [...text.matchAll(re)].map(m => m[1]);
const seeds = [...new Set(pick(live.out, /种子 (live-\d+)-/g))];

// 按「对局 X · 模式…」切块，每块取标题、结算、校验三行
const blocks = [];
{
  let current = null;
  for (const raw of live.out.split('\n')) {
    const line = raw.trim();
    const head = line.match(/^对局 (\S+) · (\S+)(?: · 大将座位 \[([^\]]+)\])?/);
    if (head) { current = { label: head[1], mode: head[2], emperors: head[3] || '' }; blocks.push(current); continue; }
    if (!current) continue;
    if (line.startsWith('结算：')) current.result = line.slice(3);
    if (line.startsWith('校验：')) current.verdict = line.slice(3);
  }
}

const md = [];
md.push('# 实况对局核对：行动顺序与攻击目标（2026-11-09）');
md.push('');
md.push('> 本文件由 `tools/live-match-report.mjs` 生成。两段输出都是**当场新建的对局**，种子取自运行时刻，');
md.push('> 与 `reply/` 里任何既有报告无关，也不是回放。');
md.push('');
md.push('## 一、为什么要再做一次');
md.push('');
md.push('上一轮结论是「引擎正确、文案有误导」，证据是构造局面 + 旧报告重放。但重放用的仍是既有种子，');
md.push('所以这一轮改成：**每次都用当前时间做种子新开对局**，并且把「引擎实际给出的合法攻击目标」与');
md.push('「按官方规则在本文件内独立重算的结果」逐次比较——不调用 `canAttackPlayer` / `canTargetBase`，');
md.push('避免用被测函数验证被测函数。');
md.push('');
md.push('## 二、引擎层：5 局新对局');
md.push('');
md.push(`本次种子：\`${seeds.join('` / `') || '(未取得)'}\``);
md.push('');
md.push('| 对局 | 结算 | 校验 |');
md.push('|---|---|---|');
for (const block of blocks) {
  const name = `${block.label}${block.emperors ? `（大将 ${block.emperors.replace(/,/g, '/')}）` : ''}`;
  const verdict = (block.verdict || '').replace(/^.*→/, '').trim();
  const detail = (block.verdict || '').replace(/ → .*$/, '').replace(/^校验：/, '');
  md.push(`| ${name} | ${block.result || '-'} | **${verdict || '-'}**（${detail}） |`);
}
md.push('');
md.push('### 完整输出');
md.push('');
md.push('```');
md.push(live.out.trimEnd());
md.push('```');
md.push('');
md.push('## 三、Web 层：从界面接口新建的对局');
md.push('');
md.push('`tools/web-live-check.mjs` 启动服务后通过 `POST /api/match` 新建两局：');
md.push('');
md.push('1. **大将战**：座位 0 是人类（提督），敌方大将在座位 3，敌方提督 1/5。逐回合驱动人类座位，');
md.push('   在战斗值 > 0 的时点读取 `/api/match?perspective=0` 返回的 `legalActions`——这正是界面高亮可攻击目标的数据源——');
md.push('   与独立重算比较。');
md.push('2. **三头龙**：6 个脚本座位自动跑完，核对「结束回合」的座位序列是否为整队连续。');
md.push('');
md.push('```');
md.push(web.out.trimEnd());
md.push('```');
md.push('');
md.push('## 四、怎么读这些数字');
md.push('');
md.push('- **「合法集不符 0 次」**是核心指标：每一次「该玩家当前战斗值 > 0」的决策，都把引擎列出的可攻击玩家集合');
md.push('  与独立重算逐元素比对。不符即意味着界面会显示错误的目标。');
md.push('- **「规则放行」> 「引擎实际放出」**不是 bug：差额来自**前哨保护**。有前哨的玩家（团队模式为整队）');
md.push('  不能被直接攻击，必须先拆前哨；独立重算里同样加了这一层，所以两边仍然一致。');
md.push('- **「对位存活时把敌方大将判为可打 0 次」**是大将战的关键：提督在对面提督还活着时，无论引擎还是规则都不放行大将。');
md.push('- **「对位阵亡后规则放行打大将」有非零值**，才说明「解锁」这条真的实现了，而不只是把攻击全禁掉。');
md.push('');
md.push('## 五、仍然存在的偏差（与本次两问无关，未改动）');
md.push('');
md.push('| 项 | 现状 | 官方规则 |');
md.push('|---|---|---|');
md.push('| 大将战「1 贸易移牌」 | 可交给任意队友 | 仅相邻队友 |');
md.push('| 大将战前哨保护 | 按个人判定 | 按个人判定（与 2V2/三头龙按整队不同）✅ |');
md.push('');
md.push('## 六、复跑方式');
md.push('');
md.push('```bash');
md.push('node tools/live-match-trace.mjs   # 引擎层 5 局，约 1.5 秒');
md.push('node tools/web-live-check.mjs     # Web 层 2 局，约 12 秒');
md.push('node tools/live-match-report.mjs  # 重新生成本文件');
md.push('node --test test/live-mode-audit.test.js');
md.push('```');
md.push('');
md.push('种子取当前时间，所以每次运行都是新对局；若某次出现失败，输出会直接列出违规的动作序号、座位与双方身份。');
md.push('');

fs.writeFileSync('reply/star-realms-live-match-20261109.md', md.join('\n'), 'utf8');
console.log(`written reply/star-realms-live-match-20261109.md (${md.join('\n').length} chars)`);
console.log(`live exit=${live.status} web exit=${web.status}`);
console.log(`live pass=${/总判定：5 局全部通过/.test(live.out)} web pass=${/总判定：通过/.test(web.out)}`);
