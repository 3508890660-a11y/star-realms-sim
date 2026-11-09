# 星域奇航 AI 模拟器 · 项目时间线

> 本文为 **2026-11-08「扩展牌包 + 3V3 模式」及其后的两轮规则修正**而写，以最后一次修正为终点回溯全项目（初版写于 2026-11-07 观战台 UI 更新）。
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
| 9 | 2026-11-08 20:19–20:45 | 扩展牌包（Frontiers + 两个危机小扩）、三头龙/大将战 3V3、四场正式赛 | `src/engine/expansions-extra.js`、`src/mode-tourney-cli.js`、`reply/star-realms-{hydra3,emperor}-*.json`、`reply/star-realms-3v3-summary.md` |
| 10 | 2026-11-08 20:58–21:08 | 大将战提督对位修正 + 两场重跑 + 看板与文档同步 | `src/engine/modes.js`、`test/team-modes.test.js`、`reply/star-realms-emperor-*.json`、`reply/star-realms-3v3-summary.md` |
| 11 | **2026-11-08 21:14–21:37** | **多头龙修正：整队轮流 + 2V2 起手牌，九份团队模式报告重跑** | `src/engine/engine.js`、`src/engine/modes.js`、`reply/star-realms-{2v2-*,team-swiss-report2,hydra3-*,emperor-*}.json` |

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

### 9) 2026-11-08 20:19–20:45 · 扩展牌包与 3V3 模式（大将战数据为修正前版本）

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
- 显著性：单场 432 局，四场全部 β 的最大 |z| = 1.872，均未达 95% 显著。此处「四场第一都是 deepseek」的观察在阶段 10 修正提督对位后不再成立（大将战全扩场变为 KIMI 3.1pro），两场大将战已重跑，见阶段 10。

---

### 10) 2026-11-08 20:58–21:08 · 大将战提督对位修正（数字已被阶段 11 覆盖）

**触发**：用户质疑「皇帝可以打任何人，将领在对方将领解决前不能进攻敌方皇帝」，要求核对大将战实现逻辑。

**诊断**：`oppositeSeat` 用 `(座位 + 1) % 6` 计算提督对位，而座位是两队交替（0/2/4 对 1/3/5）。三种大将轮换 `[0,1]` / `[2,3]` / `[4,5]` 下，各有一名提督的「+1」落到敌方大将身上（5→0、1→2、3→4），等于开局即可直击大将；同时 3 号提督的对位被算成 4 号（正确应为 2↔3、4↔5），对位关系不对称。

| 时间 | 动作 | 文件 |
|---|---|---|
| 20:58 | 逐一枚举三种轮换下六名玩家的可攻击目标，确认「各有一名提督越权打大将」 | 诊断输出（本例未落盘） |
| 20:59:24 | 改为「两队提督按队内座位序配对」并互为映射，大将不参与配对；`canAttackPlayer` / `canTargetBase` 同步处理无对位情形 | `src/engine/modes.js` |
| 20:59:47 | 新增 2 项测试：三种轮换下的对位互映射、未解锁不得打大将、大将可打全部敌方、实际动作列表不含敌方大将 | `test/team-modes.test.js` |
| 21:01:45 | 大将战 · 核心重跑（432 局，90.8s） | `reply/star-realms-emperor-core.json` |
| 21:03:34 | 大将战 · 全扩重跑（432 局，198.9s） | `reply/star-realms-emperor-all.json` |
| 21:04:22 | 四场汇总重生成，加入规则修正说明 | `reply/star-realms-3v3-summary.md` |
| 21:05:56 | README：16.4 换修正后数字、新增 16.6 修正记录与已知偏差 | `README.md` |
| 21:07:18 | 看板：不一致时显示「出现最多的榜首 + 场次」；账目格兼容 3V3 字段并新增大将角色配平 | `public/app.js` |
| 21:07:25 | 重拍 5 张验收截图（含新增大将战全扩） | `test-artifacts/lab-ui-3v3-*.png` |

