import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { CARD_DEFS, EXPANSION_PACKS, buildTradeDeckIds, normalizeExpansions, getFactions } from '../src/engine/cards.js';
import { MatchRunner } from '../src/engine/runner.js';

function make(mode, count, sets = ['core']) {
  return createGame({ mode, seed: `exp-${mode}-${sets.join('-')}`, expansions: { sets }, players: Array.from({ length: count }, (_, i) => ({ name: `P${i}` })) });
}
function isolate(g, playerId) {
  const p = g.state.players[playerId];
  p.hand = []; p.inPlay = []; p.discard = []; p.deck = []; p.trade = 0; p.combat = 0;
  p.used = {}; p.triggered = {}; p.playedThisTurn = [];
  return p;
}
function add(g, id, playerId, zone = 'hand') {
  const uid = g.makeCard(id, playerId);
  g.state.players[playerId][zone].push(uid);
  return uid;
}
function settleEvents(g) {
  for (let i = 0; i < 100 && (g.state.pending || g.state.eventContext); i++) {
    const action = g.legalActions().find(a => a.type === 'eventChoice') || g.legalActions()[0];
    if (!action) break;
    g.applyAction(action);
  }
}

test('扩展牌包可任意组合且牌数守恒', () => {
  assert.deepEqual(EXPANSION_PACKS.map(p => p.id), ['core', 'colonyWars', 'events', 'frontiers', 'crisisFleets', 'crisisBases']);
  const cases = [
    [['core'], 80], [['colonyWars'], 80], [['core', 'colonyWars'], 160],
    [['core', 'events'], 92], [['colonyWars', 'events'], 92], [['core', 'colonyWars', 'events'], 172],
    [['frontiers'], 75], [['crisisFleets'], 11], [['crisisBases'], 10],
    [['core', 'frontiers'], 155], [['frontiers', 'crisisFleets', 'crisisBases'], 96]
  ];
  for (const [sets, count] of cases) {
    const options = normalizeExpansions({ expansions: { sets } });
    assert.equal(buildTradeDeckIds({ expansions: options }).length, count);
  }
  const eventsOnly = normalizeExpansions({ expansions: { sets: ['events'] } });
  assert.deepEqual(eventsOnly.sets, ['core', 'events']);
});

test('事件牌不出现在初始交易行，洗入数量在视角中可见', () => {
  const g = make('standard', 2, ['core', 'events']);
  assert.equal(g.state.tradeDeck.length + g.state.tradeRow.filter(Boolean).length, 92);
  assert.equal(g.state.tradeRow.filter(uid => CARD_DEFS[g.state.cards[uid].id].type === 'event').length, 0);
  assert.equal(g.getView('spectator').eventCardsRemaining, 12);
});

test('黑洞事件按座位依次选择，事件不会使权威低于 1', () => {
  const g = make('standard', 2, ['core', 'events']);
  g.state.players[0].authority = 3;
  const event = g.makeCard('blackHole');
  g.state.tradeDeck.unshift(event);
  g.state.tradeRow[0] = null;
  g.refillTradeRow(0);
  assert.equal(g.state.pending.type, 'eventChoice');
  assert.equal(g.state.pending.kind, 'blackHole');
  for (let i = 0; i < 2; i++) {
    const skip = g.legalActions().find(a => a.type === 'eventChoice' && (!a.targets || a.targets.length === 0));
    assert.ok(skip);
    g.applyAction(skip);
  }
  assert.equal(g.state.eventContext, null);
  assert.equal(g.state.players[0].authority, 1);
  assert.ok(g.state.scrapHeap.includes(event));
  assert.ok(g.state.tradeRow[0]);
});

test('超新星清空交易行、事件牌进入废料堆且不构成致命伤害', () => {
  const g = make('standard', 2, ['core', 'events']);
  const before = [...g.state.tradeRow];
  g.state.players.forEach(p => { p.authority = 3; });
  const event = g.makeCard('supernova');
  g.state.tradeDeck.unshift(event);
  g.state.tradeRow[0] = null;
  g.refillTradeRow(0);
  // 补齐交易行可能连锁翻出第二个事件；逐次完成其待决选择。
  settleEvents(g);
  assert.equal(g.state.pending, null);
  assert.equal(g.state.eventContext, null);
  assert.deepEqual(g.state.players.map(p => p.authority), [1, 1]);
  assert.equal(g.state.tradeRow.filter(Boolean).length, 5);
  assert.ok(g.state.scrapHeap.includes(event));
  assert.ok(before.slice(1).every(uid => g.state.scrapHeap.includes(uid)));
});

