# 星域奇航 AI 模拟器 · 项目时间线

> 本文为 **2026-11-08「扩展牌包 + 3V3 模式」更新**而写，以本次更新为终点回溯全项目（初版写于 2026-11-07 观战台 UI 更新）。
> 时间口径：git 提交时间与文件 mtime 为 UTC+8；报告 `generatedAt` 原为 UTC，下表已换算为 UTC+8。
> 只记录可核验事实（提交哈希、落盘文件、报告字段、测试计数、截图），没有留痕的时刻标为「同日」，不推断、不补写。

---

## 一、总览

| 阶段 | 时间（UTC+8） | 关键事项 | 可核验产物 |
|---|---|---|---|
| 1 | 2026-11-05 17:20–18:40 | 规则内核、卡牌、1v1 瑞士轮配对 | `src/engine/cards.js` / `engine.js` / `swiss.js` |
| 2 | 2026-11-05 20:15–22:51 | 12 个真实模型脚本、模型 ID 验证、指定主题轮与自由策略轮 | `subagents.json`、`swiss-models-20261105-guided.json`、`swiss-freeform-20261105.json` |
| 3 | 2026-11-06 09:13–09:25 | 正式 1v1 报告与 2V2 组队赛 | `tournaments/latest.json`、`team-latest.json` |
| 4 | 2026-11-06 10:17 | 项目纪录片成片 | `video/star-realms-ai-documentary.mp4` |
| 5 | 2026-11-06 10:51 | 本地初始提交 + GitHub 建仓首次上传 | `e4e849e`、仓库 `3508890660-a11y/star-realms-sim` |
| 6 | 2026-11-06 22:40–22:53 | 2V2 实验室四场实验与报告 | `reply/star-realms-2v2-*.json/.md` |
| 7 | 2026-11-06 22:56 | 实验成果推送 GitHub | `d4510f9` |
| 8 | 2026-11-07 10:58–11:02 | 观战台 2V2 实验室标签页 + 本时间线文档初版 | `public/*`、`src/server/server.js`、`test/lab-ui.test.js`、`TIMELINE.md` |
| 9 | **2026-11-08 20:19–20:45** | **扩展牌包（Frontiers + 两个危机小扩）、三头龙/大将战 3V3、四场正式赛** | `src/engine/expansions-extra.js`、`src/mode-tourney-cli.js`、`reply/star-realms-{hydra3,emperor}-*.json`、`reply/star-realms-3v3-summary.md` |

---

## 二、分阶段时间线

### 1) 2026-11-05 · 规则内核与脚本化对局

- **17:20** `src/engine/cards.js` 落盘（卡牌定义与牌包归一化）；**18:16** `src/engine/engine.js` 落盘（唯一状态入口 `applyAction`、合法动作 `legalActions`、视角脱敏）。
- **18:40** `src/engine/swiss.js` 落盘（1v1 瑞士轮配对、零重赛回溯、排名与聚合）。
- 架构固定为四层：纯规则内核 → 座位控制器/脚本适配器 → 对局调度与回放 → Web 观战界面。观战、CLI、锦标赛、回放共用同一引擎，随机数由主种子派生。
- 脚本接口定型：`export const meta` + `chooseAction({ view, legalActions, playerId, random, memory, context })`，返回值必须原样来自 `legalActions`。

### 2) 2026-11-05 · 12 个模型脚本与真实 ID 验证

