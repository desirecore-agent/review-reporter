---
name: review-scoring
description: >-
  合同审查的独立复核与加权评分。对上游交付的结构化事实执行准入校验与入口净化（夹带推理链即拒收），
  逐条从原文重新取证（confirmed / refuted / unlocatable / additional 四态），按固定权重计算五维得分
  （条款抽取 20% / 风险评估 25% / 合规稽核 20% / 义务与时序映射 15% / 建议生成 20%），
  按五档阈值映射行动，判定版本对比的风险变化方向，并登记法务四类不可替代动作的 Human Gate 签核点。
  用户提到合同复核、独立复核、交叉复核、风险评分、加权打分、阈值判定、放行判断、签核点、
  风险方向、版本对比结论时使用。
  Use for independent cross-review and weighted scoring of a contract review: sanitizes upstream
  input, re-derives every claim from the source document, computes the five-dimension weighted
  score with fixed deduction tables, maps to the five action tiers, and raises human sign-off gates.
version: 1.0.2
type: procedural
risk_level: low
status: enabled
tags:
  - contract-review
  - independent-review
  - scoring
  - human-gate
  - version-diff
requires:
  tools:
    - Read
    - Ls
    - Glob
    - Grep
    - Write
    - MathCalc
    - GenerateUUID
    - AskUserQuestion
metadata:
  author: DesireCore
  version: 1.0.2
  updated_at: '2026-09-07'
---

# 独立复核与加权评分

## 何时使用

上游（条款结构化 / 风险识别 / 法域合规）交付完毕、需要出具最终评分与行动清单时执行本技能。
本技能是固定工具链的**第 7 步之前半**：算分与判档。报告排版与证据索引由 `report-composition` 承接。

## 不可协商的前提

1. **R0→R7 顺序固定**，不得打乱、不得跳步。R0 未通过时**不进入 R1**。
2. **不读前序推理**。上游的论证过程、severity、score、confidence、recommendation 一律剥离，
   且在评分公式里**没有输入位**。
3. **每条结论四元组齐备**：条款编号 + 证据位置 `{part, page, quote}` + 结论等级 + 对应动作。
4. **证据必须自取**。报告里每条 `quote` 都要由你用 `Grep` 在原文固定字符串命中；转引上游引文一律不算。
5. **Human Gate 不可被分数替代**。未满足即退回重审，不做默认通过。

---

## 稳定 ID 约定（不得用自由文本当 ID）

| 前缀 | 用途 | 例 |
|---|---|---|
| `REJ-*` | 准入拒收码 | `REJ-INPUT-CONTRACT`、`REJ-REASONING-LEAK` |
| `RV-###` | 重新取证台账条目 | `RV-007` |
| `FND-###` | 复核确认的发现（进报告） | `FND-003` |
| `ACT-###` | 行动清单条目 | `ACT-003` |
| `SCORE-D1`…`SCORE-D5` | 五个评分维度 | `SCORE-D2` |
| `DED-<维度>-<码>` | 扣分项 | `DED-D2-MISS-CRITICAL` |
| `CAP-<维度>-<码>` | 封顶规则 | `CAP-D2-CRITICAL-MISS` |
| `GATE-*` | 法务签核点 | `GATE-PAYMENT` |
| `DIV-###` | 分歧账条目（我与上游不同的地方） | `DIV-002` |
| `RERUN-###` | 退回上游的重跑指令 | `RERUN-001` |

上游 ID（`BLK-*` / `FLG-*` / `PEND-*` / `gate_reason_id` / 条款 `slug` / `risk id`）原样保留引用，不改写。

---

## R0 准入校验与入口净化

**这是收到交接后的第一个动作。不是分析，是验收与剥离。**

### R0.1 契约必备字段核对

上游交接块（见输入治理技能「结构化交接」一节）必须齐备下列顶层字段，缺一即拒收：

| 字段 | 缺失时拒收码 |
|---|---|
| `object.contract_object_id` / `object.submission_mode` | `REJ-INPUT-CONTRACT` |
| `confirmed[]` | `REJ-INPUT-CONTRACT` |
| `pending[]`（可为空数组，但字段必须存在） | `REJ-INPUT-CONTRACT` |
| `scope.frozen_baseline` / `scope.consistency_conclusion_allowed` | `REJ-INPUT-CONTRACT` |
| `do_not_pass` | `REJ-NO-CONTRACT-DECLARATION` |
| 各产物的绝对路径（条款表 / 风险清单 / 法域报告 / 原文件） | `REJ-MISSING-ARTIFACT-PATH` |

`submission_mode: version_comparison` 时 `object.versions[]` 必须给出全部版本标识，否则 `REJ-INPUT-CONTRACT`。

### R0.2 字段白名单：原文可证伪测试

