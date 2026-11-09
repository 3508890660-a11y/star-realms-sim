# 12 个 subagent 按程序更新修订脚本 · 调整报告

> 生成：2026-11-09 · 范围：只描述「脚本怎么改」，**不含任何对局结果、胜率、排名、β、CI 或赛果**。
> 本轮是隔离轮：12 个 subagent 只拿到程序更新说明、脚本接口、规则内核副本与各自旧脚本，看不到历史实验结果。隔离口径见 `README.md` 第 17 节与 `tools/agent-refresh-brief.md`。

---

## 0. 结论前置

| 结论 | 数据 |
|---|---|
| 完成度 | **12/12** 交付修订脚本 + 公开更新说明，进度看板 12/12 完成 |
| 策略身份守恒 | **12/12** 的 `meta.name` 与修订前**逐字相同**，没有模型换打法 |
| 必改项全覆盖 | `moveCard` **12/12**、双同盟 `double:true` **12/12**、卡面 `text` 通用估值 **12/12**、`view.emperors` **12/12**、`transfer` **12/12** |
| 代码量 | 净增 **2,610 行**（6,598 → 9,208，**+39.6%**）；新增 3,848 行 / 删除 1,238 行；体积 264,792 → 396,257 字节（+49.6%） |
| 分歧性质 | 分歧**不在「有没有适配」，而在「适配深度」**：显式卡表 vs 纯文本解析、座位序推断 vs 完全信任 `legalActions`、队伍权威读数 vs 个人权威读数 |
| 需复核的口径 | 隔离简报把「前哨护盾按整队」概括到了 `emperor`，引擎实际只对 `team2v2`/`hydra3` 整队、`emperor` 按个人；**只影响估值，不影响动作合法性**（详见第 7 节） |
| 校验 | `node --check` 12/12；隔离自检（20 场景 / 60 次调用）12/12 `ok=true`；**84 场真实对局**全部结束；`npm test` **95/95** |
| 边界 | **本轮未重跑任何锦标赛**，未产生任何新赛果；`reply/` 其它报告与 `tournaments/` 仍对应修订前脚本 |

一句话概括：**12 个模型都把「旧程序的座位/人数/血线/卡表假设」换成了「读视图字段 + 信任合法动作」的模式无关架构，同时按整队轮流的新节奏重估了转移与合击；保留策略骨架，只改适配层。**

---

## 1. 报告口径与数据来源

| 来源 | 用途 | 含赛果 |
|---|---|---|
| 隔离目录 `out/<id>.md` × 12 | 各模型自述的六节公开更新说明 | 否 |
| `scripts/agent-*.js` × 12（修订后） | 代码事实、关键字矩阵、`meta.name` | 否 |
| `scripts/_backup-pre-refresh-20261108/agent-*.js` × 12 | 修订前基线，用于 diff | 否 |
| `src/engine/{engine,cards,modes,expansions,expansions-extra}.js` | 核对引擎真实口径（尤其前哨护盾） | 否 |
| 12 份 subagent 完成汇报 | 交叉核对三条主改动 | 否 |
| `test/agent-refresh.test.js` 与 `npm test` 输出 | 校验结论 | 否 |

**明确排除**：`reply/star-realms-*` 赛果报告、`tournaments/*`、`test-artifacts/`、`video/`、B 站文案、旧设计说明里模型自跑的冒烟数字。凡本报告出现的百分比，都是**代码行数变化率**，不是胜率。

方法说明：关键字矩阵是**代码事实的代理指标**（`grep` 计数），不是语义证明；模型自述与代码不一致时，以代码为准。两处此类不一致已在第 7 节列出。

---

## 2. 输入：程序更新的 6 类挑战 → 12 份脚本的共同响应

