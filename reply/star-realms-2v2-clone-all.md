# 星域奇航 · 2V2 实验室 · 实验 A 同模型复制队（全扩）

> 运行 ID `clone-all-12x5-1793975745418` · 主种子 `lab-2v2-2026-11-06` · 生成于 2026-11-06T14:49:12.406Z

## 结论

**2V2 能力第一：deepseek v4.1flash**（deepseek v4.1flash 复制队，队友是该脚本自身的副本）。局胜率 **79.79%**（383/480），Wilson 95% CI [75.97%, 83.14%]；12 届中夺冠 **11** 次，平均名次 1.08，累计场分 57。

亚军 deepseek v4pro 60.21%，差 19.58pp，两比例近似 z = 6.776，**达到 95% 显著**。

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
| 1 | deepseek v4.1flash | 11 | 1.08 | 79.79% | 383/480 | 57 | 84.58% / 75.00% | 14.13 |
| 2 | deepseek v4pro | 0 | 3.83 | 60.21% | 289/480 | 40 | 67.92% / 52.50% | 14.29 |
| 3 | GLM5.3 | 0 | 4.25 | 60.21% | 289/480 | 37.5 | 63.75% / 56.67% | 13.88 |
| 4 | MiniMax M3 | 1 | 3.33 | 60.00% | 288/480 | 39.5 | 65.83% / 54.17% | 13.63 |
| 5 | MIMO-v2.6-pro | 0 | 4.42 | 57.92% | 278/480 | 36.5 | 65.42% / 50.42% | 14.42 |
| 6 | KIMI 3.1pro | 0 | 7 | 54.37% | 261/480 | 27 | 62.08% / 46.67% | 10.88 |
| 7 | KIMI 2.8preview | 0 | 6.83 | 53.33% | 256/480 | 30.5 | 62.08% / 44.58% | 10.92 |
| 8 | GLM5.3flash | 0 | 7 | 52.29% | 251/480 | 30 | 60.42% / 44.17% | 13 |
| 9 | hy3 | 0 | 8.83 | 46.67% | 224/480 | 24.5 | 50.83% / 42.50% | 11.29 |
| 10 | hy4 | 0 | 8.67 | 44.58% | 214/480 | 24.5 | 47.50% / 41.67% | 11.5 |
| 11 | step5preview | 0 | 10.75 | 29.17% | 140/480 | 13 | 31.25% / 27.08% | 10.79 |
| 12 | MiniMax M3.1flash | 0 | 12 | 1.46% | 7/480 | 0 | 1.67% / 1.25% | 11.29 |

## 各届冠军

第 1 届：deepseek v4.1flash（MP 5，局胜 33）；第 2 届：deepseek v4.1flash（MP 5，局胜 32）；第 3 届：deepseek v4.1flash（MP 5，局胜 31）；第 4 届：deepseek v4.1flash（MP 5，局胜 31）；第 5 届：deepseek v4.1flash（MP 4.5，局胜 34）；第 6 届：deepseek v4.1flash（MP 4.5，局胜 31）；第 7 届：MiniMax M3（MP 4.5，局胜 25）；第 8 届：deepseek v4.1flash（MP 5，局胜 30）；第 9 届：deepseek v4.1flash（MP 5，局胜 33）；第 10 届：deepseek v4.1flash（MP 4.5，局胜 33）；第 11 届：deepseek v4.1flash（MP 4.5，局胜 28）；第 12 届：deepseek v4.1flash（MP 5，局胜 34）。

## 个人在场统计

