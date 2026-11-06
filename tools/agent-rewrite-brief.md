# 12 模型 AI 脚本重写任务说明

> 本轮目标：用**已验证生效的真实模型 ID** 重新编写 12 份 AI 脚本，替换此前因模型名不识别而全部回退到 `hy4-free` 的版本。
> 每个 subagent 只负责表格中自己那一行，除「脚本文件」与「设计说明」两个文件外不得改动任何文件，也不要运行 `npm test`。

## 一、通用要求

1. 先读 `README.md` 第 6 节（AI 脚本接口）与 `src/engine/engine.js` 中 `legalActions()` 相关部分，确认动作结构。可读现有脚本作参考，但**必须独立设计，不要照抄**。
2. 脚本导出 `meta`：`name` 必须包含本行的**显示名**（测试做大小写不敏感匹配），`description` 必须包含本行的**模型 ID** 与**策略主题**。
3. 导出同步或 `async` 的 `chooseAction({ view, legalActions, playerId, random, memory, context })`：
   - 必须**原样返回 `legalActions` 数组中的某个对象引用**；
   - 不得修改 `view` / `legalActions`（它们是深冻结对象），不得 `sort()` 原数组；
   - **零依赖**：不得出现 `import` / `require`；
   - 任何决策点都必须返回合法动作，不得死循环、不得抛异常。
4. 必须适配 `standard` / `ffa` / `hunter` / `firstBlood` / `team2v2` 五种模式，以及 `core` / `colonyWars` / `events` 的任意组合；安全处理 `play`、`ability`（primary/ally/optional/scrap）、`buy`、`attack`、`endTurn`、`discard`、`selectScrap`、`targetDiscard`、`eventChoice`、`transfer` 以及**任何未知动作**。
5. 通用优先级：lethal → 拆除阻止直伤的敌方前哨 → 出牌与同盟 → 有价值购买 → 削血攻击 → 2V2 资源预留 → 兜底 → 结束回合。策略主题决定具体权重。
6. 写完必须执行 `node --check <脚本路径>` 校验语法。

## 二、任务分配表

| 短 id | 显示名 | 模型 ID | 脚本文件 | 设计说明 | 策略主题 | 策略要点 |
|---|---|---|---|---|---|---|
| `hy4` | hy4 | `hy4std` | `scripts/agent-hy4.js` | `subagent-progress/hy4.md` | 稳健中期经济 | 血量差驱动攻防，中期经济曲线；领先转攻、落后筑防与过牌 |
| `hy3` | hy3 | `hy3` | `scripts/agent-hy3.js` | `subagent-progress/hy3.md` | 极速压制 | 低费战斗、前哨突破、短回合尽快压血 |
| `glm53` | GLM5.3 | `glm-5.3` | `scripts/agent-glm53.js` | `subagent-progress/glm53.md` | 舰队协同 | 同阵营聚集、同盟触发、连锁购买与出牌顺序 |
| `glm53flash` | GLM5.3flash | `glm-5.3-flash` | `scripts/agent-glm53flash.js` | `subagent-progress/glm53flash.md` | 快攻闪击 | lethal 搜索、每点战斗即时收益、scrap 终局补刀 |
| `minimaxm3` | MiniMax M3 | `minimax-m3-pay` | `scripts/agent-minimaxm3.js` | `subagent-progress/minimaxm3.md` | 贸易滚雪球 | 按回合建经济曲线，前期贸易/压缩，中期高费，后期转战斗 |
| `minimaxm31flash` | MiniMax M3.1flash | `minimax-m3.1-flash` | `scripts/agent-minimaxm31flash.js` | `subagent-progress/minimaxm31flash.md` | 牌组压缩 | 优先销毁 Scout/Viper/Explorer，重视过牌与弃牌循环 |
| `kimi31pro` | KIMI 3.1pro | `kimi-k3.1-pro` | `scripts/agent-kimi31pro.js` | `subagent-progress/kimi31pro.md` | 局面推演 | 多因素评分（模式/回合/权威差/前哨/牌组质量/剩余资源），事件保守修正 |
| `kimi28preview` | KIMI 2.8preview | `kimi-k2.8-preview` | `scripts/agent-kimi28preview.js` | `subagent-progress/kimi28preview.md` | 基地控制 | 优先购买与保护前哨、拆敌方前哨，按防御与剩余战斗排序 |
| `deepseekv41flash` | deepseek v4.1flash | `deepseek-v4.1-flash` | `scripts/agent-deepseekv41flash.js` | `subagent-progress/deepseekv41flash.md` | 事件响应 | 为 blackHole/bombardment/comet/warpJump 建估值，低血避权威损失 |
| `deepseekv4pro` | deepseek v4pro | `deepseek-v4-pro` | `scripts/agent-deepseekv4pro.js` | `subagent-progress/deepseekv4pro.md` | 团队调度 | 2V2 共享权威、多余资源 transfer 给队友、集中火力打穿一队 |
| `step5preview` | step5preview | `step-5-preview` | `scripts/agent-step5preview.js` | `subagent-progress/step5preview.md` | 殖民战争 | 识别直接入手牌/免费获得/copyBase/Command Center，让新购强牌立即参与同盟链 |
| `mimov26pro` | MIMO-v2.6-pro | `mimo-v2.6-pro` | `scripts/agent-mimov26pro.js` | `subagent-progress/mimov26pro.md` | 混合博弈 | 用 `memory` 记录偏好，按对手数量/团队权威/血量/牌库自适应切换权重，不硬编码卡名 |

## 三、进度上报（必须）

用 Bash 依次执行以下 5 条命令，把 `<id>` 换成自己的短 id，并把中文 note 写成符合本策略的一句话：

```bash
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 10 "读取接口" "<本策略相关的一句话>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 40 "设计策略" "<本策略相关的一句话>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 70 "编写脚本" "<本策略相关的一句话>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 90 "语法校验" "<本策略相关的一句话>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> completed 100 "已完成" "脚本与设计说明已落盘"
```

## 四、公开设计说明

`subagent-progress/<id>.md` 用中文写五节：**核心思路 / 动作优先级 / 模式适配 / 事件与2V2 / 取舍**。
文件开头必须注明：`执行模型 ID：<本行模型 ID>`。只写可审阅的设计说明，不要写内部推理过程。

## 五、禁止事项

- 不改动 `subagents.json`、`README.md`、服务端、前端、测试、引擎或任何其他文件。
- 不运行 `npm test`、不启动服务、不启动锦标赛。
- 不在 `scripts/` 下新建额外文件（备份目录与示例脚本都不要动）。

完成后用一句话汇报：脚本路径、策略要点、语法校验结果。
