import path from 'node:path'

const candidateStates = new Set(['confirmed', 'refuted', 'unlocatable'])
const fail = (reason) => ({ valid: false, reason })
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0

function isAbsolutePathSyntax(value) {
  return typeof value === 'string' && value.length > 0
    && (path.posix.isAbsolute(value) || path.win32.isAbsolute(value))
}

function observedFileList(values, observedFiles) {
  if (!Array.isArray(values) || values.length === 0 || !Array.isArray(observedFiles)) return false
  const observed = new Set(observedFiles.filter(isAbsolutePathSyntax))
  return values.every((value) => isAbsolutePathSyntax(value) && observed.has(value))
}

export function validateO4EvidenceRecord(receipt, candidateIds) {
  if (receipt?.valid !== true || !Array.isArray(receipt.candidate_results) || !Array.isArray(receipt.additional)) return fail('shape_invalid')
  if (!Array.isArray(candidateIds) || candidateIds.some((id) => !nonEmpty(id)) || new Set(candidateIds).size !== candidateIds.length) return fail('candidate_input_invalid')
  if (receipt.candidate_results.some((item) => item === null || typeof item !== 'object' || !nonEmpty(item.id))) return fail('candidate_shape_invalid')
  if (receipt.additional.some((item) => item === null || typeof item !== 'object' || !nonEmpty(item.id))) return fail('additional_shape_invalid')
  const ids = receipt.candidate_results.map(({ id }) => id)
  if (new Set(ids).size !== ids.length || ids.length !== candidateIds.length || candidateIds.some((id) => !ids.includes(id))) return fail('candidate_bijection_failed')
  if (receipt.candidate_results.some((item) => !candidateStates.has(item.status))) return fail('candidate_status_invalid')
  if (receipt.candidate_results.some((item) => ['confirmed', 'refuted'].includes(item.status) && (!nonEmpty(item.evidence?.quote) || !nonEmpty(item.evidence?.source)))) return fail('substantive_evidence_missing')
  if (receipt.candidate_results.some((item) => item.status === 'unlocatable' && (!Array.isArray(item.searched) || item.searched.length === 0 || item.searched.some((value) => !nonEmpty(value)) || !nonEmpty(item.reason)))) return fail('unlocatable_search_missing')
  const additionalIds = receipt.additional.map(({ id }) => id)
  if (new Set(additionalIds).size !== additionalIds.length || receipt.additional.some((item) => ids.includes(item.id) || !nonEmpty(item.check_id) || !nonEmpty(item.evidence?.quote) || !nonEmpty(item.evidence?.source))) return fail('additional_not_independent')
  const actual = { confirmed: 0, refuted: 0, unlocatable: 0, additional: receipt.additional.length }
  for (const item of receipt.candidate_results) actual[item.status] += 1
  if (receipt.counts === null || typeof receipt.counts !== 'object' || Object.keys(actual).some((key) => receipt.counts[key] !== actual[key])) return fail('counts_mismatch')
  return { valid: true }
}

export function validateReporterInvocationEvidence(o4, o5, observedFiles) {
  for (const [expected, call] of [['O4', o4], ['O5', o5]]) {
    if (call?.target !== 'review-reporter' || call.stage !== expected || call.mode !== 'sync' || call.contextMode !== 'isolated' || call.childContext?.memoryScope !== 'none') return fail(`${expected.toLowerCase()}_isolation_invalid`)
    if (!nonEmpty(call.invocationId) || !nonEmpty(call.intentId)) return fail(`${expected.toLowerCase()}_identity_invalid`)
    if (!observedFileList(call.read_allowlist, observedFiles) || !observedFileList(call.write_allowlist, observedFiles)) return fail(`${expected.toLowerCase()}_allowlist_unverified`)
  }
  if (o4.invocationId === o5.invocationId || o4.intentId === o5.intentId) return fail('invocations_not_distinct')
  if (!o5.read_allowlist.some((value) => o4.write_allowlist.includes(value))) return fail('o5_missing_o4_receipt')
  return { valid: true }
}

export function validateO5EvidenceRecord(receipt, observedFiles) {
  if (receipt?.report_status !== 'delivered' || !isAbsolutePathSyntax(receipt.report_path)) return fail('report_record_invalid')
  if (!Array.isArray(observedFiles) || !observedFiles.includes(receipt.report_path)) return fail('report_path_unobserved')
  if (!Array.isArray(receipt.pending) || typeof receipt.complete_five_dimension_score !== 'boolean') return fail('delivery_shape_invalid')
  return { valid: true }
}