**判据**：一个字段可以保留，当且仅当**存在原始合同中的一个具体位置，读了那处之后能唯一判定该字段真假**。

| 保留（事实） | 剥离（论证 / 判断） |
|---|---|
| `clause`、`slug`、`gate_reason_id`、`risk id` | `rationale`、`analysis`、`reasoning`、`thinking`、`notes` 中的论证段 |
| `evidence.{part, page, quote, locator}` | `severity`、`risk_level`、`score`、`confidence`、`probability` |
| 字段值：金额、期限、比例、主体名、版本号、文档编号 | `recommendation`、`suggested_action`、`conclusion`、`summary`、`verdict_basis` |
| `rule_id` + 规则包版本、标尺参考值 | 任何含「我认为 / 因为…所以 / 综合考虑 / 鉴于 / 由此可见 / 倾向于 / 整体来看」的自然语言段 |
| `part` 清单、页码范围、`diff_scope`、`body_diff_count` | 对话历史、中间草稿、工具调用记录、前序 run 摘要 |
| `pending[]` 全字段（它是交接契约的一部分，见 R0.4） | 上游对自身产出的自评与质量声明 |

> 上游给的 `severity` 长得像事实（一个枚举值），实际是判断结果。它进入 `upstream_claim.severity`
> 只作分歧对照，**不进评分公式**，且必须由 R4 按标尺表重算。

### R0.3 夹带扫描与拒收

对交接块与各产物做一次夹带扫描（`Grep`，中英各一轮）：

```
我认为|我判断|因此|因为|所以|综合|鉴于|由此|倾向于|考虑到|整体来看|大体上|推测|应该是
I think|I believe|therefore|because|hence|overall|in my judgment|likely|presumably
```

命中位置若落在 `finding` / `statement` 之外的字段，或落在被声明为「事实」的字段里 → `REJ-REASONING-LEAK`。

**拒收动作**（不是"收下但不看"）：

1. 不进入 R1，不做任何实质分析。
2. 用 `Delegate`（`mode: sync`）向来源发回：

```yaml
input_rejection:
  code: REJ-REASONING-LEAK
  from: review-reporter
  contract_object_id: <原样>
  violated:
    - field_path: risks[2].rationale
      contract_clause: "do_not_pass · 本 Agent 的推理过程与中间草稿"
      excerpt: "考虑到本合同金额较大，我认为责任上限……"
  required_resend: 按交接契约重发，仅保留可被原文一次性证伪的事实字段
  note: 本次未读取被拒字段内容以外的任何信息；未开始实质复核
```

3. 重发后从 R0.1 重新开始。**同一次交接最多拒收两次**；第三次仍不合规，升级为「必须人工主导，暂停推进」（第四档），并在报告写明。

> 拒收不阻断流水线，它只是把「独立性」从一句承诺变成一次可失败的检查。

### R0.4 落盘净化产物

写到 `<有效工作目录>/contract-review/<contract_object_id>/review/<review_id>/sanitized-input.yaml`：

```yaml
sanitized_input:
  review_id: REVIEW-20260331-3c81ab77          # GenerateUUID 前 8 位
  sanitized_at: 2026-03-31T14:02:11+08:00
  source_handoff: {from: <上游 agent id>, intake_id: <原样>, receipt_path: /abs/...}
  object: {...}                                 # 原样透传
  confirmed: [...]                              # 原样透传
  pending: [...]                                # 原样透传，一条不删
  scope: {...}                                  # 含 frozen_baseline / consistency_conclusion_allowed
  artifacts:                                    # 绝对路径
    source_documents: [/abs/.../C06a-saas-v1.md, /abs/.../C06b-saas-v2.md]
    clause_table: /abs/.../clauses.yaml
    risk_list:    /abs/.../risks.yaml
    jurisdiction_report: /abs/.../jurisdiction.yaml
  claims_accepted: 41                           # 通过白名单、可进入 R2 重新取证的断言数
  stripped:                                     # 剥掉了什么（可审计）
    - {field_path: risks[*].severity,       count: 12, reason: 判断结果，非可证伪事实}
    - {field_path: risks[*].rationale,      count: 12, reason: 论证过程}
    - {field_path: clauses[*].confidence,   count: 31, reason: 置信度是自评}
    - {field_path: jurisdiction.summary,    count: 1,  reason: 结论摘要}
  stripped_count: 56
```

`review_id` 用 `GenerateUUID` 生成，格式 `REVIEW-<YYYYMMDD>-<uuid 前 8 位>`。
`<有效工作目录>` 用 `Ls` 实际确认后取绝对路径，**不要在提示词或产物里写死任何用户主目录字面量**。

---

## R1 复核范围锁定

