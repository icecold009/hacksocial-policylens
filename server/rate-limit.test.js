import test from 'node:test'
import assert from 'node:assert/strict'
import { createRateLimiter } from './rate-limit.mjs'

test('allows requests within the configured window and blocks excess requests', () => {
  let now = 1000
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: () => now })

  assert.equal(limiter.check('client').allowed, true)
  assert.equal(limiter.check('client').allowed, true)
  const blocked = limiter.check('client')
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.retryAfterSeconds, 1)

  now = 2000
  assert.equal(limiter.check('client').allowed, true)
})

test('keeps separate limits for separate clients', () => {
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: () => 1000 })

  assert.equal(limiter.check('one').allowed, true)
  assert.equal(limiter.check('one').allowed, false)
  assert.equal(limiter.check('two').allowed, true)
})

test('removes expired clients before admitting a new bounded key', () => {
  let now = 1000
  const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => now })

  assert.equal(limiter.check('one').allowed, true)
  assert.equal(limiter.check('two').allowed, true)
  now = 2000
  assert.equal(limiter.check('three').allowed, true)
  assert.equal(limiter.check('one').allowed, true)
})

