import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { performance } from 'node:perf_hooks'
import { resolveServerConfig } from '../server/runtime-config.mjs'

const explicitBaseUrl = process.argv[2] ?? process.env.POLICYLENS_BASE_URL
const serverConfig = explicitBaseUrl ? null : resolveServerConfig()
const localHost = serverConfig?.host === '0.0.0.0' ? '127.0.0.1' : serverConfig?.host
const baseUrl = new URL(explicitBaseUrl ?? `http://${localHost}:${serverConfig.port}`).origin
const policyId = 'attendance'
const question = 'How do I report an absence?'
const warmups = 2
const samples = 10
const timeoutMs = 5_000

function canBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, host, () => server.close(() => resolve(true)))
  })
}

async function waitForHealth(child) {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Local server exited with code ${child.exitCode}.`)
    try {
      const response = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) return
    } catch {
      // Keep waiting through local startup until the bounded deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Local server did not become healthy before the startup deadline.')
}

async function measureAnswer() {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = performance.now()
  try {
    const response = await fetch(`${baseUrl}/api/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ policyId, question }),
      signal: controller.signal,
    })
    const result = await response.json()
    const elapsedMs = performance.now() - startedAt
    if (!response.ok || result.status !== 'found' || !Array.isArray(result.evidence) || result.evidence.length === 0) {
      throw new Error(`Answer probe failed with HTTP ${response.status}.`)
    }
    return elapsedMs
  } finally {
    clearTimeout(timeout)
  }
}

function percentile(sortedValues, fraction) {
  return sortedValues[Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * fraction) - 1)]
}

let child
try {
  if (!explicitBaseUrl) {
    if (!await canBind(serverConfig.port, '127.0.0.1')) {
      throw new Error(`Port ${serverConfig.port} is already in use; refusing to start another server.`)
    }
    child = spawn(process.execPath, ['server/index.mjs'], {
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'ignore',
    })
    await waitForHealth(child)
  }

  const health = await fetch(`${baseUrl}/healthz`, { signal: AbortSignal.timeout(timeoutMs) })
  const healthBody = await health.json()
  if (!health.ok || healthBody.status !== 'ok') throw new Error(`Health check failed with HTTP ${health.status}.`)

  for (let index = 0; index < warmups; index += 1) await measureAnswer()
  const values = []
  for (let index = 0; index < samples; index += 1) values.push(await measureAnswer())
  values.sort((left, right) => left - right)
  const median = percentile(values, 0.5)
  const p95 = percentile(values, 0.95)
  console.log(`PolicyLens deterministic API latency: ${baseUrl}`)
  console.log(`- warmups: ${warmups}; measured samples: ${samples}`)
  console.log(`- median: ${median.toFixed(1)}ms; p95: ${p95.toFixed(1)}ms; min: ${values[0].toFixed(1)}ms; max: ${values.at(-1).toFixed(1)}ms`)
  console.log(`- release: ${typeof healthBody.release === 'string' ? healthBody.release : 'unreported'}`)
  console.log('- synthetic answer and exact evidence validated; no question text was printed')
} catch (error) {
  console.error(`PolicyLens latency measurement failed: ${error.message}`)
  process.exitCode = 1
} finally {
  if (child && child.exitCode === null) child.kill()
}