| # | 程序变更 | 引擎证据 | 脚本的共同响应 | 覆盖 |
|---|---|---|---|---|
| 1 | 模式 5 → 7（新增 `hydra3`/`emperor`），人数 2/3/4/6 | `modes.js` 的 `MODES` / `TEAM_SPECS` | 动态读 `view.players.length`、`view.players[].team`、`view.mode`、`view.emperors`，删掉 2 人 / 4 人写死假设 | 12/12 |
| 2 | 起手牌按队发放、整队轮流、队末才清算 | `setup()` / `nextTeamTurn()` / `endTurn()` | `transfer` 改为「紧接着行动的队友回合开始到账」；基地伤害可跨人累计，半伤不再一律算浪费；节奏按「轮」而非「玩家回合」重标 | 12/12（11 份读 `view.damage`，`hy4` 改用后续队友数启发式） |
| 3 | 大将战权威在个人、目标受对位限制 | `canAttackPlayer()` / `canTargetBase()` / `oppositeSeat()` | 血线一律读 `view.players[targetId].authority`（弃用 `teams[].authority`，该值在 emperor 恒为 0）；可打谁完全信任 `legalActions`；斩杀优先敌方大将 | 12/12 |
| 4 | 牌包 3 → 6，任意自由组合 | `EXPANSION_PACKS`、`CARD_DEFS` 共 **155 种 / 牌包合计 268 张** | 未知卡改走「可见字段 `cost/type/defense/outpost/faction/set` + `text` 中文卡面解析」；写死卡名表从唯一依据降级为加成项 | 12/12 |
| 5 | 新动作方言与附加字段 | `legalActions()` 的 `play` / `ability` / `moveCard` | `choice/row/rows/targets/targetId/resource/copy/double` 只用于打分、随原动作对象**原样返回**；`moveCard` 独立分支；未知动作兜底 | 12/12 |
| 6 | 接口契约未变（零依赖、深冻结、3000ms） | `runner.step()` / `deepFreeze()` | 不对原数组 `sort()`、不写冻结对象、整段 `try/catch` 兜底、返回同一对象引用 | 12/12 |

新增三个交易牌包的客观规模：`frontiers` 42 种 / 75 张、`crisisFleets` 7 种 / 11 张、`crisisBases` 6 种 / 10 张，合计 **55 种 / 96 张**。

---

## 3. 调整总览：客观差异数据

### 3.1 逐脚本代码量（`git diff --no-index --numstat` 对比备份）

| 短 id | 旧行数 | 新行数 | 净增 | 新增行 | 删除行 | 旧字节 | 新字节 |
|---|---:|---:|---:|---:|---:|---:|---:|
| hy4 | 320 | 376 | +56 | 127 | 71 | 11,504 | 15,352 |
| hy3 | 387 | 498 | +111 | 193 | 82 | 13,419 | 18,643 |
| glm53 | 553 | 734 | +181 | 256 | 75 | 21,228 | 30,562 |
| glm53flash | 566 | 700 | +134 | 179 | 45 | 22,755 | 30,610 |
| minimaxm3 | 854 | 1,309 | +455 | 700 | 245 | 36,030 | 61,110 |
| minimaxm31flash | 999 | 1,479 | +480 | 686 | 206 | 41,654 | 63,153 |
| kimi31pro | 478 | 583 | +105 | 163 | 58 | 19,674 | 24,696 |
| kimi28preview | 446 | 542 | +96 | 126 | 30 | 16,634 | 21,402 |
| deepseekv41flash | 858 | 1,204 | +346 | 614 | 268 | 31,885 | 47,399 |
| deepseekv4pro | 286 | 405 | +119 | 168 | 49 | 11,595 | 16,066 |
| step5preview | 637 | 1,084 | +447 | 512 | 65 | 30,500 | 54,822 |
| mimov26pro | 214 | 294 | +80 | 124 | 44 | 7,914 | 12,442 |
| **合计** | **6,598** | **9,208** | **+2,610** | **3,848** | **1,238** | **264,792** | **396,257** |

改动量最大的四份（`minimaxm31flash` +480、`minimaxm3` +455、`step5preview` +447、`deepseekv41flash` +346）都选择**补全新卡效果表 + 重写估值层**；最小的三份（`hy4` +56、`mimov26pro` +80、`kimi28preview` +96）则是在原有通用估值上做参数与分支修补。**改动量大不等于适配更好**——本报告不对策略强弱做任何判断。

### 3.2 适配覆盖矩阵（新脚本代码计数，旧脚本均为 0 或仅注释）

| 指标 | 旧基线 | 修订后 | 说明 |
|---|---:|---:|---|
| `moveCard` 动作识别 | 0/12 | **12/12** | 大将战专属移牌 |
| `double` 双同盟识别 | 0/12 | **12/12** | 10 份显式加分，2 份（`hy3`/`glm53`）作透明透传 |
| `view.emperors` / 大将座位 | 0/12 | **12/12** | 斩将优先级的依据 |
| 卡面 `.text` 解析 | 6/12 | **12/12** | 未知卡通用估值 |
| `transfer` 处理 | 10/12 | **12/12** | 补上 2 份原本不转移的脚本 |
| `team` / `teams` 字段分组 | 7/12 | **11/12** | `deepseekv4pro` 完全不做队伍推导，只信 `legalActions` |
| `view.damage` 累计伤害 | 8/12 | **11/12** | `hy4` 改用「后续行动队友人数」估算合击价值 |
| 字面量 `'hydra3'` | 0/12 | 4/12 | 其余 8 份用 `team` 字段泛化处理 6 人队模式，无需写死模式名 |
| 字面量 `'emperor'` | 0/12 | 11/12 | `kimi28preview` 用 `view.emperors` 判定，未写字面量 |

