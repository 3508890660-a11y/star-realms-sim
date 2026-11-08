import { COLONY_WARS_DEFS, EVENT_DEFS } from './expansions.js';
import { FRONTIERS_DEFS, CRISISFLEETSANDFORTRESSES_DEFS, CRISISBASESBATTLESHIPS_DEFS } from './expansions-extra.js';

export const FACTIONS = {
  neutral: { name: '无阵营', color: '#91a4ba' },
  blob: { name: '虫群', color: '#73d68c' },
  machine: { name: '机械教团', color: '#e0b55f' },
  empire: { name: '星际帝国', color: '#79aefc' },
  federation: { name: '贸易联邦', color: '#e8e36f' }
};

const ship = (id, name, en, faction, cost, qty, extra = {}) => ({
  id, name, en, type: 'ship', faction, cost, qty, set: 'core', ...extra
});
const base = (id, name, en, faction, cost, qty, defense, extra = {}) => ({
  id, name, en, type: 'base', faction, cost, qty, defense, set: 'core', ...extra
});
const scrapOwn = { scrapOwn: 1, zones: ['hand', 'discard'] };

const CORE_DEFS = Object.fromEntries([
  ship('scout', '侦察艇', 'Scout', 'neutral', null, 16, { primary: { trade: 1 }, text: '获得 1 贸易。' }),
  ship('viper', '毒蛇战机', 'Viper', 'neutral', null, 4, { primary: { combat: 1 }, text: '获得 1 战斗。' }),
  ship('explorer', '探索者', 'Explorer', 'neutral', 2, 10, { primary: { trade: 2 }, scrap: { combat: 2 }, text: '获得 2 贸易。销毁：获得 2 战斗。' }),

  ship('battleBlob', '战斗虫兽', 'Battle Blob', 'blob', 6, 1, { primary: { combat: 8 }, ally: { draw: 1 }, scrap: { combat: 4 }, text: '获得 8 战斗。同盟：抽 1 张牌。销毁：获得 4 战斗。' }),
  ship('battlePod', '战斗荚舱', 'Battle Pod', 'blob', 2, 2, { primary: { combat: 4 }, optionalPrimary: { scrapRow: 1 }, ally: { combat: 2 }, text: '获得 4 战斗。可销毁交易行 1 张牌。同盟：获得 2 战斗。' }),
  ship('blobCarrier', '虫群母舰', 'Blob Carrier', 'blob', 6, 1, { primary: { combat: 7 }, ally: { acquireShipFree: true }, text: '获得 7 战斗。同盟：免费获得一艘飞船并置于牌库顶。' }),
  ship('blobDestroyer', '虫群毁灭者', 'Blob Destroyer', 'blob', 4, 2, { primary: { combat: 6 }, ally: { destroyAndOrScrap: true }, text: '获得 6 战斗。同盟：摧毁目标基地和/或销毁交易行一张牌。' }),
  ship('blobFighter', '虫群战机', 'Blob Fighter', 'blob', 1, 3, { primary: { combat: 3 }, ally: { draw: 1 }, text: '获得 3 战斗。同盟：抽 1 张牌。' }),
  base('blobWheel', '虫群转轮', 'Blob Wheel', 'blob', 3, 3, 5, { primary: { combat: 1 }, scrap: { trade: 3 }, text: '获得 1 战斗。销毁：获得 3 贸易。' }),
  base('blobWorld', '虫群世界', 'Blob World', 'blob', 8, 1, 7, { primaryChoice: [{ combat: 5 }, { drawBlobPlayed: true }], text: '选择：获得 5 战斗；或本回合每打出过一张虫群牌便抽 1 张牌。' }),
  ship('mothership', '主宰母舰', 'Mothership', 'blob', 7, 1, { primary: { combat: 6, draw: 1 }, ally: { draw: 1 }, text: '获得 6 战斗并抽 1 张牌。同盟：抽 1 张牌。' }),
  ship('ram', '撞击舰', 'Ram', 'blob', 3, 2, { primary: { combat: 5 }, ally: { combat: 2 }, scrap: { trade: 3 }, text: '获得 5 战斗。同盟：获得 2 战斗。销毁：获得 3 贸易。' }),
  base('theHive', '蜂巢', 'The Hive', 'blob', 5, 1, 5, { primary: { combat: 3 }, ally: { draw: 1 }, text: '获得 3 战斗。同盟：抽 1 张牌。' }),
  ship('tradePod', '贸易荚舱', 'Trade Pod', 'blob', 2, 3, { primary: { trade: 3 }, ally: { combat: 2 }, text: '获得 3 贸易。同盟：获得 2 战斗。' }),

  ship('battleMech', '战斗机甲', 'Battle Mech', 'machine', 5, 1, { primary: { combat: 4 }, optionalPrimary: scrapOwn, ally: { draw: 1 }, text: '获得 4 战斗。可销毁手牌或弃牌堆一张牌。同盟：抽 1 张牌。' }),
  base('battleStation', '战斗空间站', 'Battle Station', 'machine', 3, 2, 5, { outpost: true, scrap: { combat: 5 }, text: '前哨。销毁：获得 5 战斗。' }),
  base('brainWorld', '智脑世界', 'Brain World', 'machine', 8, 1, 6, { outpost: true, primary: { scrapOwn: 2, zones: ['hand', 'discard'], drawPerScrap: true, upTo: true }, text: '前哨。销毁手牌和/或弃牌堆至多两张牌，每销毁一张便抽 1 张牌。' }),
  base('junkyard', '废料场', 'Junkyard', 'machine', 6, 1, 5, { outpost: true, primary: { ...scrapOwn, optional: true }, text: '前哨。可销毁手牌或弃牌堆一张牌。' }),
  base('machineBase', '机械基地', 'Machine Base', 'machine', 7, 1, 6, { outpost: true, primary: { draw: 1, scrapOwnMandatory: 1 }, text: '前哨。抽 1 张牌，然后销毁手牌一张牌。' }),
  base('mechWorld', '机甲世界', 'Mech World', 'machine', 5, 1, 6, { outpost: true, allAlly: true, text: '前哨。视为所有阵营的同盟。' }),
  ship('missileBot', '导弹机器人', 'Missile Bot', 'machine', 2, 3, { primary: { combat: 2 }, optionalPrimary: scrapOwn, ally: { combat: 2 }, text: '获得 2 战斗。可销毁手牌或弃牌堆一张牌。同盟：获得 2 战斗。' }),
  ship('missileMech', '导弹机甲', 'Missile Mech', 'machine', 6, 1, { primary: { combat: 6 }, optionalPrimary: { destroyBase: true }, ally: { draw: 1 }, text: '获得 6 战斗。可摧毁目标基地。同盟：抽 1 张牌。' }),
  ship('patrolMech', '巡逻机甲', 'Patrol Mech', 'machine', 4, 2, { primaryChoice: [{ trade: 3 }, { combat: 5 }], ally: scrapOwn, text: '选择：获得 3 贸易或 5 战斗。同盟：可销毁手牌或弃牌堆一张牌。' }),
  ship('stealthNeedle', '隐匿针舰', 'Stealth Needle', 'machine', 4, 1, { copyShip: true, text: '复制本回合你打出的另一艘飞船，并获得其阵营（保留机械教团阵营）。' }),
  ship('supplyBot', '补给机器人', 'Supply Bot', 'machine', 3, 3, { primary: { trade: 2 }, optionalPrimary: scrapOwn, ally: { combat: 2 }, text: '获得 2 贸易。可销毁手牌或弃牌堆一张牌。同盟：获得 2 战斗。' }),
  ship('tradeBot', '贸易机器人', 'Trade Bot', 'machine', 1, 3, { primary: { trade: 1 }, optionalPrimary: scrapOwn, ally: { combat: 2 }, text: '获得 1 贸易。可销毁手牌或弃牌堆一张牌。同盟：获得 2 战斗。' }),

  ship('battlecruiser', '战列巡洋舰', 'Battlecruiser', 'empire', 6, 1, { primary: { combat: 5, draw: 1 }, ally: { discardOpponent: 1 }, scrap: { draw: 1, destroyBase: true }, text: '获得 5 战斗并抽 1 张牌。同盟：目标对手弃 1 张牌。销毁：抽 1 张牌，可摧毁目标基地。' }),
  ship('corvette', '轻型护卫舰', 'Corvette', 'empire', 2, 2, { primary: { combat: 1, draw: 1 }, ally: { combat: 2 }, text: '获得 1 战斗并抽 1 张牌。同盟：获得 2 战斗。' }),
  ship('dreadnaught', '无畏舰', 'Dreadnaught', 'empire', 7, 1, { primary: { combat: 7, draw: 1 }, scrap: { combat: 5 }, text: '获得 7 战斗并抽 1 张牌。销毁：获得 5 战斗。' }),
  base('fleetHQ', '舰队总部', 'Fleet HQ', 'empire', 8, 1, 8, { fleetHQ: true, text: '你的所有飞船打出时额外获得 1 战斗。' }),
  ship('imperialFighter', '帝国战机', 'Imperial Fighter', 'empire', 1, 3, { primary: { combat: 2, discardOpponent: 1 }, ally: { combat: 2 }, text: '获得 2 战斗，目标对手弃 1 张牌。同盟：获得 2 战斗。' }),
  ship('imperialFrigate', '帝国护卫舰', 'Imperial Frigate', 'empire', 3, 3, { primary: { combat: 4, discardOpponent: 1 }, ally: { combat: 2 }, scrap: { draw: 1 }, text: '获得 4 战斗，目标对手弃 1 张牌。同盟：获得 2 战斗。销毁：抽 1 张牌。' }),
  base('recyclingStation', '回收空间站', 'Recycling Station', 'empire', 4, 2, 4, { outpost: true, primaryChoice: [{ trade: 1 }, { recycle: 2 }], text: '前哨。选择：获得 1 贸易；或弃至多两张牌，再抽等量牌。' }),
  base('royalRedoubt', '皇家堡垒', 'Royal Redoubt', 'empire', 6, 1, 6, { outpost: true, primary: { combat: 3 }, ally: { discardOpponent: 1 }, text: '前哨。获得 3 战斗。同盟：目标对手弃 1 张牌。' }),
  base('spaceStation', '空间站', 'Space Station', 'empire', 4, 2, 4, { outpost: true, primary: { combat: 2 }, ally: { combat: 2 }, scrap: { trade: 4 }, text: '前哨。获得 2 战斗。同盟：获得 2 战斗。销毁：获得 4 贸易。' }),
  ship('surveyShip', '勘测船', 'Survey Ship', 'empire', 3, 3, { primary: { trade: 1, draw: 1 }, scrap: { discardOpponent: 1 }, text: '获得 1 贸易并抽 1 张牌。销毁：目标对手弃 1 张牌。' }),
  base('warWorld', '战争世界', 'War World', 'empire', 5, 1, 4, { outpost: true, primary: { combat: 3 }, ally: { combat: 4 }, text: '前哨。获得 3 战斗。同盟：获得 4 战斗。' }),

  base('barterWorld', '易货世界', 'Barter World', 'federation', 4, 2, 4, { primaryChoice: [{ authority: 2 }, { trade: 2 }], scrap: { combat: 5 }, text: '选择：获得 2 权威或 2 贸易。销毁：获得 5 战斗。' }),
  base('centralOffice', '中央总署', 'Central Office', 'federation', 7, 1, 6, { primary: { trade: 2 }, ally: { topDeckNextShip: true }, text: '获得 2 贸易。同盟：本回合下一艘获得的飞船置于牌库顶。' }),
  ship('commandShip', '指挥舰', 'Command Ship', 'federation', 8, 1, { primary: { authority: 4, combat: 5, draw: 2 }, ally: { destroyBase: true }, text: '获得 4 权威、5 战斗并抽 2 张牌。同盟：可摧毁目标基地。' }),
  ship('cutter', '巡航快艇', 'Cutter', 'federation', 2, 3, { primary: { authority: 4, trade: 2 }, ally: { combat: 4 }, text: '获得 4 权威、2 贸易。同盟：获得 4 战斗。' }),
  base('defenseCenter', '防御中心', 'Defense Center', 'federation', 5, 1, 5, { outpost: true, primaryChoice: [{ authority: 3 }, { combat: 2 }], ally: { combat: 2 }, text: '前哨。选择：获得 3 权威或 2 战斗。同盟：获得 2 战斗。' }),
  ship('embassyYacht', '使馆游艇', 'Embassy Yacht', 'federation', 3, 2, { primary: { authority: 3, trade: 2, drawIfTwoBases: 2 }, text: '获得 3 权威、2 贸易。若你控制至少两座基地，抽 2 张牌。' }),
  ship('federationShuttle', '联邦穿梭机', 'Federation Shuttle', 'federation', 1, 3, { primary: { trade: 2 }, ally: { authority: 4 }, text: '获得 2 贸易。同盟：获得 4 权威。' }),
  ship('flagship', '旗舰', 'Flagship', 'federation', 6, 1, { primary: { combat: 5, draw: 1 }, ally: { authority: 5 }, text: '获得 5 战斗并抽 1 张牌。同盟：获得 5 权威。' }),
  ship('freighter', '货运舰', 'Freighter', 'federation', 4, 2, { primary: { trade: 4 }, ally: { topDeckNextShip: true }, text: '获得 4 贸易。同盟：本回合下一艘获得的飞船置于牌库顶。' }),
  base('portOfCall', '停靠港', 'Port of Call', 'federation', 6, 1, 6, { outpost: true, primary: { trade: 3 }, scrap: { draw: 1, destroyBase: true }, text: '前哨。获得 3 贸易。销毁：抽 1 张牌，可摧毁目标基地。' }),
  ship('tradeEscort', '贸易护航舰', 'Trade Escort', 'federation', 5, 1, { primary: { authority: 4, combat: 4 }, ally: { draw: 1 }, text: '获得 4 权威、4 战斗。同盟：抽 1 张牌。' }),
  base('tradingPost', '贸易站', 'Trading Post', 'federation', 3, 2, 4, { outpost: true, primaryChoice: [{ authority: 1 }, { trade: 1 }], scrap: { combat: 3 }, text: '前哨。选择：获得 1 权威或 1 贸易。销毁：获得 3 战斗。' })
].map(card => [card.id, Object.freeze(card)]));

