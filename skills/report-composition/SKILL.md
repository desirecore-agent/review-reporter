---
name: report-composition
description: >-
  合同审查最终报告的排版与证据索引。把 review-scoring 的评分回执渲染成条款级 Markdown 报告：
  审前 / 审中 / 审后三段式交付，每条发现强制四元组（条款编号 + 证据页码 + 结论等级 + 对应动作），
  行动清单带谈判优先级与落点，法务签核点单列，版本对比标注风险变化方向，末尾附证据索引与独立性声明。
  用户提到出报告、审查报告、条款级报告、证据索引、行动清单、待办清单、签核点清单、
  三段式交付、报告模板时使用。
  Use to render the final contract review report: three-phase delivery, clause-level findings with
  mandatory four-part conclusions, an evidence index traceable to page and quote, a prioritized
  action list, human sign-off gates, and an independence attestation.
version: 1.0.4
type: procedural
risk_level: low
status: enabled
tags:
  - contract-review
  - reporting
  - evidence-index
  - action-plan
  - deliverable
requires:
  tools:
    - Read
    - Ls
    - Grep
    - Write
    - Edit
    - MathCalc
metadata:
  author: DesireCore
  version: 1.0.4
  updated_at: '2026-09-07'
---

# 复核报告排版与证据索引

## 何时使用

`review-scoring` 出具 `scorecard.yaml` 之后执行，作为固定工具链**第 7 步的后半**。

进入本技能前，必须先用 `Read` 完整回读评分回执，并确认 `review-scoring` 的产物完整性闸门已通过。若回读发现 YAML 缩进、引号或括号不闭合，停止报告排版并回报 `REJECT-SCORECARD-YAML`；不得在报告阶段自行猜测、修补或掩盖评分回执。
本技能只负责**渲染与索引**，不新增结论、不改分数、不调整严重度。

## 不可协商的前提

1. **报告内容全部来自 `scorecard.yaml`。**这里不做新判断。发现渲染时才想起来"还有一条"，
   正确动作是回到 `review-scoring` 的 R2 补取证、重算分数，不是直接写进报告。
2. **每条发现四元组齐备**：条款编号 + 证据位置 `{part, page, quote}` + 结论等级 + 对应动作。
   缺任一项 → 该条不合格，**不得渲染进报告**，只能进「未完成结论」附录。
3. **引文必须是自取证的**（`self_evidence.quote`）。`upstream_claim.quote` 一律不出现在报告正文。
4. **`consistency_conclusion_allowed: false` 时**，全文不得出现"一致 / 无差异 / 差异为 0 / 风险持平"。
5. **不得因为报告"太长""太负面"而合并、省略或软化任一条发现或签核点。**

---

## 三段式交付骨架（蓝本第十三节）

| 段 | 回答的问题 | 数据来源 |
|---|---|---|
| **审前** | 这份材料够不够格被审？审的是哪个版本？ | 上游 `confirmed[]` / `scope.frozen_baseline` / `diff_scope` |
| **审中** | 发现了什么？每条的证据与等级？ | `findings[]` / `version_diff` / `dimensions[]` |
| **审后** | 接下来谁该做什么？哪些必须人工拍板？出问题怎么退回？ | `actions[]` / `human_gates[]` / `pending_settlement` |

三段**顺序固定**，缺段即报告不完整。审前段位于最前的原因：读者要先知道"审的是哪一版、
哪些部件没覆盖"，才能正确解读后面的每一条结论。跳过审前直接看发现，是误读的主要来源。

---

## 四元组的渲染规则

每条发现在报告中的标准渲染形态：

```markdown
#### FND-002 · 服务可用性承诺相对前版下调 · 【高】

| | |
|---|---|
| **条款编号** | 附件二 第 2.1 条（主合同无对应条款） |
| **证据位置** | `attachment:附件二` 第 1 页 |
| **原文** | > 2.1 乙方承诺服务的月度可用性不低于 **99.0%**。 |
| **对照** | SLA-v1.2 第 2.1 条：不低于 **99.9%**（`attachment:附件二` 第 1 页） |
| **结论等级** | 高（`availability-sla-downgrade`） |
| **对应动作** | → `ACT-002` 先谈判：要求恢复至 99.9%，或将服务信用补偿档位同步上调至原水平 |
```

**四条渲染纪律**：

- **条款编号写实际承载位置**，不写指向位置。实质值在附件里就写附件条款号，
  主合同只在括号里注明"主合同 X.X 仅作指向"。
