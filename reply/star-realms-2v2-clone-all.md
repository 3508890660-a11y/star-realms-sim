# 星域奇航 · 2V2 实验室 · 实验 A 同模型复制队（全扩）

> 运行 ID `clone-all-12x5-1794144075245` · 主种子 `lab-2v2-2026-11-06` · 生成于 2026-11-08T13:36:06.501Z

## 结论

**2V2 能力第一：deepseek v4.1flash**（deepseek v4.1flash 复制队，队友是该脚本自身的副本）。局胜率 **73.12%**（351/480），Wilson 95% CI [68.99%, 76.90%]；12 届中夺冠 **11** 次，平均名次 1.25，累计场分 54。

亚军 MIMO-v2.6-pro 61.88%，差 11.24pp，两比例近似 z = 3.745，**达到 95% 显著**。

## 实验设计

- 12 支队伍，每队由**同一份 AI 脚本的两个副本**组成；队友是自己的镜像，因此队伍成绩可近似归因为该脚本的 2V2 能力。
- **赛制参考 1v1 瑞士轮**：12 个参赛单位、每届 5 轮、每轮 6 场、场分胜 1 / 平 0.5 / 负 0；同分优先 + 回溯零重赛配对，最终排名比较 MP → 局胜 → Buchholz → Sonneborn–Berger → 种子优先级。
- 12 届独立重跑，聚合榜按**局胜率**排序（局分比场分样本更细），与 1v1 正式赛口径一致。
- 每场 **BO8**：覆盖「哪队占前位 × A 队谁在前 × B 队谁在前」共 8 种座位排列 × 1 轮；每局独立随机种子。2v2 中座位 [0,2] 一队、[1,3] 一队，共享 75 点权威。
- 牌包：**全扩** = core + colonyWars + events；模式 team2v2（同队前哨保护、回合末资源预留）。

## 口径与局限

- 2v2 的胜负是**队伍共享**的，任何个人指标都是统计估计而非直接测量；β 依赖「随机组队让队友/对手强度在期望上抵消」这一设计假设。
- 同一场 BO8 内的对局并不独立，置信区间、SE 与 z 均为近似参考；结论只适用于本赛制、本牌包与这组种子。
- 复制队里两个副本使用同一份脚本，但各自拥有独立的 `memory` 与随机流（脚本模块级只有只读常量表），不存在跨座位状态串扰。
- 全扩牌包含事件牌，事件翻出即结算；脚本需自行处理 `eventChoice` 等动作。

## 队伍构成

| 队伍 | 脚本 | 策略 | 两个座位 |
|---|---|---|---|
| hy4 复制队 | `script:agent-hy4.js` | 薄牌护城河 | hy4#a / hy4#b |
| hy3 复制队 | `script:agent-hy3.js` | 协同滚雪球 | hy3#a / hy3#b |
| GLM5.3 复制队 | `script:agent-glm53.js` | 曲线竞速（Curve Race） | glm53#a / glm53#b |
| GLM5.3flash 复制队 | `script:agent-glm53flash.js` | 精炼雪球（Refined Snowball） | glm53flash#a / glm53flash#b |
| MiniMax M3 复制队 | `script:agent-minimaxm3.js` | 壁垒重锤 | minimaxm3#a / minimaxm3#b |
| MiniMax M3.1flash 复制队 | `script:agent-minimaxm31flash.js` | 破垒夺权 | minimaxm31flash#a / minimaxm31flash#b |
| KIMI 3.1pro 复制队 | `script:agent-kimi31pro.js` | 压缩脉冲 | kimi31pro#a / kimi31pro#b |
| KIMI 2.8preview 复制队 | `script:agent-kimi28preview.js` | 蜂群速攻（Blitz Swarm） | kimi28preview#a / kimi28preview#b |
| deepseek v4.1flash 复制队 | `script:agent-deepseekv41flash.js` | 三段涨潮 | deepseekv41flash#a / deepseekv41flash#b |
| deepseek v4pro 复制队 | `script:agent-deepseekv4pro.js` | 价值节奏快攻（Tempo-Value Aggro） | deepseekv4pro#a / deepseekv4pro#b |
| step5preview 复制队 | `script:agent-step5preview.js` | 雪球收割（Snowball-Reap） | step5preview#a / step5preview#b |
| MIMO-v2.6-pro 复制队 | `script:agent-mimov26pro.js` | 闪电压制 | mimov26pro#a / mimov26pro#b |

