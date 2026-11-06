// Star Realms: Colony Wars (80-card standalone trade deck) and Crisis: Events.
// Card names, quantities and rules text were cross-checked against the local
// boardgame_rules archive and the official Wise Wizard Games product pages.
const ship = (id, name, en, faction, cost, qty, extra = {}) => ({
  id, name, en, type: 'ship', faction, cost, qty, set: 'colonyWars', ...extra
});
const base = (id, name, en, faction, cost, qty, defense, extra = {}) => ({
  id, name, en, type: 'base', faction, cost, qty, defense, set: 'colonyWars', ...extra
});
const event = (id, name, en, qty, text) => ({
  id, name, en, type: 'event', faction: 'neutral', cost: null, defense: null, qty, set: 'events', text
});
const own = (zones = ['hand', 'discard'], count = 1, optional = true) => ({ scrapOwn: count, zones, optional });
const scrapRow = count => ({ scrapRow: count });

export const COLONY_WARS_DEFS = Object.fromEntries([
  ship('battleBot', '战斗机器人', 'Battle Bot', 'machine', 1, 3, { primary: { combat: 2 }, optionalPrimary: own(['hand']), ally: { combat: 2 }, text: '获得 2 战斗。可销毁手牌一张牌。同盟：获得 2 战斗。' }),
  ship('solarSkiff', '太阳轻舟', 'Solar Skiff', 'federation', 1, 3, { primary: { trade: 2 }, ally: { draw: 1 }, text: '获得 2 贸易。同盟：抽 1 张牌。' }),
  ship('starBarge', '星际驳船', 'Star Barge', 'empire', 1, 3, { primary: { trade: 2 }, ally: { combat: 2, discardOpponent: 1 }, text: '获得 2 贸易。同盟：获得 2 战斗，目标对手弃 1 张牌。' }),
  ship('swarmer', '群袭虫', 'Swarmer', 'blob', 1, 3, { primary: { combat: 3 }, optionalPrimary: scrapRow(1), ally: { combat: 2 }, text: '获得 3 战斗。可销毁交易行一张牌。同盟：获得 2 战斗。' }),
  ship('lancer', '枪骑兵', 'Lancer', 'empire', 2, 3, { primary: { combat: 4, combatIfEnemyBase: 2 }, ally: { discardOpponent: 1 }, text: '获得 4 战斗；若对手控制基地，额外获得 2 战斗。同盟：目标对手弃 1 张牌。' }),
  ship('predator', '掠食者', 'Predator', 'blob', 2, 3, { primary: { combat: 4 }, ally: { draw: 1 }, text: '获得 4 战斗。同盟：抽 1 张牌。' }),
  ship('repairBot', '维修机器人', 'Repair Bot', 'machine', 2, 3, { primary: { trade: 2 }, optionalPrimary: own(['discard']), scrap: { combat: 2 }, text: '获得 2 贸易。可销毁弃牌堆一张牌。销毁：获得 2 战斗。' }),
  base('stellarReef', '星珊瑚礁', 'Stellar Reef', 'blob', 2, 3, 3, { primary: { trade: 1 }, scrap: { trade: 3 }, text: '获得 1 贸易。销毁：获得 3 贸易。' }),
  base('storageSilo', '储藏筒仓', 'Storage Silo', 'federation', 2, 2, 3, { primary: { authority: 2 }, ally: { trade: 2 }, text: '获得 2 权威。同盟：获得 2 贸易。' }),
  ship('tradeHauler', '贸易运输舰', 'Trade Hauler', 'federation', 2, 3, { primary: { trade: 3 }, ally: { authority: 3 }, text: '获得 3 贸易。同盟：获得 3 权威。' }),
  base('warningBeacon', '警戒信标', 'Warning Beacon', 'machine', 2, 3, 2, { outpost: true, primary: { combat: 2 }, toHandIfFaction: 'machine', text: '前哨。获得 2 战斗。若本回合打出过机械教团牌，获得时可置入手牌。' }),

  ship('cargoPod', '货运荚舱', 'Cargo Pod', 'blob', 3, 3, { primary: { trade: 3 }, ally: { combat: 3 }, scrap: { combat: 3 }, text: '获得 3 贸易。同盟：获得 3 战斗。销毁：获得 3 战斗。' }),
  ship('convoyBot', '护航机器人', 'Convoy Bot', 'machine', 3, 3, { primary: { combat: 4 }, optionalPrimary: own(), ally: { combat: 2 }, text: '获得 4 战斗。可销毁手牌或弃牌堆一张牌。同盟：获得 2 战斗。' }),
  ship('falcon', '猎鹰', 'Falcon', 'empire', 3, 2, { primary: { combat: 2, draw: 1 }, scrap: { discardOpponent: 1 }, text: '获得 2 战斗并抽 1 张牌。销毁：目标对手弃 1 张牌。' }),
  base('orbitalPlatform', '轨道平台', 'Orbital Platform', 'empire', 3, 3, 4, { primary: { discardThenDraw: 1 }, ally: { combat: 3 }, text: '可弃 1 张牌，然后抽 1 张牌。同盟：获得 3 战斗。' }),
  ship('patrolCutter', '巡逻快艇', 'Patrol Cutter', 'federation', 3, 3, { primary: { trade: 2, combat: 3 }, ally: { authority: 4 }, text: '获得 2 贸易、3 战斗。同盟：获得 4 权威。' }),
  ship('ravager', '蹂躏者', 'Ravager', 'blob', 3, 2, { primary: { combat: 6 }, optionalPrimary: scrapRow(2), text: '获得 6 战斗。可销毁交易行至多两张牌。' }),

  base('bioformer', '生物改造场', 'Bioformer', 'blob', 4, 2, 4, { primary: { combat: 3 }, scrap: { trade: 3 }, text: '获得 3 战斗。销毁：获得 3 贸易。' }),
  base('centralStation', '中央空间站', 'Central Station', 'federation', 4, 2, 5, { primary: { trade: 2, drawIfThreeBases: 1, authorityIfThreeBases: 4 }, text: '获得 2 贸易。若你控制至少三座基地，获得 4 权威并抽 1 张牌。' }),
  base('commandCenter', '指挥中心', 'Command Center', 'empire', 4, 2, 4, { outpost: true, empireShipBonus: 2, primary: { trade: 2 }, text: '前哨。获得 2 贸易。此后每打出一艘星际帝国飞船，获得 2 战斗。' }),
  ship('frontierFerry', '边疆渡轮', 'Frontier Ferry', 'federation', 4, 2, { primary: { trade: 3, authority: 4 }, scrap: { destroyBase: true }, text: '获得 3 贸易、4 权威。销毁：摧毁目标基地。' }),
  ship('gunship', '炮艇', 'Gunship', 'empire', 4, 2, { primary: { combat: 5, discardOpponent: 1 }, scrap: { trade: 4 }, text: '获得 5 战斗，目标对手弃 1 张牌。销毁：获得 4 贸易。' }),
  ship('miningMech', '采矿机甲', 'Mining Mech', 'machine', 4, 2, { primary: { trade: 3 }, optionalPrimary: own(), ally: { combat: 3 }, text: '获得 3 贸易。可销毁手牌或弃牌堆一张牌。同盟：获得 3 战斗。' }),
  base('theOracle', '神谕机', 'The Oracle', 'machine', 4, 1, 5, { outpost: true, primary: { scrapOwn: 1, zones: ['hand'] }, ally: { combat: 3 }, text: '前哨。销毁手牌一张牌。同盟：获得 3 战斗。' }),

  ship('agingBattleship', '老旧战列舰', 'Aging Battleship', 'empire', 5, 1, { primary: { combat: 5 }, ally: { draw: 1 }, scrap: { combat: 2, draw: 2 }, text: '获得 5 战斗。同盟：抽 1 张牌。销毁：获得 2 战斗并抽 2 张牌。' }),
  ship('colonySeedShip', '殖民播种舰', 'Colony Seed Ship', 'federation', 5, 1, { primary: { trade: 3, combat: 3, authority: 3 }, toHandIfFaction: 'federation', text: '获得 3 贸易、3 战斗、3 权威。若本回合打出过贸易联邦牌，获得时可置入手牌。' }),
  ship('heavyCruiser', '重型巡洋舰', 'Heavy Cruiser', 'empire', 5, 1, { primary: { combat: 4, draw: 1 }, ally: { draw: 1 }, text: '获得 4 战斗并抽 1 张牌。同盟：抽 1 张牌。' }),
  ship('mechCruiser', '机甲巡洋舰', 'Mech Cruiser', 'machine', 5, 1, { primary: { combat: 6 }, optionalPrimary: own(), ally: { destroyBase: true }, text: '获得 6 战斗。可销毁手牌或弃牌堆一张牌。同盟：摧毁目标基地。' }),
  ship('parasite', '寄生体', 'Parasite', 'blob', 5, 1, { primaryChoice: [{ combat: 6 }, { acquireFreeMax: 6 }], ally: { draw: 1 }, text: '选择：获得 6 战斗；或免费获得一张费用不高于 6 的牌。同盟：抽 1 张牌。' }),
  base('stealthTower', '隐匿尖塔', 'Stealth Tower', 'machine', 5, 1, 5, { outpost: true, copyBase: true, text: '前哨。本回合结束时前，复制场上任意一座基地，并额外获得其阵营。' }),

  base('federationShipyard', '联邦船坞', 'Federation Shipyard', 'federation', 6, 1, 6, { outpost: true, primary: { trade: 2 }, ally: { topDeckNextAny: true }, text: '前哨。获得 2 贸易。同盟：本回合下一张获得的飞船或基地置于牌库顶。' }),
  base('frontierStation', '边疆空间站', 'Frontier Station', 'machine', 6, 1, 6, { outpost: true, primaryChoice: [{ trade: 2 }, { combat: 3 }], text: '前哨。选择：获得 2 贸易或 3 战斗。' }),
  ship('peacekeeper', '和平卫士', 'Peacekeeper', 'federation', 6, 1, { primary: { combat: 6, authority: 6 }, ally: { draw: 1 }, text: '获得 6 战斗、6 权威。同盟：抽 1 张牌。' }),
  base('plasmaVent', '等离子喷口', 'Plasma Vent', 'blob', 6, 1, 5, { primary: { combat: 4 }, toHandIfFaction: 'blob', scrap: { destroyBase: true }, text: '获得 4 战斗。若本回合打出过虫群牌，获得时可置入手牌。销毁：摧毁目标基地。' }),
  base('supplyDepot', '补给站', 'Supply Depot', 'empire', 6, 1, 5, { outpost: true, primary: { depot: true }, ally: { draw: 1 }, text: '前哨。弃至多两张牌，每弃一张获得 2 贸易或 2 战斗。同盟：抽 1 张牌。' }),
  base('imperialPalace', '帝国宫殿', 'Imperial Palace', 'empire', 7, 1, 6, { outpost: true, primary: { draw: 1, discardOpponent: 1 }, ally: { combat: 4 }, text: '前哨。抽 1 张牌，目标对手弃 1 张牌。同盟：获得 4 战斗。' }),
  base('loyalColony', '忠诚殖民地', 'Loyal Colony', 'federation', 7, 1, 6, { primary: { trade: 3, combat: 3, authority: 3 }, text: '获得 3 贸易、3 战斗、3 权威。' }),
  ship('moonwurm', '月蚀巨虫', 'Moonwurm', 'blob', 7, 1, { primary: { combat: 8, draw: 1 }, ally: { acquireCheapFree: { maxCost: 2, toHand: true } }, text: '获得 8 战斗并抽 1 张牌。同盟：免费获得一张费用不高于 2 的牌并置入手牌。' }),
  ship('theWrecker', '拆解者', 'The Wrecker', 'machine', 7, 1, { primary: { combat: 6 }, optionalPrimary: own(['hand', 'discard'], 2), ally: { draw: 1 }, text: '获得 6 战斗。可销毁手牌或弃牌堆至多两张牌。同盟：抽 1 张牌。' }),

  ship('emperorsDreadnaught', '皇帝无畏舰', "Emperor's Dreadnaught", 'empire', 8, 1, { primary: { combat: 8, draw: 1, discardOpponent: 1 }, toHandIfFaction: 'empire', text: '获得 8 战斗，抽 1 张牌，目标对手弃 1 张牌。若本回合打出过星际帝国牌，获得时可置入手牌。' }),
  base('factoryWorld', '工厂世界', 'Factory World', 'federation', 8, 1, 7, { outpost: true, primary: { trade: 3, nextAcquireToHand: true }, text: '前哨。获得 3 贸易。本回合下一张获得的飞船或基地置入手牌。' }),
  ship('leviathan', '利维坦', 'Leviathan', 'blob', 8, 1, { primary: { combat: 9, draw: 1 }, optionalPrimary: { destroyBase: true }, ally: { acquireCheapFree: { maxCost: 3, toHand: true } }, text: '获得 9 战斗并抽 1 张牌；可摧毁目标基地。同盟：免费获得一张费用不高于 3 的牌并置入手牌。' }),
  base('theIncinerator', '焚化炉', 'The Incinerator', 'machine', 8, 1, 7, { outpost: true, primary: { scrapOwn: 2, zones: ['hand', 'discard'], upTo: true }, ally: { combatPerScrapOwn: 2 }, text: '前哨。销毁手牌或弃牌堆至多两张牌。同盟：本回合每销毁一张手牌或弃牌堆牌便获得 2 战斗。' })
].map(card => [card.id, Object.freeze(card)]));