> 注：旧脚本里出现的 `emperor` 字样来自卡牌 ID（如 `emperorsDreadnaught`），不是模式支持，已用引号模式名复核剔除。

---

## 4. 12 个模型各自怎么改

### 4.1 三条主改动一览（取自各模型完成汇报，已与更新说明/代码交叉核对）

| 短 id · 策略 | ① 模式与规则 | ② 团队 / 大将 | ③ 新牌包与新动作 |
|---|---|---|---|
| `hy4` 薄牌护城河 | `team` 字段动态分敌友，全场最高权威做**相对血线**，修掉把队友算进对手的旧假设 | hydra3 共享权威 + 队末合击；emperor 个人权威 + 斩大将加权 + `moveCard` | 可见字段 + `text` 通用估值；`double:true`、`choice/row/rows/targets/targetId`、未知动作兜底 |
| `hy3` 协同滚雪球 | 删掉 2/4 人假设，权威一律读 `players[].authority` | emperor 只斩敌方大将、移交弃牌好牌给相邻队友；收尾 `transfer` 给下一顺位队友、基地优先续打已有伤害 | `text/factions/cost` 通用解析；`double` 与全部新字段透明透传 + 整段 `try/catch` |
| `glm53` 曲线竞速 | 敌人按 `team` 通用过滤；**曲线计时改为 `turn / 玩家数`**，6 人局不会过早转末期 | `transfer` 定向下一队友；打不穿的墙也预存伤害供队友合击；血线阈值按 100 权威放宽 | `INTRINSIC` 写死表降为加成，`genericValue` 走卡面文本；`row` 区分免费获取与销毁换战斗 |
| `glm53flash` 精炼雪球 | `ECON_TURNS` 按 7 模式分档（hydra3 12、team2v2 8……） | 可杀判断计入 `view.damage`；团队允许合击半伤；转移全额化 | `estimateFromText()` 与按费用线性兜底取较大者；修复空 `targets` 被 `every()` 误判 |
| `minimaxm3` 壁垒重锤 | 模式无关架构：血线读个人权威、目标只认 `legalActions.targetId` | hydra3 整队前哨墙 + 队末清伤害接力拆墙；emperor 斩大将优先、`moveCard` 仅兜底 | **55 种新卡全补进表**但主路径改成读卡面；`double:true` 与全部新字段兜底 |
| `minimaxm31flash` 破垒夺权 | 按 `modes.js` 建 `MODE_CFG`（team / shared / teamTurn / shieldTeam 四个标志） | 补刀按全队可达战斗；`transfer` 按队友行动先后给到账系数；提督对位按队内座位序 | 55 张新卡效果表（含 `combatIfTwoBases` 等条件键）+ `inferDb()` 文本兜底；双同盟给 5% 兑现系数 |
| `kimi31pro` 压缩脉冲 | 不再把团队模式等同于 `team2v2`；共享/个人血线按 `view.mode` 分流 | 按座位序识别下一位队友；部分伤害改为合击铺垫；记录首次起手牌数微调贸易权重 | 卡面解析改为**按句号/换行分节**，避免把同盟、双同盟误算进主效果；`double:true` 用双同盟文本段 |
| `kimi28preview` 蜂群速攻 | 敌人按 `team` 分组，血线只读个人权威 | `transfer` 兜底 + `view.damage` 合击；斩杀优先级「敌大将 > 最弱可打目标」 | 通用文本评分为主、写死表仅加成；`moveCard` 阈值 ≥5、`double:true` +1、`resource:'combat'` +1.5 |
| `deepseekv41flash` 三段涨潮 | 血线按**起始权威比例归一化**（50/60/75/100），经济段随权威拉长 | 补刀扣掉队友留下的伤害；换手前把会清零的贸易/战斗 `transfer` 出去 | `choice` 按卡面分支逐支估值；`row/rows` 分流；`targets` 支持空集与「至多 N 张」；费用先验兜底 |
| `deepseekv4pro` 价值节奏快攻 | 完全不做敌友推导，「能不能打」全交 `legalActions` 过滤 | `baseAttackScore` 用 `view.damage` 抵扣；转移留队友接力 | `CARD_VALUE` 已知牌加成 + `fallbackValue()` 对未知牌走 `cost/type/outpost/text` |
| `step5preview` 雪球收割 | 敌我按 `team` 划分，共享权威归零记 1000 分 | `nextActorIsTeammate` 才允许「摸一下」留伤害；`transfer` 按到账时机给 1.05 / 0.85 系数；**emperor 前哨看个人** | FX 表补三个新包 + `textFx` 兜底；`choice` 取 `primaryChoice[choice]`；手牌 ≤2 时抽牌 ×1.3 |
| `mimov26pro` 闪电压制 | 击杀估值按 7 模式区分终局口径（斩将/团队归零 6000、提督阵亡 3200） | team-like 非击杀打基地 +40；`transfer` 给座位靠后队友 +20 | 写死价值表**完全移除**，纯文本正则；`row` 按「销毁得战斗 / 免费获取」分流；双同盟 +15 |

