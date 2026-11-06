# 12 模型 AI 瑞士轮锦标赛报告

## 结论

**最强脚本：deepseek v4.1flash（事件选择与风险规避）**，脚本 `script:agent-deepseekv41flash.js`。共 12 届独立瑞士轮、每届 5 轮、每场 BO10（5 局先手 + 5 局后手），累计 600 局、胜 466 局，局胜率 77.67%，平均名次 1，夺冠 12/12 届，领先第二名 undefined 的局胜率 21.34 个百分点。

> 结论口径：聚合榜以**局胜率**为第一排序键（每场 BO10 的局分比场分样本更细），其次为累计场分、平均名次。单届名次用于瑞士轮配对，不作为跨届实力唯一依据。

## 置信度与先后手核对

| 项目 | 数值 |
|---|---|
| 冠军 deepseek v4.1flash 局胜率 95% CI（Wilson） | [74.16%, 80.82%] |
| 亚军 step5preview 局胜率 95% CI（Wilson） | [52.34%, 60.25%] |
| 冠亚局胜率差 | 21.34 个百分点 |
| 两比例近似 z 值 | 8.071（|z| ≥ 1.96 才达到 95% 显著） |
| 差异是否显著 | 是 |
| 先手方总胜率 | 55.22%（1988/3600 局） |
| 各届冠军分布 | deepseek v4.1flash × 12 |

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
| 1 | deepseek v4.1flash | 事件选择与风险规避 | 12/12 | 1 | 466/600 | 77.67% | 60 | 85.0% | 70.3% | 13.75 |
| 2 | step5preview | 直接入手牌与免费获得链 | 0/12 | 5.17 | 338/600 | 56.33% | 35.5 | 58.0% | 54.7% | 13.38 |
| 3 | MiniMax M3.1flash | 销毁初始牌与过牌效率 | 0/12 | 3.92 | 337/600 | 56.17% | 38 | 63.3% | 49.0% | 13.08 |
| 4 | hy4 | 血量差驱动攻防的中期经济 | 0/12 | 5.58 | 333/600 | 55.50% | 33 | 62.0% | 49.0% | 14.54 |
| 5 | MiniMax M3 | 经济曲线与高费牌估值 | 0/12 | 6.33 | 332/600 | 55.33% | 29 | 62.0% | 48.7% | 11.71 |
| 6 | GLM5.3 | 同盟链与阵营聚集 | 0/12 | 5.25 | 327/600 | 54.50% | 35.5 | 61.3% | 47.7% | 13.92 |
| 7 | deepseek v4pro | 2V2 共享权威与资源预留 | 0/12 | 5 | 323/600 | 53.83% | 34.5 | 60.3% | 47.3% | 14.08 |
| 8 | hy3 | 低费战斗与前哨突破 | 0/12 | 7.58 | 319/600 | 53.17% | 27.5 | 57.0% | 49.3% | 11.25 |
| 9 | KIMI 3.1pro | 动作评分加模式权重 | 0/12 | 6.92 | 314/600 | 52.33% | 30 | 58.3% | 46.3% | 12.46 |
| 10 | MIMO-v2.6-pro | 多模式自适应与对手血量估计 | 0/12 | 8.5 | 299/600 | 49.83% | 23 | 54.0% | 45.7% | 10.63 |
| 11 | KIMI 2.8preview | 前哨保护与拆塔节奏 | 0/12 | 10.75 | 180/600 | 30.00% | 14 | 35.0% | 25.0% | 10.46 |
| 12 | GLM5.3flash | 短回合高伤害与 lethal 搜索 | 0/12 | 12 | 32/600 | 5.33% | 0 | 6.3% | 4.3% | 10.75 |

## 第 1 届（种子 `swiss-2026-11-05:s1`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 36 | 72.00% | 5/0/0 | 13 | 13 |
| 2 | KIMI 3.1pro | 4 | 30 | 60.00% | 4/0/1 | 12.5 | 10 |
| 3 | MiniMax M3.1flash | 3 | 30 | 60.00% | 3/0/2 | 13 | 4 |
| 4 | step5preview | 3 | 28 | 56.00% | 3/0/2 | 13 | 6.5 |
| 5 | hy4 | 3 | 27 | 54.00% | 3/0/2 | 13.5 | 5.5 |
| 6 | MIMO-v2.6-pro | 2.5 | 26 | 52.00% | 2/1/2 | 16.5 | 6.25 |
| 7 | GLM5.3 | 2.5 | 26 | 52.00% | 2/1/2 | 14.5 | 5.25 |
| 8 | deepseek v4pro | 2 | 26 | 52.00% | 2/0/3 | 14.5 | 3.5 |
| 9 | KIMI 2.8preview | 2 | 18 | 36.00% | 2/0/3 | 9 | 1.5 |
| 10 | MiniMax M3 | 1.5 | 26 | 52.00% | 1/1/3 | 10.5 | 0.75 |
| 11 | hy3 | 1.5 | 26 | 52.00% | 1/1/3 | 9.5 | 0.75 |
| 12 | GLM5.3flash | 0 | 1 | 2.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：deepseek v4pro → hy4 → step5preview → MIMO-v2.6-pro → hy3 → KIMI 2.8preview → MiniMax M3 → KIMI 3.1pro → GLM5.3 → GLM5.3flash → deepseek v4.1flash → MiniMax M3.1flash

- deepseek v4pro 4:6 hy4 [A先 BBABA | B先 BABBA] → hy4
- step5preview 4:6 MIMO-v2.6-pro [A先 BBBAB | B先 ABBAA] → MIMO-v2.6-pro
- hy3 4:6 KIMI 2.8preview [A先 AAABB | B先 BBABB] → KIMI 2.8preview
- MiniMax M3 4:6 KIMI 3.1pro [A先 BBAAB | B先 BBBAA] → KIMI 3.1pro
- GLM5.3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → GLM5.3
- deepseek v4.1flash 8:2 MiniMax M3.1flash [A先 AAAAA | B先 BAAAB] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：MIMO-v2.6-pro → deepseek v4.1flash → KIMI 2.8preview → hy4 → KIMI 3.1pro → GLM5.3 → MiniMax M3 → deepseek v4pro → step5preview → hy3 → MiniMax M3.1flash → GLM5.3flash

- MIMO-v2.6-pro 3:7 deepseek v4.1flash [A先 BBAAB | B先 BBABB] → deepseek v4.1flash
- KIMI 2.8preview 3:7 hy4 [A先 BAABA | B先 BBBBB] → hy4
- KIMI 3.1pro 3:7 GLM5.3 [A先 BBBAB | B先 ABBAB] → GLM5.3
- MiniMax M3 4:6 deepseek v4pro [A先 AABAB | B先 BABBB] → deepseek v4pro
- step5preview 7:3 hy3 [A先 BABAB | B先 AAAAA] → step5preview
- MiniMax M3.1flash 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MiniMax M3.1flash

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → hy4 → step5preview → KIMI 2.8preview → deepseek v4pro → MIMO-v2.6-pro → KIMI 3.1pro → MiniMax M3.1flash → hy3 → MiniMax M3 → GLM5.3flash

- deepseek v4.1flash 8:2 GLM5.3 [A先 AAAAA | B先 BBAAA] → deepseek v4.1flash
- hy4 4:6 step5preview [A先 BBABB | B先 BABAA]（跨分组浮动 1） → step5preview
- KIMI 2.8preview 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro
- MIMO-v2.6-pro 2:8 KIMI 3.1pro [A先 BBAAB | B先 BBBBB] → KIMI 3.1pro
- MiniMax M3.1flash 6:4 hy3 [A先 AAAAA | B先 BBBBA]（跨分组浮动 1） → MiniMax M3.1flash
- MiniMax M3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MiniMax M3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → deepseek v4pro → MiniMax M3.1flash → step5preview → hy4 → KIMI 3.1pro → MiniMax M3 → MIMO-v2.6-pro → KIMI 2.8preview → hy3 → GLM5.3flash

- deepseek v4.1flash 6:4 deepseek v4pro [A先 ABABA | B先 ABAAB]（跨分组浮动 1） → deepseek v4.1flash
- GLM5.3 2:8 MiniMax M3.1flash [A先 BBABB | B先 BBBBA] → MiniMax M3.1flash
- step5preview 3:7 KIMI 3.1pro [A先 BABAB | B先 BBBBA] → KIMI 3.1pro
- hy4 7:3 MiniMax M3 [A先 AAAAA | B先 BABBA]（跨分组浮动 1） → hy4
- MIMO-v2.6-pro 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro
- hy3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → hy3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3.1flash → hy4 → KIMI 3.1pro → MIMO-v2.6-pro → GLM5.3 → step5preview → deepseek v4pro → hy3 → MiniMax M3 → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 7:3 hy4 [A先 AAAAB | B先 BBAAA]（跨分组浮动 1） → deepseek v4.1flash
- MiniMax M3.1flash 4:6 KIMI 3.1pro [A先 BABBA | B先 BBBAA] → KIMI 3.1pro
- MIMO-v2.6-pro 5:5 GLM5.3 [A先 BBAAA | B先 BABAB] → 平局
- step5preview 8:2 deepseek v4pro [A先 AAAAA | B先 BAAAB] → step5preview
- hy3 5:5 MiniMax M3 [A先 ABAAA | B先 BABBB] → 平局
- KIMI 2.8preview 9:1 GLM5.3flash [A先 AABAA | B先 AAAAA]（跨分组浮动 1） → KIMI 2.8preview

