import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const uiUrl = 'http://127.0.0.1:5205'
const apiUrl = 'http://127.0.0.1:8787'
const apiRoute = `${apiUrl}/api/answer`
const runId = `${process.pid}-${Date.now()}`

function canBind(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

async function waitForUi(child, getLogs) {
  const deadline = Date.now() + 20_000
  let lastError

  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Development server exited early.\n${getLogs()}`)
    try {
      const response = await fetch(uiUrl)
      if (response.ok) return
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error(`Timed out waiting for ${uiUrl}: ${lastError?.message ?? 'no response'}\n${getLogs()}`)
}

async function stopDevServer(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 4_000)),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

test('PolicyLens browser regression flows', { timeout: 150_000 }, async (t) => {
  for (const port of [5205, 8787]) {
    assert.equal(await canBind(port), true, `Port ${port} is already in use; refusing to start a second instance.`)
  }

  const child = spawn(process.execPath, ['scripts/dev.mjs', '--host', '127.0.0.1', '--port', '5205', '--strictPort'], {
    cwd: repositoryRoot,
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let serverLogs = ''
  child.stdout.on('data', (chunk) => { serverLogs += chunk.toString() })
  child.stderr.on('data', (chunk) => { serverLogs += chunk.toString() })

  let browser
  try {
    await waitForUi(child, () => serverLogs)
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: uiUrl })
    const page = await context.newPage()
    page.setDefaultTimeout(7_000)

    const consoleIssues = []
    let expectingRateLimitConsole = false
    let expectedRateLimitConsoleCount = 0
    let expectingServiceBusyConsole = false
    let expectedServiceBusyConsoleCount = 0
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        if (expectingRateLimitConsole && message.type() === 'error' && /status of 429 \(Too Many Requests\)/i.test(message.text())) {
          expectedRateLimitConsoleCount += 1
        } else if (expectingServiceBusyConsole && message.type() === 'error' && /status of 503 \(Service Unavailable\)/i.test(message.text())) {
          expectedServiceBusyConsoleCount += 1
        } else {
          consoleIssues.push(`${message.type()}: ${message.text()}`)
        }
      }
    })
    page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`))

    await t.test('loads the intended page and answers from the live development API', async () => {
      const response = await page.goto(uiUrl, { waitUntil: 'domcontentloaded' })
      assert.equal(response?.ok(), true)
      assert.match(await page.title(), /PolicyLens/i)
      assert.match(await page.locator('body').innerText(), /Make school policies/)
      assert.equal(await page.locator('vite-error-overlay').count(), 0)

      await page.getByLabel('Ask about the selected policy').fill('What should I do if I will be absent?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.locator('.answer-content h2').waitFor()
      assert.match(await page.locator('.answer-content h2').innerText(), /parent or guardian.*notify the school/i)
      assert.match(await page.locator('.evidence-block').innerText(), /Reporting an absence/)
      assert.match(await page.locator('.evidence-block').innerText(), /samples\/attendance-handbook\.txt/)
      await page.locator('.answer-panel').scrollIntoViewIfNeeded()
      await page.screenshot({ path: join(tmpdir(), `policylens-desktop-${runId}.png`), fullPage: true })
    })

    await t.test('copies every citation with its source', async () => {
      await page.getByRole('button', { name: 'Copy all evidence' }).first().click()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      assert.match(copied, /Reporting an absence/)
      assert.match(copied, /samples\/attendance-handbook\.txt/)
      assert.match(copied, /notify the school before 9:00 a\.m\./)
    })

    await t.test('abstains on unsupported questions', async () => {
      await page.getByLabel('Ask about the selected policy').fill('What is on the cafeteria lunch menu?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.locator('.not-found-content h2').waitFor()
      assert.match(await page.locator('.not-found-content h2').innerText(), /couldn’t find that/i)
      assert.match(await page.locator('.not-found-contract').innerText(), /No unsupported answer/)
    })

    await t.test('shows and copies every passage for ambiguous retrieval', async () => {
      await page.getByLabel('Sample policy source').selectOption({ label: 'Personal devices' })
      await page.getByLabel('Ask about the selected policy').fill('Can I use my phone in class for accessibility?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.getByRole('heading', { name: 'There is more than one possible passage.' }).waitFor()
      assert.equal(await page.locator('.candidate-list .evidence-passage').count(), 2)
      assert.match(await page.locator('.candidate-list').innerText(), /samples\/student-handbook\.txt/)
      await page.locator('.answer-panel').getByRole('button', { name: 'Copy all evidence' }).click()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      assert.match(copied, /Passage 1[\s\S]*Passage 2/)
      assert.match(copied, /Support exceptions/)
    })

    await t.test('compares a second policy and copies its supporting passage', async () => {
      await page.getByLabel('Sample policy source').selectOption({ label: 'Attendance & absences' })
      await page.getByRole('button', { name: 'Compare with another sample policy' }).click()
      await page.getByLabel('Second policy').selectOption({ label: 'Accessibility & support' })
      await page.getByLabel('Ask about the selected policy').fill('Who can discuss an accessibility plan with my family?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.locator('.comparison-panel .comparison-answer').waitFor()
      assert.match(await page.locator('.comparison-panel').innerText(), /Found in document/i)
      assert.match(await page.locator('.comparison-panel').innerText(), /Requesting support/)
      await page.locator('.comparison-panel').getByRole('button', { name: 'Copy all evidence' }).click()
      const copied = await page.evaluate(() => navigator.clipboard.readText())
      assert.match(copied, /samples\/accessibility-guide\.txt/)
      assert.match(copied, /school support team/)
    })

    await t.test('cancels an old request without allowing its late response to replace a newer answer', async () => {
      await page.getByRole('button', { name: 'Hide policy comparison' }).click()
      await page.route(apiRoute, async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        const request = route.request().postDataJSON()
        if (request.question !== 'Wait for this stale response') return route.continue()

        await new Promise((resolve) => setTimeout(resolve, 900))
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': uiUrl },
            body: JSON.stringify({
              status: 'found',
              answer: 'STALE ANSWER MUST NOT REPLACE THE NEW RESULT.',
              evidence: [{ documentId: 'attendance', section: 'Reporting an absence', quote: 'A parent or guardian should notify the school before 9:00 a.m. on a day the student will be absent.', sourceUrl: null }],
              evidenceStrength: 'strong',
              nextStep: '',
              disclaimer: 'PolicyLens is an explainer, not a substitute for your school’s official guidance. Confirm important decisions with the school.',
            }),
          })
        } catch {
          // The browser may already have cancelled this deliberately delayed response.
        }
      })

      await page.getByLabel('Ask about the selected policy').fill('Wait for this stale response')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.getByRole('button', { name: 'Cancel search' }).waitFor()
      await page.getByRole('button', { name: 'Cancel search' }).click()
      await page.getByRole('heading', { name: 'Search cancelled.' }).waitFor()
      await page.getByLabel('Ask about the selected policy').fill('What should I do if I will be absent?')
      await page.getByRole('button', { name: 'Try again' }).click()
      await page.locator('.answer-content h2').waitFor()
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      assert.doesNotMatch(await page.locator('.answer-content h2').innerText(), /STALE ANSWER/)
      assert.match(await page.locator('.answer-content h2').innerText(), /parent or guardian/i)
      await page.unroute(apiRoute)
    })

    await t.test('times out a stalled request and provides a retry action', async () => {
      await page.route(apiRoute, async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        const request = route.request().postDataJSON()
        if (request.question !== 'Wait for the request deadline') return route.continue()
        await new Promise((resolve) => setTimeout(resolve, 13_000))
        try {
          await route.continue()
        } catch {
          // The client deadline aborts this request before the delayed continuation.
        }
      })

      await page.getByLabel('Ask about the selected policy').fill('Wait for the request deadline')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.getByRole('heading', { name: 'The search took too long.' }).waitFor({ timeout: 15_000 })
      assert.equal(await page.getByRole('button', { name: 'Try again' }).isVisible(), true)
      await new Promise((resolve) => setTimeout(resolve, 1_000))
      await page.unroute(apiRoute)
    })

    await t.test('supports keyboard entry and remains usable at 320 pixels', async () => {
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.keyboard.press('Tab')
      assert.match(await page.evaluate(() => document.activeElement?.textContent ?? ''), /Skip to policy workspace/)
      await page.setViewportSize({ width: 320, height: 800 })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
      await page.getByLabel('Ask about the selected policy').fill('Where do I bring an absence note?')
      const answerResponse = page.waitForResponse((response) => (
        response.url() === apiRoute && response.request().method() === 'POST'
      ))
      await page.getByRole('button', { name: 'Find the answer' }).click()
      const response = await answerResponse
      assert.equal(response.status(), 200)
      assert.equal((await response.json()).status, 'found')
      await page.getByRole('heading', { name: /attendance office within three school days/i }).waitFor()
      assert.match(await page.locator('.evidence-block').innerText(), /After returning/)
      await page.evaluate(() => {
        document.activeElement?.blur()
        window.scrollTo(0, 0)
      })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
      await page.screenshot({ path: join(tmpdir(), `policylens-mobile-${runId}.png`), fullPage: true })
    })

    await t.test('shows a clear recovery message when the API rate limit is reached', async () => {
      expectingRateLimitConsole = true
      const statuses = await page.evaluate(async (endpoint) => {
        const observed = []
        for (let index = 0; index < 40; index += 1) {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ policyId: 'attendance', question: 'How do I report an absence?' }),
          })
          observed.push(response.status)
          if (response.status === 429) break
        }
        return observed
      }, apiRoute)
      assert.equal(statuses.includes(429), true)

      await page.getByLabel('Ask about the selected policy').fill('How do I report an absence?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.getByRole('heading', { name: 'The demo rate limit is active.' }).waitFor()
      assert.match(await page.locator('.not-found-content p').innerText(), /Wait \d+ seconds/)
      await page.getByRole('button', { name: 'Try again' }).waitFor()
      expectingRateLimitConsole = false
      assert.ok(expectedRateLimitConsoleCount >= 1)
    })

    await t.test('shows a retry-after recovery message when the API is at capacity', async () => {
      expectingServiceBusyConsole = true
      await page.route(apiRoute, async (route) => {
        if (route.request().method() !== 'POST') return route.continue()
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': uiUrl, 'Access-Control-Expose-Headers': 'Retry-After', 'Retry-After': '1' },
          body: JSON.stringify({ status: 'error', errorCode: 'SERVICE_BUSY', reason: 'The answer service is busy. Try again shortly.' }),
        })
      })
      await page.getByLabel('Ask about the selected policy').fill('How do I report an absence?')
      await page.getByRole('button', { name: 'Find the answer' }).click()
      await page.getByRole('heading', { name: 'The answer service is at capacity.' }).waitFor()
      assert.match(await page.locator('.not-found-content p').innerText(), /Retry in 1 second\./)
      expectingServiceBusyConsole = false
      assert.ok(expectedServiceBusyConsoleCount >= 1)
      await page.unroute(apiRoute)
    })

    await t.test('has no browser console errors, warnings, or React runtime errors', async () => {
      assert.deepEqual(consoleIssues, [])
    })
  } finally {
    await browser?.close()
    await stopDevServer(child)
  }
})