**结果变化**

| 项目 | 修正前 | 修正后 |
|---|---|---|
| 大将战核心 β 第一 | deepseek v4.1flash 0.619（在场 58.80%） | deepseek v4.1flash 0.4623（57.87%） |
| 大将战全扩 β 第一 | deepseek v4.1flash 0.4486（58.80%） | **KIMI 3.1pro 0.3759（55.56%）** |
| 两场前位队胜率 | 32.64% / 28.94% | 42.36% / 41.67% |
| 四场榜首 | 全部 deepseek | 3 场 deepseek + 1 场 KIMI |

**验收**：全量测试 **89/89**；三头龙两场未受影响，3V3 四场账目仍为 432/432 局、每人 216 局、零重赛、零重试、座位与大将角色配平通过；无头 Edge 重拍截图，控制台无错误。

**未改的已知偏差**：回合顺序（官方为两队各自连续行动，当前逐座位交替）与 1 贸易移牌的「相邻队友」限制，已在 README 16.6 标注，待确认是否按官方重做座位模型。

---

### 11) 2026-11-08 21:14–21:37 · 多头龙修正：整队轮流 + 2V2 起手牌（本次）

**触发**：用户追问「多头龙是否也有问题」。对照官方 Two-Headed / Three-Headed Hydra 后确认两处：2v2 起手牌是 `[3,4,5,5]`（官方为 `[3,3,5,5]`）；回合结构是逐座位交替而非官方「整队轮流」，导致队友无法合击同一座基地、转移的资源要等下一轮才到账。

| 时间 | 动作 | 文件 |
|---|---|---|
| 21:14 | 实测三项：2v2 起手 `3/4/5/5`；0 号把基地打到剩 3、回合结束后伤害清零，队友只能从头打；转移的 3 贸易要等队友下个回合 |
| 21:19:14 | `modes.nextTeamTurn()`：同队按座位升序连续行动后再换队 | `src/engine/modes.js` |
| 21:19:53 | `endTurn()` 改为队末结算（队内只清个人资源与标记，不弃手/不补牌/不清伤害）；起手牌按队发放，覆盖 `team2v2` | `src/engine/engine.js` |
| 21:20:23 | 2v2 转移测试改为「同队回合内到账」 | `test/expansions.test.js` |
| 21:20:50 | 新增 4 项团队回合测试（起手牌、整队顺序、跨队友合击、队末补牌） | `test/team-modes.test.js` |
| 21:24:51 | 三头龙 · 核心重跑（432 局） | `reply/star-realms-hydra3-core.json` |
| 21:25:26 | 大将战 · 核心重跑（432 局） | `reply/star-realms-emperor-core.json` |
| 21:26:51 | 三头龙 · 全扩重跑（432 局） | `reply/star-realms-hydra3-all.json` |
| 21:27:21 | 实验 B · 核心重跑（1440 局） | `reply/star-realms-2v2-random-core.json` |
| 21:27:26 | 大将战 · 全扩重跑（432 局） | `reply/star-realms-emperor-all.json` |
| 21:28:55 | 实验 B · 全扩重跑（1440 局） | `reply/star-realms-2v2-random-all.json` |
| 21:31:40 | 实验 A · 核心重跑（2880 局） | `reply/star-realms-2v2-clone-core.json` |
| 21:36:06 | 实验 A · 全扩重跑（2880 局） | `reply/star-realms-2v2-clone-all.json` |
| 21:36:15 | 2V2 组队赛重跑（1440 局），报告同步到 `reply/` | `reply/star-realms-team-swiss-report2.json` |
| 21:36:48 | 两份汇总重生成（含规则修正说明） | `reply/star-realms-2v2-lab-summary.md`、`reply/star-realms-3v3-summary.md` |

**结果变化**