- **20:15**（`generatedAt` 12:15Z）指定主题轮报告 `tournaments/swiss-models-20261105-guided.json` 生成：12 届 × 3600 局，`deepseek v4.1flash`「事件响应」77.67%（466/600）、12/12 冠。
- **22:45** `subagents.json` 落盘，记录 12 个已验证生效的真实 `modelId`（`hy4std`、`hy3`、`glm-5.3`、`glm-5.3-flash`、`minimax-m3-pay`、`minimax-m3.1-flash`、`kimi-k3.1-pro`、`kimi-k2.8-preview`、`deepseek-v4.1-flash`、`deepseek-v4-pro`、`step-5-preview`、`mimo-v2.6-pro`）。
- **22:51**（`generatedAt` 14:51Z）自由策略轮报告 `tournaments/swiss-freeform-20261105.json` 生成：`deepseek v4.1flash` 自选「三段涨潮」73.00%（438/600）、11/12 冠。
- 该阶段曾出现「子会话静默回退默认模型」问题，回退轮结果作废后按真实 ID 重写脚本与赛果；`README.md` 第 7 节记录了口径（11 个跑成默认模型、仅 hy3 生效）。中间产物已被后续正式报告覆盖，故此处只列最终留档文件。

### 3) 2026-11-06 上午 · 正式报告与 2V2 组队赛

- **09:13**（`generatedAt` 01:13Z）`tournaments/latest.json` 生成：自由策略轮正式榜，与 `reply/star-realms-swiss-report3.json` 的 `aggregate`/`stats` 逐字段一致。
- **09:19** `src/engine/team-swiss.js` 落盘：6 队组队瑞士轮、BO8 座位排列、剩余轮次可行性前瞻。
- **09:23**（`generatedAt` 01:23Z）`tournaments/team-latest.json` 生成：12 届 × 5 轮 × 3 场 × BO8 = 1440 局，DeepSeek 联队 86.04%（413/480）、11 冠，零重赛。

### 4) 2026-11-06 10:17 · 项目纪录片

- `video/star-realms-ai-documentary.mp4` 成片：16:00.38 / 1920×1080 / 30fps / H.264+AAC，60 镜 109 帧，中文旁白 + 烧录字幕。
- 章节顺序：搭建 → 规则 → 12 位选手脚本 → 赛制赛程 → 比赛过程与解说 → 结果说明。
- 解说核心是第 1 届第 3 轮冠亚对决第 1 局，用报告保存的逐局种子 `swiss-2026-11-05:s1:r3:m1:g1:3c6f05c7` 复现，与报告逐字段一致（19 回合 / 184 动作 / 11:0）。`reply/star-realms-replay1.json` 是旧引擎产物（254 个非法动作），未采用。

### 5) 2026-11-06 10:51 · GitHub 建仓与首次上传

- 本地初始提交 `e4e849e`（`Initial commit: Star Realms AI simulator`），151 个文件入库，`.gitignore` 排除 `video/`，`.gitattributes` 锁定 LF。
- 同日在账号 `3508890660-a11y` 下新建公开仓库 `star-realms-sim` 并推送 `main`。远端 `contents/video` 返回 404 确认视频未上传。
- 推送绕过了本机代理隧道导致的 `schannel: server closed abruptly`，改用对 github.com 清空代理 env 直连。

### 6) 2026-11-06 22:40–22:53 · 2V2 实验室四场实验

用户追加两组实验：**A 同模型脚本复制队**（明确「参考 1V1」）与 **B 每届随机组队、多届综合排名看个人发挥**；每组各跑核心与全扩，每场跑完即写报告到 `reply/`。

- **22:37** `test/team-lab.test.js` 落盘；新内核 `src/engine/team-lab.js`（复制队构建、种子驱动随机组队、个人统计、团队 Bradley–Terry IRLS）、执行器 `src/team-lab-cli.js`、汇总 `src/team-lab-summary.js`、重算 `src/team-lab-recompute.js` 同期完成。
- 四场并行运行，主种子 `lab-2v2-2026-11-06`，12 届 × 5 轮 × BO8，共 **8640 局**：

| 报告 `generatedAt`（UTC+8） | 赛事 | 局数 | 耗时 | 榜首 |
|---|---|---:|---:|---|
| 22:40:06 | B · 核心 | 1440 | 256.5s | `deepseek v4.1flash` β=1.3108 |
| 22:42:09 | B · 全扩 | 1440 | 371.8s | `deepseek v4.1flash` β=0.9083 |
| 22:44:05 | A · 核心 | 2880 | 505.1s | `deepseek v4.1flash` 88.96% |
| 22:49:12 | A · 全扩 | 2880 | 807.0s | `deepseek v4.1flash` 79.79% |

