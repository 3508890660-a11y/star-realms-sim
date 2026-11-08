# 脚本工厂 · 按程序更新重启（隔离轮）

## 0. 这一轮是什么

规则内核在你上次写脚本之后改过了。现在请你**只依据本目录里提供的程序更新说明与规则内核副本**，修订你自己的那份 AI 脚本，让它适配新版程序。

**这是一个全新的、隔离的会话**：本目录里没有、也不允许出现任何历史对局数据、胜率、排名、赛果、旧设计说明或别的模型的脚本。请不要试图寻找、询问或推断这些信息，也不要联网检索。你只能看到：

| 允许读 | 内容 |
|---|---|
| `README.md`（本文件） | 任务说明 |
| `PROGRAM-UPDATES.md` | 2026-11-05 → 2026-11-08 的程序/规则变更清单 |
| `INTERFACE.md` | 脚本接口、视图字段、动作形态 |
| `engine/*.js` | 规则内核副本（`engine.js` `cards.js` `modes.js` `expansions.js` `expansions-extra.js` `rng.js`） |
| `agents/<你的短 id>/current.js` | **你自己的**上一版脚本（唯一的既有实现） |
| `tools/*` | 进度上报与自检脚本 |

**禁止**：访问本目录之外的任何路径；读取其它 `agents/*/` 目录；读取任何报告、锦标赛产物、设计说明、进度记录、项目文档；联网；搜索历史会话；向主代理询问「之前谁赢了 / 什么策略更强」。若误看到任何历史结果，请忽略并在汇报里说明。

## 1. 你要交付什么

1. `out/<你的短 id>.js` —— **修订后的完整脚本**（不是补丁、不是 diff）。
2. `out/<你的短 id>.md` —— 中文公开**更新说明**（不是内部推理过程），六节：
   - `执行模型 ID` 与 `策略名称`（文件开头两行，格式见下）
   - **本次改动点**（逐条对应 `PROGRAM-UPDATES.md` 的哪一条）
   - **新增 3V3 模式适配**（`hydra3` / `emperor` 分别说明）
   - **新牌包与新动作适配**（含 `double:true` 的 `ally`、`moveCard`、带 `choice`/`row`/`targets` 的动作）
   - **团队回合结构变化带来的估值调整**（整队轮流 / 队末清算 / 起手牌）
   - **取舍与已知弱点**

   开头两行必须是：
   ```text
   执行模型 ID：<你的模型 ID>
   策略名称：<保持你上一版的策略名>
   ```

## 2. 修订原则（重要）

- **保留策略身份**：这是「按程序更新做适配」，不是重新设计打法。沿用上一版脚本的**策略名称**、核心思路与 `meta.name` 中的策略部分，只修规则假设、补新模式/新牌包/新动作、必要时修正估值。可以重构实现，但不要换成另一套完全不同的策略。
- **逐条核对** `PROGRAM-UPDATES.md` 的第 1–6 节，在更新说明里说明每条你怎么处理。
- 有疑问以 `engine/*.js` 的实际代码为准，其次 `INTERFACE.md`。
- 不要写死玩家人数、队伍人数、卡名全集、大将座位或交易行长度。

## 3. 硬性接口要求

1. 导出 `meta`：`name` 必须包含你的**显示名**；`description` 必须包含你的**模型 ID**、**策略名称**与一句话理由。
2. 导出同步或 `async` 的 `chooseAction({ view, legalActions, playerId, random, memory, context })`：
   - 必须**原样返回 `legalActions` 数组中的某个对象引用**；
   - 不得修改 `view` / `legalActions`（深冻结），不得对原数组 `sort()`；
   - **零依赖**：不得出现 `import` / `require` / 文件读写 / 网络调用；
   - 任何决策点都必须返回合法动作，不抛异常、不死循环；单次决策 < 3000ms；
   - 未知动作类型必须安全兜底。