### 4.2 独特做法与自述弱点

| 短 id | 最有辨识度的做法 | 模型自述的主要弱点 |
|---|---|---|
| `hy4` | 用「全场最高权威」做相对血线，一套打分覆盖 50/60/75/100 | 不读 `view.damage`，用「后续队友人数」近似合击；条件卡面按中文正则近似 |
| `hy3` | 明确「不杀提督以免资敌」，直伤只瞄敌方大将 | `moveCard` 只看单卡分数，不建模队友接下来能打什么 |
| `glm53` | 购置曲线按「轮 = turn / 玩家数」重标；团队模式允许把战斗预存进打不穿的墙 | 文本解析覆盖不了组合技；自己是大将时完全不移牌 |
| `glm53flash` | `ECON_TURNS` 七模式分档；修复空 `targets`（「至多 N 张」选 0 张）被误判 | 团队半伤可能因队友没接上而蒸发；不主动规划「先杀提督解锁大将」 |
| `minimaxm3` | 估值主路径「查表 → 读卡面」的架构切换；写死表降级为精确化加成 | 放弃自己算对位表，牺牲一点提前规划换规则一致性；`moveCard` 极保守 |
| `minimaxm31flash` | 唯一显式建 `MODE_CFG` 四标志表；`hpOf()` 在共享模式读 `teams[].authority` | 单步贪心不搜两步；依赖 `view.teams` 结构 |
| `kimi31pro` | 卡面按标点分节，避免把双同盟/销毁误算进主效果；记录起手牌数 | 不做队友手牌推测；部分伤害估值依赖「后面是否还有队友行动」 |
| `kimi28preview` | 用 `view.emperors` 判定大将（不写字面模式名）；速攻立场下 `resource:'combat'` 额外加成 | `transfer` 只看下一个队友；`moveCard` 阈值偏高 |
| `deepseekv41flash` | 起始权威比例归一化，hydra3 的 100 权威不再被误判为濒死 | 条件收益统一按 50% 折价；不做跨座位推演 |
| `deepseekv4pro` | 最极端的「完全信任 `legalActions`」：不分组敌友、不算对位 | `transfer` 不区分队友、一律取最大量；`moveCard` 优先级极低 |
| `step5preview` | `nextActorIsTeammate` 门控 + `transfer` 到账系数 1.05/0.85 + `lowHand` 加成 | `moveCard` 多数情况评为负分几乎不用；合击只按座序单向推断 |
| `mimov26pro` | 击杀收益分「终局 6000 / 解锁 3200」两档；写死卡表彻底移除 | 纯文本正则遇复合效果会高/低估；`transfer` 用座序启发式 |

---

## 5. 共性调整（12/12 一致）

1. **血线口径统一**：全部改为 `view.players[targetId].authority`；`view.teams[].authority` 在 emperor 恒为 0，不再用于斩杀判断。共享权威模式下引擎会把队伍池同步到每个队员，读个人值同样正确。
2. **目标合法性交给引擎**：不再按座位奇偶、`(id+1)%n` 或自推对位表决定「能打谁」，只从 `legalActions` 的 `targetId` 里挑。这直接对应第 16.6 节修掉的提督对位 bug。
3. **未知卡通用估值**：所有脚本都引入（或强化）卡面 `text` 解析 + 可见字段打底，写死卡名表退为加成。因此 6 个牌包任意勾选、甚至只开一个新包，都不会因「没见过这张牌」而失准。
4. **团队节奏按新引擎重估**：`transfer` 从「下回合才到账」变成「紧接着的队友回合开始到账」；基地伤害队末才清零，所以「部分伤害」在团队模式是有效进度；全队共享前哨时「看不到打玩家的动作」是正常现象而非异常。
5. **新动作原样透传**：`choice/row/rows/targets/targetId/resource/copy/double` 只参与打分，返回时原样带回 `legalActions` 里的对象引用，不自行拼造。
6. **策略身份守恒**：12/12 `meta.name` 与修订前逐字相同，核心思路（薄牌/滚雪球/曲线/破垒/速攻/压制……）未更换。