- **原文用引用块原样抄**，不改写、不节选到失去语义、不翻译。英文合同保留英文原文，
  可在其下另起一行给中文释义，但**证据是原文那一行**。
- **结论等级用中文档位 + 括号内的稳定 id**（`critical` → 严重 / `high` → 高 /
  `medium` → 中 / `low` → 低），便于人读也便于机器比对。
- **对应动作必须指向一个 `ACT-*`**，不得就地写一句建议了事——动作要能在行动清单里被单独跟踪。

### 不合格结论的去向

四元组缺项的结论**不进正文**，进报告末尾的「未完成结论」附录，逐条写明缺哪一项与为什么缺：

```markdown
| 断言 | 缺失项 | 状态 | 说明 |
|---|---|---|---|
| 上游称第 6.3 款存在数据本地化义务 | 证据位置 | `unlocatable` | 全文检索「本地化 / localization」零命中，无法定位 |
```

这张表是**欠账表**，不是废纸篓：它证明这些断言被处理过，而不是被忽略。空表也要保留表头并写"无"。

---

## 证据索引规则

报告末尾附证据索引，**每条发现、每个签核点都必须在索引里有行**。

| 字段 | 要求 |
|---|---|
| `id` | `FND-*` / `GATE-*` |
| 部件 | `body` 或 `attachment:<编号>` |
| 页码 | 数字；不可得时写 `—` 并在定位列给行 / 段引用 |
| 定位 | 源文件**绝对路径** |
| 命中串 | 用于 `Grep` 固定字符串复现的原文片段 |

**命中串必须能被原样 `Grep` 到**——它是这份报告可复现性的凭证。逐条复现传 `pattern: <命中串>, is_regex: false`，不得把 exact quote 当正则。写完索引后逐条实跑一遍
`Grep`，命中失败的行必须修正到命中为止；修不出来的，说明该结论的证据不成立，
应退回 `review-scoring` 重判为 `unlocatable`。

---

## 完整报告模板

团队同步时，落盘到本次 `Ls` 实际确认的 `<team effective cwd>/members/review-reporter/<case_id>/<review_id>/artifact/report.md`。先 `Read` `review_context_path`，逐项比对公开五字段；只有 `review_context_case_id` 与已读取 context 的 `case_binding.case_id` 精确相等时，才可将该值逐字作为 `<case_id>`，不得从 task、intentId、路径、旧回执或成员文本推导。`review_id` 只能使用本次真实 `GenerateUUID`；同一 artifact 子树也承载 `sanitized-input.yaml`、`scorecard.yaml` 与（如需）`human-gate-receipt.yaml`。`lead_workspace` 和 `canonical_artifact_root` 必须来自组长交接的明确绝对路径，但仅可读取输入，禁止作为报告或任何成员产物写入根。首写必须是该 member-owned 子树的具体 `report.md` 文件。写入后立即 `Read` 完整回读；规范化绝对路径按完整路径段确认仍在 `<team effective cwd>/members/review-reporter/<case_id>/<review_id>/artifact/` 内。目录冲突、嵌套失败、链接边界无法确认、根外路径或普通 `Write` 失败统一 return `REJECT-OUTPUT-DIR`，不得回退到 Lead canonical 根、其他成员 workspace、相对路径或别名路径。独立非 Team 路径才使用本 Agent 已确认的 workspace。
旧报告保留不覆盖。

下面以 C06b（附件替换陷阱）为例给出**完整可复制模板**，方括号为占位说明：

````markdown
# 合同审查报告 · 软件即服务（SaaS）订阅服务协议

| | |
|---|---|
| **合同对象编号** | YCIT-SAAS-2025-0206 |
| **审查编号** | REVIEW-20260331-3c81ab77 |
| **审查时间** | 2026-03-31 14:41 (+08:00) |
| **执行** | review-reporter（独立复核） · review-scoring@1.0.1 |
| **受理回执** | INTAKE-20260331-7f3a2c9b |
| **审查上下文** | 仅 context-bound run：case ID + revision + current manifest 摘要；不把 context 当授权或法律认定 |

> **最终评分：90 / 100（第一档：可放行至法务确认）｜风险方向：上升｜签核点：1 项待确认**
>
> **本次结论为「退回法务确认」，不是放行。**`GATE-LIABILITY` 未获真人确认前，
> 本协议不得进入签署流程。

---

## 一、审前（受理与范围）

### 1.1 审查对象与冻结基线

