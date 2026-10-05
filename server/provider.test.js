import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../src/data/policies.js'
import { retrieveEvidence } from '../src/lib/retrieval.js'
import { buildProviderMessages, isGroundedProviderResponse, PROVIDER_MAX_RESPONSE_BYTES, requestProviderAnswer } from './provider.mjs'
import { createUpstreamCallGuard } from './capacity-limits.mjs'

const policy = samplePolicies.find((item) => item.id === 'attendance')
const retrieval = retrieveEvidence(policy, 'How do I report an absence?')
const evidence = retrieval.candidates

function providerEnvelope(answer) {
  return { choices: [{ message: { content: JSON.stringify(answer) } }] }
}

function providerResponse(answer, options = {}) {
  const body = options.body ?? JSON.stringify(providerEnvelope(answer))
  const chunks = options.chunks ?? [new TextEncoder().encode(body)]
  let chunkIndex = 0
  let cancelled = false
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name === 'content-length' && options.contentLength !== undefined ? String(options.contentLength) : null },
    body: new ReadableStream({
      pull(controller) {
        if (chunkIndex >= chunks.length) {
          if (!options.keepOpen) controller.close()
          return
        }
        const chunk = chunks[chunkIndex]
        chunkIndex += 1
        controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk)
      },
      cancel() { cancelled = true },
    }),
    get cancelled() { return cancelled },
  }
}

function validProviderAnswer() {
  return {
    status: 'found',
    answer: policy.sections[0].answer,
    evidence: [{
      documentId: 'attendance',
      section: 'Reporting an absence',
      quote: policy.sections[0].text,
      sourceUrl: null,
    }],
    evidenceStrength: 'strong',
    nextStep: policy.sections[0].nextStep,
    disclaimer: 'PolicyLens is an explainer, not a substitute for your school’s official guidance. Confirm important decisions with the school.',
  }
}

test('does not call a provider when configuration is absent', async () => {
  let calls = 0
  const result = await requestProviderAnswer({ question: 'Question', policy, candidates: evidence, environment: {}, fetchImpl: async () => { calls += 1 } })

  assert.equal(result, null)
  assert.equal(calls, 0)
})

test('accepts provider output only when the answer, next step, disclaimer, and citation match trusted response data', async () => {
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async (_url, options) => {
      const request = JSON.parse(options.body)
      assert.equal(request.messages[1].content.includes('How do I report an absence?'), true)
      assert.equal(request.messages[1].content.includes(policy.sections[0].text), true)
      assert.equal(request.messages[1].content.includes(policy.sections[0].answer), true)
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
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => providerResponse(answer),
  })

  assert.equal(result, null)
})

test('rejects unsupported answers and next steps even when the citation is exact', async () => {
  const answer = validProviderAnswer()
  answer.answer = 'A student can report an absence at any time during the week.'
  answer.nextStep = 'Call the principal and request an automatic excused absence.'
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => providerResponse(answer),
  })

  assert.equal(result, null)
})

test('rejects an unsupported answer or next step independently', () => {
  const answer = validProviderAnswer()
  const candidate = [retrieval.evidence]

  assert.equal(isGroundedProviderResponse({ ...answer, answer: 'Absences are always excused.' }, policy, candidate), false)
  assert.equal(isGroundedProviderResponse({ ...answer, nextStep: 'The principal must approve it automatically.' }, policy, candidate), false)
})

test('retries one transient provider response without exposing its payload', async () => {
  let calls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
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

test('counts each provider retry against the shared upstream attempt budget', async () => {
  const guard = createUpstreamCallGuard({ maxConcurrent: 2, callsPerMinute: 1 })
  let fetchCalls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    upstreamRequest: (operation) => guard.run(operation),
    fetchImpl: async () => {
      fetchCalls += 1
      return { ...providerResponse(null), ok: false, status: 503 }
    },
  })

  assert.equal(result, null)
  assert.equal(fetchCalls, 1)
})

test('aborts timed-out provider attempts and returns control to the local fallback', async () => {
  let calls = 0
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
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
  const streamedResponse = providerResponse(null, {
    body: '',
    chunks: [new Uint8Array(PROVIDER_MAX_RESPONSE_BYTES), new Uint8Array([0x7b])],
    keepOpen: true,
  })
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => streamedResponse,
  })

  assert.equal(result, null)
  assert.equal(streamedResponse.cancelled, true)
})

test('cancels a provider body as soon as its declared length exceeds the limit', async () => {
  const oversizedResponse = providerResponse(null, {
    body: '',
    contentLength: PROVIDER_MAX_RESPONSE_BYTES + 1,
    chunks: [],
    keepOpen: true,
  })
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
    environment: { POLICYLENS_AI_ENDPOINT: 'https://provider.example/v1/chat', POLICYLENS_AI_API_KEY: 'test-key', POLICYLENS_AI_MODEL: 'test-model' },
    fetchImpl: async () => oversizedResponse,
  })

  assert.equal(result, null)
  assert.equal(oversizedResponse.cancelled, true)
})

test('strips provider fields outside the public answer contract', async () => {
  const answer = { ...validProviderAnswer(), providerNotice: 'Unexpected provider detail', diagnostics: { secret: 'not returned' } }
  const result = await requestProviderAnswer({
    question: 'How do I report an absence?',
    policy,
    candidates: [retrieval.evidence],
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
    candidates: [retrieval.evidence],
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

