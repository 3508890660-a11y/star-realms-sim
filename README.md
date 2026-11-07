# 星域奇航 · 战术模拟器

一个零运行时依赖的《星域奇航》（Star Realms）本地电子版模拟器。包含基础盒、殖民战争、危机事件、2V2 团队模式、确定性规则引擎、独立 AI 脚本座位、命令行批量对局、可暂停/单步/倍速的 Web 观战界面，以及 12 模型脚本工厂实时看板。

> 非官方开源实现。界面与图形均为原创，没有复制 Steam 版的图片、音频或程序集。规则文字与卡牌数据根据官方规则书、官方产品页、卡牌资料及用户提供的本地资料整理。

## 1. 立即运行

要求：**Node.js 20 或更高版本**。不需要 `npm install`。

**推荐（Windows 双击）：** 直接双击项目根目录的 `start-server.bat`。它会在独立窗口启动服务、自动打开浏览器，且**不依赖当前终端或对话会话**；若 4397 端口已有服务，会只打开浏览器而不重复启动。关闭那个黑色窗口即可停止服务。

命令行方式：

```bash
cd F:/producing/game/star-realms-sim
npm start
```

浏览器打开：**http://127.0.0.1:4397**

> 若浏览器提示「无法访问此网站」，说明服务进程没在跑：双击 `start-server.bat` 即可。若页面已经打开但服务中途断开，页面顶部会出现橙色横幅，提示运行该脚本，并每 4 秒自动重连——恢复后横幅自动消失、对局数据自动刷新，无需手动刷新页面。**注意**：对局状态保存在服务进程内存中，重启服务会回到初始欢迎对局；需要留存的请先用「导出回放」或瑞士轮报告。

初始对局处于暂停状态。点击“新建对局”，选择模式、扩展组合、随机种子和每个座位的脚本；选择“人类座位”即可亲自操作该方，其他座位仍由各自 AI 驱动。点击顶栏 **AI 工厂** 可实时查看 12 个模型脚本的进度、阶段摘要与公开设计说明。

- **继续 / 暂停**：自动推进或停住 AI。
- **单步执行**：暂停时只执行当前 AI 的一个动作。
- **行动间隔**：控制自动对局速度；极速适合观察终局。
- **观察视角**：全局观战可见所有手牌；人类视角只能看到自己的手牌。
- **导出回放**：下载包含初始配置与全部动作的 JSON。
- 空格键暂停/继续，`N` 单步。

如需换端口：

```bash
PORT=4400 node src/server/server.js
```

服务只监听 `127.0.0.1`，不提供公网访问或联网对战。

## 2. 模式与扩展组合

### 模式

| ID | 模式 | 人数 | 胜负与目标 |
|---|---|---:|---|
| `standard` | 标准双人 | 2 | 50 权威，先手 3 张、后手 5 张 |
| `ffa` | 自由混战 | 3–4 | 可攻击任何对手，最后存活者获胜 |
| `hunter` | 猎杀 | 3–4 | 只能攻击左手边玩家及左右邻家基地 |
| `firstBlood` | 猎杀·先血 | 3–4 | 首位玩家败北时，其右手边玩家立即获胜 |
| `team2v2` | 2V2 团队 | 4 | 座位 1/3 与 2/4 组队，同队共享 75 权威 |

### 自由勾选牌包

| ID | 牌包 | 张数 | 作用 |
|---|---|---:|---|
| `core` | 基础盒交易牌堆 | 80 | 48 种基础牌，标准环境 |
| `colonyWars` | 殖民战争交易牌堆 | 80 | 43 种全新牌，可单独使用或与基础盒混洗 |
| `events` | 危机事件牌 | 12 | 8 种事件，洗入任意交易牌堆；翻出即结算 |

任意组合都可用：核心、殖民战争、核心+殖民战争，以及上述任一组合叠加事件。若只勾选事件，系统自动补入核心交易牌堆。设置界面由 `/api/options` 动态生成，因此后续新增牌包只需扩充 `EXPANSION_PACKS`，无需改前端。

### 2V2 团队规则

- 座位 0/2 为第一舰队，1/3 为第二舰队；四席按 0→1→2→3 轮换，双方交替行动。
- 同队共享权威池；攻击任一队员都会扣减整队权威，权威归零时对方整队获胜。
- 任一队友控制前哨，即保护全队玩家与全队非前哨基地。
- 可把本回合多余贸易/战斗通过 `transfer` 预留给队友；队友回合开始时进入其资源池。
- 每个座位仍拥有独立牌库、手牌、场上区和 AI 脚本。

### 事件规则

事件牌进入交易行时立刻结算，随后销毁并从交易牌库补牌；初始交易行不会触发事件。事件影响所有玩家；2V2 按队伍各结算一次。黑洞、轨道轰击、彗星、跃迁会生成由受影响座位决策的 `eventChoice` 动作。数字版口径下，会降低权威的事件不能把权威降到 1 以下。

## 3. 命令行自动对局

```bash
# 一场双人局，逐动作输出
node src/cli.js play --mode standard --p1 tactical --p2 random --seed demo

# 安静跑完并保存回放
node src/cli.js play --p1 tactical --p2 economic --seed demo --quiet true --save replay.json

# 批量测试；双人局每两场交换一次先后手
node src/cli.js batch --p1 tactical --p2 economic --games 50 --seed league

# 三人猎杀，每方可使用不同脚本
node src/cli.js play --mode hunter --seats tactical,economic,random --seed hunt

# 2V2 + 基础盒 + 殖民战争 + 事件
node src/cli.js play --mode team2v2 --seats tactical,economic,random,tactical --sets core,colonyWars,events

# 仅殖民战争牌堆 + 事件
node src/cli.js play --sets colonyWars,events --seed solo-set

# 校验回放可还原；列出脚本
node src/cli.js replay --file replay.json
node src/cli.js scripts

# 12 模型瑞士轮锦标赛（详见第 10 节）
node src/cli.js swiss --seed swiss-2026-11-05 --seasons 12 --rounds 5 --per-side 5 --sets core
```

