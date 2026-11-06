import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { CARD_DEFS, TRADE_DECK_SIZE, getFactions } from '../src/engine/cards.js';
import { MatchRunner, playReplay } from '../src/engine/runner.js';
import { listScripts } from '../src/ai/loader.js';

function game(mode = 'standard', count = 2) {
  return createGame({ mode, seed: `test-${mode}-${count}`, players: Array.from({ length: count }, (_, i) => ({ name: `P${i}` })) });
}
function isolate(g, playerId = 0) {
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
function find(g, type, predicate = () => true) {
  const action = g.legalActions().find(a => a.type === type && predicate(a));
  assert.ok(action, `缺少动作 ${type}: ${JSON.stringify(g.legalActions())}`);
  return action;
}

test('基础盒 80 张交易牌与标准先后手设置严格守恒', () => {
  const g = game();
  assert.equal(TRADE_DECK_SIZE, 80);
  assert.equal(g.state.tradeDeck.length + g.state.tradeRow.filter(Boolean).length, 80);
  assert.deepEqual(g.state.players.map(p => p.hand.length), [3, 5]);
  for (const p of g.state.players) {
    assert.equal(p.deck.length + p.hand.length, 10);
    assert.equal(p.authority, 50);
  }
});

test('多人初始手牌依次为 3、4、5、5', () => {
  const g = game('ffa', 4);
  assert.deepEqual(g.state.players.map(p => p.hand.length), [3, 4, 5, 5]);
});

test('侦察艇提供贸易，回合结束飞船与余手进入弃牌并补五张', () => {
  const g = game(); const p = isolate(g); const scout = add(g, 'scout', 0); add(g, 'viper', 0);
  p.deck = Array.from({ length: 5 }, () => add(g, 'scout', 0, 'discard'));
  p.deck = p.discard.splice(0);
  g.applyAction(find(g, 'play', a => a.cardId === scout));
  assert.equal(p.trade, 1);
  g.applyAction({ type: 'endTurn' });
  assert.equal(p.hand.length, 5);
  assert.equal(p.discard.length, 2);
  assert.equal(p.inPlay.length, 0);
  assert.equal(p.trade, 0);
});

test('同阵营第二张牌触发双方同盟，同盟抽牌每回合一次', () => {
  const g = game(); const p = isolate(g);
  const fighter = add(g, 'blobFighter', 0); const pod = add(g, 'tradePod', 0); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'play', a => a.cardId === fighter));
  assert.ok(!p.triggered[fighter]);
  g.applyAction(find(g, 'play', a => a.cardId === pod));
  assert.ok(p.triggered[fighter] && p.triggered[pod]);
  g.applyAction(find(g, 'ability', a => a.cardId === fighter && a.ability === 'ally'));
  assert.equal(p.hand.length, 1);
  assert.ok(!g.legalActions().some(a => a.cardId === fighter && a.ability === 'ally'));
});

test('机甲世界能触发任意阵营同盟', () => {
  const g = game(); const p = isolate(g); add(g, 'mechWorld', 0, 'inPlay'); const shuttle = add(g, 'federationShuttle', 0);
  g.applyAction(find(g, 'play', a => a.cardId === shuttle));
  assert.ok(p.triggered[shuttle]);
  g.applyAction(find(g, 'ability', a => a.cardId === shuttle && a.ability === 'ally'));
  assert.equal(p.authority, 54);
});

test('前哨保护玩家和其他基地，摧毁前哨后解除保护', () => {
  const g = game(); const p = isolate(g); const enemy = isolate(g, 1);
  const outpost = add(g, 'tradingPost', 1, 'inPlay'); const normal = add(g, 'barterWorld', 1, 'inPlay'); p.combat = 20;
  let bases = g.legalActions().filter(a => a.type === 'attack' && a.targetType === 'base');
  assert.deepEqual(bases.map(a => a.targetId), [outpost]);
  assert.ok(!g.legalActions().some(a => a.type === 'attack' && a.targetType === 'player'));
  g.applyAction(find(g, 'attack', a => a.targetId === outpost));
  assert.ok(enemy.discard.includes(outpost));
  assert.ok(g.legalActions().some(a => a.type === 'attack' && a.targetId === normal));
  assert.ok(g.legalActions().some(a => a.type === 'attack' && a.targetType === 'player'));
});

test('基地未摧毁伤害在回合结束清除', () => {
  const g = game(); const p = isolate(g); isolate(g, 1); const base = add(g, 'theHive', 1, 'inPlay'); p.combat = 2;
  g.applyAction(find(g, 'attack', a => a.targetId === base));
  assert.equal(g.state.damage[base], 2);
  g.applyAction({ type: 'endTurn' });
  assert.equal(g.state.damage[base], undefined);
});

