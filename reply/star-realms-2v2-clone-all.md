# 星域奇航 · 2V2 实验室 · 实验 A 同模型复制队（全扩）

> 运行 ID `refresh-20261109-clone-all` · 主种子 `lab-2v2-2026-11-06` · 生成于 2026-11-09T02:20:55.053Z

## 结论

**2V2 能力第一：deepseek v4.1flash**（deepseek v4.1flash 复制队，队友是该脚本自身的副本）。局胜率 **71.04%**（341/480），Wilson 95% CI [66.83%, 74.92%]；12 届中夺冠 **8** 次，平均名次 1.33，累计场分 52.5。

亚军 MIMO-v2.6-pro 63.12%，差 7.92pp，两比例近似 z = 2.62，**达到 95% 显著**。

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
| 1 | deepseek v4.1flash | 8 | 1.33 | 71.04% | 341/480 | 52.5 | 77.50% / 64.58% | 13.79 |
| 2 | MIMO-v2.6-pro | 1 | 3.83 | 63.12% | 303/480 | 39 | 71.67% / 54.58% | 13.17 |
| 3 | deepseek v4pro | 2 | 3.5 | 62.71% | 301/480 | 41 | 69.17% / 56.25% | 14.54 |
| 4 | GLM5.3 | 1 | 3.75 | 61.88% | 297/480 | 39.5 | 69.17% / 54.58% | 13 |
| 5 | MiniMax M3 | 0 | 4 | 59.58% | 286/480 | 39 | 64.58% / 54.58% | 14.42 |
| 6 | GLM5.3flash | 0 | 5.42 | 58.33% | 280/480 | 34 | 59.58% / 57.08% | 13.71 |
| 7 | KIMI 2.8preview | 0 | 7.25 | 53.13% | 255/480 | 28 | 55.83% / 50.42% | 11.83 |
| 8 | hy3 | 0 | 8.17 | 51.04% | 245/480 | 25.5 | 54.17% / 47.92% | 11.88 |
| 9 | KIMI 3.1pro | 0 | 8.83 | 48.75% | 234/480 | 25 | 50.83% / 46.67% | 10.88 |
| 10 | hy4 | 0 | 8.92 | 47.71% | 229/480 | 24.5 | 50.00% / 45.42% | 11.67 |
| 11 | step5preview | 0 | 11 | 19.17% | 92/480 | 12 | 20.42% / 17.92% | 10.25 |
| 12 | MiniMax M3.1flash | 0 | 12 | 3.54% | 17/480 | 0 | 4.58% / 2.50% | 10.88 |

## 各届冠军

第 1 届：deepseek v4.1flash（MP 4.5，局胜 29）；第 2 届：deepseek v4pro（MP 4，局胜 27）；第 3 届：deepseek v4pro（MP 4.5，局胜 31）；第 4 届：deepseek v4.1flash（MP 4.5，局胜 28）；第 5 届：deepseek v4.1flash（MP 4.5，局胜 30）；第 6 届：deepseek v4.1flash（MP 5，局胜 33）；第 7 届：deepseek v4.1flash（MP 5，局胜 30）；第 8 届：MIMO-v2.6-pro（MP 4，局胜 30）；第 9 届：deepseek v4.1flash（MP 4.5，局胜 29）；第 10 届：deepseek v4.1flash（MP 5，局胜 27）；第 11 届：deepseek v4.1flash（MP 4，局胜 26）；第 12 届：GLM5.3（MP 4.5，局胜 28）。

## 个人在场统计

