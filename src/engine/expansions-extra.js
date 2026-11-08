// 由 tools/build-extra-expansions.mjs 生成，请勿手改。
// 卡名/阵营/费用/防御/张数取自本地 sr_all_cards.json；效果为显式声明。

const ship = (id, name, en, faction, cost, qty, extra = {}) => ({
  id, name, en, type: 'ship', faction, cost, qty, set: extra.set || 'frontiers', ...extra
});
const base = (id, name, en, faction, cost, qty, defense, extra = {}) => ({
  id, name, en, type: 'base', faction, cost, qty, defense, set: extra.set || 'frontiers', ...extra
});

/* frontiers：42 种 */
export const FRONTIERS_DEFS = Object.fromEntries([
  ship("fr_blobAlpha", "虫群首领", "Blob Alpha", "blob", 6, 1, {"primary":{"combat":10},"set":"frontiers","text":"获得 10 战斗"}),
  ship("fr_blobMiner", "虫群矿工", "Blob Miner", "blob", 2, 3, {"primary":{"trade":3},"optionalPrimary":{"scrapRow":1},"scrap":{"combat":2},"set":"frontiers","text":"获得 3 贸易\n可选：销毁交易行 1 张牌\n销毁：获得 2 战斗"}),
  ship("fr_burrower", "掘地者", "Burrower", "blob", 3, 2, {"primary":{"combat":5},"ally":{"draw":1},"scrap":{"acquireFreeMax":4},"set":"frontiers","text":"获得 5 战斗\n同盟：抽 1 张牌\n销毁：免费获得费用不超过 4 的卡"}),
  ship("fr_crusher", "碾压者", "Crusher", "blob", 3, 2, {"primary":{"combat":6},"ally":{"trade":2},"set":"frontiers","text":"获得 6 战斗\n同盟：获得 2 贸易"}),
  ship("fr_hiveQueen", "蜂巢女王", "Hive Queen", "blob", 7, 1, {"primary":{"combat":7,"draw":1},"ally":{"combat":3},"doubleAlly":{"combat":3},"set":"frontiers","text":"获得 7 战斗；抽 1 张牌\n同盟：获得 3 战斗\n双同盟：获得 3 战斗"}),
  base("fr_infestedMoon", "虫染之月", "Infested Moon", "blob", 6, 1, 5, {"primary":{"combat":4},"ally":{"draw":1},"doubleAlly":{"draw":1},"set":"frontiers","text":"获得 4 战斗\n同盟：抽 1 张牌\n双同盟：抽 1 张牌"}),
  ship("fr_moonwurmHatchling", "月蠕幼体", "Moonwurm Hatchling", "blob", 4, 2, {"primaryChoice":[{"trade":3},{"destroyBase":true}],"ally":{"combat":3},"set":"frontiers","text":"获得 3 贸易 或 摧毁目标基地\n同盟：获得 3 战斗"}),
  base("fr_nestingGround", "巢穴地", "Nesting Ground", "blob", 4, 1, 5, {"primary":{"trade":2},"ally":{"combat":4},"set":"frontiers","text":"获得 2 贸易\n同盟：获得 4 战斗"}),
  ship("fr_pulverizer", "粉碎者", "Pulverizer", "blob", 5, 1, {"primary":{"scrapRowGainCostCombat":true},"ally":{"draw":1},"set":"frontiers","text":"销毁交易行一张牌并获得等同于其费用的战斗\n同盟：抽 1 张牌"}),
  base("fr_spikeCluster", "尖刺簇", "Spike Cluster", "blob", 2, 2, 3, {"primary":{"combat":2},"ally":{"trade":1},"set":"frontiers","text":"获得 2 战斗\n同盟：获得 1 贸易"}),
  ship("fr_stinger", "毒刺战机", "Stinger", "blob", 1, 3, {"primary":{"combat":3},"ally":{"combat":3},"scrap":{"trade":1},"set":"frontiers","text":"获得 3 战斗\n同盟：获得 3 战斗\n销毁：获得 1 贸易"}),
  base("fr_swarmCluster", "虫群集群", "Swarm Cluster", "blob", 8, 1, 8, {"primary":{"combat":5},"ally":{"combat":3},"doubleAlly":{"combat":3},"set":"frontiers","text":"获得 5 战斗\n同盟：获得 3 战斗\n双同盟：获得 3 战斗"}),
  ship("fr_builderBot", "建造机器人", "Builder Bot", "machine", 1, 3, {"primary":{"trade":1},"optionalPrimary":{"scrapOwn":1,"zones":["discard"]},"ally":{"trade":1},"scrap":{"combat":2},"set":"frontiers","text":"获得 1 贸易\n可选：销毁 1 张牌\n同盟：获得 1 贸易\n销毁：获得 2 战斗"}),
  base("fr_conversionYard", "改装厂", "Conversion Yard", "machine", 5, 1, 4, {"optionalPrimary":{"scrapOwn":1,"zones":["hand"],"combatIfScrap":4},"set":"frontiers","text":"可选：销毁 1 张牌，若销毁则获得 4 战斗"}),
  base("fr_defenseSystem", "防御系统", "Defense System", "machine", 4, 2, 4, {"primary":{"combat":2},"ally":{"combat":2},"set":"frontiers","text":"获得 2 战斗\n同盟：获得 2 战斗"}),
  ship("fr_destroyerBot", "破坏机器人", "Destroyer Bot", "machine", 3, 3, {"primary":{"combat":5},"optionalPrimary":{"scrapOwn":1,"zones":["discard"]},"set":"frontiers","text":"获得 5 战斗\n可选：销毁 1 张牌"}),
  ship("fr_enforcerMech", "执法机甲", "Enforcer Mech", "machine", 5, 1, {"primary":{"combat":5},"optionalPrimary":{"scrapOwn":1,"zones":["hand","discard"]},"ally":{"destroyBase":true},"scrap":{"draw":1},"set":"frontiers","text":"获得 5 战斗\n可选：销毁 1 张牌\n同盟：摧毁目标基地\n销毁：抽 1 张牌"}),
  base("fr_integrationPort", "整合港", "Integration Port", "machine", 3, 2, 4, {"primary":{"trade":1},"set":"frontiers","text":"获得 1 贸易"}),
  ship("fr_nanobotSwarm", "纳米机器群", "Nanobot Swarm", "machine", 8, 1, {"primary":{"combat":5,"draw":2},"optionalPrimary":{"scrapOwn":2,"minScrap":1,"zones":["hand","discard"]},"set":"frontiers","text":"获得 5 战斗；抽 2 张牌\n可选：销毁 2 张牌"}),
  base("fr_neuralNexus", "神经枢纽", "Neural Nexus", "machine", 7, 1, 4, {"primary":{"scrapOwn":1,"zones":["hand","discard"],"gainCostCombat":true},"ally":{"draw":1},"set":"frontiers","text":"销毁 1 张牌并获得等同于其费用的战斗\n同盟：抽 1 张牌"}),
  ship("fr_plasmaBot", "等离子机器人", "Plasma Bot", "machine", 2, 3, {"primary":{"combat":3},"optionalPrimary":{"scrapOwn":1,"zones":["hand"]},"ally":{"combat":2},"set":"frontiers","text":"获得 3 战斗\n可选：销毁 1 张牌\n同盟：获得 2 战斗"}),
  base("fr_reclamationStation", "回收站", "Reclamation Station", "machine", 6, 1, 4, {"primary":{"scrapOwn":1,"zones":["discard"]},"scrap":{"combatPerScrapOwn":3},"set":"frontiers","text":"销毁 1 张牌\n销毁：本回合每销毁一张牌获得 3 战斗"}),
  base("fr_capturedOutpost", "被占领前哨", "Captured Outpost", "empire", 3, 2, 4, {"primary":{"discardThenDraw":1},"set":"frontiers","text":"弃 1 张牌再抽 1 张牌"}),
  ship("fr_cargoCraft", "货运艇", "Cargo Craft", "empire", 2, 3, {"primary":{"trade":2,"discardOpponent":1},"ally":{"combat":4},"set":"frontiers","text":"获得 2 贸易；目标对手弃 1 张牌\n同盟：获得 4 战斗"}),
  ship("fr_farmShip", "农场船", "Farm Ship", "empire", 4, 2, {"primary":{"trade":3,"discardThenDraw":1},"scrap":{"combat":4},"set":"frontiers","text":"获得 3 贸易；弃 1 张牌再抽 1 张牌\n销毁：获得 4 战斗"}),
  ship("fr_frontierHawk", "边疆鹰", "Frontier Hawk", "empire", 1, 3, {"primary":{"combat":3,"discardThenDraw":1},"set":"frontiers","text":"获得 3 战斗；弃 1 张牌再抽 1 张牌"}),
  ship("fr_hammerhead", "锤头舰", "Hammerhead", "empire", 5, 1, {"primary":{"combat":3,"draw":1,"discardOpponent":1},"ally":{"draw":1},"set":"frontiers","text":"获得 3 战斗；抽 1 张牌；目标对手弃 1 张牌\n同盟：抽 1 张牌"}),
  ship("fr_imperialFlagship", "帝国旗舰", "Imperial Flagship", "empire", 8, 1, {"primary":{"combat":7,"draw":2},"ally":{"discardOpponent":1},"set":"frontiers","text":"获得 7 战斗；抽 2 张牌\n同盟：目标对手弃 1 张牌"}),
  base("fr_jammingTerminal", "干扰终端", "Jamming Terminal", "empire", 5, 1, 6, {"primary":{"combat":2,"discardOpponent":1},"set":"frontiers","text":"获得 2 战斗；目标对手弃 1 张牌"}),
  ship("fr_lightCruiser", "轻型巡洋舰", "Light Cruiser", "empire", 3, 3, {"primary":{"combat":4,"discardOpponent":1},"ally":{"combat":2},"doubleAlly":{"draw":1},"set":"frontiers","text":"获得 4 战斗；目标对手弃 1 张牌\n同盟：获得 2 战斗\n双同盟：抽 1 张牌"}),
  base("fr_orbitalGunPlatform", "轨道炮台", "Orbital Gun Platform", "empire", 4, 2, 4, {"primary":{"combat":3},"scrap":{"trade":3},"set":"frontiers","text":"获得 3 战斗\n销毁：获得 3 贸易"}),
  base("fr_siegeFortress", "攻城要塞", "Siege Fortress", "empire", 7, 1, 4, {"primary":{"combat":5},"ally":{"combat":4},"set":"frontiers","text":"获得 5 战斗\n同盟：获得 4 战斗"}),
  ship("fr_federationBattleship", "联邦战列舰", "Federation Battleship", "federation", 7, 1, {"primary":{"combat":5,"authority":5,"draw":1},"ally":{"destroyBase":true},"scrap":{"authority":10},"set":"frontiers","text":"获得 5 战斗；获得 5 权威；抽 1 张牌\n同盟：摧毁目标基地\n销毁：获得 10 权威"}),
  ship("fr_federationCruiser", "联邦巡洋舰", "Federation Cruiser", "federation", 5, 1, {"primary":{"combat":5,"authority":4},"ally":{"combat":2,"authority":2},"set":"frontiers","text":"获得 5 战斗；获得 4 权威\n同盟：获得 2 战斗；获得 2 权威"}),
  ship("fr_frontierRunner", "边疆信使", "Frontier Runner", "federation", 1, 3, {"primary":{"trade":2,"authority":2},"set":"frontiers","text":"获得 2 贸易；获得 2 权威"}),
  ship("fr_gateship", "星门舰", "Gateship", "federation", 6, 1, {"primary":{"acquireCheapFree":{"maxCost":6,"toTop":true}},"ally":{"authority":5},"set":"frontiers","text":"免费获得费用不超过 6 的卡并置于牌库顶\n同盟：获得 5 权威"}),
  base("fr_ionStation", "离子站", "Ion Station", "federation", 5, 1, 4, {"primary":{"trade":2},"ally":{"trade":1},"doubleAlly":{"combat":4,"authority":4},"set":"frontiers","text":"获得 2 贸易\n同盟：获得 1 贸易\n双同盟：获得 4 战斗；获得 4 权威"}),
  ship("fr_longHauler", "长途运输舰", "Long Hauler", "federation", 4, 2, {"primary":{"trade":3},"ally":{"trade":2},"scrap":{"topDeckNextBase":true},"set":"frontiers","text":"获得 3 贸易\n同盟：获得 2 贸易\n销毁：下一座获得的基地置于牌库顶"}),
  ship("fr_orbitalShuttle", "轨道穿梭机", "Orbital Shuttle", "federation", 2, 3, {"primary":{"trade":3,"authorityIfTwoBases":4,"drawIfTwoBases":1},"set":"frontiers","text":"获得 3 贸易；若控制两座以上基地则获得 4 权威；若控制两座以上基地则抽 1 张牌"}),
  base("fr_outlandStation", "边陲站", "Outland Station", "federation", 3, 3, 4, {"primaryChoice":[{"trade":1},{"authority":3}],"scrap":{"draw":1},"set":"frontiers","text":"获得 1 贸易 或 获得 3 权威\n销毁：抽 1 张牌"}),
  ship("fr_patrolBoat", "巡逻艇", "Patrol Boat", "federation", 3, 2, {"primary":{"combat":4,"authority":3},"ally":{"authority":2},"set":"frontiers","text":"获得 4 战斗；获得 3 权威\n同盟：获得 2 权威"}),
  base("fr_transitNexus", "中转枢纽", "Transit Nexus", "federation", 8, 1, 6, {"primary":{"combat":3,"trade":4,"authority":5},"set":"frontiers","text":"获得 4 贸易；获得 3 战斗；获得 5 权威"})
].map(card => [card.id, Object.freeze(card)]));

