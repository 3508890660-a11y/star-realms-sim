import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MatchRunner } from '../engine/runner.js';
import { listScripts } from '../ai/loader.js';
import { MODES, validateMode } from '../engine/modes.js';
import { EXPANSION_PACKS, normalizeExpansions } from '../engine/cards.js';
import { buildTeams } from '../engine/team-swiss.js';
import { createCodeStamp } from './code-stamp.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'public');
const SUBAGENT_CATALOG = path.join(ROOT, 'subagents.json');
const SUBAGENT_PROGRESS = path.join(ROOT, 'subagent-progress');
const PORT = Number(process.env.PORT || 4397);
// 启动后若这些文件被改动，说明内存里跑的是旧代码；界面据此提示重启。
const staleCode = createCodeStamp({
  root: ROOT,
  files: [
    'src/engine/engine.js', 'src/engine/modes.js', 'src/engine/cards.js',
    'src/engine/expansions.js', 'src/engine/expansions-extra.js', 'src/engine/runner.js',
    'src/server/server.js', 'src/server/code-stamp.js', 'public/app.js', 'public/index.html'
  ]
});
const TOURNEY_DIR = path.join(ROOT, 'tournaments');
const TOURNEY_CLI = path.join(ROOT, 'src', 'tourney-cli.js');
const TEAM_CLI = path.join(ROOT, 'src', 'team-tourney-cli.js');
const TEAM_PROGRESS_FILE = path.join(TOURNEY_DIR, 'team-progress.json');
const TEAM_LATEST_FILE = path.join(TOURNEY_DIR, 'team-latest.json');
const LAB_DIR = path.join(ROOT, 'reply');
const LAB_RUNS = Object.freeze([
  { key: 'clone-core', file: 'star-realms-2v2-clone-core.json', experiment: 'clone', sets: 'core', group: '2v2' },
  { key: 'clone-all', file: 'star-realms-2v2-clone-all.json', experiment: 'clone', sets: 'all', group: '2v2' },
  { key: 'random-core', file: 'star-realms-2v2-random-core.json', experiment: 'random', sets: 'core', group: '2v2' },
  { key: 'random-all', file: 'star-realms-2v2-random-all.json', experiment: 'random', sets: 'all', group: '2v2' },
  { key: 'hydra3-core', file: 'star-realms-hydra3-core.json', experiment: 'hydra3', mode: 'hydra3', sets: 'core', group: '3v3' },
  { key: 'hydra3-all', file: 'star-realms-hydra3-all.json', experiment: 'hydra3', mode: 'hydra3', sets: 'all', group: '3v3' },
  { key: 'hydra3-clone-core', file: 'star-realms-3v3-clone-hydra3-core.json', experiment: 'clone', mode: 'hydra3', sets: 'core', group: '3v3' },
  { key: 'hydra3-clone-all', file: 'star-realms-3v3-clone-hydra3-all.json', experiment: 'clone', mode: 'hydra3', sets: 'all', group: '3v3' },
  { key: 'emperor-core', file: 'star-realms-emperor-core.json', experiment: 'emperor', mode: 'emperor', sets: 'core', group: '3v3' },
  { key: 'emperor-all', file: 'star-realms-emperor-all.json', experiment: 'emperor', mode: 'emperor', sets: 'all', group: '3v3' },
  { key: 'emperor-clone-core', file: 'star-realms-3v3-clone-emperor-core.json', experiment: 'clone', mode: 'emperor', sets: 'core', group: '3v3' },
  { key: 'emperor-clone-all', file: 'star-realms-3v3-clone-emperor-all.json', experiment: 'clone', mode: 'emperor', sets: 'all', group: '3v3' }
]);
const subagentClients = new Set();
let activeTournament = null;
let activeTeamTournament = null;