| 模型 | 参与局（去重） | 座位次数 | 所在队伍胜局 | 队伍胜率 | Wilson 95% CI | 前位队胜率 | 搭档数 | 对手数 | 所在队伍夺冠 | 座位分布 |
|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---|
| deepseekv41flash | 480 | 960 | 341 | 71.04% | [66.83%, 74.92%] | 77.50% | 0 | 11 | 8 | 240/240/240/240 |
| mimov26pro | 480 | 960 | 303 | 63.12% | [58.72%, 67.32%] | 71.67% | 0 | 11 | 1 | 240/240/240/240 |
| deepseekv4pro | 480 | 960 | 301 | 62.71% | [58.30%, 66.92%] | 69.17% | 0 | 11 | 2 | 240/240/240/240 |
| glm53 | 480 | 960 | 297 | 61.88% | [57.45%, 66.11%] | 69.17% | 0 | 11 | 1 | 240/240/240/240 |
| minimaxm3 | 480 | 960 | 286 | 59.58% | [55.13%, 63.88%] | 64.58% | 0 | 11 | 0 | 240/240/240/240 |
| glm53flash | 480 | 960 | 280 | 58.33% | [53.87%, 62.66%] | 59.58% | 0 | 11 | 0 | 240/240/240/240 |
| kimi28preview | 480 | 960 | 255 | 53.13% | [48.65%, 57.55%] | 55.83% | 0 | 11 | 0 | 240/240/240/240 |
| hy3 | 480 | 960 | 245 | 51.04% | [46.58%, 55.49%] | 54.17% | 0 | 11 | 0 | 240/240/240/240 |
| kimi31pro | 480 | 960 | 234 | 48.75% | [44.31%, 53.21%] | 50.83% | 0 | 11 | 0 | 240/240/240/240 |
| hy4 | 480 | 960 | 229 | 47.71% | [43.28%, 52.18%] | 50.00% | 0 | 11 | 0 | 240/240/240/240 |
| step5preview | 480 | 960 | 92 | 19.17% | [15.90%, 22.93%] | 20.42% | 0 | 11 | 0 | 240/240/240/240 |
| minimaxm31flash | 480 | 960 | 17 | 3.54% | [2.22%, 5.60%] | 4.58% | 0 | 11 | 0 | 240/240/240/240 |

> 复制队里同一模型占两个座位，因此「座位次数」是「参与局」的两倍；胜率按去重后的参与局计算。

## 个人边际贡献 β（主口径）

| 名次 | 模型 | β | e^β | 近似 SE | 近似 z |
|---:|---|---:|---:|---:|---:|
| 1 | deepseekv41flash | 0.8877 | 2.4295 | 0.9146 | 0.971 |
| 2 | deepseekv4pro | 0.6724 | 1.9589 | 0.9144 | 0.735 |
| 3 | minimaxm3 | 0.6037 | 1.8289 | 0.9144 | 0.66 |
| 4 | mimov26pro | 0.5942 | 1.8116 | 0.9144 | 0.65 |
| 5 | glm53 | 0.5731 | 1.7737 | 0.9145 | 0.627 |
| 6 | glm53flash | 0.4915 | 1.6348 | 0.9144 | 0.537 |
| 7 | kimi28preview | 0.2147 | 1.2395 | 0.9145 | 0.235 |
| 8 | hy3 | 0.0836 | 1.0872 | 0.9146 | 0.091 |
| 9 | kimi31pro | -0.0434 | 0.9575 | 0.9147 | -0.047 |
| 10 | hy4 | -0.0563 | 0.9452 | 0.9147 | -0.062 |
| 11 | step5preview | -1.5818 | 0.2056 | 0.9209 | -1.718 |
| 12 | minimaxm31flash | -2.4394 | 0.0872 | 0.9261 | -2.634 |

拟合样本 2880 局，前位截距 γ = 0.2502（正值表示前位队有优势），L2 正则 λ = 0.1，收敛 成功。

## 账目守恒

| 项目 | 值 |
|---|---|
| 计划总局数 | 2880 |
| 实际完成局数 | 2880 |
| 每队总局数 | 480 |
| 每个模型参与局数（去重） | 480 |
| 每个模型座位次数 | 960 |
| 重赛 / 异常重试 / 前瞻回退轮次 | 0 / 0 / 0 |
| 前位队胜率 | 53.96%（1554/2880） |
| 座位配平 | 通过（每个模型在 4 个座位出现次数相同） |
| 冠亚 95% CI | [66.83%, 74.92%] / [58.72%, 67.32%] |
| 耗时 | 1063.8s |

