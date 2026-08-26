export const RATE_LIMIT_MAX_REQUESTS = 30
export const RATE_LIMIT_WINDOW_MS = 60_000

export function createRateLimiter({ limit = RATE_LIMIT_MAX_REQUESTS, windowMs = RATE_LIMIT_WINDOW_MS, now = () => Date.now() } = {}) {
  const buckets = new Map()

  return {
    check(key) {
      const currentTime = now()
      const bucket = buckets.get(key)
      if (!bucket || currentTime - bucket.startedAt >= windowMs) {
        buckets.set(key, { startedAt: currentTime, count: 1 })
        return { allowed: true, retryAfterSeconds: 0 }
      }

      if (bucket.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.ceil((windowMs - (currentTime - bucket.startedAt)) / 1000) }
      }

      bucket.count += 1
      return { allowed: true, retryAfterSeconds: 0 }
    },
  }
}