| 项目 | 修正前 | 修正后 |
|---|---|---|
| 2V2 组队赛冠军 | DeepSeek 联队 86.04%（413/480）、11 冠 | DeepSeek 联队 83.33%（400/480）、9 冠 |
| 2V2 组队赛前位胜率 | 54.03% | 53.06% |
| 2V2 实验室 A 核心 / 全扩 | 88.96% / 79.79% | 87.50% / 73.12% |
| 2V2 实验室 B 核心 / 全扩 β | 1.3108 / 0.9083 | 1.2135 / 0.832 |
| 3V3 前位胜率 | 41%–44% | 54%–56% |
| 三头龙 β（核心 / 全扩） | 1.3452 / 0.9031 | 1.1299 / 0.7378 |
| 大将战核心 β 第一 | deepseek v4.1flash | MiniMax M3 |

**验收**：全量测试 **93/93**；九场账目全部守恒（局数、每人参与局数、零重赛、零重试、座位配平、大将角色配平）；前位胜率抬升的原因是整队轮流下先手队三人连续行动、可合击同一目标，3 张起手只部分对冲。

**仍未改**：大将战 1 贸易移牌允许任意队友，官方限「相邻队友」。

### 12) 2026-11-08 22:03–次日 00:18 · 按程序更新重启 12 个 subagent（无结果泄漏）

**触发**：阶段 9–11 把程序改了（新增 `hydra3` / `emperor`、3 个交易牌包、新动作方言，并修正整队轮流与 2v2 起手牌），而 12 份 AI 脚本仍写于 11-05 的旧程序。用户要求「完成后重启 subagent，让它们依照程序更新为脚本做出调整，不要让它们看到之前的实验结果」。

**做法**：

1. 在项目外建隔离目录 `F:/producing/game/_sr-agent-refresh-20261108/`，只放三份说明（任务说明 / 纯程序更新清单 / 脚本接口）、6 个与项目内逐字节一致的规则内核副本、各模型**自己**的旧脚本、进度上报与自检工具。
2. 明确排除 `reply/`、`tournaments/`、`test-artifacts/`、`video/`、README 结果章节、TIMELINE、历史设计与进度文件、其它模型脚本；禁止联网与检索历史会话。三份说明与 12 份产物都做过结果类关键词扫描，零命中。
3. 12 个**全新** subagent 并行重启，沿用已验证真实模型 ID；从子会话日志 `requestModelId` 复核 **12/12 一致，无静默回退**。
4. 要求保留策略名称与核心思路，只做规则适配；逐条处理程序更新清单第 1–6 节，另写六节公开更新说明。
5. 进度先写入隔离目录，再同步回 `subagent-progress/*.json` 供看板读取。

**产物**：12 份 `scripts/agent-*.js` 修订版；`subagent-progress/<id>.md` 追加「附录 · 2026-11-08 按程序更新修订（隔离轮）」；`subagents.json` 标为 `strategyMode: program-update`；修订前脚本完整备份在 `scripts/_backup-pre-refresh-20261108/`；新增 `test/agent-refresh.test.js`。

**验收**：`node --check` 12/12；隔离自检（20 场景 / 60 次调用，含 `double:true`、`moveCard`、四类待决动作、冻结视图、未知动作）12/12 `ok=true`；**84 场真实对局**（12 脚本 × 7 模式 × 7 牌包组合）全部正常结束；全量 `npm test` **95/95**。

**边界（阶段 12 当时）**：本轮**未重跑任何锦标赛**，没有产生新的胜率/排名/β；`reply/` 与 `tournaments/` 内报告仍是修订前脚本的结果。该状态在同日阶段 13 已被全量重跑取代。隔离目录不在仓库内，不随提交上传。详见 `README.md` 第 17 节。

### 13) 2026-11-09 09:57–10:22 · 修订后脚本全量重跑（10 场 / 15,408 局）