export const CARD_DEFS = Object.freeze({
  ...CORE_DEFS, ...COLONY_WARS_DEFS, ...EVENT_DEFS,
  ...FRONTIERS_DEFS, ...CRISISFLEETSANDFORTRESSES_DEFS, ...CRISISBASESBATTLESHIPS_DEFS
});

const packSize = defs => Object.values(defs).reduce((sum, card) => sum + card.qty, 0);

export const EXPANSION_PACKS = Object.freeze([
  { id: 'core', name: '基础盒交易牌堆', en: 'Core Set', kind: 'trade', cards: 80, default: true, description: '48 种卡牌，共 80 张；标准基础环境。' },
  { id: 'colonyWars', name: '殖民战争交易牌堆', en: 'Colony Wars', kind: 'trade', cards: 80, default: false, description: '43 种全新卡牌，共 80 张；可单独或混洗。' },
  { id: 'events', name: '危机事件牌', en: 'Crisis: Events', kind: 'event', cards: 12, default: false, description: '8 种事件共 12 张，洗入交易牌库；翻出即结算。' },
  { id: 'frontiers', name: '边疆交易牌堆', en: 'Frontiers', kind: 'trade', cards: packSize(FRONTIERS_DEFS), default: false, description: `已实现 ${Object.keys(FRONTIERS_DEFS).length} 种 / ${packSize(FRONTIERS_DEFS)} 张交易牌；起始牌与探索者复用基础盒。` },
  { id: 'crisisFleets', name: '危机：舰队与要塞', en: 'Crisis: Fleets and Fortresses', kind: 'trade', cards: packSize(CRISISFLEETSANDFORTRESSES_DEFS), default: false, description: `已实现 ${Object.keys(CRISISFLEETSANDFORTRESSES_DEFS).length} 种 / ${packSize(CRISISFLEETSANDFORTRESSES_DEFS)} 张。` },
  { id: 'crisisBases', name: '危机：基地与战列舰', en: 'Crisis: Bases and Battleships', kind: 'trade', cards: packSize(CRISISBASESBATTLESHIPS_DEFS), default: false, description: `已实现 ${Object.keys(CRISISBASESBATTLESHIPS_DEFS).length} 种 / ${packSize(CRISISBASESBATTLESHIPS_DEFS)} 张。` }
]);