- 四场均零重赛、零异常重试、零前瞻回退、座位配平通过；前位队胜率 54.31%～55.28%。
- **22:53** 口径修正：复制队每局占 2 个座位，初版 `memberStats` 把「参与局数」按座位计成 960，改为按局去重（480 局）并另记「座位次数」；从报告逐局记录重算派生统计，未重跑对局、未改赛程与胜负。同批写入 4 份 `.json` + 4 份 `.md` + `star-realms-2v2-lab-summary.md`。
- 测试基线由 62 → **71/71 通过**；README 新增第 14 节。

### 7) 2026-11-06 22:56 · 实验成果推送

- 提交 `d4510f9`（`Add 2V2 lab: clone-team and random-team experiments`），跟踪文件 151 → 165，工作区干净。
- 远端 12 个关键路径全部 200（含 3.7M / 3.8M 大 JSON），`contents/video` 仍 404，remote URL 无 token。
- 当晚 `github.com` 直连不稳（curl 3 次仅 1 次 200），git push 清空代理 env 后**第 4 次**成功。

### 8) 2026-11-07 10:58–11:02 · 观战台 UI 更新

**触发**：用户先确认「观战台的 UI 界面更新了吗」，得到「未更新，实验是纯 CLI 链路」的答复；随后明确要求「更新观战台 UI，并为本次更新写一份时间线文档」。

| 时间 | 动作 | 文件 |
|---|---|---|
| 10:58:46 | 顶部新增「2V2 实验室」按钮与只读对话框 | `public/index.html` |
| 10:58:57 | 新增实验室样式（复用现有深色看板变量） | `public/tournament.css` |
| 11:00:45 | 新增刷新/渲染/四场切换/四个标签/下载绑定；原有 1.5s 看板轮询保持不变 | `public/app.js` |
| 11:01:07 | 新增 4 项回归与集成测试 | `test/lab-ui.test.js` |
| 11:01:42 | 新增只读 `/api/lab` 与白名单 `/api/lab/full` | `src/server/server.js` |
| 11:02 前后 | 无头 Edge 验收、三张截图、本时间线文档 | `test-artifacts/lab-ui-*.png`、`TIMELINE.md` |

**实现要点**

- 服务端 `readLab()` 按 4 份报告的 mtime 签名缓存，只返回榜单、账目、个人统计与各届冠军；剔除逐轮逐局明细后看板约 **240 KB**（单份完整报告 3MB 级）。`/api/lab/full?run=` 用白名单校验，越界返回 400。
- UI 沿用「顶部按钮 → dialog」模式：四场概览卡、交叉结论条、四场切换按钮、账目格、四个标签（复制队能力榜 / 个人 β 榜、在场统计、各届冠军、口径与复现）、完整报告下载。**只读**，不启动对局、不写报告、不改动原有对局 / 1v1 瑞士轮 / 2V2 组队赛面板。
- 实验 B 以 β 为主口径；全扩下「在场队伍胜率第一」与「β 第一」不一致时的说明写进「口径与复现」标签。

**验收**

- 全量测试 **75/75 通过**（新增 4 项：HTML 挂载点、前端绑定、服务端白名单/缓存、API 集成）。
- 无头 Edge + CDP 实测：对话框打开、4 个赛事按钮、A 核心 12 行总榜、切换到 B 全扩后 12 行 β 榜、口径页 5 条说明与复现命令、下载链接随赛事变化，均通过（`UI_CHECK_OK`）。
- 截图：`test-artifacts/lab-ui-a-core.png`、`lab-ui-b-all.png`、`lab-ui-notes.png`；三张均无溢出、截断、重叠或乱码。

---

### 9) 2026-11-08 20:19–20:45 · 扩展牌包与 3V3 模式（本次）