| 项 | 值 |
|---|---|
| 提交模式 | 版本对比（C06a-saas-v1 ⇄ C06b-saas-v2） |
| 主版本 | YCIT-SAAS-2025-0206，正文 7 页，页码 1–7 连续 |
| 签署状态 | 双方公章 + 授权代表签字 + 职务 + 签署日期 2025-11-03，齐备 |
| 附件清单 | 附件一 V1.0 ／ **附件二 SLA-v2.0**（基线版为 SLA-v1.2）／ 附件三 V1.0 |
| 法域 | 中国法（16.1，第 6 页）；规则包 cn-v3，与法域线索匹配 |

### 1.2 比对范围（读结论前必看）

| 部件 | 是否纳入比对 | 说明 |
|---|---|---|
| `body` 主合同正文 | ✅ | 两版**逐字节相同**（`body_diff_count = 0`） |
| `attachment:附件二` | ✅ | **整体替换**：SLA-v1.2 → SLA-v2.0 |
| `attachment:附件一` | ❌ | 正文未随材料送达，本次未覆盖 |
| `attachment:附件三` | ❌ | 正文未随材料送达，本次未覆盖 |

> ⚠️ **「主合同正文差异为 0」是技术事实，不是业务结论。**主合同第 10.1 款为**指向条款**
> （"以附件二《服务水平协议》中约定的责任限额为准"），其文本未变而所指向的实质值已变。
> 本次比对范围未覆盖附件一与附件三，涉及该二者的检查项一律显式留白为「未覆盖」，不作推定。

### 1.3 未覆盖项（欠账，不得当作通过）

| 检查项 | 状态 | 原因 |
|---|---|---|
| 附件一《服务规格说明书》条款实质 | `not_covered` | 正文未送达 |
| 附件三《数据处理附录》条款实质 | `not_covered` | 正文未送达 |

---

## 二、审中（发现）

### 2.1 评分构成

| 维度 | 权重 | 实质分 S | 证据惩罚 P | 封顶 | 得分 D | 加权 |
|---|---|---|---|---|---|---|
| 条款抽取 | 20% | 100 | 0 | — | 100 | 20.00 |
| 风险评估 | 25% | 60 | 0 | — | 60 | 15.00 |
| 合规稽核 | 20% | 100 | 0 | — | 100 | 20.00 |
| 义务与时序映射 | 15% | 100 | 0 | — | 100 | 15.00 |
| 建议生成 | 20% | 100 | 0 | — | 100 | 20.00 |
| **合计** | **100%** | | | | | **90.00 → 90** |

> 总分向下取整，不四舍五入。风险评估扣分明细：责任上限低于市场标尺（严重，−25）+
> 服务可用性下调（高，−15）。

### 2.2 关键条款覆盖矩阵

| 条款 | slug | 状态 | 位置 | 备注 |
|---|---|---|---|---|
| 责任上限 | `liability-cap` | ⚠️ 存在但不利 | 附件二 5.1（第 2 页） | 3 个月，低于市场标尺 → `FND-001` |
| 违约责任 | `breach-remedy` | ✅ 存在 | 第十一条（第 5 页） | — |
| 宽限期 | `grace-period` | ✅ 存在 | 4.4 / 11.1（第 3、5 页） | — |
| 终止便利性 | `termination-convenience` | ✅ 存在 | 12.2（第 5 页） | 提前 60 日 |
| 分包与变更控制 | `subcontracting` | ✅ 存在 | 第十三条（第 6 页） | — |
| 审计权 | `audit-right` | ✅ 存在 | 第十四条（第 6 页） | — |
| 争议解决 | `dispute-resolution` | ✅ 存在 | 16.2（第 6 页） | 上海国际经贸仲裁委 |
| 不可抗力 | `force-majeure` | ✅ 存在 | 第十五条（第 6 页） | — |
| 数据导出 | `data-export` | ✅ 存在 | 12.5（第 6 页） | 90 日，达标 |

> **「存在但不利」不等于「缺失」。**责任上限条款完整存在，问题在其数值低于市场标尺——
> 它计入风险清单，**不计入条款缺失**。

### 2.3 版本对比：风险变化方向 = **上升 ↑**

**附件二被整体替换**：`附件二 服务水平协议 SLA-v1.2 / YCIT-DOC-SLA-v1.2`
→ `附件二 服务水平协议 SLA-v2.0 / YCIT-DOC-SLA-v2.0`