## 第 2 届（种子 `swiss-2026-11-05:s2`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 38 | 76.00% | 5/0/0 | 14 | 14 |
| 2 | hy4 | 3.5 | 29 | 58.00% | 3/1/1 | 14.5 | 7.75 |
| 3 | MiniMax M3.1flash | 3.5 | 26 | 52.00% | 3/1/1 | 15.5 | 8.75 |
| 4 | MiniMax M3 | 3 | 30 | 60.00% | 3/0/2 | 12.5 | 6 |
| 5 | GLM5.3 | 3 | 29 | 58.00% | 3/0/2 | 13.5 | 7 |
| 6 | step5preview | 3 | 29 | 58.00% | 3/0/2 | 13 | 5 |
| 7 | MIMO-v2.6-pro | 2 | 27 | 54.00% | 2/0/3 | 8 | 1 |
| 8 | hy3 | 2 | 25 | 50.00% | 2/0/3 | 11.5 | 2 |
| 9 | deepseek v4pro | 2 | 24 | 48.00% | 2/0/3 | 16 | 4 |
| 10 | KIMI 3.1pro | 2 | 24 | 48.00% | 2/0/3 | 11 | 1 |
| 11 | KIMI 2.8preview | 1 | 17 | 34.00% | 1/0/4 | 10.5 | 0 |
| 12 | GLM5.3flash | 0 | 2 | 4.00% | 0/0/5 | 10 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy4 → KIMI 2.8preview → hy3 → MIMO-v2.6-pro → GLM5.3 → MiniMax M3 → GLM5.3flash → step5preview → KIMI 3.1pro → deepseek v4.1flash → MiniMax M3.1flash → deepseek v4pro

- hy4 8:2 KIMI 2.8preview [A先 BAAAA | B先 BAAAA] → hy4
- hy3 6:4 MIMO-v2.6-pro [A先 AAABA | B先 ABABB] → hy3
- GLM5.3 7:3 MiniMax M3 [A先 ABABA | B先 AAABA] → GLM5.3
- GLM5.3flash 0:10 step5preview [A先 BBBBB | B先 BBBBB] → step5preview
- KIMI 3.1pro 2:8 deepseek v4.1flash [A先 BBBAB | B先 ABBBB] → deepseek v4.1flash
- MiniMax M3.1flash 6:4 deepseek v4pro [A先 AABBA | B先 ABAAB] → MiniMax M3.1flash

### 第 2 轮

同分随机排序后的配对顺序：step5preview → hy3 → hy4 → deepseek v4.1flash → MiniMax M3.1flash → GLM5.3 → MiniMax M3 → KIMI 2.8preview → KIMI 3.1pro → GLM5.3flash → MIMO-v2.6-pro → deepseek v4pro

- step5preview 6:4 hy3 [A先 AABAA | B先 BBBAA] → step5preview
- hy4 4:6 deepseek v4.1flash [A先 ABBBA | B先 ABBBA] → deepseek v4.1flash
- MiniMax M3.1flash 6:4 GLM5.3 [A先 ABAAA | B先 BBABA] → MiniMax M3.1flash
- MiniMax M3 9:1 KIMI 2.8preview [A先 AAAAA | B先 AAABA] → MiniMax M3
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → KIMI 3.1pro
- MIMO-v2.6-pro 3:7 deepseek v4pro [A先 BBBBA | B先 BBABA] → deepseek v4pro

### 第 3 轮

同分随机排序后的配对顺序：MiniMax M3.1flash → deepseek v4.1flash → step5preview → GLM5.3 → hy4 → MiniMax M3 → KIMI 3.1pro → deepseek v4pro → hy3 → GLM5.3flash → MIMO-v2.6-pro → KIMI 2.8preview

- MiniMax M3.1flash 1:9 deepseek v4.1flash [A先 BBBBB | B先 BBBAB] → deepseek v4.1flash
- step5preview 7:3 GLM5.3 [A先 AABAA | B先 BAABA]（跨分组浮动 1） → step5preview
- hy4 6:4 MiniMax M3 [A先 ABAAB | B先 ABABA] → hy4
- KIMI 3.1pro 3:7 deepseek v4pro [A先 BBBBA | B先 AABBB] → deepseek v4pro
- hy3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy3
- MIMO-v2.6-pro 7:3 KIMI 2.8preview [A先 ABABA | B先 AAAAB] → MIMO-v2.6-pro

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → step5preview → hy4 → deepseek v4pro → MiniMax M3.1flash → hy3 → MIMO-v2.6-pro → MiniMax M3 → GLM5.3 → KIMI 3.1pro → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 7:3 step5preview [A先 AAABA | B先 AAABB] → deepseek v4.1flash
- hy4 6:4 deepseek v4pro [A先 AABAB | B先 ABBAA] → hy4
- MiniMax M3.1flash 8:2 hy3 [A先 AAAAA | B先 ABABA] → MiniMax M3.1flash
- MIMO-v2.6-pro 3:7 MiniMax M3 [A先 AABBA | B先 BBBBB] → MiniMax M3
- GLM5.3 8:2 KIMI 3.1pro [A先 AABAA | B先 ABAAA] → GLM5.3
- KIMI 2.8preview 8:2 GLM5.3flash [A先 AABAA | B先 AAABA] → KIMI 2.8preview

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → MiniMax M3.1flash → step5preview → deepseek v4pro → MiniMax M3 → GLM5.3 → hy3 → MIMO-v2.6-pro → KIMI 3.1pro → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 8:2 deepseek v4pro [A先 AAAAA | B先 ABBAA]（跨分组浮动 2） → deepseek v4.1flash
- hy4 5:5 MiniMax M3.1flash [A先 ABAAA | B先 ABBBB] → 平局
- step5preview 3:7 MiniMax M3 [A先 ABBBA | B先 BABBB]（跨分组浮动 1） → MiniMax M3
- GLM5.3 7:3 hy3 [A先 BAABA | B先 AAAAB] → GLM5.3
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MIMO-v2.6-pro
- KIMI 3.1pro 7:3 KIMI 2.8preview [A先 AAAAA | B先 BAABB] → KIMI 3.1pro

## 第 3 届（种子 `swiss-2026-11-05:s3`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 39 | 78.00% | 5/0/0 | 13.5 | 13.5 |
| 2 | GLM5.3 | 4 | 31 | 62.00% | 4/0/1 | 13.5 | 8.5 |
| 3 | step5preview | 3.5 | 30 | 60.00% | 3/1/1 | 11.5 | 8.25 |
| 4 | deepseek v4pro | 3 | 28 | 56.00% | 3/0/2 | 11 | 4 |
| 5 | MiniMax M3.1flash | 3 | 25 | 50.00% | 3/0/2 | 12.5 | 5 |
| 6 | MiniMax M3 | 2.5 | 26 | 52.00% | 2/1/2 | 14.5 | 3.75 |
| 7 | hy3 | 2 | 29 | 58.00% | 2/0/3 | 9.5 | 2 |
| 8 | MIMO-v2.6-pro | 2 | 29 | 58.00% | 2/0/3 | 9.5 | 1 |
| 9 | hy4 | 2 | 25 | 50.00% | 2/0/3 | 16.5 | 4 |
| 10 | KIMI 3.1pro | 2 | 21 | 42.00% | 2/0/3 | 16.5 | 5.5 |
| 11 | KIMI 2.8preview | 1 | 15 | 30.00% | 1/0/4 | 11 | 0 |
| 12 | GLM5.3flash | 0 | 2 | 4.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：KIMI 3.1pro → step5preview → hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → GLM5.3 → GLM5.3flash → KIMI 2.8preview → deepseek v4.1flash → MiniMax M3 → hy4 → deepseek v4pro

- KIMI 3.1pro 6:4 step5preview [A先 BBAAA | B先 AAABB] → KIMI 3.1pro
- hy3 8:2 MIMO-v2.6-pro [A先 AAAAA | B先 AABAB] → hy3
- MiniMax M3.1flash 4:6 GLM5.3 [A先 ABABB | B先 BABAB] → GLM5.3
- GLM5.3flash 2:8 KIMI 2.8preview [A先 ABBBA | B先 BBBBB] → KIMI 2.8preview
- deepseek v4.1flash 7:3 MiniMax M3 [A先 BAAAA | B先 BAAAB] → deepseek v4.1flash
- hy4 6:4 deepseek v4pro [A先 AABAB | B先 AABAB] → hy4

### 第 2 轮

同分随机排序后的配对顺序：GLM5.3 → KIMI 2.8preview → hy3 → KIMI 3.1pro → deepseek v4.1flash → hy4 → deepseek v4pro → GLM5.3flash → MiniMax M3 → step5preview → MiniMax M3.1flash → MIMO-v2.6-pro

- GLM5.3 8:2 KIMI 2.8preview [A先 AAAAB | B先 ABAAA] → GLM5.3
- hy3 4:6 KIMI 3.1pro [A先 BBAAB | B先 BBBAA] → KIMI 3.1pro
- deepseek v4.1flash 7:3 hy4 [A先 BAABA | B先 BAAAA] → deepseek v4.1flash
- deepseek v4pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → deepseek v4pro
- MiniMax M3 5:5 step5preview [A先 BBABA | B先 BAAAB] → 平局
- MiniMax M3.1flash 7:3 MIMO-v2.6-pro [A先 ABABA | B先 AABAA] → MiniMax M3.1flash

### 第 3 轮

同分随机排序后的配对顺序：KIMI 3.1pro → deepseek v4.1flash → GLM5.3 → hy4 → hy3 → deepseek v4pro → KIMI 2.8preview → MiniMax M3.1flash → step5preview → MiniMax M3 → MIMO-v2.6-pro → GLM5.3flash

- KIMI 3.1pro 2:8 deepseek v4.1flash [A先 BBABB | B先 ABBBB] → deepseek v4.1flash
- GLM5.3 6:4 hy4 [A先 ABAAA | B先 BABAB]（跨分组浮动 1） → GLM5.3
- hy3 3:7 deepseek v4pro [A先 BAAAB | B先 BBBBB] → deepseek v4pro
- KIMI 2.8preview 3:7 MiniMax M3.1flash [A先 BBBAA | B先 ABBBB] → MiniMax M3.1flash
- step5preview 6:4 MIMO-v2.6-pro [A先 AABAA | B先 BABAB]（跨分组浮动 0.5） → step5preview
- MiniMax M3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → KIMI 3.1pro → deepseek v4pro → MiniMax M3.1flash → step5preview → MiniMax M3 → hy3 → KIMI 2.8preview → hy4 → MIMO-v2.6-pro → GLM5.3flash

