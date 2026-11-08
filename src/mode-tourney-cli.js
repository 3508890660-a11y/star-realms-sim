/**
 * 6 人团队模式赛事执行器：三头龙 3V3（hydra3）与大将战 3V3（emperor）。
 *
 * 设计：
 *  - 每届把 12 个模型随机分成 4 队（每队 3 人），打完整单循环（3 轮 × 2 场）；
 *  - 每场 BO6：前位队 3 局 / 后位队 3 局，且每个模型在 6 个座位各坐 1 次；
 *  - 大将战每场让每名队员各当 2 次大将，角色完全配平；
 *  - 12 届独立重跑，跨届累计个人在场胜率与 Bradley–Terry 边际贡献 β。
 *
 * 用法：
 *   node src/mode-tourney-cli.js --mode hydra3  --sets core --seasons 12 --seed mode-3v3-2026-11-08 --out reply/star-realms-hydra3-core
 *   node src/mode-tourney-cli.js --mode emperor --sets all  --seasons 12 --seed mode-3v3-2026-11-08 --out reply/star-realms-emperor-all
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MatchRunner } from './engine/runner.js';
import { loadScript } from './ai/loader.js';
import { normalizeExpansions } from './engine/cards.js';
import { randomFrom } from './engine/rng.js';
import { shuffleWithRandom } from './engine/swiss.js';
import { buildRandomTrios, wilson, fitContribution, memberStats, auditSeatBalance } from './engine/team-lab.js';
import { MODES } from './engine/modes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETS = { core: ['core'], all: ['core', 'colonyWars', 'events', 'frontiers', 'crisisFleets', 'crisisBases'] };
const EVEN = [0, 2, 4];
const ODD = [1, 3, 5];
/** 4 队完整单循环赛程：3 轮 × 2 场，覆盖全部 6 个对阵组合，零重赛。 */
const ROUND_ROBIN = [
  [[0, 3], [1, 2]],
  [[0, 2], [3, 1]],
  [[0, 1], [2, 3]]
];

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

const pct = x => `${(x * 100).toFixed(2)}%`;

/**
 * 一场 BO 的座位编排。
 * front 队占偶数座位、back 队占奇数座位；第 g 局按 g 轮换队内座位，
 * 等价于每个模型 6 个座位各坐一次；大将战再按局轮换大将。
 */
export function seatPlan(front, back, bo, emperorOffset = 0) {
  const plan = [];
  for (let g = 0; g < bo; g++) {
    const frontIsA = g % 2 === 0;
    const first = frontIsA ? front : back;
    const second = frontIsA ? back : front;
    const shift = g % 3;
    const seats = Array(6).fill(null);
    first.players.forEach((player, j) => { seats[EVEN[(j + shift) % 3]] = player; });
    second.players.forEach((player, j) => { seats[ODD[(j + shift) % 3]] = player; });
    const emperorIndex = (Math.floor(g / 2) + emperorOffset) % 3;
    const emperors = [EVEN[(emperorIndex + shift) % 3], ODD[(emperorIndex + shift) % 3]];
    plan.push({ seats, emperors, frontTeamId: first.id, backTeamId: second.id, game: g + 1 });
  }
  return plan;
}

async function playGame({ mode, plan, seed, expansions, maxActions }) {
  const players = plan.seats.map(player => ({ name: player.display, script: player.script }));
  const config = { mode, seed, expansions, players };
  if (mode === 'emperor') config.emperors = plan.emperors;
  const runner = await MatchRunner.create(config);
  const result = await runner.runToEnd(maxActions);
  if (result.winningTeam === null) throw new Error(`对局 ${seed} 未分出胜负`);
  return { winningTeam: result.winningTeam, turns: result.turns, actions: result.actions, authorities: result.authorities };
}