test('购买扣贸易、进入弃牌并立即补交易行', () => {
  const g = game(); const p = isolate(g); p.trade = 8;
  const uid = g.state.tradeRow[0]; const cost = CARD_DEFS[g.state.cards[uid].id].cost; const before = g.state.tradeDeck.length;
  if (cost > 8) return;
  g.applyAction({ type: 'buy', row: 0 });
  assert.equal(p.trade, 8 - cost);
  assert.ok(p.discard.includes(uid));
  assert.ok(g.state.tradeRow[0]);
  assert.equal(g.state.tradeDeck.length, before - 1);
});

test('探索者购买与销毁后返回独立供应堆', () => {
  const g = game(); const p = isolate(g); p.trade = 2;
  g.applyAction({ type: 'buy', explorer: true });
  const explorer = p.discard[0]; assert.equal(g.state.explorers, 9);
  p.hand.push(p.discard.pop());
  g.applyAction(find(g, 'play', a => a.cardId === explorer));
  g.applyAction(find(g, 'ability', a => a.cardId === explorer && a.ability === 'scrap'));
  assert.equal(g.state.explorers, 10);
  assert.equal(p.combat, 2);
  assert.ok(!g.state.scrapHeap.includes(explorer));
});

test('强制弃牌切换到受影响玩家，由其选牌', () => {
  const g = game(); isolate(g); const enemy = isolate(g, 1); const fighter = add(g, 'imperialFighter', 0); const scout = add(g, 'scout', 1); add(g, 'viper', 1);
  g.applyAction(find(g, 'play', a => a.cardId === fighter));
  assert.equal(g.state.pending.type, 'discard'); assert.equal(g.state.pending.player, 1);
  g.applyAction({ type: 'discard', cardId: scout });
  assert.equal(g.state.pending, null);
  assert.deepEqual(enemy.discard, [scout]);
});

test('自由混战强制弃牌先选择目标对手', () => {
  const g = game('ffa', 3); isolate(g); isolate(g, 1); const enemy = isolate(g, 2); add(g, 'scout', 2);
  const fighter = add(g, 'imperialFighter', 0);
  g.applyAction(find(g, 'play', a => a.cardId === fighter));
  assert.equal(g.state.pending.type, 'targetDiscard');
  g.applyAction({ type: 'targetDiscard', targetId: 2 });
  assert.equal(g.state.pending.player, 2);
  g.applyAction({ type: 'discard', cardId: enemy.hand[0] });
  assert.equal(g.state.pending, null);
});

test('巡逻机甲主要能力二选一', () => {
  const g = game(); const p = isolate(g); const mech = add(g, 'patrolMech', 0);
  g.applyAction(find(g, 'play', a => a.cardId === mech && a.choice === 1));
  assert.equal(p.combat, 5); assert.equal(p.trade, 0);
});

test('回收空间站弃两张再抽两张', () => {
  const g = game(); const p = isolate(g); const station = add(g, 'recyclingStation', 0, 'inPlay');
  const a = add(g, 'scout', 0); const b = add(g, 'viper', 0); add(g, 'scout', 0, 'deck'); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'ability', x => x.cardId === station && x.targets?.length === 2));
  assert.equal(p.hand.length, 2); assert.ok(p.discard.includes(a) && p.discard.includes(b));
});

test('智脑世界跨手牌与弃牌堆销毁并抽等量牌', () => {
  const g = game(); const p = isolate(g); const brain = add(g, 'brainWorld', 0, 'inPlay');
  const a = add(g, 'scout', 0); const b = add(g, 'viper', 0, 'discard'); add(g, 'scout', 0, 'deck'); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'ability', x => x.cardId === brain && x.targets?.includes(a) && x.targets?.includes(b)));
  assert.equal(p.hand.length, 2); assert.equal(g.state.scrapHeap.filter(x => [a, b].includes(x)).length, 2);
});

test('机械基地抽牌后进入强制销毁决策', () => {
  const g = game(); const p = isolate(g); const base = add(g, 'machineBase', 0, 'inPlay'); const scout = add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'ability', x => x.cardId === base && x.ability === 'primary'));
  assert.equal(g.state.pending.type, 'scrapMandatory');
  g.applyAction({ type: 'selectScrap', cardId: scout });
  assert.ok(g.state.scrapHeap.includes(scout)); assert.equal(g.state.pending, null);
});

test('虫群世界按本回合打出的虫群牌抽牌', () => {
  const g = game(); const p = isolate(g); const world = add(g, 'blobWorld', 0, 'inPlay'); const fighter = add(g, 'blobFighter', 0);
  p.playedThisTurn.push(world); add(g, 'scout', 0, 'deck'); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'play', x => x.cardId === fighter));
  g.applyAction(find(g, 'ability', x => x.cardId === world && x.choice === 1));
  assert.equal(p.hand.length, 2);
});