export const EVENT_DEFS = Object.fromEntries([
  event('blackHole', '黑洞', 'Black Hole', 1, '每名玩家可弃至多两张手牌；每少弃一张，失去 4 权威（事件不会使权威低于 1）。'),
  event('bombardment', '轨道轰击', 'Bombardment', 1, '每名玩家选择摧毁一座自己控制的基地，或失去 6 权威（事件不会使权威低于 1）。'),
  event('comet', '彗星', 'Comet', 2, '每名玩家可销毁手牌或弃牌堆至多两张牌。'),
  event('galacticSummit', '银河峰会', 'Galactic Summit', 1, '每名玩家获得 7 权威。'),
  event('quasar', '类星体', 'Quasar', 2, '每名玩家抽两张牌。'),
  event('supernova', '超新星', 'Supernova', 1, '每名玩家失去 5 权威（不会低于 1）；销毁交易行所有牌并立即补齐。'),
  event('tradeMission', '贸易任务', 'Trade Mission', 2, '当前回合玩家获得 4 贸易，并可将下一艘购入飞船置于牌库顶；其他玩家各抽两张牌。'),
  event('warpJump', '跃迁', 'Warp Jump', 2, '每名玩家抽三张牌，然后选择其中两张按任意顺序放回牌库顶。')
].map(card => [card.id, Object.freeze(card)]));
