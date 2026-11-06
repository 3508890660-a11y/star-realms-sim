# 星域奇航 · 2V2 组队瑞士轮赛果

> 运行 ID `team-swiss-20261106` · 主种子 `swiss-2026-11-05` · 生成于 2026-11-06T01:18:15.174Z

## 结论

**冠军队伍：DeepSeek 联队**（deepseek v4.1flash + deepseek v4pro）。局胜率 **84.38%**（405/480），Wilson 95% CI [80.86%, 87.35%]；12 届中夺冠 **12** 次，平均名次 1，累计场分 58，前位 90.00% / 后位 78.75%。

亚军 GLM 联队 为 68.33%，差 16.05pp，两比例近似 z = 5.959，**达到 95% 显著**。

## 队伍构成

| 队伍 | 类型 | 厂商 | 队员 A | 队员 B | 队员自选策略 |
|---|---|---|---|---|---|
| 混元联队 | 同厂配对 | Hy | hy4 | hy3 | 薄牌护城河 / 协同滚雪球 |
| GLM 联队 | 同厂配对 | GLM | GLM5.3 | GLM5.3flash | 曲线竞速（Curve Race） / 精炼雪球（Refined Snowball） |
| MiniMax 联队 | 同厂配对 | MiniMax | MiniMax M3 | MiniMax M3.1flash | 壁垒重锤 / 破垒夺权 |
| KIMI 联队 | 同厂配对 | KIMI | KIMI 3.1pro | KIMI 2.8preview | 压缩脉冲 / 蜂群速攻（Blitz Swarm） |
| DeepSeek 联队 | 同厂配对 | DeepSeek | deepseek v4.1flash | deepseek v4pro | 三段涨潮 / 价值节奏快攻（Tempo-Value Aggro） |
| 混编联队 | 混编 | StepFun + MIMO | step5preview | MIMO-v2.6-pro | 雪球收割（Snowball-Reap） / 闪电压制 |

## 赛制与随机化

- 6 支队伍 × 5 轮瑞士轮 × 12 届；每轮 3 场，场分胜 1 / 平 0.5 / 负 0。
- 每场 **BO8** = 8 种座位排列 × 1 轮；每局独立随机种子。
- 2v2 引擎的 team0 = 座位 [0,2]、team1 = 座位 [1,3]。完全配平需覆盖「哪队占前位 × A 队谁在前 × B 队谁在前」= 8 种组合，因此采用 8 的倍数而非 1v1 的 BO10。
- 每场排列顺序由主种子 `:seats:sN:rR:mM` 洗牌；配对由 `:pair:rN` 同分随机排序 + 零重赛回溯匹配；最终同分用 `:tiebreak`。
- 牌包：core；模式 team2v2（共享 75 权威、队友前哨保护、资源预留）。

## 聚合总榜

| 名次 | 队伍 | 类型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 | 平均 Buchholz |
|---:|---|---|---:|---:|---:|---:|---:|---|---:|
| 1 | DeepSeek 联队 | 同厂 | 12 | 1 | 84.38% | 405/480 | 58 | 90.00% / 78.75% | 10.17 |
| 2 | GLM 联队 | 同厂 | 0 | 2.08 | 68.33% | 328/480 | 47 | 74.58% / 62.08% | 11.17 |
| 3 | KIMI 联队 | 同厂 | 0 | 3.25 | 53.54% | 257/480 | 31 | 61.67% / 45.42% | 12.25 |
| 4 | 混编联队 | 混编 | 0 | 4.08 | 44.79% | 215/480 | 25 | 55.00% / 34.58% | 13.42 |
| 5 | 混元联队 | 同厂 | 0 | 4.58 | 35.63% | 171/480 | 17.5 | 35.42% / 35.83% | 13.21 |
| 6 | MiniMax 联队 | 同厂 | 0 | 6 | 13.33% | 64/480 | 1.5 | 15.83% / 10.83% | 14.79 |