| 模型 | 参与局（去重） | 座位次数 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 搭档数 | 对手数 | 所在队伍夺冠 | 座位分布 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| deepseekv41flash | 480 | 960 | 383 | 79.79% | [75.97%, 83.14%] | 84.58% | 0 | 11 | 11 | 240/240/240/240 |
| deepseekv4pro | 480 | 960 | 289 | 60.21% | [55.77%, 64.49%] | 67.92% | 0 | 11 | 0 | 240/240/240/240 |
| glm53 | 480 | 960 | 289 | 60.21% | [55.77%, 64.49%] | 63.75% | 0 | 11 | 0 | 240/240/240/240 |
| minimaxm3 | 480 | 960 | 288 | 60.00% | [55.55%, 64.29%] | 65.83% | 0 | 11 | 1 | 240/240/240/240 |
| mimov26pro | 480 | 960 | 278 | 57.92% | [53.45%, 62.25%] | 65.42% | 0 | 11 | 0 | 240/240/240/240 |
| kimi31pro | 480 | 960 | 261 | 54.37% | [49.90%, 58.78%] | 62.08% | 0 | 11 | 0 | 240/240/240/240 |
| kimi28preview | 480 | 960 | 256 | 53.33% | [48.86%, 57.75%] | 62.08% | 0 | 11 | 0 | 240/240/240/240 |
| glm53flash | 480 | 960 | 251 | 52.29% | [47.82%, 56.72%] | 60.42% | 0 | 11 | 0 | 240/240/240/240 |
| hy3 | 480 | 960 | 224 | 46.67% | [42.25%, 51.14%] | 50.83% | 0 | 11 | 0 | 240/240/240/240 |
| hy4 | 480 | 960 | 214 | 44.58% | [40.20%, 49.06%] | 47.50% | 0 | 11 | 0 | 240/240/240/240 |
| step5preview | 480 | 960 | 140 | 29.17% | [25.28%, 33.39%] | 31.25% | 0 | 11 | 0 | 240/240/240/240 |
| minimaxm31flash | 480 | 960 | 7 | 1.46% | [0.71%, 2.98%] | 1.67% | 0 | 11 | 0 | 240/240/240/240 |

> 复制队里同一模型占两个座位，因此「座位次数」是「参与局」的两倍；胜率按去重后的参与局计算。

## 个人边际贡献 β（主口径）

| 名次 | 模型 | β | e^β | 近似 SE | 近似 z |
|---:|---|---:|---:|---:|---:|
| 1 | deepseekv41flash | 1.055 | 2.8721 | 0.9148 | 1.153 |
| 2 | deepseekv4pro | 0.5183 | 1.6792 | 0.9143 | 0.567 |
| 3 | glm53 | 0.5145 | 1.6728 | 0.9144 | 0.563 |
| 4 | minimaxm3 | 0.4778 | 1.6126 | 0.9143 | 0.523 |
| 5 | mimov26pro | 0.4674 | 1.5958 | 0.9143 | 0.511 |
| 6 | glm53flash | 0.2436 | 1.2758 | 0.9143 | 0.266 |
| 7 | kimi31pro | 0.0582 | 1.0599 | 0.9144 | 0.064 |
| 8 | kimi28preview | 0.0392 | 1.0399 | 0.9143 | 0.043 |
| 9 | hy3 | -0.0875 | 0.9162 | 0.9143 | -0.096 |
| 10 | hy4 | -0.1574 | 0.8544 | 0.9145 | -0.172 |
| 11 | step5preview | -0.784 | 0.4566 | 0.9153 | -0.857 |
| 12 | minimaxm31flash | -2.3451 | 0.0958 | 0.93 | -2.522 |

拟合样本 2880 局，前位截距 γ = 0.3255（正值表示前位队有优势），L2 正则 λ = 0.1，收敛 成功。

## 账目守恒

| 项目 | 值 |
|---|---|
| 计划总局数 | 2880 |
| 实际完成局数 | 2880 |
| 每队总局数 | 480 |
| 每个模型参与局数（去重） | 480 |
| 每个模型座位次数 | 960 |
| 重赛 / 异常重试 / 前瞻回退轮次 | 0 / 0 / 0 |
| 前位队胜率 | 55.28%（1592/2880） |
| 座位配平 | 通过（每个模型在 4 个座位出现次数相同） |
| 冠亚 95% CI | [75.97%, 83.14%] / [55.77%, 64.49%] |
| 耗时 | 807.0s |