1. `Read` 全部 `artifacts.source_documents`（PDF / 扫描件用 `Read` 直接读，图片页用 `UnderstandImage` 看清版面、印章、表格）。
2. 按 `scope.frozen_baseline.page_range` 对每个部件核对页数；对不上 → 记 `RV-*` 为 `unlocatable` 并在 D1 扣分。
3. 锁定**必查条款清单**：蓝本九项 + 合同类型附加项。每项在报告中必须有状态：
   `present` / `absent` / `not_applicable`（须写依据）/ `not_covered`（须写未覆盖原因）。
4. 锁定**适用标尺集**（见 R4 · D2 标尺表）与**法域规则包**（`rule_id` + 版本，来自法域报告，不得凭记忆补）。
5. 把 `pending[]` 逐条登记为待兑现项。`must_escalate: true` 的每一条在最终报告里必须有明确落点
   （成为 `FND-*`、成为 `GATE-*`、或被显式判为不成立并说明理由）。**不得消失、不得被合并稀释。**

---

## R2 重新取证（四态）

对 `claims_accepted` 里的**每一条**断言执行，一条不漏。

**方法**：拿断言里的 `clause` / 字段值当**导航线索**，用 `Grep` 在原文做固定字符串或关键词命中，
自己读上下文，自己抄引文。命中后记录你自己的 `{part, page, quote}`。

> **指向条款规则（硬规则）**：条款的实质值由另一份文档承载时（如"以附件二《服务水平协议》
> 中约定的责任限额为准"），证据锚点必须落在**承载实质值的那份文档**上。
> 落在指向处的证据一律判 `unlocatable`。
> —— 这条规则让「附件被替换」无法躲过：你根本没法在不打开附件的情况下给该条款取到合格证据。

| 状态 | 判定条件 | 后果 |
|---|---|---|
| `confirmed` | 原文命中，且语义与断言一致 | 进入报告与评分 |
| `refuted` | 原文与断言矛盾（说有的没有 / 说无的有 / 数值对不上） | 进报告作**上游误报**，扣分，写 `DIV-*` |
| `unlocatable` | 找不到支撑该断言的原文位置 | **不进报告结论**，只进 `unverified_ledger`，扣分 |
| `additional` | 上游未报、你自己发现 | 进报告作**上游漏检**，扣分，是复核的增量价值 |

`unlocatable` ≠ `refuted`：前者是"我证不出来"，后者是"我证出来它是错的"。
把 `unlocatable` 写成 `refuted` 是越权；把 `refuted` 写成 `unlocatable` 是放水。

**补漏义务**：R2 不是只验上游报了的。必查条款清单与适用标尺集里**上游没提到的每一项**，
你都要主动去原文查一遍，查到问题记 `additional`。

台账条目格式：

```yaml
- id: RV-007
  claim_source: risk-scanner            # 仅作追责，不作可信度依据
  upstream_claim:                        # 不参与评分
    id: liability-cap-below-market
    severity: high                       # 上游说 high
    quote: "…3 个月…"                    # 上游给的引文，不采用
  status: confirmed
  self_evidence:                         # 我自己取的证据（唯一算数的）
    part: "attachment:附件二"
    page: 2
    quote: "不超过索赔事件发生前 3 个月内甲方实际支付的服务费用总额"
    locator: /abs/.../C06b-saas-v2.md
  clause: "附件二 5.1"
  self_severity: critical                # 我按标尺表重算：< 6 个月 → critical
  divergence: DIV-002                    # 与上游不一致，登记分歧
```

---

## R3 版本对比与风险方向

`submission_mode: version_comparison` 时必做；单版本受理跳过但需在回执写 `risk_direction: n/a`。

### R3.1 先声明比对范围

```yaml
diff_scope:
  parts_compared: [body, "attachment:附件二"]
  parts_not_compared: ["attachment:附件一", "attachment:附件三"]   # 正文未随材料送达
  body_diff_count: 0
```

### R3.2 风险方向四态

| 方向 | 判定条件 |
|---|---|
| `rising` | 任一部件存在使己方权益下降的实质变更（承诺下调、上限收窄、窗口缩短、义务加重、救济减少） |
| `falling` | 存在实质改善且无任何下降项 |
| `flat` | 比对范围**覆盖全部部件**，且无任何实质变更 |
| `undetermined` | 比对范围未覆盖全部部件，或 `scope.consistency_conclusion_allowed: false` |

### R3.3 三条硬规则

1. **`body_diff_count == 0` 不是业务结论。**它是技术事实，只能写进 `diff_scope`，
   不得单独作为"两版一致 / 风险无变化"的依据。
2. **范围没盖全就判 `undetermined`，不判 `flat`。**宁可拒绝，不给假安心。
3. **`consistency_conclusion_allowed: false` 时全文禁止出现**"一致 / 无差异 / 差异为 0 / 风险持平"。

