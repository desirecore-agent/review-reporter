import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('..', import.meta.url)
const read = (path) => readFile(new URL(path, root), 'utf8')

// 标准答案：合同条款自己列明附件清单时它就是权威清单，附件正文未送达只是 R7 范围事实，不得报 R9
test('R9 只在另附权威清单本身未取得时成立，条款自列清单即 not_hit', async () => {
  const [principles, verification, scoring, composition] = await Promise.all([
    read('principles.md'),
    read('skills/independent-verification/SKILL.md'),
    read('skills/review-scoring/SKILL.md'),
    read('skills/report-composition/SKILL.md'),
  ])
  assert.match(principles, /合同条款自己列明附件清单时 R9 未命中，不写 unknown、不列待决/)
  assert.match(verification, /正文条款自己列明附件清单（编号、名称、版本）即 `not_hit`/)
  assert.match(verification, /不得因 read_allowlist 里没有单独的清单文件就写 `unknown`/)
  assert.match(verification, /R9 未命中时不生成待决项，附件正文未送达只记 R7/)
  assert.match(scoring, /`not_hit` 时写未命中，不列欠账、不进 pending/)
  assert.match(composition, /R9 未命中时写明未命中，不列欠账/)
})