| # | 项 | 基线（SLA-v1.2） | 当前（SLA-v2.0） | 方向 | 发现 |
|---|---|---|---|---|---|
| 1 | 责任上限 | 12 个月费用 | **3 个月费用** | ↓ 权益下降 | `FND-001` |
| 2 | 月度可用性 | 99.9% | **99.0%** | ↓ 权益下降 | `FND-002` |
| 3 | 服务信用补偿 | 10% / 25% / 50% | **5% / 10% / 20%** | ↓ 权益下降 | `FND-003` |
| 4 | 补偿申请窗口 | 30 日 | **15 日** | ↓ 权益下降 | `FND-003` |
| 5 | 恢复点目标 RPO | 1 小时 | **24 小时** | ↓ 权益下降 | `FND-004` |
| 6 | 计划内维护上限 | 每月 4 小时 / 提前 72 小时通知 | 每月 8 小时 / 提前 24 小时通知 | ↓ 权益下降 | `FND-004` |

**方向判定：上升。**比对范围内存在 6 项使甲方权益下降的实质变更，无任何改善项。

### 2.4 发现明细

#### FND-001 · 责任上限低于市场标尺 · 【严重】

| | |
|---|---|
| **条款编号** | 附件二 第 5.1 条（主合同 10.1 仅作指向） |
| **证据位置** | `attachment:附件二` 第 2 页 |
| **原文** | > 5.1 ……不超过索赔事件发生前 3 个月内甲方实际支付的服务费用总额。 |
| **对照** | SLA-v1.2 第 5.1 条：**12 个月**内甲方实际支付的服务费用总额 |
| **标尺** | 参考值 12 个月费用；低于 6 个月为高风险 → 本份 3 个月 |
| **结论等级** | 严重（`liability-cap-below-market`） |
| **对应动作** | → `ACT-001` 先谈判：恢复至 12 个月费用，或不低于 6 个月且加设安全事件专项例外 |

[FND-002 / FND-003 / FND-004 按同一形态逐条展开]

---

## 三、审后（行动、签核、回滚）

### 3.1 行动清单

| ID | 优先级 | 动作（祈使句） | 落点 | 针对 | 签核归属 |
|---|---|---|---|---|---|
| `ACT-001` | **must** | 先谈判：将责任上限恢复为 12 个月实际支付费用 | 附件二 5.1 | `FND-001` | `GATE-LIABILITY` |
| `ACT-002` | **must** | 先谈判：将月度可用性承诺恢复至 99.9% | 附件二 2.1 | `FND-002` | — |
| `ACT-003` | should | 先谈判：补偿档位恢复至 10/25/50%，申请窗口恢复为 30 日 | 附件二 3.1、3.2 | `FND-003` | — |
| `ACT-004` | should | 要求 RPO 收紧至 4 小时内，维护窗口恢复为每月 4 小时 + 提前 72 小时通知 | 附件二 6.2、2.4 | `FND-004` | — |
| `ACT-005` | must | 补交附件一与附件三正文后重跑第二轮审查 | — | 1.3 欠账 | — |

> 风险方向为「上升」，全部相关动作已由「建议优化」**升级为「先谈判」**。

### 3.2 法务签核点（不可自动放行）

| ID | 类别 | 状态 | 需要法务确认的问题 | 证据 |
|---|---|---|---|---|
| `GATE-LIABILITY` | 责任违约分配 | ⏳ **待确认** | 是否接受责任上限由 12 个月降至 3 个月？若不接受，是否将其列为签署前置条件？ | 附件二 5.1（第 2 页） |

**未获真人确认前，本协议不得进入签署流程。**无响应、超时或沉默**不视为同意**。

### 3.3 版本回滚条件

出现下列任一情形，回滚至基线版本（附件二 SLA-v1.2）重谈：

1. `GATE-LIABILITY` 未获确认且对方拒绝恢复责任上限；
2. 补交的附件一 / 附件三引入新的权益下降项；
3. 对方在签署前再次替换任一附件版本号。

### 3.4 上游待确认项兑现

| 上游 ID | 必须升级 | 落点 |
|---|---|---|
| `PEND-01`（附件二版本替换） | 是 | `FND-001`～`FND-004`、`GATE-LIABILITY`、§2.3 |
| `PEND-02`（附件一 / 三未送达） | 否 | §1.3 未覆盖项、`ACT-005` |

---

## 附录 A · 证据索引