### R3.4 方向为 `rising` 的连带效果

- 相关动作的等级从「建议优化」**升级为「先谈判」**（未升级 → `DED-D5-NO-ESCALATION`）。
- 附件被整体替换时，必须点名到具体版本号与文档编号（`SLA-v1.2 → SLA-v2.0`，
  `YCIT-DOC-SLA-v1.2 → YCIT-DOC-SLA-v2.0`），不得笼统写"附件有更新"。
- 逐条列出实质下调项，每条带两版对照值与两侧证据锚点。

---

## R4 五维评分

每维：`Di = clamp(0, 100, Si − Pi)`，再应用封顶 `Ci`（命中多个取**最小值**）。

- `Si` = **实质基准分**：合同本身在这一维的表现，从原文与客观标尺算出。
- `Pi` = **证据惩罚**：这一维的复核证据质量缺陷（漏检、误报、缺锚点、证不出来）。
- `Ci` = **封顶**：结构性失格，不靠扣分，直接压档。

> **不确定性计入风险侧。**证据不足降低分数，不是"存疑就不算"。

### SCORE-D1 条款抽取（权重 20%）

**必查条款缺失基准严重度**（`Si` 从 100 起扣）：

| slug | 基准 | 影响 | 扣分 |
|---|---|---|---|
| `liability-cap` | critical | 关键权益 | −25 |
| `breach-remedy` | critical | 关键权益 | −25 |
| `dispute-resolution` | critical | 关键权益 | −25 |
| `data-export` | high | 关键权益（数据类）/ 执行秩序 | −15 |
| `audit-right` | high | 执行秩序 | −15 |
| `force-majeure` | high | 执行秩序 | −15 |
| `termination-convenience` | medium | 执行秩序 | −8 |
| `grace-period` | medium | 执行秩序 | −8 |
| `subcontracting` | medium | 效率 | −8 |

**类型调整**（先调整再扣分，调整依据必须写进报告）：

- 持续性服务合同（订阅 / 外包 / 框架采购 / MSA）：`audit-right`、`data-export` 维持 high。
- 一次性交易、纯保密类（NDA）：`audit-right` / `data-export` / `subcontracting` /
  `termination-convenience` 多为 `not_applicable`，须逐项写依据。
- 不涉及个人信息或客户数据处理：`data-export` 标 `not_applicable`。
- `not_applicable` 不扣分；**但没写依据的 `not_applicable` 按 `not_covered` 处理**。

**`P1` 证据惩罚**：

| 码 | 情形 | 每项扣分 |
|---|---|---|
| `DED-D1-NO-STATUS` | 必查项既无结论也无 `not_covered` 留白 | −10 |
| `DED-D1-REFUTED` | 重新取证判 `refuted`（说有的没有 / 说无的有） | −15 |
| `DED-D1-UNLOCATABLE` | 重新取证判 `unlocatable` | −8 |
| `DED-D1-NO-ANCHOR` | `present` 但无页码 / 定位锚点 | −5 |
| `DED-D1-FIELD-MISMATCH` | 关键字段（金额 / 期限 / 主体 / 版本号）与原文不一致 | −10 |

**`C1` 封顶**：

| 码 | 条件 | 封顶 |
|---|---|---|
| `CAP-D1-MISCLASSIFIED` | 把「条款存在但内容不利」报成「条款缺失」 | 59 |
| `CAP-D1-NOT-COVERED` | 存在 `not_covered` 必查项而报告未显式留白 | 73 |

### SCORE-D2 风险评估（权重 25%）

**`S2` 从 100 起扣，按你自算的严重度**（`critical −25` / `high −15` / `medium −8` / `low −3`）。

**市场标尺严重度表（自算，不采信上游）**：

| 标尺 | 观测值 | 风险 id | 严重度 |
|---|---|---|---|
| 责任上限 | ≥ 12 个月费用 | — | 无风险 |
| | 6–11 个月 | `liability-cap-below-market` | high |
| | < 6 个月 | `liability-cap-below-market` | **critical** |
| 续约 / 不续约通知窗口 | ≥ 90 天 | — | 无风险 |
| | 60–89 天 | `renewal-notice-window-too-short` | medium |
| | < 60 天 | `renewal-notice-window-too-short` | high |
| 竞业限制期限 | 1–2 年 | — | 无风险 |
| | > 2 年且 < 5 年 | `non-compete-term-excessive` | high |
| | ≥ 5 年 | `non-compete-term-excessive` | **critical** |
| 竞业经济补偿 | 未约定 | `non-compete-without-compensation` | **critical** |
| 数据导出 | ≥ 90 天 + 标准格式 | — | 无风险 |
| | 30–89 天 / 需主动请求 / 逾期即删 | `data-export-window-short` | medium |
| | 附加收费 | `data-export-charged` | medium |
| | 完全禁止 | `data-export-prohibited` | **critical** |
| 服务可用性（跨版本） | 相对前版下调 | `availability-sla-downgrade` | high |
| 服务信用补偿（跨版本） | 相对前版下调 | `service-credit-downgrade` | medium |
| 保密期限 | 永久且无终止机制 | `confidentiality-term-perpetual` | high |
| 调价 | 单方调价 + 沉默视为接受 | `unilateral-price-adjustment` | medium |
| 排他性 | 无最低承诺却施加排他 | `no-minimum-commitment-with-exclusivity` | medium |
| 金额一致性 | 大写与小写不一致 | `amount-in-words-mismatch` | medium |