**触发**：阶段 12 输出调整报告后，用户拍板「重跑，记得把记录放 reply 里」。

**做法**：

1. 覆盖前先归档修订前基线到 `reply/baseline-before-refresh/`（人读报告 + `metrics.json` 指标快照）；完整旧 JSON 由 git `72f646f` 保留。
2. `tools/rerun-20261109.mjs` 并发 5 编排 10 场：1v1 瑞士轮、2V2 组队赛、2V2 实验室四场、3V3 四场；主种子沿用 `swiss-2026-11-05` / `lab-2v2-2026-11-06` / `mode-3v3-2026-11-08`，参数逐项与旧报告一致。18 分 23 秒完成，10/10 退出码 0。
3. `tournaments/latest.*` 与 `team-latest.*` 复制为 `reply/` 正式文件名；重新生成两份横向汇总。
4. `tools/rerun-verify.mjs` 对 10 份报告做账目、逐局种子、胜者、座位/大将配平与 `config` 对基线（git `72f646f`）逐字段校验。

**结果**：1v1 冠军仍是 deepseek v4.1flash（73.00%→69.17%，11→8 冠，z 3.735→2.323）；2V2 组队赛冠军仍是 DeepSeek 联队（83.33%→81.67%，9→11 冠）；2V2 实验室四场榜首完全一致、仍是 deepseek v4.1flash（A 核心 87.50%→84.17%、A 全扩 73.12%→71.04%；B β 1.2135→1.1791 / 0.8320→0.7204）；3V3 四场 β 第一变成四个不同模型，最大 |z| 1.947→1.766，均未达 95% 显著。前位胜率 1v1 53.53%→53.06%、2V2 组队 53.06%→54.31%、3V3 54.86%–56.48%。

**顺带修复**：`src/team-lab-summary.js` 两处写死的历史数字（88.96%→79.79%、β 1.3108→0.9083、前位 54.31%～55.28%）在重跑后与新表格矛盾，改为动态生成；`src/mode-summary.js` 规则说明改为不含固定结论的表述。

**验收**：`node tools/rerun-verify.mjs` **10/10 全绿**（合计 15,408 局、逐局种子唯一、零重赛/重试/前瞻回退、配平全通过、`configMatchesBaseline=true`）；`npm test` **95/95**。

**产物**：`reply/` 10 份 `.json/.md` 正式报告、两份横向汇总、`reply/star-realms-refresh-20261109-summary.md`（新旧对照）、`reply/rerun-20261109/`（`manifest.json` / `logs/` / `metrics-after.json` / `verification.json`）。

**边界**：差异只来自脚本适配（引擎、种子、赛制均一致）；3V3 榜首易主在抽样噪声内；第 10 / 11 / 14 / 16.4 节与已发布视频仍是历史记录。详见 `README.md` 第 18 节。

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
| 提督对位修正 | `src/engine/modes.js` 的 `admiralSeats` / `oppositeSeat`；`test/team-modes.test.js` 的两项对位测试 |
| 修正后大将战结果 | `reply/star-realms-emperor-*.json` 的 `generatedAt`（`13:01:45Z` / `13:03:34Z`，即 21:01 / 21:03）与汇总里的「规则修正说明」 |
| 整队轮流与 2v2 起手牌 | `test/team-modes.test.js` 的 4 项团队回合测试；九份报告 `generatedAt` 落在 21:24–21:36 |
| 扩展卡牌覆盖率与未实现清单 | `tools/build-extra-expansions.mjs` 生成时的输出；`src/engine/expansions-extra.js` 的 55 种定义 |
| 交叉结论 | `reply/star-realms-2v2-lab-summary.md` |
| 视频与素材口径 | `README.md` 第 13 节；`video/storyboard.json` |
| 模型 ID 验证 | `README.md` 第 7 节；`subagents.json` 的 `modelId / modelVerified` |
| 按程序更新重启（隔离、无结果泄漏） | `README.md` 第 17 节；`test/agent-refresh.test.js`；`subagent-progress/<id>.md` 的「附录 · 2026-11-08」；`scripts/_backup-pre-refresh-20261108/` |
| 12 个模型如何调整（无赛果） | `reply/star-realms-agent-refresh-report.md` / `.json`；`README.md` 17.6 的前哨护盾口径补正 |
| 修订后全量重跑（10 场 / 15,408 局） | `reply/rerun-20261109/manifest.json` / `verification.json` / `metrics-after.json`；`reply/star-realms-refresh-20261109-summary.md`；`README.md` 第 18 节 |
| 修订前基线 | `reply/baseline-before-refresh/metrics.json` 与归档 `.md`；完整旧 JSON 在 git `72f646f` |
| 本次 UI 验收 | `test/lab-ui.test.js`；`test-artifacts/lab-ui-*.png`、`lab-ui-3v3-*.png` |
| 工作日志 | `F:/producing/game/.workbuddy/memory/2026-11-05.md`、`2026-11-06.md` |

