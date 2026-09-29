---
name: report-composition
description: 在 O5 将合格 scorecard 渲染为范围明确的报告、待决回执，并在锚点可验证时自主导出修订 DOCX。
version: 1.1.0
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Grep, Write, Edit, FileDigest]
metadata:
  author: DesireCore
  version: 1.1.0
  updated_at: '2026-09-29'
---

# O5 报告与交付

完整回读 scorecard 后，只渲染其中已有的证据、评分状态和建议；不新增事实、不重做 O4。报告至少包含对象/范围、已证发现、refuted/unlocatable、七项覆盖状态、评分公式及完整性声明、风险方向、R7/R9 分列欠账、行动清单、Human Gate pending、适用边界和产物状态。

## 路径

任务正文必须逐条给出具体文件绝对路径的 `read_allowlist` 与 `write_allowlist`。只读列出的 O4 回执、评分规则资源、适用法域规则文件和原件；固定写入 `<canonical_artifact_root>/report-delivery/scorecard.json`、`<canonical_artifact_root>/report-delivery/report.md`、`<canonical_artifact_root>/report-delivery/pending-receipt.json`、`<canonical_artifact_root>/report-delivery/export-attempts.json`，且四个完整路径必须逐项列在 write_allowlist；真实导出能力可用时，`write_allowlist` 还必须逐项列明目标 DOCX 的完整绝对路径。未列路径一律禁止，禁止 `Ls`、`Glob`、无路径 `Grep` 和目录枚举。所有产物使用 Lead 本次明确列出的 canonical 路径，写后逐一完整回读并使用工具实际返回路径互相引用。不得自行另建根，也不得让 Lead 猜测成员目录。`memoryScope:none` 不提供文件级强制隔离；当前平台缺少 per-call 文件能力沙箱，须在回执列为未验平台欠账。

## Human Gate

先交付可读取的报告、待决清单和真实回执；业务 pending 不等于文件交付 pending。不得签署、接受条款或替真人批准。默认不逐个调用 `AskUserQuestion`；如评分技能已基于明确需要提问，仍将未回答项保持 pending。

## 修订版 DOCX

仅当存在原始可导出文件和证据支持的具体替换时，先做导出能力预检。当前平台受版本控制源码的全仓 `git grep` 未发现 `ExportRedlineDocument`，因此不得假定 agent 声明等于运行可用；实际入口待协调者核验：

1. `source_path` 必须是原始文件，不是报告或外部生成副本。
2. 每个 anchor 是原文连续文本，并用 `Grep`/读取确认在对应原件中恰好出现一次；数量为 0、超过 1、跨段或来源不明即 blocked。
3. 若运行工具清单没有真实导出入口，追加本次 attempt 为 `blocked`，保存真实 `tool-not-found` 回执；不调用虚构名称，不用外部脚本或手工文件替代。
4. 若协调者核验出真实入口，以其真实参数和返回路径记录 `redline_docx_path`。只对 `write_allowlist` 中对应且工具实际返回的完整路径调用 `FileDigest`，保存实际返回的字节数与完整摘要；校验失败或路径不在允许清单时记为未核验，不通过目录枚举寻找替代文件。再回读报告与回执；不把二进制全文 Read 当成 DOCX 正确性或视觉验收，修订标记、接受/拒绝和排版仍需各自的新证据。
5. 失败时保留报告，追加本次 attempt 的真实 `failed/blocked` 原因；成功时追加当前 attempt 为 success；均不删除以前失败 attempt。

最终回执区分：报告交付状态、完整五维评分是否存在、Human Gate pending、DOCX 当前尝试与历史尝试。报告范围受限仍可交付，但不能写成完整合规、完整评分或批准。