**`P2` 证据惩罚**：

| 码 | 情形 | 每项扣分 |
|---|---|---|
| `DED-D2-MISS-CRITICAL` | 漏检（`additional`）且自算严重度为 critical / high | −20 |
| `DED-D2-MISS-MINOR` | 漏检且为 medium / low | −8 |
| `DED-D2-FALSE-POSITIVE` | 上游报出但你在原文 `refuted`（误报） | −20 |
| `DED-D2-NO-QUAD` | 风险条目缺四元组任一项 | −10 |
| `DED-D2-SEVERITY-DRIFT` | 上游 severity 与标尺表不符且未记入 `DIV-*` | −10 |
| `DED-D2-UNLOCATABLE` | 断言 `unlocatable` | −8 |

> 误报与漏检**同等严重**（各 −20）。报得多不是尽责，是给下游制造噪声。

**`C2` 封顶**：

| 码 | 条件 | 封顶 |
|---|---|---|
| `CAP-D2-CRITICAL-MISS` | 任一 critical 风险被漏检 | **47** |
| `CAP-D2-WRONG-DIRECTION` | 存在实质下调却把风险方向判为 `flat` / `falling` | **47** |
| `CAP-D2-DIRECTION-UNDETERMINED` | 风险方向 `undetermined` | 59 |

### SCORE-D3 合规稽核（权重 20%）

**任何合同都要评这一维，不得因"没有跨法域要素"跳过或重分配权重。**
没有跨法域要素时，评的是「法域声明是否明确、规则包是否对得上、有无隐性跨法域要素」。

**`S3` 从 100 起扣**：

| 情形 | 每项扣分 |
|---|---|
| 同一文本存在冲突的适用法或并存的排他管辖（`governing-law-conflict`） | −25 |
| 违反法域强制性规范（试用期超法定上限、竞业超法定保护期等），须带 `rule_id` | −20 |
| 声明适用某法域但缺该法域必备机制（如 GDPR 跨境传输合法性机制） | −20 |
| 法域适用条款完全缺失 | −30 |

**`P3` 证据惩罚**：

| 码 | 情形 | 扣分 |
|---|---|---|
| `DED-D3-NO-PACK-VERSION` | 法域结论未标注 `jurisdiction_pack_version` | −10（一次） |
| `DED-D3-NO-RULE-ID` | 规则引用无 `rule_id` | 每条 −5 |
| `DED-D3-LAYER-UNDECLARED` | 未声明命中的知识层（`custom` > `jurisdiction` > `base`） | 每条 −5 |
| `DED-D3-JURIS-UNDETERMINED` | 法域线索未确定 | −30（一次） |
| `DED-D3-FROM-MEMORY` | 法条 / 标尺来自模型记忆而非知识包 | 每条 −15 |

**`C3` 封顶**：

| 码 | 条件 | 封顶 |
|---|---|---|
| `CAP-D3-PACK-MISMATCH` | `jurisdiction_pack_version` 与法域线索不匹配 | **0** |

> 规则包与合同法域对不上时，产出的合规结论不是"不够准"，是"指向另一个法律体系"。
> 这本该在输入治理阶段阻断；走到复核说明前置失守，不能靠复核补分。

### SCORE-D4 义务与时序映射（权重 15%）

**义务时序表**每条 = `{obligation_id, 责任主体, 触发条件/起算点, 期限, 后果, 证据锚点}`。

**`S4` 从 100 起扣**（合同侧缺陷）：

| 情形 | 每项扣分 |
|---|---|
| 含期限的义务无明确起算点 | −10 |
| 双向义务被单边化（只约束一方） | −10 |
| 期限之间自相矛盾（通知期 / 终止期 / 结算周期冲突） | −15 |
| 生效要件或条件先例未约定 | −20 |

**`P4` 证据惩罚**：