## 各届逐轮明细

### 第 1 届 · 种子 lab-2v2-2026-11-06:clone:all:s1

- 第 1 轮 · 配对顺序 KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - KIMI 2.8preview 复制队 2:6 KIMI 3.1pro 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
  - deepseek v4pro 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3flash 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 2 轮 · 配对顺序 GLM5.3 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → step5preview 复制队 → GLM5.3flash 复制队
  - GLM5.3 复制队 5:3 KIMI 3.1pro 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - hy4 复制队 1:7 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 7:1 KIMI 2.8preview 复制队
  - MiniMax M3.1flash 复制队 0:8 hy3 复制队
  - step5preview 复制队 0:8 GLM5.3flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 2:6 MiniMax M3 复制队
  - deepseek v4pro 复制队 8:0 hy4 复制队
  - KIMI 3.1pro 复制队 4:4 hy3 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
  - step5preview 复制队 1:7 KIMI 2.8preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 deepseek v4pro 复制队
  - GLM5.3 复制队 7:1 MiniMax M3 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - hy3 复制队 3:5 hy4 复制队
  - KIMI 3.1pro 复制队 7:1 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 7:1 KIMI 3.1pro 复制队
  - GLM5.3 复制队 5:3 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 6:2 hy4 复制队
  - MiniMax M3 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 5:3 step5preview 复制队

### 第 2 届 · 种子 lab-2v2-2026-11-06:clone:all:s2

- 第 1 轮 · 配对顺序 hy3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队
  - hy3 复制队 2:6 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 4:4 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 1:7 MIMO-v2.6-pro 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 6:2 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → hy3 复制队
  - MIMO-v2.6-pro 复制队 5:3 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3 复制队 7:1 GLM5.3flash 复制队
  - MiniMax M3 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 4:4 KIMI 2.8preview 复制队
  - step5preview 复制队 2:6 hy3 复制队
- 第 3 轮 · 配对顺序 GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 3:5 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - deepseek v4pro 复制队 5:3 hy3 复制队
  - KIMI 3.1pro 复制队 5:3 KIMI 2.8preview 复制队
  - hy4 复制队 3:5 GLM5.3flash 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 2:6 GLM5.3 复制队
  - KIMI 3.1pro 复制队 1:7 MiniMax M3 复制队
  - GLM5.3flash 复制队 5:3 hy3 复制队
  - step5preview 复制队 2:6 KIMI 2.8preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → step5preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 8:0 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 3:5 MiniMax M3 复制队
  - GLM5.3flash 复制队 3:5 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 7:1 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 4:4 hy3 复制队

### 第 3 届 · 种子 lab-2v2-2026-11-06:clone:all:s3

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队
  - MiniMax M3 复制队 1:7 deepseek v4.1flash 复制队
  - hy4 复制队 4:4 hy3 复制队
  - deepseek v4pro 复制队 7:1 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 3:5 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 5:3 GLM5.3 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy4 复制队
  - hy3 复制队 2:6 MiniMax M3 复制队
  - step5preview 复制队 2:6 KIMI 3.1pro 复制队
  - GLM5.3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 7:1 KIMI 3.1pro 复制队
  - GLM5.3 复制队 7:1 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 2:6 MiniMax M3 复制队
  - hy4 复制队 6:2 step5preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 2:6 MiniMax M3 复制队
  - GLM5.3 复制队 7:1 hy4 复制队
  - hy3 复制队 4:4 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 2.8preview 复制队 6:2 step5preview 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - MiniMax M3 复制队 4:4 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 4:4 hy3 复制队
  - KIMI 3.1pro 复制队 5:3 GLM5.3flash 复制队
  - hy4 复制队 1:7 deepseek v4pro 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队

### 第 4 届 · 种子 lab-2v2-2026-11-06:clone:all:s4

