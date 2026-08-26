import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../src/data/policies.js'
import { validateAnswerResponse } from '../src/lib/answer-contract.js'
import { API_ERROR_CODES, answerQuestion } from './answer-service.mjs'

test('returns a validated found response for a known policy', async () => {
  const result = await answerQuestion({ policyId: 'attendance', question: 'How do I report an absence?' }, { environment: {} })

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.status, 'found')
  assert.equal(validateAnswerResponse(result.body).valid, true)
  assert.equal(result.body.evidence[0].documentId, 'attendance')
})

test('returns an honest not-found response for unsupported questions', async () => {
  const result = await answerQuestion({ policyId: 'attendance', question: 'What is the lunch menu?' }, { environment: {} })

  assert.equal(result.statusCode, 200)
  assert.equal(result.body.status, 'not_found')
  assert.equal(result.body.evidence.length, 0)
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
