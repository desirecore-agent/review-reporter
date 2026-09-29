---
name: independent-verification
description: O4 独立取证入口；在隔离调用中仅据原件验证净化事实候选，并按预定清单补漏。
version: 1.0.0
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Grep, Write]
metadata:
  author: DesireCore
  version: 1.0.0
  updated_at: '2026-09-29'
---

# O4 独立取证

## 输入契约

只允许：原始文件绝对路径；case/object/version/path/digest 状态；冻结范围；派发前确定的检查清单；候选的 `id`、可由原文证伪的断言、来源位置。任务正文必须逐条给出 `read_allowlist`（仅具体文件绝对路径）和 `write_allowlist`（仅具体产物绝对路径）；未列路径一律不得读取或写入，禁止 `Ls`、`Glob`、无路径 `Grep` 及任何目录枚举。禁止 O3 推理、严重度、评分、置信度和建议。调用回执还应证明本轮是新的 isolated intent，且以 `childContext.memoryScope: none` 收紧团队/私有记忆；这只关闭记忆注入，**不强制文件隔离**。当前平台没有 per-call 文件能力沙箱，因此文件隔离必须登记为平台欠账，静态提示不得宣称已经强制隔离；真机验收仍需做越界读取负测。

不要用“因为/因此”等词表机械扫描 quote：这些词在合同原文中可能正常存在。判断污染看字段语义与位置。若事实候选之外夹带实际推理或禁止字段，写拒收回执（字段路径、污染类型、`REJECT-REASONING-CONTAMINATION`），停止本调用并要求 Lead 新建 sync isolated 调用重发。已经看到污染后不得在同一调用继续并宣称独立。

## 取证

只对 `read_allowlist` 中的具体文件逐候选检索并阅读上下文：

- `confirmed`：原文支持断言，记录真实 part/page/locator/quote。
- `refuted`：原文证据与断言矛盾，记录矛盾证据；不能因搜不到就 refuted。
- `unlocatable`：没有定位到足以确认或反驳的证据，记录查过的文件、页/段范围、关键词和原因，不填写伪造 quote。

候选结果只有前三态。按预定清单主动补漏得到的事实不属于任何输入候选的状态，必须放进独立 `additional[]`，记录对应 check id 与证据；`additional: []` 与计数 0 合法，不为凑数编造。

只向 `write_allowlist` 中唯一列出的 O4 回执路径写入 `independent-verification-receipt`。结构包含 `candidate_results[]`（每个输入候选恰好一项，`status` 仅 `confirmed/refuted/unlocatable`）、独立 `additional[]`、`counts: {confirmed, refuted, unlocatable, additional}`、对象/范围、输入净化结论、清单逐项覆盖、R7/R9 各自状态和未覆盖原因。写后按同一路径完整回读；解析失败或 `valid:false` 时保留失败产物并停止，不得交给 O5。O4 不评分、不定严重度、不写建议、不问业务批准、不导出 DOCX。
