import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchRunner } from './engine/runner.js';
import { loadScript } from './ai/loader.js';
import { normalizeExpansions } from './engine/cards.js';
import { randomFrom } from './engine/rng.js';
import {
  buildTeams, makeArrangementPlan, winnerTeamId, auditArrangementPlan, pairRoundTeams,
  shuffleWithRandom, makeGameSeeds, pairKey, matchScore,
  rankPlayers, aggregateSeasons
} from './engine/team-swiss.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'tournaments');
const PROGRESS_FILE = path.join(OUT_DIR, 'team-progress.json');
const LATEST_FILE = path.join(OUT_DIR, 'team-latest.json');

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

// Windows 下服务端可能并发读取进度文件；直接覆盖写，读端对半截 JSON 有容错。
function writeText(file, text) { fs.writeFileSync(file, text, 'utf8'); }

function teamsFromCatalog() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8'));
  return buildTeams(catalog.agents);
}

async function playGame({ arrangement, seed, expansions, maxActions, byId, teamA, teamB }) {
  const players = arrangement.seats.map(id => {
    const member = byId.get(id);
    if (!member) throw new Error(`座位成员缺失：${id}`);
    return { name: member.model, script: member.script };
  });
  const runner = await MatchRunner.create({ mode: 'team2v2', seed, expansions, players });
  const result = await runner.runToEnd(maxActions);
  if (result.winningTeam === null) throw new Error(`对局 ${seed} 未分出胜负`);
  return {
    winnerId: winnerTeamId(arrangement, teamA, teamB, result.winningTeam),
    winningTeam: result.winningTeam,
    turns: result.turns,
    actions: result.actions,
    authorities: result.authorities
  };
}

const labelOf = (teams, id) => teams.find(team => team.id === id)?.name || id;

/** Wilson score 置信区间。 */
function wilson(wins, games, z = 1.96) {
  if (!games) return [0, 0];
  const p = wins / games;
  const d = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / d;
  const margin = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / d;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function computeStats({ seasons, aggregate, teams }) {
  const titles = {};
  let frontWins = 0;
  let total = 0;
  const seatCount = new Map();
  const leadCount = new Map();
  for (const season of seasons) {
    const name = labelOf(teams, season.champion);
    titles[name] = (titles[name] || 0) + 1;
    for (const round of season.rounds) {
      for (const match of round.pairs) {
        for (const game of match.games) {
          total++;
          if (game.winnerId === game.first) frontWins++;
          for (let seat = 0; seat < 4; seat++) {
            const key = `${game.seats[seat]}@${seat}`;
            seatCount.set(key, (seatCount.get(key) || 0) + 1);
          }
          leadCount.set(game.leadA, (leadCount.get(game.leadA) || 0) + 1);
          leadCount.set(game.leadB, (leadCount.get(game.leadB) || 0) + 1);
        }
      }
    }
  }
  const top = aggregate[0];
  const second = aggregate[1];
  const ci = top ? wilson(top.gameWins, top.games) : [0, 0];
  const ci2 = second ? wilson(second.gameWins, second.games) : [0, 0];
  const diff = top && second ? top.gameRate - second.gameRate : 0;
  const se = top && second
    ? Math.sqrt(top.gameRate * (1 - top.gameRate) / top.games + second.gameRate * (1 - second.gameRate) / second.games)
    : 1;
  return {
    championTitles: titles,
    frontSideWins: frontWins,
    totalGames: total,
    frontSideRate: total ? +(frontWins / total).toFixed(4) : 0,
    championCI95: ci.map(x => +x.toFixed(4)),
    runnerUpCI95: ci2.map(x => +x.toFixed(4)),
    rateGap: +diff.toFixed(4),
    zScore: +(diff / se).toFixed(3),
    significant95: Math.abs(diff / se) >= 1.96,
    seatCounts: Object.fromEntries(seatCount),
    leadCounts: Object.fromEntries(leadCount),
    seatBalanced: seatCount.size > 0 && new Set(seatCount.values()).size === 1
  };
}

/** 12 名队员分项：参与局数、队伍胜率、坐 0 号位与坐本队前位时的胜率。 */
function memberStats(seasons, teams) {
  const members = new Map();
  for (const team of teams) {
    for (const player of team.players) {
      members.set(player.id, {
        id: player.id, model: player.model, team: team.id, teamName: team.name,
        strategy: player.strategy, games: 0, wins: 0,
        seat0Games: 0, seat0Wins: 0, leadGames: 0, leadWins: 0
      });
    }
  }
  for (const season of seasons) {
    for (const round of season.rounds) {
      for (const match of round.pairs) {
        for (const game of match.games) {
          for (let seat = 0; seat < 4; seat++) {
            const id = game.seats[seat];
            const row = members.get(id);
            const won = game.winnerId === game.frontTeam ? (seat === 0 || seat === 2) : (seat === 1 || seat === 3);
            row.games++;
            if (won) row.wins++;
            if (seat === 0) { row.seat0Games++; if (won) row.seat0Wins++; }
            if (id === game.leadA || id === game.leadB) { row.leadGames++; if (won) row.leadWins++; }
          }
        }
      }
    }
  }
  return [...members.values()].map(row => ({
    ...row,
    winRate: +(row.wins / row.games).toFixed(4),
    seat0Rate: row.seat0Games ? +(row.seat0Wins / row.seat0Games).toFixed(4) : 0,
    leadRate: +(row.leadWins / row.leadGames).toFixed(4)
  })).sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));
}

