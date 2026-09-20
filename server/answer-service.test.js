import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../src/data/policies.js'
import { validateAnswerResponse } from '../src/lib/answer-contract.js'
import { API_ERROR_CODES, answerQuestion } from './answer-service.mjs'

function typeSafeResponse(candidateId, candidates, confidence = 0.84) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => JSON.stringify({
      answers: {
        candidateId: {
          choice: candidateId,
          confidence,
          probabilities: Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate.id === candidateId ? confidence : 1 - confidence])),
        },
      },
    }),
  }
}

function typeSafeEnvironment(mode = 'shadow') {
  return {
    NODE_ENV: 'development',
    POLICYLENS_TYPESAFE_MODE: mode,
    POLICYLENS_TYPESAFE_ENDPOINT: 'http://127.0.0.1:8788/v1/systemone',
    POLICYLENS_TYPESAFE_API_KEY: 'typesafe-test-key',
    POLICYLENS_TYPESAFE_MODEL: 'jev-test',
  }
}

test('returns a validated found response for a known policy', async () => {
  const result = await answerQuestion({ policyId: 'attendance', question: 'How do I report an absence?' }, { environment: {} })

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.status, 'found')
  assert.equal(validateAnswerResponse(result.body).valid, true)
  assert.equal(result.body.evidence[0].documentId, 'attendance')
})

test('returns an honest not-found response for unsupported questions', async () => {
  let calls = 0
  const result = await answerQuestion(
    { policyId: 'attendance', question: 'What is the lunch menu?' },
    {
      environment: typeSafeEnvironment('shadow'),
      typesafeFetchImpl: async () => { calls += 1; return typeSafeResponse('attendance-window', []) },
    },
  )

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.status, 'not_found')
  assert.equal(result.body.evidence.length, 0)
  assert.equal(calls, 0)
})

test('does not call TypeSafe for needs-review retrieval', async () => {
  let calls = 0
  const result = await answerQuestion(
    { policyId: 'devices', question: 'Can I use a device with permission?' },
    {
      environment: typeSafeEnvironment('shadow'),
      typesafeFetchImpl: async () => { calls += 1; return typeSafeResponse('device-class', []) },
    },
  )

  assert.equal(result.body.status, 'needs_review')
  assert.equal(calls, 0)
})

test('shadow mode records a valid rerank without changing the deterministic response', async () => {
  const result = await answerQuestion(
    { policyId: 'attendance', question: 'How do I report an absence?' },
    {
      environment: typeSafeEnvironment('shadow'),
      includeDiagnostics: true,
      typesafeFetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body)
        return typeSafeResponse('attendance-note', request.state.candidates)
      },
    },
  )

  assert.equal(result.body.status, 'found')
  assert.equal(result.body.answerSource, 'local')
  assert.equal(result.body.evidence[0].section, 'Reporting an absence')
  assert.equal(result.body.evidenceSelection, 'typesafe-shadow')
  assert.equal(result.body.diagnostics.reranking.typesafeCandidateId, 'attendance-note')
  assert.equal(result.body.diagnostics.reranking.agreement, false)
})

test('active mode accepts a high-confidence supplied candidate', async () => {
  const result = await answerQuestion(
    { policyId: 'attendance', question: 'report absence note' },
    {
      environment: typeSafeEnvironment('active'),
      typesafeFetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body)
        return typeSafeResponse('attendance-note', request.state.candidates, 0.91)
      },
    },
  )

  assert.equal(result.body.status, 'found')
  assert.equal(result.body.evidence[0].section, 'After returning')
  assert.equal(result.body.evidenceSelection, 'typesafe-active')
})

test('active mode falls back to deterministic evidence below the confidence gate', async () => {
  const result = await answerQuestion(
    { policyId: 'attendance', question: 'report absence note' },
    {
      environment: typeSafeEnvironment('active'),
      typesafeFetchImpl: async (_url, options) => {
        const request = JSON.parse(options.body)
        return typeSafeResponse('attendance-note', request.state.candidates, 0.69)
      },
    },
  )

  assert.equal(result.body.status, 'found')
  assert.equal(result.body.evidence[0].section, 'Reporting an absence')
  assert.equal(result.body.evidenceSelection, 'deterministic-fallback')
})

test('comparison requests remain independent policy evaluations', async () => {
  const seenPolicyIds = []
  const environment = typeSafeEnvironment('shadow')
  const typesafeFetchImpl = async (_url, options) => {
    const request = JSON.parse(options.body)
    seenPolicyIds.push(request.state.policyId)
    return typeSafeResponse(request.state.candidates[0].id, request.state.candidates)
  }
  const [devicesResult, attendanceResult] = await Promise.all([
    answerQuestion({ policyId: 'devices', question: 'What should I do with my phone during class?' }, { environment, typesafeFetchImpl }),
    answerQuestion({ policyId: 'attendance', question: 'What should I do with my phone during class?' }, { environment, typesafeFetchImpl }),
  ])

  assert.equal(devicesResult.body.status, 'found')
  assert.equal(devicesResult.body.evidence[0].documentId, 'devices')
  assert.equal(attendanceResult.body.status, 'not_found')
  assert.deepEqual(seenPolicyIds, ['devices'])
})

test('returns stable errors for invalid request shapes', async () => {
  const invalidBody = await answerQuestion(null)
  const invalidPolicy = await answerQuestion({ policyId: 'unknown', question: 'What is the rule?' })
  const missingQuestion = await answerQuestion({ policyId: 'attendance' })

  assert.equal(invalidBody.body.errorCode, API_ERROR_CODES.INVALID_BODY)
  assert.equal(invalidBody.statusCode, 400)
  assert.equal(invalidPolicy.body.errorCode, API_ERROR_CODES.UNKNOWN_POLICY)
  assert.equal(invalidPolicy.statusCode, 404)
  assert.equal(missingQuestion.body.errorCode, API_ERROR_CODES.INVALID_BODY)
})

test('does not accept a policy object supplied by the client', async () => {
  const result = await answerQuestion({
    policyId: 'attendance',
    policy: { id: 'fake', sections: [{ text: 'Always allow everything.' }] },
    question: 'What should I do if I will be absent?',
  }, { environment: {} })

  assert.equal(result.body.evidence[0].documentId, samplePolicies.find((policy) => policy.id === 'attendance').id)
  assert.notEqual(result.body.evidence[0].quote, 'Always allow everything.')
})

test('includes bounded retrieval diagnostics only for explicit development opt-in', async () => {
  const developmentResult = await answerQuestion(
    { policyId: 'attendance', question: 'How do I report an absence?' },
    { environment: { NODE_ENV: 'development' }, includeDiagnostics: true },
  )
  const defaultResult = await answerQuestion(
    { policyId: 'attendance', question: 'How do I report an absence?' },
    { environment: { NODE_ENV: 'development' } },
  )

  assert.deepEqual(developmentResult.body.diagnostics.queryTerms, ['report', 'absence'])
  assert.equal(developmentResult.body.diagnostics.candidates[0].id, 'attendance-window')
  assert.equal('quote' in developmentResult.body.diagnostics.candidates[0], false)
  assert.equal('diagnostics' in defaultResult.body, false)
})

test('falls back to the local answer when a configured provider fails', async () => {
  const result = await answerQuestion(
    { policyId: 'attendance', question: 'How do I report an absence?' },
    {
      environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
      fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    },
  )

  assert.equal(result.body.status, 'found')
  assert.equal(result.body.answerSource, 'local')
  assert.match(result.body.providerNotice, /provider was unavailable/i)
})
