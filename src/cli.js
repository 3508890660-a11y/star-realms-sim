import fs from 'node:fs';
import path from 'node:path';
import { MatchRunner, playReplay } from './engine/runner.js';
import { listScripts } from './ai/loader.js';

function argsOf(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) result[argv[i].slice(2)] = argv[++i];
    else result._.push(argv[i]);
  }
  return result;
}

function makeConfig(args) {
  const mode = args.mode || 'standard';
  const defaults = mode === 'team2v2' ? ['tactical', 'economic', 'random', 'tactical'] : mode === 'standard' ? ['tactical', 'random'] : ['tactical', 'economic', 'random', 'tactical'];
  const seats = args.seats ? args.seats.split(',') : mode === 'standard' ? [args.p1 || defaults[0], args.p2 || defaults[1]] : (args.p1 && args.p2 ? [args.p1, args.p2, args.p3 || defaults[2], args.p4 || defaults[3]].slice(0, mode === 'team2v2' ? 4 : Number(args.players || 3)) : defaults.slice(0, mode === 'team2v2' ? 4 : Number(args.players || 3)));
  const config = {
    mode,
    seed: args.seed || 'cli-demo',
    players: seats.map((script, i) => ({ name: `座位 ${i + 1}`, script }))
  };
  const sets = args.sets ? args.sets.split(',').map(x => x.trim()).filter(Boolean) : null;
  if (sets) config.expansions = { sets };
  else if (args.deck) {
    const deckSets = args.deck === 'mixed' ? ['core', 'colonyWars'] : [args.deck];
    if (args.events && args.events !== 'false') deckSets.push('events');
    config.expansions = { sets: deckSets };
  } else if (args.events && args.events !== 'false') config.expansions = { sets: ['core', 'events'] };
  return config;
}

async function play(args) {
  const config = makeConfig(args);
  const runner = await MatchRunner.create(config);
  await runner.runToEnd(Number(args.maxActions || 100000), record => {
    if (!args.quiet) {
      console.log(`#${String(record.index).padStart(4, '0')} T${runner.game.state.turn} P${record.playerId + 1} ${record.description}`);
      for (const event of record.events.filter(event => ['gameOver', 'eliminated'].includes(event.type))) console.log(`     ${event.message}`);
    }
  });
  console.log(JSON.stringify(runner.result(), null, 2));
  if (args.save) {
    const output = path.resolve(args.save);
    fs.writeFileSync(output, JSON.stringify(runner.replay(), null, 2));
    console.log(`回放已保存：${output}`);
  }
}

async function batch(args) {
  const games = Number(args.games || 20);
  const wins = {};
  const started = Date.now();
  let turns = 0;
  let actions = 0;
  for (let i = 0; i < games; i++) {
    const config = makeConfig({ ...args, seed: `${args.seed || 'batch'}-${i}` });
    if (i % 2 && config.players.length === 2) config.players.reverse();
    const runner = await MatchRunner.create(config);
    const result = await runner.runToEnd(Number(args.maxActions || 100000));
    const script = result.scripts[result.winner];
    wins[script] = (wins[script] || 0) + 1;
    turns += result.turns;
    actions += result.actions;
    if (!args.quiet) console.log(`${String(i + 1).padStart(3, '0')}/${games} 胜者=${result.winnerName}(${script}) 回合=${result.turns} 动作=${result.actions}`);
  }
  console.log(JSON.stringify({ games, wins, avgTurns: +(turns / games).toFixed(2), avgActions: +(actions / games).toFixed(1), elapsedMs: Date.now() - started }, null, 2));
}

const args = argsOf(process.argv.slice(2));
const command = args._[0] || 'play';
if (command === 'play') await play(args);
else if (command === 'batch') await batch(args);
else if (command === 'scripts') console.log(JSON.stringify(await listScripts(), null, 2));
else if (command === 'swiss') await import('./tourney-cli.js');
else if (command === 'replay') {
  const replay = JSON.parse(fs.readFileSync(path.resolve(args.file), 'utf8'));
  const game = await playReplay(replay);
  console.log(JSON.stringify({ status: game.state.status, winner: game.state.winner, turns: game.state.turn, actions: replay.actions.length }, null, 2));
} else {
  console.log(`用法：
  node src/cli.js play --mode standard --p1 tactical --p2 random --seed demo [--save replay.json]
  node src/cli.js batch --mode standard --p1 tactical --p2 economic --games 50
  node src/cli.js play --mode hunter --seats tactical,economic,random
  node src/cli.js play --mode team2v2 --seats tactical,economic,random,tactical --sets core,colonyWars,events
  node src/cli.js play --sets colonyWars,events --seed solo-set
  node src/cli.js replay --file replay.json
  node src/cli.js scripts
  node src/cli.js swiss --seed swiss --seasons 12 --rounds 5 --per-side 5 --sets core`);
}
