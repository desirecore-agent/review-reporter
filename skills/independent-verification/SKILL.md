---
name: independent-verification
description: O4 独立取证入口；在隔离调用中仅据原件验证净化事实候选，并按预定清单补漏。
version: 1.0.2
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Grep, Write, Edit]
metadata:
  author: DesireCore
  version: 1.0.2
  updated_at: '2026-10-30'
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

只向 `write_allowlist` 中唯一列出的 `<canonical_artifact_root>/independent-verification/<verification_id>.receipt.json` 写入 `independent-verification-receipt`。结构包含 `candidate_results[]`（每个非空输入候选 id 恰好一项，`status` 仅 `confirmed/refuted/unlocatable`）、独立 `additional[]`、`counts: {confirmed, refuted, unlocatable, additional}`、对象/范围、输入净化结论、清单逐项覆盖、R7/R9 各自状态和未覆盖原因。R9 以 Lead 转达的 O1 结论为准；任务未转达时按原件判断：正文条款自己列明附件清单（列出编号或名称即可，缺版本号不影响 R9）即 `not_hit`，只有正文明确指向一份另附的权威附件清单、而该清单未随材料送达（不在 O1 冻结清单中）时才是 `hit`。Lead 在对象/范围里转达的 R7/R9 命中状态是范围事实，不算上游推理污染。不得因 read_allowlist 里没有单独的清单文件就写 `unknown`；R9 未命中时不生成待决项，附件正文未送达只记 R7。confirmed/refuted 必须含非空原文 quote 与来源定位；unlocatable 必须含非空检索文件/页段/关键词范围及原因。additional 的 id/check id/原文证据均非空，id 不重复且不得与候选重合。数组中的 null 或畸形项一律失败关闭。全部写完后按同一路径完整回读；解析失败或 `valid:false` 时保留失败产物并停止，不得交给 O5。O4 不评分、不定严重度、不写建议、不问业务批准、不导出 DOCX。

## 分段落盘

回执预计超过约 3000 字时（候选多于三四个通常就会超过）不一次写成：

1. 先 `Write` 骨架 JSON：对象/范围、输入净化结论等已知字段写实际值；R7/R9 状态 Lead 已转达的照抄，未转达的先写 `null`，取证后再补；清单逐项覆盖写 `null`；`candidate_results` 每个输入候选各占一行 `{"id": "<候选 id>", "status": "pending"}`；`additional` 写 `[]`；`counts` 写 `null`。
2. 一次回复核对一个候选：回源取证后，用 `Edit` 把该候选那一行（`old_string` 取 `{"id": "<候选 id>", "status": "pending"}`）换成结果对象，仍写在一行内，行尾逗号保持不变。
3. 候选写完后，用 `Edit` 补上仍为 `null` 的 R7/R9 状态与清单逐项覆盖，再填 `additional` 与 `counts`。`additional` 每项一行；超过约 3000 字就分批，后一批以已写最后一项的整行为 `old_string`，换成该行加逗号再加新条目。
4. 骨架写成后不再用 `Write` 重写整份回执。全部写完再按上文完整回读并校验；仍有 `"status": "pending"` 的行就回到该候选，R7/R9 状态、清单逐项覆盖与 `counts` 仍为 `null` 就回到第 3 步，都不交给 O5。

云端模型的工具参数要整段生成完才发出，生成期间连接没有字节，静默超过 90 秒即被平台判为断流、整次重来；2026-10-30 C 轮 O4 一次写出约 2 万字的回执，静默了 63 秒。