| 码 | 情形 | 每项扣分 |
|---|---|---|
| `DED-D4-NOT-MAPPED` | 含期限的义务未进入时序表 | −10 |
| `DED-D4-NO-SUBJECT` | 义务无责任主体 | −8 |
| `DED-D4-NO-ANCHOR` | 义务无证据锚点 | −5 |
| `DED-D4-NO-RECOMPUTE` | 期限 / 金额算术未用 `MathCalc` 自己复算一次 | −5 |

**`C4` 封顶**：

| 码 | 条件 | 封顶 |
|---|---|---|
| `CAP-D4-PAYMENT-UNMAPPED` | 付款触发与回款相关义务缺失或无起算点 | 59（并强制 `GATE-PAYMENT`） |

### SCORE-D5 建议生成（权重 20%）

**每条动作** = `{针对的 FND-*, 祈使句动作, 谈判优先级 must/should/nice, 落点（改哪一条、改成什么）, 签核归属, 备选方案（可选）}`。

**`S5` 从 100 起扣**：

| 码 | 情形 | 每项扣分 |
|---|---|---|
| `DED-D5-NO-ACTION` | 有发现无对应动作 | −10 |
| `DED-D5-NOT-ACTIONABLE` | 动作是描述句或不可执行（"建议关注""注意风险""酌情处理""持续跟进"） | −10 |
| `DED-D5-NO-PRIORITY` | 无谈判优先级 | −5 |
| `DED-D5-NO-TARGET` | 无落点（没说改哪一条、改成什么） | −8 |
| `DED-D5-NO-ESCALATION` | 风险方向 `rising` 但动作仍停留在「建议优化」 | −20 |
| `DED-D5-GATE-BYPASS` | 对 Human Gate 四类动作给出「可自动放行」建议 | −25 |

**`C5` 封顶**：

| 码 | 条件 | 封顶 |
|---|---|---|
| `CAP-D5-UNGATED-RELEASE` | 出现任何未挂签核点的「放行」建议 | **47** |

---

## R5 总分、封顶与档位

### 计算（每一步都用 `MathCalc` 复算并留痕）

```
D1 = min(CAP_D1..., clamp(0,100, S1 − P1))
D2 = min(CAP_D2..., clamp(0,100, S2 − P2))
D3 = min(CAP_D3..., clamp(0,100, S3 − P3))
D4 = min(CAP_D4..., clamp(0,100, S4 − P4))
D5 = min(CAP_D5..., clamp(0,100, S5 − P5))

total = floor( 0.20·D1 + 0.25·D2 + 0.20·D3 + 0.15·D4 + 0.20·D5 )
```

**三条计算纪律**：

1. **向下取整**（`floor`），不四舍五入。`87.9` 是 `87`，属第二档，**不是** `88`。
2. **命中多个封顶取最小值**，不取平均、不取最近。
3. **权重恒定**，不因某维"不适用"而重新分配或归一——重分配会稀释漏检惩罚，
   让"越是没检查的领域越不影响分数"。

### 档位映射（蓝本第五节，原样）

| 分数 | 动作 | 档位码 |
|---|---|---|
| 88–100 | 可放行至法务确认（**需通过签核点**） | `TIER-1-LEGAL-REVIEW` |
| 74–87 | 可谈判项，先出修改建议 | `TIER-2-NEGOTIATE` |
| 60–73 | 关键修改后继续 | `TIER-3-FIX-FIRST` |
| 48–59 | **必须人工主导，暂停推进** | `TIER-4-HUMAN-LED` |
| 0–47 | **重建条款，重跑评审** | `TIER-5-REBUILD` |

**第一档不等于放行。**「可放行至**法务确认**」的意思是：这份材料够格送到法务面前，
而不是它可以签。签核点未全部通过时，最终结论仍是**退回重审**。

### 退回上游重跑（`TIER-5` 或某维证据严重不足时）

- 只在**证据侧**退回（某维 `unlocatable` 过多、必查项大面积 `not_covered`），
  不因**结论侧**分歧退回——结论分歧进 `DIV-*` 由人裁决，不是让上游改口。
- **每维最多退回一次**。第二次仍不合格，不再退回，直接判 `TIER-4-HUMAN-LED` 并写明升级理由。
- 用 `Delegate`（`mode: sync`），只发失败编码 + 需补字段 + 部件与页码范围。
  **不含你的判断与倾向**——否则第二轮就是照着你的答案抄的，不再是独立产出。

```yaml
rerun_request:
  id: RERUN-001
  to: clause-extractor
  reason_codes: [DED-D1-UNLOCATABLE, DED-D1-NO-STATUS]
  missing_fields:
    - {slug: audit-right, need: 状态 + evidence{part,page,quote}}
  parts_in_scope: ["attachment:附件二"]
  page_range: "1-2"
  deadline_turns: 1
```

---

