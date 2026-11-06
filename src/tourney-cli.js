import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchRunner } from './engine/runner.js';
import { loadScript } from './ai/loader.js';
import { shuffleWithRandom, makeGameSeeds, pairRound, pairKey, matchScore, rankPlayers, aggregateSeasons } from './engine/swiss.js';
import { randomFrom } from './engine/rng.js';
import { normalizeExpansions } from './engine/cards.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'tournaments');
const PROGRESS_FILE = path.join(OUT_DIR, 'progress.json');
const LATEST_FILE = path.join(OUT_DIR, 'latest.json');

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

// Windows 下若另一进程正在读取目标文件，rename 覆盖会抛 EPERM。
// 直接覆盖写不会触发该限制；读端对半截 JSON 有容错。
function writeText(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function entrantsFromCatalog() {
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8'));
  return catalog.agents.map(agent => ({
    id: agent.id,
    model: agent.model,
    name: agent.name,
    strategy: agent.strategy,
    script: `script:${path.basename(agent.file)}`
  }));
}

async function playGame({ first, second, seed, expansions, maxActions }) {
  const config = {
    mode: 'standard', seed, expansions,
    players: [
      { name: first.model, script: first.script },
      { name: second.model, script: second.script }
    ]
  };
  const runner = await MatchRunner.create(config);
  const result = await runner.runToEnd(maxActions);
  if (result.winner === null) throw new Error(`对局 ${seed} 未分出胜负`);
  return {
    winnerId: result.winner === 0 ? first.id : second.id,
    turns: result.turns,
    actions: result.actions,
    authorities: result.authorities
  };
}

function labelOf(entrants, id) {
  return entrants.find(e => e.id === id)?.model || id;
}

/** Wilson score 置信区间，避免小样本下正态近似的越界。 */
function wilson(wins, games, z = 1.96) {
  if (!games) return [0, 0];
  const p = wins / games;
  const denominator = 1 + z * z / games;
  const center = (p + z * z / (2 * games)) / denominator;
  const margin = z * Math.sqrt(p * (1 - p) / games + z * z / (4 * games * games)) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function computeStats({ seasons, aggregate, entrants }) {
  const titles = {};
  for (const season of seasons) {
    const name = labelOf(entrants, season.champion);
    titles[name] = (titles[name] || 0) + 1;
  }
  let firstWins = 0;
  let total = 0;
  for (const season of seasons) {
    for (const round of season.rounds) {
      for (const match of round.pairs) {
        for (const game of match.games) {
          total++;
          if (game.winnerId === game.first) firstWins++;
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
    firstSideWins: firstWins,
    totalGames: total,
    firstSideRate: total ? +(firstWins / total).toFixed(4) : 0,
    championCI95: ci.map(x => +x.toFixed(4)),
    runnerUpCI95: ci2.map(x => +x.toFixed(4)),
    rateGap: +diff.toFixed(4),
    zScore: +(diff / se).toFixed(3),
    significant95: Math.abs(diff / se) >= 1.96
  };
}

function scoreLine(match, entrants) {
  const a = labelOf(entrants, match.a);
  const b = labelOf(entrants, match.b);
  const firstHalf = match.games.slice(0, match.games.length / 2).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  const secondHalf = match.games.slice(match.games.length / 2).map(g => g.winnerId === match.a ? 'A' : 'B').join('');
  return `${a} ${match.aWins}:${match.bWins} ${b} [A先 ${firstHalf} | B先 ${secondHalf}]`;
}

function markdownReport(report) {
  const { config, seasons, aggregate, champion } = report;
  const top = aggregate[0];
  const runnerUp = aggregate[1];
  const lines = [];
  lines.push(`# 12 模型 AI 瑞士轮锦标赛报告`);
  lines.push('');
  lines.push(`## 结论`);
  lines.push('');
  if (champion) {
    const gap = top && runnerUp ? `领先第二名 ${runnerUp.model} 的局胜率 ${((top.gameRate - runnerUp.gameRate) * 100).toFixed(2)} 个百分点` : '';
    lines.push(`**最强脚本：${champion.model}（${champion.strategy}）**，脚本 \`${champion.script}\`。` +
      `共 ${config.seasons} 届独立瑞士轮、每届 ${config.rounds} 轮、每场 BO${config.perSide * 2}（${config.perSide} 局先手 + ${config.perSide} 局后手），` +
      `累计 ${champion.games} 局、胜 ${champion.gameWins} 局，局胜率 ${(champion.gameRate * 100).toFixed(2)}%，` +
      `平均名次 ${champion.avgRank}，夺冠 ${champion.titles}/${config.seasons} 届，${gap}。`);
  } else lines.push('未产生有效冠军。');
  lines.push('');
  lines.push(`> 结论口径：聚合榜以**局胜率**为第一排序键（每场 BO${config.perSide * 2} 的局分比场分样本更细），` +
    `其次为累计场分、平均名次。单届名次用于瑞士轮配对，不作为跨届实力唯一依据。`);
  lines.push('');
  const stats = report.stats || {};
  lines.push('## 置信度与先后手核对');
  lines.push('');
  lines.push('| 项目 | 数值 |');
  lines.push('|---|---|');
  if (top) lines.push(`| 冠军 ${labelOf(report.entrants, top.id)} 局胜率 95% CI（Wilson） | [${(stats.championCI95?.[0] * 100).toFixed(2)}%, ${(stats.championCI95?.[1] * 100).toFixed(2)}%] |`);
  if (runnerUp) lines.push(`| 亚军 ${labelOf(report.entrants, runnerUp.id)} 局胜率 95% CI（Wilson） | [${(stats.runnerUpCI95?.[0] * 100).toFixed(2)}%, ${(stats.runnerUpCI95?.[1] * 100).toFixed(2)}%] |`);
  lines.push(`| 冠亚局胜率差 | ${(stats.rateGap * 100).toFixed(2)} 个百分点 |`);
  lines.push(`| 两比例近似 z 值 | ${stats.zScore}（|z| ≥ 1.96 才达到 95% 显著） |`);
  lines.push(`| 差异是否显著 | ${stats.significant95 ? '是' : '否 — 按赛制规则仍以局胜率判冠军，但实力可视为接近'} |`);
  lines.push(`| 先手方总胜率 | ${(stats.firstSideRate * 100).toFixed(2)}%（${stats.firstSideWins}/${stats.totalGames} 局） |`);
  lines.push(`| 各届冠军分布 | ${Object.entries(stats.championTitles || {}).map(([k, v]) => `${k} × ${v}`).join('；') || '—'} |`);
  lines.push('');
  lines.push('> 同一赛事内对局并非完全独立（对手强度由瑞士轮配对决定），Wilson 区间与两比例 z 检验只作近似参考；' +
    '「最强」指本赛制、本牌包、本组随机种子下的可复现排名，不等价于跨环境绝对实力。' +
    '先后手已按每场各 5 局严格配平，先手方总胜率可用于检验规则本身的先后手偏差。');
  lines.push('');
  lines.push('## 赛制与随机化');
  lines.push('');
  lines.push('| 项目 | 设定 |');
  lines.push('|---|---|');
  lines.push(`| 主种子 | \`${config.masterSeed}\` |`);
  lines.push(`| 届数 | ${config.seasons}（每届独立种子 \`<主种子>:sN\`，配对与局种子独立重掷） |`);
  lines.push(`| 每届轮数 | ${config.rounds}（瑞士轮，按场分配对） |`);
  lines.push(`| 每场 | BO${config.perSide * 2} = ${config.perSide} 局 A 先手 + ${config.perSide} 局 B 先手，每局独立随机种子 |`);
  lines.push(`| 牌包 | \`${config.sets.join(',')}\` |`);
  lines.push(`| 模式 | \`standard\` 标准双人 1v1 |`);
  lines.push(`| 参赛 | ${config.entrantCount} 个模型脚本 |`);
  lines.push('');
  lines.push('随机性由主种子派生，全部可复现：');
  lines.push('');
  lines.push('- `:entrants`：参赛名单初始随机排序；');
  lines.push('- `:pair:rN`：每轮同分组内随机排序（同分不打固定顺序）；');
  lines.push('- `:game-seeds`：为每一局生成独立随机种子，写入逐局记录；');
  lines.push('- `:tiebreak`：最终同分时的随机优先级。');
  lines.push('');
  lines.push('配对规则：按场分降序分组，同分组内随机排序后相邻配对；优先同分、尽量避免重赛，组内无未交手对手时允许跨分组浮动，仍无解才重赛。奇数人数时最低分轮空得 1 场分。');
  lines.push('');
  lines.push('计分：每场胜 1 场分 / 平 0.5 / 负 0；单届排名依次比较 场分 MP → 局胜 GP → Buchholz（对手场分和）→ Sonneborn–Berger → 随机优先级。');
  lines.push('');
  lines.push('## 账目守恒');
  lines.push('');
  lines.push('| 核对项 | 数值 |');
  lines.push('|---|---:|');
  lines.push(`| 每届轮数 | ${config.rounds} |`);
  lines.push(`| 每轮场次 | ${config.matchesPerRound}（${config.entrantCount} 人两两配对） |`);
  lines.push(`| 每场局数 | ${config.perSide * 2} |`);
  lines.push(`| 单届总局数 | ${config.rounds * config.matchesPerRound * config.perSide * 2} |`);
  lines.push(`| 全部届总局数 | ${report.audit.totalGames} |`);
  lines.push(`| 实际完成局数 | ${report.audit.playedGames} |`);
  lines.push(`| 每位脚本每届局数 | ${config.rounds * config.perSide * 2}（先手 ${config.rounds * config.perSide} / 后手 ${config.rounds * config.perSide}） |`);
  lines.push(`| 重赛场次 | ${report.audit.rematches} |`);
  lines.push(`| 异常重试局 | ${report.audit.retries} |`);
  lines.push('');
  lines.push('## 聚合总榜');
  lines.push('');
  lines.push('| 名次 | 模型 | 策略 | 夺冠 | 平均名次 | 局胜/总局 | 局胜率 | 累计场分 | 先手胜率 | 后手胜率 | 平均 Buchholz |');
  lines.push('|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of aggregate) {
    const e = report.entrants.find(x => x.id === row.id);
    lines.push(`| ${row.rank} | ${e.model} | ${e.strategy} | ${row.titles}/${config.seasons} | ${row.avgRank} | ${row.gameWins}/${row.games} | ${(row.gameRate * 100).toFixed(2)}% | ${row.mp} | ${(row.firstRate * 100).toFixed(1)}% | ${(row.secondRate * 100).toFixed(1)}% | ${row.avgBuchholz} |`);
  }
  lines.push('');
  for (const season of seasons) {
    lines.push(`## 第 ${season.index} 届（种子 \`${season.seed}\`）`);
    lines.push('');
    lines.push('| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |');
    lines.push('|---:|---|---:|---:|---:|---|---:|---:|');
    for (const row of season.standings) {
      const e = report.entrants.find(x => x.id === row.id);
      lines.push(`| ${row.rank} | ${e.model} | ${row.mp} | ${row.gameWins} | ${(row.gameRate * 100).toFixed(2)}% | ${row.matchWins}/${row.matchDraws}/${row.matchLosses} | ${row.buchholz} | ${row.sb} |`);
    }
    lines.push('');
    for (const round of season.rounds) {
      lines.push(`### 第 ${round.round} 轮`);
      lines.push('');
      lines.push(`同分随机排序后的配对顺序：${round.order.map(id => labelOf(report.entrants, id)).join(' → ')}`);
      lines.push('');
      for (const match of round.pairs) {
        lines.push(`- ${scoreLine(match, report.entrants)}${match.rematch ? '（重赛）' : ''}${match.sameScore ? '' : `（跨分组浮动 ${match.scoreGap}）`} → ${match.mpA === 1 ? labelOf(report.entrants, match.a) : match.mpA === 0 ? labelOf(report.entrants, match.b) : '平局'}`);
      }
      if (round.bye) lines.push(`- 轮空：${labelOf(report.entrants, round.bye)}`);
      lines.push('');
    }
  }
  lines.push('## 逐局明细');
  lines.push('');
  lines.push(`完整逐局记录（含每局随机种子、先后手、胜者、回合数、终局权威）见 \`${path.basename(report.file)}\` 的 \`seasons[].rounds[].pairs[].games\`。`);
  lines.push('任一局可用该局种子与两个脚本 ID 通过 `MatchRunner` 原样复现。');
  lines.push('');
  lines.push('## 复现命令');
  lines.push('');
  lines.push('```bash');
  lines.push(`node src/tourney-cli.js --seed ${config.masterSeed} --seasons ${config.seasons} --rounds ${config.rounds} --per-side ${config.perSide} --sets ${config.sets.join(',')}`);
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const masterSeed = String(args.seed || 'swiss-2026-11-05');
  const seasons = Math.max(1, Number(args.seasons || 1));
  const rounds = Math.max(1, Number(args.rounds || 5));
  const perSide = Math.max(1, Number(args['per-side'] || 5));
  const sets = String(args.sets || 'core').split(',').map(x => x.trim()).filter(Boolean);
  const maxActions = Number(args['max-actions'] || 100000);
  const runId = String(args['run-id'] || `${masterSeed.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`);
  const quiet = args.quiet === 'true';

  const entrants = entrantsFromCatalog();
  if (entrants.length !== 12) throw new Error(`参赛脚本应为 12 个，实际 ${entrants.length} 个`);
  for (const e of entrants) {
    if (!fs.existsSync(path.join(ROOT, 'scripts', e.script.slice(7)))) throw new Error(`脚本缺失：${e.script}`);
    await loadScript(e.script);
  }
  const expansions = normalizeExpansions({ expansions: { sets } });
  const matchesPerRound = Math.floor(entrants.length / 2);
  const bo = perSide * 2;
  const totalGames = seasons * rounds * matchesPerRound * bo;
  const config = { masterSeed, seasons, rounds, perSide, bo, sets, entrantCount: entrants.length, matchesPerRound, runId };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let playedGames = 0;
  let rematches = 0;
  let retries = 0;
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
  for (let s = 0; s < seasons; s++) {
    const seasonSeed = seasons > 1 ? `${masterSeed}:s${s + 1}` : masterSeed;
    const initialOrder = shuffleWithRandom(entrants, randomFrom(`${seasonSeed}:entrants`));
    const seedTable = makeGameSeeds(seasonSeed, rounds, matchesPerRound, perSide);
    const played = new Set();
    const standings = new Map(initialOrder.map(e => [e.id, { id: e.id, mp: 0 }]));
    const matches = [];
    const roundReports = [];

    progress.season = s + 1;
    for (let r = 0; r < rounds; r++) {
      const round = r + 1;
      const pairing = pairRound({
        standings: [...standings.values()],
        played, round, masterSeed: seasonSeed
      });
      const roundReport = { round, order: pairing.order, bye: pairing.bye, pairs: [] };
      progress.round = round;
      progress.standings = rankPlayers({ entrants: initialOrder, matches, masterSeed: seasonSeed });
      saveProgress(true);

      for (let m = 0; m < pairing.pairs.length; m++) {
        const pair = pairing.pairs[m];
        const a = initialOrder.find(e => e.id === pair.a);
        const b = initialOrder.find(e => e.id === pair.b);
        const seeds = seedTable[r][m];
        const games = [];
        progress.currentMatch = { round, match: m + 1, a: a.model, b: b.model, bo };
        saveProgress(true);

        for (let g = 0; g < bo; g++) {
          const aFirst = g < perSide;
          const first = aFirst ? a : b;
          const second = aFirst ? b : a;
          const seed = seeds[g];
          let outcome;
          try {
            outcome = await playGame({ first, second, seed, expansions, maxActions });
          } catch (error) {
            retries++;
            const retrySeed = `${seed}:retry`;
            outcome = await playGame({ first, second, seed: retrySeed, expansions, maxActions });
            outcome.seed = retrySeed;
          }
          const game = {
            game: g + 1, side: aFirst ? 'A' : 'B', seed: outcome.seed || seed,
            first: first.id, second: second.id, winnerId: outcome.winnerId,
            turns: outcome.turns, actions: outcome.actions, authorities: outcome.authorities
          };
          games.push(game);
          playedGames++;
          progress.lastGame = {
            season: s + 1, round, match: m + 1, game: g + 1,
            a: a.model, b: b.model, first: first.model, winner: labelOf(initialOrder, game.winnerId), seed: game.seed
          };
          saveProgress();
        }

        const aWins = games.filter(x => x.winnerId === a.id).length;
        const bWins = games.length - aWins;
        const score = matchScore(aWins, bWins, bo);
        const match = {
          round, match: m + 1, a: a.id, b: b.id,
          rematch: pair.rematch, sameScore: pair.sameScore, scoreGap: pair.scoreGap,
          ...score,
          games,
          firstWinsA: games.slice(0, perSide).filter(x => x.winnerId === a.id).length,
          firstGamesA: perSide,
          secondWinsA: games.slice(perSide).filter(x => x.winnerId === a.id).length,
          secondGamesA: perSide,
          firstWinsB: games.slice(perSide).filter(x => x.winnerId === b.id).length,
          firstGamesB: perSide,
          secondWinsB: games.slice(0, perSide).filter(x => x.winnerId === b.id).length,
          secondGamesB: perSide,
          turnsA: games.reduce((sum, x) => sum + x.turns, 0),
          turnsB: games.reduce((sum, x) => sum + x.turns, 0),
          actionsA: games.reduce((sum, x) => sum + x.actions, 0),
          actionsB: games.reduce((sum, x) => sum + x.actions, 0)
        };
        matches.push(match);
        roundReport.pairs.push(match);
        played.add(pairKey(a.id, b.id));
        if (pair.rematch) rematches++;
        standings.get(a.id).mp += score.mpA;
        standings.get(b.id).mp += score.mpB;

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
      index: s + 1, seed: seasonSeed, initialOrder: initialOrder.map(e => e.id),
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

  const aggregate = aggregateSeasons(seasonReports, entrants);
  const champion = aggregate[0] ? { ...aggregate[0], ...entrants.find(e => e.id === aggregate[0].id) } : null;
  const stats = computeStats({ seasons: seasonReports, aggregate, entrants });
  const report = {
    format: 'star-realms-swiss', version: 1,
    file: `${runId}.json`,
    config, entrants, seasons: seasonReports, aggregate, champion, stats,
    audit: {
      totalGames, playedGames,
      perEntrantGames: aggregate[0]?.games,
      rematches, retries,
      seasons: seasonReports.length,
      elapsedMs: Date.now() - started
    },
    generatedAt: new Date().toISOString()
  };

  writeText(path.join(OUT_DIR, `${runId}.json`), JSON.stringify(report, null, 2));
  writeText(LATEST_FILE, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `${runId}.md`), markdownReport(report), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'latest.md'), markdownReport(report), 'utf8');
  progress.status = 'completed';
  progress.champion = champion;
  progress.aggregate = aggregate;
  progress.reportFile = `${runId}.json`;
  saveProgress(true);

  console.log(JSON.stringify({
    runId, masterSeed, seasons, rounds, bo: config.bo, sets,
    totalGames, playedGames, rematches, retries,
    elapsedMs: Date.now() - started,
    champion: champion ? { model: champion.model, script: champion.script, gameRate: champion.gameRate, avgRank: champion.avgRank, titles: champion.titles } : null,
    top3: aggregate.slice(0, 3).map(row => ({ rank: row.rank, model: entrants.find(e => e.id === row.id).model, gameRate: row.gameRate, mp: row.mp, avgRank: row.avgRank }))
  }, null, 2));
  console.log(`报告：${path.join(OUT_DIR, `${runId}.md`)}`);
}

await main().catch(error => {
  console.error('[tournament] 失败：', error);
  try {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = PROGRESS_FILE;
    const progress = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    writeText(file, JSON.stringify({ ...progress, status: 'error', error: error.message, updatedAt: new Date().toISOString() }, null, 2));
  } catch {}
  process.exitCode = 1;
});
