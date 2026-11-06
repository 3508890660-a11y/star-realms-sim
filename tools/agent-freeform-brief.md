# 12 模型自由策略 AI 脚本任务说明

> 本轮目标：**策略由模型自己设计，脚本由模型自己实现**。不再指定任何策略主题、打法方向或动作优先级。
> 「选什么策略」与「能不能把策略写对」都算模型能力的一部分。

## 一、你要做什么

1. 自行判断《星域奇航》基础盒 1v1 环境下什么打法最有效，**自己给策略起一个名字**并说明理由；
2. 把这套策略完整实现成一个零依赖 AI 脚本；
3. 写一份公开设计说明，解释你为什么这样选、以及这套打法的弱点。

**本文件不提供任何策略建议**。不要向主代理询问「应该用什么策略」，不要参考其他模型的产物。

## 二、允许读什么 / 禁止读什么

允许：
- `README.md` 第 6 节（AI 脚本接口、视图字段、常见动作）；
- `src/engine/engine.js`（`legalActions()`、`applyAction()` 的动作字段与规则）；
- `src/engine/cards.js`、`expansions.js`（卡牌定义与效果字段）。

**禁止读取任何已有 AI 实现**，包括 `scripts/agent-*.js`、`scripts/example.js`、`src/ai/*.js`，以及 `scripts/_backup-*/` 里的旧脚本。禁止复制、改写或借鉴它们的评分逻辑。你只能依据接口文档与规则本身独立实现。

## 三、硬性接口要求

1. 脚本导出 `meta`：`name` 必须包含本行的**显示名**（测试做大小写不敏感匹配）；`description` 必须包含本行的**模型 ID**、你自起的**策略名称**与一句话策略理由。
2. 导出同步或 `async` 的 `chooseAction({ view, legalActions, playerId, random, memory, context })`：
   - 必须**原样返回 `legalActions` 数组中的某个对象引用**；
   - 不得修改 `view` / `legalActions`（深冻结对象），不得对原数组 `sort()`；
   - **零依赖**：不得出现 `import` / `require`；
   - 任何决策点都必须返回合法动作，不得死循环、不得抛异常、不得长时间阻塞（单次决策上限 3000ms）。
3. 必须适配 `standard` / `ffa` / `hunter` / `firstBlood` / `team2v2` 五种模式，以及 `core` / `colonyWars` / `events` 任意组合；对 `discard`、`selectScrap`、`targetDiscard`、`eventChoice`、`transfer` 以及**任何未知动作**都要安全兜底。
4. 脚本开头用注释写明：`策略名称` 与 `选择理由（一句话）`。
5. 写完执行 `node --check <脚本路径>` 校验语法。

## 四、任务分配表

| 短 id | 显示名 | 模型 ID | 脚本文件 | 设计说明 |
|---|---|---|---|---|
| `hy4` | hy4 | `hy4std` | `scripts/agent-hy4.js` | `subagent-progress/hy4.md` |
| `hy3` | hy3 | `hy3` | `scripts/agent-hy3.js` | `subagent-progress/hy3.md` |
| `glm53` | GLM5.3 | `glm-5.3` | `scripts/agent-glm53.js` | `subagent-progress/glm53.md` |
| `glm53flash` | GLM5.3flash | `glm-5.3-flash` | `scripts/agent-glm53flash.js` | `subagent-progress/glm53flash.md` |
| `minimaxm3` | MiniMax M3 | `minimax-m3-pay` | `scripts/agent-minimaxm3.js` | `subagent-progress/minimaxm3.md` |
| `minimaxm31flash` | MiniMax M3.1flash | `minimax-m3.1-flash` | `scripts/agent-minimaxm31flash.js` | `subagent-progress/minimaxm31flash.md` |
| `kimi31pro` | KIMI 3.1pro | `kimi-k3.1-pro` | `scripts/agent-kimi31pro.js` | `subagent-progress/kimi31pro.md` |
| `kimi28preview` | KIMI 2.8preview | `kimi-k2.8-preview` | `scripts/agent-kimi28preview.js` | `subagent-progress/kimi28preview.md` |
| `deepseekv41flash` | deepseek v4.1flash | `deepseek-v4.1-flash` | `scripts/agent-deepseekv41flash.js` | `subagent-progress/deepseekv41flash.md` |
| `deepseekv4pro` | deepseek v4pro | `deepseek-v4-pro` | `scripts/agent-deepseekv4pro.js` | `subagent-progress/deepseekv4pro.md` |
| `step5preview` | step5preview | `step-5-preview` | `scripts/agent-step5preview.js` | `subagent-progress/step5preview.md` |
| `mimov26pro` | MIMO-v2.6-pro | `mimo-v2.6-pro` | `scripts/agent-mimov26pro.js` | `subagent-progress/mimov26pro.md` |

## 五、进度上报（必须）

用 Bash 依次执行以下 5 条命令，把 `<id>` 换成自己的短 id。中文 note 要写出**你自己的策略思考**，不要套用模板话术：

```bash
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 10 "读取接口" "<你先确认了哪些动作与状态字段>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 40 "设计策略" "<自选策略名称 + 为什么选它>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 70 "编写脚本" "<实现时的关键取舍>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> running 90 "语法校验" "<校验与边界动作检查结果>"
node F:/producing/game/star-realms-sim/tools/report-progress.mjs <id> completed 100 "已完成" "自选策略：<策略名称>；脚本与设计说明已落盘"
```

## 六、公开设计说明

`subagent-progress/<id>.md` 用中文写六节：**策略名称与选择理由 / 核心思路 / 动作优先级 / 模式与扩展适配 / 事件与 2V2 / 取舍与已知弱点**。

文件开头必须两行：

```text
执行模型 ID：<本行模型 ID>
自选策略：<你起的策略名称>
```

只写可审阅的设计说明，不写内部推理过程。

## 七、禁止事项

- 不改动 `subagents.json`、`README.md`、服务端、前端、测试、引擎、`tools/` 或任何其他文件。
- 不运行 `npm test`、不启动服务、不启动锦标赛。
- 不在 `scripts/` 下新建额外文件，不改动备份目录与示例脚本。
- 不读取第二节禁止的现有 AI 实现。

完成后一句话汇报：脚本路径、自选策略名称、选择理由、语法校验结果。