## R6 Human Gate（法务四类不可替代动作）

命中即登记签核点。**系统无法自动放行；不满足则退回重审，不做默认通过。**

| 签核点 | 触发条件 |
|---|---|
| `GATE-PAYMENT` | 付款触发与回款：金额、逾期、结算周期、付款条件、发票与验收挂钩关系发生变更或存在缺口 |
| `GATE-DISPUTE` | 争议解决机制：管辖权、仲裁 / 诉讼选择、仲裁机构、适用法冲突 |
| `GATE-LIABILITY` | 责任违约分配：责任上限、间接损失排除、不可抗力范围、赔偿例外 |
| `GATE-EXECUTION` | 生效要件：有效签章、依赖附件、法定形式、生效条件先例 |

**处理流程**：

1. 每个签核点写成四元组：条款编号 + 证据位置 + 结论等级 + **需要法务确认的具体问题**。
2. 用 `AskUserQuestion`（`wait_mode: always_wait`）阻塞等待真人确认，逐个签核点单独问，
   不合并成一个"是否全部同意"。
3. 真人未确认 / 未答复 → 状态 `pending`，最终结论为**退回重审**，
   `release_decision: blocked_by_human_gate`。
4. 记录确认人、确认时间、确认内容原文，写进回执（回执要支持历史回放）。

**三条禁止**：

- 不得把签核点降级为"提醒""建议关注""可后续处理"。
- 不得以"总分 92 已达第一档"为由默认通过任一签核点。
- 不得代替真人回答，也不得把 `AskUserQuestion` 的超时 / 无响应解读为同意。

---

## R7 出具评分回执

落盘到组长交接中指定的案件 canonical 工作区 `<lead_workspace>/contract-review/<contract_object_id>/review/<review_id>/scorecard.yaml`。成员自己的工作目录只能用于临时读取；不得把 scorecard 或最终报告写到成员 workspace 后再要求组长自行寻找或复制。
旧版本保留不覆盖。

### 产物完整性闸门（必须在任何 handoff 之前执行）

`scorecard.yaml` 是审计事实源，写坏一个字符就等于没有回执。写入后必须立刻用 `Read` 从磁盘重新读取**完整文件**，再逐项检查：

写入前先用 `Ls` 确认 canonical 根和目标目录；首写必须是目录下的具体文件。写入后回读并确认规范化绝对路径按完整路径段仍位于 `<lead_workspace>/contract-review/` 内；目录冲突、嵌套失败、链接边界无法确认或根外路径统一返回 `REJECT-OUTPUT-DIR`，不得回退到成员 workspace、相对路径或别名路径。

1. 顶层 `review_scorecard`、`object`、`dimensions`、`findings`、`actions`、`human_gates`、`release_decision`、`pending_settlement`、`reverify_ledger`、`unverified_ledger`、`divergence_ledger` 与 `independence_attestation` 均存在；`release_decision` 必须是允许值。
2. 对 `reverify_ledger`、`unverified_ledger`、`divergence_ledger`、`human_gates` 和 `pending_settlement` 一律使用**块映射**（每个字段独占一行），禁止嵌套 inline map。证据中的 `{`、`}`、`[`、`]`、`:`、换行或前导 `#` 必须使用单引号包住；不要在行尾重复 `}` 或 `]`。
3. 从头到尾检查每个列表项的缩进、引号和括号配对；发现任意歧义、重复闭合符或无法确定的 YAML 结构，立即用块映射重写后再次 `Read`，不得继续排版或回报。
4. 只有完整回读通过后，才允许执行 R7 handoff；失败时只回报 `REJECT-SCORECARD-YAML`、文件路径和需重写的行号，不得发送半成品报告。