## 聚合总榜（= 单模型 2V2 能力榜）

| 名次 | 模型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 | 平均 Buchholz |
|---:|---|---:|---:|---:|---:|---:|---|---:|
| 1 | deepseek v4.1flash | 11 | 1.25 | 73.12% | 351/480 | 54 | 77.08% / 69.17% | 14.04 |
| 2 | MIMO-v2.6-pro | 1 | 3.08 | 61.88% | 297/480 | 42 | 70.83% / 52.92% | 13.92 |
| 3 | MiniMax M3 | 0 | 4.67 | 61.67% | 296/480 | 36 | 64.17% / 59.17% | 13.04 |
| 4 | GLM5.3 | 0 | 3.75 | 60.62% | 291/480 | 39 | 63.75% / 57.50% | 14.17 |
| 5 | deepseek v4pro | 0 | 4.42 | 59.17% | 284/480 | 37.5 | 64.17% / 54.17% | 13.21 |
| 6 | GLM5.3flash | 0 | 5.58 | 54.58% | 262/480 | 33.5 | 59.58% / 49.58% | 13.75 |
| 7 | KIMI 3.1pro | 0 | 7.42 | 51.88% | 249/480 | 28.5 | 55.83% / 47.92% | 11.88 |
| 8 | KIMI 2.8preview | 0 | 7.58 | 50.83% | 244/480 | 28 | 56.25% / 45.42% | 12.08 |
| 9 | hy3 | 0 | 8.92 | 47.08% | 226/480 | 24.5 | 51.25% / 42.92% | 10.96 |
| 10 | hy4 | 0 | 8.42 | 46.04% | 221/480 | 23.5 | 45.83% / 46.25% | 11.08 |
| 11 | step5preview | 0 | 10.92 | 30.83% | 148/480 | 13.5 | 33.75% / 27.92% | 10.5 |
| 12 | MiniMax M3.1flash | 0 | 12 | 2.29% | 11/480 | 0 | 2.08% / 2.50% | 11.38 |

## 各届冠军

第 1 届：deepseek v4.1flash（MP 4.5，局胜 27）；第 2 届：deepseek v4.1flash（MP 4，局胜 30）；第 3 届：deepseek v4.1flash（MP 5，局胜 30）；第 4 届：deepseek v4.1flash（MP 4.5，局胜 31）；第 5 届：deepseek v4.1flash（MP 5，局胜 27）；第 6 届：deepseek v4.1flash（MP 5，局胜 33）；第 7 届：deepseek v4.1flash（MP 4.5，局胜 27）；第 8 届：deepseek v4.1flash（MP 4.5，局胜 30）；第 9 届：deepseek v4.1flash（MP 5，局胜 36）；第 10 届：deepseek v4.1flash（MP 5，局胜 30）；第 11 届：deepseek v4.1flash（MP 4，局胜 26）；第 12 届：MIMO-v2.6-pro（MP 5，局胜 29）。

## 个人在场统计