## 各届逐轮明细

### 第 1 届 · 种子 lab-2v2-2026-11-06:clone:all:s1

- 第 1 轮 · 配对顺序 KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - KIMI 2.8preview 复制队 7:1 KIMI 3.1pro 复制队
  - hy3 复制队 2:6 MiniMax M3 复制队
  - deepseek v4pro 复制队 2:6 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 1:7 hy4 复制队
- 第 2 轮 · 配对顺序 GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → deepseek v4.1flash 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → step5preview 复制队 → GLM5.3flash 复制队
  - GLM5.3 复制队 5:3 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 7:1 KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 7:1 hy4 复制队
  - KIMI 3.1pro 复制队 0:8 deepseek v4pro 复制队
  - MiniMax M3.1flash 复制队 0:8 hy3 复制队
  - step5preview 复制队 0:8 GLM5.3flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 4:4 MiniMax M3 复制队
  - GLM5.3 复制队 4:4 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy4 复制队
  - deepseek v4pro 复制队 6:2 hy3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 3.1pro 复制队 8:0 step5preview 复制队
- 第 4 轮 · 配对顺序 GLM5.3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 3:5 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 4:4 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4pro 复制队
  - GLM5.3flash 复制队 8:0 hy4 复制队
  - KIMI 3.1pro 复制队 3:5 hy3 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 deepseek v4pro 复制队
  - MiniMax M3 复制队 6:2 GLM5.3flash 复制队
  - GLM5.3 复制队 4:4 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 4:4 hy3 复制队
  - step5preview 复制队 0:8 hy4 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

### 第 2 届 · 种子 lab-2v2-2026-11-06:clone:all:s2

- 第 1 轮 · 配对顺序 hy3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队
  - hy3 复制队 2:6 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 MiniMax M3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 2:6 MIMO-v2.6-pro 复制队
  - step5preview 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 7:1 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3 复制队 → hy4 复制队 → hy3 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4pro 复制队
  - GLM5.3flash 复制队 6:2 KIMI 3.1pro 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 2.8preview 复制队
  - step5preview 复制队 0:8 MiniMax M3 复制队
  - hy4 复制队 5:3 hy3 复制队
- 第 3 轮 · 配对顺序 deepseek v4pro 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 6:2 hy4 复制队
  - GLM5.3 复制队 3:5 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 5:3 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 2:6 hy3 复制队
  - MiniMax M3.1flash 复制队 3:5 step5preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → hy3 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4pro 复制队 7:1 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 3:5 KIMI 3.1pro 复制队
  - hy4 复制队 1:7 GLM5.3 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 3:5 GLM5.3flash 复制队
  - hy3 复制队 1:7 GLM5.3 复制队
  - KIMI 3.1pro 复制队 1:7 MiniMax M3 复制队
  - step5preview 复制队 0:8 KIMI 2.8preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 3 届 · 种子 lab-2v2-2026-11-06:clone:all:s3

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队
  - MiniMax M3 复制队 4:4 deepseek v4.1flash 复制队
  - hy4 复制队 5:3 hy3 复制队
  - deepseek v4pro 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 5:3 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 4:4 GLM5.3 复制队
- 第 2 轮 · 配对顺序 KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队
  - KIMI 3.1pro 复制队 4:4 GLM5.3flash 复制队
  - hy4 复制队 1:7 deepseek v4pro 复制队
  - MiniMax M3 复制队 5:3 GLM5.3 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 2.8preview 复制队
  - hy3 复制队 8:0 step5preview 复制队