export function markdownReport(report) {
  const { config, seasons, members, contribution, stats, audit } = report;
  const lines = [];
  const modeName = MODES[config.mode].name;
  lines.push(`# 星域奇航 · ${modeName} 正式赛（${config.setsLabel}）`);
  lines.push('');
  lines.push(`> 运行 ID \`${config.runId}\` · 主种子 \`${config.masterSeed}\` · 生成于 ${report.generatedAt}`);
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  const top = contribution.rows[0];
  const rawTop = members[0];
  const titleTop = [...members].sort((a, b) => b.titles - a.titles || a.id.localeCompare(b.id))[0];
  lines.push(`**个人边际贡献第一：${top.id}**，β = ${top.beta}，折算胜率优势倍数 e^β = ${top.odds}` +
    `${top.z === null ? '' : `，近似 z = ${top.z}`}；在场 ${members.find(m => m.id === top.id)?.games ?? 0} 局，所在队伍胜率 ${pct(members.find(m => m.id === top.id)?.winRate ?? 0)}。`);
  lines.push('');
  lines.push(`交叉核对：在场队伍胜率第一 ${rawTop.id}（${pct(rawTop.winRate)}）；所在队伍夺冠最多 ${titleTop.id}（${titleTop.titles} 次）。` +
    `${top.id === rawTop.id && top.id === titleTop.id ? '三个口径一致。' : '三个口径不完全一致，见口径说明。'}`);
  lines.push('');
  lines.push('## 赛事设计');
  lines.push('');
  lines.push(`- 模式：**${modeName}**（${MODES[config.mode].description}）。`);
  lines.push('- 每届把 12 个模型随机分成 **4 队、每队 3 人**；跨届队伍组成不同，用主种子驱动，并在 64 次随机排列里挑「重复队友最少」的一份（只用于打散搭档，不改变随机来源）。');
  lines.push('- 每届打 **完整单循环**：3 轮 × 2 场，4 队两两交手一次，零重赛；场分胜 1 / 平 0.5 / 负 0。');
  lines.push(`- 每场 **BO${config.bo}**：前位队 3 局、后位队 3 局；队内座位按局轮换，**每名队员在 6 个座位各坐 1 次**。`);
  if (config.mode === 'emperor') lines.push('- 大将战：每场让每名队员各当 **2 次大将**，大将/提督角色完全配平（起始权威 60 / 50）。');
  lines.push(`- 牌包：**${config.setsLabel}** = ${config.sets.join(' + ')}。`);
  lines.push(`- ${config.seasons} 届独立重跑，共 ${audit.playedGames} 局。`);
  lines.push('');
  lines.push('## 口径与局限');
  lines.push('');
  lines.push('- 3V3 的胜负是队伍共享的，个人指标是统计估计而非直接测量；β 依赖「随机组队让队友与对手强度在期望上抵消」。');
  lines.push('- 同一场 BO 内对局不独立，CI / SE / z 仅作近似参考；结论只适用于本赛制、本牌包与这组种子。');
  lines.push('- 大将战的「大将被击败则全队失败」使队伍成绩对大将座位的依赖更强，故角色必须逐局轮换；本报告已按局配平。');
  lines.push('');
  lines.push('## 各届组队与冠军');
  lines.push('');
  lines.push('| 届 | 种子 | 冠军队伍 | 冠军 MP / 局胜 |');
  lines.push('|---:|---|---|---|');
  for (const season of seasons) {
    const champ = season.teamRoster.find(team => team.id === season.champion);
    lines.push(`| ${season.index} | \`${season.seedSeed}\` | ${champ ? champ.players.map(p => p.display).join(' + ') : season.champion} | ${season.standings[0].mp} / ${season.standings[0].gameWins} |`);
  }
  lines.push('');
  lines.push('## 个人在场统计');
  lines.push('');
  lines.push('| 模型 | 参与局 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 搭档数 | 对手数 | 所在队伍夺冠 | 座位分布 |');
  lines.push('|---|---:|---:|---:|---|---:|---:|---:|---:|---|');
  for (const row of members) {
    lines.push(`| ${row.id} | ${row.games} | ${row.wins} | ${pct(row.winRate)} | [${pct(row.ci95[0])}, ${pct(row.ci95[1])}] | ${pct(row.frontRate)} | ${row.partnerCount} | ${row.opponentCount} | ${row.titles} | ${row.seats.join('/')} |`);
  }
  lines.push('');
  lines.push('## 个人边际贡献 β（主口径）');
  lines.push('');
  lines.push('| 名次 | 模型 | β | e^β | 近似 SE | 近似 z |');
  lines.push('|---:|---|---:|---:|---:|---:|');
  for (const row of contribution.rows) lines.push(`| ${row.rank} | ${row.id} | ${row.beta} | ${row.odds} | ${row.se ?? '—'} | ${row.z ?? '—'} |`);
  lines.push('');
  lines.push(`拟合样本 ${contribution.samples} 局，前位截距 γ = ${contribution.frontAdvantage}，L2 正则 λ = ${contribution.lambda}，收敛 ${contribution.converged ? '成功' : '失败'}。`);
  lines.push('');
  lines.push('## 账目守恒');
  lines.push('');
  lines.push('| 项目 | 值 |');
  lines.push('|---|---|');
  lines.push(`| 计划总局数 | ${audit.totalGames} |`);
  lines.push(`| 实际完成局数 | ${audit.playedGames} |`);
  lines.push(`| 每队场数 / 每个模型局数 | ${audit.perTeamMatches} / ${audit.perModelGames} |`);
  lines.push(`| 重赛 / 异常重试 | ${audit.rematches} / ${audit.retries} |`);
  lines.push(`| 前位队（偶数座位）胜率 | ${pct(stats.frontSideRate)}（${stats.frontSideWins}/${stats.totalGames}） |`);
  lines.push(`| 座位配平 | ${audit.seatBalanced ? '通过（每个模型在 6 个座位出现次数相同）' : '未通过'} |`);
  if (config.mode === 'emperor') lines.push(`| 大将角色配平 | ${audit.emperorBalanced ? '通过（每个模型当大将次数相同）' : '未通过'} |`);
  lines.push(`| 耗时 | ${(audit.elapsedMs / 1000).toFixed(1)}s |`);
  lines.push('');
  lines.push('## 复现');
  lines.push('');
  lines.push('```bash');
  lines.push(`node src/mode-tourney-cli.js --mode ${config.mode} --sets ${config.setsKey} --seasons ${config.seasons} --repeats ${config.repeats} --seed ${config.masterSeed} --out ${config.outBase}`);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const mode = String(args.mode || '');
  if (!['hydra3', 'emperor'].includes(mode)) throw new Error('--mode 必须是 hydra3 或 emperor');
  const setsKey = String(args.sets || 'core');
  if (!SETS[setsKey]) throw new Error('--sets 必须是 core 或 all');
  const sets = SETS[setsKey];
  const masterSeed = String(args.seed || 'mode-3v3-2026-11-08');
  const seasons = Math.max(1, Number(args.seasons || 12));
  const repeats = Math.max(1, Number(args.repeats || 1));
  const bo = 6 * repeats;
  const maxActions = Number(args['max-actions'] || 200000);
  const quiet = args.quiet === 'true';
  const runId = String(args['run-id'] || `${mode}-${setsKey}-${seasons}x-${Date.now()}`);
  const outBase = String(args.out || `reply/star-realms-${mode}-${setsKey}`).replace(/\.(json|md)$/i, '');

  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
  if (catalog.length !== 12) throw new Error(`脚本目录应有 12 个模型，实际 ${catalog.length}`);
  for (const agent of catalog) {
    const file = path.join(ROOT, String(agent.file).replace(/\\/g, '/'));
    if (!fs.existsSync(file)) throw new Error(`脚本缺失：${agent.file}`);
    await loadScript(`script:${path.basename(file)}`);
  }

  const expansions = normalizeExpansions({ expansions: { sets } });
  const modelIds = catalog.map(agent => agent.id);
  const rounds = 3;
  const matchesPerRound = 2;
  const totalGames = seasons * rounds * matchesPerRound * bo;
  const config = {
    mode, modeName: MODES[mode].name, setsKey, sets,
    setsLabel: setsKey === 'all' ? '全扩' : '核心牌包',
    masterSeed, seasons, rounds, matchesPerRound, repeats, bo,
    teamsPerSeason: 4, playersPerTeam: 3, totalGames, runId, outBase
  };
  const outJson = path.join(ROOT, `${outBase}.json`);
  const outMd = path.join(ROOT, `${outBase}.md`);
  fs.mkdirSync(path.dirname(outJson), { recursive: true });

  const started = Date.now();
  const pairCounts = new Map();
  const allGames = [];
  const modelTitles = new Map(modelIds.map(id => [id, 0]));
  const emperorGames = new Map(modelIds.map(id => [id, 0]));
  const seasonReports = [];
  let playedGames = 0;
  let frontWins = 0;
  let retries = 0;

  for (let s = 0; s < seasons; s++) {
    const seasonSeed = `${masterSeed}:${mode}:${setsKey}:s${s + 1}`;
    const built = buildRandomTrios(catalog, s + 1, `${masterSeed}:${setsKey}`, pairCounts);
    for (const [a, b] of built.pairs) pairCounts.set([a, b].sort().join('|'), (pairCounts.get([a, b].sort().join('|')) || 0) + 1);
    const teams = built.teams;
    const roster = teams.map(team => ({
      id: team.id, name: team.name, vendor: team.vendor,
      players: team.players.map(p => ({ id: p.id, model: p.model, display: p.display, script: p.script, strategy: p.strategy }))
    }));
    const byId = new Map(teams.map(team => [team.id, team]));
    const standings = new Map(teams.map(team => [team.id, { id: team.id, mp: 0, gameWins: 0, gameLosses: 0 }]));
    const roundReports = [];

    for (let r = 0; r < rounds; r++) {
      const round = r + 1;
      const pairs = ROUND_ROBIN[r];
      const roundReport = { round, pairs: [] };
      for (let m = 0; m < pairs.length; m++) {
        const [i, j] = pairs[m];
        const teamA = teams[i];
        const teamB = teams[j];
        if (!teamA || !teamB) throw new Error(`第 ${s + 1} 届 R${round} 配对越界`);
        const plan = seatPlan(teamA, teamB, bo, r + m);
        const games = [];
        for (const item of plan) {
          const seed = `${seasonSeed}:r${round}:m${m + 1}:g${item.game}`;
          let outcome;
          try {
            outcome = await playGame({ mode, plan: item, seed, expansions, maxActions });
          } catch (error) {
            retries++;
            const retrySeed = `${seed}:retry`;
            outcome = await playGame({ mode, plan: item, seed: retrySeed, expansions, maxActions });
            outcome.seed = retrySeed;
          }
          const models = item.seats.map(player => player.model);
          const winnerId = outcome.winningTeam === 0 ? item.frontTeamId : item.backTeamId;
          const emperorSeats = mode === 'emperor'
            ? item.emperors.map(seat => ({ seat, model: item.seats[seat].model }))
            : null;
          if (emperorSeats) for (const entry of emperorSeats) emperorGames.set(entry.model, (emperorGames.get(entry.model) || 0) + 1);
          games.push({
            game: item.game, seed: outcome.seed || seed, seats: item.seats.map(p => p.id), models,
            emperorSeats, frontTeam: item.frontTeamId, backTeam: item.backTeamId,
            winningTeam: outcome.winningTeam, winnerId,
            turns: outcome.turns, actions: outcome.actions, authorities: outcome.authorities
          });
          allGames.push({ models, winningTeam: outcome.winningTeam });
          playedGames++;
          if (outcome.winningTeam === 0) frontWins++;
        }
        const aWins = games.filter(x => x.winnerId === teamA.id).length;
        const bWins = games.length - aWins;
        const mpA = aWins > bWins ? 1 : aWins === bWins ? 0.5 : 0;
        const mpB = 1 - mpA;
        const match = { round, match: m + 1, a: teamA.id, b: teamB.id, aWins, bWins, mpA, mpB, games };
        roundReport.pairs.push(match);
        standings.get(teamA.id).mp += mpA;
        standings.get(teamB.id).mp += mpB;
        standings.get(teamA.id).gameWins += aWins;
        standings.get(teamA.id).gameLosses += bWins;
        standings.get(teamB.id).gameWins += bWins;
        standings.get(teamB.id).gameLosses += aWins;
        if (!quiet) console.log(`[S${s + 1}/R${round}/M${m + 1}] ${teamA.vendor} ${aWins}:${bWins} ${teamB.vendor}`);
      }
      roundReports.push(roundReport);
    }

    const order = [...standings.values()].sort((a, b) => b.mp - a.mp || b.gameWins - a.gameWins || a.id.localeCompare(b.id));
    order.forEach((row, index) => { row.rank = index + 1; row.games = row.gameWins + row.gameLosses; });
    const championTeam = byId.get(order[0].id);
    for (const player of championTeam.players) modelTitles.set(player.model, (modelTitles.get(player.model) || 0) + 1);
    seasonReports.push({
      index: s + 1, seedSeed: seasonSeed, teamRoster: roster,
      rounds: roundReports, standings: order, champion: championTeam.id
    });
    console.log(`第 ${s + 1} 届冠军：${championTeam.vendor}（MP ${order[0].mp}，局胜 ${order[0].gameWins}/${order[0].games}）`);
  }

  const members = memberStats(allGames, modelIds);
  for (const row of members) {
    row.titles = modelTitles.get(row.id) || 0;
    row.emperorGames = emperorGames.get(row.id) || 0;
  }
  const contribution = fitContribution(allGames, modelIds);
  const seatAudit = auditSeatBalance(members);
  const emperorCounts = [...emperorGames.values()];
  const emperorBalanced = new Set(emperorCounts).size <= 1;

  const audit = {
    totalGames, playedGames,
    perTeamMatches: seasons * rounds,
    perModelGames: members.length ? members[0].games : 0,
    seatBalanced: seatAudit.balanced,
    seatDistinctCounts: seatAudit.distinctCounts,
    emperorBalanced,
    rematches: 0,
    retries,
    elapsedMs: Date.now() - started
  };
  if (playedGames !== totalGames) throw new Error(`总局数不守恒：计划 ${totalGames}，实际 ${playedGames}`);
  if (members.some(row => row.games !== audit.perModelGames)) throw new Error('每个模型参与局数不相等');
  if (!seatAudit.balanced) throw new Error('座位分布未配平');
  if (mode === 'emperor' && !emperorBalanced) throw new Error('大将角色未配平');

  const stats = {
    frontSideWins: frontWins, totalGames: playedGames,
    frontSideRate: +(frontWins / playedGames).toFixed(4)
  };
  const report = {
    format: 'star-realms-sim-mode-tourney', version: 1,
    file: `${outBase}.json`, config, seasons: seasonReports,
    members, contribution, stats, audit,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(outMd, markdownReport(report), 'utf8');
  console.log(`报告已写入 ${outBase}.json / .md`);
  console.log(`总局数 ${playedGames} · 前位队胜率 ${pct(stats.frontSideRate)} · 座位配平 ${audit.seatBalanced} · 耗时 ${(audit.elapsedMs / 1000).toFixed(1)}s`);
  console.log(`个人 β 第一：${contribution.rows[0].id}（β=${contribution.rows[0].beta}）；在场胜率第一：${members[0].id} ${pct(members[0].winRate)}`);
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch(error => {
    console.error('赛事失败：', error);
    process.exitCode = 1;
  });
}