| 模型 | 参与局（去重） | 座位次数 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 搭档数 | 对手数 | 所在队伍夺冠 | 座位分布 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| deepseekv41flash | 480 | 960 | 351 | 73.12% | [68.99%, 76.90%] | 77.08% | 0 | 11 | 11 | 240/240/240/240 |
| mimov26pro | 480 | 960 | 297 | 61.88% | [57.45%, 66.11%] | 70.83% | 0 | 11 | 1 | 240/240/240/240 |
| minimaxm3 | 480 | 960 | 296 | 61.67% | [57.24%, 65.91%] | 64.17% | 0 | 11 | 0 | 240/240/240/240 |
| glm53 | 480 | 960 | 291 | 60.62% | [56.19%, 64.89%] | 63.75% | 0 | 11 | 0 | 240/240/240/240 |
| deepseekv4pro | 480 | 960 | 284 | 59.17% | [54.71%, 63.47%] | 64.17% | 0 | 11 | 0 | 240/240/240/240 |
| glm53flash | 480 | 960 | 262 | 54.58% | [50.11%, 58.98%] | 59.58% | 0 | 11 | 0 | 240/240/240/240 |
| kimi31pro | 480 | 960 | 249 | 51.88% | [47.41%, 56.31%] | 55.83% | 0 | 11 | 0 | 240/240/240/240 |
| kimi28preview | 480 | 960 | 244 | 50.83% | [46.37%, 55.28%] | 56.25% | 0 | 11 | 0 | 240/240/240/240 |
| hy3 | 480 | 960 | 226 | 47.08% | [42.66%, 51.55%] | 51.25% | 0 | 11 | 0 | 240/240/240/240 |
| hy4 | 480 | 960 | 221 | 46.04% | [41.63%, 50.51%] | 45.83% | 0 | 11 | 0 | 240/240/240/240 |
| step5preview | 480 | 960 | 148 | 30.83% | [26.87%, 35.10%] | 33.75% | 0 | 11 | 0 | 240/240/240/240 |
| minimaxm31flash | 480 | 960 | 11 | 2.29% | [1.28%, 4.06%] | 2.08% | 0 | 11 | 0 | 240/240/240/240 |

> 复制队里同一模型占两个座位，因此「座位次数」是「参与局」的两倍；胜率按去重后的参与局计算。

## 个人边际贡献 β（主口径）

| 名次 | 模型 | β | e^β | 近似 SE | 近似 z |
|---:|---|---:|---:|---:|---:|
| 1 | deepseekv41flash | 0.8361 | 2.3073 | 0.9144 | 0.914 |
| 2 | glm53 | 0.5065 | 1.6595 | 0.9142 | 0.554 |
| 3 | mimov26pro | 0.4927 | 1.6368 | 0.9142 | 0.539 |
| 4 | minimaxm3 | 0.4553 | 1.5767 | 0.9142 | 0.498 |
| 5 | deepseekv4pro | 0.3757 | 1.4561 | 0.9142 | 0.411 |
| 6 | glm53flash | 0.3254 | 1.3846 | 0.9142 | 0.356 |
| 7 | kimi28preview | 0.076 | 1.079 | 0.9143 | 0.083 |
| 8 | kimi31pro | 0.0748 | 1.0777 | 0.9142 | 0.082 |
| 9 | hy3 | -0.1287 | 0.8792 | 0.9143 | -0.141 |
| 10 | hy4 | -0.1835 | 0.8323 | 0.9143 | -0.201 |
| 11 | step5preview | -0.7307 | 0.4816 | 0.9151 | -0.798 |
| 12 | minimaxm31flash | -2.0996 | 0.1225 | 0.9241 | -2.272 |

拟合样本 2880 局，前位截距 γ = 0.2164（正值表示前位队有优势），L2 正则 λ = 0.1，收敛 成功。

## 账目守恒

| 项目 | 值 |
|---|---|
| 计划总局数 | 2880 |
| 实际完成局数 | 2880 |
| 每队总局数 | 480 |
| 每个模型参与局数（去重） | 480 |
| 每个模型座位次数 | 960 |
| 重赛 / 异常重试 / 前瞻回退轮次 | 0 / 0 / 0 |
| 前位队胜率 | 53.72%（1547/2880） |
| 座位配平 | 通过（每个模型在 4 个座位出现次数相同） |
| 冠亚 95% CI | [68.99%, 76.90%] / [57.45%, 66.11%] |
| 耗时 | 891.2s |

## 各届逐轮明细

### 第 1 届 · 种子 lab-2v2-2026-11-06:clone:all:s1

