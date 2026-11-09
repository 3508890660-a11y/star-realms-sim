# 2026-11-09 全量重跑记录

用**修订后 12 份 AI 脚本**、与修订前正式报告**完全相同的主种子与赛制参数**，重跑 10 场赛制。

| 文件 | 内容 |
|---|---|
| `manifest.json` | 10 个任务的完整命令、产物清单、起止时间、退出码、并发度与整体结果 |
| `logs/<key>.log` | 各任务 stdout/stderr 与退出码 |
| `metrics-after.json` | 重跑后 10 份报告的关键指标（由 `tools/rerun-metrics.mjs` 生成） |

主种子沿用：`swiss-2026-11-05`（1v1 瑞士轮、2V2 组队赛）、`lab-2v2-2026-11-06`（2V2 实验室四场）、`mode-3v3-2026-11-08`（3V3 四场）。赛制参数（届数 / 轮数 / BO / 牌包）逐项与 `reply/baseline-before-refresh/metrics.json` 对应的旧报告一致。

编排脚本：`tools/rerun-20261109.mjs`（并发 5，子进程逐场落盘，互不写同一文件）。
对照结论：`reply/star-realms-refresh-20261109-summary.md`。