- 第 1 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → hy3 复制队 → GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 2:6 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 5:3 GLM5.3flash 复制队
  - step5preview 复制队 0:8 hy4 复制队
  - KIMI 3.1pro 复制队 1:7 MiniMax M3 复制队
  - hy3 复制队 1:7 GLM5.3 复制队
- 第 2 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - hy4 复制队 2:6 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 8:0 KIMI 2.8preview 复制队
  - GLM5.3 复制队 4:4 MIMO-v2.6-pro 复制队
  - hy3 复制队 2:6 deepseek v4pro 复制队
  - GLM5.3flash 复制队 4:4 KIMI 3.1pro 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - GLM5.3 复制队 6:2 hy4 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4pro 复制队
  - GLM5.3flash 复制队 6:2 hy3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 4:4 MiniMax M3 复制队
  - deepseek v4pro 复制队 7:1 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 6:2 hy4 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 4:4 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 3:5 GLM5.3 复制队
  - KIMI 2.8preview 复制队 4:4 hy3 复制队
  - GLM5.3flash 复制队 8:0 step5preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 5 届 · 种子 lab-2v2-2026-11-06:clone:all:s5

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 4:4 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 4:4 hy3 复制队
  - MiniMax M3 复制队 5:3 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 GLM5.3flash 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - hy4 复制队 6:2 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 GLM5.3flash 复制队 → hy4 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → hy3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队
  - GLM5.3flash 复制队 6:2 hy4 复制队
  - MiniMax M3 复制队 3:5 GLM5.3 复制队
  - hy3 复制队 2:6 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 1:7 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 6:2 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 3.1pro 复制队
- 第 3 轮 · 配对顺序 GLM5.3 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 5:3 GLM5.3flash 复制队
  - deepseek v4pro 复制队 6:2 KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 8:0 hy4 复制队
  - MiniMax M3 复制队 2:6 MIMO-v2.6-pro 复制队
  - KIMI 3.1pro 复制队 4:4 hy3 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 3:5 deepseek v4pro 复制队
  - deepseek v4.1flash 复制队 8:0 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 3:5 MIMO-v2.6-pro 复制队
  - hy3 复制队 4:4 KIMI 2.8preview 复制队
  - hy4 复制队 7:1 step5preview 复制队
  - MiniMax M3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - GLM5.3flash 复制队 3:5 MiniMax M3 复制队
  - hy4 复制队 5:3 hy3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 3.1pro 复制队 8:0 step5preview 复制队

### 第 6 届 · 种子 lab-2v2-2026-11-06:clone:all:s6

- 第 1 轮 · 配对顺序 step5preview 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 6:2 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 4:4 deepseek v4pro 复制队
  - hy4 复制队 1:7 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 deepseek v4.1flash 复制队
  - hy3 复制队 2:6 KIMI 3.1pro 复制队
- 第 2 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - KIMI 3.1pro 复制队 3:5 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 5:3 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 6:2 hy4 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 3:5 GLM5.3 复制队
  - MiniMax M3 复制队 8:0 step5preview 复制队
  - MIMO-v2.6-pro 复制队 6:2 hy4 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 deepseek v4pro 复制队
  - KIMI 2.8preview 复制队 4:4 GLM5.3 复制队
  - MiniMax M3 复制队 5:3 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - hy3 复制队 3:5 hy4 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - deepseek v4pro 复制队 5:3 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 5:3 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 5:3 KIMI 3.1pro 复制队
  - step5preview 复制队 3:5 hy3 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 7 届 · 种子 lab-2v2-2026-11-06:clone:all:s7

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队
  - deepseek v4.1flash 复制队 8:0 hy3 复制队
  - MiniMax M3 复制队 4:4 hy4 复制队
  - deepseek v4pro 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 2.8preview 复制队 2:6 GLM5.3 复制队
