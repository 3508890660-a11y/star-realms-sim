# 程序更新清单（规则内核 2026-11-08 版）

> 本文件只描述「程序与规则变成了什么样」。**不含任何对局数据、排名、胜率、赛果或历史报告。**
> 你手上的 `agents/<你的短 id>/current.js` 是按 **2026-11-05 版程序**写的，只认识 5 种模式与 3 个牌包。
> 下面的每一条都是此后真实落地的代码变更，副本在 `engine/` 里，可自行核对。

---

## 1. 模式从 5 种扩到 7 种

`engine/modes.js` 的 `MODES` 现在是：

| 模式 | 人数 | 要点 |
|---|---:|---|
| `standard` | 2 | 50 权威，先手 3 张 / 后手 5 张 |
| `ffa` | 3–4 | 可攻击任何对手，最后存活者胜 |
| `hunter` | 3–4 | 只能打左手边玩家，可打左右邻家基地 |
| `firstBlood` | 3–4 | 猎杀规则；首位玩家败北时其右手边玩家立即获胜 |
| `team2v2` | 4 | 双头龙：0/2 与 1/3 组队，全队共享 75 权威 |
| **`hydra3`（新）** | 6 | 三头龙：0/2/4 与 1/3/5 两队各 3 人，**全队共享 100 权威**，队友可转移贸易/战斗，任一人有前哨则全队受保护 |
| **`emperor`（新）** | 6 | 大将战：每队 1 大将（60 权威）+ 2 提督（各 50）；**大将败则该队失败** |

`view.mode` 会给出当前模式；`view.players.length` 可能是 2/3/4/6，不要再按 2 或 4 写死。

## 2. 团队模式规则修正（影响 `team2v2` / `hydra3` / `emperor`）

这三处都是**代码行为改变**，旧脚本里按旧行为写的假设需要重新审视：

1. **起手牌改为按队发放**（`engine/engine.js` 的 `setup()`）。团队模式下偶数座位全队 3 张、奇数座位全队 5 张，即 2v2 是 `[3,3,5,5]`、6 人是 `[3,3,3,5,5,5]`。旧版 `team2v2` 走的是混战分支，会发出 `[3,4,5,5]`。
2. **回合顺序改为「整队轮流」**（`modes.js` 的 `nextTeamTurn()`）。同队队友按座位升序**连续行动完**，再换另一队；例如 6 人是 `0→2→4→1→3→5`，2v2 是 `0→2→1→3`。旧版是逐座位交替 `0→1→2→3`。
3. **队末才清算**（`engine.js` 的 `endTurn()`）：
   - 队内换人只清本人本回合的贸易/战斗/能力标记（`resetTurnState`），**不弃手、不补牌、不清基地伤害**；
   - 全队都行动完，才对全队弃手、场上飞船进弃牌堆、各补 5 张，并清空 `s.damage`（对基地的累计伤害）。

由此产生的策略事实：队友可以**合击同一座基地**（伤害在队末才清零），`transfer` 出去的贸易/战斗会在**紧接着行动的队友回合开始**到账（`beginTurn()` 把 `reserve` 加进其资源池）。另外全队共享前哨保护：`teamHasOutpost()` 检查的是**整队**有没有前哨，因此 `legalActions` 里对手的玩家攻击动作可能整体不存在，不要因为「看不到打人的动作」就误判。

## 3. 大将战（`emperor`）专属字段与口径

- `view.emperors` 是两名大将的座位数组（默认 `[0, 1]`，赛制会轮换）。`view.players[i].team` 为 `0` 或 `1`。
- **权威在个人身上，不在队伍上**：大将 60、提督 50；`view.teams[i].authority` 在大将战里是 **0**（只有 `team2v2` / `hydra3` 才把共享权威放在 `teams[].authority`）。判断血线、判断斩杀，一律读 `view.players[targetId].authority`，不要用 `view.teams[].authority`。
- 攻击/指定限制由引擎在 `canAttackPlayer()` / `canTargetBase()` 里过滤：
  - **大将可以攻击/指定任何敌方玩家与敌方基地**；
  - 提督只能打**自己的对位提督**及其基地；对位提督阵亡后才解锁敌方大将及其基地；
  - 对位是「两队提督按各自队内座位序一一配对」，**不是座位 +1**。
  - **结论：不要自己按座位奇偶或对位表推导可打谁，直接信任 `legalActions` 里给出的 `attack.targetId` / `ability.targetId`。**
- 新增主阶段动作 `{ type:'moveCard', cardId, targetId }`：花 1 贸易，把自己弃牌堆里的一张牌交给队内相邻队友（官方口径为相邻队友；3 人队里环形相邻等价于其余两名队友）。这个动作旧脚本完全没见过，必须有安全兜底。
- 胜负条件是大将被击败，不是把所有人权威清零；`view.players[i].eliminated` 与 `view.winner` 仍可用。

## 4. 牌包从 3 个扩到 6 个，且可自由组合

