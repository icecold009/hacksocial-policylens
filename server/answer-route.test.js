import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { API_ERROR_CODES, handleAnswerRequest } from './answer-service.mjs'

function createRequest({ method = 'POST', body = '', contentType = 'application/json', origin, remoteAddress = 'route-test' } = {}) {
  const request = Readable.from([body])
  request.method = method
  request.headers = {
    'content-type': contentType,
    ...(origin ? { origin } : {}),
  }
  request.socket = { remoteAddress }
  return request
}

function createResponse() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode
      this.headers = headers
    },
    end(body) {
      this.body = body ?? ''
    },
  }
}

async function runRequest(options) {
  const response = createResponse()
  await handleAnswerRequest(createRequest(options), response)
  return { ...response, json: response.body ? JSON.parse(response.body) : null }
}

test('serves a grounded answer through the HTTP handler', async () => {
  const result = await runRequest({
    body: JSON.stringify({ policyId: 'attendance', question: 'How do I report an absence?' }),
    origin: 'http://127.0.0.1:5173',
    remoteAddress: 'route-found',
  })

  assert.equal(result.statusCode, 200)
  assert.equal(result.json.status, 'found')
  assert.equal(result.json.evidence[0].section, 'Reporting an absence')
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'http://127.0.0.1:5173')
})

test('rejects unsupported methods and media types at the HTTP boundary', async () => {
  const getResult = await runRequest({ method: 'GET', remoteAddress: 'route-get' })
  const textResult = await runRequest({ method: 'POST', contentType: 'text/plain', body: '{}', remoteAddress: 'route-text' })

  assert.equal(getResult.statusCode, 405)
  assert.equal(getResult.json.errorCode, API_ERROR_CODES.METHOD_NOT_ALLOWED)
  assert.equal(textResult.statusCode, 415)
  assert.equal(textResult.json.errorCode, API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE)
})

test('returns stable JSON errors for malformed request bodies', async () => {
  const result = await runRequest({ body: '{"policyId":', remoteAddress: 'route-json' })

  assert.equal(result.statusCode, 400)
  assert.equal(result.json.status, 'error')
  assert.equal(result.json.errorCode, API_ERROR_CODES.INVALID_JSON)
  assert.doesNotMatch(JSON.stringify(result.json), /SyntaxError|node_modules|answer-service/i)
})

test('handles CORS preflight without invoking the answer flow', async () => {
  const result = await runRequest({
    method: 'OPTIONS',
    origin: 'http://localhost:5173',
    remoteAddress: 'route-options',
  })

  assert.equal(result.statusCode, 204)
  assert.equal(result.body, '')
  assert.equal(result.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS')
  assert.equal(result.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
})