| ID | 部件 | 页 | 定位 | 命中串（可 `Grep` 复现） |
|---|---|---|---|---|
| `FND-001` | attachment:附件二 | 2 | `/abs/.../C06b-saas-v2.md` | `不超过索赔事件发生前 3 个月内甲方实际支付的服务费用总额` |
| `FND-002` | attachment:附件二 | 1 | `/abs/.../C06b-saas-v2.md` | `2.1 乙方承诺服务的月度可用性不低于 **99.0%**。` |
| `GATE-LIABILITY` | attachment:附件二 | 2 | `/abs/.../C06b-saas-v2.md` | `不超过索赔事件发生前 3 个月内甲方实际支付的服务费用总额` |

## 附录 B · 未完成结论（欠账表）

| 断言 | 缺失项 | 状态 | 说明 |
|---|---|---|---|
| 无 | — | — | 本次无四元组缺项结论 |

## 附录 C · 独立性声明

| 项 | 值 |
|---|---|
| 输入净化时间 | 2026-03-31 14:02:11 (+08:00) |
| 净化产物 | `/abs/.../sanitized-input.yaml` |
| 剥离字段数 | 56（`risks[*].severity`、`risks[*].rationale`、`clauses[*].confidence`、`jurisdiction.summary`） |
| 重新取证 | 确认 38 ／ 证伪 0 ／ 无法定位 0 ／ **自主新发现 3** |
| 自取证引文比例 | **100%**（报告内每条引文均由本 Agent 自行在原文命中） |
| 采信上游推理 | 否 |
| 使用 subtask 模式 | 否 |
| 接受带历史 handoff | 否 |
| 输入拒收记录 | 无 |

## 附录 D · 与上游的分歧账

| ID | 项 | 上游结论 | 本次复核结论 | 依据 |
|---|---|---|---|---|
| `DIV-002` | 责任上限严重度 | 高 | **严重** | 标尺表：低于 6 个月费用为严重档；本份 3 个月 |

---

**适用边界**：本报告提供证据、评分与建议；法律效力的终局判断、商业条件拍板、签章授权与
对外承诺，由法务 / 授权人负责。本报告不构成放行结论。
````

---

## 交付与回执

### 落盘

```
<team effective cwd>/members/review-reporter/<case_id>/<review_id>/artifact/
├── sanitized-input.yaml     # R0 净化产物（review-scoring 已写）
├── scorecard.yaml           # 评分回执（review-scoring 已写）
├── human-gate-receipt.yaml  # 仅命中 Human Gate 时写
└── report.md                # 本技能产物
```

三份文件互相引用**绝对路径**。旧 `review_id` 目录**保留不覆盖**——规则更新后要靠它们做
历史回放与差异对比。

### 回报给发起方

只通过本次同步调用的 **return** 回报，且只返回结构化回执块；不得调用 `Delegate` 或 `SendMessage` 另起调度：

```yaml
review_result:
  review_id: REVIEW-20260331-3c81ab77
  from: review-reporter
  to: contract-review-lead
  contract_object_id: YCIT-SAAS-2025-0206
  total: 90
  tier: TIER-1-LEGAL-REVIEW
  risk_direction: rising
  release_decision: blocked_by_human_gate
  open_gates: [GATE-LIABILITY]
  report_path: /abs/.../report.md
  scorecard_path: /abs/.../scorecard.yaml
  review_context_echo:               # context-bound run required; otherwise omit
    case_id: case-example
    revision: 2
    current_manifest:
      status: available
      digest: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    actual_output_constraints:
      factual_extraction: allowed
      directional_risk_advice: allowed
      redline_or_negotiation_advice: allowed
      jurisdiction_substantive_conclusion: allowed
  do_not_pass:
    - 对话历史
    - 本 Agent 的推理过程与中间草稿
    - 任何未经 evidence 锚定的判断
```

**你要求上游做到的事，你自己也必须做到**：不回传对话历史，不回传推理过程。

对于 context-bound run，回报前重新读取当前 Lead context 并与交接的 case ID、revision、current
manifest 和 output constraints 逐项精确比较。任一不一致只回报
`REJECT-STALE-REVIEW-CONTEXT`，不得用旧报告摘要、review ID、run/session 或“继续”措辞恢复。
`review_context_echo.actual_output_constraints` 必须与已核对 context 的 `output_constraints` 完全相等，
记录本次实际遵守的范围，不授予任何文件或工具权限（包括 Read、Write），亦不授予 Delegate、签署、代表权、法律适用或 Human Gate 权限。旧 `HG-02`、其他 pending 与
`blocked_by_human_gate` 必须原样保留，不能因 context revision 或用户补充而消失。