## 各届冠军

第 1 届：DeepSeek 联队（MP 5，局胜 38）；第 2 届：DeepSeek 联队（MP 5，局胜 31）；第 3 届：DeepSeek 联队（MP 5，局胜 33）；第 4 届：DeepSeek 联队（MP 4，局胜 30）；第 5 届：DeepSeek 联队（MP 4.5，局胜 31）；第 6 届：DeepSeek 联队（MP 5，局胜 35）；第 7 届：DeepSeek 联队（MP 5，局胜 33）；第 8 届：DeepSeek 联队（MP 5，局胜 33）；第 9 届：DeepSeek 联队（MP 5，局胜 38）；第 10 届：DeepSeek 联队（MP 5，局胜 36）；第 11 届：DeepSeek 联队（MP 5，局胜 35）；第 12 届：DeepSeek 联队（MP 4.5，局胜 32）。

## 队员分项

| 模型 | 队伍 | 参与局 | 队伍胜率 | 坐 0 号位胜率 | 本队前位胜率 |
|---|---|---:|---:|---:|---:|
| deepseek v4.1flash | DeepSeek 联队 | 480 | 84.38% | 88.33% | 82.50% |
| deepseek v4pro | DeepSeek 联队 | 480 | 84.38% | 91.67% | 86.25% |
| GLM5.3 | GLM 联队 | 480 | 68.33% | 75.00% | 66.67% |
| GLM5.3flash | GLM 联队 | 480 | 68.33% | 74.17% | 70.00% |
| KIMI 2.8preview | KIMI 联队 | 480 | 53.54% | 61.67% | 52.92% |
| KIMI 3.1pro | KIMI 联队 | 480 | 53.54% | 61.67% | 54.17% |
| MIMO-v2.6-pro | 混编联队 | 480 | 44.79% | 59.17% | 47.50% |
| step5preview | 混编联队 | 480 | 44.79% | 50.83% | 42.08% |
| hy3 | 混元联队 | 480 | 35.63% | 36.67% | 37.50% |
| hy4 | 混元联队 | 480 | 35.63% | 34.17% | 33.75% |
| MiniMax M3 | MiniMax 联队 | 480 | 13.33% | 15.00% | 13.75% |
| MiniMax M3.1flash | MiniMax 联队 | 480 | 13.33% | 16.67% | 12.92% |

## 账目守恒

| 项目 | 值 |
|---|---|
| 全部届总局数 | 1440 |
| 实际完成局数 | 1440 |
| 每队总局数 | 480 |
| 重赛 / 异常重试 | 8 / 0 |
| 前位队胜率 | 55.42%（798/1440） |
| 座位配平 | 通过（每个模型在每个座位出现次数相同） |
| 冠亚 95% CI | [80.86%, 87.35%] / [64.04%, 72.34%] |
| 耗时 | 303.4s |

## 各届逐轮明细

### 第 1 届 · 种子 swiss-2026-11-05:s1

- 第 1 轮 · 配对顺序 混编联队 → GLM 联队 → 混元联队 → KIMI 联队 → DeepSeek 联队 → MiniMax 联队
  - 混编联队 2:6 GLM 联队 [A前 ABAB | B前 BBBB]
  - 混元联队 4:4 KIMI 联队 [A前 BABA | B前 BABA]
  - DeepSeek 联队 7:1 MiniMax 联队 [A前 AAAA | B前 AABA]