## 四、口径与边界

- **时间精度**：只精确到已有留痕（git 提交秒级、报告 `generatedAt` 秒级、文件 mtime 秒级）；用户指令的精确时刻除本次（10:55）外未逐条留痕，故按「同日」表述，不做推断。
- **报告采用范围**：视频与 B 站文案只用了 `reply/star-realms-swiss-report3.json`、`team-swiss-report2.json`、`replay2.json`、`tournaments/swiss-models-20261105-guided.json` 与 README；`replay1.json`、`swiss-report1/2.json`、`team-swiss-report1.json`、`swiss-final-20261105*.json`、`team-swiss-20261106-preforward.json` 均为迭代留痕，未用于结论。
- **结论适用范围**：所有胜率、β、CI 与 z 只适用于本赛制、本牌包与这组种子；2v2 胜负由队伍共享，个人指标是统计估计而非直接测量。
- **仓库边界**：`video/` 始终被 `.gitignore` 排除，两次推送后远端 `contents/video` 均为 404；PAT 仅临时注入推送命令，未写入 `.git/config`，仍建议用后撤销。
- **已发布视频的口径**：纪录片与 B 站文案使用的是**修正前**的团队模式数字（2V2 组队赛 86.04%、2V2 实验室 88.96% 等），与当前 `reply/` 报告不一致；视频只作为当时状态的记录，结论以本文件阶段 11 之后的报告为准。
- **阶段 12 本身的口径**：12 份 AI 脚本已在无结果泄漏的隔离会话中按新版程序修订；阶段 12 只产生「可加载、可完成对局」的验收证据，不产生胜率数据。同日阶段 13 已用修订后脚本全量重跑 10 场，因此 `reply/` 当前报告对应**修订后脚本**，阶段 1–11 与本文件 §二 1–11 的胜率/β/排名只作为**修订前历史记录**保留；完整旧基线见 `reply/baseline-before-refresh/` 与 git `72f646f`。评价当前表现请用 `reply/` 当前报告与 `reply/star-realms-refresh-20261109-summary.md`。
- **本次 UI 的边界**：只读展示 `reply/` 已落盘报告；不提供「从界面启动新实验」，复现仍走 `src/team-lab-cli.js` 或 `src/mode-tourney-cli.js` 命令行。
- **团队模式的剩余偏差**：回合结构与 2V2 起手牌已在阶段 11 修正；大将战的 1 贸易移牌仍允许任意队友（官方限「相邻队友」）。详见 `README.md` 16.7。
- **3V3 结论强度**：单场 432 局，四场 β 的 |z| 最大 1.872，均未达 95% 显著；「deepseek v4.1flash 四场第一」是跨场一致性，不是已证明的排序。前位队胜率低于 50% 是引擎起手张数规则所致，已在 README 第 16 节说明。