/* crisisFleetsAndFortresses：7 种 */
export const CRISISFLEETSANDFORTRESSES_DEFS = Object.fromEntries([
  base("cf_borderFort", "边境要塞", "Border Fort", "machine", 4, 1, 4, {"primaryChoice":[{"trade":1},{"combat":2}],"ally":{"scrapOwn":1,"zones":["hand","discard"]},"set":"crisisFleetsAndFortresses","text":"获得 1 贸易 或 获得 2 战斗\n同盟：销毁 1 张牌"}),
  base("cf_capitolWorld", "首都世界", "Capitol World", "federation", 8, 1, 4, {"primary":{"authority":6,"draw":1},"set":"crisisFleetsAndFortresses","text":"获得 6 权威；抽 1 张牌"}),
  ship("cf_cargoLaunch", "货运穿梭机", "Cargo Launch", "empire", 1, 2, {"primary":{"draw":1},"scrap":{"trade":1},"set":"crisisFleetsAndFortresses","text":"抽 1 张牌\n销毁：获得 1 贸易"}),
  ship("cf_customsFrigate", "海关护卫舰", "Customs Frigate", "federation", 4, 2, {"primary":{"acquireCheapFree":{"maxCost":4,"type":"ship","toTop":true}},"ally":{"combat":4},"scrap":{"draw":1},"set":"crisisFleetsAndFortresses","text":"免费获得费用不超过 4 的飞船并置于牌库顶\n同盟：获得 4 战斗\n销毁：抽 1 张牌"}),
  ship("cf_patrolBot", "巡逻机器人", "Patrol Bot", "machine", 2, 2, {"primaryChoice":[{"trade":2},{"combat":4}],"ally":{"scrapOwn":1,"zones":["hand","discard"]},"set":"crisisFleetsAndFortresses","text":"获得 2 贸易 或 获得 4 战斗\n同盟：销毁 1 张牌"}),
  ship("cf_spikePod", "尖刺荚", "Spike Pod", "blob", 1, 2, {"primary":{"combat":3},"optionalPrimary":{"scrapRow":2},"scrap":{"combat":2},"set":"crisisFleetsAndFortresses","text":"获得 3 战斗\n可选：销毁交易行 2 张牌\n销毁：获得 2 战斗"}),
  base("cf_starFortress", "星要塞", "Star Fortress", "empire", 7, 1, 4, {"primary":{"combat":3,"discardThenDraw":1},"ally":{"discardThenDraw":1},"set":"crisisFleetsAndFortresses","text":"获得 3 战斗；弃 1 张牌再抽 1 张牌\n同盟：弃 1 张牌再抽 1 张牌"})
].map(card => [card.id, Object.freeze(card)]));