```yaml
review_scorecard:
  review_id: REVIEW-20260331-3c81ab77
  reviewed_at: 2026-03-31T14:41:52+08:00
  executed_by: review-reporter
  skill: review-scoring@1.0.1
  object: {contract_object_id: YCIT-SAAS-2025-0206, submission_mode: version_comparison,
           versions: [C06a-saas-v1, C06b-saas-v2]}

  dimensions:
    - id: SCORE-D1
      name: 条款抽取
      weight: 0.20
      S: 100
      P: 0
      caps_hit: []
      D: 100
    - id: SCORE-D2
      name: 风险评估
      weight: 0.25
      S: 60                       # critical −25（责任上限 3 个月）+ high −15（可用性下调）
      P: 0
      caps_hit: []
      D: 60
    - {id: SCORE-D3, name: 合规稽核,       weight: 0.20, S: 100, P: 0, caps_hit: [], D: 100}
    - {id: SCORE-D4, name: 义务与时序映射, weight: 0.15, S: 100, P: 0, caps_hit: [], D: 100}
    - {id: SCORE-D5, name: 建议生成,       weight: 0.20, S: 100, P: 0, caps_hit: [], D: 100}

  total_raw: 90.0
  total: 90                        # floor
  tier: TIER-1-LEGAL-REVIEW
  tier_action: 可放行至法务确认（需通过签核点）

  version_diff:
    diff_scope: {parts_compared: [body, "attachment:附件二"],
                 parts_not_compared: [], body_diff_count: 0}
    risk_direction: rising
    attachment_changed: {from: "附件二 SLA-v1.2 / YCIT-DOC-SLA-v1.2",
                         to:   "附件二 SLA-v2.0 / YCIT-DOC-SLA-v2.0"}
    substantive_downgrades: [FND-001, FND-002, FND-003]

  findings: [...]                  # 每条四元组，见 report-composition
  actions:  [...]
  human_gates:
    - {id: GATE-LIABILITY, status: pending, question: ..., evidence: {...}}
  release_decision: blocked_by_human_gate   # released_to_legal | blocked_by_human_gate | returned_for_rework

  pending_settlement:              # 上游 pending[] 的兑现台账，一条不少
    - {id: PEND-01, must_escalate: true, landed_as: [FND-001, FND-002, GATE-LIABILITY]}
    - {id: PEND-02, must_escalate: false, landed_as: [not_covered:附件一, not_covered:附件三]}

  reverify_ledger: [...]           # RV-*
  unverified_ledger: [...]         # unlocatable，不进报告结论
  divergence_ledger: [...]         # DIV-*

  independence_attestation:
    input_sanitized_at: 2026-03-31T14:02:11+08:00
    sanitized_input_path: /abs/.../sanitized-input.yaml
    stripped_count: 56
    stripped_fields: [risks[*].severity, risks[*].rationale, clauses[*].confidence, jurisdiction.summary]
    reverify_counts: {confirmed: 38, refuted: 0, unlocatable: 0, additional: 3}
    self_derived_quote_ratio: 1.00        # 必须为 1.00
    upstream_reasoning_consumed: false
    subtask_mode_used: false
    handoff_with_history_accepted: false
    input_rejections: []                   # REJ-* 记录
```

---

## 自检清单（出回执前逐条确认）

**产物可回放性**

- [ ] `scorecard.yaml` 写后已完整 `Read` 回读；所有必需顶层字段存在
- [ ] 关键 ledger/list 项使用块映射，证据字符串已引用，括号与缩进闭合；没有尾部重复 `}`/`]`
- [ ] 回读失败时已用 `REJECT-SCORECARD-YAML` 停止 handoff，而不是继续生成报告

**独立性**

- [ ] R0 先于任何分析执行；`sanitized-input.yaml` 已落盘且 `stripped[]` 非空或已说明为何为空
- [ ] 报告与回执中每条 `quote` 都是自己 `Grep` 命中的；`self_derived_quote_ratio == 1.00`
- [ ] 没有引用、复述或总结任何上游论证；上游 `severity` 只出现在 `upstream_claim`
- [ ] 全程未使用 `subtask` 模式，未接受带历史的 handoff
- [ ] `additional` 计数为 0 时，已在报告里显式声明并解释（可疑复核信号）

**完整性**

- [ ] R0→R7 全部执行，无跳步
- [ ] 必查条款清单每一项都有状态；`not_applicable` 都写了依据
- [ ] `pending[]` 逐条兑现；`must_escalate: true` 的每一条都在 `pending_settlement` 里有落点
- [ ] 每条 `findings` / `human_gates` 四元组齐备

**算术**

- [ ] `Si` / `Pi` / `Ci` / `Di` 与 `total` 均已用 `MathCalc` 复算
- [ ] `total` 是 `floor`，没有四舍五入进上一档
- [ ] 多封顶取了最小值；权重没有被重新分配

**版本与结论**

- [ ] `diff_scope` 已声明；范围未盖全时方向为 `undetermined`
- [ ] `consistency_conclusion_allowed: false` 时全文无"一致 / 无差异 / 差异为 0 / 风险持平"
- [ ] `body_diff_count == 0` 只出现在 `diff_scope`，没有被当作业务结论
- [ ] 方向为 `rising` 时相关动作已升级为「先谈判」
- [ ] 附件被替换时点名了版本号与文档编号

**Human Gate**

- [ ] 四类动作逐类检查过，命中的都登记了 `GATE-*`
- [ ] 每个签核点单独问过真人，未合并；无响应未被当作同意
- [ ] 有 `pending` 签核点时 `release_decision` 不是 `released_to_legal`

**落盘**

- [ ] 路径用 `Ls` 实际确认过，是绝对路径，未写死任何用户主目录字面量
- [ ] 旧回执保留未覆盖