- 第 2 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混元联队 → MiniMax 联队 → 混编联队
  - DeepSeek 联队 8:0 GLM 联队 [A前 AAAA | B前 AAAA]
  - KIMI 联队 4:4 MiniMax 联队 [A前 BAAB | B前 BAAB]
  - 混元联队 2:6 混编联队 [A前 AABB | B前 BBBB]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → KIMI 联队 → GLM 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 KIMI 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 6:2 混元联队 [A前 BAAA | B前 AAAB]
  - 混编联队 6:2 MiniMax 联队 [A前 AAAA | B前 ABBA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → 混编联队 → GLM 联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 混编联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 6:2 KIMI 联队 [A前 ABAA | B前 AABA]
  - 混元联队 4:4 MiniMax 联队 [A前 BBAA | B前 BAAB]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → MiniMax 联队 → 混元联队
  - DeepSeek 联队 7:1 混元联队 [A前 AAAA | B前 AAAB]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混编联队 3:5 KIMI 联队 [A前 BABB | B前 BAAB]

### 第 2 届 · 种子 swiss-2026-11-05:s2

- 第 1 轮 · 配对顺序 DeepSeek 联队 → 混编联队 → 混元联队 → KIMI 联队 → MiniMax 联队 → GLM 联队
  - DeepSeek 联队 6:2 混编联队 [A前 AABB | B前 AAAA]
  - 混元联队 2:6 KIMI 联队 [A前 BABB | B前 BABB]
  - MiniMax 联队 0:8 GLM 联队 [A前 BBBB | B前 BBBB]
- 第 2 轮 · 配对顺序 GLM 联队 → KIMI 联队 → DeepSeek 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - GLM 联队 7:1 KIMI 联队 [A前 ABAA | B前 AAAA]
  - DeepSeek 联队 6:2 混元联队 [A前 BAAA | B前 AABA]
  - 混编联队 6:2 MiniMax 联队 [A前 AAAA | B前 BBAA]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → MiniMax 联队 → 混元联队
  - DeepSeek 联队 5:3 GLM 联队 [A前 AAAB | B前 AABB]
  - KIMI 联队 3:5 混编联队 [A前 ABAB | B前 ABBB]
  - MiniMax 联队 3:5 混元联队 [A前 AABA | B前 BBBB]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → 混编联队 → GLM 联队 → 混元联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAA | B前 BBAA]
  - 混编联队 2:6 GLM 联队 [A前 BBBA | B前 ABBB]
  - 混元联队 6:2 MiniMax 联队 [A前 AABA | B前 ABAA] · 重赛
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → 混元联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 8:0 混元联队 [A前 AAAA | B前 AAAA]
  - 混编联队 4:4 KIMI 联队 [A前 AAAA | B前 BBBB] · 重赛

### 第 3 届 · 种子 swiss-2026-11-05:s3

- 第 1 轮 · 配对顺序 KIMI 联队 → 混编联队 → DeepSeek 联队 → MiniMax 联队 → 混元联队 → GLM 联队
  - KIMI 联队 2:6 混编联队 [A前 BBAB | B前 BABB]
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混元联队 1:7 GLM 联队 [A前 BBBB | B前 ABBB]
- 第 2 轮 · 配对顺序 混编联队 → DeepSeek 联队 → GLM 联队 → KIMI 联队 → MiniMax 联队 → 混元联队
  - 混编联队 1:7 DeepSeek 联队 [A前 BABB | B前 BBBB]
  - GLM 联队 6:2 KIMI 联队 [A前 BAAA | B前 AABA]
  - MiniMax 联队 3:5 混元联队 [A前 BBBB | B前 AABA]
- 第 3 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → 混编联队 → 混元联队 → MiniMax 联队 → KIMI 联队
  - GLM 联队 3:5 DeepSeek 联队 [A前 BBAA | B前 BBBA]
  - 混编联队 2:6 混元联队 [A前 ABBB | B前 BBAB]
  - MiniMax 联队 0:8 KIMI 联队 [A前 BBBB | B前 BBBB]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → 混编联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 7:1 混元联队 [A前 AAAA | B前 ABAA]
  - GLM 联队 6:2 混编联队 [A前 AAAA | B前 BAAB]
  - KIMI 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA] · 重赛
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAB | B前 BAAA]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混元联队 2:6 混编联队 [A前 BBAA | B前 BBBB] · 重赛

