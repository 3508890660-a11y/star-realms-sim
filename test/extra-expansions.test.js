import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/engine.js';
import { CARD_DEFS } from '../src/engine/cards.js';
import { seatPlan } from '../src/mode-tourney-cli.js';

const two = () => [{ name: 'P1', script: 'tactical' }, { name: 'P2', script: 'tactical' }];
const make = () => createGame({ mode: 'standard', seed: 'extra-test', expansions: { sets: ['core', 'frontiers', 'crisisFleets', 'crisisBases'] }, players: two() });

function isolate(g, playerId = 0) {
  const player = g.state.players[playerId];
  player.hand = []; player.inPlay = []; player.discard = []; player.deck = [];
  player.trade = 0; player.combat = 0; player.used = {}; player.triggered = {}; player.triggeredDouble = {};
  return player;
}

test('双同盟：两张同阵营在场才触发，效果按 doubleAlly 结算', () => {
  const g = make();
  const player = isolate(g);
  const queen = g.makeCard('fr_hiveQueen', 0);
  player.inPlay.push(queen);
  player.inPlay.push(g.makeCard('fr_blobAlpha', 0));
  // 只有一张同盟：单同盟触发，双同盟不触发
  g.refreshAllies();
  assert.equal(player.triggered[queen], true);
  assert.notEqual(player.triggeredDouble[queen], true);
  player.inPlay.push(g.makeCard('fr_crusher', 0));
  g.refreshAllies();
  assert.equal(player.triggeredDouble[queen], true);
  const doubleAction = g.legalActions().find(a => a.type === 'ability' && a.cardId === queen && a.double);
  assert.ok(doubleAction, '应提供双同盟动作');
  assert.equal(doubleAction.ability, 'ally', '双同盟沿用 ally 键，旧脚本无需改动');
  g.useAbility(doubleAction);
  assert.equal(player.combat, 3);
  // 同一张卡的双同盟只能用一次
  assert.equal(player.used[queen].includes('ally#2'), true);
});

test('粉碎者：销毁交易行卡牌并获得等同于其费用的战斗', () => {
  const g = make();
  const player = isolate(g);
  const uid = g.makeCard('fr_pulverizer', 0);
  player.hand.push(uid);
  const action = g.legalActions().find(a => a.type === 'play' && a.cardId === uid && a.row !== undefined);
  assert.ok(action, '应提供带交易行目标的打出动作');
  const target = g.state.tradeRow[action.row];
  const cost = CARD_DEFS[g.state.cards[target].id].cost;
  g.play(action);
  assert.equal(player.combat, cost);
  assert.equal(g.state.tradeRow[action.row] === target, false, '交易行该位应被清空并补牌');
});

test('改装厂：弃一张手牌换 4 战斗', () => {
  const g = make();
  const player = isolate(g);
  const yard = g.makeCard('fr_conversionYard', 0);
  player.inPlay.push(yard);
  const fodder = g.makeCard('scout', 0);
  player.hand.push(fodder);
  const action = g.legalActions().find(a => a.type === 'ability' && a.cardId === yard && a.ability === 'optional');
  assert.ok(action);
  assert.deepEqual(action.targets, [fodder]);
  g.useAbility(action);
  assert.equal(player.combat, 4);
  assert.equal(player.hand.includes(fodder), false);
});

test('星门舰：免费获得费用不超过 6 的卡并置于牌库顶', () => {
  const g = make();
  const player = isolate(g);
  const uid = g.makeCard('fr_gateship', 0);
  player.hand.push(uid);
  const action = g.legalActions().find(a => a.type === 'play' && a.cardId === uid && a.row !== undefined);
  assert.ok(action, '应提供带交易行目标的打出动作');
  const target = g.state.tradeRow[action.row];
  assert.ok(CARD_DEFS[g.state.cards[target].id].cost <= 6);
  g.play(action);
  assert.equal(player.deck[0], target, '获得的卡应置于牌库顶');
});

test('长途运输舰：销毁能力让下一座获得的基地置于牌库顶', () => {
  const g = make();
  const player = isolate(g);
  const uid = g.makeCard('fr_longHauler', 0);
  player.inPlay.push(uid);
  player.triggered[uid] = true;
  const scrap = g.legalActions().find(a => a.type === 'ability' && a.cardId === uid && a.ability === 'scrap');
  assert.ok(scrap);
  g.useAbility(scrap);
  assert.equal(player.topDeckNextBase, true);
  const base = g.makeCard('battleStation', 0);
  g.acquire(base, player, true);
  assert.equal(player.deck[0], base, '基地应置于牌库顶');
  assert.equal(player.topDeckNextBase, false, '标记用后应清除');
});

test('3V3 座位编排：6 局覆盖 6 个座位各一次，大将各当 2 次', () => {
  const team = (id, prefix) => ({
    id,
    players: [0, 1, 2].map(i => ({ id: `${prefix}${i}`, model: `${prefix}${i}`, display: `${prefix}${i}`, script: 'tactical' }))
  });
  const plan = seatPlan(team('A', 'a'), team('B', 'b'), 6, 0);
  assert.equal(plan.length, 6);
  const seatCount = new Map();
  const emperorCount = new Map();
  for (const item of plan) {
    item.seats.forEach((player, seat) => {
      const key = `${player.id}@${seat}`;
      seatCount.set(key, (seatCount.get(key) || 0) + 1);
    });
    for (const seat of item.emperors) {
      const model = item.seats[seat].model;
      emperorCount.set(model, (emperorCount.get(model) || 0) + 1);
    }
  }
  assert.equal(seatCount.size, 36, '6 个模型 × 6 个座位 = 36 种组合，且每种只出现一次');
  for (const count of seatCount.values()) assert.equal(count, 1);
  assert.equal(emperorCount.size, 6);
  for (const count of emperorCount.values()) assert.equal(count, 2);
  // 前位队每 3 局换一次，6 局正好 3:3
  assert.equal(plan.filter(item => item.frontTeamId === 'A').length, 3);
});