- 第 1 轮 · 配对顺序 KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - KIMI 2.8preview 复制队 5:3 KIMI 3.1pro 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
  - deepseek v4pro 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3flash 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 2 轮 · 配对顺序 GLM5.3 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → step5preview 复制队 → GLM5.3flash 复制队
  - GLM5.3 复制队 4:4 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 5:3 KIMI 2.8preview 复制队
  - hy4 复制队 2:6 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 4:4 KIMI 3.1pro 复制队
  - MiniMax M3.1flash 复制队 0:8 hy3 复制队
  - step5preview 复制队 1:7 GLM5.3flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3 复制队
  - MiniMax M3 复制队 3:5 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 6:2 hy4 复制队
  - KIMI 2.8preview 复制队 4:4 hy3 复制队
  - GLM5.3flash 复制队 2:6 KIMI 3.1pro 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4.1flash 复制队
  - deepseek v4pro 复制队 4:4 GLM5.3 复制队
  - MiniMax M3 复制队 6:2 KIMI 2.8preview 复制队
  - hy3 复制队 3:5 KIMI 3.1pro 复制队
  - hy4 复制队 7:1 step5preview 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 1:7 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 3:5 GLM5.3flash 复制队
  - deepseek v4pro 复制队 8:0 step5preview 复制队
  - hy4 复制队 5:3 hy3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 2 届 · 种子 lab-2v2-2026-11-06:clone:all:s2

- 第 1 轮 · 配对顺序 hy3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队
  - hy3 复制队 0:8 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 2:6 MIMO-v2.6-pro 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 7:1 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3 复制队 → hy4 复制队 → hy3 复制队
  - MIMO-v2.6-pro 复制队 6:2 deepseek v4pro 复制队
  - GLM5.3flash 复制队 5:3 KIMI 3.1pro 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 2.8preview 复制队
  - step5preview 复制队 0:8 MiniMax M3 复制队
  - hy4 复制队 5:3 hy3 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → step5preview 复制队
  - GLM5.3flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 6:2 hy4 复制队
  - GLM5.3 复制队 4:4 MiniMax M3 复制队
  - deepseek v4pro 复制队 5:3 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 4:4 hy3 复制队
  - MiniMax M3.1flash 复制队 1:7 step5preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → hy4 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 8:0 GLM5.3flash 复制队
  - deepseek v4pro 复制队 4:4 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 7:1 KIMI 2.8preview 复制队
  - GLM5.3 复制队 7:1 hy4 复制队
  - step5preview 复制队 2:6 KIMI 3.1pro 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 3:5 deepseek v4pro 复制队
  - GLM5.3 复制队 5:3 KIMI 3.1pro 复制队
  - MiniMax M3 复制队 6:2 KIMI 2.8preview 复制队
  - hy3 复制队 7:1 step5preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 3 届 · 种子 lab-2v2-2026-11-06:clone:all:s3

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队
  - MiniMax M3 复制队 1:7 deepseek v4.1flash 复制队
  - hy4 复制队 7:1 hy3 复制队
  - deepseek v4pro 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 4:4 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 5:3 GLM5.3 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 6:2 hy4 复制队
  - MIMO-v2.6-pro 复制队 5:3 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 4:4 hy3 复制队
  - step5preview 复制队 0:8 MiniMax M3 复制队
  - GLM5.3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 6:2 hy4 复制队
  - KIMI 3.1pro 复制队 2:6 GLM5.3 复制队
  - deepseek v4pro 复制队 4:4 MiniMax M3 复制队
  - KIMI 2.8preview 复制队 4:4 hy3 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → step5preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 1:7 GLM5.3 复制队
  - deepseek v4pro 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 hy4 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 4:4 deepseek v4pro 复制队
  - MiniMax M3 复制队 6:2 GLM5.3flash 复制队
  - hy4 复制队 3:5 KIMI 2.8preview 复制队
  - hy3 复制队 3:5 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

### 第 4 届 · 种子 lab-2v2-2026-11-06:clone:all:s4

- 第 1 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → hy3 复制队 → GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 1:7 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 2:6 GLM5.3flash 复制队
  - step5preview 复制队 2:6 hy4 复制队
  - KIMI 3.1pro 复制队 3:5 MiniMax M3 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