test('舰队总部使每艘飞船额外获得 1 战斗', () => {
  const g = game(); const p = isolate(g); add(g, 'fleetHQ', 0, 'inPlay'); const viper = add(g, 'viper', 0);
  g.applyAction(find(g, 'play', x => x.cardId === viper)); assert.equal(p.combat, 2);
});

test('使馆游艇在两座基地时抽两张', () => {
  const g = game(); const p = isolate(g); add(g, 'blobWheel', 0, 'inPlay'); add(g, 'theHive', 0, 'inPlay'); const yacht = add(g, 'embassyYacht', 0);
  add(g, 'scout', 0, 'deck'); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'play', x => x.cardId === yacht)); assert.equal(p.hand.length, 2);
});

test('货运舰同盟使下一艘购入飞船置于牌库顶', () => {
  const g = game(); const p = isolate(g); add(g, 'federationShuttle', 0, 'inPlay'); const freighter = add(g, 'freighter', 0, 'inPlay');
  p.triggered[freighter] = true; p.trade = 8;
  g.applyAction(find(g, 'ability', x => x.cardId === freighter && x.ability === 'ally'));
  const row = g.state.tradeRow.findIndex(uid => CARD_DEFS[g.state.cards[uid].id].type === 'ship' && CARD_DEFS[g.state.cards[uid].id].cost <= 8);
  const uid = g.state.tradeRow[row];
  g.applyAction({ type: 'buy', row });
  assert.equal(p.deck[0], uid); assert.ok(!p.discard.includes(uid)); assert.equal(p.topDeckNextShip, false);
});

test('隐匿针舰复制主要能力、同盟与额外阵营', () => {
  const g = game(); const p = isolate(g); const fighter = add(g, 'blobFighter', 0); const needle = add(g, 'stealthNeedle', 0); add(g, 'scout', 0, 'deck');
  g.applyAction(find(g, 'play', x => x.cardId === fighter));
  g.applyAction(find(g, 'play', x => x.cardId === needle && x.copy === fighter));
  assert.equal(p.combat, 6); assert.deepEqual(getFactions(needle, g.state).sort(), ['blob', 'machine']);
  g.applyAction(find(g, 'ability', x => x.cardId === needle && x.ability === 'ally'));
  assert.equal(p.hand.length, 1);
});

test('虫群母舰免费获得飞船并置牌库顶', () => {
  const g = game(); const p = isolate(g); add(g, 'blobFighter', 0, 'inPlay'); const carrier = add(g, 'blobCarrier', 0, 'inPlay'); p.triggered[carrier] = true;
  const row = g.state.tradeRow.findIndex(uid => CARD_DEFS[g.state.cards[uid].id].type === 'ship'); const uid = g.state.tradeRow[row];
  g.applyAction(find(g, 'ability', x => x.cardId === carrier && x.row === row));
  assert.equal(p.deck[0], uid); assert.equal(p.trade, 0);
});

test('玩家视角不泄露对手手牌与任何牌库顺序', () => {
  const g = game(); const view = g.getView(0);
  assert.equal(view.players[0].hand.length, 3); assert.equal(view.players[1].hand.length, 0);
  assert.equal(view.players[1].handCount, 5); assert.equal(view.players[1].deckCount, 5);
  assert.equal(view.tradeDeck.length, 0); assert.equal(view.tradeDeckCount, 75);
  for (const uid of g.state.players[1].hand) assert.equal(view.cards[uid], undefined);
});

test('同种子同脚本对局可复现，回放逐步还原终局', async () => {
  const config = { mode: 'standard', seed: 'replay-proof', players: [{ name: 'A', script: 'tactical' }, { name: 'B', script: 'economic' }] };
  const a = await MatchRunner.create(config); await a.runToEnd();
  const b = await MatchRunner.create(config); await b.runToEnd();
  assert.deepEqual(a.result(), b.result());
  assert.deepEqual(a.replay().actions, b.replay().actions);
  const replayed = await playReplay(a.replay());
  assert.deepEqual(replayed.state, a.game.state);
});

test('五种模式均可由独立脚本自动跑完', async () => {
  for (const mode of ['standard', 'ffa', 'hunter', 'firstBlood', 'team2v2']) {
    const count = mode === 'standard' ? 2 : mode === 'team2v2' ? 4 : 3;
    const runner = await MatchRunner.create({ mode, seed: `mode-${mode}`, players: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, script: ['tactical', 'economic', 'random', 'tactical'][i] })) });
    const result = await runner.runToEnd();
    assert.equal(runner.game.state.status, 'finished'); assert.ok(Number.isInteger(result.winner));
  }
});

test('脚本目录能发现内置与用户示例脚本', async () => {
  const scripts = await listScripts();
  for (const id of ['random', 'tactical', 'economic', 'script:example.js']) assert.ok(scripts.some(s => s.id === id && !s.error));
});
