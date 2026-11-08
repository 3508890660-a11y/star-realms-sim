/**
 * 从本地规则库 sr_all_cards.json 生成扩展卡牌定义。
 *
 * 设计约束：
 *  - 名称/阵营/费用/防御/张数一律取自 JSON，不手写，避免抄错；
 *  - 效果由下方 EFFECTS 显式映射，未映射的卡不生成，并在输出里列出；
 *  - 生成文件入库，本脚本只在扩充卡池时手动运行。
 *
 * 用法：
 *   node tools/build-extra-expansions.mjs "C:/Users/张涵/WorkBuddy/2026-10-25-10-04-46/boardgame_rules/sr_all_cards.json"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];
if (!source || !fs.existsSync(source)) throw new Error('请传入 sr_all_cards.json 的绝对路径');
const db = JSON.parse(fs.readFileSync(source, 'utf8'));
const byId = new Map(db.cards.map(card => [card.id, card]));

const FACTION = {
  'Blob': 'blob', 'Machine Cult': 'machine', 'Star Empire': 'empire', 'Trade Federation': 'federation', 'Unaligned': 'neutral'
};

// 已实现卡：key 为 JSON 卡 id，值为声明式效果（与 src/engine/engine.js 的效果键一致）。
const EFFECTS = {
  /* ── Frontiers 交易牌堆 ───────────────────────────── */
  blobAlpha: { name: '虫群首领', primary: { combat: 10 } },
  blobMiner: { name: '虫群矿工', primary: { trade: 3 }, optionalPrimary: { scrapRow: 1 }, scrap: { combat: 2 } },
  crusher: { name: '碾压者', primary: { combat: 6 }, ally: { trade: 2 } },
  stinger: { name: '毒刺战机', primary: { combat: 3 }, ally: { combat: 3 }, scrap: { trade: 1 } },
  spikeCluster: { name: '尖刺簇', primary: { combat: 2 }, ally: { trade: 1 } },
  nestingGround: { name: '巢穴地', primary: { trade: 2 }, ally: { combat: 4 } },
  defenseSystem: { name: '防御系统', primary: { combat: 2 }, ally: { combat: 2 } },
  integrationPort: { name: '整合港', primary: { trade: 1 } },
  builderBot: { name: '建造机器人', primary: { trade: 1 }, optionalPrimary: { scrapOwn: 1, zones: ['discard'] }, ally: { trade: 1 }, scrap: { combat: 2 } },
  destroyerBot: { name: '破坏机器人', primary: { combat: 5 }, optionalPrimary: { scrapOwn: 1, zones: ['discard'] } },
  enforcerMech: { name: '执法机甲', primary: { combat: 5 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] }, ally: { destroyBase: true }, scrap: { draw: 1 } },
  plasmaBot: { name: '等离子机器人', primary: { combat: 3 }, optionalPrimary: { scrapOwn: 1, zones: ['hand'] }, ally: { combat: 2 } },
  frontierRunner: { name: '边疆信使', primary: { trade: 2, authority: 2 } },
  patrolBoat: { name: '巡逻艇', primary: { combat: 4, authority: 3 }, ally: { authority: 2 } },
  federationCruiser: { name: '联邦巡洋舰', primary: { combat: 5, authority: 4 }, ally: { combat: 2, authority: 2 } },
  federationBattleship: { name: '联邦战列舰', primary: { combat: 5, authority: 5, draw: 1 }, ally: { destroyBase: true }, scrap: { authority: 10 } },
  siegeFortress: { name: '攻城要塞', primary: { combat: 5 }, ally: { combat: 4 } },
  orbitalGunPlatform: { name: '轨道炮台', primary: { combat: 3 }, scrap: { trade: 3 } },
  jammingTerminal: { name: '干扰终端', primary: { combat: 2, discardOpponent: 1 } },
  cargoCraft: { name: '货运艇', primary: { trade: 2, discardOpponent: 1 }, ally: { combat: 4 } },
  hammerhead: { name: '锤头舰', primary: { combat: 3, draw: 1, discardOpponent: 1 }, ally: { draw: 1 } },
  outlandStation: { name: '边陲站', primaryChoice: [{ trade: 1 }, { authority: 3 }], scrap: { draw: 1 } },
  transitNexus: { name: '中转枢纽', primary: { combat: 3, trade: 4, authority: 5 } },
  imperialFlagship: { name: '帝国旗舰', primary: { combat: 7, draw: 2 }, ally: { discardOpponent: 1 } },
  moonwurmHatchling: { name: '月蠕幼体', primaryChoice: [{ trade: 3 }, { destroyBase: true }], ally: { combat: 3 } },
  burrower: { name: '掘地者', primary: { combat: 5 }, ally: { draw: 1 }, scrap: { acquireFreeMax: 4 } },
  hiveQueen: { name: '蜂巢女王', primary: { combat: 7, draw: 1 }, ally: { combat: 3 }, doubleAlly: { combat: 3 } },
  infestedMoon: { name: '虫染之月', primary: { combat: 4 }, ally: { draw: 1 }, doubleAlly: { draw: 1 } },
  pulverizer: { name: '粉碎者', primary: { scrapRowGainCostCombat: true }, ally: { draw: 1 } },
  swarmCluster: { name: '虫群集群', primary: { combat: 5 }, ally: { combat: 3 }, doubleAlly: { combat: 3 } },
  conversionYard: { name: '改装厂', optionalPrimary: { scrapOwn: 1, zones: ['hand'], combatIfScrap: 4 } },
  nanobotSwarm: { name: '纳米机器群', primary: { combat: 5, draw: 2 }, optionalPrimary: { scrapOwn: 2, minScrap: 1, zones: ['hand', 'discard'] } },
  neuralNexus: { name: '神经枢纽', primary: { scrapOwn: 1, zones: ['hand', 'discard'], gainCostCombat: true }, ally: { draw: 1 } },
  reclamationStation: { name: '回收站', primary: { scrapOwn: 1, zones: ['discard'] }, scrap: { combatPerScrapOwn: 3 } },
  capturedOutpost: { name: '被占领前哨', primary: { discardThenDraw: 1 } },
  farmShip: { name: '农场船', primary: { trade: 3, discardThenDraw: 1 }, scrap: { combat: 4 } },
  frontierHawk: { name: '边疆鹰', primary: { combat: 3, discardThenDraw: 1 } },
  lightCruiser: { name: '轻型巡洋舰', primary: { combat: 4, discardOpponent: 1 }, ally: { combat: 2 }, doubleAlly: { draw: 1 } },
  gateship: { name: '星门舰', primary: { acquireCheapFree: { maxCost: 6, toTop: true } }, ally: { authority: 5 } },
  ionStation: { name: '离子站', primary: { trade: 2 }, ally: { trade: 1 }, doubleAlly: { combat: 4, authority: 4 } },
  longHauler: { name: '长途运输舰', primary: { trade: 3 }, ally: { trade: 2 }, scrap: { topDeckNextBase: true } },
  orbitalShuttle: { name: '轨道穿梭机', primary: { trade: 3, authorityIfTwoBases: 4, drawIfTwoBases: 1 } },
  customsFrigate: { name: '海关护卫舰', primary: { acquireCheapFree: { maxCost: 4, type: 'ship', toTop: true } }, ally: { combat: 4 }, scrap: { draw: 1 } },
  spikePod: { name: '尖刺荚', primary: { combat: 3 }, optionalPrimary: { scrapRow: 2 }, scrap: { combat: 2 } },
  starFortress: { name: '星要塞', primary: { combat: 3, discardThenDraw: 1 }, ally: { discardThenDraw: 1 } },
  defenseBot: { name: '防御机器人', primary: { combat: 1, combatIfTwoBases: 8 }, optionalPrimary: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  obliterator: { name: '歼灭者', primary: { combat: 7, combatIfEnemyTwoBases: 6 }, ally: { draw: 1 } },

  /* ── Crisis: Fleets and Fortresses ────────────────── */
  borderFort: { name: '边境要塞', primaryChoice: [{ trade: 1 }, { combat: 2 }], ally: { scrapOwn: 1, zones: ['hand', 'discard'] } },
  capitolWorld: { name: '首都世界', primary: { authority: 6, draw: 1 } },
  cargoLaunch: { name: '货运穿梭机', primary: { draw: 1 }, scrap: { trade: 1 } },
  patrolBot: { name: '巡逻机器人', primaryChoice: [{ trade: 2 }, { combat: 4 }], ally: { scrapOwn: 1, zones: ['hand', 'discard'] } },

  /* ── Crisis: Bases and Battleships ────────────────── */
  fighterBase: { name: '战机基地', ally: { discardOpponent: 1 } },
  imperialTrader: { name: '帝国商船', primary: { trade: 3, draw: 1 }, ally: { combat: 4 } },
  tradeRaft: { name: '贸易筏', primary: { trade: 1 }, ally: { draw: 1 }, scrap: { trade: 1 } },
  tradeWheel: { name: '贸易转轮', primary: { trade: 1 }, ally: { combat: 2 } }
};