- 第 2 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - hy4 复制队 1:7 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 8:0 GLM5.3 复制队
  - GLM5.3flash 复制队 4:4 MIMO-v2.6-pro 复制队
  - hy3 复制队 2:6 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 4:4 KIMI 3.1pro 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - GLM5.3flash 复制队 7:1 hy4 复制队
  - KIMI 2.8preview 复制队 5:3 GLM5.3 复制队
  - deepseek v4pro 复制队 3:5 hy3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → hy4 复制队 → step5preview 复制队 → hy3 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 4:4 MiniMax M3 复制队
  - KIMI 2.8preview 复制队 3:5 KIMI 3.1pro 复制队
  - GLM5.3 复制队 8:0 hy4 复制队
  - step5preview 复制队 3:5 hy3 复制队
  - deepseek v4pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 3:5 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3 复制队
  - hy3 复制队 1:7 hy4 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 6:2 step5preview 复制队

### 第 5 届 · 种子 lab-2v2-2026-11-06:clone:all:s5

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 5:3 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 4:4 KIMI 3.1pro 复制队
  - step5preview 复制队 2:6 GLM5.3flash 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - hy4 复制队 3:5 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → deepseek v4pro 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 3:5 GLM5.3flash 复制队
  - GLM5.3 复制队 5:3 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 4:4 hy3 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 3:5 deepseek v4pro 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - GLM5.3flash 复制队 4:4 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 4:4 step5preview 复制队
  - deepseek v4pro 复制队 6:2 KIMI 3.1pro 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → step5preview 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - deepseek v4pro 复制队 2:6 GLM5.3 复制队
  - step5preview 复制队 1:7 MiniMax M3 复制队
  - KIMI 2.8preview 复制队 1:7 MIMO-v2.6-pro 复制队
  - hy4 复制队 3:5 KIMI 3.1pro 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MiniMax M3 复制队
  - GLM5.3 复制队 3:5 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 KIMI 3.1pro 复制队
  - deepseek v4pro 复制队 5:3 hy3 复制队
  - step5preview 复制队 1:7 hy4 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 6 届 · 种子 lab-2v2-2026-11-06:clone:all:s6

- 第 1 轮 · 配对顺序 step5preview 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 2:6 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 4:4 deepseek v4pro 复制队
  - hy4 复制队 2:6 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 deepseek v4.1flash 复制队
  - hy3 复制队 1:7 KIMI 3.1pro 复制队
- 第 2 轮 · 配对顺序 GLM5.3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - GLM5.3 复制队 5:3 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 1:7 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 3:5 KIMI 2.8preview 复制队
  - hy4 复制队 6:2 hy3 复制队
  - MiniMax M3.1flash 复制队 1:7 step5preview 复制队
- 第 3 轮 · 配对顺序 GLM5.3 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 2:6 deepseek v4.1flash 复制队
  - MIMO-v2.6-pro 复制队 4:4 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 8:0 hy4 复制队
  - GLM5.3flash 复制队 5:3 MiniMax M3 复制队
  - step5preview 复制队 0:8 deepseek v4pro 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → hy3 复制队 → hy4 复制队 → MiniMax M3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 3:5 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - deepseek v4pro 复制队 7:1 hy3 复制队
  - KIMI 2.8preview 复制队 7:1 hy4 复制队
  - MiniMax M3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 8:0 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - MiniMax M3 复制队 7:1 KIMI 3.1pro 复制队
  - step5preview 复制队 2:6 hy3 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 7 届 · 种子 lab-2v2-2026-11-06:clone:all:s7

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队
  - deepseek v4.1flash 复制队 6:2 hy3 复制队
  - MiniMax M3 复制队 6:2 hy4 复制队
  - deepseek v4pro 复制队 5:3 KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 2.8preview 复制队 2:6 GLM5.3 复制队
