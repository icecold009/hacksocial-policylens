import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAnswerRequest } from './answer-service.mjs'
import { getContentType, SECURITY_HEADERS, resolveStaticPath } from './static-assets.mjs'
import { resolveServerConfig } from './runtime-config.mjs'

const { host, port } = resolveServerConfig()
const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
  })
  response.end(JSON.stringify(body))
}

async function serveStatic(request, response) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for the application.' } })
    return
  }

  let requestPath
  try {
    requestPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  } catch {
    sendJson(response, 400, { error: { code: 'INVALID_URL', message: 'The requested URL is invalid.' } })
    return
  }

  const resolved = resolveStaticPath(distRoot, requestPath)
  if (resolved.kind === 'bad_request') {
    sendJson(response, 400, { error: { code: 'INVALID_URL', message: 'The requested URL is invalid.' } })
    return
  }
  if (resolved.kind === 'forbidden') {
    sendJson(response, 403, { error: { code: 'FORBIDDEN_PATH', message: 'The requested path is not available.' } })
    return
  }

  let filePath = resolved.path
  try {
    const fileStats = await stat(filePath)
    if (fileStats.isDirectory()) filePath = resolve(filePath, 'index.html')
  } catch {
    if (resolved.hasExtension) {
      sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'The requested asset was not found.' } })
      return
    }
    filePath = resolve(distRoot, 'index.html')
  }

  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      ...SECURITY_HEADERS,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600',
      'Content-Type': getContentType(filePath),
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    sendJson(response, 503, { error: { code: 'APP_NOT_BUILT', message: 'The application build is not available.' } })
  }
}

async function isBuildReady() {
  try {
    const fileStats = await stat(resolve(distRoot, 'index.html'))
    return fileStats.isFile()
  } catch {
    return false
  }
}

const server = http.createServer(async (request, response) => {
  let requestPath
  try {
    requestPath = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  } catch {
    sendJson(response, 400, { error: { code: 'INVALID_URL', message: 'The requested URL is invalid.' } })
    return
  }

  if (requestPath === '/healthz' && request.method === 'GET') {
    const buildReady = await isBuildReady()
    sendJson(response, buildReady ? 200 : 503, {
      status: buildReady ? 'ok' : 'degraded',
      checks: { build: buildReady ? 'ok' : 'missing' },
    })
    return
  }

  if (requestPath === '/api/answer') {
    await handleAnswerRequest(request, response)
    return
  }

  await serveStatic(request, response)
})

server.listen(port, host, () => {
  console.log(`PolicyLens API listening on http://${host}:${port}`)
})

