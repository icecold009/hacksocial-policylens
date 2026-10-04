import test from 'node:test'
import assert from 'node:assert/strict'
import { requestAnswerWithDeadline } from './answer-request.js'

function response(payload, status = 200, headers = {}) {
  return {
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => payload,
  }
}

test('posts a selected policy question and returns a decoded response', async () => {
  let request
  const result = await requestAnswerWithDeadline({
    apiBaseUrl: 'http://127.0.0.1:8787',
    policyId: 'attendance',
    question: 'When should I report an absence?',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return response({ status: 'found' })
    },
  })

  assert.equal(result.type, 'response')
  assert.equal(result.payload.status, 'found')
  assert.equal(request.url, 'http://127.0.0.1:8787/api/answer')
  assert.deepEqual(JSON.parse(request.options.body), {
    policyId: 'attendance',
    question: 'When should I report an absence?',
  })
  assert.equal(request.options.signal.aborted, false)
})

test('aborts a stalled request at its deadline', async () => {
  const result = await requestAnswerWithDeadline({
    policyId: 'attendance',
    question: 'Question',
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  })

  assert.equal(result.type, 'timeout')
})

test('distinguishes user cancellation from a timeout', async () => {
  const controller = new AbortController()
  const pending = requestAnswerWithDeadline({
    policyId: 'attendance',
    question: 'Question',
    signal: controller.signal,
    timeoutMs: 1_000,
    fetchImpl: (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  })
  controller.abort()

  assert.equal((await pending).type, 'cancelled')
})

test('returns recoverable results for network, malformed, and rate-limit failures', async () => {
  const common = { policyId: 'attendance', question: 'Question' }
  const unavailable = await requestAnswerWithDeadline({ ...common, fetchImpl: async () => { throw new Error('offline') } })
  const malformed = await requestAnswerWithDeadline({ ...common, fetchImpl: async () => ({ json: async () => { throw new Error('invalid json') } }) })
  const limited = await requestAnswerWithDeadline({ ...common, fetchImpl: async () => response(null, 429, { 'retry-after': '30' }) })

  assert.equal(unavailable.type, 'unavailable')
  assert.equal(malformed.type, 'invalid')
  assert.deepEqual(limited, { type: 'rate_limited', retryAfterSeconds: 30 })
  const busy = await requestAnswerWithDeadline({ ...common, fetchImpl: async () => response(null, 503, { 'retry-after': '1' }) })
  assert.deepEqual(busy, { type: 'service_busy', retryAfterSeconds: 1 })
})
