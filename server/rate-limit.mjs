export const RATE_LIMIT_MAX_REQUESTS = 30
export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX_KEYS = 10_000

export function createRateLimiter({
  limit = RATE_LIMIT_MAX_REQUESTS,
  windowMs = RATE_LIMIT_WINDOW_MS,
  maxKeys = RATE_LIMIT_MAX_KEYS,
  now = () => Date.now(),
} = {}) {
  const buckets = new Map()

  function removeExpired(currentTime) {
    for (const [key, bucket] of buckets) {
      if (currentTime - bucket.startedAt >= windowMs) buckets.delete(key)
    }
  }

  return {
    check(key) {
      const currentTime = now()
      const normalizedKey = typeof key === 'string' && key.trim() ? key.slice(0, 128) : 'unknown'
      let bucket = buckets.get(normalizedKey)
      if (!bucket || currentTime - bucket.startedAt >= windowMs) {
        if (buckets.size >= maxKeys && !buckets.has(normalizedKey)) {
          removeExpired(currentTime)
          if (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value)
        }
        bucket = { startedAt: currentTime, count: 1 }
        buckets.set(normalizedKey, bucket)
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

