/**
 * 2V2 实验室执行器：一次运行一场赛事，跑完立即把 JSON + Markdown 报告写进 reply/。
 *
 * 用法：
 *   node src/team-lab-cli.js --experiment clone  --sets core --seasons 12 --rounds 5 \
 *        --seed lab-2v2-2026-11-06 --out reply/star-realms-2v2-clone-core
 *   node src/team-lab-cli.js --experiment random --sets all  --seasons 12 --rounds 5 \
 *        --seed lab-2v2-2026-11-06 --out reply/star-realms-2v2-random-all
 *
 * sets: core = 仅基础盒；all = core + colonyWars + events（全扩）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MatchRunner } from './engine/runner.js';
import { loadScript } from './ai/loader.js';
import { normalizeExpansions } from './engine/cards.js';
import { randomFrom } from './engine/rng.js';
import {
  makeGameSeeds, pairRound, pairKey, matchScore, rankPlayers,
  aggregateSeasons, shuffleWithRandom
} from './engine/swiss.js';
import {
  makeArrangementPlan, auditArrangementPlan, winnerTeamId, pairRoundTeams
} from './engine/team-swiss.js';
import {
  buildCloneTeams, buildRandomTeams, wilson, fitContribution,
  memberStats, auditSeatBalance, modelsOfSeats
} from './engine/team-lab.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETS = { core: ['core'], all: ['core', 'colonyWars', 'events'] };

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

async function playGame({ arrangement, seed, expansions, maxActions, bySeatId }) {
  const players = arrangement.seats.map(id => {
    const member = bySeatId.get(id);
    if (!member) throw new Error(`座位成员缺失：${id}`);
    return { name: member.display, script: member.script };
  });
  const runner = await MatchRunner.create({ mode: 'team2v2', seed, expansions, players });
  const result = await runner.runToEnd(maxActions);
  if (result.winningTeam === null) throw new Error(`对局 ${seed} 未分出胜负`);
  return {
    winningTeam: result.winningTeam,
    turns: result.turns,
    actions: result.actions,
    authorities: result.authorities
  };
}

function scoreLine(match, labelOf) {
  return `${labelOf(match.a)} ${match.aWins}:${match.bWins} ${labelOf(match.b)}`;
}

function pct(x) { return `${(x * 100).toFixed(2)}%`; }

export function markdownReport(report) {
  const { config, seasons, aggregate, champion, members, contribution, stats, audit, teams } = report;
  const isClone = config.experiment === 'clone';
  const lines = [];
  lines.push(`# 星域奇航 · 2V2 实验室 · ${isClone ? '实验 A 同模型复制队' : '实验 B 随机组队'}（${config.setsLabel}）`);
  lines.push('');
  lines.push(`> 运行 ID \`${config.runId}\` · 主种子 \`${config.masterSeed}\` · 生成于 ${report.generatedAt}`);
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  if (isClone && champion) {
    const team = teams.find(t => t.id === champion.id);
    lines.push(`**2V2 能力第一：${team.vendor}**（${team.name}，队友是该脚本自身的副本）。` +
      `局胜率 **${pct(champion.gameRate)}**（${champion.gameWins}/${champion.games}），` +
      `Wilson 95% CI [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}]；` +
      `${config.seasons} 届中夺冠 **${champion.titles}** 次，平均名次 ${champion.avgRank}，累计场分 ${champion.mp}。`);
    const second = aggregate[1];
    if (second) lines.push('', `亚军 ${teams.find(t => t.id === second.id).vendor} ${pct(second.gameRate)}，` +
      `差 ${(stats.rateGap * 100).toFixed(2)}pp，两比例近似 z = ${stats.zScore}，` +
      `${stats.significant95 ? '**达到 95% 显著**' : '未达 95% 显著'}。`);
  } else {
    const top = contribution.rows[0];
    const rawTop = members[0];
    const titleTop = [...members].sort((a, b) => b.titles - a.titles || a.id.localeCompare(b.id))[0];
    lines.push(`**个人发挥第一（主口径：控制队友与对手后的边际贡献 β）：${top.id}**，β = ${top.beta}，` +
      `折算胜率优势倍数 e^β = ${top.odds}${top.z === null ? '' : `，近似 z = ${top.z}`}。` +
      `该模型在场 ${rawTop ? (members.find(m => m.id === top.id)?.games ?? 0) : 0} 局，` +
      `所在队伍胜率 ${pct(members.find(m => m.id === top.id)?.winRate ?? 0)}。`);
    lines.push('', `交叉核对：在场胜率第一是 ${rawTop.id}（${pct(rawTop.winRate)}）；` +
      `所在队伍夺冠次数最多的是 ${titleTop.id}（${titleTop.titles} 次）。` +
      `${top.id === rawTop.id && top.id === titleTop.id ? '三个口径一致。' : '三个口径不完全一致，见下方口径说明。'}`);
  }
  lines.push('');
  lines.push('## 实验设计');
  lines.push('');
  if (isClone) {
    lines.push('- 12 支队伍，每队由**同一份 AI 脚本的两个副本**组成；队友是自己的镜像，因此队伍成绩可近似归因为该脚本的 2V2 能力。');
    lines.push('- **赛制参考 1v1 瑞士轮**：12 个参赛单位、每届 5 轮、每轮 6 场、场分胜 1 / 平 0.5 / 负 0；同分优先 + 回溯零重赛配对，最终排名比较 MP → 局胜 → Buchholz → Sonneborn–Berger → 种子优先级。');
    lines.push(`- ${config.seasons} 届独立重跑，聚合榜按**局胜率**排序（局分比场分样本更细），与 1v1 正式赛口径一致。`);
  } else {
    lines.push(`- 每届把 12 个模型**随机两两配成 6 队**，共 ${config.seasons} 届；每届队伍组成都不同，跨届累计每人与不同队友搭档。`);
    lines.push('- 每届跑 5 轮组队瑞士轮，每轮 3 场；配对带剩余轮次可行性前瞻，保证整届零重赛。');
    lines.push('- 随机组队由主种子 `:teams:sN` 驱动；为使搭档覆盖均衡，每届采样若干随机完美匹配，选累计搭档重复成本最低的一份（不改变随机性来源）。');
    lines.push('- **个人发挥主口径**：团队 Bradley–Terry 逻辑模型 `logit P(前位队胜) = β[座位0] + β[座位2] − β[座位1] − β[座位3] + γ`，' +
      '用 IRLS 拟合 12 个 β（以均值为 0 中心化）与前位截距 γ。β 已控制队友与对手强度，比「所在队伍胜率」更能隔离个人贡献。');
    lines.push('- 辅助口径：在场队伍胜率（Wilson 95% CI）、所在队伍夺冠次数、搭档/对手覆盖数。');
  }
  lines.push(`- 每场 **BO${config.bo}**：覆盖「哪队占前位 × A 队谁在前 × B 队谁在前」共 8 种座位排列 × ${config.repeats} 轮；每局独立随机种子。2v2 中座位 [0,2] 一队、[1,3] 一队，共享 75 点权威。`);
  lines.push(`- 牌包：**${config.setsLabel}** = ${config.sets.join(' + ')}；模式 team2v2（同队前哨保护、回合末资源预留）。`);
  lines.push('');
  lines.push('## 口径与局限');
  lines.push('');
  lines.push('- 2v2 的胜负是**队伍共享**的，任何个人指标都是统计估计而非直接测量；β 依赖「随机组队让队友/对手强度在期望上抵消」这一设计假设。');
  lines.push('- 同一场 BO8 内的对局并不独立，置信区间、SE 与 z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。');
  lines.push('- 复制队里两个副本使用同一份脚本，但各自拥有独立的 `memory` 与随机流（脚本模块级只有只读常量表），不存在跨座位状态串扰。');
  lines.push('- 全扩牌包含事件牌，事件翻出即结算；脚本需自行处理 `eventChoice` 等动作。');
  lines.push('');

  if (isClone) {
    lines.push('## 队伍构成');
    lines.push('');
    lines.push('| 队伍 | 脚本 | 策略 | 两个座位 |');
    lines.push('|---|---|---|---|');
    for (const team of teams) lines.push(`| ${team.name} | \`${team.players[0].script}\` | ${team.players[0].strategy.replace('模型自选：', '')} | ${team.players.map(p => p.id).join(' / ')} |`);
    lines.push('');
    lines.push('## 聚合总榜（= 单模型 2V2 能力榜）');
    lines.push('');
    lines.push('| 名次 | 模型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 | 平均 Buchholz |');
    lines.push('|---:|---|---:|---:|---:|---:|---:|---|---:|');
    for (const row of aggregate) {
      const team = teams.find(t => t.id === row.id);
      lines.push(`| ${row.rank} | ${team.vendor} | ${row.titles} | ${row.avgRank} | ${pct(row.gameRate)} | ${row.gameWins}/${row.games} | ${row.mp} | ${pct(row.firstRate)} / ${pct(row.secondRate)} | ${row.avgBuchholz} |`);
    }
    lines.push('');
    lines.push('## 各届冠军');
    lines.push('');
    lines.push(seasons.map(s => `第 ${s.index} 届：${teams.find(t => t.id === s.champion)?.vendor || s.champion}（MP ${s.standings[0].mp}，局胜 ${s.standings[0].gameWins}）`).join('；') + '。');
    lines.push('');
  } else {
    lines.push('## 各届随机组队与冠军');
    lines.push('');
    lines.push('| 届 | 种子 | 冠军队伍成员 | 冠军 MP / 局胜 |');
    lines.push('|---:|---|---|---|');
    for (const season of seasons) {
      const champ = season.teamRoster.find(t => t.id === season.champion);
      lines.push(`| ${season.index} | \`${season.seed}\` | ${champ ? champ.players.map(p => p.display).join(' + ') : season.champion} | ${season.standings[0].mp} / ${season.standings[0].gameWins} |`);
    }
    lines.push('');
  }

  lines.push('## 个人在场统计');
  lines.push('');
  lines.push('| 模型 | 参与局（去重） | 座位次数 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 搭档数 | 对手数 | 所在队伍夺冠 | 座位分布 |');
  lines.push('|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|');
  for (const row of members) lines.push(`| ${row.id} | ${row.games} | ${row.seatAppearances} | ${row.wins} | ${pct(row.winRate)} | [${pct(row.ci95[0])}, ${pct(row.ci95[1])}] | ${pct(row.frontRate)} | ${row.partnerCount} | ${row.opponentCount} | ${row.titles} | ${row.seats.join('/')} |`);
  if (isClone) lines.push('', '> 复制队里同一模型占两个座位，因此「座位次数」是「参与局」的两倍；胜率按去重后的参与局计算。');
  lines.push('');
  lines.push('## 个人边际贡献 β（主口径）');
  lines.push('');
  lines.push('| 名次 | 模型 | β | e^β | 近似 SE | 近似 z |');
  lines.push('|---:|---|---:|---:|---:|---:|');
  for (const row of contribution.rows) lines.push(`| ${row.rank} | ${row.id} | ${row.beta} | ${row.odds} | ${row.se ?? '—'} | ${row.z ?? '—'} |`);
  lines.push('');
  lines.push(`拟合样本 ${contribution.samples} 局，前位截距 γ = ${contribution.frontAdvantage}（正值表示前位队有优势），L2 正则 λ = ${contribution.lambda}，收敛 ${contribution.converged ? '成功' : '失败'}。`);
  lines.push('');
  lines.push('## 账目守恒');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|---|---|');
  lines.push(`| 计划总局数 | ${audit.totalGames} |`);
  lines.push(`| 实际完成局数 | ${audit.playedGames} |`);
  lines.push(`| 每队总局数 | ${audit.perTeamGames} |`);
  lines.push(`| 每个模型参与局数（去重） | ${audit.perModelGames} |`);
  lines.push(`| 每个模型座位次数 | ${audit.perModelSeatAppearances} |`);
  lines.push(`| 重赛 / 异常重试 / 前瞻回退轮次 | ${audit.rematches} / ${audit.retries} / ${audit.infeasibleRounds} |`);
  lines.push(`| 前位队胜率 | ${pct(stats.frontSideRate)}（${stats.frontSideWins}/${stats.totalGames}） |`);
  lines.push(`| 座位配平 | ${audit.seatBalanced ? '通过（每个模型在 4 个座位出现次数相同）' : '未通过'} |`);
  if (!isClone) lines.push(`| 搭档覆盖（不同搭档对） | ${audit.partnerPairs} / 66 |`);
  if (isClone) lines.push(`| 冠亚 95% CI | [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}] / [${pct(stats.runnerUpCI95[0])}, ${pct(stats.runnerUpCI95[1])}] |`);
  lines.push(`| 耗时 | ${(audit.elapsedMs / 1000).toFixed(1)}s |`);
  lines.push('');
  lines.push('## 各届逐轮明细');
  lines.push('');
  for (const season of seasons) {
    const labelOf = id => season.teamRoster.find(t => t.id === id)?.name || id;
    lines.push(`### 第 ${season.index} 届 · 种子 ${season.seed}`);
    lines.push('');
    for (const round of season.rounds) {
      lines.push(`- 第 ${round.round} 轮 · 配对顺序 ${round.order.map(labelOf).join(' → ')}`);
      for (const match of round.pairs) lines.push(`  - ${scoreLine(match, labelOf)}${match.rematch ? ' · 重赛' : ''}`);
    }
    lines.push('');
  }
  lines.push('## 逐局明细与复现');
  lines.push('');
  lines.push(`完整逐局记录（每局种子、4 个座位及其模型、前位队、引擎获胜队伍、回合数、终局权威）见 \`${path.basename(report.file)}\` 的 \`seasons[].rounds[].pairs[].games\`。`);
  lines.push('');
  lines.push('```bash');
  lines.push(`node src/team-lab-cli.js --experiment ${config.experiment} --sets ${config.setsKey} --seed ${config.masterSeed} --seasons ${config.seasons} --rounds ${config.rounds} --repeats ${config.repeats} --out ${config.outBase}`);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const experiment = String(args.experiment || '');
  if (!['clone', 'random'].includes(experiment)) throw new Error('--experiment 必须是 clone 或 random');
  const setsKey = String(args.sets || 'core');
  if (!SETS[setsKey]) throw new Error('--sets 必须是 core 或 all');
  const sets = SETS[setsKey];
  const masterSeed = String(args.seed || 'lab-2v2-2026-11-06');
  const seasons = Math.max(1, Number(args.seasons || 12));
  const rounds = Math.max(1, Number(args.rounds || 5));
  const repeats = Math.max(1, Number(args.repeats || 1));
  const maxActions = Number(args['max-actions'] || 100000);
  const runId = String(args['run-id'] || `${experiment}-${setsKey}-${seasons}x${rounds}-${Date.now()}`);
  const outBase = String(args.out || `reply/star-realms-2v2-${experiment}-${setsKey}`).replace(/\.(json|md)$/i, '');
  const quiet = args.quiet === 'true';

  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
  if (catalog.length !== 12) throw new Error(`脚本目录应有 12 个模型，实际 ${catalog.length}`);
  for (const agent of catalog) {
    const file = path.join(ROOT, String(agent.file).replace(/\\/g, '/'));
    if (!fs.existsSync(file)) throw new Error(`脚本缺失：${agent.file}`);
    await loadScript(`script:${path.basename(file)}`);
  }
  const expansions = normalizeExpansions({ expansions: { sets } });
  const modelIds = catalog.map(agent => agent.id);
  const perSide = 4 * repeats;
  const bo = 8 * repeats;
  const matchesPerRound = experiment === 'clone' ? 6 : 3;
  const teamCount = experiment === 'clone' ? 12 : 6;
  const totalGames = seasons * rounds * matchesPerRound * bo;
  const config = {
    experiment, setsKey, sets, setsLabel: setsKey === 'all' ? '全扩' : '核心牌包',
    masterSeed, seasons, rounds, repeats, perSide, bo,
    teamCount, matchesPerRound, mode: 'team2v2', runId, outBase
  };

  const outJson = path.join(ROOT, `${outBase}.json`);
  const outMd = path.join(ROOT, `${outBase}.md`);
  fs.mkdirSync(path.dirname(outJson), { recursive: true });

  let playedGames = 0;
  let rematches = 0;
  let retries = 0;
  let infeasibleRounds = 0;
  let frontWins = 0;
  const started = Date.now();
  const pairCounts = new Map();
  const allGames = [];
  const modelTitles = new Map(modelIds.map(id => [id, 0]));
  const seasonReports = [];
  const fixedTeams = experiment === 'clone' ? buildCloneTeams(catalog) : null;

  for (let s = 0; s < seasons; s++) {
    const seasonSeed = `${masterSeed}:${experiment}:${setsKey}:s${s + 1}`;
    let teams;
    if (experiment === 'clone') {
      teams = fixedTeams;
    } else {
      const built = buildRandomTeams(catalog, s + 1, `${masterSeed}:${setsKey}`, pairCounts);
      teams = built.teams;
      for (const [a, b] of built.pairs) {
        const key = [a, b].sort().join('|');
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
      }
    }
    const roster = teams.map(team => ({
      id: team.id, name: team.name, kind: team.kind, vendor: team.vendor,
      players: team.players.map(p => ({ id: p.id, model: p.model, display: p.display, script: p.script }))
    }));
    const bySeatId = new Map(teams.flatMap(team => team.players.map(player => [player.id, player])));
    // 复制队每队两个带后缀的副本 → 24 个 seatId；随机组队每个模型每届只出现一次 → 12 个。
    const expectedSeatIds = experiment === 'clone' ? 24 : 12;
    if (bySeatId.size !== expectedSeatIds) throw new Error(`第 ${s + 1} 届座位数应为 ${expectedSeatIds}，实际 ${bySeatId.size}`);

    const initialOrder = shuffleWithRandom(teams, randomFrom(`${seasonSeed}:entrants`));
    const seedTable = makeGameSeeds(seasonSeed, rounds, matchesPerRound, perSide);
    const played = new Set();
    const standings = new Map(initialOrder.map(team => [team.id, { id: team.id, mp: 0 }]));
    const matches = [];
    const roundReports = [];

    for (let r = 0; r < rounds; r++) {
      const round = r + 1;
      const pairing = experiment === 'clone'
        ? pairRound({ standings: [...standings.values()], played, round, masterSeed: seasonSeed })
        : pairRoundTeams({
          standings: [...standings.values()], played, round,
          roundsLeft: rounds - r, masterSeed: seasonSeed,
          allIds: teams.map(team => team.id)
        });
      if (pairing.infeasible) infeasibleRounds++;
      const roundReport = { round, order: pairing.order, bye: pairing.bye || null, forwardChecked: !!pairing.forwardChecked, pairs: [] };

      for (let m = 0; m < pairing.pairs.length; m++) {
        const pair = pairing.pairs[m];
        const teamA = initialOrder.find(team => team.id === pair.a);
        const teamB = initialOrder.find(team => team.id === pair.b);
        if (!teamA || !teamB) throw new Error(`第 ${s + 1} 届 R${round} 配对找不到队伍`);
        const seeds = seedTable[r][m];
        const plan = makeArrangementPlan(teamA, teamB, repeats, randomFrom(`${seasonSeed}:seats:s${s + 1}:r${round}:m${m + 1}`));
        const planAudit = auditArrangementPlan(plan, teamA, teamB);
        if (!planAudit.balanced) throw new Error(`第 ${s + 1} 届 R${round} M${m + 1} 座位排列未配平`);
        const games = [];

        for (let g = 0; g < bo; g++) {
          const arrangement = plan[g];
          const seed = seeds[g];
          let outcome;
          try {
            outcome = await playGame({ arrangement, seed, expansions, maxActions, bySeatId });
          } catch (error) {
            retries++;
            const retrySeed = `${seed}:retry`;
            outcome = await playGame({ arrangement, seed: retrySeed, expansions, maxActions, bySeatId });
            outcome.seed = retrySeed;
          }
          const models = modelsOfSeats(arrangement.seats, bySeatId);
          const winnerId = winnerTeamId(arrangement, teamA, teamB, outcome.winningTeam);
          const game = {
            game: g + 1, arrangement: arrangement.key,
            seats: arrangement.seats, models,
            frontTeam: arrangement.frontTeam, backTeam: arrangement.backTeam,
            leadA: arrangement.leadA, leadB: arrangement.leadB,
            seed: outcome.seed || seed,
            first: arrangement.frontTeam, second: arrangement.backTeam,
            winnerId, winningTeam: outcome.winningTeam,
            turns: outcome.turns, actions: outcome.actions, authorities: outcome.authorities
          };
          games.push(game);
          allGames.push({ models, winningTeam: outcome.winningTeam });
          playedGames++;
          if (outcome.winningTeam === 0) frontWins++;
        }

        const aWins = games.filter(x => x.winnerId === teamA.id).length;
        const bWins = games.length - aWins;
        const score = matchScore(aWins, bWins, bo);
        const aFront = games.filter(x => x.first === teamA.id);
        const bFront = games.filter(x => x.first === teamB.id);
        const match = {
          round, match: m + 1, a: teamA.id, b: teamB.id,
          rematch: !!pair.rematch, sameScore: pair.sameScore, scoreGap: pair.scoreGap,
          ...score, games,
          firstWinsA: aFront.filter(x => x.winnerId === teamA.id).length,
          firstGamesA: aFront.length,
          secondWinsA: bFront.filter(x => x.winnerId === teamA.id).length,
          secondGamesA: bFront.length,
          firstWinsB: bFront.filter(x => x.winnerId === teamB.id).length,
          firstGamesB: bFront.length,
          secondWinsB: aFront.filter(x => x.winnerId === teamB.id).length,
          secondGamesB: aFront.length,
          turnsA: games.reduce((sum, x) => sum + x.turns, 0),
          turnsB: games.reduce((sum, x) => sum + x.turns, 0),
          actionsA: games.reduce((sum, x) => sum + x.actions, 0),
          actionsB: games.reduce((sum, x) => sum + x.actions, 0)
        };
        matches.push(match);
        roundReport.pairs.push(match);
        played.add(pairKey(teamA.id, teamB.id));
        if (pair.rematch) rematches++;
        standings.get(teamA.id).mp += score.mpA;
        standings.get(teamB.id).mp += score.mpB;
        if (!quiet) console.log(`[S${s + 1}/R${round}/M${m + 1}] ${scoreLine(match, id => roster.find(t => t.id === id)?.name || id)} → MP ${score.mpA}:${score.mpB}`);
      }
      if (pairing.bye) {
        matches.push({ round, bye: pairing.bye });
        standings.get(pairing.bye).mp += 1;
      }
      roundReports.push(roundReport);
    }

    const finalStandings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
    const championId = finalStandings[0].id;
    const championTeam = teams.find(t => t.id === championId);
    // 复制队的两个座位属于同一模型，一届夺冠对该模型只计一次。
    for (const model of new Set(championTeam.players.map(p => p.model))) {
      modelTitles.set(model, (modelTitles.get(model) || 0) + 1);
    }
    seasonReports.push({
      index: s + 1, seed: seasonSeed, initialOrder: initialOrder.map(t => t.id),
      teamRoster: roster, rounds: roundReports, standings: finalStandings,
      champion: championId,
      audit: {
        rounds: roundReports.length,
        matches: matches.filter(x => x.a).length,
        games: matches.filter(x => x.a).reduce((sum, x) => sum + x.games.length, 0),
        rematches: matches.filter(x => x.rematch).length
      }
    });
    console.log(`第 ${s + 1} 届冠军：${championTeam.name}（MP ${finalStandings[0].mp}，局胜 ${finalStandings[0].gameWins}/${finalStandings[0].games}）`);
  }

  const aggregate = experiment === 'clone' ? aggregateSeasons(seasonReports, fixedTeams) : null;
  const champion = aggregate ? { ...aggregate[0], ...fixedTeams.find(t => t.id === aggregate[0].id) } : null;

  const members = memberStats(allGames, modelIds);
  for (const row of members) row.titles = modelTitles.get(row.id) || 0;
  const contribution = fitContribution(allGames, modelIds);
  const seatAudit = auditSeatBalance(members);

  let stats = {
    frontSideWins: frontWins,
    totalGames: playedGames,
    frontSideRate: +(frontWins / playedGames).toFixed(4)
  };
  if (aggregate) {
    const top = aggregate[0];
    const second = aggregate[1];
    const ci = wilson(top.gameWins, top.games);
    const ci2 = second ? wilson(second.gameWins, second.games) : [0, 0];
    const diff = second ? top.gameRate - second.gameRate : 0;
    const se = second
      ? Math.sqrt(top.gameRate * (1 - top.gameRate) / top.games + second.gameRate * (1 - second.gameRate) / second.games)
      : 1;
    stats = {
      ...stats,
      championCI95: ci.map(x => +x.toFixed(4)),
      runnerUpCI95: ci2.map(x => +x.toFixed(4)),
      rateGap: +diff.toFixed(4),
      zScore: +(diff / se).toFixed(3),
      significant95: Math.abs(diff / se) >= 1.96
    };
  }

  const audit = {
    totalGames, playedGames,
    perTeamGames: seasons * rounds * bo,
    perModelGames: members.length ? members[0].games : 0,
    perModelSeatAppearances: members.length ? members[0].seatAppearances : 0,
    rematches, retries, infeasibleRounds,
    seatBalanced: seatAudit.balanced,
    seatDistinctCounts: seatAudit.distinctCounts,
    partnerPairs: pairCounts.size,
    planAudits: seasons * rounds * matchesPerRound,
    elapsedMs: Date.now() - started
  };
  if (playedGames !== totalGames) throw new Error(`总局数不守恒：计划 ${totalGames}，实际 ${playedGames}`);
  if (members.some(row => row.games !== audit.perModelGames)) throw new Error('每个模型在场局数不相等');

  const report = {
    format: 'star-realms-sim-2v2-lab', version: 1,
    file: `${outBase}.json`, config,
    teams: experiment === 'clone'
      ? fixedTeams.map(t => ({ id: t.id, name: t.name, kind: t.kind, vendor: t.vendor, players: t.players }))
      : null,
    seasons: seasonReports,
    aggregate, champion,
    members, contribution, stats, audit,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outMd, markdownReport(report), 'utf8');
  if (!quiet) {
    console.log(`报告已写入 ${outBase}.json / .md`);
    console.log(`总局数 ${playedGames} · 前位队胜率 ${pct(stats.frontSideRate)} · 座位配平 ${audit.seatBalanced} · 耗时 ${(audit.elapsedMs / 1000).toFixed(1)}s`);
    if (champion) console.log(`实验 A 冠军：${champion.vendor} ${pct(champion.gameRate)}`);
    else console.log(`实验 B 个人 β 第一：${contribution.rows[0].id} (β=${contribution.rows[0].beta})；在场胜率第一：${members[0].id} ${pct(members[0].winRate)}`);
  }
}

// 作为 CLI 直接运行时才执行；被汇总/重算脚本 import 时不应启动赛事。
const invokedDirectly = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch(error => {
    console.error('实验失败：', error);
    process.exitCode = 1;
  });
}