- 第 2 轮 · 配对顺序 GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3flash 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3 复制队
  - MiniMax M3 复制队 3:5 deepseek v4pro 复制队
  - hy4 复制队 4:4 KIMI 3.1pro 复制队
  - step5preview 复制队 3:5 KIMI 2.8preview 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4pro 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → hy3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 2:6 GLM5.3flash 复制队
  - GLM5.3 复制队 5:3 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 6:2 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 6:2 hy3 复制队
  - hy4 复制队 6:2 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 GLM5.3 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 5:3 deepseek v4pro 复制队
  - MiniMax M3 复制队 8:0 KIMI 3.1pro 复制队
  - hy4 复制队 1:7 MIMO-v2.6-pro 复制队
  - hy3 复制队 5:3 KIMI 2.8preview 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → deepseek v4pro 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - GLM5.3 复制队 4:4 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 5:3 hy3 复制队
  - deepseek v4pro 复制队 6:2 hy4 复制队
  - KIMI 3.1pro 复制队 6:2 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 8 届 · 种子 lab-2v2-2026-11-06:clone:all:s8

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队
  - MiniMax M3 复制队 7:1 hy4 复制队
  - KIMI 3.1pro 复制队 2:6 GLM5.3flash 复制队
  - hy3 复制队 6:2 MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 4:4 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 6:2 step5preview 复制队
- 第 2 轮 · 配对顺序 hy3 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
  - GLM5.3flash 复制队 1:7 GLM5.3 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4.1flash 复制队
  - deepseek v4pro 复制队 7:1 KIMI 3.1pro 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
  - hy4 复制队 1:7 MIMO-v2.6-pro 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - MiniMax M3 复制队 3:5 GLM5.3 复制队
  - deepseek v4pro 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 4:4 MIMO-v2.6-pro 复制队
  - hy3 复制队 5:3 KIMI 3.1pro 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 4 轮 · 配对顺序 GLM5.3 复制队 → deepseek v4.1flash 复制队 → hy3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队
  - GLM5.3 复制队 2:6 deepseek v4.1flash 复制队
  - hy3 复制队 1:7 deepseek v4pro 复制队
  - MiniMax M3 复制队 3:5 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 KIMI 2.8preview 复制队
  - hy4 复制队 6:2 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 3.1pro 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → hy3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - deepseek v4pro 复制队 5:3 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - MiniMax M3 复制队 7:1 KIMI 2.8preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 1:7 KIMI 3.1pro 复制队

### 第 9 届 · 种子 lab-2v2-2026-11-06:clone:all:s9

- 第 1 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → hy3 复制队
  - hy4 复制队 1:7 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 3:5 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 4:4 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - GLM5.3 复制队 6:2 hy3 复制队
- 第 2 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → deepseek v4pro 复制队
  - MiniMax M3 复制队 1:7 deepseek v4.1flash 复制队
  - GLM5.3 复制队 4:4 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 3:5 hy3 复制队
  - step5preview 复制队 1:7 deepseek v4pro 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - GLM5.3flash 复制队 0:8 deepseek v4.1flash 复制队
  - GLM5.3 复制队 6:2 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 4:4 MiniMax M3 复制队
  - deepseek v4pro 复制队 7:1 hy3 复制队
  - KIMI 3.1pro 复制队 6:2 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 6:2 deepseek v4pro 复制队
  - GLM5.3flash 复制队 3:5 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 4:4 hy3 复制队
  - KIMI 2.8preview 复制队 7:1 hy4 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 5:3 MiniMax M3 复制队
  - KIMI 2.8preview 复制队 3:5 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 7:1 hy4 复制队
  - GLM5.3flash 复制队 8:0 step5preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队

### 第 10 届 · 种子 lab-2v2-2026-11-06:clone:all:s10

- 第 1 轮 · 配对顺序 MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - hy4 复制队 1:7 deepseek v4pro 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
  - KIMI 3.1pro 复制队 1:7 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 3:5 MIMO-v2.6-pro 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 3:5 GLM5.3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 5:3 KIMI 3.1pro 复制队
  - hy4 复制队 6:2 step5preview 复制队