在排版、写入 `report.md` 或回传任何成功结果前，还要检查唯一 `candidate_basis.pack.status`，或
`conflicting` 的每个 `candidate_bases[].pack.status`。只要任一为 `not_prechecked`，原样保留
`PEND-JURISDICTION-PACK-PREFLIGHT` 与已有 `HG-02`（如有），仅返回
`REJECT-UNPRECHECKED-REVIEW-CONTEXT`。不得自行读取/预检/pin 规则包补救，也不得把
`not_issued_pack_preflight_pending` 当作可继续排版的普通输出限制；不写报告、成功回执或业务成果。

### ⚠️ 禁止以 `subtask` 模式承接或发起复核

`Delegate` 的 `subtask` 模式**继承发起方的完整对话历史（含全部工具调用与结果）**。
这正好是独立复核要排除的东西——上游的推理、草稿、被否掉的中间判断会原封不动进入复核的上下文，
「不读前序推理」在第一步就已失守。

因此：

| 禁止 | 说明 |
|---|---|
| 组长把复核步骤做成自己会话的 `subtask` | 那份 subtask 会继承整条流水线的历史，等于让复核在污染的上下文里进行 |
| 复核 Agent 自己调用 `mode: subtask` | 会把自己已有的上下文再复制一份，无收益且扩大污染面 |
| 用 `preserve_history: true` 的 handoff 承接复核 | 同理；`accepts_handoff` 已置 `false`，任何绕行请求一律拒收 |

唯一合法的入站交接方式：Lead 的 `Delegate` `mode: sync` + 结构化交接块 + 绝对路径的输入文件；Reporter 对成功、拒收与返工请求都只使用该同步调用的 return。复核必须是一次**独立 run**，上下文从零开始，只装进过白名单的事实。

---

## 自检清单（交付前逐条确认）

**内容一致性**

- [ ] 报告中每条发现、每个签核点、每个分数都能在 `scorecard.yaml` 找到对应条目
- [ ] 没有在排版阶段新增结论、改动分数或调整严重度
- [ ] 加权表的算术与 `scorecard.yaml` 一致（用 `MathCalc` 复算一遍）

**四元组与证据**

- [ ] 每条 `FND-*` 四项齐备；缺项的已移入附录 B 欠账表（无缺项也保留表头写"无"）
- [ ] 每条引文来自 `self_evidence.quote`，无一条转引自 `upstream_claim`
- [ ] 附录 A 每条命中串已实跑 `Grep` 验证可复现
- [ ] 指向条款的条款编号写的是**承载实质值**的位置，不是指向位置

**三段式与范围**

- [ ] 审前 / 审中 / 审后三段齐全且顺序正确
- [ ] §1.2 比对范围表已列出未纳入比对的部件
- [ ] §1.3 未覆盖项已显式留白，没有因为没提就当通过
- [ ] `consistency_conclusion_allowed: false` 时全文无"一致 / 无差异 / 差异为 0 / 风险持平"
- [ ] `body_diff_count == 0` 只作为技术事实出现在比对范围表，未被当作业务结论

**版本方向**

- [ ] 风险方向已标注；`rising` 时相关动作均已升级为「先谈判」
- [ ] 附件被替换时点名了版本号与文档编号，未笼统写"有更新"
- [ ] 逐项对照表给出了两版数值，不是只说"有下调"

**行动与签核**

- [ ] 每条 `FND-*` 都有对应 `ACT-*`；每条 `ACT-*` 有祈使句、优先级与落点
- [ ] 没有出现"建议关注""注意风险""酌情处理""持续跟进"这类不可执行表述
- [ ] 有待确认签核点时，摘要行与结论段都写明「不是放行」
- [ ] 上游 `must_escalate: true` 的 `pending` 项在 §3.4 全部有落点
- [ ] context-bound run 已回读当前 context，四项 identity 与 `review_context_echo` 精确一致；缺 review stance 时没有方向性风险/redline/谈判/行动建议，法域缺失、冲突或规则包不可用时没有法域实体结论

**独立性与落盘**

- [ ] 附录 C 独立性声明齐全，`自取证引文比例 = 100%`
- [ ] `自主新发现` 为 0 时已在报告中显式声明并解释原因
- [ ] 附录 D 分歧账已列出与上游不同的每一条（无分歧也保留表头写"无"）
- [ ] 回报块未夹带对话历史与推理过程
- [ ] 落盘路径用 `Ls` 实际确认过，是绝对路径，未写死任何用户主目录字面量
- [ ] 旧 `review_id` 目录保留未覆盖