const SETS = [
  { id: 'frontiers', prefix: 'fr', skip: ['scout', 'viper', 'explorer'] },
  { id: 'crisisFleetsAndFortresses', prefix: 'cf', skip: [] },
  { id: 'crisisBasesBattleships', prefix: 'cb', skip: [] }
];

/**
 * 按「已实现的效果」生成中文卡面。
 * 不直接翻译英文卡面：脚本会解析 text 做决策，卡面必须与引擎真实行为一致，
 * 未实现的效果绝不会出现在卡面上（对应的卡根本不会生成）。
 */
function describeEffect(effect) {
  if (!effect) return '';
  const parts = [];
  const num = n => Number(n);
  if (effect.trade) parts.push(`获得 ${num(effect.trade)} 贸易`);
  if (effect.combat) parts.push(`获得 ${num(effect.combat)} 战斗`);
  if (effect.authority) parts.push(`获得 ${num(effect.authority)} 权威`);
  if (effect.combatIfEnemyBase) parts.push(`若对手有基地则获得 ${num(effect.combatIfEnemyBase)} 战斗`);
  if (effect.combatIfTwoBases) parts.push(`若控制两座以上基地则获得 ${num(effect.combatIfTwoBases)} 战斗`);
  if (effect.combatIfEnemyTwoBases) parts.push(`若对手有两座以上基地则获得 ${num(effect.combatIfEnemyTwoBases)} 战斗`);
  if (effect.authorityIfTwoBases) parts.push(`若控制两座以上基地则获得 ${num(effect.authorityIfTwoBases)} 权威`);
  if (effect.combatPerScrapOwn) parts.push(`本回合每销毁一张牌获得 ${num(effect.combatPerScrapOwn)} 战斗`);
  if (effect.draw) parts.push(`抽 ${num(effect.draw)} 张牌`);
  if (effect.drawIfTwoBases) parts.push(`若控制两座以上基地则抽 ${num(effect.drawIfTwoBases)} 张牌`);
  if (effect.discardOpponent) parts.push(`目标对手弃 ${num(effect.discardOpponent)} 张牌`);
  if (effect.destroyBase) parts.push('摧毁目标基地');
  if (effect.destroyAndOrScrap) parts.push('摧毁目标基地或销毁交易行一张牌');
  if (effect.scrapRow) parts.push(`销毁交易行 ${num(effect.scrapRow)} 张牌`);
  if (effect.scrapOwn) parts.push(`销毁 ${num(effect.scrapOwn)} 张牌${effect.gainCostCombat ? '并获得等同于其费用的战斗' : ''}${effect.combatIfScrap ? `，若销毁则获得 ${num(effect.combatIfScrap)} 战斗` : ''}`);
  if (effect.scrapRowGainCostCombat) parts.push('销毁交易行一张牌并获得等同于其费用的战斗');
  if (effect.acquireFreeMax !== undefined) parts.push(`免费获得费用不超过 ${num(effect.acquireFreeMax)} 的卡`);
  if (effect.acquireCheapFree) parts.push(`免费获得费用不超过 ${num(effect.acquireCheapFree.maxCost)} 的${effect.acquireCheapFree.type === 'ship' ? '飞船' : '卡'}${effect.acquireCheapFree.toTop ? '并置于牌库顶' : ''}`);
  if (effect.acquireShipFree) parts.push('免费获得一张飞船');
  if (effect.recycle) parts.push(`弃 ${num(effect.recycle)} 张牌再抽 ${num(effect.recycle)} 张牌`);
  if (effect.discardThenDraw) parts.push(`弃 ${num(effect.discardThenDraw)} 张牌再抽 ${num(effect.discardThenDraw)} 张牌`);
  if (effect.depot) parts.push('弃至多两张牌，每弃一张获得 2 贸易或 2 战斗');
  if (effect.topDeckNextBase) parts.push('下一座获得的基地置于牌库顶');
  if (effect.topDeckNextAny) parts.push('下一张获得的牌置于牌库顶');
  if (effect.nextAcquireToHand) parts.push('下一张获得的牌置入手牌');
  return parts.join('；');
}

