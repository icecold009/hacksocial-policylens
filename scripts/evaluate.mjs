import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { samplePolicies } from '../src/data/policies.js'
import { retrieveEvidence } from '../src/lib/retrieval.js'
import { validateAnswerResponse } from '../src/lib/answer-contract.js'
import { answerQuestion } from '../server/answer-service.mjs'

const cases = JSON.parse(await readFile(new URL('../data/evaluation/questions.json', import.meta.url), 'utf8'))
const policies = new Map(samplePolicies.map((policy) => [policy.id, policy]))
const results = cases.map((item) => {
  const policy = policies.get(item.policyId)
  const actual = retrieveEvidence(policy, item.question)
  const statusMatches = actual.status === item.expectedStatus
  const sectionMatches = !item.expectedSection || actual.evidence?.id === item.expectedSection

  return {
    ...item,
    actualStatus: actual.status,
    actualSection: actual.evidence?.id ?? null,
    actualCandidates: actual.candidates?.map((candidate) => candidate.id) ?? [],
    passed: statusMatches && sectionMatches,
  }
})

const categories = [...new Set(cases.map((item) => item.category))]
const passed = results.filter((result) => result.passed).length
const expectedSectionCases = results.filter((result) => result.expectedSection)
const hitAt3 = expectedSectionCases.filter((result) => result.actualCandidates.includes(result.expectedSection)).length
const unsupportedCases = results.filter((result) => result.category === 'unsupported')
const unsupportedAbstentions = unsupportedCases.filter((result) => result.actualStatus === 'not_found').length
const reviewCases = results.filter((result) => result.category === 'multi-condition')
const reviewMatches = reviewCases.filter((result) => result.actualStatus === 'needs_review').length
const lines = [
  `PolicyLens retrieval evaluation: ${passed}/${results.length} cases passed`,
  `- retrieval hit@3: ${hitAt3}/${expectedSectionCases.length}`,
  `- unsupported-question abstention: ${unsupportedAbstentions}/${unsupportedCases.length}`,
  `- multi-condition review routing: ${reviewMatches}/${reviewCases.length}`,
  ...categories.map((category) => {
    const categoryResults = results.filter((result) => result.category === category)
    const categoryPassed = categoryResults.filter((result) => result.passed).length
    return `- ${category}: ${categoryPassed}/${categoryResults.length}`
  }),
]

const failures = results.filter((result) => !result.passed)
if (failures.length > 0) {
  lines.push('Failures:')
  failures.forEach((failure) => {
    lines.push(`- ${failure.id}: expected ${failure.expectedStatus}/${failure.expectedSection ?? '-'}, got ${failure.actualStatus}/${failure.actualSection ?? '-'}`)
  })
}

const answerResults = []
const answerLatencies = []
for (const item of cases) {
  const startedAt = performance.now()
  const answerResult = await answerQuestion(
    { policyId: item.policyId, question: item.question },
    { environment: {} },
  )
  answerResults.push({ item, result: answerResult })
  answerLatencies.push(performance.now() - startedAt)
}

const expectedFound = answerResults.filter(({ item }) => item.expectedStatus === 'found')
const citationSupported = expectedFound.filter(({ item, result }) => {
  const policy = policies.get(item.policyId)
  const expectedSection = policy.sections.find((section) => section.id === item.expectedSection)
  return result.statusCode === 200
    && result.body.status === 'found'
    && result.body.evidence.some((evidenceItem) => (
      evidenceItem.documentId === policy.id
      && evidenceItem.section === expectedSection.heading
      && evidenceItem.quote === expectedSection.text
    ))
}).length

lines.push(`- found-answer citation support: ${citationSupported}/${expectedFound.length}`)
lines.push(`- max local answer latency: ${Math.ceil(Math.max(...answerLatencies))}ms`)

const malformedResponses = [
  {
    status: 'found',
    answer: '',
    evidence: [{ documentId: 'attendance', section: 'Reporting an absence', quote: 'Notify the school.', sourceUrl: null }],
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  },
  {
    status: 'found',
    answer: 'An answer without evidence.',
    evidence: [],
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  },
  {
    status: 'not_found',
    answer: '',
    evidence: [{ documentId: '', section: 'Unknown', quote: '', sourceUrl: null }],
    evidenceStrength: 'weak',
    nextStep: 'Try again.',
    disclaimer: 'Test disclaimer',
  },
]
const rejectedMalformed = malformedResponses.filter((response) => !validateAnswerResponse(response).valid).length
lines.push(`- malformed-response rejection: ${rejectedMalformed}/${malformedResponses.length}`)

console.log(lines.join('\n'))
if (failures.length > 0) process.exitCode = 1