`engine/cards.js` 的 `EXPANSION_PACKS`：

| 键 | 名称 | 类型 | 已实现 |
|---|---|---|---|
| `core` | 基础盒交易牌堆 | 交易 | 48 种 / 80 张 |
| `colonyWars` | 殖民战争交易牌堆 | 交易 | 43 种 / 80 张 |
| `events` | 危机事件牌 | 事件 | 8 种 / 12 张 |
| **`frontiers`（新）** | 边疆交易牌堆 | 交易 | 42 种 / 75 张 |
| **`crisisFleets`（新）** | 危机：舰队与要塞 | 交易 | 7 种 / 11 张 |
| **`crisisBases`（新）** | 危机：基地与战列舰 | 交易 | 6 种 / 10 张 |

- `view.expansions.sets` 是启用键的数组；`view.expansions` 另有 `core` / `colonyWars` / `events` / `frontiers` / `crisisFleets` / `crisisBases` / `tradeSets` / `deck` 布尔或派生字段。
- 交易牌包可以任意勾选（至少一个，缺省补 `core`），`events` 可与任意组合叠加；因此**交易行里会出现你没见过的卡**。
- `view.cards[uid]` 带 `name` / `en` / `type` / `faction` / `factions` / `cost` / `defense` / `outpost` / `text` / `set`。`set` 标明卡来自哪个牌包，`text` 是引擎「按已实现效果反写」的中文卡面，与引擎实际行为一致。
- 生成器的口径是**未映射的卡不生成、不静默降级**；但对你而言仍然应按「可能有未知卡」处理，用 `view.cards[uid].text` / `cost` / `type` / `faction` 做通用估值，不要只依赖写死的卡名表。

## 5. 新增卡面效果方言 → 对应的动作字段

`engine/expansions-extra.js` 里的新卡引入了这些声明式效果，`engine.js` 的 `legalActions()` 会把它们展开成下列动作。**所有附加字段都必须原样从 `legalActions` 返回，不要自行拼造**：

| 效果 | 会出现的动作形态 |
|---|---|
| `primaryChoice`（二选一） | `{ type:'play', cardId, copy, choice }`，其中 `choice` 是分支下标；若分支含 `acquireFreeMax` 还会带 `row` |
| `acquireCheapFree`（免费获取符合条件的交易行卡） | `{ type:'play', cardId, copy, row }`；`ability` 的同盟分支也可能带 `row` |
| `scrapRowGainCostCombat`（销毁交易行按费用得战斗） | `{ type:'play' | 'ability', row }` |
| `scrapOwn` / `minScrap` / `zones`（销毁手牌、弃牌堆，「至多 N 张」） | `{ type:'ability', ability:'primary'|'optional'|'ally', targets:[uid…] }` |
| `discardThenDraw`、`depot`、`recycle` | `{ type:'ability', targets:[uid…] }`，`depot` 另有 `resource:'trade'|'combat'` |
| `optionalPrimary.scrapRow` | `{ type:'ability', ability:'optional', row }` 或 `rows:[…]` |
| `destroyBase` | `{ type:'ability', targetId }`；销毁能力也可能给 `targetId: null` |
| **`doubleAlly`（双同盟）** | 仍以 `{ type:'ability', ability:'ally', double:true }` 暴露；**旧脚本不认识 `double` 也必须不崩**，把它当作一次额外同盟机会即可 |
| `scrap`（销毁能力） | `{ type:'ability', ability:'scrap', … }` |

另外事件待决动作 `{ type:'eventChoice', eventId, targets|cards|baseId|pay }`、强制选择 `discard` / `selectScrap` / `targetDiscard`、队友预留 `transfer` 仍然存在，形态未变。

## 6. 对脚本的硬性影响（逐条自检）

1. 必须覆盖 **7 种模式**，且 `view.players.length` 可能是 2/3/4/6；队伍人数可能是 2 或 3。
2. 必须覆盖 **6 个牌包任意组合**，包括只开 `frontiers`、只开 `crisisFleets`、只开 `crisisBases`、全开等；不能假设交易行卡名集合固定。
3. 团队模式的资源、伤害、前哨、回合节奏按第 2 节的新口径，别再按「每换一个人就清一次基地伤害 / 补一次牌」估价。
4. 大将战按第 3 节：血线读个人权威，目标读 `legalActions`，认识 `moveCard`。
5. 认识 `double:true` 的 `ally`、带 `choice` / `row` / `rows` / `targets` / `targetId` 的 `play` 与 `ability`，以及任何**未知动作类型**：一律打分兜底，不能抛异常、不能死循环。
6. 卡牌估值优先用可见字段与 `text` 解析；写死的价值表可作加成，但不能作为唯一依据。
7. 引擎会深冻结 `view` 与 `legalActions`；返回必须**原样是数组里的某个对象引用**，不得 `sort()` 原数组、不得写冻结对象。
8. 单次决策上限 3000ms；零依赖（不得 `import` / `require`）。