3. 必须适配 **7 种模式**（`standard` / `ffa` / `hunter` / `firstBlood` / `team2v2` / `hydra3` / `emperor`）与 **6 个牌包任意组合**（`core` / `colonyWars` / `events` / `frontiers` / `crisisFleets` / `crisisBases`）。
4. 脚本开头保留两行注释：`// 策略名称：…`、`// 选择理由：…`，并**新增第三行** `// 本轮更新：…`（一句话说明按哪几条程序更新做了适配）。
5. 写完必须自行执行 `node --check out/<你的短 id>.js` 与 `node tools/selfcheck.mjs <你的短 id>`，两者都要通过。

## 4. 任务分配表

| 短 id | 显示名 | 模型 ID |
|---|---|---|
| `hy4` | hy4 | `hy4std` |
| `hy3` | hy3 | `hy3` |
| `glm53` | GLM5.3 | `glm-5.3` |
| `glm53flash` | GLM5.3flash | `glm-5.3-flash` |
| `minimaxm3` | MiniMax M3 | `minimax-m3-pay` |
| `minimaxm31flash` | MiniMax M3.1flash | `minimax-m3.1-flash` |
| `kimi31pro` | KIMI 3.1pro | `kimi-k3.1-pro` |
| `kimi28preview` | KIMI 2.8preview | `kimi-k2.8-preview` |
| `deepseekv41flash` | deepseek v4.1flash | `deepseek-v4.1-flash` |
| `deepseekv4pro` | deepseek v4pro | `deepseek-v4-pro` |
| `step5preview` | step5preview | `step-5-preview` |
| `mimov26pro` | MIMO-v2.6-pro | `mimo-v2.6-pro` |

> 你只负责表里**属于你的那一行**。主代理会在你的 prompt 里告诉你短 id、显示名与模型 ID。

## 5. 进度上报（必须，实时看板会读）

每次 Bash 命令前先修正 PATH（`node` 才能找到），然后 `cd` 到本目录。把 `<id>` 换成你的短 id，`note` 写**你自己的判断**，不要套模板：

```bash
export PATH="/c/Users/张涵/.workbuddy/binaries/PortableGit/versions/1.2.0/usr/bin:/usr/bin:/bin:$PATH"
cd /f/producing/game/_sr-agent-refresh-20261108
node tools/report-progress.mjs <id> running 10 "读取程序更新" "<你确认了哪几条代码变化>"
node tools/report-progress.mjs <id> running 40 "定位旧假设" "<旧脚本里哪些假设已经不成立>"
node tools/report-progress.mjs <id> running 70 "修订脚本" "<你如何适配两种 3V3 与新牌包>"
node tools/report-progress.mjs <id> running 90 "校验" "<node --check 与 selfcheck 的结果>"
node tools/report-progress.mjs <id> completed 100 "已完成" "<策略名>；脚本与更新说明已落盘"
```

## 6. 自检脚本

`tools/selfcheck.mjs` 会用合成的 7 模式视图 + 新动作集合调用你的 `chooseAction`，检查：返回值是 `legalActions` 中的对象引用、不修改深冻结视图、不抛异常、不超时、`meta` 字段齐备、零依赖。它**不产生任何对局数据**。

```bash
node tools/selfcheck.mjs <id>
```

## 7. 禁止事项

- 不修改 `engine/`、`tools/`、`README.md`、`PROGRAM-UPDATES.md`、`INTERFACE.md`、`package.json`，不修改其它任何代理的目录或文件。
- 不在 `out/` 下新建除 `<你的短 id>.js` 与 `<你的短 id>.md` 之外的文件。
- 不读取本目录之外的任何路径，不联网，不检索历史会话。
- 不启动服务、不跑锦标赛、不做任何对局实验。

## 8. 完成后汇报（一句话）

`脚本路径 + 策略名 + 本轮三条主要改动 + node --check / selfcheck 结果 + 是否接触过任何历史结果（应为「否」）`。
