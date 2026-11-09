/**
 * 3V3 复制队实验室执行器：三头龙（hydra3）/ 大将战（emperor）× 核心 / 全扩，共四场。
 *
 * 与 2V2「实验 A 同模型复制队」同口径：
 *  - 12 支队伍，每队由同一份 AI 脚本的三个副本组成；队友是自己的镜像；
 *  - 12 届独立瑞士轮，每届 5 轮 × 6 场，同分优先 + 零重赛回溯配对；
 *  - 每场 BO6 覆盖「哪队占前位 × 队内座位轮换 3 种」共 6 种排列，
 *    每名队员在 6 个座位各坐一次；大将战另按局轮换大将，每人每场 2 次；
 *  - 聚合榜按局胜率排序， Wilson CI / 两比例 z 仅作近似参考；
 *  - 在场统计与个人 β 作为辅助口径（复制队里同一模型占 3 个座位，β 不可与随机组队直接比较）。
 *
 * 用法：
 *   node src/mode-lab-cli.js --mode hydra3 --sets core --seasons 12 --rounds 5 \
 *        --seed mode-3v3-2026-11-08 --out reply/star-realms-3v3-clone-hydra3-core
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
  buildCloneTrios, wilson, fitContribution, memberStats, auditSeatBalance
} from './engine/team-lab.js';
import { MODES } from './engine/modes.js';
import { seatPlan } from './mode-tourney-cli.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SETS = { core: ['core'], all: ['core', 'colonyWars', 'events', 'frontiers', 'crisisFleets', 'crisisBases'] };

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

const pct = x => `${(x * 100).toFixed(2)}%`;

async function playGame({ mode, plan, seed, expansions, maxActions }) {
  const players = plan.seats.map(player => ({ name: player.display, script: player.script }));
  const config = { mode, seed, expansions, players };
  if (mode === 'emperor') config.emperors = plan.emperors;
  const runner = await MatchRunner.create(config);
  const result = await runner.runToEnd(maxActions);
  if (result.winningTeam === null) throw new Error(`对局 ${seed} 未分出胜负`);
  return {
    winningTeam: result.winningTeam,
    turns: result.turns,
    actions: result.actions,
    authorities: result.authorities
  };
}

export function markdownReport(report) {
  const { config, seasons, aggregate, champion, members, contribution, stats, audit, teams } = report;
  const modeName = MODES[config.mode].name;
  const lines = [];
  lines.push(`# 星域奇航 · 3V3 实验室 · 同模型复制队（${modeName} · ${config.setsLabel}）`);
  lines.push('');
  lines.push(`> 运行 ID \`${config.runId}\` · 主种子 \`${config.masterSeed}\` · 生成于 ${report.generatedAt}`);
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  const team = teams.find(t => t.id === champion?.id);
  lines.push(`**3V3 复制队能力第一：${team?.vendor || champion?.id}**（三名队员都是同一份脚本的副本）。` +
    `局胜率 **${pct(champion.gameRate)}**（${champion.gameWins}/${champion.games}），` +
    `Wilson 95% CI [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}]；` +
    `${config.seasons} 届中夺冠 **${champion.titles}** 次，平均名次 ${champion.avgRank}，累计场分 ${champion.mp}。`);
  const second = aggregate[1];
  if (second) {
    const runnerUp = teams.find(t => t.id === second.id);
    lines.push('', `亚军 ${runnerUp?.vendor || second.id} ${pct(second.gameRate)}，` +
      `差 ${(stats.rateGap * 100).toFixed(2)}pp，两比例近似 z = ${stats.zScore}，` +
      `${stats.significant95 ? '**达到 95% 显著**' : '未达 95% 显著'}。`);
  }
  lines.push('');
  lines.push('## 实验设计');
  lines.push('');
  lines.push(`- 模式：**${modeName}**（${MODES[config.mode].description}）。`);
  lines.push('- 12 支队伍，每队由**同一份 AI 脚本的三个副本**组成；队友是自己的镜像，队伍成绩可近似归因为该脚本的 3V3 能力。');
  lines.push('- **赛制参考 1v1 瑞士轮 / 2V2 实验 A**：12 个参赛单位、每届 5 轮 × 6 场，场分胜 1 / 平 0.5 / 负 0；同分优先 + 回溯零重赛配对，最终排名比较 MP → 局胜 → Buchholz → Sonneborn–Berger → 种子优先级。');
  lines.push(`- ${config.seasons} 届独立重跑，聚合榜按**局胜率**排序，与 1v1 正式赛 / 2V2 实验 A 口径一致。`);
  lines.push(`- 每场 **BO${config.bo}**：前位队 ${config.perSide} 局、后位队 ${config.perSide} 局；覆盖「哪队占前位 × 队内座位轮换 3 种」，**每名队员在 6 个座位各坐 1 次**。`);
  if (config.mode === 'emperor') lines.push('- 大将战：每场每名队员各当 **2 次大将**，大将/提督角色严格配平（起始权威 60 / 50）。');
  lines.push(`- 牌包：**${config.setsLabel}** = ${config.sets.join(' + ')}。`);
  lines.push(`- ${config.seasons} 届 × ${config.rounds} 轮 × ${config.matchesPerRound} 场 × BO${config.bo} = **${audit.playedGames} 局**。`);
  lines.push('');
  lines.push('## 口径与局限');
  lines.push('');
  lines.push('- 复制队里三个副本使用同一份脚本，各自拥有独立的 `memory` 与随机流（脚本模块级只有只读常量表），不存在跨座位状态串扰。');
  lines.push('- 3V3 的胜负是队伍共享的；本实验把队伍成绩归因为脚本能力，前提是「队友是自己的镜像」，因此它测的是**该脚本在自协同配置下的强度**，不等于随机组队时的个人发挥。');
  lines.push('- 同一场 BO6 内对局不独立，CI / SE / z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。');
  lines.push('- **β 表仅为辅助口径**：同一模型在一局占 3 个座位，线性预测器里它的 β 被计入 3 次，数值不可与随机组队 3V3 的 β 直接比较；本场主口径是复制队局胜率。');
  lines.push('- 全扩含事件牌，事件翻出即结算；脚本需自行处理 `eventChoice` 等动作。');
  lines.push('');
  lines.push('## 队伍构成');
  lines.push('');
  lines.push('| 队伍 | 脚本 | 策略 | 三个座位 |');
  lines.push('|---|---|---|---|');
  for (const t of teams) lines.push(`| ${t.name} | \`${t.players[0].script}\` | ${String(t.players[0].strategy).replace('模型自选：', '')} | ${t.players.map(p => p.id).join(' / ')} |`);
  lines.push('');
  lines.push('## 聚合总榜（= 单模型 3V3 复制队能力榜）');
  lines.push('');
  lines.push('| 名次 | 模型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 | 平均 Buchholz |');
  lines.push('|---:|---|---:|---:|---:|---:|---:|---|---:|');
  for (const row of aggregate) {
    const t = teams.find(x => x.id === row.id);
    lines.push(`| ${row.rank} | ${t?.vendor || row.id} | ${row.titles} | ${row.avgRank} | ${pct(row.gameRate)} | ${row.gameWins}/${row.games} | ${row.mp} | ${pct(row.firstRate)} / ${pct(row.secondRate)} | ${row.avgBuchholz} |`);
  }
  lines.push('');
  lines.push('## 各届冠军');
  lines.push('');
  lines.push(seasons.map(s => `第 ${s.index} 届：${teams.find(t => t.id === s.champion)?.vendor || s.champion}（MP ${s.standings[0].mp}，局胜 ${s.standings[0].gameWins}）`).join('；') + '。');
  lines.push('');
  lines.push('## 个人在场统计（辅助）');
  lines.push('');
  lines.push('| 模型 | 参与局（去重） | 座位次数 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 所在队伍夺冠 | 座位分布 |');
  lines.push('|---|---:|---:|---:|---:|---|---:|---:|---|');
  for (const row of members) lines.push(`| ${row.id} | ${row.games} | ${row.seatAppearances} | ${row.wins} | ${pct(row.winRate)} | [${pct(row.ci95[0])}, ${pct(row.ci95[1])}] | ${pct(row.frontRate)} | ${row.titles} | ${row.seats.join('/')} |`);
  lines.push('', '> 复制队里同一模型占三个座位，因此「座位次数」是「参与局」的三倍；胜率按去重后的参与局计算。');
  lines.push('');
  lines.push('## 个人边际贡献 β（辅助，不与随机组队比较）');
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
  lines.push(`| 每队总局数 | ${audit.perTeamGames} |`);
  lines.push(`| 每个模型参与局数（去重） | ${audit.perModelGames} |`);
  lines.push(`| 每个模型座位次数 | ${audit.perModelSeatAppearances} |`);
  lines.push(`| 重赛 / 异常重试 / 配对回退 | ${audit.rematches} / ${audit.retries} / ${audit.infeasibleRounds} |`);
  lines.push(`| 前位队胜率 | ${pct(stats.frontSideRate)}（${stats.frontSideWins}/${stats.totalGames}） |`);
  lines.push(`| 座位配平 | ${audit.seatBalanced ? '通过（每个模型在 6 个座位出现次数相同）' : '未通过'} |`);
  if (config.mode === 'emperor') {
    lines.push(`| 大将角色配平（按模型） | ${audit.emperorBalanced ? '通过' : '未通过'} |`);
    lines.push(`| 大将角色配平（按副本座位） | ${audit.emperorSeatBalanced ? '通过（36 个副本等频）' : '未通过'} |`);
  }
  lines.push(`| 冠亚 95% CI | [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}] / [${pct(stats.runnerUpCI95[0])}, ${pct(stats.runnerUpCI95[1])}] |`);
  lines.push(`| 耗时 | ${(audit.elapsedMs / 1000).toFixed(1)}s |`);
  lines.push('');
  lines.push('## 复现');
  lines.push('');
  lines.push('```bash');
  lines.push(`node src/mode-lab-cli.js --mode ${config.mode} --sets ${config.setsKey} --seasons ${config.seasons} --rounds ${config.rounds} --repeats ${config.repeats} --seed ${config.masterSeed} --out ${config.outBase}`);
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
  const rounds = Math.max(1, Number(args.rounds || 5));
  const repeats = Math.max(1, Number(args.repeats || 1));
  const perSide = 3 * repeats;
  const bo = 6 * repeats;
  const maxActions = Number(args['max-actions'] || 200000);
  const quiet = args.quiet === 'true';
  const runId = String(args['run-id'] || `3v3-clone-${mode}-${setsKey}-${seasons}x${rounds}-${Date.now()}`);
  const outBase = String(args.out || `reply/star-realms-3v3-clone-${mode}-${setsKey}`).replace(/\.(json|md)$/i, '');

  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
  if (catalog.length !== 12) throw new Error(`脚本目录应有 12 个模型，实际 ${catalog.length}`);
  for (const agent of catalog) {
    const file = path.join(ROOT, String(agent.file).replace(/\\/g, '/'));
    if (!fs.existsSync(file)) throw new Error(`脚本缺失：${agent.file}`);
    await loadScript(`script:${path.basename(file)}`);
  }
  const expansions = normalizeExpansions({ expansions: { sets } });
  const modelIds = catalog.map(agent => agent.id);
  const teams = buildCloneTrios(catalog);
  const teamCount = teams.length;
  const matchesPerRound = teamCount / 2;
  const totalGames = seasons * rounds * matchesPerRound * bo;
  const config = {
    experiment: 'clone', teamKind: 'clone3', group: '3v3',
    mode, modeName: MODES[mode].name,
    setsKey, sets, setsLabel: setsKey === 'all' ? '全扩' : '核心牌包',
    masterSeed, seasons, rounds, matchesPerRound, repeats, perSide, bo,
    teamCount, playersPerTeam: 3, totalGames, runId, outBase
  };
  const outJson = path.join(ROOT, `${outBase}.json`);
  const outMd = path.join(ROOT, `${outBase}.md`);
  fs.mkdirSync(path.dirname(outJson), { recursive: true });

  const started = Date.now();
  const allGames = [];
  const modelTitles = new Map(modelIds.map(id => [id, 0]));
  const emperorByModel = new Map(modelIds.map(id => [id, 0]));
  const emperorBySeat = new Map(teams.flatMap(t => t.players.map(p => [p.id, 0])));
  const seasonReports = [];
  let playedGames = 0;
  let frontWins = 0;
  let rematches = 0;
  let retries = 0;
  let infeasibleRounds = 0;

  for (let s = 0; s < seasons; s++) {
    const seasonSeed = `${masterSeed}:clone:${mode}:${setsKey}:s${s + 1}`;
    const roster = teams.map(team => ({
      id: team.id, name: team.name, kind: team.kind, vendor: team.vendor,
      players: team.players.map(p => ({ id: p.id, model: p.model, display: p.display, script: p.script }))
    }));
    const initialOrder = shuffleWithRandom(teams, randomFrom(`${seasonSeed}:entrants`));
    const byId = new Map(teams.map(team => [team.id, team]));
    const seedTable = makeGameSeeds(seasonSeed, rounds, matchesPerRound, perSide);
    const played = new Set();
    const standings = new Map(initialOrder.map(team => [team.id, { id: team.id, mp: 0 }]));
    const matches = [];
    const roundReports = [];

    for (let r = 0; r < rounds; r++) {
      const round = r + 1;
      const pairing = pairRound({ standings: [...standings.values()], played, round, masterSeed: seasonSeed });
      if (pairing.fellBack || pairing.infeasible) infeasibleRounds++;
      const roundReport = { round, order: pairing.order, bye: pairing.bye || null, pairs: [] };

      for (let m = 0; m < pairing.pairs.length; m++) {
        const pair = pairing.pairs[m];
        const teamA = byId.get(pair.a);
        const teamB = byId.get(pair.b);
        if (!teamA || !teamB) throw new Error(`第 ${s + 1} 届 R${round} 配对找不到队伍`);
        const seeds = seedTable[r][m];
        const plan = seatPlan(teamA, teamB, bo, r + m);
        const games = [];
        for (let g = 0; g < plan.length; g++) {
          const item = plan[g];
          const seed = seeds[g];
          let outcome;
          try {
            outcome = await playGame({ mode, plan: item, seed, expansions, maxActions });
          } catch (error) {
            retries++;
            const retrySeed = `${seed}:retry`;
            outcome = await playGame({ mode, plan: item, seed: retrySeed, expansions, maxActions });
            outcome.seed = retrySeed;
          }
          const winnerId = outcome.winningTeam === 0 ? item.frontTeamId : item.backTeamId;
          const emperorSeats = mode === 'emperor'
            ? item.emperors.map(seat => ({ seat, id: item.seats[seat].id, model: item.seats[seat].model }))
            : null;
          if (emperorSeats) {
            for (const entry of emperorSeats) {
              emperorBySeat.set(entry.id, (emperorBySeat.get(entry.id) || 0) + 1);
              emperorByModel.set(entry.model, (emperorByModel.get(entry.model) || 0) + 1);
            }
          }
          const game = {
            game: g + 1, seed: outcome.seed || seed,
            seats: item.seats.map(p => p.id), models: item.seats.map(p => p.model),
            emperorSeats, frontTeam: item.frontTeamId, backTeam: item.backTeamId,
            first: item.frontTeamId, second: item.backTeamId,
            winningTeam: outcome.winningTeam, winnerId,
            turns: outcome.turns, actions: outcome.actions, authorities: outcome.authorities
          };
          games.push(game);
          allGames.push({ models: game.models, winningTeam: outcome.winningTeam });
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
          firstWinsA: aFront.filter(x => x.winnerId === teamA.id).length, firstGamesA: aFront.length,
          secondWinsA: bFront.filter(x => x.winnerId === teamA.id).length, secondGamesA: bFront.length,
          firstWinsB: bFront.filter(x => x.winnerId === teamB.id).length, firstGamesB: bFront.length,
          secondWinsB: aFront.filter(x => x.winnerId === teamB.id).length, secondGamesB: aFront.length,
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
        if (!quiet) console.log(`[S${s + 1}/R${round}/M${m + 1}] ${teamA.name} ${aWins}:${bWins} ${teamB.name}`);
      }
      if (pairing.bye) {
        matches.push({ round, bye: pairing.bye });
        standings.get(pairing.bye).mp += 1;
      }
      roundReports.push(roundReport);
    }

    const finalStandings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
    const championId = finalStandings[0].id;
    const championTeam = byId.get(championId);
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

  const aggregate = aggregateSeasons(seasonReports, teams);
  const champion = { ...aggregate[0], ...teams.find(t => t.id === aggregate[0].id) };
  const members = memberStats(allGames, modelIds);
  for (const row of members) row.titles = modelTitles.get(row.id) || 0;
  if (mode === 'emperor') for (const row of members) row.emperorGames = emperorByModel.get(row.id) || 0;
  const contribution = fitContribution(allGames, modelIds);
  const seatAudit = auditSeatBalance(members);
  const emperorCounts = [...emperorByModel.values()];
  const emperorBalanced = new Set(emperorCounts).size <= 1;
  const emperorSeatCounts = [...emperorBySeat.values()];
  const emperorSeatBalanced = new Set(emperorSeatCounts).size <= 1 && emperorSeatCounts.every(x => x > 0);

  const top = aggregate[0];
  const second = aggregate[1];
  const ci = wilson(top.gameWins, top.games);
  const ci2 = second ? wilson(second.gameWins, second.games) : [0, 0];
  const diff = second ? top.gameRate - second.gameRate : 0;
  const se = second
    ? Math.sqrt(top.gameRate * (1 - top.gameRate) / top.games + second.gameRate * (1 - second.gameRate) / second.games)
    : 1;
  const stats = {
    frontSideWins: frontWins, totalGames: playedGames,
    frontSideRate: +(frontWins / playedGames).toFixed(4),
    championCI95: ci.map(x => +x.toFixed(4)),
    runnerUpCI95: ci2.map(x => +x.toFixed(4)),
    rateGap: +diff.toFixed(4),
    zScore: +(diff / se).toFixed(3),
    significant95: Math.abs(diff / se) >= 1.96
  };
  const audit = {
    totalGames, playedGames,
    perTeamGames: seasons * rounds * bo,
    perModelGames: members.length ? members[0].games : 0,
    perModelSeatAppearances: members.length ? members[0].seatAppearances : 0,
    rematches, retries, infeasibleRounds,
    seatBalanced: seatAudit.balanced,
    seatDistinctCounts: seatAudit.distinctCounts,
    elapsedMs: Date.now() - started
  };
  // 大将角色统计只对大将战有意义；三头龙不写这些字段，避免汇总/看板误读成「未配平」。
  if (mode === 'emperor') {
    audit.emperorBalanced = emperorBalanced;
    audit.emperorSeatBalanced = emperorSeatBalanced;
    audit.emperorSeatDistinctCounts = [...new Set(emperorSeatCounts)].sort((a, b) => a - b);
  }
  if (playedGames !== totalGames) throw new Error(`总局数不守恒：计划 ${totalGames}，实际 ${playedGames}`);
  if (members.some(row => row.games !== audit.perModelGames)) throw new Error('每个模型在场局数不相等');
  if (!seatAudit.balanced) throw new Error('座位分布未配平');
  if (mode === 'emperor' && (!emperorBalanced || !emperorSeatBalanced)) throw new Error('大将角色未配平');

  const report = {
    format: 'star-realms-sim-3v3-lab', version: 1,
    file: `${outBase}.json`, config,
    teams: teams.map(t => ({ id: t.id, name: t.name, kind: t.kind, vendor: t.vendor, players: t.players })),
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
    console.log(`复制队冠军：${champion.vendor} ${pct(champion.gameRate)}（z=${stats.zScore}）`);
  }
}

const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedDirectly) {
  main().catch(error => {
    console.error('3V3 复制队实验失败：', error);
    process.exitCode = 1;
  });
}