**触发**：用户要求「做一下其他扩展，并写大将战，多头龙模式的对战」。范围按确认后的口径执行：Frontiers 全量 + 两个 Crisis 小扩、Emperor 与 Commander 两套规则、6 人三头龙；「多头龙」对应官方 Two-Headed / Three-Headed Hydra，前者已由既有 `team2v2` 等价实现。

| 时间 | 动作 | 文件 |
|---|---|---|
| 20:19:57 | 模式泛化：`TEAM_SPECS` 支持 2/3 人队，新增 `hydra3` 与 `emperor` 的攻击/目标/淘汰规则 | `src/engine/modes.js` |
| 20:22:09 | 新增 6 项 6 人团队规则测试（共享权威、提督限制、大将阵亡、移牌） | `test/team-modes.test.js` |
| 20:24:19 | 卡池接入三个新牌包与牌堆构建 | `src/engine/cards.js` |
| 20:31:58 | 新增 6 人模式赛事执行器（随机三人队、完整单循环、BO6 座位/大将配平） | `src/mode-tourney-cli.js` |
| 20:32:57 | 引擎补方言：双同盟、按费用获得战斗、弃牌换战斗、双基地条件、`topDeckNextBase`、`minScrap`、`acquireCheapFree.toTop` | `src/engine/engine.js` |
| 20:33:30–34 | 生成脚本补「按已实现效果反写中文卡面」，生成 42 + 7 + 6 种 | `tools/build-extra-expansions.mjs`、`src/engine/expansions-extra.js` |
| 20:34:47 | 新增 6 项扩展方言与 3V3 编排测试 | `test/extra-expansions.test.js` |
| 20:35:55 | 实验室 API 扩到 8 场（2V2 四场 + 3V3 四场），按需精简 | `src/server/server.js` |
| 20:37:07 | 前端：8 场切换、3V3 口径页、锦标赛牌包勾选改为动态渲染 | `public/app.js` |
| 20:37:39 | 三头龙 · 核心完赛（432 局，159.5s） | `reply/star-realms-hydra3-core.json` |
| 20:37:45 | 大将战 · 核心完赛（432 局，161.5s） | `reply/star-realms-emperor-core.json` |
| 20:39:19 | 三头龙 · 全扩完赛（432 局，257.7s） | `reply/star-realms-hydra3-all.json` |
| 20:39:33 | 大将战 · 全扩完赛（432 局，265.4s） | `reply/star-realms-emperor-all.json` |
| 20:40:10 | 四场横向汇总 | `reply/star-realms-3v3-summary.md` |
| 20:41:27 | 对话框标题改为「对局实验室 · 八场对照」，按钮改为「对局实验室」 | `public/index.html` |
| 20:43 前后 | 无头 Edge 验收四张截图；README 第 16 节 | `test-artifacts/lab-ui-3v3-*.png`、`README.md` |

**实现要点**

- **扩展卡牌**：卡名/费用/张数取本地 `sr_all_cards.json`，效果显式映射；未映射的 6 种（Repair Mech、Warpgate Cruiser、Mobile Market、Death World、Construction Hauler、Mega Mech）不生成、不静默降级。卡面 `text` 由已实现效果反写，避免脚本读到与引擎不一致的卡面。
- **双同盟兼容**：动作以 `ability: 'ally'` + `double: true` 下发，12 份既有脚本无需改动即可处理；引擎内部用 `ally` / `ally#2` 分别记账。
- **3V3 赛制**：每届 12 模型随机分成 4 队，完整单循环（3 轮 × 2 场），每场 BO6；队内座位逐局轮换，每名队员在 6 个座位各坐 1 次，大将战另让每人各当 2 次大将。座位与角色配平在完赛时断言，不通过直接报错。
- **前位偏差**：BO6 把先后手配成 3:3，但前位队胜率仍只有 41%–44%（三头龙）与 29%–33%（大将战），原因是引擎「先手 3 张、后手 5 张」；该数字只描述本规则，不代表赛制不公。

**验收**