`--sets` 接受 `core,colonyWars,events` 的任意子集；旧式 `--deck core|colonyWars|mixed --events true` 仍然兼容。

内置 AI：

| ID | 名称 | 用途 |
|---|---|---|
| `tactical` | 战术核心 | lethal、前哨、同盟、牌组压缩与价值购买 |
| `economic` | 贸易演算 | 偏好贸易、过牌和压缩 |
| `random` | 随机漫游 | 合法动作随机基线 |
| `script:example.js` | 廉价快攻示例 | 用户脚本模板 |
| `script:agent-*.js` | 12 模型脚本 | 由 12 个真实模型 ID 已验证的 subagent 分别重写（见第 7 节） |

## 4. 整体架构

```text
┌──────────────────────────────────────────────────────┐
│  public/  观战、配置与 AI 工厂看板                   │
│  原生 HTML/CSS/JS · 卡牌桌面 · 日志 · SSE 实时状态    │
└───────────────────┬──────────────────────────────────┘
                    │ HTTP JSON + 两条 SSE 流
┌───────────────────▼──────────────────────────────────┐
│  src/server/server.js  本地服务                      │
│  视角脱敏 · 人类动作 · 自动推进 · 牌包/模式选项        │
│  聚合 subagent 进度文件并推送看板                    │
└───────────────────┬──────────────────────────────────┘
                    │ 同一 MatchRunner，无第二套规则
┌───────────────────▼──────────────────────────────────┐
│  src/engine/runner.js  对局调度器                    │
│  决策座位 · 脚本超时 · 动作记录 · 回放 · 结果统计      │
└──────────────┬────────────────────────┬──────────────┘
               │                        │
┌──────────────▼─────────────┐  ┌───────▼───────────────┐
│  src/ai/ + scripts/        │  │  src/engine/           │
│  控制器与 15+ 脚本          │  │  唯一规则内核           │
│  本人视角 + 合法动作选择    │─▶│  状态/动作/效果/随机数  │
│  不可直接修改游戏状态       │  │  所有动作再次校验       │
└────────────────────────────┘  └───────────────────────┘
```

### 规则内核

- `cards.js`：基础盒定义、扩展合并、牌包目录与交易牌堆构造。
- `expansions.js`：43 种殖民战争牌与 8 种事件牌的结构化效果。
- `engine.js`：唯一状态变更入口；负责合法动作、主要/同盟/销毁能力、事件队列、团队权威、目标与待决选择、购买、战斗、淘汰、回合清理和视角脱敏。
- `modes.js`：五种模式的目标限制与胜负规则。
- `rng.js`：可序列化的带种子随机数；洗牌只发生在引擎内。
- `runner.js`：决定当前该谁行动，调用相应脚本，保存动作与事件；回放只重放动作，不重放随机数。
- `swiss.js` / `tourney-cli.js`：瑞士轮配对、BO10 计分、多届聚合与逐局可复现赛程；与观战端共用同一个 `MatchRunner`。

引擎返回的每个动作都是普通 JSON 对象。无论来自内置 AI、用户脚本还是浏览器，动作都必须通过 `legalActions()` 与 `applyAction()` 的再次校验，脚本不能直接修改权威、贸易、战斗或卡牌区域。

## 5. 对局流程

1. **创建**：校验模式、座位与牌包；按勾选组合构造并洗混交易牌堆；每人建 8 Scout + 2 Viper 的初始牌库。
2. **初始手牌**：标准模式 3/5；多人 3/4/5/5。交易行翻至 5 张，事件牌沉到牌库底等待之后翻出。
3. **主阶段**：打出卡牌、基地主要能力、已触发同盟、销毁能力、购买、攻击、2V2 资源预留可任意交错。
4. **待决选择**：强制弃牌、多人目标、强制销毁、事件选择等生成 `pending`；调度器自动切换到实际决策者。
5. **事件链**：事件结算后销毁并补齐交易行；连锁翻出新事件时通过队列串行处理，避免多个并发待决。
6. **回合清理**：清空贸易/战斗，飞船和余手进入弃牌，基地保留，临时复制与每回合标记复位，补至 5 张。
7. **胜负**：标准局击败对手；混战/猎杀最后存活；先血首位败北即结算；2V2 对方团队权威归零。
8. **记录**：每次提交保存座位、动作、耗时和引擎事件。回放用相同配置重新执行同一动作序列。

### 规则边界

- 已实现基础盒、殖民战争、危机事件、探索者供应堆、基地/前哨、同盟、能力选择、牌库重洗、隐匿针舰/隐匿尖塔复制、直接入手牌、免费获得、置牌库顶等机制。
- 殖民战争部分高费基地的防御值在本地资料中缺失，按费用梯度补全并统一设为前哨；后续如取得官方卡面可只改 `expansions.js`，无需改引擎。
- 不包含 Gambit、Heroes、Fleets & Fortresses、Bases & Battleships、Frontiers、United、战役/挑战 Boss、官方 Hydra/Emperor、在线联机和账号系统。

## 6. AI 脚本接口

在 `scripts/` 新建 `.js` 或 `.mjs` 文件，刷新页面后即可选择，标识为 `script:文件名`。