### 第 4 届 · 种子 swiss-2026-11-05:s4

- 第 1 轮 · 配对顺序 KIMI 联队 → MiniMax 联队 → 混编联队 → DeepSeek 联队 → 混元联队 → GLM 联队
  - KIMI 联队 5:3 MiniMax 联队 [A前 ABAB | B前 AABA]
  - 混编联队 1:7 DeepSeek 联队 [A前 ABBB | B前 BBBB]
  - 混元联队 3:5 GLM 联队 [A前 ABBB | B前 ABAB]
- 第 2 轮 · 配对顺序 KIMI 联队 → GLM 联队 → DeepSeek 联队 → 混元联队 → MiniMax 联队 → 混编联队
  - KIMI 联队 6:2 GLM 联队 [A前 AAAA | B前 BBAA]
  - DeepSeek 联队 7:1 混元联队 [A前 BAAA | B前 AAAA]
  - MiniMax 联队 3:5 混编联队 [A前 ABAA | B前 BBBB]
- 第 3 轮 · 配对顺序 KIMI 联队 → DeepSeek 联队 → 混编联队 → GLM 联队 → 混元联队 → MiniMax 联队
  - KIMI 联队 4:4 DeepSeek 联队 [A前 BAAA | B前 BABB]
  - 混编联队 3:5 GLM 联队 [A前 BABA | B前 ABBB]
  - 混元联队 7:1 MiniMax 联队 [A前 ABAA | B前 AAAA]
- 第 4 轮 · 配对顺序 KIMI 联队 → DeepSeek 联队 → GLM 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - KIMI 联队 4:4 混编联队 [A前 AABA | B前 ABBB]
  - DeepSeek 联队 4:4 GLM 联队 [A前 AAAB | B前 ABBB]
  - 混元联队 4:4 MiniMax 联队 [A前 ABBA | B前 AABB] · 重赛
- 第 5 轮 · 配对顺序 KIMI 联队 → DeepSeek 联队 → GLM 联队 → 混元联队 → 混编联队 → MiniMax 联队
  - KIMI 联队 5:3 混元联队 [A前 BBAA | B前 AABA]
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 5:3 混编联队 [A前 AAAA | B前 BBAB] · 重赛

### 第 5 届 · 种子 swiss-2026-11-05:s5

- 第 1 轮 · 配对顺序 MiniMax 联队 → KIMI 联队 → GLM 联队 → 混元联队 → 混编联队 → DeepSeek 联队
  - MiniMax 联队 0:8 KIMI 联队 [A前 BBBB | B前 BBBB]
  - GLM 联队 5:3 混元联队 [A前 BABB | B前 AAAA]
  - 混编联队 2:6 DeepSeek 联队 [A前 BBBA | B前 BBAB]
- 第 2 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → KIMI 联队 → MiniMax 联队 → 混元联队 → 混编联队
  - GLM 联队 4:4 DeepSeek 联队 [A前 AAAA | B前 BBBB]
  - KIMI 联队 7:1 混元联队 [A前 AABA | B前 AAAA]
  - MiniMax 联队 1:7 混编联队 [A前 BABB | B前 BBBB]
- 第 3 轮 · 配对顺序 KIMI 联队 → GLM 联队 → DeepSeek 联队 → 混编联队 → MiniMax 联队 → 混元联队
  - KIMI 联队 3:5 GLM 联队 [A前 BAAB | B前 ABBB]
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混编联队 6:2 混元联队 [A前 AABA | B前 AABA]
- 第 4 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - GLM 联队 7:1 混编联队 [A前 AAAA | B前 ABAA]
  - DeepSeek 联队 7:1 KIMI 联队 [A前 AAAA | B前 ABAA]
  - 混元联队 7:1 MiniMax 联队 [A前 AABA | B前 AAAA]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 6:2 混元联队 [A前 AABA | B前 ABAA]
  - GLM 联队 7:1 MiniMax 联队 [A前 AAAA | B前 BAAA]
  - KIMI 联队 4:4 混编联队 [A前 AAAB | B前 BBBA]

