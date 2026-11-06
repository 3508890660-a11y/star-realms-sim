import { performance } from 'node:perf_hooks';
import { createGame, describeAction } from './engine.js';
import { randomFrom } from './rng.js';
import { loadScript, deepFreeze } from '../ai/loader.js';

export class MatchRunner {
  constructor(config, modules) {
    this.config = config;
    this.game = createGame(config);
    this.modules = modules;
    this.memory = config.players.map(() => ({}));
    this.random = config.players.map((_, i) => randomFrom(`${config.seed ?? 'star-realms'}:ai:${i}`));
    this.actions = [];
    this.actionCount = 0;
  }

  static async create(config) {
    const modules = await Promise.all(config.players.map(player => loadScript(player.script || 'tactical')));
    return new MatchRunner(config, modules);
  }

  actorId() {
    return this.game.state.pending ? this.game.state.pending.player : this.game.state.activePlayer;
  }

  async step() {
    const state = this.game.state;
    if (state.status !== 'playing') return null;
    const playerId = this.actorId();
    const module = this.modules[playerId];
    if (!module) return null;
    const legalActions = this.game.legalActions();
    const view = this.game.getView(playerId);
    const started = performance.now();
    let timeout;
    try {
      const action = await Promise.race([
        Promise.resolve(module.chooseAction({
          view: deepFreeze(view),
          legalActions: deepFreeze(legalActions),
          playerId,
          random: this.random[playerId],
          memory: this.memory[playerId],
          context: Object.freeze({ mode: state.mode, turn: state.turn, seed: state.seed })
        })),
        new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`玩家 ${playerId + 1} 的脚本超过 3000ms 未返回`)), 3000); })
      ]);
      return this.commit(playerId, action, performance.now() - started);
    } finally {
      clearTimeout(timeout);
    }
  }

  commit(playerId, action, durationMs = 0) {
    const events = this.game.applyAction(action);
    const record = {
      index: this.actionCount++, playerId, action,
      description: describeAction(this.game.state, action),
      durationMs: Math.round(durationMs * 100) / 100,
      events
    };
    this.actions.push(record);
    return record;
  }

  async runToEnd(maxActions = 100000, onAction) {
    while (this.game.state.status === 'playing' && this.actionCount < maxActions) {
      if (this.modules[this.actorId()] === null) throw new Error(`玩家 ${this.actorId() + 1} 是人类座位，无法自动跑完`);
      const record = await this.step();
      if (onAction) await onAction(record);
    }
    if (this.game.state.status === 'playing') throw new Error(`对局超过 ${maxActions} 个动作，已中止`);
    return this.result();
  }

  result() {
    return {
      seed: this.game.state.seed,
      mode: this.game.state.mode,
      sets: this.game.state.expansions.sets,
      winningTeam: this.game.state.winningTeam,
      winner: this.game.state.winner,
      winnerName: this.game.state.winner === null ? null : this.game.state.players[this.game.state.winner].name,
      turns: this.game.state.turn,
      actions: this.actionCount,
      authorities: this.game.state.players.map(player => player.authority),
      scripts: this.config.players.map(player => player.script || 'tactical')
    };
  }

  replay() {
    return {
      format: 'star-realms-sim-replay', version: 1,
      config: this.config,
      actions: this.actions.map(({ playerId, action }) => ({ playerId, action })),
      result: this.result()
    };
  }
}

export async function playReplay(replay) {
  if (replay.format !== 'star-realms-sim-replay') throw new Error('不是有效的回放文件');
  const game = createGame(replay.config);
  for (const [index, entry] of replay.actions.entries()) {
    const expected = game.state.pending ? game.state.pending.player : game.state.activePlayer;
    if (entry.playerId !== expected) throw new Error(`回放第 ${index + 1} 步座位不一致`);
    game.applyAction(entry.action);
  }
  return game;
}