- 第 3 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → hy4 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 4:4 deepseek v4.1flash 复制队
  - KIMI 3.1pro 复制队 3:5 MiniMax M3 复制队
  - GLM5.3flash 复制队 8:0 hy4 复制队
  - hy3 复制队 6:2 KIMI 2.8preview 复制队
  - GLM5.3 复制队 7:1 step5preview 复制队
  - MIMO-v2.6-pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4pro 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - MiniMax M3 复制队 6:2 hy3 复制队
  - deepseek v4.1flash 复制队 6:2 KIMI 3.1pro 复制队
  - GLM5.3 复制队 7:1 hy4 复制队
  - MIMO-v2.6-pro 复制队 7:1 KIMI 2.8preview 复制队
  - MiniMax M3.1flash 复制队 1:7 step5preview 复制队
- 第 5 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 2:6 deepseek v4pro 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 6:2 hy3 复制队
  - GLM5.3 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 KIMI 2.8preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队

### 第 4 届 · 种子 lab-2v2-2026-11-06:clone:all:s4

- 第 1 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → MiniMax M3 复制队 → hy3 复制队 → GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 3:5 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 3:5 GLM5.3flash 复制队
  - step5preview 复制队 0:8 hy4 复制队
  - KIMI 3.1pro 复制队 0:8 MiniMax M3 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
- 第 2 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - hy4 复制队 3:5 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - hy3 复制队 4:4 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → step5preview 复制队 → hy4 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队
  - MiniMax M3 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 8:0 step5preview 复制队
  - GLM5.3 复制队 7:1 hy4 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 4:4 KIMI 3.1pro 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → hy4 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - GLM5.3 复制队 4:4 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 4:4 KIMI 2.8preview 复制队
  - hy3 复制队 3:5 hy4 复制队
  - GLM5.3flash 复制队 8:0 step5preview 复制队
  - KIMI 3.1pro 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 5:3 MiniMax M3 复制队
  - deepseek v4pro 复制队 5:3 hy4 复制队
  - GLM5.3flash 复制队 4:4 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 8:0 step5preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队

### 第 5 届 · 种子 lab-2v2-2026-11-06:clone:all:s5

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 5:3 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 5:3 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 GLM5.3flash 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - hy4 复制队 6:2 KIMI 2.8preview 复制队
- 第 2 轮 · 配对顺序 deepseek v4.1flash 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队
  - deepseek v4.1flash 复制队 8:0 hy4 复制队
  - MIMO-v2.6-pro 复制队 5:3 MiniMax M3 复制队
  - GLM5.3flash 复制队 4:4 GLM5.3 复制队
  - deepseek v4pro 复制队 6:2 KIMI 2.8preview 复制队
  - hy3 复制队 6:2 MiniMax M3.1flash 复制队
  - step5preview 复制队 0:8 KIMI 3.1pro 复制队
- 第 3 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 hy3 复制队
  - GLM5.3 复制队 4:4 MiniMax M3 复制队
  - hy4 复制队 0:8 deepseek v4pro 复制队
  - KIMI 3.1pro 复制队 0:8 KIMI 2.8preview 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4pro 复制队
  - GLM5.3 复制队 5:3 hy3 复制队
  - MiniMax M3 复制队 5:3 KIMI 2.8preview 复制队
  - hy4 复制队 8:0 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 7:1 GLM5.3 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - MiniMax M3 复制队 6:2 hy4 复制队
  - KIMI 3.1pro 复制队 1:7 MIMO-v2.6-pro 复制队
  - hy3 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 6 届 · 种子 lab-2v2-2026-11-06:clone:all:s6

- 第 1 轮 · 配对顺序 step5preview 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy4 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 1:7 MiniMax M3 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4pro 复制队
  - hy4 复制队 1:7 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 deepseek v4.1flash 复制队
  - hy3 复制队 3:5 KIMI 3.1pro 复制队
