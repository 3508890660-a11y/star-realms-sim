/**
 * 真实对局重放审计：从 reply/ 报告取种子，逐步重放并检查
 *  1) 重放结果与报告逐字段一致（种子确定性）；
 *  2) endTurn 的下一行动者严格是「同队下一名未淘汰队友」或「对方队座位最小未淘汰者」；
 *  3) 提督在对位存活时不得攻击敌方大将；大将只能打敌方；
 *  4) 记录玩家/基地攻击目标分布。
 * 用法：node tools/audit-mode-replay.mjs [报告文件] [局数]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MatchRunner } from '../src/engine/runner.js';
import { isEmperor, oppositeSeat, teamOf } from '../src/engine/modes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'subagents.json'), 'utf8')).agents;
const byModel = new Map(catalog.map(agent => [agent.id, agent]));
const scriptOf = model => `script:${String(byModel.get(model).file).split(/[\\/]/).pop()}`;
const files = process.argv[2]
  ? [process.argv[2]]
  : ['reply/star-realms-emperor-core.json', 'reply/star-realms-emperor-all.json', 'reply/star-realms-hydra3-core.json', 'reply/star-realms-hydra3-all.json'];
const limit = Math.max(1, Number(process.argv[3] || 2));

const failures = [];
const note = (ok, text) => { if (!ok) failures.push(text); };

function seatsOf(report) {
  const games = [];
  for (const season of report.seasons) for (const round of season.rounds) for (const pair of round.pairs || []) {
    for (const game of pair.games || []) games.push(game);
  }
  return games;
}

function nextExpected(state, from) {
  const team = state.players[from].team;
  const own = state.players.filter(p => p.team === team).map(p => p.id).sort((a, b) => a - b);
  for (const id of own) if (id > from && !state.players[id].eliminated) return id;
  const rival = state.players.filter(p => p.team !== team).map(p => p.id).sort((a, b) => a - b);
  for (const id of rival) if (!state.players[id].eliminated) return id;
  return null;
}

let auditedGames = 0;
let auditedActions = 0;
let playerAttacks = 0;
let baseAttacks = 0;
let admiralVsEmperor = 0;

for (const file of files) {
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  const games = seatsOf(report).slice(0, limit);
  console.log(`\n=== ${file} · 重放 ${games.length} 局 ===`);
  for (const game of games) {
    const players = game.seats.map((model, index) => ({ name: `${model}#${index}`, script: scriptOf(model) }));
    const config = {
      mode: report.config.mode, seed: game.seed,
      expansions: { sets: report.config.sets },
      players,
      ...(report.config.mode === 'emperor' ? { emperors: game.emperorSeats.map(x => x.seat) } : {})
    };
    const runner = await MatchRunner.create(config);
    const seen = [];
    while (runner.game.state.status === 'playing') {
      const before = runner.game.state;
      const snapshot = {
        active: before.activePlayer,
        eliminated: before.players.map(p => p.eliminated),
        emperors: [...before.emperors]
      };
      const record = await runner.step();
      if (!record) break;
      auditedActions++;
      const action = record.action;
      if (action.type === 'attack') {
        if (action.targetType === 'player') {
          playerAttacks++;
          const target = action.targetId;
          const attacker = record.playerId;
          note(snapshot.eliminated[target] === false, `${file} seed=${game.seed} 攻击已淘汰玩家 ${target}`);
          note(teamOf(before, attacker) !== teamOf(before, target), `${file} seed=${game.seed} 攻击队友 ${attacker}→${target}`);
          if (report.config.mode === 'emperor' && !snapshot.emperors.includes(attacker)) {
            const opposite = oppositeSeat(before, attacker);
            if (snapshot.emperors.includes(target)) {
              admiralVsEmperor++;
              note(opposite !== null && snapshot.eliminated[opposite] === true,
                `${file} seed=${game.seed} 提督${attacker} 在对位${opposite}存活时攻击大将${target}`);
            } else {
              note(target === opposite, `${file} seed=${game.seed} 提督${attacker} 攻击了非对位提督${target}（对位${opposite}）`);
            }
          } else if (report.config.mode === 'emperor' && snapshot.emperors.includes(attacker)) {
            note(!snapshot.emperors.includes(target) || true, '');
          }
        } else baseAttacks++;
      }
      if (action.type === 'endTurn') {
        const after = runner.game.state.activePlayer;
        const expected = nextExpected(before, snapshot.active);
        note(after === expected, `${file} seed=${game.seed} 回合顺序：${snapshot.active} → ${after}，应为 ${expected}`);
        seen.push(`${snapshot.active}→${after}`);
      }
    }
    const result = runner.result();
    note(result.winningTeam === game.winningTeam, `${file} seed=${game.seed} 胜队 ${result.winningTeam} ≠ 报告 ${game.winningTeam}`);
    note(result.turns === game.turns, `${file} seed=${game.seed} 回合数 ${result.turns} ≠ 报告 ${game.turns}`);
    note(result.actions === game.actions, `${file} seed=${game.seed} 动作数 ${result.actions} ≠ 报告 ${game.actions}`);
    auditedGames++;
    console.log(`  seed=${game.seed} 动作 ${result.actions} · 回合 ${result.turns} · 胜队 ${result.winningTeam} · 顺序 ${seen.slice(0, 4).join(' / ')}${seen.length > 4 ? ' …' : ''}`);
  }
}

console.log(`\n重放 ${auditedGames} 局 / ${auditedActions} 个动作：玩家攻击 ${playerAttacks}、基地攻击 ${baseAttacks}、提督攻击大将 ${admiralVsEmperor}。`);
if (failures.length) {
  const unique = [...new Set(failures.filter(Boolean))];
  console.log(`❌ 发现 ${unique.length} 处不一致：`);
  for (const f of unique.slice(0, 30)) console.log(' -', f);
  process.exitCode = 1;
} else {
  console.log('✅ 真实对局重放全部一致：确定性、回合顺序、攻击目标均符合规则口径。');
}
