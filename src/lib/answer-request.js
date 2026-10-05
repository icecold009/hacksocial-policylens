export const ANSWER_REQUEST_TIMEOUT_MS = 12_000

function readRetryAfterSeconds(response) {
  const value = Number.parseInt(response.headers?.get?.('retry-after') ?? '', 10)
  return Number.isInteger(value) && value > 0 ? Math.min(value, 3_600) : null
}

export async function requestAnswerWithDeadline({
  apiBaseUrl = '',
  policyId,
  question,
  signal,
  timeoutMs = ANSWER_REQUEST_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') return { type: 'unavailable' }

  const controller = new AbortController()
  let timedOut = false
  const forwardAbort = () => controller.abort()
  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })

  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetchImpl(`${apiBaseUrl}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId, question }),
      signal: controller.signal,
    })

    if (response?.status === 429) {
      return { type: 'rate_limited', retryAfterSeconds: readRetryAfterSeconds(response) }
    }
    if (response?.status === 503) {
      return { type: 'service_busy', retryAfterSeconds: readRetryAfterSeconds(response) }
    }
    if (typeof response?.json !== 'function') return { type: 'invalid' }

    try {
      return { type: 'response', payload: await response.json() }
    } catch {
      if (timedOut) return { type: 'timeout' }
      if (signal?.aborted) return { type: 'cancelled' }
      return { type: 'invalid' }
    }
  } catch {
    if (timedOut) return { type: 'timeout' }
    if (signal?.aborted) return { type: 'cancelled' }
    return { type: 'unavailable' }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', forwardAbort)
  }
}