- 第 2 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队
  - MiniMax M3 复制队 7:1 deepseek v4pro 复制队
  - deepseek v4.1flash 复制队 8:0 KIMI 3.1pro 复制队
  - GLM5.3 复制队 4:4 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 4:4 KIMI 2.8preview 复制队
  - hy4 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 hy3 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 2:6 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 KIMI 3.1pro 复制队
  - GLM5.3 复制队 5:3 hy3 复制队
  - hy4 复制队 1:7 deepseek v4pro 复制队
  - KIMI 2.8preview 复制队 8:0 step5preview 复制队
  - MIMO-v2.6-pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - GLM5.3flash 复制队 2:6 MiniMax M3 复制队
  - deepseek v4pro 复制队 7:1 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 6:2 hy3 复制队
  - hy4 复制队 5:3 KIMI 3.1pro 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 deepseek v4pro 复制队
  - MiniMax M3 复制队 2:6 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 5:3 GLM5.3flash 复制队
  - hy4 复制队 3:5 KIMI 2.8preview 复制队
  - hy3 复制队 6:2 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

### 第 7 届 · 种子 lab-2v2-2026-11-06:clone:all:s7

- 第 1 轮 · 配对顺序 deepseek v4.1flash 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → MiniMax M3.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队
  - deepseek v4.1flash 复制队 6:2 hy3 复制队
  - MiniMax M3 复制队 6:2 hy4 复制队
  - deepseek v4pro 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 8:0 MiniMax M3.1flash 复制队
  - KIMI 2.8preview 复制队 2:6 GLM5.3 复制队
- 第 2 轮 · 配对顺序 GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3flash 复制队 3:5 MIMO-v2.6-pro 复制队
  - deepseek v4.1flash 复制队 6:2 GLM5.3 复制队
  - MiniMax M3 复制队 3:5 deepseek v4pro 复制队
  - hy4 复制队 3:5 KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 KIMI 2.8preview 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 3 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 1:7 deepseek v4.1flash 复制队
  - MIMO-v2.6-pro 复制队 4:4 MiniMax M3 复制队
  - hy3 复制队 4:4 KIMI 3.1pro 复制队
  - KIMI 2.8preview 复制队 3:5 GLM5.3flash 复制队
  - GLM5.3 复制队 8:0 step5preview 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4.1flash 复制队 6:2 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 4:4 GLM5.3flash 复制队
  - deepseek v4pro 复制队 6:2 hy3 复制队
  - KIMI 3.1pro 复制队 1:7 MiniMax M3 复制队
  - hy4 复制队 2:6 KIMI 2.8preview 复制队
  - MiniMax M3.1flash 复制队 0:8 step5preview 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3flash 复制队
  - deepseek v4pro 复制队 5:3 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 5:3 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 6:2 hy3 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - step5preview 复制队 1:7 hy4 复制队

### 第 8 届 · 种子 lab-2v2-2026-11-06:clone:all:s8

- 第 1 轮 · 配对顺序 MiniMax M3 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3.1flash 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队
  - MiniMax M3 复制队 5:3 hy4 复制队
  - KIMI 3.1pro 复制队 1:7 GLM5.3flash 复制队
  - hy3 复制队 5:3 MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3 复制队
  - deepseek v4pro 复制队 5:3 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 8:0 step5preview 复制队
- 第 2 轮 · 配对顺序 MiniMax M3 复制队 → hy3 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 6:2 hy3 复制队
  - GLM5.3flash 复制队 3:5 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 4:4 GLM5.3 复制队
  - MiniMax M3.1flash 复制队 0:8 deepseek v4.1flash 复制队
  - KIMI 3.1pro 复制队 7:1 step5preview 复制队
  - hy4 复制队 3:5 MIMO-v2.6-pro 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - MiniMax M3 复制队 7:1 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 3:5 GLM5.3flash 复制队
  - GLM5.3 复制队 6:2 KIMI 3.1pro 复制队
  - hy3 复制队 0:8 deepseek v4.1flash 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 4 轮 · 配对顺序 MiniMax M3 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - MiniMax M3 复制队 4:4 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 8:0 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 4:4 KIMI 2.8preview 复制队
  - deepseek v4pro 复制队 7:1 KIMI 3.1pro 复制队
  - hy3 复制队 4:4 hy4 复制队
  - MiniMax M3.1flash 复制队 1:7 step5preview 复制队
