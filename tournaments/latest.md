# 12 模型 AI 瑞士轮锦标赛报告

## 结论

**最强脚本：deepseek v4.1flash（模型自选：三段涨潮）**，脚本 `script:agent-deepseekv41flash.js`。共 12 届独立瑞士轮、每届 5 轮、每场 BO10（5 局先手 + 5 局后手），累计 600 局、胜 415 局，局胜率 69.17%，平均名次 1.58，夺冠 8/12 届，领先第二名 undefined 的局胜率 6.34 个百分点。

> 结论口径：聚合榜以**局胜率**为第一排序键（每场 BO10 的局分比场分样本更细），其次为累计场分、平均名次。单届名次用于瑞士轮配对，不作为跨届实力唯一依据。

## 置信度与先后手核对

| 项目 | 数值 |
|---|---|
| 冠军 deepseek v4.1flash 局胜率 95% CI（Wilson） | [65.36%, 72.73%] |
| 亚军 GLM5.3 局胜率 95% CI（Wilson） | [58.90%, 66.61%] |
| 冠亚局胜率差 | 6.34 个百分点 |
| 两比例近似 z 值 | 2.323（|z| ≥ 1.96 才达到 95% 显著） |
| 差异是否显著 | 是 |
| 先手方总胜率 | 53.06%（1910/3600 局） |
| 各届冠军分布 | deepseek v4.1flash × 8；MiniMax M3 × 1；deepseek v4pro × 1；GLM5.3 × 2 |

> 同一赛事内对局并非完全独立（对手强度由瑞士轮配对决定），Wilson 区间与两比例 z 检验只作近似参考；「最强」指本赛制、本牌包、本组随机种子下的可复现排名，不等价于跨环境绝对实力。先后手已按每场各 5 局严格配平，先手方总胜率可用于检验规则本身的先后手偏差。

## 赛制与随机化

| 项目 | 设定 |
|---|---|
| 主种子 | `swiss-2026-11-05` |
| 届数 | 12（每届独立种子 `<主种子>:sN`，配对与局种子独立重掷） |
| 每届轮数 | 5（瑞士轮，按场分配对） |
| 每场 | BO10 = 5 局 A 先手 + 5 局 B 先手，每局独立随机种子 |
| 牌包 | `core` |
| 模式 | `standard` 标准双人 1v1 |
| 参赛 | 12 个模型脚本 |

随机性由主种子派生，全部可复现：

- `:entrants`：参赛名单初始随机排序；
- `:pair:rN`：每轮同分组内随机排序（同分不打固定顺序）；
- `:game-seeds`：为每一局生成独立随机种子，写入逐局记录；
- `:tiebreak`：最终同分时的随机优先级。

配对规则：按场分降序分组，同分组内随机排序后相邻配对；优先同分、尽量避免重赛，组内无未交手对手时允许跨分组浮动，仍无解才重赛。奇数人数时最低分轮空得 1 场分。

计分：每场胜 1 场分 / 平 0.5 / 负 0；单届排名依次比较 场分 MP → 局胜 GP → Buchholz（对手场分和）→ Sonneborn–Berger → 随机优先级。

## 账目守恒

| 核对项 | 数值 |
|---|---:|
| 每届轮数 | 5 |
| 每轮场次 | 6（12 人两两配对） |
| 每场局数 | 10 |
| 单届总局数 | 300 |
| 全部届总局数 | 3600 |
| 实际完成局数 | 3600 |
| 每位脚本每届局数 | 50（先手 25 / 后手 25） |
| 重赛场次 | 0 |
| 异常重试局 | 0 |

## 聚合总榜

| 名次 | 模型 | 策略 | 夺冠 | 平均名次 | 局胜/总局 | 局胜率 | 累计场分 | 先手胜率 | 后手胜率 | 平均 Buchholz |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | deepseek v4.1flash | 模型自选：三段涨潮 | 8/12 | 1.58 | 415/600 | 69.17% | 53 | 73.3% | 65.0% | 14.71 |
| 2 | GLM5.3 | 模型自选：曲线竞速（Curve Race） | 2/12 | 3.67 | 377/600 | 62.83% | 40.5 | 69.0% | 56.7% | 13.83 |
| 3 | deepseek v4pro | 模型自选：价值节奏快攻（Tempo-Value Aggro） | 1/12 | 3.33 | 367/600 | 61.17% | 41 | 66.0% | 56.3% | 14.54 |
| 4 | KIMI 2.8preview | 模型自选：蜂群速攻（Blitz Swarm） | 0/12 | 3.92 | 367/600 | 61.17% | 39 | 63.3% | 59.0% | 14.38 |
| 5 | MiniMax M3 | 模型自选：壁垒重锤 | 1/12 | 5 | 354/600 | 59.00% | 36.5 | 64.3% | 53.7% | 12.83 |
| 6 | MIMO-v2.6-pro | 模型自选：闪电压制 | 0/12 | 5.75 | 344/600 | 57.33% | 32.5 | 61.7% | 53.0% | 12.79 |
| 7 | hy3 | 模型自选：协同滚雪球 | 0/12 | 7.17 | 339/600 | 56.50% | 29.5 | 62.0% | 51.0% | 11.46 |
| 8 | GLM5.3flash | 模型自选：精炼雪球（Refined Snowball） | 0/12 | 6.67 | 330/600 | 55.00% | 30.5 | 56.3% | 53.7% | 12.21 |
| 9 | KIMI 3.1pro | 模型自选：压缩脉冲 | 0/12 | 8.08 | 311/600 | 51.83% | 26 | 57.0% | 46.7% | 11.08 |
| 10 | hy4 | 模型自选：薄牌护城河 | 0/12 | 9.83 | 232/600 | 38.67% | 19.5 | 36.7% | 40.7% | 10.67 |
| 11 | step5preview | 模型自选：雪球收割（Snowball-Reap） | 0/12 | 11.33 | 89/600 | 14.83% | 8.5 | 15.0% | 14.7% | 10.54 |
| 12 | MiniMax M3.1flash | 模型自选：破垒夺权 | 0/12 | 11.67 | 75/600 | 12.50% | 3.5 | 12.0% | 13.0% | 10.96 |

## 第 1 届（种子 `swiss-2026-11-05:s1`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 37 | 74.00% | 5/0/0 | 13.5 | 13.5 |
| 2 | deepseek v4pro | 3.5 | 33 | 66.00% | 3/1/1 | 13.5 | 7 |
| 3 | KIMI 2.8preview | 3.5 | 29 | 58.00% | 3/1/1 | 14 | 7.5 |
| 4 | GLM5.3 | 3 | 32 | 64.00% | 2/2/1 | 14.5 | 6.25 |
| 5 | MIMO-v2.6-pro | 3 | 30 | 60.00% | 2/2/1 | 11 | 5.25 |
| 6 | GLM5.3flash | 3 | 27 | 54.00% | 3/0/2 | 10 | 4.5 |
| 7 | MiniMax M3 | 2.5 | 25 | 50.00% | 2/1/2 | 16 | 6.75 |
| 8 | hy3 | 2 | 28 | 56.00% | 2/0/3 | 13 | 3 |
| 9 | hy4 | 2 | 23 | 46.00% | 2/0/3 | 9.5 | 1 |
| 10 | KIMI 3.1pro | 1.5 | 24 | 48.00% | 1/1/3 | 12.5 | 1.25 |
| 11 | MiniMax M3.1flash | 1 | 7 | 14.00% | 1/0/4 | 12 | 0 |
| 12 | step5preview | 0 | 5 | 10.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：deepseek v4pro → hy4 → step5preview → MIMO-v2.6-pro → hy3 → KIMI 2.8preview → MiniMax M3 → KIMI 3.1pro → GLM5.3 → GLM5.3flash → deepseek v4.1flash → MiniMax M3.1flash

- deepseek v4pro 10:0 hy4 [A先 AAAAA | B先 AAAAA] → deepseek v4pro
- step5preview 0:10 MIMO-v2.6-pro [A先 BBBBB | B先 BBBBB] → MIMO-v2.6-pro
- hy3 3:7 KIMI 2.8preview [A先 ABBBB | B先 ABBBA] → KIMI 2.8preview
- MiniMax M3 5:5 KIMI 3.1pro [A先 AAABA | B先 BABBB] → 平局
- GLM5.3 8:2 GLM5.3flash [A先 AABAA | B先 AAABA] → GLM5.3
- deepseek v4.1flash 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → GLM5.3 → deepseek v4pro → MIMO-v2.6-pro → MiniMax M3 → KIMI 3.1pro → step5preview → hy4 → GLM5.3flash → hy3 → MiniMax M3.1flash

