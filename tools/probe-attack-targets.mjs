/**
 * 规则探针：直接构造局面检查「行动顺序」与「攻击目标」，不依赖模型脚本、不产生赛果。
 * 期望值独立按官方口径推导，不调用被测的 canAttackPlayer / canTargetBase。
 * 用法：node tools/probe-attack-targets.mjs
 */
import { Game } from '../src/engine/engine.js';
import { CARD_DEFS } from '../src/engine/cards.js';
import { isEmperor, oppositeSeat, admiralSeats, teamOf } from '../src/engine/modes.js';

const baseIds = Object.entries(CARD_DEFS)
  .filter(([, def]) => def.type === 'base')
  .map(([id, def]) => ({ id, outpost: !!def.outpost }));
const normalBase = baseIds.find(x => !x.outpost)?.id;
const outpostBase = baseIds.find(x => x.outpost)?.id;
if (!normalBase || !outpostBase) throw new Error('找不到普通基地 / 前哨定义');

const failures = [];
const note = (ok, text) => { if (!ok) failures.push(text); };
const players = Array.from({ length: 6 }, (_, i) => ({ name: `P${i}` }));
const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const show = set => `[${[...set].sort().join(',')}]`;

/** 构造干净局面：每人一座普通基地；outpostSeats 指定的人额外放一座前哨。 */
function makeGame(mode, emperors = [0, 1], outpostSeats = []) {
  const count = mode === 'team2v2' ? 4 : 6;
  const config = {
    mode, players: players.slice(0, count),
    expansions: { sets: ['core'] },
    seed: `probe-${mode}-${emperors.join('-')}-${outpostSeats.join('-')}`
  };
  if (mode === 'emperor') config.emperors = emperors;
  const game = new Game(config);
  for (const p of game.state.players) {
    p.hand = [];
    p.inPlay = [game.makeCard(normalBase, p.id)];
    if (outpostSeats.includes(p.id)) p.inPlay.push(game.makeCard(outpostBase, p.id));
  }
  return game;
}

/** 实际可攻击目标：玩家 id 集合 + 「基地所有者:是否前哨」集合。 */
function actualTargets(game, attacker) {
  const s = game.state;
  s.activePlayer = attacker;
  s.players[attacker].combat = 20;
  const got = { players: new Set(), bases: new Set() };
  for (const action of game.legalActions()) {
    if (action.type !== 'attack') continue;
    if (action.targetType === 'player') got.players.add(action.targetId);
    else {
      const card = s.cards[action.targetId];
      got.bases.add(`${card.owner}:${CARD_DEFS[card.id].outpost ? 'O' : 'N'}`);
    }
  }
  s.players[attacker].combat = 0;
  return got;
}

/** 独立期望：大将可打任意敌方；提督只打对位，对位阵亡后解锁敌方大将；前哨先于玩家/普通基地。 */
function expectedTargets(s, attacker) {
  const exp = { players: new Set(), bases: new Set() };
  const ownTeam = attacker % 2;
  const admiralOf = team => s.players.filter(p => p.team === team && !s.emperors.includes(p.id)).map(p => p.id).sort((a, b) => a - b);
  const attackerIsEmperor = s.mode === 'emperor' && s.emperors.includes(attacker);
  const opposite = s.mode === 'emperor' && !attackerIsEmperor
    ? admiralOf(1 - ownTeam)[admiralOf(ownTeam).indexOf(attacker)]
    : null;
  for (const p of s.players) {
    if (p.eliminated || p.id === attacker || p.team === ownTeam) continue;
    if (s.mode === 'emperor' && !attackerIsEmperor) {
      const unlocked = opposite !== undefined && opposite !== null && s.players[opposite]?.eliminated;
      const allowed = p.id === opposite || (unlocked && s.emperors.includes(p.id));
      if (!allowed) continue;
    }
    const shield = s.mode === 'emperor'
      ? p.inPlay.some(uid => CARD_DEFS[s.cards[uid].id].outpost)
      : s.players.some(member => member.team === p.team && member.inPlay.some(uid => CARD_DEFS[s.cards[uid].id].outpost));
    if (!shield) exp.players.add(p.id);
    for (const uid of p.inPlay) {
      const isOutpost = CARD_DEFS[s.cards[uid].id].outpost;
      if (!shield || isOutpost) exp.bases.add(`${p.id}:${isOutpost ? 'O' : 'N'}`);
    }
  }
  return exp;
}

function checkTargets(game, label) {
  const s = game.state;
  for (const p of s.players) {
    if (p.eliminated) continue;
    const got = actualTargets(game, p.id);
    const exp = expectedTargets(s, p.id);
    if (!same(got.players, exp.players) || !same(got.bases, exp.bases)) {
      failures.push(`${label} 攻击者${p.id}：玩家 got=${show(got.players)} exp=${show(exp.players)}；基地 got=${show(got.bases)} exp=${show(exp.bases)}`);
    }
    if (s.mode === 'emperor' && !isEmperor(s, p.id)) {
      const opposite = oppositeSeat(s, p.id);
      const enemyEmperor = s.emperors[1 - teamOf(s, p.id)];
      if (opposite !== null && !s.players[opposite].eliminated && got.players.has(enemyEmperor)) {
        failures.push(`${label} 提督${p.id} 在对位${opposite}存活时竟能攻击敌方大将${enemyEmperor}`);
      }
    }
  }
}

