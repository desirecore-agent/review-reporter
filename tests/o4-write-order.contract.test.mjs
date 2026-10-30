import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFile(path.join(root, p), 'utf8')

test('O4 回执超限时分段落盘：骨架每个候选一行，逐行 Edit，不整份重写', async () => {
  const skill = await read('skills/independent-verification/SKILL.md')
  assert.match(skill, /tools: \[[^\]]*\bEdit\b/)
  const agent = JSON.parse(await read('agent.json'))
  assert.ok(agent.tool_permissions.allowed.includes('Edit'))
  const part = skill.slice(skill.indexOf('## 分段落盘'))
  assert.match(part, /回执预计超过约 3000 字时/)
  assert.match(part, /`candidate_results` 每个输入候选各占一行 `\{"id": "<候选 id>", "status": "pending"\}`/)
  assert.match(part, /一次回复核对一个候选/)
  // 2026-10-30 E 轮：读完原件后一次想完 20 个候选，三次在约 600 秒处被网关切断
  assert.match(part, /同一次回复里先写上一个候选的结果，再发起下一个候选的检索/)
  assert.match(part, /读完原件后不在思考里先把全部候选核对一遍/)
  assert.match(part, /单次回复（思考加输出）超过约 10 分钟也会被网关切断/)
  assert.match(part, /骨架写成后不再用 `Write` 重写整份回执/)
  assert.match(part, /仍有 `"status": "pending"` 的行就回到该候选/)
  assert.match(skill, /全部写完后按同一路径完整回读/)
})

const replaceFirst = (doc, oldStr, newStr) => {
  const i = doc.indexOf(oldStr)
  assert.ok(i >= 0, `old_string 未命中：${oldStr}`)
  assert.equal(doc.indexOf(oldStr, i + 1), -1, `old_string 不唯一：${oldStr}`)
  return doc.slice(0, i) + newStr + doc.slice(i + oldStr.length)
}

// 占位串从技能文本抽取，技能改了写法测试跟着变
const placeholderOf = async () => {
  const part = (await read('skills/independent-verification/SKILL.md')).split('## 分段落盘')[1]
  const m = part.match(/各占一行 `(\{"id": "<候选 id>", "status": "pending"\})`/)
  assert.ok(m, '技能里找不到候选占位行')
  return (id) => m[1].replace('<候选 id>', id)
}

test('骨架 JSON 与逐候选 Edit 的每个中间态都是合法 JSON，additional 可按行分批追加', async () => {
  const placeholder = await placeholderOf()
  const part = (await read('skills/independent-verification/SKILL.md')).split('## 分段落盘')[1]
  assert.match(part, /R7\/R9 状态 Lead 已转达的照抄，未转达的先写 `null`，取证后再补；清单逐项覆盖写 `null`/)
  assert.match(part, /后一批以已写最后一项的整行为 `old_string`，换成该行加逗号再加新条目/)
  const ids = ['CAND-1', 'CAND-2', 'CAND-10']
  let doc = [
    '{',
    '  "type": "independent-verification-receipt",',
    '  "object": {"case_id": "C00", "version": "v1"},',
    '  "r7": null,',
    '  "r9": null,',
    '  "checklist_coverage": null,',
    '  "candidate_results": [',
    ...ids.map((id, i) => `    ${placeholder(id)}${i < ids.length - 1 ? ',' : ''}`),
    '  ],',
    '  "additional": [],',
    '  "counts": null',
    '}',
    '',
  ].join('\n')
  const states = [doc]
  const step = (o, n) => { doc = replaceFirst(doc, o, n); states.push(doc) }
  step(placeholder('CAND-1'), '{"id": "CAND-1", "status": "confirmed", "quote": "第 3.2 条：……", "locator": {"page": 2}}')
  step(placeholder('CAND-10'), '{"id": "CAND-10", "status": "refuted", "quote": "第 9 条：……"}')
  step(placeholder('CAND-2'), '{"id": "CAND-2", "status": "unlocatable", "searched": {"files": ["/abs/a.md"], "keywords": ["示例"]}, "reason": "未定位"}')
  step('  "r7": null,', '  "r7": {"status": "hit"},')
  step('  "r9": null,', '  "r9": {"status": "not_hit"},')
  step('  "checklist_coverage": null,', '  "checklist_coverage": [{"check_id": "CHK-01", "status": "covered"}],')
  const add1 = '    {"id": "ADD-01", "check_id": "CHK-03", "quote": "……"}'
  step('  "additional": [],', `  "additional": [\n${add1}\n  ],`)
  step(add1, `${add1},\n    {"id": "ADD-02", "check_id": "CHK-04", "quote": "……"}`)
  step('  "counts": null', '  "counts": {"confirmed": 1, "refuted": 1, "unlocatable": 1, "additional": 2}')
  for (const [i, s] of states.entries()) assert.doesNotThrow(() => JSON.parse(s), `第 ${i} 个中间态不是合法 JSON`)
  const final = JSON.parse(doc)
  assert.ok(!doc.includes('"pending"'))
  assert.deepEqual(final.candidate_results.map((r) => r.status), ['confirmed', 'unlocatable', 'refuted'])
  assert.equal(final.counts.additional, final.additional.length)
})

test('O5 的 actions 与 export-attempts 逐行追加，单维对象控制篇幅', async () => {
  const scoring = await read('skills/review-scoring/SKILL.md')
  assert.match(scoring, /`actions` 写成行动建议数组（每条一行，.*超过约 3000 字就分批，后一批以已写最后一条的整行为 `old_string`/)
  const o4 = (await read('skills/independent-verification/SKILL.md')).split('## 分段落盘')[1]
  assert.match(o4, /R7\/R9 状态、清单逐项覆盖与 `counts` 仍为 `null` 就回到第 3 步，都不交给 O5/)
  assert.match(scoring, /证据只写 finding_id 与位置（条款号、页码、行号），不抄长引文，单维对象控制在约 3000 字以内/)
  const report = await read('skills/report-composition/SKILL.md')
  assert.match(report, /`export-attempts.json` 每个 attempt 写成一行/)
  assert.doesNotMatch(report, /整份 `Write` 一次/)
})