- 全量测试 **87/87 通过**（新增 6 项扩展方言/编排测试 + 6 项 6 人团队规则测试；`test/lab-ui.test.js` 扩到 8 场断言）。
- 四场账目：各 432/432 局、每人 216 局、零重赛、零异常重试、座位配平通过、大将角色配平通过、夺冠合计 36（12 届 × 3 人）。
- 无头 Edge + CDP 实测：8 个赛事按钮、切到三头龙核心（432 局 / 43.75% / 座位配平）、切到大将战全扩看口径页与各届冠军页、回切 2V2 复制队榜 12 行；控制台无错误（`test-artifacts/lab-ui-3v3-*.png`）。
- 显著性：单场 432 局，四场全部 β 的最大 |z| = 1.872，均未达 95% 显著；「四场第一一致」为跨场一致性观察，不作为已证明的强弱排序。

---

## 三、证据索引

| 事实 | 证据 |
|---|---|
| 提交时间与哈希 | `git log --format='%h %ad %s' --date=iso-strict` |
| 各阶段落盘时刻 | 文件 mtime（`stat -c %y`），见本文件 §二逐条 |
| 赛果生成时刻 | 各报告 `generatedAt`（UTC，已换算 +08） |
| 四场账目守恒 | `reply/star-realms-2v2-*.json` 的 `audit.playedGames / rematches / retries / seatBalanced` |
| 3V3 四场账目守恒 | `reply/star-realms-{hydra3,emperor}-*.json` 的 `audit.playedGames / seatBalanced / emperorBalanced` |
| 3V3 交叉结论与显著性 | `reply/star-realms-3v3-summary.md` |
| 扩展卡牌覆盖率与未实现清单 | `tools/build-extra-expansions.mjs` 生成时的输出；`src/engine/expansions-extra.js` 的 55 种定义 |
| 交叉结论 | `reply/star-realms-2v2-lab-summary.md` |
| 视频与素材口径 | `README.md` 第 13 节；`video/storyboard.json` |
| 模型 ID 验证 | `README.md` 第 7 节；`subagents.json` 的 `modelId / modelVerified` |
| 本次 UI 验收 | `test/lab-ui.test.js`；`test-artifacts/lab-ui-*.png`、`lab-ui-3v3-*.png` |
| 工作日志 | `F:/producing/game/.workbuddy/memory/2026-11-05.md`、`2026-11-06.md` |

## 四、口径与边界

- **时间精度**：只精确到已有留痕（git 提交秒级、报告 `generatedAt` 秒级、文件 mtime 秒级）；用户指令的精确时刻除本次（10:55）外未逐条留痕，故按「同日」表述，不做推断。
- **报告采用范围**：视频与 B 站文案只用了 `reply/star-realms-swiss-report3.json`、`team-swiss-report2.json`、`replay2.json`、`tournaments/swiss-models-20261105-guided.json` 与 README；`replay1.json`、`swiss-report1/2.json`、`team-swiss-report1.json`、`swiss-final-20261105*.json`、`team-swiss-20261106-preforward.json` 均为迭代留痕，未用于结论。
- **结论适用范围**：所有胜率、β、CI 与 z 只适用于本赛制、本牌包与这组种子；2v2 胜负由队伍共享，个人指标是统计估计而非直接测量。
- **仓库边界**：`video/` 始终被 `.gitignore` 排除，两次推送后远端 `contents/video` 均为 404；PAT 仅临时注入推送命令，未写入 `.git/config`，仍建议用后撤销。
- **本次 UI 的边界**：只读展示 `reply/` 已落盘报告；不提供「从界面启动新实验」，复现仍走 `src/team-lab-cli.js` 或 `src/mode-tourney-cli.js` 命令行。
- **3V3 结论强度**：单场 432 局，四场 β 的 |z| 最大 1.872，均未达 95% 显著；「deepseek v4.1flash 四场第一」是跨场一致性，不是已证明的排序。前位队胜率低于 50% 是引擎起手张数规则所致，已在 README 第 16 节说明。