console.log(`普通基地 = ${normalBase}／前哨 = ${outpostBase}`);
console.log('');
console.log('=== A. 大将战：全部合法大将座位组合 × 对位存活/阵亡 ===');
for (const emperors of [[0, 1], [2, 3], [4, 5]]) {
  const game = makeGame('emperor', emperors);
  const s = game.state;
  checkTargets(game, `emperors=[${emperors}] 对位存活`);
  const pairs = admiralSeats(s, 0).map((own, i) => `${own}↔${admiralSeats(s, 1)[i]}`).join(' ');
  console.log(`emperors=[${emperors}] 对位存活   提督对位 ${pairs}`);
  const down = admiralSeats(s, 1)[0];
  s.players[down].eliminated = true;
  s.players[down].inPlay = [];
  checkTargets(game, `emperors=[${emperors}] 对位${down}阵亡`);
  console.log(`emperors=[${emperors}] 对位${down}阵亡 提督对位 ${pairs}（不应漂移）`);
}

console.log('');
console.log('=== B. 前哨保护：队伍模式按整队，大将战按个人（当前内核口径） ===');
for (const [mode, shielded] of [['team2v2', 0], ['hydra3', 2], ['emperor', 0]]) {
  const game = makeGame(mode, [0, 1], [shielded]);
  const attacker = 1;
  const got = actualTargets(game, attacker);
  const exp = expectedTargets(game.state, attacker);
  note(same(got.players, exp.players) && same(got.bases, exp.bases),
    `${mode} 前哨在${shielded} 攻击者${attacker}：玩家 got=${show(got.players)} exp=${show(exp.players)}；基地 got=${show(got.bases)} exp=${show(exp.bases)}`);
  console.log(`${mode.padEnd(10)} 前哨在 ${shielded} → 可直击玩家 ${show(got.players)}，可打基地 ${show(got.bases)}`);
}

console.log('');
console.log('=== C. 队伍模式：攻击目标只含敌方 ===');
for (const mode of ['team2v2', 'hydra3']) {
  const game = makeGame(mode);
  checkTargets(game, mode);
  const got = actualTargets(game, 1);
  console.log(`${mode.padEnd(10)} 攻击者 1 可直击 ${show(got.players)}，可打基地 ${show(got.bases)}`);
}

console.log('');
console.log('=== D. 行动顺序：整队轮流，且队末才补牌 ===');
for (const mode of ['team2v2', 'hydra3', 'emperor']) {
  const game = new Game({
    mode, players: mode === 'team2v2' ? players.slice(0, 4) : players,
    expansions: { sets: ['core'] }, seed: `probe-order-${mode}`,
    ...(mode === 'emperor' ? { emperors: [0, 1] } : {})
  });
  // 把每人手牌压到 2 张：队内换人不补牌应保持 2，队末弃手补牌应变成 5。
  for (const p of game.state.players) {
    while (p.hand.length > 2) p.discard.push(p.hand.pop());
  }
  const seq = [game.state.activePlayer];
  const hands = [];
  const beforeHands = [];
  for (let i = 0; i < (mode === 'team2v2' ? 8 : 12); i++) {
    beforeHands.push(game.state.players.map(p => p.hand.length));
    game.endTurn();
    hands.push(game.state.players.map(p => p.hand.length).join(','));
    seq.push(game.state.activePlayer);
  }
  const wanted = mode === 'team2v2' ? [0, 2, 1, 3, 0] : [0, 2, 4, 1, 3, 5, 0];
  const pattern = seq.slice(0, wanted.length).join(',');
  note(pattern === wanted.join(','), `${mode} 行动顺序错误：${pattern} 应为 ${wanted.join(',')}`);
  console.log(`${mode.padEnd(10)} activePlayer = ${seq.join(' → ')}`);
  console.log(`${''.padEnd(10)} 各座位手牌 = ${hands.join(' | ')}`);
  // 队末（第 teamSize 的整数倍次）才应补到 5 张；队内换人应保持 2 张。
  const teamSize = mode === 'team2v2' ? 2 : 3;
  for (let i = 0; i < hands.length; i++) {
    const counts = hands[i].split(',').map(Number);
    const endingTeam = game.state.players[seq[i]].team;
    const ownCounts = counts.filter((_, seat) => seat % 2 === endingTeam);
    const ownBefore = beforeHands[i].filter((_, seat) => seat % 2 === endingTeam);
    const atTeamBoundary = (i + 1) % teamSize === 0;
    if (atTeamBoundary) {
      note(ownCounts.every(n => n === 5), `${mode} 第 ${i + 1} 次 endTurn（队末）本队手牌应为 5，实际 ${hands[i]}`);
    } else {
      note(ownCounts.every((n, j) => n === ownBefore[j]), `${mode} 第 ${i + 1} 次 endTurn（队内）本队手牌不应变化，实际 ${hands[i]}`);
    }
  }
}

console.log('');
if (failures.length) {
  console.log(`❌ 发现 ${failures.length} 处不一致：`);
  for (const f of failures) console.log(' -', f);
  process.exitCode = 1;
} else {
  console.log('✅ 构造局面检查全部通过：攻击目标过滤、提督对位、前哨保护、整队轮流与队末补牌均符合内核口径。');
}