const TRADE_PACK_IDS = ['core', 'colonyWars', 'frontiers', 'crisisFleets', 'crisisBases'];

const expand = (pool, ids) => ids.flatMap(id => Array(CARD_DEFS[id].qty).fill(id));

export const CORE_TRADE_CARD_IDS = Object.values(CORE_DEFS)
  .filter(card => card.cost !== null && !['explorer', 'scout', 'viper'].includes(card.id))
  .map(card => card.id);
export const COLONY_WARS_TRADE_CARD_IDS = Object.values(COLONY_WARS_DEFS).map(card => card.id);
export const EVENT_CARD_IDS = Object.values(EVENT_DEFS).map(card => card.id);
export const FRONTIERS_TRADE_CARD_IDS = Object.values(FRONTIERS_DEFS).map(card => card.id);
export const CRISIS_FLEETS_CARD_IDS = Object.values(CRISISFLEETSANDFORTRESSES_DEFS).map(card => card.id);
export const CRISIS_BASES_CARD_IDS = Object.values(CRISISBASESBATTLESHIPS_DEFS).map(card => card.id);
export const TRADE_CARD_IDS = CORE_TRADE_CARD_IDS;
export const TRADE_DECK_SIZE = expand(CARD_DEFS, CORE_TRADE_CARD_IDS).length;
export const COLONY_WARS_DECK_SIZE = expand(CARD_DEFS, COLONY_WARS_TRADE_CARD_IDS).length;
export const EVENT_DECK_SIZE = expand(CARD_DEFS, EVENT_CARD_IDS).length;
export const FRONTIERS_DECK_SIZE = expand(CARD_DEFS, FRONTIERS_TRADE_CARD_IDS).length;