- GLM5.3 3:7 deepseek v4.1flash [A先 BBBBB | B先 BABAA] → deepseek v4.1flash
- KIMI 3.1pro 3:7 deepseek v4pro [A先 BAABA | B先 BBBBB] → deepseek v4pro
- MiniMax M3.1flash 1:9 step5preview [A先 BBBBB | B先 BBABB]（跨分组浮动 0.5） → step5preview
- MiniMax M3 6:4 hy3 [A先 AABAB | B先 BAABA]（跨分组浮动 0.5） → MiniMax M3
- KIMI 2.8preview 2:8 hy4 [A先 BBAAB | B先 BBBBB] → hy4
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → GLM5.3 → MiniMax M3 → step5preview → KIMI 3.1pro → MiniMax M3.1flash → hy4 → KIMI 2.8preview → hy3 → MIMO-v2.6-pro → GLM5.3flash

- deepseek v4.1flash 10:0 deepseek v4pro [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → deepseek v4.1flash
- GLM5.3 8:2 MiniMax M3 [A先 AAAAA | B先 ABBAA]（跨分组浮动 0.5） → GLM5.3
- step5preview 6:4 hy4 [A先 BAAAA | B先 BBAAB]（跨分组浮动 0.5） → step5preview
- KIMI 3.1pro 4:6 MiniMax M3.1flash [A先 BBBAB | B先 BABAA] → MiniMax M3.1flash
- KIMI 2.8preview 0:10 MIMO-v2.6-pro [A先 BBBBB | B先 BBBBB] → MIMO-v2.6-pro
- hy3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy3

## 第 4 届（种子 `swiss-2026-11-05:s4`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 38 | 76.00% | 5/0/0 | 14.5 | 14.5 |
| 2 | MiniMax M3.1flash | 4 | 29 | 58.00% | 4/0/1 | 14.5 | 9.5 |
| 3 | deepseek v4pro | 3 | 30 | 60.00% | 3/0/2 | 13.5 | 6 |
| 4 | MiniMax M3 | 3 | 28 | 56.00% | 3/0/2 | 12 | 5 |
| 5 | KIMI 3.1pro | 2.5 | 28 | 56.00% | 2/1/2 | 11 | 2.25 |
| 6 | step5preview | 2.5 | 25 | 50.00% | 2/1/2 | 11 | 4.25 |
| 7 | hy4 | 2.5 | 23 | 46.00% | 2/1/2 | 15 | 5.75 |
| 8 | GLM5.3 | 2.5 | 22 | 44.00% | 2/1/2 | 17 | 6.75 |
| 9 | hy3 | 2 | 29 | 58.00% | 2/0/3 | 11 | 2 |
| 10 | KIMI 2.8preview | 2 | 21 | 42.00% | 2/0/3 | 10 | 1 |
| 11 | MIMO-v2.6-pro | 1 | 25 | 50.00% | 1/0/4 | 10 | 0 |
| 12 | GLM5.3flash | 0 | 2 | 4.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4pro → MiniMax M3 → GLM5.3flash → KIMI 2.8preview → MIMO-v2.6-pro → KIMI 3.1pro → deepseek v4.1flash → MiniMax M3.1flash → hy3 → step5preview → hy4

- GLM5.3 6:4 deepseek v4pro [A先 AABBA | B先 ABABA] → GLM5.3
- MiniMax M3 9:1 GLM5.3flash [A先 AAAAA | B先 ABAAA] → MiniMax M3
- KIMI 2.8preview 6:4 MIMO-v2.6-pro [A先 BABBA | B先 AABAA] → KIMI 2.8preview
- KIMI 3.1pro 3:7 deepseek v4.1flash [A先 BBAAB | B先 ABBBB] → deepseek v4.1flash
- MiniMax M3.1flash 7:3 hy3 [A先 BABAA | B先 ABAAA] → MiniMax M3.1flash
- step5preview 5:5 hy4 [A先 BAABB | B先 BAABA] → 平局

### 第 2 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → MiniMax M3.1flash → KIMI 2.8preview → MiniMax M3 → step5preview → hy4 → hy3 → GLM5.3flash → KIMI 3.1pro → MIMO-v2.6-pro → deepseek v4pro

- GLM5.3 2:8 deepseek v4.1flash [A先 BBBAB | B先 BBBBA] → deepseek v4.1flash
- MiniMax M3.1flash 7:3 KIMI 2.8preview [A先 AAAAB | B先 AAABB] → MiniMax M3.1flash
- MiniMax M3 6:4 step5preview [A先 BABBA | B先 AABAA]（跨分组浮动 0.5） → MiniMax M3
- hy4 7:3 hy3 [A先 ABBAA | B先 AAABA]（跨分组浮动 0.5） → hy4
- GLM5.3flash 0:10 KIMI 3.1pro [A先 BBBBB | B先 BBBBB] → KIMI 3.1pro
- MIMO-v2.6-pro 3:7 deepseek v4pro [A先 BBAAB | B先 BBBBA] → deepseek v4pro

### 第 3 轮

同分随机排序后的配对顺序：MiniMax M3.1flash → MiniMax M3 → deepseek v4.1flash → hy4 → deepseek v4pro → KIMI 2.8preview → GLM5.3 → KIMI 3.1pro → step5preview → MIMO-v2.6-pro → GLM5.3flash → hy3

- MiniMax M3.1flash 6:4 MiniMax M3 [A先 ABAAA | B先 ABABB] → MiniMax M3.1flash
- deepseek v4.1flash 9:1 hy4 [A先 ABAAA | B先 AAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- deepseek v4pro 8:2 KIMI 2.8preview [A先 AAAAA | B先 AABBA] → deepseek v4pro
- GLM5.3 5:5 KIMI 3.1pro [A先 ABBBA | B先 ABABA] → 平局
- step5preview 6:4 MIMO-v2.6-pro [A先 BBAAA | B先 BAABA]（跨分组浮动 0.5） → step5preview
- GLM5.3flash 0:10 hy3 [A先 BBBBB | B先 BBBBB] → hy3

### 第 4 轮

同分随机排序后的配对顺序：MiniMax M3.1flash → deepseek v4.1flash → MiniMax M3 → deepseek v4pro → hy4 → KIMI 3.1pro → step5preview → GLM5.3 → hy3 → KIMI 2.8preview → MIMO-v2.6-pro → GLM5.3flash

- MiniMax M3.1flash 2:8 deepseek v4.1flash [A先 ABABB | B先 BBBBB] → deepseek v4.1flash
- MiniMax M3 3:7 deepseek v4pro [A先 BBBAA | B先 BABBB] → deepseek v4pro
- hy4 6:4 KIMI 3.1pro [A先 BBAAA | B先 AAABB] → hy4
- step5preview 4:6 GLM5.3 [A先 BBBBA | B先 BBAAA] → GLM5.3
- hy3 9:1 KIMI 2.8preview [A先 ABAAA | B先 AAAAA] → hy3
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MIMO-v2.6-pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3.1flash → deepseek v4pro → GLM5.3 → hy4 → hy3 → MiniMax M3 → KIMI 3.1pro → step5preview → KIMI 2.8preview → MIMO-v2.6-pro → GLM5.3flash

- deepseek v4.1flash 6:4 deepseek v4pro [A先 AAABA | B先 AABBB]（跨分组浮动 1） → deepseek v4.1flash
- MiniMax M3.1flash 7:3 GLM5.3 [A先 ABBAA | B先 AAAAB]（跨分组浮动 0.5） → MiniMax M3.1flash
- hy4 4:6 MiniMax M3 [A先 AABBB | B先 AABBB]（跨分组浮动 0.5） → MiniMax M3
- hy3 4:6 step5preview [A先 BAABA | B先 BBBAB]（跨分组浮动 0.5） → step5preview
- KIMI 3.1pro 6:4 MIMO-v2.6-pro [A先 AAABA | B先 BABBA]（跨分组浮动 0.5） → KIMI 3.1pro
- KIMI 2.8preview 9:1 GLM5.3flash [A先 AAAAA | B先 AABAA]（跨分组浮动 1） → KIMI 2.8preview

## 第 5 届（种子 `swiss-2026-11-05:s5`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 39 | 78.00% | 5/0/0 | 12.5 | 12.5 |
| 2 | deepseek v4pro | 3.5 | 32 | 64.00% | 3/1/1 | 11.5 | 8.25 |
| 3 | MIMO-v2.6-pro | 3 | 30 | 60.00% | 2/2/1 | 8 | 3.5 |
| 4 | MiniMax M3.1flash | 3 | 29 | 58.00% | 3/0/2 | 12.5 | 4 |
| 5 | hy3 | 3 | 29 | 58.00% | 2/2/1 | 11 | 5.5 |
| 6 | MiniMax M3 | 3 | 25 | 50.00% | 3/0/2 | 13.5 | 5 |
| 7 | step5preview | 2.5 | 25 | 50.00% | 2/1/2 | 13.5 | 4.75 |
| 8 | GLM5.3 | 2 | 28 | 56.00% | 1/2/2 | 10.5 | 2.5 |
| 9 | hy4 | 2 | 24 | 48.00% | 2/0/3 | 17 | 6 |
| 10 | KIMI 3.1pro | 2 | 22 | 44.00% | 1/2/2 | 16 | 5.5 |
| 11 | KIMI 2.8preview | 1 | 12 | 24.00% | 1/0/4 | 12 | 0 |
| 12 | GLM5.3flash | 0 | 5 | 10.00% | 0/0/5 | 12 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → GLM5.3flash → KIMI 3.1pro → GLM5.3 → step5preview → KIMI 2.8preview → deepseek v4pro → hy4 → deepseek v4.1flash → MiniMax M3

- hy3 5:5 MIMO-v2.6-pro [A先 AABBA | B先 BABAB] → 平局
- MiniMax M3.1flash 9:1 GLM5.3flash [A先 AAAAA | B先 ABAAA] → MiniMax M3.1flash
- KIMI 3.1pro 5:5 GLM5.3 [A先 AABBA | B先 BAABB] → 平局
- step5preview 8:2 KIMI 2.8preview [A先 AAABA | B先 BAAAA] → step5preview
- deepseek v4pro 3:7 hy4 [A先 BBBAB | B先 BBAAB] → hy4
- deepseek v4.1flash 10:0 MiniMax M3 [A先 AAAAA | B先 AAAAA] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3.1flash → hy4 → step5preview → hy3 → MIMO-v2.6-pro → KIMI 3.1pro → GLM5.3 → KIMI 2.8preview → deepseek v4pro → MiniMax M3 → GLM5.3flash

- deepseek v4.1flash 7:3 MiniMax M3.1flash [A先 AAAAA | B先 ABABB] → deepseek v4.1flash
- hy4 6:4 step5preview [A先 AAABB | B先 AAABB] → hy4
- hy3 5:5 KIMI 3.1pro [A先 BBABA | B先 ABAAB] → 平局
- MIMO-v2.6-pro 5:5 GLM5.3 [A先 BAAAB | B先 BBBAA] → 平局
- KIMI 2.8preview 0:10 deepseek v4pro [A先 BBBBB | B先 BBBBB] → deepseek v4pro
- MiniMax M3 9:1 GLM5.3flash [A先 AAAAA | B先 AAAAB] → MiniMax M3

### 第 3 轮

同分随机排序后的配对顺序：hy4 → deepseek v4.1flash → hy3 → MiniMax M3 → step5preview → deepseek v4pro → MIMO-v2.6-pro → GLM5.3 → KIMI 3.1pro → MiniMax M3.1flash → KIMI 2.8preview → GLM5.3flash

- hy4 4:6 deepseek v4.1flash [A先 AAABA | B先 BBBBB] → deepseek v4.1flash
- hy3 4:6 MiniMax M3 [A先 AABAA | B先 BBBBB] → MiniMax M3
- step5preview 5:5 deepseek v4pro [A先 BAAAB | B先 BABBA] → 平局
- MIMO-v2.6-pro 2:8 KIMI 3.1pro [A先 ABABB | B先 BBBBB] → KIMI 3.1pro
- GLM5.3 4:6 MiniMax M3.1flash [A先 AAABB | B先 ABBBB] → MiniMax M3.1flash
- KIMI 2.8preview 7:3 GLM5.3flash [A先 ABBAA | B先 ABAAA] → KIMI 2.8preview

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 3.1pro → hy4 → MiniMax M3.1flash → MiniMax M3 → deepseek v4pro → step5preview → GLM5.3 → hy3 → MIMO-v2.6-pro → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 8:2 KIMI 3.1pro [A先 ABAAA | B先 AAAAB]（跨分组浮动 1） → deepseek v4.1flash
- hy4 3:7 MiniMax M3.1flash [A先 BBBAA | B先 BBBBA] → MiniMax M3.1flash
- MiniMax M3 2:8 deepseek v4pro [A先 ABBBB | B先 BABBB]（跨分组浮动 0.5） → deepseek v4pro
- step5preview 6:4 GLM5.3 [A先 BAABA | B先 ABBAA]（跨分组浮动 0.5） → step5preview
- hy3 9:1 KIMI 2.8preview [A先 AAAAA | B先 BAAAA] → hy3
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MIMO-v2.6-pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MiniMax M3.1flash → step5preview → deepseek v4pro → hy3 → hy4 → MiniMax M3 → KIMI 3.1pro → MIMO-v2.6-pro → KIMI 2.8preview → GLM5.3 → GLM5.3flash

- deepseek v4.1flash 8:2 step5preview [A先 BAAAA | B先 AAABA]（跨分组浮动 1.5） → deepseek v4.1flash
- MiniMax M3.1flash 4:6 deepseek v4pro [A先 BAAAB | B先 BBBAB]（跨分组浮动 0.5） → deepseek v4pro
- hy3 6:4 hy4 [A先 BBBBA | B先 AAAAA] → hy3
- MiniMax M3 8:2 KIMI 3.1pro [A先 ABAAA | B先 AABAA] → MiniMax M3
- MIMO-v2.6-pro 8:2 KIMI 2.8preview [A先 AAABA | B先 AAAAB]（跨分组浮动 1） → MIMO-v2.6-pro
- GLM5.3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → GLM5.3

## 第 6 届（种子 `swiss-2026-11-05:s6`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 43 | 86.00% | 5/0/0 | 13 | 13 |
| 2 | MiniMax M3.1flash | 4 | 34 | 68.00% | 4/0/1 | 12 | 8.5 |
| 3 | GLM5.3 | 3.5 | 26 | 52.00% | 3/1/1 | 17.5 | 11.25 |
| 4 | hy4 | 3 | 34 | 68.00% | 3/0/2 | 9.5 | 3 |
| 5 | hy3 | 3 | 29 | 58.00% | 3/0/2 | 11.5 | 3 |
| 6 | step5preview | 3 | 27 | 54.00% | 3/0/2 | 16 | 7 |
| 7 | KIMI 3.1pro | 2.5 | 23 | 46.00% | 2/1/2 | 14.5 | 3.75 |
| 8 | deepseek v4pro | 2 | 24 | 48.00% | 2/0/3 | 13 | 3 |
| 9 | MIMO-v2.6-pro | 2 | 19 | 38.00% | 2/0/3 | 9 | 1 |
| 10 | MiniMax M3 | 1 | 23 | 46.00% | 1/0/4 | 11.5 | 0 |
| 11 | KIMI 2.8preview | 1 | 14 | 28.00% | 1/0/4 | 12.5 | 0 |
| 12 | GLM5.3flash | 0 | 4 | 8.00% | 0/0/5 | 10 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：KIMI 3.1pro → MiniMax M3 → MiniMax M3.1flash → GLM5.3 → hy4 → deepseek v4pro → MIMO-v2.6-pro → step5preview → deepseek v4.1flash → hy3 → KIMI 2.8preview → GLM5.3flash

- KIMI 3.1pro 6:4 MiniMax M3 [A先 BBBAA | B先 AAABA] → KIMI 3.1pro
- MiniMax M3.1flash 4:6 GLM5.3 [A先 ABBBA | B先 ABBBA] → GLM5.3
- hy4 7:3 deepseek v4pro [A先 AABAA | B先 AABBA] → hy4
- MIMO-v2.6-pro 1:9 step5preview [A先 BBBBB | B先 BABBB] → step5preview
- deepseek v4.1flash 8:2 hy3 [A先 AAAAB | B先 AAAAB] → deepseek v4.1flash
- KIMI 2.8preview 8:2 GLM5.3flash [A先 AAAAA | B先 BBAAA] → KIMI 2.8preview

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → step5preview → KIMI 2.8preview → KIMI 3.1pro → GLM5.3 → hy4 → MiniMax M3 → MiniMax M3.1flash → GLM5.3flash → hy3 → MIMO-v2.6-pro → deepseek v4pro

- deepseek v4.1flash 7:3 step5preview [A先 BAAAA | B先 ABAAB] → deepseek v4.1flash
- KIMI 2.8preview 2:8 KIMI 3.1pro [A先 BABBA | B先 BBBBB] → KIMI 3.1pro
- GLM5.3 6:4 hy4 [A先 ABABA | B先 ABBAA] → GLM5.3
- MiniMax M3 1:9 MiniMax M3.1flash [A先 BABBB | B先 BBBBB] → MiniMax M3.1flash
- GLM5.3flash 0:10 hy3 [A先 BBBBB | B先 BBBBB] → hy3
- MIMO-v2.6-pro 3:7 deepseek v4pro [A先 BAAAB | B先 BBBBB] → deepseek v4pro

### 第 3 轮

同分随机排序后的配对顺序：GLM5.3 → KIMI 3.1pro → deepseek v4.1flash → KIMI 2.8preview → MiniMax M3.1flash → deepseek v4pro → hy4 → step5preview → hy3 → MiniMax M3 → MIMO-v2.6-pro → GLM5.3flash

- GLM5.3 5:5 KIMI 3.1pro [A先 AAABA | B先 BABBB] → 平局
- deepseek v4.1flash 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → deepseek v4.1flash
- MiniMax M3.1flash 6:4 deepseek v4pro [A先 ABAAB | B先 BABAA] → MiniMax M3.1flash
- hy4 3:7 step5preview [A先 BBABA | B先 BBBAB] → step5preview
- hy3 6:4 MiniMax M3 [A先 BBAAA | B先 BAAAB]（跨分组浮动 1） → hy3
- MIMO-v2.6-pro 8:2 GLM5.3flash [A先 AAAAB | B先 AAABA] → MIMO-v2.6-pro

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 3.1pro → GLM5.3 → hy3 → step5preview → MiniMax M3.1flash → KIMI 2.8preview → MIMO-v2.6-pro → hy4 → deepseek v4pro → GLM5.3flash → MiniMax M3

- deepseek v4.1flash 9:1 KIMI 3.1pro [A先 AAAAA | B先 AAAAB]（跨分组浮动 0.5） → deepseek v4.1flash
- GLM5.3 8:2 hy3 [A先 ABAAA | B先 ABAAA]（跨分组浮动 0.5） → GLM5.3
- step5preview 2:8 MiniMax M3.1flash [A先 ABBBB | B先 BABBB] → MiniMax M3.1flash
- KIMI 2.8preview 4:6 MIMO-v2.6-pro [A先 BAABA | B先 ABBBB] → MIMO-v2.6-pro
- hy4 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy4
- deepseek v4pro 6:4 MiniMax M3 [A先 ABAAA | B先 BBAAB]（跨分组浮动 1） → deepseek v4pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → MiniMax M3.1flash → KIMI 3.1pro → deepseek v4pro → step5preview → hy3 → MIMO-v2.6-pro → hy4 → KIMI 2.8preview → GLM5.3flash → MiniMax M3

- deepseek v4.1flash 9:1 GLM5.3 [A先 AABAA | B先 AAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3.1flash 7:3 KIMI 3.1pro [A先 AABBB | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3.1flash
- deepseek v4pro 4:6 step5preview [A先 BBBAA | B先 BABAB] → step5preview
- hy3 9:1 MIMO-v2.6-pro [A先 BAAAA | B先 AAAAA] → hy3
- hy4 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy4
- GLM5.3flash 0:10 MiniMax M3 [A先 BBBBB | B先 BBBBB] → MiniMax M3

## 第 7 届（种子 `swiss-2026-11-05:s7`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 46 | 92.00% | 5/0/0 | 13 | 13 |
| 2 | hy4 | 3.5 | 25 | 50.00% | 3/1/1 | 15.5 | 9 |
| 3 | MiniMax M3.1flash | 3 | 28 | 56.00% | 2/2/1 | 14 | 6 |
| 4 | step5preview | 3 | 28 | 56.00% | 3/0/2 | 12.5 | 6.5 |
| 5 | GLM5.3 | 3 | 28 | 56.00% | 3/0/2 | 11 | 5 |
| 6 | deepseek v4pro | 3 | 23 | 46.00% | 3/0/2 | 16.5 | 8 |
| 7 | KIMI 3.1pro | 2.5 | 29 | 58.00% | 1/3/1 | 10.5 | 3.5 |
| 8 | hy3 | 2.5 | 24 | 48.00% | 2/1/2 | 11.5 | 2.25 |
| 9 | MiniMax M3 | 2 | 26 | 52.00% | 2/0/3 | 12 | 2.5 |
| 10 | MIMO-v2.6-pro | 1.5 | 22 | 44.00% | 1/1/3 | 10.5 | 1.25 |
| 11 | KIMI 2.8preview | 1 | 17 | 34.00% | 1/0/4 | 12.5 | 0 |
| 12 | GLM5.3flash | 0 | 4 | 8.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → deepseek v4.1flash → MiniMax M3.1flash → KIMI 3.1pro → hy4 → MiniMax M3 → KIMI 2.8preview → GLM5.3flash → deepseek v4pro → GLM5.3 → MIMO-v2.6-pro → step5preview

- hy3 0:10 deepseek v4.1flash [A先 BBBBB | B先 BBBBB] → deepseek v4.1flash
- MiniMax M3.1flash 5:5 KIMI 3.1pro [A先 AABBA | B先 BBABA] → 平局
- hy4 6:4 MiniMax M3 [A先 AAABA | B先 BABBA] → hy4
- KIMI 2.8preview 6:4 GLM5.3flash [A先 AAAAB | B先 ABBAB] → KIMI 2.8preview
- deepseek v4pro 6:4 GLM5.3 [A先 BAAAB | B先 AABBA] → deepseek v4pro
- MIMO-v2.6-pro 2:8 step5preview [A先 BBABB | B先 ABBBB] → step5preview

### 第 2 轮

同分随机排序后的配对顺序：deepseek v4.1flash → KIMI 2.8preview → step5preview → deepseek v4pro → hy4 → KIMI 3.1pro → MiniMax M3.1flash → GLM5.3flash → MiniMax M3 → MIMO-v2.6-pro → GLM5.3 → hy3

- deepseek v4.1flash 9:1 KIMI 2.8preview [A先 AAABA | B先 AAAAA] → deepseek v4.1flash
- step5preview 4:6 deepseek v4pro [A先 BBBBA | B先 ABBAA] → deepseek v4pro
- hy4 6:4 KIMI 3.1pro [A先 AAABA | B先 BABBA]（跨分组浮动 0.5） → hy4
- MiniMax M3.1flash 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3.1flash
- MiniMax M3 7:3 MIMO-v2.6-pro [A先 AABAB | B先 ABAAA] → MiniMax M3
- GLM5.3 7:3 hy3 [A先 AABAA | B先 BABAA] → GLM5.3

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → hy4 → deepseek v4.1flash → MiniMax M3.1flash → KIMI 2.8preview → MiniMax M3 → step5preview → GLM5.3 → KIMI 3.1pro → MIMO-v2.6-pro → GLM5.3flash → hy3

- deepseek v4pro 4:6 hy4 [A先 ABBBA | B先 ABABB] → hy4
- deepseek v4.1flash 10:0 MiniMax M3.1flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- KIMI 2.8preview 2:8 MiniMax M3 [A先 BBBBA | B先 BBBAB] → MiniMax M3
- step5preview 7:3 GLM5.3 [A先 AAABA | B先 AABBA] → step5preview
- KIMI 3.1pro 5:5 MIMO-v2.6-pro [A先 ABABB | B先 ABBAA]（跨分组浮动 0.5） → 平局
- GLM5.3flash 0:10 hy3 [A先 BBBBB | B先 BBBBB] → hy3

### 第 4 轮

同分随机排序后的配对顺序：hy4 → deepseek v4.1flash → MiniMax M3 → deepseek v4pro → step5preview → MiniMax M3.1flash → GLM5.3 → hy3 → KIMI 2.8preview → KIMI 3.1pro → MIMO-v2.6-pro → GLM5.3flash

- hy4 2:8 deepseek v4.1flash [A先 BAABB | B先 BBBBB] → deepseek v4.1flash
- MiniMax M3 4:6 deepseek v4pro [A先 BBBAA | B先 BBBAA] → deepseek v4pro
- step5preview 2:8 MiniMax M3.1flash [A先 BBABB | B先 BABBB]（跨分组浮动 0.5） → MiniMax M3.1flash
- GLM5.3 6:4 KIMI 2.8preview [A先 AAABA | B先 BBAAB] → GLM5.3
- hy3 5:5 KIMI 3.1pro [A先 BABAA | B先 BAABB] → 平局
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MIMO-v2.6-pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → deepseek v4pro → MiniMax M3.1flash → MiniMax M3 → step5preview → GLM5.3 → MIMO-v2.6-pro → hy3 → KIMI 3.1pro → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 9:1 deepseek v4pro [A先 AAAAA | B先 AAAAB]（跨分组浮动 1） → deepseek v4.1flash
- hy4 5:5 MiniMax M3.1flash [A先 ABABA | B先 BABBA]（跨分组浮动 0.5） → 平局
- MiniMax M3 3:7 step5preview [A先 BBBBB | B先 BBAAA] → step5preview
- GLM5.3 8:2 MIMO-v2.6-pro [A先 AAAAA | B先 BAAAB]（跨分组浮动 0.5） → GLM5.3
- hy3 6:4 KIMI 2.8preview [A先 BABAA | B先 ABAAB]（跨分组浮动 0.5） → hy3
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1.5） → KIMI 3.1pro

## 第 8 届（种子 `swiss-2026-11-05:s8`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 36 | 72.00% | 5/0/0 | 15 | 15 |
| 2 | GLM5.3 | 4 | 31 | 62.00% | 4/0/1 | 15 | 10 |
| 3 | step5preview | 3 | 28 | 56.00% | 3/0/2 | 14.5 | 5.5 |
| 4 | deepseek v4pro | 3 | 26 | 52.00% | 2/2/1 | 14.5 | 7 |
| 5 | MiniMax M3.1flash | 2.5 | 31 | 62.00% | 2/1/2 | 10.5 | 3.5 |
| 6 | KIMI 3.1pro | 2.5 | 27 | 54.00% | 2/1/2 | 13 | 2.5 |
| 7 | MiniMax M3 | 2.5 | 27 | 54.00% | 2/1/2 | 11 | 3.5 |
| 8 | hy3 | 2.5 | 22 | 44.00% | 2/1/2 | 12.5 | 4 |
| 9 | MIMO-v2.6-pro | 2 | 29 | 58.00% | 2/0/3 | 9 | 1 |
| 10 | hy4 | 2 | 27 | 54.00% | 1/2/2 | 14.5 | 5 |
| 11 | KIMI 2.8preview | 1 | 15 | 30.00% | 1/0/4 | 10 | 0 |
| 12 | GLM5.3flash | 0 | 1 | 2.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：MiniMax M3 → hy4 → MiniMax M3.1flash → GLM5.3flash → MIMO-v2.6-pro → deepseek v4pro → GLM5.3 → step5preview → KIMI 2.8preview → KIMI 3.1pro → hy3 → deepseek v4.1flash

- MiniMax M3 1:9 hy4 [A先 BBBBA | B先 BBBBB] → hy4
- MiniMax M3.1flash 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MiniMax M3.1flash
- MIMO-v2.6-pro 3:7 deepseek v4pro [A先 BBBBA | B先 ABBAB] → deepseek v4pro
- GLM5.3 6:4 step5preview [A先 ABAAA | B先 BBABA] → GLM5.3
- KIMI 2.8preview 1:9 KIMI 3.1pro [A先 BBBAB | B先 BBBBB] → KIMI 3.1pro
- hy3 1:9 deepseek v4.1flash [A先 ABBBB | B先 BBBBB] → deepseek v4.1flash

### 第 2 轮

同分随机排序后的配对顺序：hy4 → GLM5.3 → KIMI 3.1pro → deepseek v4.1flash → deepseek v4pro → MiniMax M3.1flash → step5preview → KIMI 2.8preview → GLM5.3flash → MiniMax M3 → MIMO-v2.6-pro → hy3

- hy4 4:6 GLM5.3 [A先 BBAAA | B先 BBABB] → GLM5.3
- KIMI 3.1pro 2:8 deepseek v4.1flash [A先 ABBBA | B先 BBBBB] → deepseek v4.1flash
- deepseek v4pro 6:4 MiniMax M3.1flash [A先 AAABA | B先 ABABB] → deepseek v4pro
- step5preview 8:2 KIMI 2.8preview [A先 AAABA | B先 AABAA] → step5preview
- GLM5.3flash 0:10 MiniMax M3 [A先 BBBBB | B先 BBBBB] → MiniMax M3
- MIMO-v2.6-pro 4:6 hy3 [A先 BBABB | B先 AABAB] → hy3

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4pro → deepseek v4.1flash → GLM5.3 → MiniMax M3 → hy3 → hy4 → step5preview → MiniMax M3.1flash → KIMI 3.1pro → KIMI 2.8preview → GLM5.3flash → MIMO-v2.6-pro

- deepseek v4pro 3:7 deepseek v4.1flash [A先 ABBAB | B先 BBBBA] → deepseek v4.1flash
- GLM5.3 6:4 MiniMax M3 [A先 AABAA | B先 ABABB]（跨分组浮动 1） → GLM5.3
- hy3 5:5 hy4 [A先 ABABA | B先 BAABB] → 平局
- step5preview 6:4 MiniMax M3.1flash [A先 ABAAB | B先 ABAAB] → step5preview
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → KIMI 3.1pro
- KIMI 2.8preview 1:9 MIMO-v2.6-pro [A先 BBBBB | B先 BABBB] → MIMO-v2.6-pro

### 第 4 轮

同分随机排序后的配对顺序：GLM5.3 → deepseek v4.1flash → KIMI 3.1pro → deepseek v4pro → step5preview → hy4 → hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → MiniMax M3 → KIMI 2.8preview → GLM5.3flash

- GLM5.3 4:6 deepseek v4.1flash [A先 ABBAB | B先 BBAAB] → deepseek v4.1flash
- KIMI 3.1pro 5:5 deepseek v4pro [A先 ABBAB | B先 AABBA] → 平局
- step5preview 6:4 hy4 [A先 AAAAB | B先 AABBB]（跨分组浮动 0.5） → step5preview
- hy3 2:8 MiniMax M3.1flash [A先 BBBAB | B先 BABBB]（跨分组浮动 0.5） → MiniMax M3.1flash
- MIMO-v2.6-pro 3:7 MiniMax M3 [A先 BBABB | B先 ABBAB] → MiniMax M3
- KIMI 2.8preview 9:1 GLM5.3flash [A先 AAAAA | B先 AAAAB] → KIMI 2.8preview

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → step5preview → KIMI 3.1pro → deepseek v4pro → MiniMax M3 → MiniMax M3.1flash → hy4 → hy3 → KIMI 2.8preview → MIMO-v2.6-pro → GLM5.3flash

- deepseek v4.1flash 6:4 step5preview [A先 AAABA | B先 ABBBA]（跨分组浮动 1） → deepseek v4.1flash
- GLM5.3 9:1 KIMI 3.1pro [A先 AAAAA | B先 AAAAB]（跨分组浮动 0.5） → GLM5.3
- deepseek v4pro 5:5 MiniMax M3 [A先 AABAA | B先 BBBBA]（跨分组浮动 0.5） → 平局
- MiniMax M3.1flash 5:5 hy4 [A先 ABAAB | B先 AABBB]（跨分组浮动 0.5） → 平局
- hy3 8:2 KIMI 2.8preview [A先 AAAAA | B先 BBAAA]（跨分组浮动 0.5） → hy3
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MIMO-v2.6-pro

## 第 9 届（种子 `swiss-2026-11-05:s9`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 36 | 72.00% | 5/0/0 | 15.5 | 15.5 |
| 2 | GLM5.3 | 3.5 | 28 | 56.00% | 3/1/1 | 15 | 8.25 |
| 3 | deepseek v4pro | 3.5 | 27 | 54.00% | 3/1/1 | 15 | 8.25 |
| 4 | hy4 | 3 | 34 | 68.00% | 3/0/2 | 14.5 | 6 |
| 5 | step5preview | 3 | 32 | 64.00% | 3/0/2 | 12.5 | 4.5 |
| 6 | MiniMax M3.1flash | 3 | 24 | 48.00% | 3/0/2 | 13 | 6.5 |
| 7 | KIMI 3.1pro | 2.5 | 25 | 50.00% | 2/1/2 | 11.5 | 2.75 |
| 8 | MiniMax M3 | 2 | 29 | 58.00% | 2/0/3 | 10 | 1 |
| 9 | MIMO-v2.6-pro | 2 | 26 | 52.00% | 2/0/3 | 10.5 | 1 |
| 10 | hy3 | 1.5 | 23 | 46.00% | 1/1/3 | 13.5 | 2.25 |
| 11 | KIMI 2.8preview | 1 | 13 | 26.00% | 1/0/4 | 8.5 | 0 |
| 12 | GLM5.3flash | 0 | 3 | 6.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy3 → KIMI 3.1pro → GLM5.3flash → MIMO-v2.6-pro → deepseek v4.1flash → step5preview → GLM5.3 → MiniMax M3.1flash → KIMI 2.8preview → hy4 → deepseek v4pro → MiniMax M3

- hy3 5:5 KIMI 3.1pro [A先 BBAAB | B先 ABAAB] → 平局
- GLM5.3flash 0:10 MIMO-v2.6-pro [A先 BBBBB | B先 BBBBB] → MIMO-v2.6-pro
- deepseek v4.1flash 7:3 step5preview [A先 ABBAA | B先 AABAA] → deepseek v4.1flash
- GLM5.3 6:4 MiniMax M3.1flash [A先 AAABA | B先 BBAAB] → GLM5.3
- KIMI 2.8preview 1:9 hy4 [A先 BBBAB | B先 BBBBB] → hy4
- deepseek v4pro 6:4 MiniMax M3 [A先 BAAAA | B先 ABBAB] → deepseek v4pro

### 第 2 轮

同分随机排序后的配对顺序：GLM5.3 → MIMO-v2.6-pro → deepseek v4pro → hy4 → deepseek v4.1flash → KIMI 3.1pro → hy3 → KIMI 2.8preview → MiniMax M3 → MiniMax M3.1flash → step5preview → GLM5.3flash

- GLM5.3 6:4 MIMO-v2.6-pro [A先 AAAAB | B先 ABBBA] → GLM5.3
- deepseek v4pro 6:4 hy4 [A先 AABBA | B先 BAABA] → deepseek v4pro
- deepseek v4.1flash 9:1 KIMI 3.1pro [A先 AAAAA | B先 AAAAB]（跨分组浮动 0.5） → deepseek v4.1flash
- hy3 9:1 KIMI 2.8preview [A先 AAAAA | B先 AAABA]（跨分组浮动 0.5） → hy3
- MiniMax M3 3:7 MiniMax M3.1flash [A先 ABBBA | B先 BBBAB] → MiniMax M3.1flash
- step5preview 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → step5preview

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → GLM5.3 → hy3 → hy4 → MIMO-v2.6-pro → step5preview → MiniMax M3.1flash → KIMI 3.1pro → GLM5.3flash → KIMI 2.8preview → MiniMax M3

- deepseek v4.1flash 7:3 deepseek v4pro [A先 AAABA | B先 BAAAB] → deepseek v4.1flash
- GLM5.3 8:2 hy3 [A先 AAABA | B先 AAABA]（跨分组浮动 0.5） → GLM5.3
- hy4 8:2 MIMO-v2.6-pro [A先 BAAAA | B先 AAAAB] → hy4
- step5preview 4:6 MiniMax M3.1flash [A先 AABAB | B先 BBBBA] → MiniMax M3.1flash
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → KIMI 3.1pro
- KIMI 2.8preview 1:9 MiniMax M3 [A先 BBBBB | B先 BBABB] → MiniMax M3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → hy4 → MiniMax M3.1flash → deepseek v4pro → hy3 → KIMI 3.1pro → MiniMax M3 → MIMO-v2.6-pro → step5preview → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 7:3 GLM5.3 [A先 AAAAB | B先 BAAAB] → deepseek v4.1flash
- hy4 9:1 MiniMax M3.1flash [A先 AAAAA | B先 BAAAA] → hy4
- deepseek v4pro 7:3 hy3 [A先 AABBA | B先 AAAAB]（跨分组浮动 0.5） → deepseek v4pro
- KIMI 3.1pro 7:3 MiniMax M3 [A先 AAAAA | B先 BBAAB]（跨分组浮动 0.5） → KIMI 3.1pro
- MIMO-v2.6-pro 3:7 step5preview [A先 BBABB | B先 BAABB] → step5preview
- KIMI 2.8preview 7:3 GLM5.3flash [A先 BAABA | B先 AABAA] → KIMI 2.8preview

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → GLM5.3 → deepseek v4pro → KIMI 3.1pro → step5preview → MiniMax M3.1flash → hy3 → MIMO-v2.6-pro → MiniMax M3 → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 6:4 hy4 [A先 BABAA | B先 BAABA]（跨分组浮动 1） → deepseek v4.1flash
- GLM5.3 5:5 deepseek v4pro [A先 ABBAA | B先 AABBB] → 平局
- KIMI 3.1pro 2:8 step5preview [A先 BBBAB | B先 BBBAB]（跨分组浮动 0.5） → step5preview
- MiniMax M3.1flash 6:4 hy3 [A先 ABABA | B先 BABAA]（跨分组浮动 0.5） → MiniMax M3.1flash
- MIMO-v2.6-pro 7:3 KIMI 2.8preview [A先 BBAAA | B先 AABAA] → MIMO-v2.6-pro
- MiniMax M3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MiniMax M3

## 第 10 届（种子 `swiss-2026-11-05:s10`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 34 | 68.00% | 5/0/0 | 12.5 | 12.5 |
| 2 | step5preview | 4 | 36 | 72.00% | 4/0/1 | 12 | 7 |
| 3 | MiniMax M3 | 3 | 32 | 64.00% | 2/2/1 | 11.5 | 6.5 |
| 4 | hy3 | 3 | 31 | 62.00% | 2/2/1 | 10.5 | 3.75 |
| 5 | deepseek v4pro | 3 | 29 | 58.00% | 2/2/1 | 12 | 6.25 |
| 6 | KIMI 3.1pro | 2.5 | 28 | 56.00% | 1/3/1 | 11 | 4.25 |
| 7 | hy4 | 2.5 | 24 | 48.00% | 2/1/2 | 16 | 6.25 |
| 8 | MiniMax M3.1flash | 2.5 | 24 | 48.00% | 1/3/1 | 15.5 | 6.25 |
| 9 | GLM5.3 | 2 | 27 | 54.00% | 2/0/3 | 11.5 | 1 |
| 10 | MIMO-v2.6-pro | 1.5 | 19 | 38.00% | 1/1/3 | 15.5 | 2.25 |
| 11 | KIMI 2.8preview | 1 | 12 | 24.00% | 1/0/4 | 9.5 | 0 |
| 12 | GLM5.3flash | 0 | 4 | 8.00% | 0/0/5 | 12.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：deepseek v4.1flash → GLM5.3 → GLM5.3flash → step5preview → MIMO-v2.6-pro → KIMI 2.8preview → KIMI 3.1pro → hy4 → deepseek v4pro → hy3 → MiniMax M3 → MiniMax M3.1flash

- deepseek v4.1flash 6:4 GLM5.3 [A先 ABAAA | B先 BAABB] → deepseek v4.1flash
- GLM5.3flash 0:10 step5preview [A先 BBBBB | B先 BBBBB] → step5preview
- MIMO-v2.6-pro 8:2 KIMI 2.8preview [A先 AAAAA | B先 BBAAA] → MIMO-v2.6-pro
- KIMI 3.1pro 3:7 hy4 [A先 BBAAA | B先 BBBBB] → hy4
- deepseek v4pro 5:5 hy3 [A先 BABAB | B先 AABBA] → 平局
- MiniMax M3 5:5 MiniMax M3.1flash [A先 ABABB | B先 ABAAB] → 平局

### 第 2 轮

同分随机排序后的配对顺序：step5preview → deepseek v4.1flash → hy4 → MIMO-v2.6-pro → deepseek v4pro → hy3 → MiniMax M3 → MiniMax M3.1flash → KIMI 2.8preview → GLM5.3 → KIMI 3.1pro → GLM5.3flash

- step5preview 3:7 deepseek v4.1flash [A先 BABBB | B先 ABBAB] → deepseek v4.1flash
- hy4 5:5 MIMO-v2.6-pro [A先 AABBB | B先 AABBA] → 平局
- deepseek v4pro 2:8 MiniMax M3 [A先 BBBAA | B先 BBBBB] → MiniMax M3
- hy3 5:5 MiniMax M3.1flash [A先 AAAAB | B先 BBBAB] → 平局
- KIMI 2.8preview 2:8 GLM5.3 [A先 BABAB | B先 BBBBB] → GLM5.3
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → KIMI 3.1pro

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → MIMO-v2.6-pro → hy4 → MiniMax M3 → step5preview → hy3 → KIMI 3.1pro → MiniMax M3.1flash → GLM5.3 → deepseek v4pro → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 6:4 MIMO-v2.6-pro [A先 AAAAA | B先 BBABB]（跨分组浮动 0.5） → deepseek v4.1flash
- hy4 6:4 MiniMax M3 [A先 ABAAA | B先 BBAAB] → hy4
- step5preview 7:3 hy3 [A先 BAAAA | B先 AABAB] → step5preview
- KIMI 3.1pro 5:5 MiniMax M3.1flash [A先 BAABB | B先 ABAAB] → 平局
- GLM5.3 2:8 deepseek v4pro [A先 BBBBA | B先 BBBBA]（跨分组浮动 0.5） → deepseek v4pro
- KIMI 2.8preview 6:4 GLM5.3flash [A先 BAAAA | B先 ABBAB] → KIMI 2.8preview

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → step5preview → MIMO-v2.6-pro → KIMI 3.1pro → deepseek v4pro → MiniMax M3.1flash → MiniMax M3 → GLM5.3 → KIMI 2.8preview → hy3 → GLM5.3flash

- deepseek v4.1flash 7:3 hy4 [A先 AAAAA | B先 BABAB]（跨分组浮动 0.5） → deepseek v4.1flash
- step5preview 9:1 MIMO-v2.6-pro [A先 AAAAA | B先 ABAAA]（跨分组浮动 0.5） → step5preview
- KIMI 3.1pro 5:5 deepseek v4pro [A先 AAABA | B先 BBABB] → 平局
- MiniMax M3.1flash 7:3 GLM5.3 [A先 AAAAA | B先 ABBBA]（跨分组浮动 0.5） → MiniMax M3.1flash
- MiniMax M3 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3
- hy3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → hy3

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → step5preview → hy4 → MiniMax M3.1flash → MiniMax M3 → KIMI 3.1pro → deepseek v4pro → hy3 → MIMO-v2.6-pro → KIMI 2.8preview → GLM5.3 → GLM5.3flash

- deepseek v4.1flash 8:2 MiniMax M3.1flash [A先 AAAAA | B先 BABAA]（跨分组浮动 1.5） → deepseek v4.1flash
- step5preview 7:3 hy4 [A先 AAABA | B先 AABAB]（跨分组浮动 0.5） → step5preview
- MiniMax M3 5:5 KIMI 3.1pro [A先 BAAAB | B先 BBABA]（跨分组浮动 0.5） → 平局
- deepseek v4pro 9:1 MIMO-v2.6-pro [A先 AAAAA | B先 ABAAA]（跨分组浮动 0.5） → deepseek v4pro
- hy3 8:2 KIMI 2.8preview [A先 BAABA | B先 AAAAA]（跨分组浮动 1） → hy3
- GLM5.3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → GLM5.3

## 第 11 届（种子 `swiss-2026-11-05:s11`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 41 | 82.00% | 5/0/0 | 14.5 | 14.5 |
| 2 | MiniMax M3.1flash | 3.5 | 26 | 52.00% | 3/1/1 | 14 | 7.75 |
| 3 | MiniMax M3 | 3 | 30 | 60.00% | 3/0/2 | 12 | 4 |
| 4 | GLM5.3 | 3 | 29 | 58.00% | 3/0/2 | 12 | 6 |
| 5 | deepseek v4pro | 3 | 24 | 48.00% | 2/2/1 | 16 | 8.5 |
| 6 | hy4 | 2.5 | 29 | 58.00% | 2/1/2 | 14 | 4 |
| 7 | hy3 | 2.5 | 29 | 58.00% | 2/1/2 | 8 | 1.75 |
| 8 | KIMI 3.1pro | 2.5 | 27 | 54.00% | 2/1/2 | 12.5 | 2.75 |
| 9 | step5preview | 2.5 | 26 | 52.00% | 1/3/1 | 14.5 | 7 |
| 10 | MIMO-v2.6-pro | 1.5 | 25 | 50.00% | 1/1/3 | 11 | 1.25 |
| 11 | KIMI 2.8preview | 1 | 12 | 24.00% | 1/0/4 | 11 | 0 |
| 12 | GLM5.3flash | 0 | 2 | 4.00% | 0/0/5 | 10.5 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：hy4 → MIMO-v2.6-pro → MiniMax M3 → KIMI 2.8preview → deepseek v4.1flash → MiniMax M3.1flash → KIMI 3.1pro → GLM5.3flash → GLM5.3 → hy3 → step5preview → deepseek v4pro

- hy4 7:3 MIMO-v2.6-pro [A先 AAAAB | B先 BAAAB] → hy4
- MiniMax M3 8:2 KIMI 2.8preview [A先 BAAAA | B先 AAAAB] → MiniMax M3
- deepseek v4.1flash 8:2 MiniMax M3.1flash [A先 AAAAA | B先 AAABB] → deepseek v4.1flash
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → KIMI 3.1pro
- GLM5.3 8:2 hy3 [A先 ABAAA | B先 BAAAA] → GLM5.3
- step5preview 5:5 deepseek v4pro [A先 ABABB | B先 BAAAB] → 平局

### 第 2 轮

同分随机排序后的配对顺序：GLM5.3 → MiniMax M3 → deepseek v4.1flash → KIMI 3.1pro → hy4 → deepseek v4pro → step5preview → MiniMax M3.1flash → GLM5.3flash → KIMI 2.8preview → MIMO-v2.6-pro → hy3

- GLM5.3 3:7 MiniMax M3 [A先 ABBAB | B先 BABBB] → MiniMax M3
- deepseek v4.1flash 8:2 KIMI 3.1pro [A先 ABAAA | B先 ABAAA] → deepseek v4.1flash
- hy4 5:5 deepseek v4pro [A先 AABAA | B先 BBABB]（跨分组浮动 0.5） → 平局
- step5preview 5:5 MiniMax M3.1flash [A先 AABBB | B先 BAABA]（跨分组浮动 0.5） → 平局
- GLM5.3flash 2:8 KIMI 2.8preview [A先 BBBBB | B先 BBBAA] → KIMI 2.8preview
- MIMO-v2.6-pro 5:5 hy3 [A先 AABBA | B先 BBABA] → 平局

### 第 3 轮

同分随机排序后的配对顺序：MiniMax M3 → deepseek v4.1flash → hy4 → KIMI 2.8preview → deepseek v4pro → GLM5.3 → KIMI 3.1pro → step5preview → MIMO-v2.6-pro → MiniMax M3.1flash → hy3 → GLM5.3flash

- MiniMax M3 1:9 deepseek v4.1flash [A先 BBBBA | B先 BBBBB] → deepseek v4.1flash
- hy4 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → hy4
- deepseek v4pro 7:3 GLM5.3 [A先 ABAAA | B先 BABAA] → deepseek v4pro
- KIMI 3.1pro 5:5 step5preview [A先 ABBAA | B先 BABBA] → 平局
- MIMO-v2.6-pro 4:6 MiniMax M3.1flash [A先 AAABA | B先 BBBBB] → MiniMax M3.1flash
- hy3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → hy3

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → deepseek v4pro → MiniMax M3 → step5preview → MiniMax M3.1flash → KIMI 3.1pro → hy3 → GLM5.3 → KIMI 2.8preview → MIMO-v2.6-pro → GLM5.3flash

- deepseek v4.1flash 7:3 hy4 [A先 AABBA | B先 BAAAA]（跨分组浮动 0.5） → deepseek v4.1flash
- deepseek v4pro 6:4 MiniMax M3 [A先 BAAAB | B先 BAAAB] → deepseek v4pro
- step5preview 7:3 hy3 [A先 BAABA | B先 AABAA] → step5preview
- MiniMax M3.1flash 7:3 KIMI 3.1pro [A先 ABAAA | B先 ABABA] → MiniMax M3.1flash
- GLM5.3 9:1 KIMI 2.8preview [A先 AAAAA | B先 BAAAA] → GLM5.3
- MIMO-v2.6-pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MIMO-v2.6-pro

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → MiniMax M3.1flash → hy4 → step5preview → GLM5.3 → MiniMax M3 → KIMI 3.1pro → MIMO-v2.6-pro → hy3 → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 9:1 deepseek v4pro [A先 AABAA | B先 AAAAA]（跨分组浮动 1） → deepseek v4.1flash
- MiniMax M3.1flash 6:4 hy4 [A先 BBAAB | B先 BAAAA] → MiniMax M3.1flash
- step5preview 4:6 GLM5.3 [A先 BABBA | B先 AABBB]（跨分组浮动 0.5） → GLM5.3
- MiniMax M3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 2） → MiniMax M3
- KIMI 3.1pro 7:3 MIMO-v2.6-pro [A先 AAAAA | B先 AABBB] → KIMI 3.1pro
- hy3 9:1 KIMI 2.8preview [A先 AAAAA | B先 AAAAB]（跨分组浮动 0.5） → hy3

## 第 12 届（种子 `swiss-2026-11-05:s12`）

| 名次 | 模型 | 场分 MP | 局胜 GP | 局胜率 | 胜/平/负 | Buchholz | SB |
|---:|---|---:|---:|---:|---|---:|---:|
| 1 | deepseek v4.1flash | 5 | 40 | 80.00% | 5/0/0 | 14 | 14 |
| 2 | hy4 | 3.5 | 32 | 64.00% | 3/1/1 | 14 | 7.75 |
| 3 | deepseek v4pro | 3.5 | 30 | 60.00% | 3/1/1 | 15.5 | 9 |
| 4 | MiniMax M3.1flash | 3 | 31 | 62.00% | 2/2/1 | 10 | 4.75 |
| 5 | KIMI 3.1pro | 2.5 | 30 | 60.00% | 2/1/2 | 9.5 | 2.25 |
| 6 | MiniMax M3 | 2.5 | 30 | 60.00% | 2/1/2 | 9.5 | 2.25 |
| 7 | step5preview | 2.5 | 24 | 48.00% | 2/1/2 | 16.5 | 6.25 |
| 8 | GLM5.3 | 2.5 | 22 | 44.00% | 2/1/2 | 16 | 6.5 |
| 9 | hy3 | 2 | 23 | 46.00% | 1/2/2 | 15 | 3.75 |
| 10 | MIMO-v2.6-pro | 2 | 22 | 44.00% | 2/0/3 | 10 | 1 |
| 11 | KIMI 2.8preview | 1 | 14 | 28.00% | 1/0/4 | 9 | 0 |
| 12 | GLM5.3flash | 0 | 2 | 4.00% | 0/0/5 | 11 | 0 |

### 第 1 轮

同分随机排序后的配对顺序：GLM5.3 → hy3 → MiniMax M3 → GLM5.3flash → deepseek v4.1flash → hy4 → MiniMax M3.1flash → deepseek v4pro → MIMO-v2.6-pro → step5preview → KIMI 3.1pro → KIMI 2.8preview

- GLM5.3 5:5 hy3 [A先 AABAA | B先 ABBBB] → 平局
- MiniMax M3 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → MiniMax M3
- deepseek v4.1flash 7:3 hy4 [A先 AABAA | B先 ABBAA] → deepseek v4.1flash
- MiniMax M3.1flash 5:5 deepseek v4pro [A先 ABABA | B先 BABAB] → 平局
- MIMO-v2.6-pro 3:7 step5preview [A先 ABABB | B先 ABBBB] → step5preview
- KIMI 3.1pro 9:1 KIMI 2.8preview [A先 AAAAA | B先 ABAAA] → KIMI 3.1pro

### 第 2 轮

同分随机排序后的配对顺序：step5preview → deepseek v4.1flash → KIMI 3.1pro → MiniMax M3 → deepseek v4pro → GLM5.3 → MiniMax M3.1flash → hy3 → KIMI 2.8preview → GLM5.3flash → hy4 → MIMO-v2.6-pro

- step5preview 3:7 deepseek v4.1flash [A先 AAABB | B先 BBBBB] → deepseek v4.1flash
- KIMI 3.1pro 5:5 MiniMax M3 [A先 AAAAB | B先 BBBBA] → 平局
- deepseek v4pro 7:3 GLM5.3 [A先 BBAAA | B先 ABAAA] → deepseek v4pro
- MiniMax M3.1flash 5:5 hy3 [A先 BBAAA | B先 ABABB] → 平局
- KIMI 2.8preview 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA] → KIMI 2.8preview
- hy4 8:2 MIMO-v2.6-pro [A先 ABAAA | B先 AABAA] → hy4

### 第 3 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → MiniMax M3 → KIMI 3.1pro → step5preview → hy4 → KIMI 2.8preview → hy3 → MiniMax M3.1flash → GLM5.3 → GLM5.3flash → MIMO-v2.6-pro

- deepseek v4.1flash 8:2 deepseek v4pro [A先 AAAAA | B先 BABAA]（跨分组浮动 0.5） → deepseek v4.1flash
- MiniMax M3 2:8 step5preview [A先 BBBBA | B先 BABBB]（跨分组浮动 0.5） → step5preview
- KIMI 3.1pro 2:8 hy4 [A先 BBBAB | B先 BBABB]（跨分组浮动 0.5） → hy4
- KIMI 2.8preview 1:9 hy3 [A先 BBBAB | B先 BBBBB] → hy3
- MiniMax M3.1flash 2:8 GLM5.3 [A先 BAABB | B先 BBBBB]（跨分组浮动 0.5） → GLM5.3
- GLM5.3flash 2:8 MIMO-v2.6-pro [A先 BBBBB | B先 ABBAB] → MIMO-v2.6-pro

### 第 4 轮

同分随机排序后的配对顺序：deepseek v4.1flash → hy4 → step5preview → hy3 → KIMI 3.1pro → MiniMax M3 → GLM5.3 → deepseek v4pro → MIMO-v2.6-pro → MiniMax M3.1flash → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 8:2 hy3 [A先 AABAA | B先 ABAAA]（跨分组浮动 1） → deepseek v4.1flash
- hy4 5:5 step5preview [A先 AAABA | B先 BBBAB] → 平局
- KIMI 3.1pro 4:6 GLM5.3 [A先 AAABB | B先 ABBBB] → GLM5.3
- MiniMax M3 3:7 deepseek v4pro [A先 ABABB | B先 BBBAB] → deepseek v4pro
- MIMO-v2.6-pro 8:2 KIMI 2.8preview [A先 AAABA | B先 AAABA] → MIMO-v2.6-pro
- MiniMax M3.1flash 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1） → MiniMax M3.1flash

### 第 5 轮

同分随机排序后的配对顺序：deepseek v4.1flash → deepseek v4pro → step5preview → GLM5.3 → hy4 → hy3 → MIMO-v2.6-pro → MiniMax M3.1flash → KIMI 3.1pro → MiniMax M3 → KIMI 2.8preview → GLM5.3flash

- deepseek v4.1flash 10:0 GLM5.3 [A先 AAAAA | B先 AAAAA]（跨分组浮动 1.5） → deepseek v4.1flash
- deepseek v4pro 9:1 step5preview [A先 BAAAA | B先 AAAAA] → deepseek v4pro
- hy4 8:2 hy3 [A先 AABBA | B先 AAAAA]（跨分组浮动 0.5） → hy4
- MIMO-v2.6-pro 1:9 MiniMax M3.1flash [A先 BBBBB | B先 BBABB] → MiniMax M3.1flash
- KIMI 3.1pro 10:0 GLM5.3flash [A先 AAAAA | B先 AAAAA]（跨分组浮动 1.5） → KIMI 3.1pro
- MiniMax M3 10:0 KIMI 2.8preview [A先 AAAAA | B先 AAAAA]（跨分组浮动 0.5） → MiniMax M3

## 逐局明细

完整逐局记录（含每局随机种子、先后手、胜者、回合数、终局权威）见 `swiss-models-20261105.json` 的 `seasons[].rounds[].pairs[].games`。
任一局可用该局种子与两个脚本 ID 通过 `MatchRunner` 原样复现。

## 复现命令

```bash
node src/tourney-cli.js --seed swiss-2026-11-05 --seasons 12 --rounds 5 --per-side 5 --sets core
```
