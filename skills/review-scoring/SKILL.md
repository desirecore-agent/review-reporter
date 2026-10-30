---
name: review-scoring
description: 在独立的 O5 调用中消费合格 O4 回执，按有来源的固定公式评分并形成范围诚实的行动建议。
version: 1.2.3
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Grep, Write, Edit, MathCalc, AskUserQuestion]
metadata:
  author: DesireCore
  version: 1.2.3
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

每个扣分/封顶都引用本次提供的 rule id、版本、绝对路径与摘要，并用 `MathCalc` 复算。不得凭记忆新增法律或标尺内容。只支持中国大陆评分（法域待定按评分规则的 `DED-D3-JURIS-UNDETERMINED` 处理）；域外合同无适用法包时只做通用文档治理与转介。中国大陆范围（含法域待定）且 CN 规则来源完整时 D3 必须计分，不得因 O4 回执里没有规则级事实就记 `not_covered`：按 O4 confirmed 的准据法、争议解决、数据处理等事实，用 `Grep` 按 rule id 核对 CN 包规则；其余规则没有对应 O4 事实，不扣分，也不逐条列为欠账。D1 的 `substantive_deductions` 只在该项判为 `absent`（检索后确无该类条款）时扣；条款存在但要素不全（`present_incomplete`）不扣 D1；只有该缺口正好落在 D2 `benchmarks` 的某个 id 上时，才按该 id 自带的 severity 计入 D2，其余不扣分、按第 4 步记入 D2 的 `rule_gaps`，可在 `actions` 里给补全建议，不作为风险发现输出。若任一维未覆盖，特别是域外或无适用 CN 法包导致合规维未覆盖，不得输出完整五维总分、档位或“可放行”；只输出已覆盖维度、固定公式、缺失维度及补齐条件，也不得重归一权重。

## 方向与范围

`risk_direction` 只能是 `up/down/flat/undetermined`。`comparison_status` 即团队规则的 `comparison_applicability`，规则已在此转述，无需另读团队规则文件。单版本且未请求比较基线时，`comparison_status` 写 `not_applicable`，`risk_direction` 保持骨架里的 `null` 不动（即省略方向，依据团队规则 INV-010），不写 flat、undetermined 或 not_applicable；已请求比较但范围或 digest 不足时 `comparison_status` 写 `applicable`、`risk_direction` 写 `undetermined`。方向类封顶只在比较适用时才可能命中：单版本不触发 `CAP-D2-DIRECTION-UNDETERMINED` 与 `CAP-D2-WRONG-DIRECTION`。比较范围不全或 digest 不可用时全局 `undetermined`；可以另述已证局部 up/down，但不能把全局写 flat。R7（附件正文未交）与 R9（权威清单不完整）分列；R9 只按 O4 回执的状态照录，`not_hit` 时写未命中，不列欠账、不进 pending。

## Human Gate

四类业务决定（付款回款、争议机制、责任分配、生效要件）命中后记 `pending`。pending 不阻止 scorecard/report 的文件交付，也不自动触发逐项提问。只有请求方明确需要立即决定，或缺失事实阻止识别对象时才用 `AskUserQuestion`；沉默、超时和模拟回答均不改变批准状态。

## 落盘次序

`scorecard.json` 按下列固定次序逐步写（即共享规则第三之二第 5 条所说「技能另有固定落盘次序的文件」），不要先在思考里算完五维再一次写整份。每次回复只想当前这一步：写方向、Gate、覆盖时不推演任何维度的扣分与封顶；算某一维时不推演其他维度。后面要用到的事实，到那一步再按 id 用 `Grep` 或按行 `Read` 取 scorecard 与 O4 回执的片段，仍在上下文中的不必重读。

单次回复（思考加输出）超过约 10 分钟会被网关切断、整次重来。2026-10-30 E 轮 O5 写骨架前在一次回复里把五维全部推演一遍，D2 又在一次回复里来回比较 FC-17 该不该落 `amount-in-words-mismatch`，三次在约 600 秒处被切断，另有四次回复超过 8 分钟。

