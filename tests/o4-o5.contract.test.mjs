import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

test('agent declares the independent verification entry without changing wait policy', async () => {
  const agent = JSON.parse(await read('agent.json'))
  assert.equal(agent.version, '1.0.7')
  assert.ok(agent.default_enabled.skills.includes('independent-verification'))
  assert.equal(agent.tools.ask_user_question.wait_mode, 'always_wait')
  assert.equal(agent.llm.routingMode, 'smart')
  assert.equal(agent.llm.smart.profile.reasoning, 'high')
})

test('O4 uses candidate three-state results plus an independent additional collection', async () => {
  const skill = await read('skills/independent-verification/SKILL.md')
  assert.match(skill, /原始文件.*检查清单.*候选/s)
  assert.match(skill, /正常存在|机械扫描 quote/)
  assert.match(skill, /REJECT-REASONING-CONTAMINATION/)
  assert.match(skill, /新建 sync isolated 调用|新 isolated 调用/)
  assert.match(skill, /candidate_results\[\]/)
  assert.match(skill, /status.*confirmed\/refuted\/unlocatable/)
  assert.match(skill, /独立 `additional\[\]`/)
  assert.match(skill, /`additional: \[\]`.*计数 0 合法/)
  assert.doesNotMatch(skill, /每个候选.{0,30}(四态|additional)/s)
  const valid = {candidate_results:[{id:'C-1',status:'confirmed'}], additional:[]}
  assert.ok(valid.candidate_results.every(({status}) => ['confirmed','refuted','unlocatable'].includes(status)))
  assert.equal(valid.additional.length, 0)
  assert.equal(['confirmed','refuted','unlocatable'].includes('additional'), false)
})

test('all reporter instruction layers keep additional separate from candidate states', async () => {
  const paths = ['persona.md', 'principles.md', 'skills/independent-verification/SKILL.md', 'skills/report-composition/SKILL.md', 'skills/review-scoring/SKILL.md']
  for (const path of paths) {
    const text = await read(path)
    assert.doesNotMatch(text, /对每个候选[^。\n]*(?:或\s*`?additional|四态)/, path)
  }
  const persona = await read('persona.md')
  assert.match(persona, /candidate_results\[\]/)
  assert.match(persona, /独立 `additional\[\]`.*允许为空/)
})

test('O5 consumes O4 and refuses a fake complete score when compliance is uncovered', async () => {
  const scoring = await read('skills/review-scoring/SKILL.md')
  assert.match(scoring, /输入必须包含合格 O4 回执/)
  assert.match(scoring, /不要重新执行完整候选取证与补漏/)
  assert.match(scoring, /不得输出完整五维总分/)
  assert.match(scoring, /不得重归一权重/)
  assert.match(scoring, /域外.*无适用法包/s)
})

test('versioned scoring resource computes deductions, caps, floor and tier without reweighting', async () => {
  const rules = JSON.parse(await read('resources/scoring-rules-cn-v1.0.3.json'))
  assert.equal(rules.rule_id, 'scoring-rules-cn')
  assert.equal(rules.version, '1.0.3')
  assert.deepEqual(rules.weights, {D1:0.2,D2:0.25,D3:0.2,D4:0.15,D5:0.2})
  assert.equal(Object.values(rules.weights).reduce((a,b) => a+b, 0), 1)
  for (const id of ['D1','D2','D3','D4','D5']) {
    assert.equal(rules.dimensions[id].base, 100)
    assert.ok(Object.keys(rules.dimensions[id].penalties).length > 0)
    assert.ok(Object.keys(rules.dimensions[id].caps).length > 0)
  }
  const d1 = Math.min(rules.dimensions.D1.caps['CAP-D1-NOT-COVERED'], 100 - rules.dimensions.D1.substantive_deductions['data-export'] - rules.dimensions.D1.penalties['DED-D1-UNLOCATABLE'])
  const d2 = Math.min(rules.dimensions.D2.caps['CAP-D2-CRITICAL-MISS'], 100 - rules.dimensions.D2.severity_deductions.critical - rules.dimensions.D2.penalties['DED-D2-MISS-CRITICAL'])
  const scores = {D1:d1,D2:d2,D3:100,D4:100,D5:100}
  const total = Math.floor(Object.entries(rules.weights).reduce((sum,[id,w]) => sum + w*scores[id], 0))
  assert.deepEqual(scores, {D1:73,D2:47,D3:100,D4:100,D5:100})
  assert.equal(total, 81)
  assert.equal(rules.tiers.find(({min,max}) => total >= min && total <= max).code, 'TIER-2-NEGOTIATE')
  assert.equal(rules.missing_dimension_policy, 'keep_denominator_and_mark_incomplete_do_not_total_or_tier')
})

test('O4 and O5 require file allowlists and disclose the platform isolation debt', async () => {
  const corpus = [await read('skills/independent-verification/SKILL.md'), await read('skills/report-composition/SKILL.md')].join('\n')
  assert.match(corpus, /read_allowlist/)
  assert.match(corpus, /write_allowlist/)
  assert.match(corpus, /禁止 `Ls`、`Glob`|禁止.*目录枚举/s)
  assert.match(corpus, /memoryScope:none.*不提供文件级强制隔离|不强制文件隔离/s)
  assert.match(corpus, /per-call 文件能力沙箱/)
})

test('pending gates do not block artifact delivery and redline audit is append-only', async () => {
  const report = await read('skills/report-composition/SKILL.md')
  assert.match(report, /业务 pending 不等于文件交付 pending/)
  assert.match(report, /默认不逐个调用 `AskUserQuestion`/)
  assert.match(report, /tool-not-found/)
  assert.match(report, /不得假定 agent 声明等于运行可用/)
  assert.match(report, /恰好出现一次/)
  assert.match(report, /不删除以前失败 attempt|均不删除以前失败 attempt/)
})

test('risk direction uses four values and R7/R9 stay distinct', async () => {
  const corpus = [await read('persona.md'), await read('principles.md'), await read('skills/review-scoring/SKILL.md')].join('\n')
  assert.match(corpus, /`up`、`down`、`flat`、`undetermined`|`up\/down\/flat\/undetermined`/)
  assert.match(corpus, /单版本.*not_applicable/)
  assert.match(corpus, /R7.*R9|R7\/R9/)
  assert.doesNotMatch(corpus, /risk_direction:\s*(rising|falling|n\/a)/)
})

test('DOCX evidence uses only the exact allowed output path, never directory enumeration or binary text readback', async () => {
  const report = await read('skills/report-composition/SKILL.md')
  assert.doesNotMatch(report, /随后列目录/)
  assert.match(report, /write_allowlist.*DOCX/s)
  assert.match(report, /FileDigest.*实际返回.*路径/s)
  assert.match(report, /不把二进制全文 Read/)
})

test('nonexistent redline capability is not statically advertised', async () => {
  const agent = JSON.parse(await read('agent.json'))
  assert.equal(agent.tool_permissions.allowed.includes('ExportRedlineDocument'), false)
})
