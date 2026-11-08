# AI 脚本接口（唯一口径，2026-11-08 版）

> 本文件是本次任务中脚本接口的**唯一口径**，不含任何对局数据或赛果。

## 接口形状

```js
export const meta = {
  name: '显示名 · 策略名',        // 必须包含你的显示名（大小写不敏感匹配）
  description: '模型ID｜策略名｜一句话理由'
};

export function chooseAction({ view, legalActions, playerId, random, memory, context }) {
  // 必须原样返回 legalActions 数组里的某个对象引用
  return legalActions[0];
}
```

- `chooseAction` 可以是同步函数或 `async` 函数。
- `view`、`legalActions`、`context` 都经 `deepFreeze()` 深冻结；ESM 默认严格模式，写入会抛 `TypeError`。
- `view` 是**本人视角**：对手 `hand` 为空数组、`handCount` 保留数量；所有牌库顺序隐藏。
- `legalActions` 是引擎算出的合法动作；附加字段（`choice` / `row` / `rows` / `targets` / `targetId` / `double` / `copy` / `amount` / `resource` / `pay` / `baseId` / `cards`）**必须原样带回**，不要自己拼造。
- `random` 是带种子的函数，返回 `[0,1)`；`memory` 是本座位、本局私有的可变对象；`context` 是 `Object.freeze({ mode, turn, seed })`。
- 单次决策上限 **3000ms**；返回非数组内对象、抛异常、死循环都会让对局中止并报错。

## `view` 重要字段

| 字段 | 含义 |
|---|---|
| `view.mode` | `standard` / `ffa` / `hunter` / `firstBlood` / `team2v2` / `hydra3` / `emperor` |
| `view.players[i]` | `id` / `name` / `team` / `authority` / `trade` / `combat` / `reserve` / `hand` / `handCount` / `deckCount` / `discard` / `inPlay` / `eliminated` / `isViewer` / `used` 等 |
| `view.players[playerId].authority` | **判断血线与斩杀一律用这个**（大将战里 `teams[].authority` 是 0） |
| `view.teams` | 数组：`{ id, name, players:[座位], authority }`；仅团队/大将模式存在，非团队模式为 `[]` |
| `view.emperors` | 大将座位数组，例如 `[0,1]`；非大将模式为 `[]` |
| `view.expansions` | `{ sets, core, colonyWars, events, frontiers, crisisFleets, crisisBases, tradeSets, deck, tradeDeckSize }` |
| `view.tradeRow` | 5 个交易行卡实例 ID，空位为 `null` |
| `view.cards[uid]` | 可见卡实例：`name` / `en` / `type` / `faction` / `factions` / `set` / `cost` / `defense` / `outpost` / `text` / `copiedFrom` |
| `view.pending` / `view.eventContext` / `view.lastEvent` | 当前待决选择、事件队列、最近结算事件 |
| `view.activePlayer` | 当前回合座位；待决时决策座位可能不同 |
| `view.explorers` / `tradeDeckCount` / `eventCardsRemaining` / `scrapHeap` / `damage` | 探索者余量、牌库余量、事件余量、销毁堆、基地累计伤害 |
| `view.turn` / `view.status` / `view.winner` / `view.winningTeam` | 回合数、状态、胜者 |

> `view` 是状态快照的深拷贝后裁剪：隐藏的卡实例会从 `view.cards` 里**删除**，所以访问未知 uid 前要判空。

## 全部动作形态（引擎 `legalActions()` 实际会给出的）

| 动作 | 形状 |
|---|---|
| 打出 | `{ type:'play', cardId, copy:null }`；可能另有 `choice`、`row` |
| 能力 | `{ type:'ability', cardId, ability:'primary'|'optional'|'ally'|'scrap', … }`；可能另有 `choice` / `targets` / `targetId` / `row` / `rows` / `resource` / `double:true` |
| 购买 | `{ type:'buy', row:0 }` 或 `{ type:'buy', explorer:true }` |
| 攻击玩家 | `{ type:'attack', targetType:'player', targetId, amount }` |
| 攻击基地 | `{ type:'attack', targetType:'base', targetId:uid, amount }` |
| 队友预留 | `{ type:'transfer', targetId, resource:'trade'|'combat', amount }` |
| 大将战移牌（新） | `{ type:'moveCard', cardId, targetId }` |
| 强制弃牌 | `{ type:'discard', cardId }` |
| 指定弃牌目标 | `{ type:'targetDiscard', targetId }` |
| 强制销毁选择 | `{ type:'selectScrap', cardId }` |
| 事件选择 | `{ type:'eventChoice', eventId, targets|cards|baseId|pay }` |
| 结束回合 | `{ type:'endTurn' }` |
| **未知动作** | 任何其它 `type`；必须安全兜底 |

`pending` 存在时 `legalActions` 只包含该待决类型的动作（例如只剩 `discard`），此时不要去找 `play` / `buy`。

## 通用安全要求

- 零依赖：脚本内不得出现 `import` / `require` / `process` / 文件系统 / 网络调用。
- 不修改 `view`、`legalActions` 及其子对象；不对 `legalActions` 原数组 `sort()`（要排序就先 `slice()`）。
- 任何决策点都必须返回值，且必须是 `legalActions` 中的**同一个对象引用**。
- 用 `try/catch` 包住估值逻辑，异常时退回 `legalActions[0]` 或 `endTurn`。
- 不要假设玩家人数、队伍人数、卡牌集合、交易行长度固定。