1. 读完 O4 回执与评分规则后的下一次回复只做一件事：`Write` 骨架；写骨架之前不推演任何维度、Gate、覆盖或行动的内容。身份、范围、O4 回执、评分规则（id、版本、绝对路径、摘要）照实填写；其余顶层键逐行用 `null` 占位：`"risk_direction": null,`、`"comparison_status": null,`、`"human_gate_pending": null,`、`"upstream_pending": null,`、`"coverage": null,`、`"actions": null,`、`"debts": null,`、`"incomplete_statement": null,`、`"total": null,`、`"tier": null,`，最后一行固定为 `"complete_five_dimension_score": null`（不带逗号）；`dimensions` 下 `D1`…`D5` 各占一行，写成 `"D1": {"status": "deferred"},`（`D5` 行不带逗号）。CN 规则包不在骨架前通读，算 D3 时再用 `Grep`（单文件路径）按 rule id 查。骨架写入后不再整份 `Write`：第 5 步之前发现骨架应有而漏写的字段，用一次 `Edit` 在某个已有的 `"key": null,` 行前插入（新行带尾逗号），已写的内容不为措辞重写。
2. 先据 O4 回执与任务透传项写方向、Gate 与覆盖（每个键一次 `Edit`）：`risk_direction`（单版本保持 `null`，不 Edit）、`comparison_status`、`human_gate_pending`（本次自判的 Gate）、`upstream_pending`（任务透传项原样照列，与自判 Gate 分列、不合并、不计分），以及 `coverage`（七项覆盖状态；任务和 O4 回执都没给的项写 `unknown` 并注明来源缺失）。D2 的方向封顶与 D5 的 Gate 扣分依赖这两项，所以排在五维之前。
3. 一次回复只算一维：用 `MathCalc` 复算 S/P/C/D，再用 `Edit` 把该维占位换成单行完整对象（首键 `"status"` 写 `scored`/`not_covered`/`not_applicable`，再写 S、P、C、D，命中的 rule code、次数、数值、证据，以及 not_covered/not_applicable 的依据）。证据只写 finding_id 与位置（条款号、页码、行号），不抄长引文，单维对象控制在约 3000 字以内。`old_string` 与 `new_string` 都只写 `"Dn": {…}` 本身，不含行首缩进、不含行尾逗号；逗号留在原处不动（`D5` 行原本没有逗号，替换后也不加）。D4 命中 `CAP-D4-PAYMENT-UNMAPPED` 时，同一次回复把 `GATE-PAYMENT` 补进 `human_gate_pending`。算 D5 之前，先用 `Edit` 把 `actions` 写成行动建议数组（每条一行，含 finding_id、祈使句动作、priority、具体修改落点、签核归属）：首批把 `"actions": null` 换成数组，`old_string` 与 `new_string` 都不含行尾逗号，逗号留在原处；超过约 3000 字就分批，后一批以已写最后一条的整行为 `old_string`，换成该行加逗号再加新条目。D5 按这份清单评分，报告的行动清单也只从这里渲染。`actions` 只写对合同条款或签署流程的动作。O4 记下的上游字段与原件不一致（如上游标错页码）是审查链路自己的证据问题：按对应维的 penalty 计，第 5 步写 `debts` 时列入并注明 O4 已据原件更正、对合同无修改要求；它不是需要行动的发现，不写进 `actions`，D5 也不因它记 `DED-D5-NO-ACTION`。
4. 是否命中只看该 rule code 的 metric、名称或 CN 包规则写明的触发条件字面：字面写到的情形才算覆盖，没写到的不落该项（例如单价×数量与载明合计不符是算术口径差异，不是 `amount-in-words-mismatch` 的「金额大小写不一致」）。仅当某条 rule code 已明确覆盖该事实、只是措辞或区间边界有两种读法时，取扣分更多或封顶更低的一种，写一句 `interpretation_note` 后继续，不在思考里反复比较。读法取决于原件里是否另有约定（如另一条款是否已写明该期限的起算点）时，那是事实问题，不是读法问题：用固定字符串 `Grep` 查任务列入的原件（可用 `literals` 一次查几种写法；这是核一项事实，不是重做 O4），把查到的条款号与行号写进该维的 `interpretation_note`，按查到的事实判，不为没查过的事实取扣分更多的一种。事实不落在任何 rule code 内时不扣分、不类推，记入该维 `rule_gaps` 并列为欠账（D1 适用性无依据按 not_covered）。
5. 五维写完后，逐个用 `Edit` 把 `total`、`tier`、`incomplete_statement`、`debts`、`complete_five_dimension_score` 的 `null` 换成值（有维度为 `not_covered` 时 `total`、`tier` 保持 `null`，`complete_five_dimension_score` 写 `false`），不新增键、不整份 `Write`，最后整份回读一次。scorecard 必须声明是否 `complete_five_dimension_score`，列出范围、O4 receipt、规则来源、逐维算式、方向、Human Gate 与欠账。
6. O5 四个文件路径固定，不按产物 id 分文件：重新委派直接 `Write` 覆盖 `scorecard.json` 与 `report.md`，只有 `export-attempts.json` 保留历史；只有 `DelegateControl` resume 时才先 `Read` 本次 scorecard，从仍为 `deferred` 的维度或仍为 `null` 的键接着做；`comparison_status` 为 `not_applicable` 时 `risk_direction` 的 `null` 是终值，五维都已写出且有维度为 `not_covered` 时 `total`、`tier` 的 `null` 也是终值，都不再处理。

scorecard 写完并回读后，再交给 `report-composition`。