function readJsonIfExists(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

let tournamentCache = { mtime: 0, file: '', result: null };
function readTournamentResult() {
  const file = path.join(TOURNEY_DIR, 'latest.json');
  let mtime = 0;
  try { mtime = fs.statSync(file).mtimeMs; } catch { return null; }
  if (tournamentCache.file !== file || tournamentCache.mtime !== mtime) {
    const full = readJsonIfExists(file);
    tournamentCache = { mtime, file, result: full ? briefTournament(full) : null };
  }
  return tournamentCache.result;
}

// 看板只需要榜单与 BO10 胜负串；逐局明细留在完整报告里，避免每 1.5s 传输数 MB。
function briefTournament(full) {
  const half = (full.config.perSide || 5);
  return {
    format: full.format, version: full.version, file: full.file,
    config: full.config, entrants: full.entrants, aggregate: full.aggregate,
    champion: full.champion, stats: full.stats, audit: full.audit,
    generatedAt: full.generatedAt,
    seasons: full.seasons.map(season => ({
      index: season.index, seed: season.seed, champion: season.champion,
      audit: season.audit, standings: season.standings,
      rounds: season.rounds.map(round => ({
        round: round.round, order: round.order, bye: round.bye,
        pairs: round.pairs.map(match => ({
          a: match.a, b: match.b, aWins: match.aWins, bWins: match.bWins,
          mpA: match.mpA, mpB: match.mpB, rematch: match.rematch,
          sameScore: match.sameScore, scoreGap: match.scoreGap,
          games: match.games.map(game => ({ winnerId: game.winnerId })),
          half
        }))
      }))
    }))
  };
}

function readTournament() {
  const progress = readJsonIfExists(path.join(TOURNEY_DIR, 'progress.json'));
  const result = readTournamentResult();
  const fresh = progress?.status === 'running' && Date.now() - Date.parse(progress.updatedAt || 0) < 60000;
  return { progress, result, running: Boolean(fresh), updatedAt: new Date().toISOString() };
}

// 2V2 组队赛使用独立的进度/结果文件，与 1v1 瑞士轮互不覆盖。
let teamTournamentCache = { mtime: 0, file: '', result: null };
function readTeamTournamentResult() {
  let mtime = 0;
  try { mtime = fs.statSync(TEAM_LATEST_FILE).mtimeMs; } catch { return null; }
  if (teamTournamentCache.file !== TEAM_LATEST_FILE || teamTournamentCache.mtime !== mtime) {
    const full = readJsonIfExists(TEAM_LATEST_FILE);
    teamTournamentCache = { mtime, file: TEAM_LATEST_FILE, result: full ? briefTeamTournament(full) : null };
  }
  return teamTournamentCache.result;
}

function briefTeamTournament(full) {
  return {
    format: full.format, version: full.version, file: full.file,
    config: full.config, teams: full.teams, aggregate: full.aggregate,
    champion: full.champion, stats: full.stats, audit: full.audit,
    memberStats: full.memberStats, generatedAt: full.generatedAt,
    seasons: full.seasons.map(season => ({
      index: season.index, seed: season.seed, champion: season.champion,
      audit: season.audit, standings: season.standings,
      rounds: season.rounds.map(round => ({
        round: round.round, order: round.order, bye: round.bye,
        pairs: round.pairs.map(match => ({
          a: match.a, b: match.b, aWins: match.aWins, bWins: match.bWins,
          mpA: match.mpA, mpB: match.mpB, rematch: match.rematch,
          sameScore: match.sameScore, scoreGap: match.scoreGap,
          games: match.games.map(game => ({
            winnerId: game.winnerId, frontTeam: game.frontTeam,
            first: game.first, arrangement: game.arrangement
          }))
        }))
      }))
    }))
  };
}

// 没有赛果时也把 6 支队伍的构成交给界面展示。
function readTeamCatalog() {
  try {
    const catalog = readJsonIfExists(SUBAGENT_CATALOG);
    return catalog?.agents ? buildTeams(catalog.agents) : [];
  } catch { return []; }
}

function readTeamTournament() {
  const progress = readJsonIfExists(TEAM_PROGRESS_FILE);
  const result = readTeamTournamentResult();
  const fresh = progress?.status === 'running' && Date.now() - Date.parse(progress.updatedAt || 0) < 60000;
  return {
    progress, result, running: Boolean(fresh),
    teams: result?.teams || readTeamCatalog(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 2V2 实验室看板：只读 reply/ 下四份已落盘报告。
 * 逐局明细（3MB 级）不进看板，只保留榜单与账目；mtime 签名变化时才重新解析。
 */
let labCache = { signature: '', result: null };

function briefLabRun(full, entry) {
  return {
    key: entry.key, experiment: entry.experiment, mode: entry.mode || full.config?.mode || null,
    sets: entry.sets, group: entry.group || '2v2',
    file: full.file, generatedAt: full.generatedAt,
    config: full.config, audit: full.audit, stats: full.stats,
    teams: (full.teams || []).map(team => ({
      id: team.id, name: team.name, kind: team.kind, vendor: team.vendor,
      players: (team.players || []).map(player => ({ id: player.id, model: player.model, display: player.display }))
    })),
    aggregate: full.aggregate || null,
    champion: full.champion || null,
    members: (full.members || []).map(row => {
      const { partnerCounts, opponentCounts, ...rest } = row;
      return rest;
    }),
    contribution: full.contribution || null,
    // 看板只展示「各届冠军 + 随机组队名单」；逐轮逐局明细留在可下载的完整报告里。
    // 每届只保留第一名，队伍名单只保留显示名，避免 12 份报告把看板撑到 500KB 以上。
    seasons: (full.seasons || []).map(season => ({
      index: season.index, seed: season.seedSeed || season.seed, champion: season.champion,
      audit: season.audit,
      teamRoster: full.config?.experiment === 'clone' || !season.teamRoster ? null : season.teamRoster.map(team => ({
        id: team.id, name: team.name,
        players: (team.players || []).map(player => ({ display: player.display }))
      })),
      standings: (season.standings || []).slice(0, 1).map(row => ({
        rank: row.rank, id: row.id, mp: row.mp, gameWins: row.gameWins,
        games: row.games, gameRate: row.gameRate,
        buchholz: row.buchholz, sb: row.sb
      }))
    }))
  };
}

function buildLabSummary(runs) {
  const winners = runs.filter(run => !run.missing).map(run => {
    const id = run.experiment === 'clone'
      ? run.teams?.find(team => team.id === run.aggregate?.[0]?.id)?.players?.[0]?.model
      : run.contribution?.rows?.[0]?.id;
    return { key: run.key, experiment: run.experiment, sets: run.sets, group: run.group || '2v2', id: id || null };
  });
  const ids = [...new Set(winners.map(w => w.id).filter(Boolean))];
  return { winners, consistent: winners.length > 0 && ids.length === 1, championId: ids.length === 1 ? ids[0] : null };
}

function readLab() {
  const entries = LAB_RUNS.map(run => {
    const file = path.join(LAB_DIR, run.file);
    let mtime = 0;
    try { mtime = fs.statSync(file).mtimeMs; } catch { return { ...run, file, mtime: 0, missing: true }; }
    return { ...run, file, mtime, missing: false };
  });
  const signature = entries.map(entry => `${entry.key}:${entry.mtime}`).join('|');
  if (labCache.signature === signature) return labCache.result;

  const catalog = JSON.parse(fs.readFileSync(SUBAGENT_CATALOG, 'utf8')).agents;
  const models = Object.fromEntries(catalog.map(agent => [agent.id, {
    model: agent.model, strategy: agent.strategy, file: agent.file
  }]));
  const runs = entries.map(entry => entry.missing
    ? { key: entry.key, experiment: entry.experiment, mode: entry.mode || null, sets: entry.sets, group: entry.group || '2v2', missing: true }
    : briefLabRun(readJsonIfExists(entry.file) || {}, entry));
  const result = {
    format: 'star-realms-sim-2v2-lab-board', version: 1,
    runs, models,
    summary: buildLabSummary(runs),
    updatedAt: new Date().toISOString()
  };
  labCache = { signature, result };
  return result;
}

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

function readSubagents() {
  const catalog = JSON.parse(fs.readFileSync(SUBAGENT_CATALOG, 'utf8'));
  const agents = catalog.agents.map(agent => {
    const progressFile = path.join(SUBAGENT_PROGRESS, `${agent.id}.json`);
    const progress = fs.existsSync(progressFile) ? JSON.parse(fs.readFileSync(progressFile, 'utf8')) : {};
    const designFile = path.join(SUBAGENT_PROGRESS, `${agent.id}.md`);
    const designNote = fs.existsSync(designFile) ? fs.readFileSync(designFile, 'utf8') : '';
    const fileExists = fs.existsSync(path.join(ROOT, agent.file));
    return {
      ...agent, ...progress, fileExists, designNote,
      status: progress.status || agent.status || 'queued',
      progress: Number.isFinite(progress.progress) ? progress.progress : agent.progress || 0,
      phase: progress.phase || agent.phase || '排队中'
    };
  });
  return {
    title: catalog.title,
    note: catalog.note,
    agents,
    updatedAt: new Date().toISOString(),
    summary: {
      total: agents.length,
      completed: agents.filter(a => a.status === 'completed').length,
      running: agents.filter(a => a.status === 'running').length,
      queued: agents.filter(a => a.status === 'queued').length,
      errors: agents.filter(a => a.status === 'error').length
    }
  };
}

let subagentBroadcastTimer;
function broadcastSubagents() {
  clearTimeout(subagentBroadcastTimer);
  subagentBroadcastTimer = setTimeout(() => {
    const payload = `event: agents\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`;
    for (const client of subagentClients) client.write(payload);
  }, 80);
}
if (fs.existsSync(SUBAGENT_PROGRESS)) fs.watch(SUBAGENT_PROGRESS, broadcastSubagents);
fs.watch(SUBAGENT_CATALOG, broadcastSubagents);

class LiveMatch {
  constructor() {
    this.clients = new Set();
    this.runner = null;
    this.paused = true;
    this.speed = 350;
    this.running = false;
    this.error = null;
  }

  async create(config) {
    validateMode(config.mode, config.players.length);
    if (!config.players.every(player => typeof player.name === 'string' && typeof player.script === 'string')) throw new Error('座位配置不完整');
    this.stop();
    const normalized = normalizeExpansions(config);
    this.runner = await MatchRunner.create({ ...config, seed: String(config.seed || Date.now()), mode: config.mode, players: config.players, expansions: normalized });
    this.paused = config.autoRun === false;
    this.speed = Math.max(0, Math.min(3000, Number(config.speed ?? 350)));
    this.error = null;
    this.broadcast('created');
    this.kick();
  }

  stop() {
    this.paused = true;
    for (const client of this.clients) client.end();
    this.clients.clear();
  }

  snapshot(perspective = 'spectator') {
    if (!this.runner) return { state: null, scripts: [] };
    const state = this.runner.game.getView(perspective);
    const actor = this.runner.actorId();
    const canAct = perspective !== 'spectator' && Number(perspective) === actor && this.runner.modules[actor] === null && state.status === 'playing';
    return {
      state,
      legalActions: canAct ? this.runner.game.legalActions() : [],
      actor,
      waitingForHuman: state.status === 'playing' && this.runner.modules[actor] === null,
      paused: this.paused,
      speed: this.speed,
      error: this.error,
      result: this.runner.result(),
      history: this.runner.actions.slice(-250).map(record => ({ index: record.index, playerId: record.playerId, description: record.description, durationMs: record.durationMs, events: record.events })),
      config: this.runner.config,
      codeStale: staleCode()
    };
  }

  async control(command, value) {
    if (!this.runner) throw new Error('尚未创建对局');
    if (command === 'pause') this.paused = true;
    else if (command === 'resume') { this.paused = false; this.error = null; }
    else if (command === 'speed') this.speed = Math.max(0, Math.min(3000, Number(value)));
    else if (command === 'step') {
      if (!this.paused) throw new Error('请先暂停再单步');
      if (this.runner.modules[this.runner.actorId()] !== null) await this.stepOnce();
    } else throw new Error(`未知控制命令 ${command}`);
    this.broadcast(command);
    this.kick();
  }

  async humanAction(playerId, action) {
    if (!this.runner) throw new Error('尚未创建对局');
    if (this.runner.actorId() !== Number(playerId) || this.runner.modules[playerId] !== null) throw new Error('当前不是该人类座位的决策时点');
    this.runner.commit(Number(playerId), action);
    this.broadcast('humanAction');
    this.kick();
  }

  async stepOnce() {
    if (this.running || !this.runner || this.runner.game.state.status !== 'playing') return;
    this.running = true;
    try {
      await this.runner.step();
      this.error = null;
    } catch (error) {
      this.error = error.message;
      this.paused = true;
      console.error('[match]', error);
    } finally {
      this.running = false;
    }
  }

  kick() {
    if (this.kickTimer || this.paused || this.running || !this.runner || this.runner.game.state.status !== 'playing') return;
    if (this.runner.modules[this.runner.actorId()] === null) return;
    this.kickTimer = setTimeout(async () => {
      this.kickTimer = null;
      await this.stepOnce();
      this.broadcast('action');
      this.kick();
    }, this.speed);
    this.kickTimer.unref();
  }

  sse(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: match\ndata: {"reason":"connected"}\n\n`);
    this.clients.add(res);
    req.on('close', () => this.clients.delete(res));
  }

  broadcast(reason) {
    const payload = `event: match\ndata: ${JSON.stringify({ reason, at: Date.now() })}\n\n`;
    for (const client of this.clients) client.write(payload);
  }
}

const live = new LiveMatch();
await live.create({ mode: 'standard', seed: 'welcome', autoRun: false, speed: 350, players: [{ name: '战术核心', script: 'tactical' }, { name: '贸易演算', script: 'economic' }] });

function json(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...headers });
  res.end(body);
}

async function body(req) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 1_000_000) throw new Error('请求过大');
  }
  return text ? JSON.parse(text) : {};
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(PUBLIC, relative);
  if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/health') return json(res, 200, { ok: true, version: 2 });
    if (url.pathname === '/api/options') return json(res, 200, { modes: Object.entries(MODES).map(([id, mode]) => ({ id, ...mode })), expansions: EXPANSION_PACKS, codeStale: staleCode() });
    if (url.pathname === '/api/subagents') return json(res, 200, readSubagents());
    if (url.pathname === '/api/subagents/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(`event: agents\ndata: {"reason":"connected"}\n\n`);
      subagentClients.add(res);
      req.on('close', () => subagentClients.delete(res));
      return;
    }
    if (url.pathname === '/api/scripts') return json(res, 200, await listScripts());
    if (url.pathname === '/api/tournament') return json(res, 200, readTournament());
    if (url.pathname === '/api/tournament/full') return json(res, 200, readJsonIfExists(path.join(TOURNEY_DIR, 'latest.json')) || { error: '尚无完整报告' }, { 'Content-Disposition': 'attachment; filename="star-realms-swiss-report.json"' });
    if (url.pathname === '/api/tournament/start' && req.method === 'POST') {
      const input = await body(req);
      if (readTournament().running || activeTournament) return json(res, 409, { error: '已有锦标赛正在运行，请等待其完成' });
      const seed = String(input.seed || `swiss-${Date.now()}`).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64) || 'swiss';
      const seasons = clampInt(input.seasons, 1, 24, 3);
      const rounds = clampInt(input.rounds, 1, 11, 5);
      const perSide = clampInt(input.perSide, 1, 10, 5);
      const allowed = ['core', 'colonyWars', 'events'];
      const sets = Array.isArray(input.sets) ? [...new Set(input.sets.filter(x => allowed.includes(x)))] : ['core'];
      if (!sets.length) sets.push('core');
      const runId = `web-${Date.now()}`;
      const bo = perSide * 2;
      const matchesPerRound = 6;
      const config = { masterSeed: seed, seasons, rounds, perSide, bo, sets, entrantCount: 12, matchesPerRound, runId };
      fs.mkdirSync(TOURNEY_DIR, { recursive: true });
      const progressFile = path.join(TOURNEY_DIR, 'progress.json');
      // 先写入 running 状态：消除「已受理但 CLI 尚未首次落盘」的空窗，也让界面立刻显示进度。
      fs.writeFileSync(progressFile, JSON.stringify({
        runId, status: 'running', config,
        totalGames: seasons * rounds * matchesPerRound * bo, playedGames: 0,
        totalMatches: seasons * rounds * matchesPerRound, playedMatches: 0,
        season: 1, round: 1, currentMatch: null, lastGame: null,
        standings: [], seasons: [], champion: null,
        startedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
      const log = fs.openSync(path.join(TOURNEY_DIR, `${runId}.log`), 'w');
      const child = spawn(process.execPath, [
        TOURNEY_CLI, '--seed', seed, '--seasons', String(seasons), '--rounds', String(rounds),
        '--per-side', String(perSide), '--sets', sets.join(','), '--run-id', runId
      ], { cwd: ROOT, stdio: ['ignore', log, log] });
      activeTournament = child;
      child.on('exit', code => {
        try { fs.closeSync(log); } catch {}
        if (activeTournament === child) activeTournament = null;
        if (code !== 0) {
          console.error(`[tournament] ${runId} 退出码 ${code}`);
          try {
            const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
            if (progress.runId === runId && progress.status === 'running') {
              progress.status = 'error';
              progress.error = `锦标赛进程退出码 ${code}，详见 ${runId}.log`;
              progress.updatedAt = new Date().toISOString();
              fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf8');
            }
          } catch {}
        }
      });
      child.on('error', error => {
        if (activeTournament === child) activeTournament = null;
        console.error('[tournament]', error);
        try {
          const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
          progress.status = 'error';
          progress.error = error.message;
          progress.updatedAt = new Date().toISOString();
          fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2), 'utf8');
        } catch {}
      });
      return json(res, 200, { ok: true, runId, config: { seed, seasons, rounds, perSide, bo, sets } });
    }
    // 2V2 实验室：只读看板 + 单场完整报告下载（run 必须命中白名单，不拼接用户输入路径）。
    if (url.pathname === '/api/lab') return json(res, 200, readLab());
    if (url.pathname === '/api/lab/full') {
      const key = String(url.searchParams.get('run') || '');
      const entry = LAB_RUNS.find(run => run.key === key);
      if (!entry) return json(res, 400, { error: '未知的实验室赛事' });
      const body = readJsonIfExists(path.join(LAB_DIR, entry.file));
      if (!body) return json(res, 404, { error: '该场报告尚未生成' });
      return json(res, 200, body, { 'Content-Disposition': `attachment; filename="${entry.file}"` });
    }
    if (url.pathname === '/api/team-tournament') return json(res, 200, readTeamTournament());
    if (url.pathname === '/api/team-tournament/full') return json(res, 200, readJsonIfExists(TEAM_LATEST_FILE) || { error: '尚无完整组队赛报告' }, { 'Content-Disposition': 'attachment; filename="star-realms-team-swiss-report.json"' });
    if (url.pathname === '/api/team-tournament/start' && req.method === 'POST') {
      const input = await body(req);
      if (readTeamTournament().running || activeTeamTournament) return json(res, 409, { error: '已有组队赛正在运行，请等待其完成' });
      const seed = String(input.seed || `team-swiss-${Date.now()}`).replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64) || 'team-swiss';
      const seasons = clampInt(input.seasons, 1, 24, 3);
      const rounds = clampInt(input.rounds, 1, 11, 5);
      const repeats = clampInt(input.repeats, 1, 4, 1);
      const allowed = ['core', 'colonyWars', 'events'];
      const sets = Array.isArray(input.sets) ? [...new Set(input.sets.filter(x => allowed.includes(x)))] : ['core'];
      if (!sets.length) sets.push('core');
      const runId = `team-web-${Date.now()}`;
      const bo = 8 * repeats;
      const matchesPerRound = 3;
      const config = { masterSeed: seed, seasons, rounds, repeats, bo, sets, teamCount: 6, matchesPerRound, mode: 'team2v2', runId };
      fs.mkdirSync(TOURNEY_DIR, { recursive: true });
      fs.writeFileSync(TEAM_PROGRESS_FILE, JSON.stringify({
        runId, status: 'running', config,
        totalGames: seasons * rounds * matchesPerRound * bo, playedGames: 0,
        totalMatches: seasons * rounds * matchesPerRound, playedMatches: 0,
        season: 1, round: 1, currentMatch: null, lastGame: null,
        standings: [], seasons: [], champion: null,
        startedAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
      const log = fs.openSync(path.join(TOURNEY_DIR, `${runId}.log`), 'w');
      const child = spawn(process.execPath, [
        TEAM_CLI, '--seed', seed, '--seasons', String(seasons), '--rounds', String(rounds),
        '--repeats', String(repeats), '--sets', sets.join(','), '--run-id', runId, '--quiet', 'true'
      ], { cwd: ROOT, stdio: ['ignore', log, log] });
      activeTeamTournament = child;
      const markError = message => {
        try {
          const progress = JSON.parse(fs.readFileSync(TEAM_PROGRESS_FILE, 'utf8'));
          if (progress.runId === runId && progress.status === 'running') {
            progress.status = 'error';
            progress.error = message;
            progress.updatedAt = new Date().toISOString();
            fs.writeFileSync(TEAM_PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf8');
          }
        } catch {}
      };
      child.on('exit', code => {
        try { fs.closeSync(log); } catch {}
        if (activeTeamTournament === child) activeTeamTournament = null;
        if (code !== 0) { console.error(`[team-tournament] ${runId} 退出码 ${code}`); markError(`组队赛进程退出码 ${code}，详见 ${runId}.log`); }
      });
      child.on('error', error => {
        if (activeTeamTournament === child) activeTeamTournament = null;
        console.error('[team-tournament]', error);
        markError(error.message);
      });
      return json(res, 200, { ok: true, runId, config: { seed, seasons, rounds, repeats, bo, sets } });
    }
    if (url.pathname === '/api/events') return live.sse(req, res);
    if (url.pathname === '/api/match' && req.method === 'GET') return json(res, 200, live.snapshot(url.searchParams.get('perspective') || 'spectator'));
    if (url.pathname === '/api/match' && req.method === 'POST') {
      await live.create(await body(req));
      return json(res, 200, live.snapshot('spectator'));
    }
    if (url.pathname === '/api/control' && req.method === 'POST') {
      const input = await body(req);
      await live.control(input.command, input.value);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/action' && req.method === 'POST') {
      const input = await body(req);
      await live.humanAction(input.playerId, input.action);
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/replay') {
      if (!live.runner) return json(res, 404, { error: '尚未创建对局' });
      return json(res, 200, live.runner.replay(), { 'Content-Disposition': 'attachment; filename="star-realms-replay.json"' });
    }
    if (serveStatic(res, url.pathname)) return;
    json(res, 404, { error: 'Not found' });
  } catch (error) {
    console.error('[http]', error);
    json(res, 400, { error: error.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Star Realms Simulator: http://127.0.0.1:${PORT}`);
  console.log('仅监听本机回环地址；用户脚本按可信本地代码执行。');
});