- deepseek v4.1flash 8:2 KIMI 2.8preview [A先 AAAAA | B先 AAABB] → deepseek v4.1flash
- GLM5.3 5:5 deepseek v4pro [A先 ABBBA | B先 BAAAB] → 平局
- MIMO-v2.6-pro 4:6 MiniMax M3 [A先 BBBBB | B先 BAAAA]（跨分组浮动 0.5） → MiniMax M3
- KIMI 3.1pro 9:1 step5preview [A先 AABAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro
- hy4 3:7 GLM5.3flash [A先 BABBB | B先 AABBB] → GLM5.3flash
- hy3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → hy3

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → deepseek v4pro → KIMI 3.1pro → MiniMax M3 → MIMO-v2.6-pro → GLM5.3flash → KIMI 2.8preview → hy3 → hy4 → step5preview → MiniMax M3.1flash

- deepseek v4.1flash 6:4 GLM5.3 [A先 AABAA | B先 BBBAA]（跨分组浮动 0.5） → deepseek v4.1flash
- deepseek v4pro 6:4 KIMI 3.1pro [A先 BAAAA | B先 BBBAA] → deepseek v4pro
- MiniMax M3 8:2 GLM5.3flash [A先 ABAAB | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3
- MIMO-v2.6-pro 5:5 KIMI 2.8preview [A先 AAABB | B先 AABBB] → 平局
- hy3 9:1 hy4 [A先 AAAAA | B先 BAAAA]（跨分组浮动 1） → hy3
- step5preview 3:7 MiniMax M3.1flash [A先 BAAAB | B先 BBBBB] → MiniMax M3.1flash

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3 → deepseek v4pro → hy3 → KIMI 2.8preview → MIMO-v2.6-pro → KIMI 3.1pro → GLM5.3 → GLM5.3flash → MiniMax M3.1flash → hy4 → step5preview

- deepseek v4.1flash 7:3 MiniMax M3 [A先 AAABA | B先 ABAAB]（跨分组浮动 0.5） → deepseek v4.1flash
- deepseek v4pro 8:2 hy3 [A先 AAAAA | B先 BABAA]（跨分组浮动 0.5） → deepseek v4pro
- KIMI 2.8preview 8:2 KIMI 3.1pro [A先 ABAAA | B先 AAABA] → KIMI 2.8preview
- MIMO-v2.6-pro 5:5 GLM5.3 [A先 AABAA | B先 BBABB] → 平局
- GLM5.3flash 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → GLM5.3flash
- hy4 9:1 step5preview [A先 AAAAA | B先 AABAA] → hy4

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → MiniMax M3 → KIMI 2.8preview → MIMO-v2.6-pro → hy3 → GLM5.3flash → GLM5.3 → KIMI 3.1pro → hy4 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 6:4 deepseek v4pro [A先 AABAA | B先 BBABA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3 3:7 KIMI 2.8preview [A先 BBBBA | B先 BABBA] → KIMI 2.8preview
- MIMO-v2.6-pro 6:4 hy3 [A先 BAAAA | B先 BBAAB] → MIMO-v2.6-pro
- GLM5.3flash 6:4 KIMI 3.1pro [A先 ABAAA | B先 ABBBA]（跨分组浮动 0.5） → GLM5.3flash
- GLM5.3 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 2） → GLM5.3
- hy4 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → hy4

## 第 2 届（种子 `swiss-2026-11-05:s2`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 36 | 72.00% | 5/0/0 | 15 | 15 |
| 2 | deepseek v4pro | 4 | 32 | 64.00% | 4/0/1 | 13 | 8 |
| 3 | GLM5.3 | 3.5 | 30 | 60.00% | 3/1/1 | 14.5 | 8.25 |
| 4 | KIMI 2.8preview | 3 | 30 | 60.00% | 3/0/2 | 16 | 7 |
| 5 | MIMO-v2.6-pro | 2.5 | 30 | 60.00% | 2/1/2 | 11.5 | 3.75 |
| 6 | GLM5.3flash | 2.5 | 27 | 54.00% | 2/1/2 | 14 | 4.25 |
| 7 | MiniMax M3 | 2.5 | 24 | 48.00% | 2/1/2 | 14 | 5.25 |
| 8 | KIMI 3.1pro | 2 | 30 | 60.00% | 2/0/3 | 12.5 | 1 |
| 9 | hy3 | 2 | 24 | 48.00% | 2/0/3 | 11 | 2.5 |
| 10 | hy4 | 2 | 22 | 44.00% | 2/0/3 | 8.5 | 1 |
| 11 | step5preview | 0.5 | 9 | 18.00% | 0/1/4 | 9 | 0.25 |
| 12 | MiniMax M3.1flash | 0.5 | 6 | 12.00% | 0/1/4 | 11 | 0.25 |

### 第 1 轮

同分随机排序后的配对顺序：hy4 → KIMI 2.8preview → hy3 → MIMO-v2.6-pro → GLM5.3 → MiniMax M3 → GLM5.3flash → step5preview → KIMI 3.1pro → deepseek v4.1flash → MiniMax M3.1flash → deepseek v4pro

- hy4 1:9 KIMI 2.8preview [A先 BABBB | B先 BBBBB] → KIMI 2.8preview
- hy3 1:9 MIMO-v2.6-pro [A先 ABBBB | B先 BBBBB] → MIMO-v2.6-pro
- GLM5.3 8:2 MiniMax M3 [A先 AAAAA | B先 AAABB] → GLM5.3
- GLM5.3flash 9:1 step5preview [A先 AAAAA | B先 AAABA] → GLM5.3flash
- KIMI 3.1pro 4:6 deepseek v4.1flash [A先 BBBBA | B先 BBAAA] → deepseek v4.1flash
- MiniMax M3.1flash 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4pro → deepseek v4.1flash → GLM5.3 → GLM5.3flash → MIMO-v2.6-pro → KIMI 2.8preview → hy3 → hy4 → KIMI 3.1pro → MiniMax M3 → MiniMax M3.1flash → step5preview

- deepseek v4pro 1:9 deepseek v4.1flash [A先 BBBBB | B先 BBABB] → deepseek v4.1flash
- GLM5.3 5:5 GLM5.3flash [A先 BBBAA | B先 ABAAB] → 平局
- MIMO-v2.6-pro 4:6 KIMI 2.8preview [A先 ABABB | B先 BBABA] → KIMI 2.8preview
- hy3 8:2 hy4 [A先 ABAAA | B先 AABAA] → hy3
- KIMI 3.1pro 4:6 MiniMax M3 [A先 BAAAA | B先 BBBBB] → MiniMax M3
- MiniMax M3.1flash 5:5 step5preview [A先 ABABB | B先 AABBA] → 平局

### 第 3 轮

同分随机排序后的配对顺序：KIMI 2.8preview → deepseek v4.1flash → GLM5.3flash → GLM5.3 → hy3 → MIMO-v2.6-pro → deepseek v4pro → MiniMax M3 → MiniMax M3.1flash → step5preview → hy4 → KIMI 3.1pro

- KIMI 2.8preview 4:6 deepseek v4.1flash [A先 AABBB | B先 BABAB] → deepseek v4.1flash
- GLM5.3flash 8:2 hy3 [A先 AAABA | B先 AAAAB]（跨分组浮动 0.5） → GLM5.3flash
- GLM5.3 8:2 MIMO-v2.6-pro [A先 AAAAA | B先 AAABB]（跨分组浮动 0.5） → GLM5.3
- deepseek v4pro 8:2 MiniMax M3 [A先 ABAAA | B先 ABAAA] → deepseek v4pro
- MiniMax M3.1flash 1:9 hy4 [A先 BBBBB | B先 BBBAB]（跨分组浮动 0.5） → hy4
- step5preview 1:9 KIMI 3.1pro [A先 BBABB | B先 BBBBB]（跨分组浮动 0.5） → KIMI 3.1pro

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → GLM5.3flash → KIMI 2.8preview → deepseek v4pro → KIMI 3.1pro → hy4 → MiniMax M3 → MIMO-v2.6-pro → hy3 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 7:3 GLM5.3 [A先 AAAAA | B先 ABABB]（跨分组浮动 0.5） → deepseek v4.1flash
- GLM5.3flash 3:7 KIMI 2.8preview [A先 BBBAB | B先 BBABA]（跨分组浮动 0.5） → KIMI 2.8preview
- deepseek v4pro 7:3 KIMI 3.1pro [A先 AAAAA | B先 BABBA]（跨分组浮动 1） → deepseek v4pro
- hy4 1:9 MiniMax M3 [A先 ABBBB | B先 BBBBB] → MiniMax M3
- MIMO-v2.6-pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MIMO-v2.6-pro
- hy3 9:1 step5preview [A先 AAAAA | B先 AAAAB]（跨分组浮动 0.5） → hy3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → deepseek v4pro → GLM5.3 → GLM5.3flash → MiniMax M3 → MIMO-v2.6-pro → hy3 → KIMI 3.1pro → hy4 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 8:2 GLM5.3flash [A先 AAABA | B先 BAAAA]（跨分组浮动 1.5） → deepseek v4.1flash
- KIMI 2.8preview 4:6 deepseek v4pro [A先 BABBA | B先 AABBB] → deepseek v4pro
- GLM5.3 6:4 hy3 [A先 ABAAB | B先 BAAAB]（跨分组浮动 0.5） → GLM5.3
- MiniMax M3 5:5 MIMO-v2.6-pro [A先 BBABA | B先 AABAB] → 平局
- KIMI 3.1pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro
- hy4 9:1 step5preview [A先 AAABA | B先 AAAAA]（跨分组浮动 0.5） → hy4

## 第 3 届（种子 `swiss-2026-11-05:s3`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | MiniMax M3 | 4.5 | 33 | 66.00% | 4/1/0 | 13.5 | 11.75 |
| 2 | KIMI 2.8preview | 4 | 38 | 76.00% | 4/0/1 | 12 | 9.5 |
| 3 | deepseek v4.1flash | 3.5 | 31 | 62.00% | 3/1/1 | 17 | 10.75 |
| 4 | deepseek v4pro | 3 | 31 | 62.00% | 3/0/2 | 13.5 | 5.5 |
| 5 | hy3 | 3 | 29 | 58.00% | 3/0/2 | 10 | 4 |
| 6 | GLM5.3 | 2.5 | 29 | 58.00% | 2/1/2 | 14 | 5.25 |
| 7 | MIMO-v2.6-pro | 2.5 | 23 | 46.00% | 2/1/2 | 15.5 | 6.25 |
| 8 | KIMI 3.1pro | 2 | 26 | 52.00% | 2/0/3 | 9.5 | 1 |
| 9 | GLM5.3flash | 2 | 23 | 46.00% | 2/0/3 | 14.5 | 3 |
| 10 | hy4 | 2 | 22 | 44.00% | 2/0/3 | 11 | 1 |
| 11 | step5preview | 1 | 9 | 18.00% | 1/0/4 | 9 | 0 |
| 12 | MiniMax M3.1flash | 0 | 6 | 12.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：KIMI 3.1pro → step5preview → hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → GLM5.3 → GLM5.3flash → KIMI 2.8preview → deepseek v4.1flash → MiniMax M3 → hy4 → deepseek v4pro

- KIMI 3.1pro 9:1 step5preview [A先 AAAAB | B先 AAAAA] → KIMI 3.1pro
- hy3 4:6 MIMO-v2.6-pro [A先 BBABA | B先 BBBAA] → MIMO-v2.6-pro
- MiniMax M3.1flash 0:10 GLM5.3 [A先 BBBBB | B先 BBBBB] → GLM5.3
- GLM5.3flash 2:8 KIMI 2.8preview [A先 BBBAB | B先 ABBBB] → KIMI 2.8preview
- deepseek v4.1flash 5:5 MiniMax M3 [A先 BBAAB | B先 ABABA] → 平局
- hy4 2:8 deepseek v4pro [A先 ABBAB | B先 BBBBB] → deepseek v4pro

### 第 2 轮

同分随机排序后的配对顺序：KIMI 2.8preview → GLM5.3 → KIMI 3.1pro → MIMO-v2.6-pro → deepseek v4pro → deepseek v4.1flash → MiniMax M3 → GLM5.3flash → MiniMax M3.1flash → step5preview → hy3 → hy4

- KIMI 2.8preview 4:6 GLM5.3 [A先 BBAAA | B先 BBBBA] → GLM5.3
- KIMI 3.1pro 4:6 MIMO-v2.6-pro [A先 BABAB | B先 BBABA] → MIMO-v2.6-pro
- deepseek v4pro 3:7 deepseek v4.1flash [A先 BBBBA | B先 BBABA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3 9:1 GLM5.3flash [A先 BAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3
- MiniMax M3.1flash 3:7 step5preview [A先 ABBBB | B先 ABBAB] → step5preview
- hy3 9:1 hy4 [A先 AABAA | B先 AAAAA] → hy3

### 第 3 轮

同分随机排序后的配对顺序：GLM5.3 → MIMO-v2.6-pro → deepseek v4.1flash → MiniMax M3 → deepseek v4pro → hy3 → KIMI 3.1pro → step5preview → KIMI 2.8preview → MiniMax M3.1flash → GLM5.3flash → hy4

- GLM5.3 5:5 MIMO-v2.6-pro [A先 AAABA | B先 ABBBB] → 平局
- deepseek v4.1flash 9:1 hy3 [A先 BAAAA | B先 AAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3 6:4 deepseek v4pro [A先 BBAAA | B先 ABBAA]（跨分组浮动 0.5） → MiniMax M3
- KIMI 3.1pro 0:10 KIMI 2.8preview [A先 BBBBB | B先 BBBBB] → KIMI 2.8preview
- step5preview 0:10 GLM5.3flash [A先 BBBBB | B先 BBBBB]（跨分组浮动 1） → GLM5.3flash
- MiniMax M3.1flash 1:9 hy4 [A先 ABBBB | B先 BBBBB] → hy4

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → MIMO-v2.6-pro → MiniMax M3 → deepseek v4.1flash → KIMI 2.8preview → GLM5.3flash → hy4 → step5preview → KIMI 3.1pro → deepseek v4pro → hy3 → MiniMax M3.1flash

- GLM5.3 4:6 MiniMax M3 [A先 BABAA | B先 BBBAB] → MiniMax M3
- MIMO-v2.6-pro 3:7 deepseek v4.1flash [A先 BBABB | B先 AABBB] → deepseek v4.1flash
- KIMI 2.8preview 9:1 hy4 [A先 AAAAB | B先 AAAAA]（跨分组浮动 1） → KIMI 2.8preview
- GLM5.3flash 6:4 KIMI 3.1pro [A先 ABAAB | B先 ABBAA] → GLM5.3flash
- step5preview 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro
- hy3 9:1 MiniMax M3.1flash [A先 ABAAA | B先 AAAAA]（跨分组浮动 1） → hy3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3 → KIMI 2.8preview → MIMO-v2.6-pro → GLM5.3 → deepseek v4pro → GLM5.3flash → hy3 → step5preview → hy4 → KIMI 3.1pro → MiniMax M3.1flash

- deepseek v4.1flash 3:7 KIMI 2.8preview [A先 BBBAA | B先 BBABB]（跨分组浮动 0.5） → KIMI 2.8preview
- MiniMax M3 7:3 MIMO-v2.6-pro [A先 AAAAA | B先 BABAB]（跨分组浮动 1） → MiniMax M3
- GLM5.3 4:6 deepseek v4pro [A先 BBBAB | B先 ABAAB]（跨分组浮动 0.5） → deepseek v4pro
- GLM5.3flash 4:6 hy3 [A先 AABBB | B先 BABBA] → hy3
- step5preview 1:9 hy4 [A先 BBBBB | B先 BBABB] → hy4
- KIMI 3.1pro 9:1 MiniMax M3.1flash [A先 AAAAA | B先 ABAAA]（跨分组浮动 1） → KIMI 3.1pro

## 第 4 届（种子 `swiss-2026-11-05:s4`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4pro | 4.5 | 32 | 64.00% | 4/1/0 | 15.5 | 13.5 |
| 2 | KIMI 2.8preview | 4 | 29 | 58.00% | 3/2/0 | 14.5 | 10.5 |
| 3 | deepseek v4.1flash | 3.5 | 33 | 66.00% | 3/1/1 | 15.5 | 9 |
| 4 | GLM5.3 | 3 | 32 | 64.00% | 3/0/2 | 12.5 | 6 |
| 5 | GLM5.3flash | 3 | 28 | 56.00% | 3/0/2 | 14.5 | 6.5 |
| 6 | MiniMax M3 | 2.5 | 31 | 62.00% | 2/1/2 | 9 | 2 |
| 7 | hy3 | 2.5 | 25 | 50.00% | 2/1/2 | 11 | 3 |
| 8 | MIMO-v2.6-pro | 2 | 27 | 54.00% | 2/0/3 | 15.5 | 4 |
| 9 | KIMI 3.1pro | 2 | 26 | 52.00% | 1/2/2 | 12.5 | 2.5 |
| 10 | hy4 | 2 | 24 | 48.00% | 2/0/3 | 10 | 1 |
| 11 | step5preview | 1 | 8 | 16.00% | 1/0/4 | 9.5 | 0 |
| 12 | MiniMax M3.1flash | 0 | 5 | 10.00% | 0/0/5 | 10 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4pro → MiniMax M3 → GLM5.3flash → KIMI 2.8preview → MIMO-v2.6-pro → KIMI 3.1pro → deepseek v4.1flash → MiniMax M3.1flash → hy3 → step5preview → hy4

- GLM5.3 3:7 deepseek v4pro [A先 BABAB | B先 BBABB] → deepseek v4pro
- MiniMax M3 3:7 GLM5.3flash [A先 BBBAA | B先 BABBB] → GLM5.3flash
- KIMI 2.8preview 6:4 MIMO-v2.6-pro [A先 BAABA | B先 BABAA] → KIMI 2.8preview
- KIMI 3.1pro 2:8 deepseek v4.1flash [A先 BBBAB | B先 ABBBB] → deepseek v4.1flash
- MiniMax M3.1flash 0:10 hy3 [A先 BBBBB | B先 BBBBB] → hy3
- step5preview 1:9 hy4 [A先 BBBAB | B先 BBBBB] → hy4

### 第 2 轮

同分随机排序后的配对顺序：hy3 → KIMI 2.8preview → deepseek v4.1flash → hy4 → GLM5.3flash → deepseek v4pro → MIMO-v2.6-pro → GLM5.3 → step5preview → MiniMax M3.1flash → KIMI 3.1pro → MiniMax M3

- hy3 3:7 KIMI 2.8preview [A先 ABBAB | B先 BBBBA] → KIMI 2.8preview
- deepseek v4.1flash 10:0 hy4 [A先 AAAAA | B先 AAAAA] → deepseek v4.1flash
- GLM5.3flash 3:7 deepseek v4pro [A先 ABBBB | B先 AABBB] → deepseek v4pro
- MIMO-v2.6-pro 6:4 GLM5.3 [A先 AABBB | B先 AABAA] → MIMO-v2.6-pro
- step5preview 7:3 MiniMax M3.1flash [A先 AAAAA | B先 BBAAB] → step5preview
- KIMI 3.1pro 5:5 MiniMax M3 [A先 BAAAB | B先 ABABB] → 平局

### 第 3 轮

同分随机排序后的配对顺序：KIMI 2.8preview → deepseek v4pro → deepseek v4.1flash → hy4 → GLM5.3flash → step5preview → hy3 → MIMO-v2.6-pro → MiniMax M3 → KIMI 3.1pro → GLM5.3 → MiniMax M3.1flash

- KIMI 2.8preview 5:5 deepseek v4pro [A先 BABAA | B先 AABBB] → 平局
- deepseek v4.1flash 7:3 GLM5.3flash [A先 AAABA | B先 BAAAB]（跨分组浮动 1） → deepseek v4.1flash
- hy4 4:6 hy3 [A先 ABBAB | B先 BBABA] → hy3
- step5preview 0:10 MIMO-v2.6-pro [A先 BBBBB | B先 BBBBB] → MIMO-v2.6-pro
- MiniMax M3 4:6 GLM5.3 [A先 BABAB | B先 BAABB]（跨分组浮动 0.5） → GLM5.3
- KIMI 3.1pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → deepseek v4pro → MIMO-v2.6-pro → hy3 → KIMI 3.1pro → hy4 → GLM5.3flash → step5preview → GLM5.3 → MiniMax M3 → MiniMax M3.1flash

- deepseek v4.1flash 5:5 KIMI 2.8preview [A先 BABAA | B先 BABAB]（跨分组浮动 0.5） → 平局
- deepseek v4pro 6:4 MIMO-v2.6-pro [A先 ABABA | B先 AAABB]（跨分组浮动 0.5） → deepseek v4pro
- hy3 5:5 KIMI 3.1pro [A先 AAABA | B先 BBBBA]（跨分组浮动 0.5） → 平局
- hy4 2:8 GLM5.3flash [A先 BBBBB | B先 ABBBA] → GLM5.3flash
- step5preview 0:10 GLM5.3 [A先 BBBBB | B先 BBBBB] → GLM5.3
- MiniMax M3 9:1 MiniMax M3.1flash [A先 BAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → KIMI 2.8preview → hy3 → KIMI 3.1pro → GLM5.3 → GLM5.3flash → MIMO-v2.6-pro → MiniMax M3 → hy4 → step5preview → MiniMax M3.1flash

- deepseek v4.1flash 3:7 deepseek v4pro [A先 BABAB | B先 BBBBA] → deepseek v4pro
- KIMI 2.8preview 6:4 KIMI 3.1pro [A先 AAABA | B先 BABAB]（跨分组浮动 1） → KIMI 2.8preview
- hy3 1:9 GLM5.3 [A先 BBBAB | B先 BBBBB]（跨分组浮动 0.5） → GLM5.3
- GLM5.3flash 7:3 MIMO-v2.6-pro [A先 BAAAA | B先 ABABA] → GLM5.3flash
- MiniMax M3 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3
- hy4 9:1 MiniMax M3.1flash [A先 BAAAA | B先 AAAAA]（跨分组浮动 1） → hy4

## 第 5 届（种子 `swiss-2026-11-05:s5`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 39 | 78.00% | 5/0/0 | 13.5 | 13.5 |
| 2 | KIMI 2.8preview | 3.5 | 32 | 64.00% | 3/1/1 | 11 | 6.75 |
| 3 | deepseek v4pro | 3 | 30 | 60.00% | 3/0/2 | 16 | 8 |
| 4 | MIMO-v2.6-pro | 3 | 24 | 48.00% | 2/2/1 | 15 | 7.5 |
| 5 | GLM5.3flash | 2.5 | 30 | 60.00% | 2/1/2 | 11 | 3.75 |
| 6 | KIMI 3.1pro | 2.5 | 30 | 60.00% | 2/1/2 | 8.5 | 2.25 |
| 7 | hy3 | 2.5 | 29 | 58.00% | 2/1/2 | 11.5 | 2.5 |
| 8 | GLM5.3 | 2.5 | 25 | 50.00% | 2/1/2 | 16.5 | 6.75 |
| 9 | MiniMax M3 | 2.5 | 22 | 44.00% | 2/1/2 | 16.5 | 6.5 |
| 10 | hy4 | 2 | 24 | 48.00% | 2/0/3 | 9.5 | 1 |
| 11 | MiniMax M3.1flash | 0.5 | 8 | 16.00% | 0/1/4 | 10 | 0.25 |
| 12 | step5preview | 0.5 | 7 | 14.00% | 0/1/4 | 11 | 0.25 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → GLM5.3flash → KIMI 3.1pro → GLM5.3 → step5preview → KIMI 2.8preview → deepseek v4pro → hy4 → deepseek v4.1flash → MiniMax M3

- hy3 5:5 MIMO-v2.6-pro [A先 AAAAB | B先 BBABB] → 平局
- MiniMax M3.1flash 0:10 GLM5.3flash [A先 BBBBB | B先 BBBBB] → GLM5.3flash
- KIMI 3.1pro 2:8 GLM5.3 [A先 BBBAB | B先 ABBBB] → GLM5.3
- step5preview 1:9 KIMI 2.8preview [A先 BBBBB | B先 BABBB] → KIMI 2.8preview
- deepseek v4pro 10:0 hy4 [A先 AAAAA | B先 AAAAA] → deepseek v4pro
- deepseek v4.1flash 9:1 MiniMax M3 [A先 AAAAA | B先 BAAAA] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：KIMI 2.8preview → deepseek v4pro → GLM5.3 → GLM5.3flash → deepseek v4.1flash → hy3 → MIMO-v2.6-pro → MiniMax M3 → MiniMax M3.1flash → KIMI 3.1pro → hy4 → step5preview

- KIMI 2.8preview 4:6 deepseek v4pro [A先 ABABA | B先 BBABB] → deepseek v4pro
- GLM5.3 7:3 GLM5.3flash [A先 ABAAA | B先 BAABA] → GLM5.3
- deepseek v4.1flash 7:3 hy3 [A先 BAAAA | B先 ABAAB]（跨分组浮动 0.5） → deepseek v4.1flash
- MIMO-v2.6-pro 5:5 MiniMax M3 [A先 BABBA | B先 ABABA]（跨分组浮动 0.5） → 平局
- MiniMax M3.1flash 0:10 KIMI 3.1pro [A先 BBBBB | B先 BBBBB] → KIMI 3.1pro
- hy4 9:1 step5preview [A先 BAAAA | B先 AAAAA] → hy4

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → GLM5.3 → KIMI 2.8preview → hy4 → MIMO-v2.6-pro → GLM5.3flash → KIMI 3.1pro → hy3 → MiniMax M3 → step5preview → MiniMax M3.1flash

- deepseek v4.1flash 6:4 deepseek v4pro [A先 AABAB | B先 AABBA] → deepseek v4.1flash
- GLM5.3 5:5 KIMI 2.8preview [A先 BABAB | B先 BABAA]（跨分组浮动 1） → 平局
- hy4 4:6 MIMO-v2.6-pro [A先 BABBB | B先 ABABA] → MIMO-v2.6-pro
- GLM5.3flash 5:5 KIMI 3.1pro [A先 BBAAB | B先 AABAB] → 平局
- hy3 3:7 MiniMax M3 [A先 AABBA | B先 BBBBB] → MiniMax M3
- step5preview 5:5 MiniMax M3.1flash [A先 AABBB | B先 ABABA] → 平局

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → MIMO-v2.6-pro → deepseek v4pro → GLM5.3flash → KIMI 2.8preview → MiniMax M3 → KIMI 3.1pro → hy4 → hy3 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 9:1 GLM5.3 [A先 AAABA | B先 AAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- MIMO-v2.6-pro 6:4 deepseek v4pro [A先 BBAAA | B先 ABBAA] → MIMO-v2.6-pro
- GLM5.3flash 4:6 KIMI 2.8preview [A先 BABBB | B先 BABAA] → KIMI 2.8preview
- MiniMax M3 7:3 KIMI 3.1pro [A先 ABAAA | B先 AABAB] → MiniMax M3
- hy4 9:1 MiniMax M3.1flash [A先 BAAAA | B先 AAAAA]（跨分组浮动 0.5） → hy4
- hy3 10:0 step5preview [A先 AAAAA | B先 AAAAA] → hy3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MIMO-v2.6-pro → KIMI 2.8preview → MiniMax M3 → GLM5.3 → deepseek v4pro → hy4 → hy3 → GLM5.3flash → KIMI 3.1pro → step5preview → MiniMax M3.1flash

- deepseek v4.1flash 8:2 MIMO-v2.6-pro [A先 AAAAA | B先 AABBA]（跨分组浮动 1） → deepseek v4.1flash
- KIMI 2.8preview 8:2 MiniMax M3 [A先 AAAAA | B先 BAABA] → KIMI 2.8preview
- GLM5.3 4:6 deepseek v4pro [A先 AABBA | B先 BBBBA]（跨分组浮动 0.5） → deepseek v4pro
- hy4 2:8 GLM5.3flash [A先 BBABA | B先 BBBBB]（跨分组浮动 0.5） → GLM5.3flash
- hy3 8:2 MiniMax M3.1flash [A先 AAAAA | B先 ABAAB]（跨分组浮动 1） → hy3
- KIMI 3.1pro 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → KIMI 3.1pro

## 第 6 届（种子 `swiss-2026-11-05:s6`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | GLM5.3 | 4.5 | 38 | 76.00% | 4/1/0 | 12 | 10 |
| 2 | deepseek v4.1flash | 4 | 34 | 68.00% | 3/2/0 | 15.5 | 11.75 |
| 3 | MiniMax M3 | 3 | 33 | 66.00% | 3/0/2 | 10 | 3.5 |
| 4 | MIMO-v2.6-pro | 3 | 32 | 64.00% | 3/0/2 | 12.5 | 5 |
| 5 | GLM5.3flash | 3 | 31 | 62.00% | 3/0/2 | 8.5 | 3.5 |
| 6 | KIMI 2.8preview | 3 | 27 | 54.00% | 2/2/1 | 17 | 9.25 |
| 7 | deepseek v4pro | 2.5 | 27 | 54.00% | 2/1/2 | 14.5 | 6 |
| 8 | hy3 | 2.5 | 26 | 52.00% | 2/1/2 | 11.5 | 3.75 |
| 9 | KIMI 3.1pro | 2 | 20 | 40.00% | 2/0/3 | 13 | 3 |
| 10 | hy4 | 1.5 | 19 | 38.00% | 1/1/3 | 12 | 2.25 |
| 11 | step5preview | 1 | 8 | 16.00% | 1/0/4 | 10 | 0 |
| 12 | MiniMax M3.1flash | 0 | 5 | 10.00% | 0/0/5 | 13.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：KIMI 3.1pro → MiniMax M3 → MiniMax M3.1flash → GLM5.3 → hy4 → deepseek v4pro → MIMO-v2.6-pro → step5preview → deepseek v4.1flash → hy3 → KIMI 2.8preview → GLM5.3flash

- KIMI 3.1pro 2:8 MiniMax M3 [A先 ABBBA | B先 BBBBB] → MiniMax M3
- MiniMax M3.1flash 0:10 GLM5.3 [A先 BBBBB | B先 BBBBB] → GLM5.3
- hy4 1:9 deepseek v4pro [A先 BBBBA | B先 BBBBB] → deepseek v4pro
- MIMO-v2.6-pro 10:0 step5preview [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro
- deepseek v4.1flash 9:1 hy3 [A先 AAAAA | B先 AAAAB] → deepseek v4.1flash
- KIMI 2.8preview 8:2 GLM5.3flash [A先 ABAAB | B先 AAAAA] → KIMI 2.8preview

### 第 2 轮

同分随机排序后的配对顺序：KIMI 2.8preview → MIMO-v2.6-pro → deepseek v4pro → MiniMax M3 → GLM5.3 → deepseek v4.1flash → GLM5.3flash → KIMI 3.1pro → hy4 → hy3 → step5preview → MiniMax M3.1flash

- KIMI 2.8preview 6:4 MIMO-v2.6-pro [A先 BBAAA | B先 BAABA] → KIMI 2.8preview
- deepseek v4pro 7:3 MiniMax M3 [A先 BAAAA | B先 AABBA] → deepseek v4pro
- GLM5.3 5:5 deepseek v4.1flash [A先 ABBAA | B先 BBABA] → 平局
- GLM5.3flash 3:7 KIMI 3.1pro [A先 ABABB | B先 ABBBB] → KIMI 3.1pro
- hy4 5:5 hy3 [A先 BABBB | B先 AABAA] → 平局
- step5preview 7:3 MiniMax M3.1flash [A先 BAAAA | B先 BAABA] → step5preview

### 第 3 轮

同分随机排序后的配对顺序：KIMI 2.8preview → deepseek v4pro → deepseek v4.1flash → GLM5.3 → MiniMax M3 → KIMI 3.1pro → MIMO-v2.6-pro → step5preview → hy3 → hy4 → GLM5.3flash → MiniMax M3.1flash

- KIMI 2.8preview 5:5 deepseek v4pro [A先 AAABB | B先 AABBB] → 平局
- deepseek v4.1flash 7:3 MiniMax M3 [A先 AABAA | B先 BAAAB]（跨分组浮动 0.5） → deepseek v4.1flash
- GLM5.3 9:1 KIMI 3.1pro [A先 AAAAA | B先 AAABA]（跨分组浮动 0.5） → GLM5.3
- MIMO-v2.6-pro 7:3 hy3 [A先 ABABA | B先 AABAA]（跨分组浮动 0.5） → MIMO-v2.6-pro
- step5preview 0:10 hy4 [A先 BBBBB | B先 BBBBB]（跨分组浮动 0.5） → hy4
- GLM5.3flash 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → GLM5.3flash

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → KIMI 2.8preview → deepseek v4pro → deepseek v4.1flash → MIMO-v2.6-pro → hy4 → GLM5.3flash → step5preview → KIMI 3.1pro → MiniMax M3 → hy3 → MiniMax M3.1flash

- GLM5.3 7:3 KIMI 2.8preview [A先 ABAAA | B先 ABABA] → GLM5.3
- deepseek v4pro 2:8 deepseek v4.1flash [A先 BABBB | B先 ABBBB] → deepseek v4.1flash
- MIMO-v2.6-pro 8:2 hy4 [A先 BAAAB | B先 AAAAA]（跨分组浮动 0.5） → MIMO-v2.6-pro
- GLM5.3flash 10:0 step5preview [A先 AAAAA | B先 AAAAA] → GLM5.3flash
- KIMI 3.1pro 2:8 hy3 [A先 ABBBB | B先 ABBBB]（跨分组浮动 0.5） → hy3
- MiniMax M3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MiniMax M3

### 第 5 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → MIMO-v2.6-pro → deepseek v4pro → KIMI 2.8preview → GLM5.3flash → MiniMax M3 → hy4 → hy3 → step5preview → KIMI 3.1pro → MiniMax M3.1flash

- GLM5.3 7:3 MIMO-v2.6-pro [A先 AABAB | B先 ABAAA]（跨分组浮动 0.5） → GLM5.3
- deepseek v4.1flash 5:5 KIMI 2.8preview [A先 ABABA | B先 ABABB]（跨分组浮动 1） → 平局
- deepseek v4pro 4:6 GLM5.3flash [A先 ABBAB | B先 ABBAB]（跨分组浮动 0.5） → GLM5.3flash
- MiniMax M3 9:1 hy4 [A先 AAAAA | B先 BAAAA]（跨分组浮动 0.5） → MiniMax M3
- hy3 9:1 step5preview [A先 AAAAA | B先 AAABA]（跨分组浮动 0.5） → hy3
- KIMI 3.1pro 8:2 MiniMax M3.1flash [A先 AABAA | B先 AAABA]（跨分组浮动 1） → KIMI 3.1pro

## 第 7 届（种子 `swiss-2026-11-05:s7`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 34 | 68.00% | 5/0/0 | 16 | 16 |
| 2 | GLM5.3 | 4 | 32 | 64.00% | 4/0/1 | 16 | 11 |
| 3 | MiniMax M3 | 3 | 31 | 62.00% | 3/0/2 | 14 | 6 |
| 4 | KIMI 2.8preview | 3 | 30 | 60.00% | 3/0/2 | 15 | 6 |
| 5 | deepseek v4pro | 3 | 30 | 60.00% | 3/0/2 | 13 | 4 |
| 6 | hy3 | 3 | 29 | 58.00% | 3/0/2 | 13 | 4 |
| 7 | MIMO-v2.6-pro | 2 | 28 | 56.00% | 2/0/3 | 13 | 3 |
| 8 | GLM5.3flash | 2 | 24 | 48.00% | 2/0/3 | 12 | 3 |
| 9 | KIMI 3.1pro | 2 | 24 | 48.00% | 2/0/3 | 9 | 2 |
| 10 | hy4 | 2 | 19 | 38.00% | 2/0/3 | 9 | 1 |
| 11 | step5preview | 1 | 11 | 22.00% | 1/0/4 | 9 | 0 |
| 12 | MiniMax M3.1flash | 0 | 8 | 16.00% | 0/0/5 | 11 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → deepseek v4.1flash → MiniMax M3.1flash → KIMI 3.1pro → hy4 → MiniMax M3 → KIMI 2.8preview → GLM5.3flash → deepseek v4pro → GLM5.3 → MIMO-v2.6-pro → step5preview

- hy3 3:7 deepseek v4.1flash [A先 BBBAA | B先 BBABB] → deepseek v4.1flash
- MiniMax M3.1flash 0:10 KIMI 3.1pro [A先 BBBBB | B先 BBBBB] → KIMI 3.1pro
- hy4 0:10 MiniMax M3 [A先 BBBBB | B先 BBBBB] → MiniMax M3
- KIMI 2.8preview 8:2 GLM5.3flash [A先 AAABA | B先 AAAAB] → KIMI 2.8preview
- deepseek v4pro 2:8 GLM5.3 [A先 ABBBB | B先 BBBBA] → GLM5.3
- MIMO-v2.6-pro 10:0 step5preview [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3 → MIMO-v2.6-pro → KIMI 3.1pro → KIMI 2.8preview → GLM5.3 → hy4 → step5preview → deepseek v4pro → GLM5.3flash → hy3 → MiniMax M3.1flash

- deepseek v4.1flash 7:3 MiniMax M3 [A先 BAABA | B先 AAAAB] → deepseek v4.1flash
- MIMO-v2.6-pro 9:1 KIMI 3.1pro [A先 AAABA | B先 AAAAA] → MIMO-v2.6-pro
- KIMI 2.8preview 4:6 GLM5.3 [A先 ABABB | B先 ABBAB] → GLM5.3
- hy4 9:1 step5preview [A先 BAAAA | B先 AAAAA] → hy4
- deepseek v4pro 6:4 GLM5.3flash [A先 ABBAA | B先 AAABB] → deepseek v4pro
- hy3 8:2 MiniMax M3.1flash [A先 AAAAB | B先 ABAAA] → hy3

### 第 3 轮

同分随机排序后的配对顺序：MIMO-v2.6-pro → GLM5.3 → deepseek v4.1flash → deepseek v4pro → KIMI 2.8preview → hy4 → MiniMax M3 → hy3 → KIMI 3.1pro → MiniMax M3.1flash → GLM5.3flash → step5preview

- MIMO-v2.6-pro 3:7 GLM5.3 [A先 BBBBA | B先 ABABB] → GLM5.3
- deepseek v4.1flash 6:4 deepseek v4pro [A先 ABBAA | B先 ABBAA]（跨分组浮动 1） → deepseek v4.1flash
- KIMI 2.8preview 9:1 hy4 [A先 AABAA | B先 AAAAA] → KIMI 2.8preview
- MiniMax M3 3:7 hy3 [A先 ABABB | B先 BABBB] → hy3
- KIMI 3.1pro 2:8 GLM5.3flash [A先 ABBBB | B先 BBABB]（跨分组浮动 1） → GLM5.3flash
- MiniMax M3.1flash 4:6 step5preview [A先 AABBB | B先 BBBAA] → step5preview

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → MIMO-v2.6-pro → KIMI 2.8preview → hy3 → step5preview → MiniMax M3 → hy4 → GLM5.3flash → deepseek v4pro → KIMI 3.1pro → MiniMax M3.1flash

- GLM5.3 3:7 deepseek v4.1flash [A先 BABBA | B先 BBABB] → deepseek v4.1flash
- MIMO-v2.6-pro 4:6 KIMI 2.8preview [A先 BBBAA | B先 BBBAA] → KIMI 2.8preview
- hy3 9:1 step5preview [A先 AAABA | B先 AAAAA]（跨分组浮动 1） → hy3
- MiniMax M3 7:3 GLM5.3flash [A先 AABAA | B先 AABAB] → MiniMax M3
- hy4 1:9 KIMI 3.1pro [A先 BBBAB | B先 BBBBB] → KIMI 3.1pro
- deepseek v4pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → deepseek v4pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy3 → KIMI 2.8preview → GLM5.3 → deepseek v4pro → KIMI 3.1pro → MIMO-v2.6-pro → MiniMax M3 → step5preview → hy4 → GLM5.3flash → MiniMax M3.1flash

- deepseek v4.1flash 7:3 KIMI 2.8preview [A先 ABAAB | B先 AABAA]（跨分组浮动 1） → deepseek v4.1flash
- hy3 2:8 GLM5.3 [A先 BBABB | B先 BBBBA] → GLM5.3
- deepseek v4pro 8:2 KIMI 3.1pro [A先 BAAAA | B先 AAABA] → deepseek v4pro
- MIMO-v2.6-pro 2:8 MiniMax M3 [A先 BABBB | B先 BBABB] → MiniMax M3
- step5preview 3:7 GLM5.3flash [A先 BBAAB | B先 BABBB] → GLM5.3flash
- hy4 8:2 MiniMax M3.1flash [A先 AAAAB | B先 AAAAB]（跨分组浮动 1） → hy4

## 第 8 届（种子 `swiss-2026-11-05:s8`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 4.5 | 32 | 64.00% | 4/1/0 | 13 | 11.5 |
| 2 | GLM5.3 | 3.5 | 34 | 68.00% | 3/1/1 | 13 | 8 |
| 3 | deepseek v4pro | 3.5 | 29 | 58.00% | 3/1/1 | 17 | 11 |
| 4 | KIMI 3.1pro | 3 | 32 | 64.00% | 2/2/1 | 9.5 | 3.75 |
| 5 | MiniMax M3 | 3 | 31 | 62.00% | 2/2/1 | 14.5 | 7 |
| 6 | KIMI 2.8preview | 3 | 31 | 62.00% | 3/0/2 | 14 | 6 |
| 7 | MIMO-v2.6-pro | 3 | 27 | 54.00% | 2/2/1 | 13 | 6.25 |
| 8 | hy3 | 2.5 | 30 | 60.00% | 2/1/2 | 12 | 2.5 |
| 9 | GLM5.3flash | 2 | 29 | 58.00% | 2/0/3 | 10 | 1 |
| 10 | hy4 | 1 | 12 | 24.00% | 1/0/4 | 12.5 | 0 |
| 11 | step5preview | 1 | 7 | 14.00% | 1/0/4 | 12 | 0 |
| 12 | MiniMax M3.1flash | 0 | 6 | 12.00% | 0/0/5 | 9.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：MiniMax M3 → hy4 → MiniMax M3.1flash → GLM5.3flash → MIMO-v2.6-pro → deepseek v4pro → GLM5.3 → step5preview → KIMI 2.8preview → KIMI 3.1pro → hy3 → deepseek v4.1flash

- MiniMax M3 9:1 hy4 [A先 AAAAB | B先 AAAAA] → MiniMax M3
- MiniMax M3.1flash 0:10 GLM5.3flash [A先 BBBBB | B先 BBBBB] → GLM5.3flash
- MIMO-v2.6-pro 1:9 deepseek v4pro [A先 BBABB | B先 BBBBB] → deepseek v4pro
- GLM5.3 10:0 step5preview [A先 AAAAA | B先 AAAAA] → GLM5.3
- KIMI 2.8preview 7:3 KIMI 3.1pro [A先 AAAAB | B先 BAAAB] → KIMI 2.8preview
- hy3 4:6 deepseek v4.1flash [A先 ABBAA | B先 BBABB] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：KIMI 2.8preview → GLM5.3flash → MiniMax M3 → deepseek v4.1flash → deepseek v4pro → GLM5.3 → MiniMax M3.1flash → hy4 → step5preview → MIMO-v2.6-pro → KIMI 3.1pro → hy3

- KIMI 2.8preview 6:4 GLM5.3flash [A先 AABBA | B先 ABABA] → KIMI 2.8preview
- MiniMax M3 5:5 deepseek v4.1flash [A先 BABAA | B先 ABABB] → 平局
- deepseek v4pro 6:4 GLM5.3 [A先 AABAA | B先 BAABB] → deepseek v4pro
- MiniMax M3.1flash 2:8 hy4 [A先 ABBAB | B先 BBBBB] → hy4
- step5preview 0:10 MIMO-v2.6-pro [A先 BBBBB | B先 BBBBB] → MIMO-v2.6-pro
- KIMI 3.1pro 5:5 hy3 [A先 BBAAA | B先 BABAB] → 平局

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → KIMI 2.8preview → deepseek v4.1flash → MiniMax M3 → hy4 → GLM5.3flash → GLM5.3 → MIMO-v2.6-pro → KIMI 3.1pro → hy3 → MiniMax M3.1flash → step5preview

- deepseek v4pro 6:4 KIMI 2.8preview [A先 AAABB | B先 ABBAA] → deepseek v4pro
- deepseek v4.1flash 8:2 hy4 [A先 AAAAB | B先 ABAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3 9:1 GLM5.3flash [A先 AAAAA | B先 BAAAA]（跨分组浮动 0.5） → MiniMax M3
- GLM5.3 5:5 MIMO-v2.6-pro [A先 BBAAA | B先 BBAAB] → 平局
- KIMI 3.1pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro
- hy3 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → hy3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4pro → MiniMax M3 → deepseek v4.1flash → KIMI 2.8preview → hy3 → KIMI 3.1pro → GLM5.3 → MIMO-v2.6-pro → hy4 → GLM5.3flash → step5preview → MiniMax M3.1flash

- deepseek v4pro 5:5 MiniMax M3 [A先 ABAAA | B先 BBABB]（跨分组浮动 0.5） → 平局
- deepseek v4.1flash 6:4 KIMI 2.8preview [A先 ABAAB | B先 ABBAA]（跨分组浮动 0.5） → deepseek v4.1flash
- hy3 2:8 GLM5.3 [A先 BABAB | B先 BBBBB] → GLM5.3
- KIMI 3.1pro 5:5 MIMO-v2.6-pro [A先 BAABA | B先 BBBAA] → 平局
- hy4 0:10 GLM5.3flash [A先 BBBBB | B先 BBBBB] → GLM5.3flash
- step5preview 7:3 MiniMax M3.1flash [A先 BBAAA | B先 AAABA] → step5preview

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → MiniMax M3 → GLM5.3 → MIMO-v2.6-pro → GLM5.3flash → KIMI 3.1pro → KIMI 2.8preview → hy3 → hy4 → step5preview → MiniMax M3.1flash

- deepseek v4.1flash 7:3 deepseek v4pro [A先 BAABA | B先 AAABA] → deepseek v4.1flash
- MiniMax M3 3:7 GLM5.3 [A先 BABAA | B先 BBBBB]（跨分组浮动 0.5） → GLM5.3
- MIMO-v2.6-pro 6:4 GLM5.3flash [A先 AAAAA | B先 BBBBA] → MIMO-v2.6-pro
- KIMI 3.1pro 9:1 hy4 [A先 AABAA | B先 AAAAA]（跨分组浮动 1） → KIMI 3.1pro
- KIMI 2.8preview 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → KIMI 2.8preview
- hy3 9:1 MiniMax M3.1flash [A先 AAABA | B先 AAAAA]（跨分组浮动 1.5） → hy3

## 第 9 届（种子 `swiss-2026-11-05:s9`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | GLM5.3 | 4.5 | 35 | 70.00% | 4/1/0 | 13.5 | 11.75 |
| 2 | KIMI 2.8preview | 3.5 | 34 | 68.00% | 3/1/1 | 14 | 7.75 |
| 3 | deepseek v4.1flash | 3.5 | 31 | 62.00% | 2/3/0 | 15 | 9.25 |
| 4 | deepseek v4pro | 3.5 | 30 | 60.00% | 3/1/1 | 14.5 | 8.25 |
| 5 | hy3 | 3 | 31 | 62.00% | 3/0/2 | 10 | 4.5 |
| 6 | GLM5.3flash | 3 | 29 | 58.00% | 3/0/2 | 12.5 | 4.5 |
| 7 | MIMO-v2.6-pro | 2.5 | 32 | 64.00% | 2/1/2 | 9.5 | 2.25 |
| 8 | MiniMax M3 | 2.5 | 30 | 60.00% | 2/1/2 | 12.5 | 4.25 |
| 9 | KIMI 3.1pro | 2 | 23 | 46.00% | 2/0/3 | 13 | 4 |
| 10 | hy4 | 1 | 11 | 22.00% | 1/0/4 | 12.5 | 0 |
| 11 | step5preview | 1 | 8 | 16.00% | 1/0/4 | 11 | 0 |
| 12 | MiniMax M3.1flash | 0 | 6 | 12.00% | 0/0/5 | 12 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → KIMI 3.1pro → GLM5.3flash → MIMO-v2.6-pro → deepseek v4.1flash → step5preview → GLM5.3 → MiniMax M3.1flash → KIMI 2.8preview → hy4 → deepseek v4pro → MiniMax M3

- hy3 4:6 KIMI 3.1pro [A先 BBAAA | B先 BBBAB] → KIMI 3.1pro
- GLM5.3flash 7:3 MIMO-v2.6-pro [A先 AABAA | B先 AAABB] → GLM5.3flash
- deepseek v4.1flash 10:0 step5preview [A先 AAAAA | B先 AAAAA] → deepseek v4.1flash
- GLM5.3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → GLM5.3
- KIMI 2.8preview 10:0 hy4 [A先 AAAAA | B先 AAAAA] → KIMI 2.8preview
- deepseek v4pro 6:4 MiniMax M3 [A先 AABAB | B先 AABAB] → deepseek v4pro

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → GLM5.3 → deepseek v4pro → GLM5.3flash → KIMI 3.1pro → hy4 → hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → step5preview → MiniMax M3

- deepseek v4.1flash 5:5 KIMI 2.8preview [A先 BBAAA | B先 ABBAB] → 平局
- GLM5.3 6:4 deepseek v4pro [A先 ABBAA | B先 BAABA] → GLM5.3
- GLM5.3flash 7:3 KIMI 3.1pro [A先 ABAAA | B先 BBAAA] → GLM5.3flash
- hy4 2:8 hy3 [A先 BABBB | B先 BBBAB] → hy3
- MIMO-v2.6-pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro
- step5preview 0:10 MiniMax M3 [A先 BBBBB | B先 BBBBB] → MiniMax M3

### 第 3 轮

同分随机排序后的配对顺序：GLM5.3flash → GLM5.3 → deepseek v4.1flash → KIMI 2.8preview → MiniMax M3 → KIMI 3.1pro → MIMO-v2.6-pro → hy3 → deepseek v4pro → hy4 → MiniMax M3.1flash → step5preview

- GLM5.3flash 3:7 GLM5.3 [A先 BABAB | B先 BBBAB] → GLM5.3
- deepseek v4.1flash 6:4 MiniMax M3 [A先 BAAAA | B先 BABAB]（跨分组浮动 0.5） → deepseek v4.1flash
- KIMI 2.8preview 9:1 KIMI 3.1pro [A先 AAAAA | B先 ABAAA]（跨分组浮动 0.5） → KIMI 2.8preview
- MIMO-v2.6-pro 4:6 hy3 [A先 BBAAA | B先 ABBBB] → hy3
- deepseek v4pro 9:1 hy4 [A先 AAAAA | B先 BAAAA]（跨分组浮动 1） → deepseek v4pro
- MiniMax M3.1flash 3:7 step5preview [A先 BBAAB | B先 BBABB] → step5preview

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → KIMI 2.8preview → GLM5.3flash → deepseek v4pro → hy3 → step5preview → MiniMax M3 → KIMI 3.1pro → MIMO-v2.6-pro → MiniMax M3.1flash → hy4

- GLM5.3 5:5 deepseek v4.1flash [A先 AABBA | B先 BBBAA]（跨分组浮动 0.5） → 平局
- KIMI 2.8preview 7:3 GLM5.3flash [A先 BAAAB | B先 BAAAA]（跨分组浮动 0.5） → KIMI 2.8preview
- deepseek v4pro 6:4 hy3 [A先 ABAAA | B先 BABAB] → deepseek v4pro
- step5preview 0:10 KIMI 3.1pro [A先 BBBBB | B先 BBBBB] → KIMI 3.1pro
- MiniMax M3 5:5 MIMO-v2.6-pro [A先 AAABA | B先 ABBBB] → 平局
- MiniMax M3.1flash 2:8 hy4 [A先 BBBBB | B先 ABBBA] → hy4

### 第 5 轮

同分随机排序后的配对顺序：GLM5.3 → KIMI 2.8preview → deepseek v4.1flash → deepseek v4pro → KIMI 3.1pro → hy3 → GLM5.3flash → MiniMax M3 → MIMO-v2.6-pro → step5preview → hy4 → MiniMax M3.1flash

- GLM5.3 7:3 KIMI 2.8preview [A先 BAAAA | B先 ABABA] → GLM5.3
- deepseek v4.1flash 5:5 deepseek v4pro [A先 ABBAB | B先 BBAAA] → 平局
- KIMI 3.1pro 3:7 MiniMax M3 [A先 ABBBB | B先 BBBAA]（跨分组浮动 0.5） → MiniMax M3
- hy3 9:1 step5preview [A先 AAAAA | B先 AAABA]（跨分组浮动 1） → hy3
- GLM5.3flash 9:1 MiniMax M3.1flash [A先 ABAAA | B先 AAAAA]（跨分组浮动 2） → GLM5.3flash
- MIMO-v2.6-pro 10:0 hy4 [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MIMO-v2.6-pro

## 第 10 届（种子 `swiss-2026-11-05:s10`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 4.5 | 34 | 68.00% | 4/1/0 | 15.5 | 14.25 |
| 2 | GLM5.3 | 3.5 | 32 | 64.00% | 3/1/1 | 13.5 | 7.25 |
| 3 | deepseek v4pro | 3.5 | 30 | 60.00% | 3/1/1 | 15.5 | 9.25 |
| 4 | GLM5.3flash | 3 | 30 | 60.00% | 3/0/2 | 12.5 | 5.5 |
| 5 | KIMI 2.8preview | 3 | 28 | 56.00% | 3/0/2 | 15 | 7.5 |
| 6 | MiniMax M3 | 3 | 27 | 54.00% | 3/0/2 | 12 | 4.5 |
| 7 | MIMO-v2.6-pro | 2.5 | 30 | 60.00% | 2/1/2 | 13.5 | 4.75 |
| 8 | hy3 | 2 | 29 | 58.00% | 2/0/3 | 12.5 | 2.5 |
| 9 | hy4 | 2 | 26 | 52.00% | 2/0/3 | 8 | 1 |
| 10 | KIMI 3.1pro | 2 | 23 | 46.00% | 2/0/3 | 11 | 2.5 |
| 11 | MiniMax M3.1flash | 0.5 | 6 | 12.00% | 0/1/4 | 11 | 0.25 |
| 12 | step5preview | 0.5 | 5 | 10.00% | 0/1/4 | 10 | 0.25 |

### 第 1 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → GLM5.3flash → step5preview → MIMO-v2.6-pro → KIMI 2.8preview → KIMI 3.1pro → hy4 → deepseek v4pro → hy3 → MiniMax M3 → MiniMax M3.1flash

- deepseek v4.1flash 7:3 GLM5.3 [A先 ABAAA | B先 BBAAA] → deepseek v4.1flash
- GLM5.3flash 10:0 step5preview [A先 AAAAA | B先 AAAAA] → GLM5.3flash
- MIMO-v2.6-pro 4:6 KIMI 2.8preview [A先 ABAAB | B先 BABBB] → KIMI 2.8preview
- KIMI 3.1pro 6:4 hy4 [A先 ABABB | B先 AABAA] → KIMI 3.1pro
- deepseek v4pro 7:3 hy3 [A先 AAABA | B先 BAABA] → deepseek v4pro
- MiniMax M3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → MiniMax M3

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → MiniMax M3 → KIMI 3.1pro → deepseek v4pro → GLM5.3flash → GLM5.3 → hy3 → hy4 → MiniMax M3.1flash → MIMO-v2.6-pro → step5preview

- deepseek v4.1flash 6:4 KIMI 2.8preview [A先 BAABB | B先 ABAAA] → deepseek v4.1flash
- MiniMax M3 9:1 KIMI 3.1pro [A先 AAAAA | B先 AABAA] → MiniMax M3
- deepseek v4pro 7:3 GLM5.3flash [A先 BAAAA | B先 AAABB] → deepseek v4pro
- GLM5.3 6:4 hy3 [A先 AAAAB | B先 BBAAB] → GLM5.3
- hy4 9:1 MiniMax M3.1flash [A先 AABAA | B先 AAAAA] → hy4
- MIMO-v2.6-pro 10:0 step5preview [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → deepseek v4.1flash → MiniMax M3 → KIMI 2.8preview → KIMI 3.1pro → MIMO-v2.6-pro → hy4 → GLM5.3flash → GLM5.3 → hy3 → MiniMax M3.1flash → step5preview

- deepseek v4pro 4:6 deepseek v4.1flash [A先 BBABA | B先 ABABB] → deepseek v4.1flash
- MiniMax M3 2:8 KIMI 2.8preview [A先 ABBBB | B先 BBBAB]（跨分组浮动 1） → KIMI 2.8preview
- KIMI 3.1pro 2:8 MIMO-v2.6-pro [A先 BBBBA | B先 ABBBB] → MIMO-v2.6-pro
- hy4 1:9 GLM5.3flash [A先 BBBBB | B先 BBABB] → GLM5.3flash
- GLM5.3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → GLM5.3
- hy3 10:0 step5preview [A先 AAAAA | B先 AAAAA] → hy3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3 → GLM5.3flash → GLM5.3 → MIMO-v2.6-pro → deepseek v4pro → KIMI 2.8preview → KIMI 3.1pro → hy3 → hy4 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 10:0 MiniMax M3 [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → deepseek v4.1flash
- GLM5.3flash 2:8 GLM5.3 [A先 BABBB | B先 BBBAB] → GLM5.3
- MIMO-v2.6-pro 3:7 deepseek v4pro [A先 BABBA | B先 BBBAB] → deepseek v4pro
- KIMI 2.8preview 6:4 KIMI 3.1pro [A先 AAAAA | B先 ABBBB]（跨分组浮动 1） → KIMI 2.8preview
- hy3 8:2 hy4 [A先 AABAA | B先 BAAAA] → hy3
- MiniMax M3.1flash 5:5 step5preview [A先 BBABA | B先 BAABA] → 平局

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → GLM5.3 → KIMI 2.8preview → MiniMax M3 → MIMO-v2.6-pro → GLM5.3flash → hy3 → hy4 → KIMI 3.1pro → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 5:5 MIMO-v2.6-pro [A先 AAABA | B先 BBBBA]（跨分组浮动 2） → 平局
- deepseek v4pro 5:5 GLM5.3 [A先 BABBA | B先 AABAB] → 平局
- KIMI 2.8preview 4:6 GLM5.3flash [A先 ABBAB | B先 AABBB]（跨分组浮动 1） → GLM5.3flash
- MiniMax M3 6:4 hy3 [A先 AAABA | B先 BAABB] → MiniMax M3
- hy4 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → hy4
- KIMI 3.1pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro

## 第 11 届（种子 `swiss-2026-11-05:s11`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 40 | 80.00% | 5/0/0 | 13 | 13 |
| 2 | deepseek v4pro | 4 | 32 | 64.00% | 4/0/1 | 14.5 | 9.5 |
| 3 | MiniMax M3 | 3 | 35 | 70.00% | 3/0/2 | 7 | 2 |
| 4 | KIMI 2.8preview | 3 | 29 | 58.00% | 3/0/2 | 15 | 6 |
| 5 | MIMO-v2.6-pro | 3 | 28 | 56.00% | 3/0/2 | 15.5 | 6.5 |
| 6 | GLM5.3 | 3 | 28 | 56.00% | 3/0/2 | 14 | 6 |
| 7 | hy3 | 2.5 | 29 | 58.00% | 2/1/2 | 12.5 | 4.25 |
| 8 | GLM5.3flash | 2.5 | 29 | 58.00% | 2/1/2 | 11.5 | 4.25 |
| 9 | KIMI 3.1pro | 2 | 25 | 50.00% | 2/0/3 | 11 | 3 |
| 10 | hy4 | 1 | 15 | 30.00% | 1/0/4 | 11 | 0 |
| 11 | step5preview | 1 | 6 | 12.00% | 1/0/4 | 13 | 0 |
| 12 | MiniMax M3.1flash | 0 | 4 | 8.00% | 0/0/5 | 12 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy4 → MIMO-v2.6-pro → MiniMax M3 → KIMI 2.8preview → deepseek v4.1flash → MiniMax M3.1flash → KIMI 3.1pro → GLM5.3flash → GLM5.3 → hy3 → step5preview → deepseek v4pro

- hy4 1:9 MIMO-v2.6-pro [A先 ABBBB | B先 BBBBB] → MIMO-v2.6-pro
- MiniMax M3 3:7 KIMI 2.8preview [A先 BBABB | B先 AABBB] → KIMI 2.8preview
- deepseek v4.1flash 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → deepseek v4.1flash
- KIMI 3.1pro 1:9 GLM5.3flash [A先 ABBBB | B先 BBBBB] → GLM5.3flash
- GLM5.3 6:4 hy3 [A先 BBAAA | B先 AAABB] → GLM5.3
- step5preview 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro

### 第 2 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → GLM5.3flash → MIMO-v2.6-pro → deepseek v4pro → KIMI 2.8preview → MiniMax M3.1flash → step5preview → KIMI 3.1pro → MiniMax M3 → hy4 → hy3

- GLM5.3 2:8 deepseek v4.1flash [A先 BBABB | B先 ABBBB] → deepseek v4.1flash
- GLM5.3flash 4:6 MIMO-v2.6-pro [A先 BBBAB | B先 AAABB] → MIMO-v2.6-pro
- deepseek v4pro 7:3 KIMI 2.8preview [A先 AABAA | B先 ABAAB] → deepseek v4pro
- MiniMax M3.1flash 4:6 step5preview [A先 BBABA | B先 ABABB] → step5preview
- KIMI 3.1pro 6:4 MiniMax M3 [A先 AABAB | B先 BBAAA] → KIMI 3.1pro
- hy4 0:10 hy3 [A先 BBBBB | B先 BBBBB] → hy3

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → MIMO-v2.6-pro → deepseek v4.1flash → KIMI 2.8preview → KIMI 3.1pro → hy3 → GLM5.3 → step5preview → GLM5.3flash → hy4 → MiniMax M3 → MiniMax M3.1flash

- deepseek v4pro 6:4 MIMO-v2.6-pro [A先 ABAAA | B先 AABBB] → deepseek v4pro
- deepseek v4.1flash 7:3 KIMI 2.8preview [A先 AAAAB | B先 BABAA]（跨分组浮动 1） → deepseek v4.1flash
- KIMI 3.1pro 4:6 hy3 [A先 ABBBA | B先 BBBAA] → hy3
- GLM5.3 10:0 step5preview [A先 AAAAA | B先 AAAAA] → GLM5.3
- GLM5.3flash 8:2 hy4 [A先 AABBA | B先 AAAAA]（跨分组浮动 1） → GLM5.3flash
- MiniMax M3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA] → MiniMax M3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4pro → deepseek v4.1flash → MIMO-v2.6-pro → GLM5.3 → GLM5.3flash → hy3 → MiniMax M3 → KIMI 2.8preview → step5preview → KIMI 3.1pro → MiniMax M3.1flash → hy4

- deepseek v4pro 3:7 deepseek v4.1flash [A先 BAABB | B先 BBBAB] → deepseek v4.1flash
- MIMO-v2.6-pro 7:3 GLM5.3 [A先 AAAAB | B先 AABAB] → MIMO-v2.6-pro
- GLM5.3flash 5:5 hy3 [A先 ABAAB | B先 BAABB] → 平局
- MiniMax M3 10:0 step5preview [A先 AAAAA | B先 AAAAA] → MiniMax M3
- KIMI 2.8preview 6:4 KIMI 3.1pro [A先 BAABA | B先 AABAB] → KIMI 2.8preview
- MiniMax M3.1flash 0:10 hy4 [A先 BBBBB | B先 BBBBB] → hy4

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MIMO-v2.6-pro → deepseek v4pro → hy3 → GLM5.3flash → GLM5.3 → MiniMax M3 → KIMI 2.8preview → hy4 → step5preview → KIMI 3.1pro → MiniMax M3.1flash

- deepseek v4.1flash 8:2 MIMO-v2.6-pro [A先 ABAAA | B先 AAABA]（跨分组浮动 1） → deepseek v4.1flash
- deepseek v4pro 6:4 hy3 [A先 BAABA | B先 BABAA]（跨分组浮动 0.5） → deepseek v4pro
- GLM5.3flash 3:7 GLM5.3 [A先 ABABB | B先 BBBBA]（跨分组浮动 0.5） → GLM5.3
- MiniMax M3 8:2 hy4 [A先 AAAAB | B先 AAAAB]（跨分组浮动 1） → MiniMax M3
- KIMI 2.8preview 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → KIMI 2.8preview
- KIMI 3.1pro 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → KIMI 3.1pro

## 第 12 届（种子 `swiss-2026-11-05:s12`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 4.5 | 34 | 68.00% | 4/1/0 | 14 | 11.75 |
| 2 | MiniMax M3 | 4.5 | 32 | 64.00% | 4/1/0 | 15 | 12.75 |
| 3 | MIMO-v2.6-pro | 3.5 | 33 | 66.00% | 3/1/1 | 8 | 4 |
| 4 | deepseek v4pro | 3 | 31 | 62.00% | 3/0/2 | 14 | 6.5 |
| 5 | GLM5.3 | 3 | 30 | 60.00% | 3/0/2 | 12 | 3 |
| 6 | KIMI 3.1pro | 3 | 28 | 56.00% | 3/0/2 | 11 | 4 |
| 7 | KIMI 2.8preview | 2.5 | 30 | 60.00% | 2/1/2 | 15 | 5 |
| 8 | hy3 | 2 | 30 | 60.00% | 2/0/3 | 9.5 | 1 |
| 9 | GLM5.3flash | 2 | 23 | 46.00% | 1/2/2 | 15.5 | 5 |
| 10 | hy4 | 1 | 15 | 30.00% | 1/0/4 | 14.5 | 1 |
| 11 | MiniMax M3.1flash | 1 | 8 | 16.00% | 1/0/4 | 9 | 0 |
| 12 | step5preview | 0 | 6 | 12.00% | 0/0/5 | 12.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：GLM5.3 → hy3 → MiniMax M3 → GLM5.3flash → deepseek v4.1flash → hy4 → MiniMax M3.1flash → deepseek v4pro → MIMO-v2.6-pro → step5preview → KIMI 3.1pro → KIMI 2.8preview

- GLM5.3 6:4 hy3 [A先 ABAAA | B先 ABABB] → GLM5.3
- MiniMax M3 7:3 GLM5.3flash [A先 AAAAA | B先 BAABB] → MiniMax M3
- deepseek v4.1flash 9:1 hy4 [A先 AAAAA | B先 AAABA] → deepseek v4.1flash
- MiniMax M3.1flash 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro
- MIMO-v2.6-pro 10:0 step5preview [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro
- KIMI 3.1pro 3:7 KIMI 2.8preview [A先 BBBAB | B先 BAABB] → KIMI 2.8preview

### 第 2 轮

同分随机排序后的配对顺序：KIMI 2.8preview → MiniMax M3 → deepseek v4.1flash → GLM5.3 → MIMO-v2.6-pro → deepseek v4pro → GLM5.3flash → hy3 → step5preview → KIMI 3.1pro → MiniMax M3.1flash → hy4

- KIMI 2.8preview 4:6 MiniMax M3 [A先 BBABB | B先 AABAB] → MiniMax M3
- deepseek v4.1flash 8:2 GLM5.3 [A先 BAAAA | B先 AABAA] → deepseek v4.1flash
- MIMO-v2.6-pro 4:6 deepseek v4pro [A先 BABAB | B先 BBBAA] → deepseek v4pro
- GLM5.3flash 7:3 hy3 [A先 ABBAA | B先 AABAA] → GLM5.3flash
- step5preview 1:9 KIMI 3.1pro [A先 ABBBB | B先 BBBBB] → KIMI 3.1pro
- MiniMax M3.1flash 0:10 hy4 [A先 BBBBB | B先 BBBBB] → hy4

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → deepseek v4.1flash → MiniMax M3 → GLM5.3 → MIMO-v2.6-pro → hy4 → KIMI 2.8preview → GLM5.3flash → KIMI 3.1pro → MiniMax M3.1flash → hy3 → step5preview

- deepseek v4pro 4:6 deepseek v4.1flash [A先 AABBB | B先 AABBB] → deepseek v4.1flash
- MiniMax M3 6:4 GLM5.3 [A先 BBAAA | B先 BABAA]（跨分组浮动 1） → MiniMax M3
- MIMO-v2.6-pro 8:2 hy4 [A先 BAABA | B先 AAAAA] → MIMO-v2.6-pro
- KIMI 2.8preview 5:5 GLM5.3flash [A先 ABABA | B先 ABBBA] → 平局
- KIMI 3.1pro 8:2 MiniMax M3.1flash [A先 AAABA | B先 ABAAA]（跨分组浮动 1） → KIMI 3.1pro
- hy3 9:1 step5preview [A先 AAABA | B先 AAAAA] → hy3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3 → deepseek v4pro → MIMO-v2.6-pro → KIMI 3.1pro → GLM5.3flash → KIMI 2.8preview → hy4 → hy3 → GLM5.3 → MiniMax M3.1flash → step5preview

- deepseek v4.1flash 5:5 MiniMax M3 [A先 BAAAB | B先 ABBBA] → 平局
- deepseek v4pro 4:6 KIMI 3.1pro [A先 ABABA | B先 BBBAB] → KIMI 3.1pro
- MIMO-v2.6-pro 5:5 GLM5.3flash [A先 AAABA | B先 ABBBB]（跨分组浮动 0.5） → 平局
- KIMI 2.8preview 10:0 hy4 [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 2.8preview
- hy3 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy3
- GLM5.3 10:0 step5preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → GLM5.3

### 第 5 轮

同分随机排序后的配对顺序：MiniMax M3 → deepseek v4.1flash → KIMI 3.1pro → KIMI 2.8preview → MIMO-v2.6-pro → hy3 → deepseek v4pro → GLM5.3flash → GLM5.3 → hy4 → MiniMax M3.1flash → step5preview

- MiniMax M3 8:2 KIMI 3.1pro [A先 BAAAB | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3
- deepseek v4.1flash 6:4 KIMI 2.8preview [A先 AABAB | B先 ABAAB]（跨分组浮动 1） → deepseek v4.1flash
- MIMO-v2.6-pro 6:4 hy3 [A先 ABAAB | B先 AAABB]（跨分组浮动 0.5） → MIMO-v2.6-pro
- deepseek v4pro 7:3 GLM5.3flash [A先 BAABA | B先 AAAAB] → deepseek v4pro
- GLM5.3 8:2 hy4 [A先 AAAAA | B先 AABBA]（跨分组浮动 1） → GLM5.3
- MiniMax M3.1flash 6:4 step5preview [A先 ABABB | B先 ABAAA] → MiniMax M3.1flash

## 逐局明细

完整逐局记录（含每局随机种子、先后手、胜者、回合数、终局权威）见 `refresh-20261109-swiss-core.json` 的 `seasons[].rounds[].pairs[].games`。
任一局可用该局种子与两个脚本 ID 通过 `MatchRunner` 原样复现。

## 复现命令

```bash
node src/tourney-cli.js --seed swiss-2026-11-05 --seasons 12 --rounds 5 --per-side 5 --sets core
```
