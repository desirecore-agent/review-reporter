---
name: review-scoring
description: 在独立的 O5 调用中消费合格 O4 回执，按有来源的固定公式评分并形成范围诚实的行动建议。
version: 1.1.0
type: procedural
risk_level: low
status: enabled
requires:
  tools: [Read, Write, MathCalc, AskUserQuestion]
metadata:
  author: DesireCore
  version: 1.1.0
  updated_at: '2026-09-29'
---

# O5 评分

## 准入

输入必须包含合格 O4 回执路径、对象/范围、适用规则或标尺的 id+版本+路径、Lead canonical 根。O4 必须为每个候选给出三态结果与检索范围，并另有独立 `additional[]`；否则拒收。本轮必须是不同于 O4 的 isolated intent，且 `childContext.memoryScope: none`；不要读取 O3/O4 会话历史或 O3 推理，也不要重新执行完整候选取证与补漏。

## 固定公式

唯一评分知识源为随本技能发布的 `resources/scoring-rules-cn-v1.0.3.json`，固定标识 `scoring-rules-cn@1.0.3`。O5 必须从任务 `read_allowlist` 给出的**实际绝对路径**读取它，核对文件内 id/version、Lead 提供的真实 `FileDigest` 摘要及完整结构后才可算分；路径、摘要或任何维度规则缺失即保留失败回执并停止。不得使用模型记忆、摘要版规则或调用方临时标尺替代。

该资源完整锁定五维各自的 100 基础分、合同侧扣分、证据惩罚、全部封顶、市场标尺、权重、五档阈值及四类 Human Gate。每项命中都在 scorecard 记录 rule code、次数、数值、证据；多个封顶取最小，分数 clamp 到 0..100，总分向下取整。`not_applicable` 只在资源允许且有依据时成立，不扣分但始终保留原权重与分母。

五维权重保持：条款事实 20%、风险 25%、合规 20%、义务与时序 15%、建议可执行性 20%。每维记录：`S`（按给定规则来源的实质分）、`P`（O4 refuted/unlocatable 和证据缺口惩罚）、`C`（规则来源规定的封顶）、`D=min(C, clamp(0,100,S-P))`。完整总分为：

`floor(0.20*D1 + 0.25*D2 + 0.20*D3 + 0.15*D4 + 0.20*D5)`。

每个扣分/封顶都引用本次提供的 rule id、版本、绝对路径与摘要，并用 `MathCalc` 复算。不得凭记忆新增法律或标尺内容。只支持中国大陆评分；域外合同无适用法包时只做通用文档治理与转介。若任一维未覆盖，特别是域外或无适用 CN 法包导致合规维未覆盖，不得输出完整五维总分、档位或“可放行”；只输出已覆盖维度、固定公式、缺失维度及补齐条件，也不得重归一权重。

## 方向与范围

`risk_direction` 只能是 `up/down/flat/undetermined`。单版本写 `comparison_status: not_applicable`，不填第五种方向。比较范围不全或 digest 不可用时全局 `undetermined`；可以另述已证局部 up/down，但不能把全局写 flat。R7（附件正文未交）与 R9（权威清单不完整）分列。

## Human Gate

四类业务决定（付款回款、争议机制、责任分配、生效要件）命中后记 `pending`。pending 不阻止 scorecard/report 的文件交付，也不自动触发逐项提问。只有请求方明确需要立即决定，或缺失事实阻止识别对象时才用 `AskUserQuestion`；沉默、超时和模拟回答均不改变批准状态。

先写并回读 scorecard，再交给 `report-composition`。scorecard 必须声明是否 `complete_five_dimension_score`，列出范围、O4 receipt、规则来源、逐维算式、方向、Human Gate 与欠账。