```js
export const meta = {
  name: '我的 AI',
  description: '脚本说明'
};

export async function chooseAction({
  view,         // 深冻结的本人可见状态；对手手牌与所有牌库顺序已隐藏
  legalActions, // 深冻结的合法动作数组；必须原样返回其中一个
  playerId,     // 当前决策座位，从 0 开始
  random,       // 带种子的随机函数，返回 [0, 1)
  memory,       // 本座位、本局私有的可变记忆对象
  context       // { mode, turn, seed }
}) {
  memory.calls = (memory.calls || 0) + 1;
  const lethal = legalActions.find(a =>
    a.type === 'attack' &&
    a.targetType === 'player' &&
    a.amount >= view.players[a.targetId].authority
  );
  if (lethal) return lethal;

  const useful = legalActions.filter(a => a.type !== 'endTurn');
  if (!useful.length) return legalActions[0];
  return useful[Math.floor(random() * useful.length)];
}
```

### 视图中的重要字段

| 字段 | 含义 |
|---|---|
| `view.players[playerId]` | 本人权威、资源、手牌、牌库数、弃牌、场上牌、资源预留 |
| `view.players[other]` | 对手公开信息；`hand` 为空，`handCount` 保留数量 |
| `view.teams` / `view.winningTeam` | 2V2 队伍权威与获胜队伍 |
| `view.expansions` / `eventCardsRemaining` | 已启用牌包与牌库中剩余事件数 |
| `view.tradeRow` | 五个交易行卡实例 ID，可能暂时为 `null` |
| `view.cards[uid]` | 可见卡实例的名称、费用、阵营、类型、防御、规则文本、所属牌包 |
| `view.pending` / `view.eventContext` | 当前待决选择及事件队列 |
| `view.lastEvent` | 最近结算的事件名称与说明 |
| `view.activePlayer` | 当前回合座位；待决时决策座位可能不同 |
| `view.explorers` / `tradeDeckCount` | 探索者与交易牌库剩余数 |

### 常见动作

| 动作 | 示例/说明 |
|---|---|
| 打出 | `{ type:'play', cardId, copy:null }`；选择效果时另有 `choice`、`row` |
| 能力 | `{ type:'ability', cardId, ability:'primary'|'ally'|'optional'|'scrap', ... }` |
| 购买 | `{ type:'buy', row:0 }` 或 `{ type:'buy', explorer:true }` |
| 攻击玩家 | `{ type:'attack', targetType:'player', targetId:1, amount:4 }` |
| 攻击基地 | `{ type:'attack', targetType:'base', targetId:'c42', amount:5 }` |
| 队友预留 | `{ type:'transfer', targetId:2, resource:'trade', amount:3 }` |
| 强制弃牌 | `{ type:'discard', cardId }` |
| 指定弃牌目标 | `{ type:'targetDiscard', targetId }` |
| 强制销毁选择 | `{ type:'selectScrap', cardId }` |
| 事件选择 | `{ type:'eventChoice', eventId, targets|cards|baseId|pay }` |
| 结束回合 | `{ type:'endTurn' }` |

目标、多牌选择、效果选项等附加字段都应直接从 `legalActions` 返回，不要自行拼造。单次决策超过 **3000ms**、返回非列表动作、试图修改冻结视图或抛异常都会使对局暂停并显示错误。

**安全边界**：用户脚本是本机可信 ES 模块，在 Node.js 进程内加载。超时与视图冻结用于保证对局稳定，不是操作系统级安全沙箱；不要运行来源不明的脚本。

## 7. 12 模型脚本与实时进度看板

`subagents.json` 是 12 个任务的目录，同时记录每个任务的**真实模型 ID**（`modelId`）与验证状态（`modelVerified`）；每个 subagent 通过 `tools/report-progress.mjs` 把阶段、进度、当前设计摘要写入独立文件 `subagent-progress/<id>.json`，并另写一份公开设计说明 `subagent-progress/<id>.md`（开头注明执行模型 ID）。服务端聚合两者，由 `/api/subagents` 与 `/api/subagents/events` 提供快照和 SSE 推送。

### 模型 ID 验证（重要）

`Agent` 工具的 `model` 参数不认识传入值时会**静默回退到默认模型，且仍返回 `completed`**。首轮直接传用户给的显示名（如 `GLM5.3`、`MiniMax M3`），结果 11 个子会话实际运行 `hy4-free`、仅 `hy3` 生效。已按产品配置 `~/.workbuddy/cache/acc-product-config-v3-*.json` 的 `models[].id` 修正为有效 ID，用「只读探针 + 子会话 `providerData.requestModelId`」逐一验证 **12/12 生效**后重写全部脚本。

旧脚本与旧赛果保留在 `scripts/_backup-hy4free-20261105/` 与 `tournaments/swiss-final-20261105-hy4free.json/.md`；重写轮的统一任务说明见 `tools/agent-rewrite-brief.md`，保证 12 个 subagent 的接口与验收口径一致。

| 显示名 | 有效 model ID | 策略主题 | 显示名 | 有效 model ID | 策略主题 |
|---|---|---|---|---|---|
| hy4 | `hy4std` | 稳健中期经济 | hy3 | `hy3` | 极速压制 |
| GLM5.3 | `glm-5.3` | 舰队协同 | GLM5.3flash | `glm-5.3-flash` | 快攻闪击 |
| MiniMax M3 | `minimax-m3-pay` | 贸易滚雪球 | MiniMax M3.1flash | `minimax-m3.1-flash` | 牌组压缩 |
| KIMI 3.1pro | `kimi-k3.1-pro` | 局面推演 | KIMI 2.8preview | `kimi-k2.8-preview` | 基地控制 |
| deepseek v4.1flash | `deepseek-v4.1-flash` | 事件响应 | deepseek v4pro | `deepseek-v4-pro` | 团队调度 |
| step5preview | `step-5-preview` | 殖民战争 | MIMO-v2.6-pro | `mimo-v2.6-pro` | 混合博弈 |

顶栏 **AI 工厂** 看板显示：

- 模型显示名、真实 model ID、验证标记、策略主题、状态、进度条、目标脚本是否落盘；
- 实时的阶段摘要，例如「读取接口 / 设计策略 / 编写脚本 / 语法校验 / 已完成」；
- 右侧完整公开设计说明：核心思路、动作优先级、模式适配、事件与 2V2 处理、取舍；
- 完成数、进行中数、排队数、异常数与模型 ID 已验证数。