- 第 5 轮 · 配对顺序 MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 2:6 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 3:5 deepseek v4.1flash 复制队
  - KIMI 2.8preview 复制队 4:4 deepseek v4pro 复制队
  - GLM5.3flash 复制队 8:0 hy4 复制队
  - hy3 复制队 8:0 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队

### 第 9 届 · 种子 lab-2v2-2026-11-06:clone:all:s9

- 第 1 轮 · 配对顺序 hy4 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3.1flash 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → step5preview 复制队 → GLM5.3 复制队 → hy3 复制队
  - hy4 复制队 1:7 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 2:6 GLM5.3flash 复制队
  - KIMI 3.1pro 复制队 3:5 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 8:0 step5preview 复制队
  - GLM5.3 复制队 4:4 hy3 复制队
- 第 2 轮 · 配对顺序 KIMI 2.8preview 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3flash 复制队 → hy3 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → deepseek v4pro 复制队
  - KIMI 2.8preview 复制队 4:4 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 5:3 MIMO-v2.6-pro 复制队
  - GLM5.3flash 复制队 6:2 hy3 复制队
  - GLM5.3 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 6:2 KIMI 3.1pro 复制队
  - step5preview 复制队 1:7 deepseek v4pro 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → MiniMax M3 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → GLM5.3 复制队 → deepseek v4pro 复制队 → hy4 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队
  - GLM5.3flash 复制队 5:3 MiniMax M3 复制队
  - deepseek v4.1flash 复制队 5:3 GLM5.3 复制队
  - KIMI 2.8preview 复制队 0:8 deepseek v4pro 复制队
  - hy4 复制队 2:6 MIMO-v2.6-pro 复制队
  - hy3 复制队 7:1 MiniMax M3.1flash 复制队
  - KIMI 3.1pro 复制队 8:0 step5preview 复制队
- 第 4 轮 · 配对顺序 GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → hy3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3flash 复制队 2:6 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 6:2 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 4:4 hy3 复制队
  - GLM5.3 复制队 5:3 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 8:0 step5preview 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → GLM5.3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 6:2 MiniMax M3 复制队
  - GLM5.3flash 复制队 1:7 GLM5.3 复制队
  - MIMO-v2.6-pro 复制队 6:2 deepseek v4pro 复制队
  - hy3 复制队 4:4 KIMI 3.1pro 复制队
  - hy4 复制队 4:4 KIMI 2.8preview 复制队
  - step5preview 复制队 8:0 MiniMax M3.1flash 复制队

### 第 10 届 · 种子 lab-2v2-2026-11-06:clone:all:s10

- 第 1 轮 · 配对顺序 MiniMax M3.1flash 复制队 → GLM5.3flash 复制队 → hy4 复制队 → deepseek v4pro 复制队 → hy3 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → step5preview 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队
  - MiniMax M3.1flash 复制队 0:8 GLM5.3flash 复制队
  - hy4 复制队 1:7 deepseek v4pro 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
  - KIMI 3.1pro 复制队 2:6 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 8:0 step5preview 复制队
  - KIMI 2.8preview 复制队 3:5 MIMO-v2.6-pro 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - MiniMax M3 复制队 4:4 GLM5.3 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 6:2 KIMI 3.1pro 复制队
  - hy4 复制队 8:0 step5preview 复制队
- 第 3 轮 · 配对顺序 GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → hy3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3flash 复制队 2:6 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 5:3 KIMI 2.8preview 复制队
  - GLM5.3 复制队 4:4 hy4 复制队
  - hy3 复制队 3:5 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 8:0 step5preview 复制队
  - KIMI 3.1pro 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 deepseek v4.1flash 复制队 → MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → hy4 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MiniMax M3 复制队
  - deepseek v4pro 复制队 3:5 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 5:3 GLM5.3flash 复制队
  - hy4 复制队 2:6 KIMI 3.1pro 复制队
  - hy3 复制队 3:5 KIMI 2.8preview 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
