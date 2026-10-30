---
name: review-scoring
description: 在独立的 O5 调用中消费合格 O4 回执，按有来源的固定公式评分并形成范围诚实的行动建议。
version: 1.2.1
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Grep, Write, Edit, MathCalc, AskUserQuestion]
metadata:
  author: DesireCore
  version: 1.2.1
  updated_at: '2026-10-30'
---

# O5 评分

## 准入

输入必须包含合格 O4 回执路径、对象/范围、适用规则或标尺的 id+版本+路径、Lead canonical 根。O4 必须为每个候选给出三态结果与检索范围，并另有独立 `additional[]`；否则拒收。本轮必须是不同于 O4 的 isolated intent，且 `childContext.memoryScope: none`；不要读取 O3/O4 会话历史或 O3 推理，也不要重新执行完整候选取证与补漏。

## 固定公式

唯一评分知识源为随本技能发布的 `resources/scoring-rules-cn-v1.0.3.json`，固定标识 `scoring-rules-cn@1.0.3`。O5 必须从任务 `read_allowlist` 给出的**实际绝对路径**读取它，核对文件内 id/version、Lead 提供的真实 `FileDigest` 摘要及完整结构后才可算分；路径、摘要或任何维度规则缺失即保留失败回执并停止。不得使用模型记忆、摘要版规则或调用方临时标尺替代。

该资源完整锁定五维各自的 100 基础分、合同侧扣分、证据惩罚、全部封顶、市场标尺、权重、五档阈值及四类 Human Gate。每项命中都在 scorecard 记录 rule code、次数、数值、证据；多个封顶取最小，分数 clamp 到 0..100，总分向下取整。`not_applicable` 只在资源允许且有依据时成立，不扣分但始终保留原权重与分母。

五维权重保持：条款事实 20%、风险 25%、合规 20%、义务与时序 15%、建议可执行性 20%。每维记录：`S`（按给定规则来源的实质分）、`P`（O4 refuted/unlocatable 和证据缺口惩罚）、`C`（规则来源规定的封顶）、`D=min(C, clamp(0,100,S-P))`。完整总分为：

`floor(0.20*D1 + 0.25*D2 + 0.20*D3 + 0.15*D4 + 0.20*D5)`。

每个扣分/封顶都引用本次提供的 rule id、版本、绝对路径与摘要，并用 `MathCalc` 复算。不得凭记忆新增法律或标尺内容。只支持中国大陆评分（法域待定按评分规则的 `DED-D3-JURIS-UNDETERMINED` 处理）；域外合同无适用法包时只做通用文档治理与转介。若任一维未覆盖，特别是域外或无适用 CN 法包导致合规维未覆盖，不得输出完整五维总分、档位或“可放行”；只输出已覆盖维度、固定公式、缺失维度及补齐条件，也不得重归一权重。

## 方向与范围

`risk_direction` 只能是 `up/down/flat/undetermined`。单版本且未请求比较基线时，`comparison_status` 写 `not_applicable`，`risk_direction` 保持骨架里的 `null` 不动（即省略方向，见团队规则 INV-010），不写 flat、undetermined 或 not_applicable；已请求比较但范围或 digest 不足时 `comparison_status` 写 `applicable`、`risk_direction` 写 `undetermined`。比较范围不全或 digest 不可用时全局 `undetermined`；可以另述已证局部 up/down，但不能把全局写 flat。R7（附件正文未交）与 R9（权威清单不完整）分列；R9 只按 O4 回执的状态照录，`not_hit` 时写未命中，不列欠账、不进 pending。

## Human Gate

四类业务决定（付款回款、争议机制、责任分配、生效要件）命中后记 `pending`。pending 不阻止 scorecard/report 的文件交付，也不自动触发逐项提问。只有请求方明确需要立即决定，或缺失事实阻止识别对象时才用 `AskUserQuestion`；沉默、超时和模拟回答均不改变批准状态。

## 落盘次序

`scorecard.json` 按下列固定次序逐步写（即共享规则第三之二第 5 条所说「技能另有固定落盘次序的文件」），不要先在思考里算完五维再一次写整份：

1. 读完 O4 回执与评分规则后先 `Write` 骨架。身份、范围、O4 回执、评分规则（id、版本、绝对路径、摘要）照实填写；其余顶层键逐行用 `null` 占位：`"risk_direction": null,`、`"comparison_status": null,`、`"human_gate_pending": null,`、`"upstream_pending": null,`、`"coverage": null,`、`"actions": null,`、`"debts": null,`、`"incomplete_statement": null,`、`"total": null,`、`"tier": null,`，最后一行固定为 `"complete_five_dimension_score": null`（不带逗号）；`dimensions` 下 `D1`…`D5` 各占一行，写成 `"D1": {"status": "deferred"},`（`D5` 行不带逗号）。CN 规则包不在骨架前通读，算 D3 时再用 `Grep`（单文件路径）按 rule id 查。
2. 先据 O4 回执与任务透传项写方向、Gate 与覆盖（每个键一次 `Edit`）：`risk_direction`（单版本保持 `null`，不 Edit）、`comparison_status`、`human_gate_pending`（本次自判的 Gate）、`upstream_pending`（任务透传项原样照列，与自判 Gate 分列、不合并、不计分），以及 `coverage`（七项覆盖状态；任务和 O4 回执都没给的项写 `unknown` 并注明来源缺失）。D2 的方向封顶与 D5 的 Gate 扣分依赖这两项，所以排在五维之前。
3. 一次回复只算一维：用 `MathCalc` 复算 S/P/C/D，再用 `Edit` 把该维占位换成单行完整对象（首键 `"status"` 写 `scored`/`not_covered`/`not_applicable`，再写 S、P、C、D，命中的 rule code、次数、数值、证据，以及 not_covered/not_applicable 的依据）。`old_string` 与 `new_string` 都只写 `"Dn": {…}` 本身，不含行首缩进、不含行尾逗号；逗号留在原处不动（`D5` 行原本没有逗号，替换后也不加）。D4 命中 `CAP-D4-PAYMENT-UNMAPPED` 时，同一次回复把 `GATE-PAYMENT` 补进 `human_gate_pending`。算 D5 之前，先用一次 `Edit` 把 `actions` 写成行动建议数组（每条含 finding_id、祈使句动作、priority、具体修改落点、签核归属），D5 按这份清单评分，报告的行动清单也只从这里渲染。
4. 仅当某条 rule code 已明确覆盖该事实、只是措辞或区间边界有两种读法时，取扣分更多或封顶更低的一种，写一句 `interpretation_note` 后继续，不在思考里反复比较。事实不落在任何 rule code 内时不扣分、不类推，记入该维 `rule_gaps` 并列为欠账（D1 适用性无依据按 not_covered）。
5. 五维写完后，逐个用 `Edit` 把 `total`、`tier`、`incomplete_statement`、`debts`、`complete_five_dimension_score` 的 `null` 换成值，不新增键、不整份 `Write`，最后整份回读一次。scorecard 必须声明是否 `complete_five_dimension_score`，列出范围、O4 receipt、规则来源、逐维算式、方向、Human Gate 与欠账。
6. O5 四个文件路径固定，不按产物 id 分文件：重新委派直接 `Write` 覆盖 `scorecard.json` 与 `report.md`，只有 `export-attempts.json` 保留历史；只有 `DelegateControl` resume 时才先 `Read` 本次 scorecard，从仍为 `deferred` 的维度或仍为 `null` 的键接着做。

scorecard 写完并回读后，再交给 `report-composition`。