test('跃迁事件让每名玩家抽三张并选两张放回牌库顶', () => {
  const g = make('standard', 2, ['core', 'events']);
  for (const player of g.state.players) {
    player.deck = Array.from({ length: 3 }, () => add(g, 'scout', player.id, 'discard'));
    player.deck = player.discard.splice(0);
  }
  const event = g.makeCard('warpJump');
  g.state.tradeDeck.unshift(event);
  g.state.tradeRow[0] = null;
  g.refillTradeRow(0);
  assert.equal(g.state.pending.kind, 'warpJump');
  for (let i = 0; i < 2; i++) {
    const action = g.legalActions().find(a => a.type === 'eventChoice' && a.cards?.length === 2);
    assert.ok(action);
    g.applyAction(action);
  }
  assert.equal(g.state.eventContext, null);
  for (const player of g.state.players) assert.equal(player.deck.length, 2);
});

test('殖民战争的同阵营购入牌可直接入手牌', () => {
  const g = make('standard', 2, ['colonyWars']);
  const p = isolate(g, 0);
  p.trade = 5;
  const federation = add(g, 'federationShuttle', 0, 'inPlay');
  p.playedThisTurn.push(federation);
  const card = g.makeCard('colonySeedShip');
  g.state.tradeRow[0] = card;
  g.applyAction({ type: 'buy', row: 0 });
  assert.ok(p.hand.includes(card));
  assert.equal(p.trade, 0);
});

test('指挥中心让之后打出的帝国飞船额外获得 2 战斗', () => {
  const g = make('standard', 2, ['colonyWars']);
  const p = isolate(g, 0);
  add(g, 'commandCenter', 0, 'inPlay');
  const ship = add(g, 'starBarge', 0);
  g.applyAction({ type: 'play', cardId: ship, copy: null });
  assert.equal(p.combat, 2);
  assert.equal(p.trade, 2);
});

test('隐匿尖塔复制基地能力并保留机械教团阵营', () => {
  const g = make('standard', 2, ['colonyWars']);
  const p = isolate(g, 0);
  const wheel = add(g, 'blobWheel', 0, 'inPlay');
  const tower = add(g, 'stealthTower', 0);
  g.applyAction({ type: 'play', cardId: tower, copy: wheel });
  assert.deepEqual(getFactions(tower, g.state).sort(), ['blob', 'machine']);
  const primary = g.legalActions().find(a => a.type === 'ability' && a.cardId === tower && a.ability === 'primary');
  assert.ok(primary);
  g.applyAction(primary);
  assert.equal(p.combat, 1);
});

test('2V2 初始为两队共享 75 权威，攻击扣减同队权威', () => {
  const g = make('team2v2', 4);
  assert.deepEqual(g.state.players.map(p => p.team), [0, 1, 0, 1]);
  assert.deepEqual(g.state.players.map(p => p.authority), [75, 75, 75, 75]);
  const p = isolate(g, 0); p.combat = 5;
  g.applyAction({ type: 'attack', targetType: 'player', targetId: 1, amount: 5 });
  assert.deepEqual(g.state.players.map(x => x.authority), [75, 70, 75, 70]);
});

test('2V2 任意队友的前哨保护整个团队', () => {
  const g = make('team2v2', 4);
  const p = isolate(g, 0); p.combat = 10;
  const outpost = add(g, 'tradingPost', 1, 'inPlay');
  add(g, 'barterWorld', 3, 'inPlay');
  const baseTargets = g.legalActions().filter(a => a.type === 'attack' && a.targetType === 'base').map(a => a.targetId);
  assert.deepEqual(baseTargets, [outpost]);
  assert.ok(!g.legalActions().some(a => a.type === 'attack' && a.targetType === 'player'));
});

test('2V2 转移的资源在队友回合开始时进入其资源池（同一队伍回合内）', () => {
  const g = make('team2v2', 4);
  const p = isolate(g, 0); p.trade = 4;
  g.applyAction({ type: 'transfer', targetId: 2, resource: 'trade', amount: 4 });
  assert.equal(p.trade, 0);
  assert.equal(g.state.players[2].reserve.trade, 4);
  g.applyAction({ type: 'endTurn' });
  assert.equal(g.state.activePlayer, 2, '队内应直接轮到队友，中间不夹对手回合');
  assert.equal(g.state.players[2].trade, 4);
});

test('2V2 与混洗扩展、事件组合能由用户脚本跑完', async () => {
  const runner = await MatchRunner.create({
    mode: 'team2v2', seed: 'expansion-final', expansions: { sets: ['core', 'colonyWars', 'events'] },
    players: [
      { name: 'A1', script: 'script:agent-hy4.js' },
      { name: 'B1', script: 'script:agent-kimi31pro.js' },
      { name: 'A2', script: 'script:agent-deepseekv4pro.js' },
      { name: 'B2', script: 'script:agent-step5preview.js' }
    ]
  });
  const result = await runner.runToEnd(40000);
  assert.equal(runner.game.state.status, 'finished');
  assert.ok(Number.isInteger(result.winner));
  assert.ok(Number.isInteger(result.winningTeam));
});