看板只展示可验证的任务状态与模型主动写下的设计说明，不展示内部推理。

### 自由策略轮（当前）

上一轮由主代理给每个模型指定策略主题；**当前轮不再指定任何主题或打法优先级**——每个模型自行判断 1v1 最优打法、自己命名策略、说明理由并独立实现，「选什么策略」与「能否写对」都算模型能力。统一任务说明见 `tools/agent-freeform-brief.md`，明确禁止读取任何已有 AI 实现（`scripts/agent-*.js`、`scripts/example.js`、`src/ai/*.js`、备份目录），只能依据接口文档与规则引擎独立设计；12 个子会话的实际模型 ID 再次逐一核对，12/12 生效。

各自选策略：`薄牌护城河` / `协同滚雪球` / `曲线竞速` / `精炼雪球` / `壁垒重锤` / `破垒夺权` / `压缩脉冲` / `蜂群速攻` / `三段涨潮` / `价值节奏快攻` / `雪球收割` / `闪电压制`。各模型选择理由与已知弱点见 `subagent-progress/<id>.md`。

## 8. 观战界面实现

- 服务端每个 AI 动作后通过 SSE 只发送变更通知，浏览器再获取对应视角快照；断线时轮询兜底。
- 观战快照展示所有手牌，但仍隐藏牌库顺序；人类快照只含本人手牌，并且只有当前应行动的人类座位收到 `legalActions`。
- 前端不计算费用、伤害或同盟。点击卡牌时，仅收集服务端给出的匹配动作；有多个分支时弹出动作选择器。
- 事件待决显示事件横幅与「选择事件响应」；2V2 显示队伍标签、共享权威、资源预留与预留按钮。
- 左右侧栏分别显示座位/资源和逐动作日志；中间为敌方基地、交易行与当前阵线。
- 所有界面素材均为 CSS 绘制，不使用外部字体、图片库或前端框架。

## 9. HTTP API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/options` | 模式与可勾选扩展牌包 |
| GET | `/api/scripts` | 内置与用户脚本列表 |
| GET | `/api/subagents` | 12 模型脚本任务聚合状态 |
| GET | `/api/subagents/events` | SSE 进度推送 |
| GET | `/api/tournament` | 瑞士轮实时进度 + 精简榜单（服务端按 mtime 缓存，逐局明细不随轮询传输） |
| GET | `/api/tournament/full` | 下载完整报告 JSON（含逐局种子与终局权威） |
| POST | `/api/tournament/start` | 启动新赛 `{ seed, seasons, rounds, perSide, sets }`；已有赛事运行时返回 409 |
| GET | `/api/team-tournament` | 2V2 组队赛实时进度 + 精简榜单 + 6 队构成目录 |
| GET | `/api/team-tournament/full` | 下载组队赛完整报告（逐局种子与 4 座位排列） |
| POST | `/api/team-tournament/start` | 启动组队赛 `{ seed, seasons, rounds, repeats, sets }`；运行中返回 409 |
| GET | `/api/match?perspective=spectator|0|1...` | 对应视角快照 |
| POST | `/api/match` | 创建对局，含 `mode/players/expansions/seed/autoRun/speed` |
| POST | `/api/control` | `pause/resume/step/speed` |
| POST | `/api/action` | `{ playerId, action }` 提交人类动作 |
| GET | `/api/events` | SSE 对局动作通知 |
| GET | `/api/replay` | 下载回放 JSON |

界面手动开赛：顶栏 **瑞士轮** → 设置主种子、届数、轮数、每边局数并勾选牌包 → **启动新赛**。服务端受理后立即写入 `running` 进度（不等 CLI 首次落盘），运行中重复提交返回 409；`seasons` 上限 24，与界面可选值一致。启动失败时配置区右侧会直接显示原因。

## 10. 瑞士轮锦标赛（12 模型排名）

`src/engine/swiss.js` 是纯赛制内核，`src/tourney-cli.js` 是编排器；两者复用同一个 `MatchRunner`，不会另开一套规则。目标是在标准双人 1v1 与指定牌包下，用**可复现的随机种子与随机排序**决出 12 个模型脚本中的最强者。

### 赛制

| 项目 | 设定 |
|---|---|
| 参赛 | `subagents.json` 中的 12 个模型脚本，各占一个独立座位 |
| 每场 | **BO10 = A 先手 BO5 + B 先手 BO5**，每局独立随机种子 |
| 单届 | 5 轮瑞士轮，每轮 6 场，12 人每轮恰好各打一场 |
| 配对 | 场分降序分组 → 组内随机排序 → 回溯完美匹配；优先同分、优先零重赛，必要时跨分组浮动 |
| 场分 | 胜 1 / 平 0.5 / 负 0；BO10 的局分用于破同分 |
| 单届排名 | MP → 局胜 GP → Buchholz（对手场分和）→ Sonneborn–Berger → 种子随机优先级 |
| 多届 | 每届用独立种子重新洗牌与配对，积分不跨届累积；聚合按 局胜率 → 累计场分 → 平均名次 |
| 默认环境 | `standard` 标准双人、`core` 基础盒；可改 `--sets core,colonyWars,events` |

随机性全部由主种子派生，写进报告即可复现：`:entrants` 初始名单随机排序、`:pair:rN` 每轮同分随机排序、`:game-seeds` 每局独立随机种子、`:tiebreak` 最终同分优先级。同一主种子 + 同一参数会得到逐局一致的结果。

账目（本次正式赛）：12 届 × 5 轮 × 6 场 × 10 局 = **3600 局**；每位脚本 12 × 5 × 10 = **600 局**，其中先手 300 局、后手 300 局；每局恰有一个胜者。

### 运行

