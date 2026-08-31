import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../src/data/policies.js'
import { retrieveEvidence } from '../src/lib/retrieval.js'
import { buildProviderMessages, PROVIDER_MAX_RESPONSE_BYTES, requestProviderAnswer } from './provider.mjs'

const policy = samplePolicies.find((item) => item.id === 'attendance')
const retrieval = retrieveEvidence(policy, 'How do I report an absence?')
const evidence = retrieval.candidates

function providerEnvelope(answer) {
  return { choices: [{ message: { content: JSON.stringify(answer) } }] }
}

function providerResponse(answer, options = {}) {
  const body = options.body ?? JSON.stringify(providerEnvelope(answer))
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name === 'content-length' && options.contentLength !== undefined ? String(options.contentLength) : null },
    text: async () => body,
  }
}

function validProviderAnswer() {
  return {
    status: 'found',
    answer: 'A parent or guardian should notify the school before 9:00 a.m.',
    evidence: [{
      documentId: 'attendance',
      section: 'Reporting an absence',
      quote: policy.sections[0].text,
      sourceUrl: null,
    }],
    evidenceStrength: 'strong',
    nextStep: 'Confirm the reporting channel with the attendance office.',
    disclaimer: 'Confirm important decisions with the school.',
  }
}

test('does not call a provider when configuration is absent', async () => {
  let calls = 0
  const result = await requestProviderAnswer({ question: 'Question', policy, candidates: evidence, environment: {}, fetchImpl: async () => { calls += 1 } })

  assert.equal(result, null)
  assert.equal(calls, 0)
})

test('accepts provider output only when every citation is grounded', async () => {
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(request.messages[1].content.includes('How do I report an absence?'), true)
      assert.equal(request.messages[1].content.includes(policy.sections[0].text), true)
      return providerResponse(validProviderAnswer())
    },
  })

  assert.equal(result.answerSource, 'provider')
  assert.equal(result.evidence[0].quote, policy.sections[0].text)
})

test('rejects a provider citation that was not in retrieved evidence', async () => {
  const answer = validProviderAnswer()
  answer.evidence[0].quote = 'The school has a completely different rule.'
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => providerResponse(answer),
  })

  assert.equal(result, null)
})

test('retries one transient provider response without exposing its payload', async () => {
  let calls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => {
      calls += 1
      if (calls === 1) return { ok: false, status: 503, json: async () => ({ secret: 'never used' }) }
      return providerResponse(validProviderAnswer())
    },
  })

  assert.equal(calls, 2)
  assert.equal(result.answerSource, 'provider')
})

test('aborts timed-out provider attempts and returns control to the local fallback', async () => {
  let calls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    timeoutMs: 5,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async (_url, options) => {
      calls += 1
      await new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(new Error('timed out')), { once: true })
        if (options.signal.aborted) reject(new Error('timed out'))
      })
      return providerResponse(validProviderAnswer())
    },
  })

  assert.equal(calls, 2)
  assert.equal(result, null)
})

test('rejects provider responses that exceed the response-size limit', async () => {
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => providerResponse(null, { body: 'x'.repeat(PROVIDER_MAX_RESPONSE_BYTES + 1) }),
  })

  assert.equal(result, null)
})

test('strips provider fields outside the public answer contract', async () => {
  const answer = { ...validProviderAnswer(), providerNotice: 'Unexpected provider detail', diagnostics: { secret: 'not returned' } }
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => providerResponse(answer),
  })

  assert.equal(result.answerSource, 'provider')
  assert.equal('providerNotice' in result, false)
  assert.equal('diagnostics' in result, false)
})

test('does not call an insecure provider endpoint outside local development', async () => {
  let calls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: evidence,
    environment: { POLICYLENS_AI_ENDPOINT: 'http://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => { calls += 1 },
  })

  assert.equal(result, null)
  assert.equal(calls, 0)
})

test('keeps source text in the user evidence payload, separate from instructions', () => {
  const messages = buildProviderMessages('Question', policy, evidence)
  assert.equal(messages[0].role, 'system')
  assert.match(messages[0].content, /untrusted source data/)
  assert.match(messages[1].content, /"evidence"/)
})