### 第 6 届 · 种子 swiss-2026-11-05:s6

- 第 1 轮 · 配对顺序 混编联队 → DeepSeek 联队 → MiniMax 联队 → 混元联队 → GLM 联队 → KIMI 联队
  - 混编联队 0:8 DeepSeek 联队 [A前 BBBB | B前 BBBB]
  - MiniMax 联队 1:7 混元联队 [A前 BBBB | B前 BBAB]
  - GLM 联队 7:1 KIMI 联队 [A前 AABA | B前 AAAA]
- 第 2 轮 · 配对顺序 GLM 联队 → 混元联队 → DeepSeek 联队 → 混编联队 → MiniMax 联队 → KIMI 联队
  - GLM 联队 6:2 混元联队 [A前 BAAA | B前 ABAA]
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混编联队 4:4 KIMI 联队 [A前 AAAB | B前 BABB]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 6:2 GLM 联队 [A前 ABAA | B前 AAAB]
  - 混元联队 2:6 KIMI 联队 [A前 BBAB | B前 BBAB]
  - 混编联队 7:1 MiniMax 联队 [A前 AAAA | B前 AABA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAA | B前 BBAA]
  - GLM 联队 7:1 MiniMax 联队 [A前 AAAA | B前 ABAA]
  - 混编联队 5:3 混元联队 [A前 ABBA | B前 AABA]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 7:1 混元联队 [A前 AAAA | B前 AAAB]
  - GLM 联队 5:3 混编联队 [A前 ABAA | B前 BBAA]
  - KIMI 联队 7:1 MiniMax 联队 [A前 AAAA | B前 AAAB]

### 第 7 届 · 种子 swiss-2026-11-05:s7

- 第 1 轮 · 配对顺序 MiniMax 联队 → KIMI 联队 → GLM 联队 → DeepSeek 联队 → 混编联队 → 混元联队
  - MiniMax 联队 2:6 KIMI 联队 [A前 BBBA | B前 BBAB]
  - GLM 联队 3:5 DeepSeek 联队 [A前 ABAB | B前 BBAB]
  - 混编联队 3:5 混元联队 [A前 BBBB | B前 BAAA]