```bash
# 完整正式赛（约 5 分钟，后台运行也可以）
npm run swiss -- --seed swiss-2026-11-05 --seasons 12 --rounds 5 --per-side 5 --sets core

# 快速复核
node src/cli.js swiss --seed quick --seasons 1 --rounds 3 --per-side 2 --sets core
```

参数：`--seed` 主种子、`--seasons` 届数、`--rounds` 每届轮数、`--per-side` 每方先手局数（BO = 2× 该值）、`--sets` 牌包组合、`--run-id` 产物名、`--quiet true` 只输出最终摘要。

产物在 `tournaments/`：

| 文件 | 内容 |
|---|---|
| `<runId>.json` | 完整报告：逐届逐轮逐场逐局（种子、先后手、胜者、回合数、终局权威）、积分榜、聚合榜、统计 |
| `<runId>.md` | 人读报告：结论、置信度、账目、总榜、每届榜单、每轮 BO10 明细 |
| `latest.json` / `latest.md` | 最近一次完成的结果 |
| `progress.json` | 实时进度（每局更新内存，400ms 限流落盘；Windows 下不用 rename 原子覆盖，避免并发读时 EPERM） |

顶栏 **瑞士轮** 看板：实时进度条、当前届/轮/场、最近一局与种子、当前积分榜、冠军卡（含 Wilson 95% CI、冠亚 z 检验、先后手总胜率）、聚合总榜、各届榜单、逐轮 BO10 明细；也可直接在界面改参数重跑。

### 本次结果（自由策略轮，主种子 `swiss-2026-11-05`，12 届 / 3600 局）

**最强脚本：`scripts/agent-deepseekv41flash.js`**（执行模型 `deepseek-v4.1-flash`，自选策略「三段涨潮」）。局胜率 **73.00%（438/600）**，Wilson 95% CI `[69.31%, 76.40%]`；**11/12 届夺冠**（唯一失手的一届由 `deepseek v4pro` 拿下），平均名次 1.08，累计场分 54.5；先手 77.3%、后手 68.7%。

亚军 `GLM5.3`（自选「曲线竞速」）63.00%（378/600），差 **10.00 个百分点**，两比例近似 z = 3.735，**达到 95% 显著**（冠亚 CI 不重叠）。**该模型在「指定主题轮」与「自由策略轮」两轮都排名第一**，是唯一在两种口径下都夺冠的模型。

> 口径：本轮策略由模型自主设计，因此「模型能力 = 策略选择 + 实现质量」。两轮同主种子、同赛制、同 12 个真实模型 ID，唯一变量是策略来源（主代理指定主题 → 模型自主设计）；局种子表按轮/场/局一致，瑞士轮每届配对由胜负驱动，两轮配对不同。

| 名次 | 模型 | 自选策略 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 先手 / 后手 |
|---:|---|---|---:|---:|---:|---:|---:|---|
| 1 | deepseek v4.1flash | 三段涨潮 | 11 | 1.08 | 73.00% | 438/600 | 54.5 | 77.3% / 68.7% |
| 2 | GLM5.3 | 曲线竞速 | 0 | 3.25 | 63.00% | 378/600 | 41.0 | 66.7% / 59.3% |
| 3 | MIMO-v2.6-pro | 闪电压制 | 0 | 5.00 | 58.00% | 348/600 | 35.0 | 62.7% / 53.3% |
| 4 | deepseek v4pro | 价值节奏快攻 | 1 | 4.33 | 57.83% | 347/600 | 38.5 | 62.0% / 53.7% |
| 5 | MiniMax M3 | 壁垒重锤 | 0 | 5.08 | 57.83% | 347/600 | 34.5 | 64.0% / 51.7% |
| 6 | KIMI 2.8preview | 蜂群速攻 | 0 | 5.08 | 55.33% | 332/600 | 35.5 | 61.3% / 49.3% |
| 7 | KIMI 3.1pro | 压缩脉冲 | 0 | 7.50 | 55.17% | 331/600 | 27.5 | 57.7% / 52.7% |
| 8 | hy3 | 协同滚雪球 | 0 | 6.92 | 52.67% | 316/600 | 30.0 | 56.7% / 48.7% |
| 9 | GLM5.3flash | 精炼雪球 | 0 | 7.17 | 50.00% | 300/600 | 28.5 | 55.0% / 45.0% |
| 10 | hy4 | 薄牌护城河 | 0 | 9.58 | 44.67% | 268/600 | 23.0 | 43.3% / 46.0% |
| 11 | step5preview | 雪球收割 | 0 | 11.00 | 26.17% | 157/600 | 12.0 | 28.7% / 23.7% |
| 12 | MiniMax M3.1flash | 破垒夺权 | 0 | 12.00 | 6.33% | 38/600 | 0.0 | 7.0% / 5.7% |

- 各届冠军：`deepseek v4.1flash` × 11、`deepseek v4pro` × 1；零重赛、零异常重试，3600 局全部完成。
- 先手方总胜率 **53.53%（1927/3600）**；每场双方各 5 局先手，席位偏差已配平。
- 极端值核查：`MiniMax M3.1flash` 6.33%、`step5preview` 26.17% 已做动作级诊断，全部 12 份脚本每回合动作数 **9.59–10.49**（全局约 10），非空转、非崩溃，属策略选择与实现质量差异。
- 完整逐局记录见 `tournaments/swiss-freeform-20261105.md/.json`，`latest.*` 已指向本轮；同一主种子 + 同一脚本可逐局复现。

### 两轮对照（指定主题 → 自由策略）