- 第 5 轮 · 配对顺序 deepseek v4.1flash 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → MiniMax M3 复制队 → KIMI 2.8preview 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - GLM5.3 复制队 5:3 KIMI 2.8preview 复制队
  - MiniMax M3 复制队 3:5 GLM5.3flash 复制队
  - deepseek v4pro 复制队 6:2 KIMI 3.1pro 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
  - hy3 复制队 8:0 step5preview 复制队

### 第 11 届 · 种子 lab-2v2-2026-11-06:clone:all:s11

- 第 1 轮 · 配对顺序 KIMI 3.1pro 复制队 → KIMI 2.8preview 复制队 → MIMO-v2.6-pro 复制队 → GLM5.3 复制队 → hy4 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → deepseek v4pro 复制队 → hy3 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → MiniMax M3 复制队
  - KIMI 3.1pro 复制队 2:6 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 6:2 GLM5.3 复制队
  - hy4 复制队 1:7 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 3:5 deepseek v4pro 复制队
  - hy3 复制队 8:0 step5preview 复制队
  - MiniMax M3.1flash 复制队 0:8 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 deepseek v4pro 复制队 → hy3 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → step5preview 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队 → hy4 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队
  - deepseek v4pro 复制队 6:2 hy3 复制队
  - MiniMax M3 复制队 5:3 GLM5.3flash 复制队
  - MIMO-v2.6-pro 复制队 8:0 KIMI 2.8preview 复制队
  - step5preview 复制队 7:1 MiniMax M3.1flash 复制队
  - KIMI 3.1pro 复制队 5:3 hy4 复制队
  - GLM5.3 复制队 2:6 deepseek v4.1flash 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → step5preview 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → deepseek v4.1flash 复制队 → hy4 复制队 → GLM5.3 复制队 → MiniMax M3.1flash 复制队
  - MiniMax M3 复制队 4:4 deepseek v4pro 复制队
  - MIMO-v2.6-pro 复制队 6:2 KIMI 3.1pro 复制队
  - GLM5.3flash 复制队 8:0 step5preview 复制队
  - hy3 复制队 4:4 KIMI 2.8preview 复制队
  - deepseek v4.1flash 复制队 7:1 hy4 复制队
  - GLM5.3 复制队 8:0 MiniMax M3.1flash 复制队
- 第 4 轮 · 配对顺序 MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → hy3 复制队 → step5preview 复制队 → GLM5.3 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4pro 复制队
  - MiniMax M3 复制队 3:5 deepseek v4.1flash 复制队
  - GLM5.3flash 复制队 3:5 KIMI 2.8preview 复制队
  - hy3 复制队 2:6 GLM5.3 复制队
  - step5preview 复制队 0:8 KIMI 3.1pro 复制队
  - MiniMax M3.1flash 复制队 0:8 hy4 复制队
- 第 5 轮 · 配对顺序 deepseek v4pro 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4.1flash 复制队 → KIMI 2.8preview 复制队 → MiniMax M3 复制队 → GLM5.3 复制队 → GLM5.3flash 复制队 → KIMI 3.1pro 复制队 → hy3 复制队 → step5preview 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队
  - deepseek v4pro 复制队 4:4 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 3:5 deepseek v4.1flash 复制队
  - MiniMax M3 复制队 5:3 GLM5.3 复制队
  - GLM5.3flash 复制队 4:4 KIMI 3.1pro 复制队
  - hy3 复制队 8:0 MiniMax M3.1flash 复制队
  - step5preview 复制队 0:8 hy4 复制队

### 第 12 届 · 种子 lab-2v2-2026-11-06:clone:all:s12

- 第 1 轮 · 配对顺序 GLM5.3flash 复制队 → step5preview 复制队 → deepseek v4pro 复制队 → MiniMax M3.1flash 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3 复制队
  - GLM5.3flash 复制队 8:0 step5preview 复制队
  - deepseek v4pro 复制队 8:0 MiniMax M3.1flash 复制队
  - deepseek v4.1flash 复制队 4:4 GLM5.3 复制队
  - KIMI 2.8preview 复制队 7:1 KIMI 3.1pro 复制队
  - MIMO-v2.6-pro 复制队 8:0 hy4 复制队
  - hy3 复制队 0:8 MiniMax M3 复制队