- 第 2 轮 · 配对顺序 混元联队 → DeepSeek 联队 → KIMI 联队 → MiniMax 联队 → 混编联队 → GLM 联队
  - 混元联队 1:7 DeepSeek 联队 [A前 BBAB | B前 BBBB]
  - KIMI 联队 2:6 混编联队 [A前 ABBA | B前 BBBB]
  - MiniMax 联队 0:8 GLM 联队 [A前 BBBB | B前 BBBB]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAA | B前 BBAA]
  - GLM 联队 7:1 混编联队 [A前 AAAA | B前 AAAB]
  - 混元联队 7:1 MiniMax 联队 [A前 AAAA | B前 AABA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → 混编联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 7:1 混编联队 [A前 AAAA | B前 AABA]
  - GLM 联队 8:0 混元联队 [A前 AAAA | B前 AAAA]
  - KIMI 联队 7:1 MiniMax 联队 [A前 AAAA | B前 AABA] · 重赛
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 5:3 KIMI 联队 [A前 AAAA | B前 BBBA]
  - 混元联队 4:4 混编联队 [A前 BBAA | B前 BAAB] · 重赛

### 第 8 届 · 种子 swiss-2026-11-05:s8

- 第 1 轮 · 配对顺序 混编联队 → MiniMax 联队 → GLM 联队 → KIMI 联队 → 混元联队 → DeepSeek 联队
  - 混编联队 7:1 MiniMax 联队 [A前 AAAB | B前 AAAA]
  - GLM 联队 5:3 KIMI 联队 [A前 AABA | B前 AABB]
  - 混元联队 0:8 DeepSeek 联队 [A前 BBBB | B前 BBBB]
- 第 2 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - GLM 联队 2:6 DeepSeek 联队 [A前 BBBB | B前 BAAB]
  - 混编联队 3:5 KIMI 联队 [A前 BBAB | B前 AABB]
  - 混元联队 6:2 MiniMax 联队 [A前 ABAA | B前 AAAB]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → 混元联队 → 混编联队 → GLM 联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 5:3 混编联队 [A前 ABAA | B前 BBAA]
  - 混元联队 0:8 GLM 联队 [A前 BBBB | B前 BBBB]
  - KIMI 联队 7:1 MiniMax 联队 [A前 AABA | B前 AAAA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → KIMI 联队 → GLM 联队 → 混元联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAB | B前 BAAA]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混元联队 1:7 混编联队 [A前 BABB | B前 BBBB]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 5:3 混编联队 [A前 BABA | B前 BAAA]
  - KIMI 联队 6:2 混元联队 [A前 BAAB | B前 AAAA]

### 第 9 届 · 种子 swiss-2026-11-05:s9

- 第 1 轮 · 配对顺序 DeepSeek 联队 → KIMI 联队 → 混编联队 → 混元联队 → GLM 联队 → MiniMax 联队
  - DeepSeek 联队 8:0 KIMI 联队 [A前 AAAA | B前 AAAA]
  - 混编联队 5:3 混元联队 [A前 ABAA | B前 ABBA]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
- 第 2 轮 · 配对顺序 混编联队 → DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → MiniMax 联队
  - 混编联队 0:8 DeepSeek 联队 [A前 BBBB | B前 BBBB]
  - GLM 联队 6:2 混元联队 [A前 ABAA | B前 BAAA]
  - KIMI 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
- 第 3 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - GLM 联队 2:6 DeepSeek 联队 [A前 BBAB | B前 ABBB]
  - KIMI 联队 4:4 混编联队 [A前 AAAA | B前 BBBB]
  - 混元联队 6:2 MiniMax 联队 [A前 BAAA | B前 AABA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 混元联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 5:3 KIMI 联队 [A前 BAAA | B前 ABBA]
  - 混编联队 5:3 MiniMax 联队 [A前 AAAB | B前 BBAA]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 5:3 混编联队 [A前 BAAA | B前 BAAB]
  - KIMI 联队 8:0 混元联队 [A前 AAAA | B前 AAAA]

### 第 10 届 · 种子 swiss-2026-11-05:s10

- 第 1 轮 · 配对顺序 GLM 联队 → KIMI 联队 → 混元联队 → DeepSeek 联队 → 混编联队 → MiniMax 联队
  - GLM 联队 6:2 KIMI 联队 [A前 AAAB | B前 BAAA]
  - 混元联队 0:8 DeepSeek 联队 [A前 BBBB | B前 BBBB]
  - 混编联队 7:1 MiniMax 联队 [A前 AAAA | B前 ABAA]
- 第 2 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 6:2 GLM 联队 [A前 AAAA | B前 BBAA]
  - 混编联队 2:6 KIMI 联队 [A前 BABB | B前 BBAB]
  - 混元联队 5:3 MiniMax 联队 [A前 BBAA | B前 AABA]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 6:2 KIMI 联队 [A前 AAAA | B前 BABA]
  - GLM 联队 7:1 MiniMax 联队 [A前 AAAA | B前 ABAA]
  - 混元联队 3:5 混编联队 [A前 BBAB | B前 BABA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 混编联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 6:2 混元联队 [A前 AAAA | B前 AABB]
  - KIMI 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 4:4 混编联队 [A前 BAAB | B前 BABA]
  - KIMI 联队 6:2 混元联队 [A前 AAAA | B前 BAAB]

### 第 11 届 · 种子 swiss-2026-11-05:s11

- 第 1 轮 · 配对顺序 混编联队 → MiniMax 联队 → 混元联队 → DeepSeek 联队 → KIMI 联队 → GLM 联队
  - 混编联队 6:2 MiniMax 联队 [A前 AABA | B前 AAAB]
  - 混元联队 1:7 DeepSeek 联队 [A前 BBBB | B前 ABBB]
  - KIMI 联队 2:6 GLM 联队 [A前 ABBB | B前 BBAB]
- 第 2 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 7:1 GLM 联队 [A前 AAAA | B前 ABAA]
  - 混编联队 4:4 KIMI 联队 [A前 BAAA | B前 BBBA]
  - 混元联队 7:1 MiniMax 联队 [A前 BAAA | B前 AAAA]
- 第 3 轮 · 配对顺序 DeepSeek 联队 → 混编联队 → GLM 联队 → 混元联队 → KIMI 联队 → MiniMax 联队
  - DeepSeek 联队 8:0 混编联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 7:1 混元联队 [A前 AAAA | B前 AABA]
  - KIMI 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混编联队 → KIMI 联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 5:3 KIMI 联队 [A前 ABAB | B前 BAAA]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - 混编联队 3:5 混元联队 [A前 AABB | B前 BBAB]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → 混元联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 6:2 混编联队 [A前 ABBA | B前 AAAA]
  - 混元联队 3:5 KIMI 联队 [A前 AABA | B前 BBBB]

### 第 12 届 · 种子 swiss-2026-11-05:s12

- 第 1 轮 · 配对顺序 KIMI 联队 → DeepSeek 联队 → 混元联队 → MiniMax 联队 → 混编联队 → GLM 联队
  - KIMI 联队 4:4 DeepSeek 联队 [A前 BABA | B前 BAAB]
  - 混元联队 6:2 MiniMax 联队 [A前 BAAA | B前 AAAB]
  - 混编联队 3:5 GLM 联队 [A前 AAAB | B前 BBBB]
- 第 2 轮 · 配对顺序 混元联队 → GLM 联队 → DeepSeek 联队 → KIMI 联队 → 混编联队 → MiniMax 联队
  - 混元联队 2:6 GLM 联队 [A前 BBAB | B前 ABBB]
  - DeepSeek 联队 7:1 混编联队 [A前 AAAA | B前 AABA]
  - KIMI 联队 7:1 MiniMax 联队 [A前 AAAA | B前 AAAB]
- 第 3 轮 · 配对顺序 GLM 联队 → DeepSeek 联队 → KIMI 联队 → 混元联队 → MiniMax 联队 → 混编联队
  - GLM 联队 3:5 DeepSeek 联队 [A前 ABBA | B前 BABB]
  - KIMI 联队 6:2 混元联队 [A前 ABAA | B前 AAAB]
  - MiniMax 联队 1:7 混编联队 [A前 BBAB | B前 BBBB]
- 第 4 轮 · 配对顺序 DeepSeek 联队 → KIMI 联队 → GLM 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 混元联队 [A前 AAAA | B前 AAAA]
  - KIMI 联队 4:4 混编联队 [A前 AAAA | B前 BBBB]
  - GLM 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
- 第 5 轮 · 配对顺序 DeepSeek 联队 → GLM 联队 → KIMI 联队 → 混编联队 → 混元联队 → MiniMax 联队
  - DeepSeek 联队 8:0 MiniMax 联队 [A前 AAAA | B前 AAAA]
  - GLM 联队 4:4 KIMI 联队 [A前 ABAB | B前 BABA]
  - 混编联队 4:4 混元联队 [A前 BBAA | B前 ABAB]

## 逐局明细与复现

完整逐局记录（每局种子、4 个座位、前位队、引擎获胜队伍、终局权威）见 `team-swiss-20261106.json` 的 `seasons[].rounds[].pairs[].games`。

```bash
node src/team-tourney-cli.js --seed swiss-2026-11-05 --seasons 12 --rounds 5 --repeats 1 --sets core
```