function scoreLine(match, teams) {
  const frontHalf = match.games.filter(g => g.first === match.a).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  const backHalf = match.games.filter(g => g.first === match.b).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  return `${labelOf(teams, match.a)} ${match.aWins}:${match.bWins} ${labelOf(teams, match.b)} [A前 ${frontHalf} | B前 ${backHalf}]`;
}

function markdownReport(report) {
  const { config, teams, aggregate, champion, stats, audit, memberStats: members } = report;
  const lines = [];
  const pct = x => `${(x * 100).toFixed(2)}%`;
  lines.push(`# 星域奇航 · 2V2 组队瑞士轮赛果`);
  lines.push('');
  lines.push(`> 运行 ID \`${config.runId}\` · 主种子 \`${config.masterSeed}\` · 生成于 ${report.generatedAt}`);
  lines.push('');
  lines.push('## 结论');
  lines.push('');
  if (champion) {
    const team = teams.find(t => t.id === champion.id);
    lines.push(`**冠军队伍：${team.name}**（${team.players.map(p => p.model).join(' + ')}）。局胜率 **${pct(champion.gameRate)}**（${champion.gameWins}/${champion.games}），` +
      `Wilson 95% CI [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}]；${config.seasons} 届中夺冠 **${champion.titles}** 次，` +
      `平均名次 ${champion.avgRank}，累计场分 ${champion.mp}，前位 ${pct(champion.firstRate)} / 后位 ${pct(champion.secondRate)}。`);
    lines.push('');
    lines.push(`亚军 ${labelOf(teams, aggregate[1].id)} 为 ${pct(aggregate[1].gameRate)}，差 ${(stats.rateGap * 100).toFixed(2)}pp，` +
      `两比例近似 z = ${stats.zScore}，${stats.significant95 ? '**达到 95% 显著**' : '未达 95% 显著'}。`);
  }
  lines.push('');
  lines.push('## 队伍构成');
  lines.push('');
  lines.push('| 队伍 | 类型 | 厂商 | 队员 A | 队员 B | 队员自选策略 |');
  lines.push('|---|---|---|---|---|---|');
  for (const team of teams) {
    lines.push(`| ${team.name} | ${team.kind === 'same-vendor' ? '同厂配对' : '混编'} | ${team.vendor} | ${team.players[0].model} | ${team.players[1].model} | ${team.players.map(p => p.strategy.replace('模型自选：', '')).join(' / ')} |`);
  }
  lines.push('');
  lines.push('## 赛制与随机化');
  lines.push('');
  lines.push(`- ${teams.length} 支队伍 × ${config.rounds} 轮瑞士轮 × ${config.seasons} 届；每轮 3 场，场分胜 1 / 平 0.5 / 负 0。`);
  lines.push(`- 每场 **BO${config.bo}** = 8 种座位排列 × ${config.repeats} 轮；每局独立随机种子。`);
  lines.push('- 2v2 引擎的 team0 = 座位 [0,2]、team1 = 座位 [1,3]。完全配平需覆盖「哪队占前位 × A 队谁在前 × B 队谁在前」= 8 种组合，因此采用 8 的倍数而非 1v1 的 BO10。');
  lines.push('- 每场排列顺序由主种子 `:seats:sN:rR:mM` 洗牌；配对由 `:pair:rN:team` 同分随机排序 + 零重赛匹配；最终同分用 `:tiebreak`。');
  lines.push('- 6 队 5 轮会耗尽 K6 的全部 15 条边，逐轮贪心可能把最后一轮逼到无解；因此配对带「剩余轮次可行性前瞻」，只接受后续仍存在完整 1-因子分解的匹配。');
  lines.push(`- 牌包：${config.sets.join(' + ')}；模式 team2v2（共享 75 权威、队友前哨保护、资源预留）。`);
  lines.push('');
  lines.push('## 聚合总榜');
  lines.push('');
  lines.push('| 名次 | 队伍 | 类型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 | 平均 Buchholz |');
  lines.push('|---:|---|---|---:|---:|---:|---:|---:|---|---:|');
  for (const row of aggregate) {
    const team = teams.find(t => t.id === row.id);
    lines.push(`| ${row.rank} | ${team.name} | ${team.kind === 'same-vendor' ? '同厂' : '混编'} | ${row.titles} | ${row.avgRank} | ${pct(row.gameRate)} | ${row.gameWins}/${row.games} | ${row.mp} | ${pct(row.firstRate)} / ${pct(row.secondRate)} | ${row.avgBuchholz} |`);
  }
  lines.push('');
  lines.push('## 各届冠军');
  lines.push('');
  lines.push(report.seasons.map(s => `第 ${s.index} 届：${labelOf(teams, s.champion)}（MP ${s.standings[0].mp}，局胜 ${s.standings[0].gameWins}）`).join('；') + '。');
  lines.push('');
  lines.push('## 队员分项');
  lines.push('');
  lines.push('| 模型 | 队伍 | 参与局 | 队伍胜率 | 坐 0 号位胜率 | 本队前位胜率 |');
  lines.push('|---|---|---:|---:|---:|---:|');
  for (const row of members) lines.push(`| ${row.model} | ${row.teamName} | ${row.games} | ${pct(row.winRate)} | ${pct(row.seat0Rate)} | ${pct(row.leadRate)} |`);
  lines.push('');
  lines.push('## 账目守恒');
  lines.push('');
  lines.push(`| 项目 | 值 |`);
  lines.push('|---|---|');
  lines.push(`| 全部届总局数 | ${audit.totalGames} |`);
  lines.push(`| 实际完成局数 | ${audit.playedGames} |`);
  lines.push(`| 每队总局数 | ${audit.perTeamGames} |`);
  lines.push(`| 重赛 / 异常重试 / 前瞻回退轮次 | ${audit.rematches} / ${audit.retries} / ${audit.infeasibleRounds} |`);
  lines.push(`| 前位队胜率 | ${pct(stats.frontSideRate)}（${stats.frontSideWins}/${stats.totalGames}） |`);
  lines.push(`| 座位配平 | ${stats.seatBalanced ? '通过（每个模型在每个座位出现次数相同）' : '未通过'} |`);
  lines.push(`| 冠亚 95% CI | [${pct(stats.championCI95[0])}, ${pct(stats.championCI95[1])}] / [${pct(stats.runnerUpCI95[0])}, ${pct(stats.runnerUpCI95[1])}] |`);
  lines.push(`| 耗时 | ${(audit.elapsedMs / 1000).toFixed(1)}s |`);
  lines.push('');
  lines.push('## 各届逐轮明细');
  lines.push('');
  for (const season of report.seasons) {
    lines.push(`### 第 ${season.index} 届 · 种子 ${season.seed}`);
    lines.push('');
    for (const round of season.rounds) {
      lines.push(`- 第 ${round.round} 轮 · 配对顺序 ${round.order.map(id => labelOf(teams, id)).join(' → ')}`);
      for (const match of round.pairs) lines.push(`  - ${scoreLine(match, teams)}${match.rematch ? ' · 重赛' : ''}`);
    }
    lines.push('');
  }
  lines.push('## 逐局明细与复现');
  lines.push('');
  lines.push(`完整逐局记录（每局种子、4 个座位、前位队、引擎获胜队伍、终局权威）见 \`${path.basename(report.file)}\` 的 \`seasons[].rounds[].pairs[].games\`。`);
  lines.push('');
  lines.push('```bash');
  lines.push(`node src/team-tourney-cli.js --seed ${config.masterSeed} --seasons ${config.seasons} --rounds ${config.rounds} --repeats ${config.repeats} --sets ${config.sets.join(',')}`);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const masterSeed = String(args.seed || 'team-swiss-2026-11-06');
  const seasons = Math.max(1, Number(args.seasons || 1));
  const rounds = Math.max(1, Number(args.rounds || 5));
  const repeats = Math.max(1, Number(args.repeats || 1));
  const sets = String(args.sets || 'core').split(',').map(x => x.trim()).filter(Boolean);
  const maxActions = Number(args['max-actions'] || 100000);
  const runId = String(args['run-id'] || `${masterSeed.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`);
  const quiet = args.quiet === 'true';

  const teams = teamsFromCatalog();
  const byId = new Map(teams.flatMap(team => team.players.map(player => [player.id, player])));
  for (const player of byId.values()) {
    if (!fs.existsSync(path.join(ROOT, 'scripts', player.script.slice(7)))) throw new Error(`脚本缺失：${player.script}`);
    await loadScript(player.script);
  }
  const expansions = normalizeExpansions({ expansions: { sets } });
  const matchesPerRound = Math.floor(teams.length / 2);
  const perSide = 4 * repeats;      // makeGameSeeds 用 perSide*2 生成每场种子
  const bo = 8 * repeats;
  const totalGames = seasons * rounds * matchesPerRound * bo;
  const config = {
    masterSeed, seasons, rounds, repeats, perSide, bo, sets,
    teamCount: teams.length, matchesPerRound, mode: 'team2v2', runId
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let playedGames = 0;
  let rematches = 0;
  let retries = 0;
  let infeasibleRounds = 0;
  const started = Date.now();
  const progress = {
    runId, status: 'running', config,
    totalGames, playedGames: 0, totalMatches: seasons * rounds * matchesPerRound, playedMatches: 0,
    season: 1, round: 1, currentMatch: null, lastGame: null,
    standings: [], seasons: [], champion: null,
    startedAt: new Date(started).toISOString(), updatedAt: new Date().toISOString()
  };
  let lastProgressWrite = 0;
  const saveProgress = (force = false) => {
    progress.playedGames = playedGames;
    progress.updatedAt = new Date().toISOString();
    progress.elapsedMs = Date.now() - started;
    const now = Date.now();
    if (!force && now - lastProgressWrite < 400) return;
    lastProgressWrite = now;
    writeText(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  };
  saveProgress(true);

  const seasonReports = [];
  const planAudits = [];
  for (let s = 0; s < seasons; s++) {
    const seasonSeed = seasons > 1 ? `${masterSeed}:s${s + 1}` : masterSeed;
    const initialOrder = shuffleWithRandom(teams, randomFrom(`${seasonSeed}:entrants`));
    const seedTable = makeGameSeeds(seasonSeed, rounds, matchesPerRound, perSide);
    const played = new Set();
    const standings = new Map(initialOrder.map(team => [team.id, { id: team.id, mp: 0 }]));
    const matches = [];
    const roundReports = [];

    progress.season = s + 1;
    for (let r = 0; r < rounds; r++) {
      const round = r + 1;
      const pairing = pairRoundTeams({
        standings: [...standings.values()], played, round,
        roundsLeft: rounds - r, masterSeed: seasonSeed,
        allIds: teams.map(team => team.id)
      });
      if (pairing.infeasible) infeasibleRounds++;
      const roundReport = { round, order: pairing.order, bye: pairing.bye, forwardChecked: pairing.forwardChecked, pairs: [] };
      progress.round = round;
      progress.standings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
      saveProgress(true);

      for (let m = 0; m < pairing.pairs.length; m++) {
        const pair = pairing.pairs[m];
        const teamA = initialOrder.find(team => team.id === pair.a);
        const teamB = initialOrder.find(team => team.id === pair.b);
        const seeds = seedTable[r][m];
        const plan = makeArrangementPlan(teamA, teamB, repeats, randomFrom(`${seasonSeed}:seats:s${s + 1}:r${round}:m${m + 1}`));
        const planAudit = auditArrangementPlan(plan, teamA, teamB);
        planAudits.push({ season: s + 1, round, match: m + 1, balanced: planAudit.balanced, games: planAudit.games });
        if (!planAudit.balanced) throw new Error(`第 ${s + 1} 届 R${round} M${m + 1} 座位排列未配平`);
        const games = [];
        progress.currentMatch = { round, match: m + 1, a: teamA.name, b: teamB.name, bo };
        saveProgress(true);

        for (let g = 0; g < bo; g++) {
          const arrangement = plan[g];
          const seed = seeds[g];
          let outcome;
          try {
            outcome = await playGame({ arrangement, seed, expansions, maxActions, byId, teamA, teamB });
          } catch (error) {
            retries++;
            const retrySeed = `${seed}:retry`;
            outcome = await playGame({ arrangement, seed: retrySeed, expansions, maxActions, byId, teamA, teamB });
            outcome.seed = retrySeed;
          }
          games.push({
            game: g + 1, arrangement: arrangement.key,
            seats: arrangement.seats,
            frontTeam: arrangement.frontTeam, backTeam: arrangement.backTeam,
            leadA: arrangement.leadA, leadB: arrangement.leadB,
            seed: outcome.seed || seed,
            first: arrangement.frontTeam, second: arrangement.backTeam,
            winnerId: outcome.winnerId, winningTeam: outcome.winningTeam,
            turns: outcome.turns, actions: outcome.actions, authorities: outcome.authorities
          });
          playedGames++;
          progress.lastGame = {
            season: s + 1, round, match: m + 1, game: g + 1,
            a: teamA.name, b: teamB.name,
            front: labelOf(initialOrder, arrangement.frontTeam),
            winner: labelOf(initialOrder, outcome.winnerId), seed: outcome.seed || seed
          };
          saveProgress();
        }

        const aWins = games.filter(x => x.winnerId === teamA.id).length;
        const bWins = games.length - aWins;
        const score = matchScore(aWins, bWins, bo);
        const aFront = games.filter(x => x.first === teamA.id);
        const bFront = games.filter(x => x.first === teamB.id);
        const match = {
          round, match: m + 1, a: teamA.id, b: teamB.id,
          rematch: pair.rematch, sameScore: pair.sameScore, scoreGap: pair.scoreGap,
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

        progress.playedMatches++;
        progress.standings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
        if (!quiet) console.log(`[S${s + 1}/R${round}/M${m + 1}] ${scoreLine(match, initialOrder).replace(/ \[.*\]/, '')} → MP ${score.mpA}:${score.mpB}`);
        saveProgress(true);
      }
      if (pairing.bye) {
        matches.push({ round, bye: pairing.bye });
        standings.get(pairing.bye).mp += 1;
      }
      roundReports.push(roundReport);
    }

    const finalStandings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
    const seasonReport = {
      index: s + 1, seed: seasonSeed, initialOrder: initialOrder.map(team => team.id),
      rounds: roundReports, matches, standings: finalStandings,
      champion: finalStandings[0].id,
      audit: {
        rounds: roundReports.length,
        matches: matches.filter(x => x.a).length,
        games: matches.filter(x => x.a).reduce((sum, x) => sum + x.games.length, 0),
        rematches: matches.filter(x => x.rematch).length
      }
    };
    seasonReports.push(seasonReport);
    progress.seasons.push({ index: s + 1, seed: seasonSeed, champion: labelOf(initialOrder, finalStandings[0].id), standings: finalStandings });
    saveProgress(true);
    if (!quiet) console.log(`第 ${s + 1} 届冠军：${labelOf(initialOrder, finalStandings[0].id)}（MP ${finalStandings[0].mp}，局胜 ${finalStandings[0].gameWins}/${finalStandings[0].games}）`);
  }

  const aggregate = aggregateSeasons(seasonReports, teams);
  const champion = aggregate[0] ? { ...aggregate[0], ...teams.find(team => team.id === aggregate[0].id) } : null;
  const stats = computeStats({ seasons: seasonReports, aggregate, teams });
  const members = memberStats(seasonReports, teams);
  const report = {
    format: 'star-realms-team-swiss', version: 1,
    file: `${runId}.json`,
    config, teams, seasons: seasonReports, aggregate, champion, stats, memberStats: members,
    audit: {
      totalGames, playedGames,
      perTeamGames: aggregate[0]?.games,
      rematches, retries, infeasibleRounds,
      seasons: seasonReports.length,
      planAudits: planAudits.length,
      plansBalanced: planAudits.every(x => x.balanced),
      elapsedMs: Date.now() - started
    },
    generatedAt: new Date().toISOString()
  };

  writeText(path.join(OUT_DIR, `${runId}.json`), JSON.stringify(report, null, 2));
  writeText(LATEST_FILE, JSON.stringify(report, null, 2));
  writeText(path.join(OUT_DIR, `${runId}.md`), markdownReport(report));
  writeText(path.join(OUT_DIR, 'team-latest.md'), markdownReport(report));
  progress.status = 'completed';
  progress.champion = champion;
  progress.aggregate = aggregate;
  progress.reportFile = `${runId}.json`;
  saveProgress(true);

  console.log(JSON.stringify({
    runId, masterSeed, seasons, rounds, bo, repeats, sets,
    totalGames, playedGames, rematches, retries, plansBalanced: report.audit.plansBalanced,
    elapsedMs: Date.now() - started,
    champion: champion ? { name: champion.name, members: champion.players.map(p => p.model), gameRate: champion.gameRate, avgRank: champion.avgRank, titles: champion.titles } : null,
    top3: aggregate.slice(0, 3).map(row => ({ rank: row.rank, name: teams.find(t => t.id === row.id).name, gameRate: row.gameRate, mp: row.mp, avgRank: row.avgRank })),
    zScore: stats.zScore, significant95: stats.significant95
  }, null, 2));
  console.log(`报告：${path.join(OUT_DIR, `${runId}.md`)}`);
}

await main().catch(error => {
  console.error('[team-tournament] 失败：', error);
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const progress = fs.existsSync(PROGRESS_FILE) ? JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')) : {};
    writeText(PROGRESS_FILE, JSON.stringify({ ...progress, status: 'error', error: error.message, updatedAt: new Date().toISOString() }, null, 2));
  } catch {}
  process.exitCode = 1;
});