function cardText(effect) {
  const lines = [];
  if (effect.primaryChoice) {
    lines.push(effect.primaryChoice.map(choice => describeEffect(choice)).filter(Boolean).join(' 或 '));
  } else {
    const primary = describeEffect(effect.primary);
    if (primary) lines.push(primary);
  }
  if (effect.optionalPrimary) {
    const optional = describeEffect(effect.optionalPrimary);
    if (optional) lines.push(`可选：${optional}`);
  }
  if (effect.ally) {
    const ally = describeEffect(effect.ally);
    if (ally) lines.push(`同盟：${ally}`);
  }
  if (effect.doubleAlly) {
    const doubleAlly = describeEffect(effect.doubleAlly);
    if (doubleAlly) lines.push(`双同盟：${doubleAlly}`);
  }
  if (effect.scrap) {
    const scrap = describeEffect(effect.scrap);
    if (scrap) lines.push(`销毁：${scrap}`);
  }
  return lines.join('\n');
}

const lines = [];
lines.push('// 由 tools/build-extra-expansions.mjs 生成，请勿手改。');
lines.push('// 卡名/阵营/费用/防御/张数取自本地 sr_all_cards.json；效果为显式声明。');
lines.push('');
lines.push("const ship = (id, name, en, faction, cost, qty, extra = {}) => ({");
lines.push("  id, name, en, type: 'ship', faction, cost, qty, set: extra.set || 'frontiers', ...extra");
lines.push('});');
lines.push("const base = (id, name, en, faction, cost, qty, defense, extra = {}) => ({");
lines.push("  id, name, en, type: 'base', faction, cost, qty, defense, set: extra.set || 'frontiers', ...extra");
lines.push('});');
lines.push('');