/* crisisBasesBattleships：6 种 */
export const CRISISBASESBATTLESHIPS_DEFS = Object.fromEntries([
  ship("cb_defenseBot", "防御机器人", "Defense Bot", "machine", 2, 2, {"primary":{"combat":1,"combatIfTwoBases":8},"optionalPrimary":{"scrapOwn":1,"zones":["hand","discard"]},"set":"crisisBasesBattleships","text":"获得 1 战斗；若控制两座以上基地则获得 8 战斗\n可选：销毁 1 张牌"}),
  base("cb_fighterBase", "战机基地", "Fighter Base", "empire", 3, 2, 4, {"ally":{"discardOpponent":1},"set":"crisisBasesBattleships","text":"同盟：目标对手弃 1 张牌"}),
  ship("cb_imperialTrader", "帝国商船", "Imperial Trader", "empire", 5, 1, {"primary":{"trade":3,"draw":1},"ally":{"combat":4},"set":"crisisBasesBattleships","text":"获得 3 贸易；抽 1 张牌\n同盟：获得 4 战斗"}),
  ship("cb_obliterator", "歼灭者", "Obliterator", "blob", 6, 1, {"primary":{"combat":7,"combatIfEnemyTwoBases":6},"ally":{"draw":1},"set":"crisisBasesBattleships","text":"获得 7 战斗；若对手有两座以上基地则获得 6 战斗\n同盟：抽 1 张牌"}),
  ship("cb_tradeRaft", "贸易筏", "Trade Raft", "federation", 1, 2, {"primary":{"trade":1},"ally":{"draw":1},"scrap":{"trade":1},"set":"crisisBasesBattleships","text":"获得 1 贸易\n同盟：抽 1 张牌\n销毁：获得 1 贸易"}),
  base("cb_tradeWheel", "贸易转轮", "Trade Wheel", "blob", 3, 2, 5, {"primary":{"trade":1},"ally":{"combat":2},"set":"crisisBasesBattleships","text":"获得 1 贸易\n同盟：获得 2 战斗"})
].map(card => [card.id, Object.freeze(card)]));
