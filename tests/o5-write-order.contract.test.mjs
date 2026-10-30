import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

// 平台 Edit 的精确匹配语义：只替换第一处，不检查唯一性
const edit = (text, oldString, newString) => {
  const at = text.indexOf(oldString)
  assert.ok(at >= 0, `old_string 未命中：${oldString}`)
  return text.slice(0, at) + newString + text.slice(at + oldString.length)
}
const parses = (text) => { try { JSON.parse(text); return true } catch { return false } }

test('scoring skill fixes the scorecard write order and the Edit shape', async () => {
  const skill = await read('skills/review-scoring/SKILL.md')
  assert.match(skill, /tools: \[[^\]]*\bEdit\b/)
  for (const key of ['risk_direction', 'comparison_status', 'human_gate_pending', 'upstream_pending', 'coverage', 'actions', 'debts', 'incomplete_statement', 'total', 'tier']) {
    assert.match(skill, new RegExp('`"' + key + '": null,`'))
  }
  assert.match(skill, /`"complete_five_dimension_score": null`（不带逗号）/)
  assert.match(skill, /`"D1": \{"status": "deferred"\},`/)
  assert.match(skill, /不含行首缩进、不含行尾逗号/)
  assert.match(skill, /排在五维之前/)
  assert.match(skill, /不新增键、不整份 `Write`/)
  assert.match(skill, /不扣分、不类推/)
  assert.match(skill, /与自判 Gate 分列、不合并、不计分/)
  assert.doesNotMatch(skill, /按字面最接近的一条处理/)
  assert.match(skill, /算 D5 之前，先用一次 `Edit` 把 `actions` 写成/)
  // 单版本省略方向（团队规则 INV-010）：骨架里的 null 保持不动，不写 flat/undetermined/not_applicable
  assert.match(skill, /`risk_direction` 保持骨架里的 `null` 不动/)
  assert.match(skill, /INV-010/)
  assert.match(skill, /`risk_direction`（单版本保持 `null`，不 Edit）/)
  // 续跑：单版本方向与不全时的总分档位的 null 都是终值，不能被当成未完成
  assert.match(skill, /`comparison_status` 为 `not_applicable` 时 `risk_direction` 的 `null` 是终值/)
  assert.match(skill, /有维度为 `not_covered` 时 `total`、`tier` 保持 `null`/)
  assert.match(skill, /按 id 用 `Grep` 或按行 `Read` 取 scorecard 与 O4 回执的片段/)
  assert.match(skill, /`comparison_status` 即团队规则的 `comparison_applicability`/)
  const composition = await read('skills/report-composition/SKILL.md')
  assert.match(composition, /单版本写「比较不适用，不给方向」/)
  assert.match(skill, /GATE-PAYMENT` 补进 `human_gate_pending`/)
})

test('report skill writes sections in place and appends export history', async () => {
  const report = await read('skills/report-composition/SKILL.md')
  assert.match(report, /<!-- 待写：节名 -->/)
  assert.match(report, /任务未提供内容/)
  assert.match(report, /`export-attempts\.json` 已存在时先 `Read`.*追加/s)
  assert.match(report, /四个产出文件（回读/)
})

test('every intermediate scorecard stays valid JSON when the skill is followed literally', () => {
  const keys = ['risk_direction', 'comparison_status', 'human_gate_pending', 'upstream_pending', 'coverage', 'actions', 'debts', 'incomplete_statement', 'total', 'tier']
  const dims = ['D1', 'D2', 'D3', 'D4', 'D5']
  let card = [
    '{',
    '  "scorecard_id": "SC-1",',
    '  "rule_source": {"rule_id": "scoring-rules-cn", "version": "1.0.3"},',
    '  "dimensions": {',
    ...dims.map((d, i) => `    "${d}": {"status": "deferred"}${i < dims.length - 1 ? ',' : ''}`),
    '  },',
    ...keys.map((k) => `  "${k}": null,`),
    '  "complete_five_dimension_score": null',
    '}',
  ].join('\n')
  assert.ok(parses(card), '骨架必须是合法 JSON')
  const steps = [
    ['"comparison_status": null', '"comparison_status": "not_applicable"'],
    ['"human_gate_pending": null', '"human_gate_pending": ["GATE-DISPUTE"]'],
    ['"upstream_pending": null', '"upstream_pending": [{"id": "P-01", "gate": "GATE-PAYMENT"}]'],
    ['"coverage": null', '"coverage": {"input-integrity": "covered", "report-and-delivery": "unknown"}'],
    ...dims.slice(0, 4).map((d) => [`"${d}": {"status": "deferred"}`, `"${d}": {"status": "scored", "S": 100, "P": 0, "C": 100, "D": 100}`]),
    ['"actions": null', '"actions": [{"finding_id": "V-01", "action": "补充定义", "priority": "P1", "target": "11.3", "owner": "法务"}]'],
    ...dims.slice(4).map((d) => [`"${d}": {"status": "deferred"}`, `"${d}": {"status": "scored", "S": 100, "P": 0, "C": 100, "D": 100}`]),
    ['"human_gate_pending": ["GATE-DISPUTE"]', '"human_gate_pending": ["GATE-DISPUTE", "GATE-PAYMENT"]'],
    ['"total": null', '"total": 100'],
    ['"tier": null', '"tier": "TIER-1-LEGAL-REVIEW"'],
    ['"incomplete_statement": null', '"incomplete_statement": "none"'],
    ['"debts": null', '"debts": []'],
    ['"complete_five_dimension_score": null', '"complete_five_dimension_score": true'],
  ]
  for (const [oldString, newString] of steps) {
    card = edit(card, oldString, newString)
    assert.ok(parses(card), `替换后必须仍是合法 JSON：${newString}`)
  }
  assert.equal(JSON.parse(card).dimensions.D5.D, 100)
  // 单版本：comparison_status 为 not_applicable 时方向保持 null
  assert.equal(JSON.parse(card).comparison_status, 'not_applicable')
  assert.equal(JSON.parse(card).risk_direction, null)
})

test('carrying the trailing comma into new_string breaks the scorecard', () => {
  const skeleton = '{\n  "dimensions": {\n    "D1": {"status": "deferred"},\n    "D5": {"status": "deferred"}\n  },\n  "complete_five_dimension_score": null\n}'
  assert.equal(parses(edit(skeleton, '"D1": {"status": "deferred"}', '"D1": {"status": "scored", "D": 90},')), false)
  assert.equal(parses(edit(skeleton, '"D5": {"status": "deferred"}', '"D5": {"status": "scored", "D": 90},')), false)
})

test('scoring skill forbids look-ahead and scopes direction caps to applicable comparisons', async () => {
  const skill = await read('skills/review-scoring/SKILL.md')
  assert.match(skill, /每次回复只想当前这一步：写方向、Gate、覆盖时不推演任何维度的扣分与封顶；算某一维时不推演其他维度/)
  assert.match(skill, /单版本不触发 `CAP-D2-DIRECTION-UNDETERMINED` 与 `CAP-D2-WRONG-DIRECTION`/)
  assert.match(skill, /骨架写入后不再整份 `Write`：第 5 步之前发现骨架应有而漏写的字段，用一次 `Edit` 在某个已有的 `"key": null,` 行前插入（新行带尾逗号）/)
  const rules = JSON.parse(await read('resources/scoring-rules-cn-v1.0.3.json'))
  for (const cap of ['CAP-D2-DIRECTION-UNDETERMINED', 'CAP-D2-WRONG-DIRECTION']) assert.ok(cap in rules.dimensions.D2.caps, `${cap} 必须是评分规则里真实存在的封顶`)
})

test('D3 在中国大陆范围必须计分，D1 缺失扣分只用于 absent', async () => {
  const skill = await read('skills/review-scoring/SKILL.md')
  assert.match(skill, /中国大陆范围（含法域待定）且 CN 规则来源完整时 D3 必须计分，不得因 O4 回执里没有规则级事实就记 `not_covered`/)
  assert.match(skill, /没有对应 O4 事实的规则不扣分，记入 D3 的 `rule_gaps`/)
  // C01 标准答案把违约救济、宽限期、便利终止等列为「条款存在」禁报项：存在的条款不得按缺失扣分
  assert.match(skill, /D1 的 `substantive_deductions` 只在该项判为 `absent`（检索后确无该类条款）时扣/)
  assert.match(skill, /`present_incomplete`）不按缺失扣 D1，要素缺口作为风险发现按严重度计入 D2，同一事实不在两维重复扣分/)
  const rules = JSON.parse(await read('resources/scoring-rules-cn-v1.0.3.json'))
  for (const id of ['breach-remedy', 'grace-period', 'termination-convenience', 'force-majeure']) assert.ok(id in rules.dimensions.D1.substantive_deductions)
})