- 第 2 轮 · 配对顺序 MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → deepseek v4pro 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → hy4 复制队 → MiniMax M3.1flash 复制队 → KIMI 3.1pro 复制队 → step5preview 复制队 → hy3 复制队
  - MiniMax M3 复制队 5:3 MIMO-v2.6-pro 复制队
  - deepseek v4pro 复制队 6:2 GLM5.3flash 复制队
  - KIMI 2.8preview 复制队 2:6 deepseek v4.1flash 复制队
  - GLM5.3 复制队 7:1 hy4 复制队
  - MiniMax M3.1flash 复制队 0:8 KIMI 3.1pro 复制队
  - step5preview 复制队 0:8 hy3 复制队
- 第 3 轮 · 配对顺序 MiniMax M3 复制队 → deepseek v4pro 复制队 → deepseek v4.1flash 复制队 → GLM5.3 复制队 → hy3 复制队 → KIMI 3.1pro 复制队 → GLM5.3flash 复制队 → MIMO-v2.6-pro 复制队 → KIMI 2.8preview 复制队 → MiniMax M3.1flash 复制队 → hy4 复制队 → step5preview 复制队
  - MiniMax M3 复制队 0:8 deepseek v4pro 复制队
  - deepseek v4.1flash 复制队 8:0 hy3 复制队
  - GLM5.3 复制队 7:1 KIMI 3.1pro 复制队
  - GLM5.3flash 复制队 5:3 MIMO-v2.6-pro 复制队
  - KIMI 2.8preview 复制队 8:0 MiniMax M3.1flash 复制队
  - hy4 复制队 8:0 step5preview 复制队
- 第 4 轮 · 配对顺序 deepseek v4pro 复制队 → GLM5.3 复制队 → deepseek v4.1flash 复制队 → MiniMax M3 复制队 → GLM5.3flash 复制队 → KIMI 2.8preview 复制队 → KIMI 3.1pro 复制队 → MIMO-v2.6-pro 复制队 → hy4 复制队 → hy3 复制队 → MiniMax M3.1flash 复制队 → step5preview 复制队
  - deepseek v4pro 复制队 3:5 GLM5.3 复制队
  - deepseek v4.1flash 复制队 4:4 MiniMax M3 复制队
  - GLM5.3flash 复制队 8:0 KIMI 2.8preview 复制队
  - KIMI 3.1pro 复制队 2:6 MIMO-v2.6-pro 复制队
  - hy4 复制队 3:5 hy3 复制队
  - MiniMax M3.1flash 复制队 3:5 step5preview 复制队
- 第 5 轮 · 配对顺序 GLM5.3 复制队 → deepseek v4.1flash 复制队 → GLM5.3flash 复制队 → deepseek v4pro 复制队 → MiniMax M3 复制队 → MIMO-v2.6-pro 复制队 → hy3 复制队 → KIMI 2.8preview 复制队 → hy4 复制队 → step5preview 复制队 → KIMI 3.1pro 复制队 → MiniMax M3.1flash 复制队
  - GLM5.3 复制队 5:3 GLM5.3flash 复制队
  - deepseek v4.1flash 复制队 6:2 deepseek v4pro 复制队
  - MiniMax M3 复制队 6:2 KIMI 2.8preview 复制队
  - MIMO-v2.6-pro 复制队 7:1 hy3 复制队
  - hy4 复制队 8:0 MiniMax M3.1flash 复制队
  - step5preview 复制队 1:7 KIMI 3.1pro 复制队

## 逐局明细与复现

完整逐局记录（每局种子、4 个座位及其模型、前位队、引擎获胜队伍、回合数、终局权威）见 `star-realms-2v2-clone-all.json` 的 `seasons[].rounds[].pairs[].games`。

```bash
node src/team-lab-cli.js --experiment clone --sets all --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --repeats 1 --out reply/star-realms-2v2-clone-all
```
