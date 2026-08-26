import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleAnswerRequest } from './answer-service.mjs'
import { SECURITY_HEADERS, resolveStaticPath } from './static-assets.mjs'

const port = Number(process.env.POLICYLENS_API_PORT ?? 8787)
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
      'Content-Type': filePath.endsWith('index.html') ? 'text/html; charset=utf-8' : resolved.contentType,
    })
    response.end(request.method === 'HEAD' ? undefined : body)
  } catch {
    sendJson(response, 503, { error: { code: 'APP_NOT_BUILT', message: 'The application build is not available.' } })
  }
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/healthz' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok' })
    return
  }

  if (request.url === '/api/answer') {
    await handleAnswerRequest(request, response)
    return
  }

  await serveStatic(request, response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`PolicyLens API listening on http://127.0.0.1:${port}`)
})