| 模型 | 上轮 名次 / 胜率 | 本轮 名次 / 胜率 | Δ 局胜率 |
|---|---|---|---:|
| deepseek v4.1flash | 1 / 77.67% | 1 / 73.00% | −4.67pp |
| GLM5.3 | 6 / 54.50% | 2 / 63.00% | +8.50pp |
| MIMO-v2.6-pro | 10 / 49.83% | 3 / 58.00% | +8.17pp |
| deepseek v4pro | 7 / 53.83% | 4 / 57.83% | +4.00pp |
| MiniMax M3 | 5 / 55.33% | 5 / 57.83% | +2.50pp |
| KIMI 2.8preview | 11 / 30.00% | 6 / 55.33% | +25.33pp |
| KIMI 3.1pro | 9 / 52.33% | 7 / 55.17% | +2.84pp |
| hy3 | 8 / 53.17% | 8 / 52.67% | −0.50pp |
| GLM5.3flash | 12 / 5.33% | 9 / 50.00% | +44.67pp |
| hy4 | 4 / 55.50% | 10 / 44.67% | −10.83pp |
| step5preview | 2 / 56.33% | 11 / 26.17% | −30.16pp |
| MiniMax M3.1flash | 3 / 56.17% | 12 / 6.33% | −49.84pp |

策略自主后，`GLM5.3flash` +44.67pp、`KIMI 2.8preview` +25.33pp、`GLM5.3` +8.50pp、`MIMO-v2.6-pro` +8.17pp；`MiniMax M3.1flash` −49.84pp、`step5preview` −30.16pp、`hy4` −10.83pp。冠亚差距由 21.34pp 缩至 10.00pp，说明「策略选得对不对」确实是模型能力的重要组成，而冠军模型在两轮都稳定。

- 指定主题轮报告：`tournaments/swiss-models-20261105-guided.md/.json`（同为 `deepseek v4.1flash` 夺冠，77.67%、12/12）。
- 模型名回退轮报告：`tournaments/swiss-final-20261105-hy4free.md/.json`（冠军 KIMI 3.1pro 58.50%，未达显著）。

### 统计口径

冠军按**局胜率**判定，并同时给出 Wilson 95% 置信区间、冠亚两比例近似 z 检验与先手方总胜率。同一赛事内对局并非完全独立，区间与 z 值只作参考；「最强」指本赛制、本牌包、本组种子下的可复现排名，不等价于跨环境绝对实力。先后手按每场各 5 局严格配平。

## 11. 2V2 组队瑞士轮（6 队）

把 12 个模型按「同家模型两两配合」编成 6 支双人队伍，以**队伍**为参赛单位打瑞士轮。赛制与 1v1 完全独立：独立 CLI、独立进度/结果文件、独立看板（顶栏 **2V2 组队赛**）。

### 队伍构成

| 队伍 | 类型 | 厂商 | 队员 | 自选策略 |
|---|---|---|---|---|
| 混元联队 | 同厂 | Hy | hy4 + hy3 | 薄牌护城河 / 协同滚雪球 |
| GLM 联队 | 同厂 | GLM | GLM5.3 + GLM5.3flash | 曲线竞速 / 精炼雪球 |
| MiniMax 联队 | 同厂 | MiniMax | MiniMax M3 + MiniMax M3.1flash | 壁垒重锤 / 破垒夺权 |
| KIMI 联队 | 同厂 | KIMI | KIMI 3.1pro + KIMI 2.8preview | 压缩脉冲 / 蜂群速攻 |
| DeepSeek 联队 | 同厂 | DeepSeek | deepseek v4.1flash + deepseek v4pro | 三段涨潮 / 价值节奏快攻 |
| 混编联队 | 混编 | StepFun + MIMO | step5preview + MIMO-v2.6-pro | 雪球收割 / 闪电压制 |

### 赛制

- 每局是 `team2v2` 四人对局：座位 0/2 一队、1/3 一队，共享 75 权威，队友前哨保护全队，可向队友预留资源。
- **每场 BO8**：覆盖 2×2×2 = 8 种座位组合（哪队占 0/2 前位 × A 队谁在前 × B 队谁在前），每种各 1 局、每局独立种子；`--repeats 2` → BO16。1v1 的 BO10 无法做到 2v2 队内位置完全配平，故改用 8 的倍数。
- 每轮 3 场；6 队 × 5 轮恰好打满 15 个不同对阵（K6 单循环）。配对按场分同分随机排序，并带**剩余轮次可行性前瞻**：只接受后续仍存在完整零重赛匹配的方案，避免最后一轮被迫重赛。
- 场分胜 1 / 平 0.5 / 负 0；排名 MP → 局胜 GP → Buchholz → SB → 种子随机优先级；多届聚合按局胜率 → 累计 MP → 平均名次。
- 随机性由主种子派生：`:entrants`、`:pair:rN:team`、`:game-seeds`、`:seats:sN:rR:mM`、`:tiebreak`。

### 运行与产物

```bash
npm run swiss:team -- --seed swiss-2026-11-05 --seasons 12 --rounds 5 --repeats 1 --sets core --run-id team-swiss-20261106
```

产物 `tournaments/team-swiss-20261106.md/.json`、`team-latest.json/.md`、`team-progress.json`。完整报告含逐局种子、4 座位排列、前位队、引擎获胜队伍与终局权威，以及 12 名队员的座位分项统计。界面启动走 `POST /api/team-tournament/start`。

### 本次结果（主种子 `swiss-2026-11-05`，12 届 / 1440 局）

**冠军队伍：DeepSeek 联队**（`deepseek v4.1flash` + `deepseek v4pro`，自选「三段涨潮」+「价值节奏快攻」）：局胜率 **86.04%（413/480）**，Wilson 95% CI `[82.65%, 88.86%]`；12 届夺冠 **11 次**，平均名次 1.08，累计场分 59，前位 90.4% / 后位 81.7%。

亚军 GLM 联队 70.63%（339/480），差 **15.41pp，z = 5.899，达到 95% 显著**（冠亚 CI 不重叠）。