const skipped = [];
for (const set of SETS) {
  const entry = db.sets.find(item => item.id === set.id);
  if (!entry) throw new Error(`数据源缺少扩展 ${set.id}`);
  const rows = [];
  for (const item of entry.cards) {
    const card = byId.get(item.cardId);
    if (!card || set.skip.includes(card.id)) continue;
    const effect = EFFECTS[card.id];
    if (!effect) { skipped.push(`${set.id}/${card.id}`); continue; }
    const faction = FACTION[(card.factions || [])[0]] || 'neutral';
    const qty = item.quantity || 1;
    const id = `${set.prefix}_${card.id}`;
    const type = (card.types || []).includes('Base') ? 'base' : 'ship';
    const extra = { ...effect, set: set.id, text: cardText(effect) };
    delete extra.name;
    const args = [JSON.stringify(id), JSON.stringify(effect.name), JSON.stringify(card.name), JSON.stringify(faction), card.cost, qty];
    if (type === 'base') args.push(card.defense || 4);
    args.push(JSON.stringify(extra));
    rows.push(`  ${type}(${args.join(', ')})`);
  }
  lines.push(`/* ${set.id}：${rows.length} 种 */`);
  lines.push(`export const ${set.id.toUpperCase()}_DEFS = Object.fromEntries([`);
  lines.push(rows.join(',\n'));
  lines.push('].map(card => [card.id, Object.freeze(card)]));');
  lines.push('');
}

const out = path.join(ROOT, 'src/engine/expansions-extra.js');
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`已生成 ${path.relative(ROOT, out)}`);
console.log(`未映射（不生成、不静默降级）：${skipped.length} 种`);
for (const id of skipped) console.log('  -', id);