- 第 2 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - MIMO-v2.6-pro 复制队 4:4 deepseek v4pro 复制队
  - GLM5.3 复制队 2:6 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 3:5 MiniMax M3 复制队
  - hy4 复制队 5:3 KIMI 2.8preview 复制队
  - step5preview 复制队 2:6 hy3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 8:0 hy4 复制队
  - deepseek v4pro 复制队 2:6 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy3 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3flash 复制队
  - GLM5.3 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 3:5 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 4:4 GLM5.3 复制队
  - KIMI 3.1pro 复制队 4:4 hy4 复制队
  - GLM5.3flash 复制队 4:4 deepseek v4pro 复制队
  - hy3 复制队 4:4 KIMI 2.8preview 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
- 第 5 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 5:3 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 8:0 GLM5.3flash 复制队
  - GLM5.3 复制队 5:3 KIMI 3.1pro 复制队
  - deepseek v4pro 复制队 8:0 hy4 复制队
  - KIMI 2.8preview 复制队 8:0 step5preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队

### 第 8 届 · 种子 lab-2v2-2026-11-06:clone:all:s8

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队
  - MiniMax M3 复制队 7:1 hy4 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3flash 复制队
  - hy3 复制队 4:4 MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 2:6 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 3:5 step5preview 复制队
- 第 2 轮 · 配对顺序 step5preview 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队
  - step5preview 复制队 0:8 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 1:7 GLM5.3 复制队
  - hy3 复制队 5:3 KIMI 3.1pro 复制队
  - MIMO-v2.6-pro 复制队 4:4 GLM5.3flash 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4pro 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → hy3 复制队 → GLM5.3flash 复制队 → hy4 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3 复制队
  - hy3 复制队 3:5 GLM5.3flash 复制队
  - hy4 复制队 7:1 step5preview 复制队
  - MIMO-v2.6-pro 复制队 6:2 deepseek v4pro 复制队
  - MiniMax M3 复制队 5:3 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - hy4 复制队 0:8 GLM5.3 复制队
  - GLM5.3flash 复制队 2:6 MiniMax M3 复制队
  - hy3 复制队 2:6 deepseek v4pro 复制队
  - KIMI 2.8preview 复制队 4:4 KIMI 3.1pro 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - GLM5.3 复制队 7:1 deepseek v4pro 复制队
  - hy4 复制队 2:6 GLM5.3flash 复制队
  - step5preview 复制队 1:7 MIMO-v2.6-pro 复制队
  - hy3 复制队 3:5 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

### 第 9 届 · 种子 lab-2v2-2026-11-06:clone:all:s9

- 第 1 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → hy3 复制队
  - hy4 复制队 2:6 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 3:5 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 6:2 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 7:1 step5preview 复制队
  - GLM5.3 复制队 6:2 hy3 复制队
- 第 2 轮 · 配对顺序 KIMI 3.1pro 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3 复制队
  - deepseek v4.1flash 复制队 7:1 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 4:4 GLM5.3flash 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
  - hy4 复制队 4:4 hy3 复制队
  - deepseek v4pro 复制队 8:0 KIMI 2.8preview 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3 复制队 → hy3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 6:2 KIMI 3.1pro 复制队
  - GLM5.3flash 复制队 5:3 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 4:4 deepseek v4pro 复制队
  - step5preview 复制队 0:8 MiniMax M3 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 2:6 KIMI 2.8preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3flash 复制队
  - MiniMax M3 复制队 5:3 MIMO-v2.6-pro 复制队
  - hy3 复制队 2:6 deepseek v4pro 复制队
  - GLM5.3 复制队 6:2 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 7:1 step5preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3 复制队
  - MiniMax M3 复制队 4:4 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 3:5 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 8:0 hy4 复制队
  - hy3 复制队 6:2 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 10 届 · 种子 lab-2v2-2026-11-06:clone:all:s10

- 第 1 轮 · 配对顺序 MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - hy4 复制队 2:6 deepseek v4pro 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
  - KIMI 3.1pro 复制队 0:8 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 3:5 MIMO-v2.6-pro 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 4:4 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 3:5 GLM5.3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 5:3 KIMI 3.1pro 复制队
  - hy4 复制队 6:2 step5preview 复制队