| 名次 | 队伍 | 类型 | 夺冠 | 平均名次 | 局胜率 | 局胜/总局 | 累计 MP | 前位 / 后位 |
|---:|---|---|---:|---:|---:|---:|---:|---|
| 1 | DeepSeek 联队 | 同厂 | 11 | 1.08 | 86.04% | 413/480 | 59 | 90.4% / 81.7% |
| 2 | GLM 联队 | 同厂 | 1 | 2.00 | 70.63% | 339/480 | 45 | 74.6% / 66.7% |
| 3 | KIMI 联队 | 同厂 | 0 | 3.25 | 53.13% | 255/480 | 34 | 57.9% / 48.3% |
| 4 | 混编联队 | 混编 | 0 | 3.83 | 46.04% | 221/480 | 26.5 | 51.2% / 40.8% |
| 5 | 混元联队 | 同厂 | 0 | 4.83 | 31.46% | 151/480 | 13 | 35.8% / 27.1% |
| 6 | MiniMax 联队 | 同厂 | 0 | 6.00 | 12.71% | 61/480 | 2.5 | 14.2% / 11.3% |

**观察**：混编联队（`step5preview` + `MIMO-v2.6-pro`）排第 4、46.04%，胜过 3 支同厂联队 —— 跨厂组合没有因「配合陌生」明显吃亏，队伍成绩主要由两名队员各自的策略质量决定。同队队员共享胜负，队伍胜率必然相同，差异只体现在座位分项：坐 0 号位时 `deepseek v4.1flash` 92.5%、`deepseek v4pro` 88.3%。

**账目**：12 × 5 × 3 × 8 = **1440 局**，每队 480 局（前位 240 / 后位 240），**0 重赛、0 重试、0 前瞻回退**；180 场座位排列全部配平，每个模型在每个座位出现次数相同。前位队总胜率 **54.03%（778/1440）** —— 规则本身略有先手优势，但每场 BO8 已把前后位严格配平。各届冠军：DeepSeek 联队 ×11、GLM 联队 ×1（第 7 届）。

> 口径：本榜比较的是「6 支双人队伍」在 `team2v2` + 基础盒 + 这组种子下的战绩，不是单个模型能力排名；同队共享胜负，不能据此拆分个人贡献。带 8 次重赛的缺陷版留档在 `tournaments/team-swiss-20261106-preforward.*`。

## 12. 测试与规则来源

```bash
npm test
```

当前共 **62 项**自动化测试，全部通过：基础规则与 12 模型脚本 27 项、扩展与 2V2 规则 12 项、Web 服务 API 与人类视角 1 项、1v1 瑞士轮赛制 6 项、正式赛逐局账目 1 项、界面启动配置回归 2 项、2V2 组队赛赛制 7 项（含 8 种座位排列配平与 20 届前瞻零重赛）、组队赛正式报告账目 4 项、启动脚本与离线提示 2 项。重点检查牌数守恒、前哨保护、强制弃牌、特殊牌、事件队列、团队权威、资源预留、视角脱敏、确定性回放、脚本超时边界，以及锦标赛的 BO10 先后手配平、每局种子唯一、每轮零重赛、每局恰一胜者与 3600 局总量守恒。

规则核对来源：

- 官方学习页：https://starrealms.com/learn-to-play/
- 官方盒装规则书：https://files.wisewizardgames.com/wwg/rules/SRBOX_Rulebook_1.1E_WEB.pdf
- 官方扩展总览：https://starrealms.com/sets-and-expansions
- 官方 Crisis 页面：https://starrealms.com/expansions/crisis
- 官方事件说明：https://starrealms.com/news/crisis-events-is-now-available-on-the-digital-star-realms-app
- 本地资料：`C:/Users/张涵/WorkBuddy/2026-10-25-10-04-46/boardgame_rules/`
- 本地 Steam 安装仅用于确认产品形态；本项目没有读取或复制其美术资源，也没有依赖其 DLL。

## 13. 项目纪录片视频

`video/star-realms-ai-documentary.mp4`：16:00、1920×1080 / 30fps、中文旁白 + 烧录字幕，按「搭建 → 规则 → 12 位选手脚本 → 赛制赛程 → 比赛过程 → 结果」六章时间线展开，共 60 镜 / 109 帧。同目录另有 `subtitles.srt`（60 条外挂字幕）、`storyboard.json`（画面/旁白对照）、`timeline.json`（逐镜逐帧时间轴）。

全片只使用项目内已确认素材：`reply/` 六份报告、`tournaments/` 各届赛果、`scripts/` 12 份脚本、`subagent-progress/` 设计说明、`test-artifacts/` 界面截图与本文件；没有虚构选手、规则、赛况或结果。

制作链路：

| 文件 | 作用 |
|---|---|
| `video/storyboard.mjs` / `export-storyboard.mjs` | 分镜（画面、旁白、字幕三对齐）与 JSON 导出 |
| `video/analyze-replays.mjs` | 重放演示回放，提取逐回合战况 |
| `video/record-featured-game.mjs` | 用报告里的逐局种子复现第 1 届第 3 轮冠亚对决第 1 局；结果与报告逐字段一致（19 回合 / 184 动作 / 终局 11:0），不一致即报错退出 |
| `video/slide-html.mjs` / `render-slides.mjs` | HTML/CSS 原创幻灯片 + 无头 Edge CDP 截图 |
| `video/make-audio.py` / `refresh-timeline.mjs` | edge-tts 中文旁白 → 拼接音轨与 SRT；分配帧时长 |
| `video/build-video.mjs` | ffmpeg 编码；自动校准画面时间轴与音轨（静态图 concat 有约 1.5% 拉伸，不校准会差 14 秒） |

复现（旁白需要联网；ffmpeg 使用本机 imageio-ffmpeg 的副本）：

```bash
node video/export-storyboard.mjs && node video/render-slides.mjs
python video/make-audio.py && node video/refresh-timeline.mjs
node video/build-video.mjs
```

