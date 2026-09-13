import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { parseDocument } from 'yaml'

const root = new URL('../', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

function yamlDocument(source, name) {
  const match = source.match(new RegExp('```yaml\\n(' + name + ':\\n[\\s\\S]*?)```'))
  assert.ok(match, `missing ${name} YAML template`)
  const document = parseDocument(match[1])
  assert.deepEqual(document.errors, [], `${name} template must parse`)
  return document.toJS()
}

test('Reporter source templates expose the exact Lead handoff and closed echo', async () => {
  const [skill, report, fixtureText] = await Promise.all([
    read('skills/review-scoring/SKILL.md'),
    read('skills/report-composition/SKILL.md'),
    read('tests/fixtures/review-context/consumer-contract.json'),
  ])
  const fixture = JSON.parse(fixtureText)
  const context = yamlDocument(skill, 'review_context_handoff')
  const result = yamlDocument(report, 'review_result')
  assert.deepEqual(Object.keys(context.review_context_handoff), fixture.handoff_keys)
  assert.deepEqual(Object.keys(context.review_context_echo), fixture.echo_keys)
  assert.deepEqual(Object.keys(context.review_context_handoff.review_context_output_constraints), fixture.constraint_keys)
  assert.deepEqual(Object.keys(context.review_context_echo.actual_output_constraints), fixture.constraint_keys)
  assert.deepEqual(Object.keys(result.review_result.review_context_echo), fixture.echo_keys)
  assert.deepEqual(Object.keys(result.review_result.review_context_echo.actual_output_constraints), fixture.constraint_keys)
})

test('Reporter source contract preserves fail-closed context, pending and Human Gate boundaries', async () => {
  const [principles, scoring, report, fixtureText] = await Promise.all([
    read('principles.md'),
    read('skills/review-scoring/SKILL.md'),
    read('skills/report-composition/SKILL.md'),
    read('tests/fixtures/review-context/consumer-contract.json'),
  ])
  const fixture = JSON.parse(fixtureText)
  const corpus = `${principles}\n${scoring}\n${report}`
  for (const code of fixture.required_rejections) assert.match(corpus, new RegExp(code))
  for (const code of fixture.required_pending) assert.match(corpus, new RegExp(code))
  for (const code of fixture.suppressed_constraints) assert.match(corpus, new RegExp(code))
  assert.match(scoring, /\| `review_stance.status: missing` \| 原文事实、四态台账、保留 `PEND-REVIEW-STANCE-REQUIRED`（`required_from: user`）与澄清请求 \| 方向性风险、redline、谈判及行动建议 \|/)
  assert.match(scoring, /不得默认选法域\/规则包或输出法域实体结论/)
  assert.match(scoring, /candidate_basis.*不是最终法律认定/)
  assert.match(corpus, /不能清除既有 `human_gates`、`pending_settlement`[\s\S]*`blocked_by_human_gate`/)
  assert.match(corpus, /不授予[\s\S]*文件[\s\S]*工具[\s\S]*Delegate[\s\S]*签署[\s\S]*代表权[\s\S]*法律适用[\s\S]*Human Gate/)
  for (const consumer of [scoring, report]) {
    assert.match(consumer, /REJECT-UNPRECHECKED-REVIEW-CONTEXT/)
    assert.match(consumer, /PEND-JURISDICTION-PACK-PREFLIGHT/)
    assert.match(consumer, /candidate_bases\[\]\.pack\.status/)
    assert.match(consumer, /不得自行(?: `Read`|读取\/预检\/pin).*规则包/)
  }
})
test('Reporter keeps Team outputs in its member-owned cwd subtree and returns only to the sync caller', async () => {
  const [agentText, persona, principles, scoring, report] = await Promise.all([
    read('agent.json'),
    read('persona.md'),
    read('principles.md'),
    read('skills/review-scoring/SKILL.md'),
    read('skills/report-composition/SKILL.md'),
  ])
  const agent = JSON.parse(agentText)
  assert.equal(agent.command_authority.enabled, false)
  assert.deepEqual(agent.command_authority.allowed_targets, [])
  assert.equal(agent.tool_permissions.allowed.includes('Delegate'), false)
  assert.equal(agent.tool_permissions.allowed.includes('SendMessage'), false)
  const corpus = `${persona}\n${principles}\n${scoring}\n${report}`
  assert.match(corpus, /members\/review-reporter\/<case_id>\/<review_id>\/artifact/)
  assert.match(corpus, /review_context_case_id.*case_binding\.case_id/s)
  assert.match(corpus, /不得从 task、intentId、路径、旧回执或成员文本推导/)
  assert.match(corpus, /review_id.*本次真实 `GenerateUUID`/)
  assert.match(corpus, /Lead canonical 根(?:仅可读取|只能读取)/)
  assert.match(corpus, /只通过本次同步调用的 \*\*return\*\* 回报/)
  assert.match(corpus, /不得主动 `Delegate` 或 `SendMessage`/)
})