export function normalizeExpansions(config = {}) {
  const input = config.expansions || {};
  let sets;
  if (Array.isArray(input)) sets = [...input];
  else if (Array.isArray(input.sets)) sets = [...input.sets];
  else if (typeof input.core === 'boolean' || typeof input.colonyWars === 'boolean' || typeof input.events === 'boolean') {
    sets = [];
    if (input.core) sets.push('core');
    if (input.colonyWars) sets.push('colonyWars');
    if (input.events) sets.push('events');
  } else if (config.sets) sets = String(config.sets).split(',');
  else if (config.deck) {
    sets = config.deck === 'mixed' ? ['core', 'colonyWars'] : [config.deck];
    if (config.events || input.events) sets.push('events');
  } else sets = EXPANSION_PACKS.filter(pack => pack.default).map(pack => pack.id);
  sets = [...new Set(sets.filter(id => EXPANSION_PACKS.some(pack => pack.id === id)))];
  if (!sets.some(id => TRADE_PACK_IDS.includes(id))) sets.unshift('core');
  const core = sets.includes('core');
  const colonyWars = sets.includes('colonyWars');
  const events = sets.includes('events');
  const frontiers = sets.includes('frontiers');
  const crisisFleets = sets.includes('crisisFleets');
  const crisisBases = sets.includes('crisisBases');
  const tradeSets = sets.filter(id => TRADE_PACK_IDS.includes(id));
  const deck = tradeSets.length > 1 ? 'mixed' : (tradeSets[0] || 'core');
  return { sets, core, colonyWars, events, frontiers, crisisFleets, crisisBases, tradeSets, deck };
}

