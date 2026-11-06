# 星域奇航 · 2V2 实验室汇总（四场对照）

> 主种子 `lab-2v2-2026-11-06` · 生成于 2026-11-06T14:53:06.524Z

## 四场赛事

| 实验 | 牌包 | 届数 × 轮数 | 每场 BO | 总局数 | 前位队胜率 | 座位配平 | 重赛 / 重试 | 耗时 |
|---|---|---|---|---:|---:|---|---|---:|
| A 复制队 | 核心 | 12 × 5 | 8 | 2880 | 54.31% | 通过 | 0 / 0 | 505.1s |
| A 复制队 | 全扩 | 12 × 5 | 8 | 2880 | 55.28% | 通过 | 0 / 0 | 807.0s |
| B 随机组队 | 核心 | 12 × 5 | 8 | 1440 | 54.79% | 通过 | 0 / 0 | 256.5s |
| B 随机组队 | 全扩 | 12 × 5 | 8 | 1440 | 55.14% | 通过 | 0 / 0 | 371.8s |

## 实验 A · 同模型复制队（单脚本 2V2 能力）

| 牌包 | 冠军 | 局胜率 | 夺冠 | 亚军 | 亚军胜率 | 差距 | z |
|---|---|---:|---:|---|---:|---:|---:|
| 核心 | deepseek v4.1flash | 88.96%（427/480） | 11 | GLM5.3 | 65.21% | 23.75pp | 9.126 |
| 全扩 | deepseek v4.1flash | 79.79%（383/480） | 11 | deepseek v4pro | 60.21% | 19.58pp | 6.776 |

**核心前六**：1. deepseek v4.1flash 88.96%　2. GLM5.3 65.21%　3. MIMO-v2.6-pro 58.13%　4. MiniMax M3 57.92%　5. GLM5.3flash 54.58%　6. deepseek v4pro 54.37%
**全扩前六**：1. deepseek v4.1flash 79.79%　2. deepseek v4pro 60.21%　3. GLM5.3 60.21%　4. MiniMax M3 60.00%　5. MIMO-v2.6-pro 57.92%　6. KIMI 3.1pro 54.37%

## 实验 B · 随机组队（个人发挥）

| 牌包 | β 第一 | β | 在场胜率第一 | 胜率 | 所在队伍夺冠最多 | 次数 | 搭档覆盖 |
|---|---|---:|---|---:|---|---:|---:|
| 核心 | deepseek v4.1flash | 1.3108 | deepseek v4.1flash | 74.58% | deepseek v4.1flash | 8 | 59/66 |
| 全扩 | deepseek v4.1flash | 0.9083 | MiniMax M3 | 63.33% | deepseek v4.1flash | 8 | 61/66 |

**核心 β 前六**：1. deepseek v4.1flash 1.3108　2. GLM5.3 0.7382　3. MiniMax M3 0.5831　4. MIMO-v2.6-pro 0.4773　5. GLM5.3flash 0.4623　6. deepseek v4pro 0.399
**全扩 β 前六**：1. deepseek v4.1flash 0.9083　2. deepseek v4pro 0.4929　3. GLM5.3 0.4587　4. MiniMax M3 0.4577　5. MIMO-v2.6-pro 0.4358　6. GLM5.3flash 0.343

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
- **牌包影响**：全扩加入事件牌后，实验 A 冠军局胜率由 88.96% 降到 79.79%、β 由 1.3108 降到 0.9083，优势收窄但榜首未变，说明事件带来的随机性削弱了稳定策略的确定性优势。

## 口径提示

- 实验 A 的队友是该脚本自身的副本，队伍成绩可近似归因为脚本能力；实验 B 的胜负由两人共享，个人 β 是统计估计而非直接测量。
- 同一场 BO8 内对局不独立，所有 CI / SE / z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。
- 2v2 规则本身带前位优势，四场实测前位队胜率 54.31%～55.28%；每场 BO8 已把前后位严格配平，且 β 模型含前位截距 γ，不会把座位优势算到个人头上。
- 全扩 = 核心 + 殖民战争 + 危机事件；事件牌翻出即结算，会改变牌库节奏，因此两种牌包名次不必相同。

## 复现

```bash
node src/team-lab-cli.js --experiment clone --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-core
node src/team-lab-cli.js --experiment clone --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-all
node src/team-lab-cli.js --experiment random --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-random-core
node src/team-lab-cli.js --experiment random --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-random-all
node src/team-lab-summary.js
```