---

## 6. 分歧点：同一问题的不同解法

| 议题 | 做法 A | 做法 B | 影响 |
|---|---|---|---|
| 新卡估值 | **补全显式效果表**：`minimaxm3`、`minimaxm31flash` 补 55 种，`step5preview` 补 FX 表 | **纯通用文本解析**：`hy4`、`mimov26pro`（写死表完全移除）、`kimi28preview` 等 | A 对已知新卡数值更准、对未知卡依赖兜底；B 对未来新卡更稳、对条件效果更粗糙 |
| 双同盟 `double:true` | **显式加分**：`mimov26pro` +15、`kimi28preview` +1、`glm53flash` 3→3.3、`minimaxm31flash` 5% 兑现系数 | **透明透传**：`hy3`、`glm53` 走与普通同盟同一套估值 | 两者都能合法发动（引擎以 `ability:'ally'` 暴露），差别只在触发积极度 |
| `moveCard` 阈值 | 积极：`glm53flash` 贸易 ≥4 且牌值 ≥6.5、`kimi31pro` 倾向喂本队大将 | 保守：`minimaxm3`/`deepseekv4pro` 仅收尾兜底、`step5preview` 多评负分、`kimi28preview` ≥5 才动 | 大将战里的「喂牌」强度差异最明显；都不影响合法性 |
| 下一位队友推断 | 用座位序 / `team` 字段推算（`hy3`、`glm53`、`step5preview`、`mimov26pro` 等 11 份） | 完全不推断（`deepseekv4pro`） | 阵亡或非标准轮换时 A 可能有偏差；B 更稳但转移不定向 |
| 共享权威读数 | 读 `players[].authority`（11 份，引擎已同步） | 读 `teams[].authority`（`minimaxm31flash` 的 `shared:true` 分支） | 二者在 `team2v2`/`hydra3` 等价；emperor 下两者都改读个人权威 |
| 合击价值 | 读 `view.damage[uid]` 抵扣后再判断能否补刀（11 份） | 按「后续行动队友人数」放大基地攻击分（`hy4`） | B 更粗但少一个字段依赖 |
| 节奏重标 | 按轮数（`glm53`）、按起始权威比例（`deepseekv41flash`） | 按模式分档表（`glm53flash`）、按手牌紧迫度（`step5preview`） | 6 人局的经济段长度各家不同，是后续对局里最可能出现行为差异的地方 |

---

## 7. 口径补正与自述数字复核

### 7.1 隔离简报的一处不精确表述（重要）

`tools/agent-refresh-updates.md` 第 2 节把「**全队共享前哨保护**」概括在「影响 `team2v2` / `hydra3` / `emperor`」的小节下。核对引擎实际实现：

```js
// src/engine/engine.js:589
teamHasOutpost(owner) {
  if (!isTeamMode(this.state.mode)) return this.state.players[owner].inPlay.some(...outpost);
  const team = this.state.teams[teamOf(this.state, owner)];
  return team.players.some(...);
}
```

`isTeamMode()` 只对 `TEAM_SPECS`（`team2v2` / `hydra3`）为真，**`emperor` 走的是「按个人」分支**。也就是说：大将战里前哨只保护其拥有者本人，不是整队。

- **影响范围**：只到估值层。12/12 脚本的实际目标都取自 `legalActions`，引擎已经按正确口径过滤，因此**不会产生非法动作，也不会改变对局能否结束**。
- **正确落地的两份**：`minimaxm31flash` 的 `MODE_CFG.emperor.shieldTeam = false`；`step5preview` 明确「team2v2/hydra3 看全队，emperor 看个人」。
- **其余脚本**多为泛化的「整队前哨」表述，建议在下一轮复核 emperor 下的拆墙估值；这不构成当前版本的缺陷，但属于**简报口径需要在文档中补正**的地方。
- 本报告已在 `README.md` 17.6 记录该补正；隔离简报保持原样存档，作为当时的真实输入证据。