export function buildTradeDeckIds(config = {}) {
  const options = config.sets ? normalizeExpansions(config) : (config.expansions?.deck ? config.expansions : normalizeExpansions({ expansions: config.expansions }));
  const ids = [];
  if (options.core) ids.push(...expand(CARD_DEFS, CORE_TRADE_CARD_IDS));
  if (options.colonyWars) ids.push(...expand(CARD_DEFS, COLONY_WARS_TRADE_CARD_IDS));
  if (options.events) ids.push(...expand(CARD_DEFS, EVENT_CARD_IDS));
  if (options.frontiers) ids.push(...expand(CARD_DEFS, FRONTIERS_TRADE_CARD_IDS));
  if (options.crisisFleets) ids.push(...expand(CARD_DEFS, CRISIS_FLEETS_CARD_IDS));
  if (options.crisisBases) ids.push(...expand(CARD_DEFS, CRISIS_BASES_CARD_IDS));
  return ids;
}

export function getCardDef(uidOrId, state) {
  const instance = state?.cards?.[uidOrId];
  const id = instance?.id || uidOrId;
  const def = CARD_DEFS[id];
  if (!def) throw new Error(`未知卡牌: ${uidOrId}`);
  if (!instance?.copiedFrom) return def;
  const copied = CARD_DEFS[state.cards[instance.copiedFrom].id];
  return { ...copied, id: def.id, name: def.name, en: def.en, cost: def.cost, set: def.set, copyShip: false, copyBase: false };
}

export function getFactions(uid, state) {
  const instance = state.cards[uid];
  const def = getCardDef(uid, state);
  const factions = def.faction === 'neutral' ? [] : [def.faction];
  if (instance?.copiedFrom) {
    if (!factions.includes('machine')) factions.push('machine');
    const original = CARD_DEFS[state.cards[instance.copiedFrom].id].faction;
    if (original !== 'neutral' && !factions.includes(original)) factions.push(original);
  }
  return factions;
}
