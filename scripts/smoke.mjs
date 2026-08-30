import { spawn } from 'node:child_process'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8787'
const STARTUP_TIMEOUT_MS = 8_000
const REQUEST_TIMEOUT_MS = 3_000

function getArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function normaliseBaseUrl(value) {
  const baseUrl = new URL(value ?? process.env.SMOKE_BASE_URL ?? DEFAULT_BASE_URL)
  return baseUrl.origin
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function waitForHealth(baseUrl, child) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  let lastError = 'server did not become healthy'

  while (Date.now() < deadline) {
    if (child?.exitCode !== null && child?.exitCode !== undefined) {
      throw new Error(`server exited before becoming healthy (code ${child.exitCode})`)
    }

    try {
      const response = await fetchWithTimeout(`${baseUrl}/healthz`)
      if (response.status === 200) return
      lastError = `health check returned HTTP ${response.status}`
    } catch (error) {
      lastError = error?.name === 'AbortError' ? 'health check timed out' : error.message
    }
    await wait(100)
  }

  throw new Error(lastError)
}

async function assertResponse(response, description) {
  if (!response.ok) throw new Error(`${description} returned HTTP ${response.status}`)
  return response
}

async function runSmoke(baseUrl) {
  const healthResponse = await assertResponse(await fetchWithTimeout(`${baseUrl}/healthz`), 'health check')
  const health = await healthResponse.json()
  if (health.status !== 'ok' || health.checks?.build !== 'ok') throw new Error('health check did not report a ready build')

  const pageResponse = await assertResponse(await fetchWithTimeout(`${baseUrl}/`), 'application page')
  const page = await pageResponse.text()
  if (!page.includes('id="root"') || !page.includes('type="module"')) throw new Error('application page did not contain the expected app shell')

  const foundResponse = await assertResponse(await fetchWithTimeout(`${baseUrl}/api/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyId: 'attendance', question: 'How do I report an absence?' }),
  }), 'supported answer')
  const found = await foundResponse.json()
  if (found.status !== 'found' || !Array.isArray(found.evidence) || found.evidence.length === 0) {
    throw new Error('supported answer did not include grounded evidence')
  }

  const unsupportedResponse = await assertResponse(await fetchWithTimeout(`${baseUrl}/api/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policyId: 'attendance', question: 'What is the school lunch menu?' }),
  }), 'unsupported answer')
  const unsupported = await unsupportedResponse.json()
  if (unsupported.status !== 'not_found' || unsupported.evidence?.length !== 0) {
    throw new Error('unsupported answer did not abstain with an empty evidence list')
  }
}

async function main() {
  const explicitBaseUrl = getArgument('--base-url') ?? process.env.SMOKE_BASE_URL
  const baseUrl = normaliseBaseUrl(explicitBaseUrl)
  let child = null

  try {
    if (!explicitBaseUrl) {
      child = spawn(process.execPath, ['server/index.mjs'], {
        env: { ...process.env, NODE_ENV: 'production', POLICYLENS_API_HOST: '127.0.0.1', PORT: '8787' },
        stdio: 'ignore',
      })
      await waitForHealth(baseUrl, child)
    }

    await runSmoke(baseUrl)
    console.log(`PolicyLens smoke passed: ${baseUrl}`)
  } finally {
    if (child && child.exitCode === null) child.kill()
  }
}

main().catch((error) => {
  console.error(`PolicyLens smoke failed: ${error.message}`)
  process.exitCode = 1
})