- 第 3 轮 · 配对顺序 GLM5.3 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 5:3 hy4 复制队
  - deepseek v4pro 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 3:5 KIMI 3.1pro 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - GLM5.3flash 复制队 2:6 deepseek v4pro 复制队
  - KIMI 2.8preview 复制队 6:2 step5preview 复制队
  - KIMI 3.1pro 复制队 4:4 hy4 复制队
  - hy3 复制队 4:4 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 2:6 GLM5.3 复制队
  - GLM5.3flash 复制队 4:4 MiniMax M3 复制队
  - hy4 复制队 1:7 MIMO-v2.6-pro 复制队
  - KIMI 3.1pro 复制队 6:2 step5preview 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队

### 第 11 届 · 种子 lab-2v2-2026-11-06:clone:all:s11

- 第 1 轮 · 配对顺序 KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy4 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → MiniMax M3 复制队
  - KIMI 3.1pro 复制队 2:6 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 6:2 GLM5.3 复制队
  - hy4 复制队 2:6 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 5:3 deepseek v4pro 复制队
  - hy3 复制队 7:1 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → hy4 复制队
  - GLM5.3flash 复制队 2:6 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 7:1 hy3 复制队
  - MIMO-v2.6-pro 复制队 2:6 deepseek v4.1flash 复制队
  - step5preview 复制队 2:6 deepseek v4pro 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 3.1pro 复制队
  - GLM5.3 复制队 4:4 hy4 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 1:7 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 3:5 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 2:6 deepseek v4pro 复制队
  - hy3 复制队 3:5 KIMI 3.1pro 复制队
  - GLM5.3 复制队 8:0 step5preview 复制队
  - hy4 复制队 7:1 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → hy4 复制队 → GLM5.3flash 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 KIMI 3.1pro 复制队
  - deepseek v4pro 复制队 4:4 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 6:2 hy4 复制队
  - KIMI 2.8preview 复制队 1:7 GLM5.3 复制队
  - GLM5.3flash 复制队 7:1 hy3 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 3:5 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 6:2 deepseek v4pro 复制队
  - MiniMax M3 复制队 6:2 KIMI 2.8preview 复制队
  - GLM5.3flash 复制队 4:4 KIMI 3.1pro 复制队
  - hy4 复制队 7:1 step5preview 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队

### 第 12 届 · 种子 lab-2v2-2026-11-06:clone:all:s12

- 第 1 轮 · 配对顺序 GLM5.3flash 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3 复制队
  - GLM5.3flash 复制队 7:1 step5preview 复制队
  - deepseek v4pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3 复制队
  - KIMI 2.8preview 复制队 3:5 KIMI 3.1pro 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy4 复制队
  - hy3 复制队 2:6 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → GLM5.3 复制队
  - MiniMax M3 复制队 5:3 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 5:3 deepseek v4.1flash 复制队
  - KIMI 3.1pro 复制队 1:7 GLM5.3flash 复制队
  - hy4 复制队 2:6 KIMI 2.8preview 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → hy3 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 3:5 KIMI 2.8preview 复制队
  - GLM5.3 复制队 6:2 deepseek v4pro 复制队
  - step5preview 复制队 0:8 deepseek v4.1flash 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 2:6 hy3 复制队
- 第 4 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - MIMO-v2.6-pro 复制队 6:2 MiniMax M3 复制队
  - GLM5.3flash 复制队 1:7 deepseek v4.1flash 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3 复制队
  - KIMI 2.8preview 复制队 3:5 deepseek v4pro 复制队
  - hy3 复制队 7:1 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 5 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → hy3 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - MIMO-v2.6-pro 复制队 6:2 KIMI 3.1pro 复制队
  - deepseek v4.1flash 复制队 1:7 MiniMax M3 复制队
  - GLM5.3 复制队 6:2 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 6:2 hy3 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
  - step5preview 复制队 2:6 hy4 复制队

## 逐局明细与复现

完整逐局记录（每局种子、4 个座位及其模型、前位队、引擎获胜队伍、回合数、终局权威）见 `star-realms-2v2-clone-all.json` 的 `seasons[].rounds[].pairs[].games`。

```bash
node src/team-lab-cli.js --experiment clone --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-all
```