> 注意：`reply/star-realms-replay1.json` 是旧版引擎产物，用当前引擎重放会出现 254 个非法动作，因此**未**用于本片的战况解说；解说用的是报告种子复现的真实赛程对局与 `star-realms-replay2.json`。

## 14. 2V2 实验室（同模型复制队 / 随机组队）

实验本身是纯 CLI 链路，报告落盘 `reply/`，不经过对局服务；2026-11-07 起观战台新增**只读**「2V2 实验室」标签页展示这些报告（见第 15 节）。核心在 `src/engine/team-lab.js`，执行器 `src/team-lab-cli.js`，汇总 `src/team-lab-summary.js`。

| 实验 | 队伍构成 | 赛制 | 要回答的问题 |
|---|---|---|---|
| **A · clone** | 12 支队伍，每队是**同一份脚本的两个副本** | 参考 1v1：12 个参赛单位 × 12 届 × 5 轮瑞士轮，同分优先 + 回溯零重赛，按局胜率聚合 | 队友是自己的镜像，队伍成绩近似等于「单个模型脚本的 2V2 能力」 |
| **B · random** | 每届把 12 个模型随机配成 6 队，12 届队伍构成都不同 | 每届 6 队 × 5 轮组队瑞士轮（带剩余轮次可行性前瞻，零重赛） | 队伍胜负共享，用统计口径拆出「个人发挥最强」 |

两套实验各跑**核心牌包**（`core`）与**全扩**（`core + colonyWars + events`），共四场；每场 BO8 覆盖 8 种座位排列，主种子 `lab-2v2-2026-11-06`，每场报告在跑完当刻写入 `reply/`。

**个人发挥口径**（实验 B 主口径）：团队 Bradley–Terry 逻辑模型
`logit P(前位队胜) = β[座位0] + β[座位2] − β[座位1] − β[座位3] + γ`，
IRLS 拟合 12 个 β（中心化为 0）与前位截距 γ，控制队友与对手强度；辅助口径为「在场队伍胜率（Wilson CI）」与「所在队伍夺冠次数」。2v2 胜负共享，β 是统计估计而非直接测量，同一场 BO8 内对局不独立，SE/z 只作近似参考。

产物（均在 `reply/`）：

| 文件 | 内容 |
|---|---|
| `star-realms-2v2-clone-core.json/.md` | A · 核心，2880 局 |
| `star-realms-2v2-clone-all.json/.md` | A · 全扩，2880 局 |
| `star-realms-2v2-random-core.json/.md` | B · 核心，1440 局 |
| `star-realms-2v2-random-all.json/.md` | B · 全扩，1440 局 |
| `star-realms-2v2-lab-summary.md` | 四场对照与交叉结论 |

四场均零重赛、零异常重试、零前瞻回退，座位配平通过；前位队胜率 54.31%～55.28%（规则固有优势，已由 BO8 配平并从 β 中扣除）。**四场榜首一致：`deepseek v4.1flash`**（A 核心 88.96%、A 全扩 79.79%；B 核心 β=1.3108、B 全扩 β=0.9083）。全扩下「在场队伍胜率第一」与「β 第一」不是同一模型，正说明队伍胜负会被队友带高。

复现：

```bash
node src/team-lab-cli.js --experiment clone  --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --out reply/star-realms-2v2-clone-core
node src/team-lab-cli.js --experiment clone  --sets all  --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --out reply/star-realms-2v2-clone-all
node src/team-lab-cli.js --experiment random --sets core --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --out reply/star-realms-2v2-random-core
node src/team-lab-cli.js --experiment random --sets all  --seed lab-2v2-2026-11-06 --seasons 12 --rounds 5 --out reply/star-realms-2v2-random-all
node src/team-lab-summary.js
```

`src/team-lab-recompute.js` 可在口径修正后从逐局记录重算派生统计并刷新报告，**不重跑对局、不改赛程与胜负**。`test/team-lab.test.js` 覆盖复制队构建、随机组队不重不漏、β 拟合可辨识性、座位配平与四场报告的账目守恒。

## 15. 观战台 · 2V2 实验室标签页（2026-11-07）

顶部新增「2V2 实验室」按钮，打开只读对话框，展示第 14 节四场报告。**原有对局 / 1v1 瑞士轮 / 2V2 组队赛面板与 1.5s 轮询保持不变。**

| 层 | 实现 |
|---|---|
| 服务端 | `/api/lab` 按 4 份报告 mtime 签名缓存，返回榜单、账目、个人统计与各届冠军（剔除逐局明细后约 240 KB）；`/api/lab/full?run=<key>` 用白名单校验后下载完整报告，越界返回 400 |
| 前端 | `public/index.html` 的 `#labDialog`、`public/app.js` 的 `refreshLab()/renderLab()`、`public/tournament.css` 的 `.lab-*` 样式 |
| 界面 | 四场概览卡 + 交叉结论条 + 四场切换 + 账目格 + 四个标签（复制队能力榜 / 个人 β 榜、在场统计、各届冠军、口径与复现）+ 完整报告下载 |

实验 B 以 β 为主口径，全扩下「在场队伍胜率第一」与「β 第一」不一致的说明写在「口径与复现」标签里。面板**只读**：不启动对局、不写报告；要重跑实验仍用第 14 节的命令行。

验收：`test/lab-ui.test.js` 4 项（HTML 挂载点、前端绑定、服务端白名单/缓存、API 集成），全量 **75/75 通过**；无头 Edge + CDP 实测截图见 `test-artifacts/lab-ui-a-core.png`、`lab-ui-b-all.png`、`lab-ui-notes.png`。

**项目时间线**：[`TIMELINE.md`](TIMELINE.md) 以本次更新为终点，按 git 提交时间、报告 `generatedAt` 与文件 mtime 回溯全项目，并附证据索引与口径边界。

