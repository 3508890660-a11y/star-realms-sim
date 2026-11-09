# 星域奇航 · 2V2 实验室汇总（四场对照）

> 主种子 `lab-2v2-2026-11-06` · 生成于 2026-11-09T02:26:16.368Z

> 规则修正（2026-11-08）：起手牌改为官方「先手队全员 3 张、后手队全员 5 张」（旧实现误用自由混战的 3/4/5/5），并改为整队轮流——队内队友连续行动，弃手、补牌与基地伤害在队伍回合结束时结算。四场均已用同一主种子重跑。
> 脚本版本：2026-11-08 按程序更新修订的 12 份脚本（隔离轮）。本文件只读取 `reply/` 当前落盘报告，重跑即更新；修订前基线见 `reply/baseline-before-refresh/`。

## 四场赛事

| 实验 | 牌包 | 届数 × 轮数 | 每场 BO | 总局数 | 前位队胜率 | 座位配平 | 重赛 / 重试 | 耗时 |
|---|---|---|---|---:|---:|---|---|---:|
| A 复制队 | 核心 | 12 × 5 | 8 | 2880 | 53.75% | 通过 | 0 / 0 | 825.5s |
| A 复制队 | 全扩 | 12 × 5 | 8 | 2880 | 53.96% | 通过 | 0 / 0 | 1063.8s |
| B 随机组队 | 核心 | 12 × 5 | 8 | 1440 | 52.57% | 通过 | 0 / 0 | 407.4s |
| B 随机组队 | 全扩 | 12 × 5 | 8 | 1440 | 54.79% | 通过 | 0 / 0 | 537.6s |

## 实验 A · 同模型复制队（单脚本 2V2 能力）

| 牌包 | 冠军 | 局胜率 | 夺冠 | 亚军 | 亚军胜率 | 差距 | z |
|---|---|---:|---:|---|---:|---:|---:|
| 核心 | deepseek v4.1flash | 84.17%（404/480） | 12 | GLM5.3 | 62.71% | 21.46pp | 7.76 |
| 全扩 | deepseek v4.1flash | 71.04%（341/480） | 8 | MIMO-v2.6-pro | 63.12% | 7.92pp | 2.62 |

**核心前六**：1. deepseek v4.1flash 84.17%　2. GLM5.3 62.71%　3. MIMO-v2.6-pro 59.17%　4. deepseek v4pro 57.92%　5. MiniMax M3 57.50%　6. GLM5.3flash 56.87%
**全扩前六**：1. deepseek v4.1flash 71.04%　2. MIMO-v2.6-pro 63.12%　3. deepseek v4pro 62.71%　4. GLM5.3 61.88%　5. MiniMax M3 59.58%　6. GLM5.3flash 58.33%

## 实验 B · 随机组队（个人发挥）

| 牌包 | β 第一 | β | 在场胜率第一 | 胜率 | 所在队伍夺冠最多 | 次数 | 搭档覆盖 |
|---|---|---:|---|---:|---|---:|---:|
| 核心 | deepseek v4.1flash | 1.1791 | deepseek v4.1flash | 72.29% | deepseek v4.1flash | 8 | 59/66 |
| 全扩 | deepseek v4.1flash | 0.7204 | MiniMax M3 | 64.17% | deepseek v4pro | 7 | 61/66 |

**核心 β 前六**：1. deepseek v4.1flash 1.1791　2. MiniMax M3 0.6407　3. MIMO-v2.6-pro 0.5778　4. GLM5.3 0.4547　5. KIMI 3.1pro 0.3942　6. GLM5.3flash 0.3142
**全扩 β 前六**：1. deepseek v4.1flash 0.7204　2. deepseek v4pro 0.5887　3. GLM5.3 0.5074　4. MiniMax M3 0.4986　5. MIMO-v2.6-pro 0.4761　6. KIMI 3.1pro 0.2171

## 交叉结论

- **A/核心** 第一：deepseek v4.1flash（口径：复制队局胜率）
- **A/全扩** 第一：deepseek v4.1flash（口径：复制队局胜率）
- **B/核心** 第一：deepseek v4.1flash（口径：个人 β）
- **B/全扩** 第一：deepseek v4.1flash（口径：个人 β）

四场榜首完全一致，都是 **deepseek v4.1flash**：无论是「队友是自己的镜像」还是「随机搭档下控制队友/对手强度」，也无论是核心牌包还是全扩，它都排第一。

## 设计细节与解读

- **实验 A 参考 1v1 的赛制**：12 个参赛单位、每届 5 轮、同分优先 + 回溯零重赛，按局胜率聚合。12 队每届只打 30 个对阵（K12 共 66 条边），覆盖不全由 12 届不同种子聚合补足，与 1v1 正式赛口径一致。
- **实验 B 的组队方式**：每届随机把 12 个模型配成 6 队，12 届累计覆盖 59～61 种不同搭档（共 66 种），避免某人长期绑定固定队友；β 已扣除队友与对手强度。
- **两种口径不一致时以 β 为准**：全扩下「在场队伍胜率第一」与「β 第一」不是同一模型，正说明队伍胜负会被队友带高；这正是随机组队 + 边际贡献拟合要解决的问题。
- **牌包影响**：全扩加入事件牌后，实验 A 冠军局胜率 84.17% → 71.04%、榜首 β 1.3376 → 0.8877；榜首未变，说明事件牌与新增卡池会改变节奏与优势幅度。

## 口径提示

- 实验 A 的队友是该脚本自身的副本，队伍成绩可近似归因为脚本能力；实验 B 的胜负由两人共享，个人 β 是统计估计而非直接测量。
- 同一场 BO8 内对局不独立，所有 CI / SE / z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。
- 2v2 规则本身带前位优势，四场实测前位队胜率 52.57%～54.79%；每场 BO8 已把前后位严格配平，且 β 模型含前位截距 γ，不会把座位优势算到个人头上。
- 全扩 = 核心 + 殖民战争 + 危机事件；事件牌翻出即结算，会改变牌库节奏，因此两种牌包名次不必相同。

## 复现

```bash
node src/team-lab-cli.js --experiment clone --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-core
node src/team-lab-cli.js --experiment clone --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-all
node src/team-lab-cli.js --experiment random --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-random-core
node src/team-lab-cli.js --experiment random --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-random-all
node src/team-lab-summary.js
```
