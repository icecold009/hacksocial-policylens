import { createRateLimiter } from './rate-limit.mjs'

export const API_MAX_CONCURRENT_REQUESTS = 8
export const UPSTREAM_MAX_CONCURRENT_CALLS = 4
export const UPSTREAM_MAX_CALLS_PER_MINUTE = 20

export function createConcurrencyLimiter(limit = API_MAX_CONCURRENT_REQUESTS) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Concurrency limit must be a positive integer.')
  let inFlight = 0

  return {
    acquire() {
      if (inFlight >= limit) return null
      inFlight += 1
      let released = false
      return () => {
        if (released) return
        released = true
        inFlight -= 1
      }
    },
    get inFlight() {
      return inFlight
    },
  }
}

export function createUpstreamCallGuard({
  maxConcurrent = UPSTREAM_MAX_CONCURRENT_CALLS,
  callsPerMinute = UPSTREAM_MAX_CALLS_PER_MINUTE,
  now = () => Date.now(),
} = {}) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) throw new RangeError('Upstream concurrency limit must be a positive integer.')
  if (!Number.isInteger(callsPerMinute) || callsPerMinute < 1) throw new RangeError('Upstream request budget must be a positive integer.')

  const budget = createRateLimiter({ limit: callsPerMinute, windowMs: 60_000, maxKeys: 1, now })
  let inFlight = 0

  return {
    async run(operation) {
      if (inFlight >= maxConcurrent) return { accepted: false, reason: 'concurrency' }

      const allowance = budget.check('upstream')
      if (!allowance.allowed) {
        return { accepted: false, reason: 'budget', retryAfterSeconds: allowance.retryAfterSeconds }
      }

      inFlight += 1
      try {
        return { accepted: true, value: await operation() }
      } finally {
        inFlight -= 1
      }
    },
    get inFlight() {
      return inFlight
    },
  }
}