- 第 3 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - MIMO-v2.6-pro 复制队 5:3 GLM5.3 复制队
  - deepseek v4pro 复制队 6:2 KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 8:0 hy4 复制队
  - GLM5.3flash 复制队 2:6 MiniMax M3 复制队
  - hy3 复制队 7:1 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - MIMO-v2.6-pro 复制队 2:6 deepseek v4.1flash 复制队
  - deepseek v4pro 复制队 8:0 hy3 复制队
  - MiniMax M3 复制队 6:2 KIMI 3.1pro 复制队
  - GLM5.3 复制队 8:0 hy4 复制队
  - GLM5.3flash 复制队 3:5 KIMI 2.8preview 复制队
  - step5preview 复制队 5:3 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 6:2 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 2:6 hy3 复制队
  - KIMI 2.8preview 复制队 7:1 KIMI 3.1pro 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
  - GLM5.3flash 复制队 7:1 step5preview 复制队

### 第 11 届 · 种子 lab-2v2-2026-11-06:clone:all:s11

- 第 1 轮 · 配对顺序 KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy4 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → MiniMax M3 复制队
  - KIMI 3.1pro 复制队 1:7 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 4:4 GLM5.3 复制队
  - hy4 复制队 1:7 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 6:2 deepseek v4pro 复制队
  - hy3 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 KIMI 2.8preview 复制队 → MiniMax M3 复制队 → hy3 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队 → hy4 复制队
  - KIMI 2.8preview 复制队 4:4 MiniMax M3 复制队
  - hy3 复制队 1:7 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4pro 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 3.1pro 复制队 6:2 hy4 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 5:3 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 2:6 step5preview 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy4 复制队
  - GLM5.3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - deepseek v4.1flash 复制队 6:2 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 3:5 GLM5.3flash 复制队
  - step5preview 复制队 1:7 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 5:3 hy3 复制队
  - KIMI 3.1pro 复制队 3:5 deepseek v4pro 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 5:3 GLM5.3 复制队
  - step5preview 复制队 1:7 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 4:4 hy3 复制队

### 第 12 届 · 种子 lab-2v2-2026-11-06:clone:all:s12

- 第 1 轮 · 配对顺序 GLM5.3flash 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3 复制队
  - GLM5.3flash 复制队 5:3 step5preview 复制队
  - deepseek v4pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - KIMI 2.8preview 复制队 4:4 KIMI 3.1pro 复制队
  - MIMO-v2.6-pro 复制队 5:3 hy4 复制队
  - hy3 复制队 1:7 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → step5preview 复制队 → hy3 复制队
  - deepseek v4pro 复制队 6:2 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 7:1 MiniMax M3 复制队
  - GLM5.3flash 复制队 5:3 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
  - step5preview 复制队 3:5 hy3 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - GLM5.3flash 复制队 1:7 deepseek v4.1flash 复制队
  - deepseek v4pro 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 5:3 hy4 复制队
  - MIMO-v2.6-pro 复制队 6:2 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 2:6 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → hy4 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 5:3 MiniMax M3 复制队
  - GLM5.3flash 复制队 3:5 GLM5.3 复制队
  - KIMI 3.1pro 复制队 3:5 hy3 复制队
  - hy4 复制队 6:2 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy3 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 4:4 GLM5.3 复制队
  - hy3 复制队 1:7 GLM5.3flash 复制队
  - MiniMax M3 复制队 8:0 step5preview 复制队
  - hy4 复制队 6:2 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

## 逐局明细与复现

完整逐局记录（每局种子、4 个座位及其模型、前位队、引擎获胜队伍、回合数、终局权威）见 `star-realms-2v2-clone-all.json` 的 `seasons[].rounds[].pairs[].games`。

```bash
node src/team-lab-cli.js --experiment clone --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-all
```
