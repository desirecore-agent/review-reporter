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
  for (const key of ['risk_direction', 'comparison_status', 'human_gate_pending', 'upstream_pending', 'debts', 'incomplete_statement', 'total', 'tier']) {
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
})

test('report skill writes sections in place and appends export history', async () => {
  const report = await read('skills/report-composition/SKILL.md')
  assert.match(report, /<!-- 待写：节名 -->/)
  assert.match(report, /任务未提供内容/)
  assert.match(report, /`export-attempts\.json` 已存在时先 `Read`.*追加/s)
  assert.match(report, /四个产出文件（回读/)
})

test('every intermediate scorecard stays valid JSON when the skill is followed literally', () => {
  const keys = ['risk_direction', 'comparison_status', 'human_gate_pending', 'upstream_pending', 'debts', 'incomplete_statement', 'total', 'tier']
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
    ['"risk_direction": null', '"risk_direction": "undetermined"'],
    ['"comparison_status": null', '"comparison_status": "not_applicable"'],
    ['"human_gate_pending": null', '"human_gate_pending": ["GATE-DISPUTE"]'],
    ['"upstream_pending": null', '"upstream_pending": [{"id": "P-01", "gate": "GATE-PAYMENT"}]'],
    ...dims.map((d) => [`"${d}": {"status": "deferred"}`, `"${d}": {"status": "scored", "S": 100, "P": 0, "C": 100, "D": 100}`]),
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
})

test('carrying the trailing comma into new_string breaks the scorecard', () => {
  const skeleton = '{\n  "dimensions": {\n    "D1": {"status": "deferred"},\n    "D5": {"status": "deferred"}\n  },\n  "complete_five_dimension_score": null\n}'
  assert.equal(parses(edit(skeleton, '"D1": {"status": "deferred"}', '"D1": {"status": "scored", "D": 90},')), false)
  assert.equal(parses(edit(skeleton, '"D5": {"status": "deferred"}', '"D5": {"status": "scored", "D": 90},')), false)
})
