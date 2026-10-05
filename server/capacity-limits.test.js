import test from 'node:test'
import assert from 'node:assert/strict'
import { createConcurrencyLimiter, createUpstreamCallGuard } from './capacity-limits.mjs'

test('bounds concurrent requests and releases capacity only once', () => {
  const limiter = createConcurrencyLimiter(2)
  const releaseFirst = limiter.acquire()
  const releaseSecond = limiter.acquire()

  assert.equal(limiter.inFlight, 2)
  assert.equal(limiter.acquire(), null)
  releaseFirst()
  releaseFirst()
  assert.equal(limiter.inFlight, 1)
  const releaseThird = limiter.acquire()
  assert.equal(typeof releaseThird, 'function')
  assert.equal(limiter.inFlight, 2)
  releaseThird()
  releaseSecond()
  assert.equal(limiter.inFlight, 0)
})

test('enforces a shared in-process upstream concurrency cap and releases after failures', async () => {
  const guard = createUpstreamCallGuard({ maxConcurrent: 1, callsPerMinute: 3 })
  let releaseOperation
  const first = guard.run(() => new Promise((resolve) => { releaseOperation = resolve }))
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(await guard.run(async () => 'should not run'), { accepted: false, reason: 'concurrency' })
  releaseOperation('done')
  assert.deepEqual(await first, { accepted: true, value: 'done' })
  assert.equal(guard.inFlight, 0)

  await assert.rejects(() => guard.run(async () => { throw new Error('provider failed') }), /provider failed/)
  assert.deepEqual(await guard.run(async () => 'capacity returned'), { accepted: true, value: 'capacity returned' })
})

test('caps upstream calls per process and reports the retry delay', async () => {
  let now = 0
  const guard = createUpstreamCallGuard({ maxConcurrent: 2, callsPerMinute: 2, now: () => now })

  assert.deepEqual(await guard.run(async () => 1), { accepted: true, value: 1 })
  assert.deepEqual(await guard.run(async () => 2), { accepted: true, value: 2 })
  assert.deepEqual(await guard.run(async () => 3), { accepted: false, reason: 'budget', retryAfterSeconds: 60 })
  now = 60_000
  assert.deepEqual(await guard.run(async () => 4), { accepted: true, value: 4 })
})