### 7.2 自述数字与引擎不一致

`step5preview` 的更新说明称「FX 表已覆盖全部 6 牌包 **219 张**已实现卡」。引擎事实：`CARD_DEFS` 共 **155 种**（core 49 / colonyWars 43 / events 8 / frontiers 42 / crisisFleets 7 / crisisBases 6），六个牌包**张数合计 268 张**（80/80/12/75/11/10）。219 与两者都不匹配，疑为模型自己的计数口径。该脚本另有 `textFx` 兜底，**不影响行为**，但引用其自述数字时应以引擎卡表为准。

### 7.3 方法边界

- 第 3 节的关键字矩阵是代码计数，不等于语义正确性；第 4 节的「三条主改动」是模型自述，已与代码做交叉核对但未逐行审计算法。
- 12 份更新说明是**公开设计说明**，不是内部推理过程；本报告只归纳可审阅内容。

---

## 8. 校验与边界

| 校验项 | 结果 |
|---|---|
| `node --check` × 12 | 12/12 通过 |
| 隔离自检 × 12（20 场景 / 60 次调用；含 `double:true`、`moveCard`、四类待决动作、深冻结视图、未知动作） | 12/12 `ok=true`，最慢单次 < 4ms |
| `test/agent-refresh.test.js`：元数据 / 零依赖 / 更新说明断言 | 通过 |
| 同文件：**12 脚本 × 7 模式 × 7 牌包组合 = 84 场真实对局** | 全部正常结束、均产生唯一胜者、牌包组合按配置生效 |
| 全量 `npm test` | **95/95**（原 93 + 新增 2） |
| `/api/subagents` 看板 | 12 个任务、12/12 完成、`modelVerified` 12/12 |

**边界（必须保留）**：

1. 本报告**不产生任何胜率、排名、β 或 CI**，也未重跑锦标赛。
2. `reply/` 内其它报告与 `tournaments/` 全部对应**修订前脚本**；用它们评价修订后脚本是无效推断。
3. 84 场对局只证明「可加载、可完成对局、动作合法」，**不证明策略强弱**；对局里使用的是内置 `tactical/economic/random` 对手与固定种子，不是锦标赛赛制。
4. 若要对比修订前后，需用同一主种子、同一赛制重跑并单独归档——该动作需用户拍板，本轮未执行。

---

## 9. 证据索引

| 事实 | 证据 |
|---|---|
| 隔离口径与排除清单 | `tools/agent-refresh-brief.md`、`tools/agent-refresh-updates.md`、`tools/agent-refresh-interface.md`；`README.md` 17.2 |
| 12 份公开更新说明 | `subagent-progress/<id>.md` 的「附录 · 2026-11-08 按程序更新修订（隔离轮）」 |
| 修订前基线 | `scripts/_backup-pre-refresh-20261108/agent-*.js` |
| 代码量 / 关键字矩阵 | 本报告第 3 节；可比 `git diff --no-index --numstat <备份> <现稿>` 复现 |
| 引擎前哨口径 | `src/engine/engine.js` 的 `teamHasOutpost()`；`src/engine/modes.js` 的 `isTeamMode()` |
| 卡牌口径 | `src/engine/cards.js` 的 `CARD_DEFS` / `EXPANSION_PACKS` |
| 验收 | `test/agent-refresh.test.js`；`npm test` 输出；`README.md` 17.4 |
| 机读版本报告 | `reply/star-realms-agent-refresh-report.json` |
| 修订后重跑 | `reply/rerun-20261109/`；`reply/star-realms-refresh-20261109-summary.md` |

---

## 10. 后续（2026-11-09 补记）

用户已拍板用修订后脚本、同一主种子与同一赛制全量重跑 10 场赛制，产物写入 `reply/`。因此：

- 第 0 节与第 8 节的「本轮未重跑锦标赛 / 未产生新赛果」是**本报告生成时刻（2026-11-09 09:20）的状态**，此后已被重跑取代；
- 修订前的 10 份报告已归档为 `reply/baseline-before-refresh/`（人读报告 + 指标快照；完整 JSON 见 git `72f646f`）；
- 重跑记录、逐场日志与新旧对照见 `reply/rerun-20261109/` 与 `reply/star-realms-refresh-20261109-summary.md`；
- 本报告第 1–7 节关于「脚本如何调整」的事实与代码证据**不受重跑影响**，仍然成立。
