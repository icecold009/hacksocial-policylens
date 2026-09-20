import { samplePolicies } from '../src/data/policies.js'
import { createAnswerResponse, validateAnswerResponse } from '../src/lib/answer-contract.js'
import { retrieveEvidence } from '../src/lib/retrieval.js'
import { requestProviderAnswer } from './provider.mjs'
import { createRateLimiter } from './rate-limit.mjs'
import { getTypeSafeMode, requestTypeSafeRerank, resolveTypeSafeConfig, TYPESAFE_SELECTION_VERSION } from './typesafe-reranker.mjs'

export const MAX_REQUEST_BYTES = 8 * 1024

export const API_ERROR_CODES = Object.freeze({
  INVALID_JSON: 'INVALID_JSON',
  REQUEST_TOO_LARGE: 'REQUEST_TOO_LARGE',
  INVALID_BODY: 'INVALID_BODY',
  INVALID_POLICY_ID: 'INVALID_POLICY_ID',
  UNKNOWN_POLICY: 'UNKNOWN_POLICY',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
})

const policies = new Map(samplePolicies.map((policy) => [policy.id, policy]))
const LOCAL_UI_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173'])
const answerRateLimiter = createRateLimiter()

export function getClientKey(request, environment = process.env) {
  if (environment?.POLICYLENS_TRUST_PROXY === 'true') {
    const forwarded = request.headers['x-forwarded-for']
    const firstForwardedAddress = String(Array.isArray(forwarded) ? forwarded[0] : forwarded ?? '')
      .split(',')[0]
      .trim()
    if (firstForwardedAddress) return `proxy:${firstForwardedAddress.slice(0, 128)}`
  }

  const remoteAddress = request.socket?.remoteAddress
  return `direct:${typeof remoteAddress === 'string' && remoteAddress ? remoteAddress.slice(0, 128) : 'unknown'}`
}

function hasProviderConfig(environment) {
  return Boolean(environment?.POLICYLENS_AI_ENDPOINT && environment?.POLICYLENS_AI_API_KEY && environment?.POLICYLENS_AI_MODEL)
}

function attachDevelopmentDiagnostics(response, retrieval, environment, includeDiagnostics, reranking) {
  if (environment?.NODE_ENV !== 'development' || includeDiagnostics !== true) return response

  return {
    ...response,
    diagnostics: {
      queryTerms: retrieval.queryTerms ?? [],
      candidates: (retrieval.candidates ?? []).map((candidate) => ({
        id: candidate.id,
        score: candidate.score,
        matchedTerms: candidate.matchedTerms ?? [],
      })),
      ...(reranking ? { reranking } : {}),
    },
  }
}

function rerankingDiagnostics(retrieval, mode, reranking) {
  const deterministicCandidateId = retrieval.status === 'found' ? retrieval.evidence?.id ?? null : null
  const candidateIds = new Set((retrieval.candidates ?? []).map((candidate) => candidate.id))
  const typesafeCandidateId = reranking?.candidateId ?? null

  return {
    mode,
    deterministicCandidateId,
    typesafeCandidateId,
    candidateSetMembership: Boolean(typesafeCandidateId && candidateIds.has(typesafeCandidateId)),
    confidence: reranking?.confidence ?? null,
    probabilities: reranking?.probabilities ?? {},
    agreement: reranking ? typesafeCandidateId === deterministicCandidateId : null,
    statusAgreement: reranking ? retrieval.status === 'found' : null,
    source: reranking?.source ?? 'none',
    version: reranking?.version ?? 'none',
  }
}

function evidenceStrengthForCandidate(candidate) {
  return candidate?.score >= 2 ? 'strong' : 'partial'
}

function createErrorResult(errorCode, reason, statusCode) {
  const body = createAnswerResponse({
    policy: { id: 'request', sourceUrl: null },
    retrieval: { status: 'error', errorCode, reason },
  })

  return { statusCode, body }
}

export async function answerQuestion(payload, options = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return createErrorResult(API_ERROR_CODES.INVALID_BODY, 'The request body must be a JSON object.', 400)
  }

  if (typeof payload.policyId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(payload.policyId)) {
    return createErrorResult(API_ERROR_CODES.INVALID_POLICY_ID, 'The request must identify a valid policy.', 400)
  }

  const policy = policies.get(payload.policyId)
  if (!policy) {
    return createErrorResult(API_ERROR_CODES.UNKNOWN_POLICY, 'The selected policy is not available.', 404)
  }

  if (typeof payload.question !== 'string') {
    return createErrorResult(API_ERROR_CODES.INVALID_BODY, 'The request must include a question string.', 400)
  }

  const environment = options.environment ?? process.env
  const retrieval = retrieveEvidence(policy, payload.question)
  const typeSafeMode = getTypeSafeMode(environment)
  const typeSafeConfig = resolveTypeSafeConfig(environment)
  const typeSafeResult = retrieval.status === 'found' && typeSafeMode !== 'off'
    ? await requestTypeSafeRerank({
      question: payload.question,
      policyId: policy.id,
      candidates: retrieval.candidates,
      environment,
      fetchImpl: options.typesafeFetchImpl,
      timeoutMs: options.typesafeTimeoutMs,
    })
    : null
  const candidateMap = new Map((retrieval.candidates ?? []).map((candidate) => [candidate.id, candidate]))
  const validTypeSafeResult = typeSafeResult && candidateMap.has(typeSafeResult.candidateId) ? typeSafeResult : null
  const activeSelection = typeSafeMode === 'active'
    && validTypeSafeResult
    && typeSafeConfig
    && validTypeSafeResult.confidence >= typeSafeConfig.minConfidence
    ? candidateMap.get(validTypeSafeResult.candidateId)
    : null
  const retrievalForAnswer = activeSelection
    ? { ...retrieval, evidence: activeSelection, evidenceStrength: evidenceStrengthForCandidate(activeSelection) }
    : retrieval
  const selectionMetadata = {
    evidenceSelection: retrieval.status === 'found' && typeSafeMode === 'shadow' && validTypeSafeResult
      ? 'typesafe-shadow'
      : retrieval.status === 'found' && activeSelection
        ? 'typesafe-active'
        : retrieval.status === 'found' && (typeSafeMode === 'active' || typeSafeMode === 'shadow')
          ? 'deterministic-fallback'
          : 'deterministic',
    evidenceSelectionVersion: validTypeSafeResult ? TYPESAFE_SELECTION_VERSION : 'retrieval-v1',
  }
  const localResponse = createAnswerResponse({ policy, retrieval: retrievalForAnswer, metadata: selectionMetadata })
  const providerCandidates = activeSelection ? [activeSelection] : retrieval.candidates
  const providerAllowed = retrieval.status === 'found'
    && (typeSafeMode === 'off' || (typeSafeMode === 'active' && Boolean(activeSelection)))
  const providerResponse = providerAllowed
    ? await requestProviderAnswer({
      question: payload.question,
      policy,
      candidates: providerCandidates,
      environment,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.providerTimeoutMs,
    })
    : null
  const response = providerResponse ?? {
    ...localResponse,
    ...(providerAllowed && hasProviderConfig(environment)
      ? { providerNotice: 'The AI provider was unavailable, so PolicyLens showed its local grounded explanation instead.' }
      : {}),
  }
  const responseWithDiagnostics = attachDevelopmentDiagnostics(
    { ...response, ...selectionMetadata },
    retrieval,
    environment,
    options.includeDiagnostics,
    typeSafeMode !== 'off' ? rerankingDiagnostics(retrieval, typeSafeMode, validTypeSafeResult) : null,
  )
  const validation = validateAnswerResponse(responseWithDiagnostics)

  if (!validation.valid) {
    return createErrorResult(API_ERROR_CODES.INVALID_RESPONSE, 'The answer service could not produce a safe response.', 500)
  }

  return { statusCode: 200, body: responseWithDiagnostics }
}

export async function readJsonBody(request) {
  const chunks = []
  let totalBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.length
    if (totalBytes > MAX_REQUEST_BYTES) {
      const error = new Error('Request body exceeds the configured limit.')
      error.code = API_ERROR_CODES.REQUEST_TOO_LARGE
      throw error
    }
    chunks.push(buffer)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('Request body is not valid JSON.')
    error.code = API_ERROR_CODES.INVALID_JSON
    throw error
  }
}

function sendJson(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  })
  response.end(statusCode === 204 ? undefined : JSON.stringify(body))
}

function getCorsHeaders(request) {
  const origin = request.headers.origin
  return origin && LOCAL_UI_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' }
    : {}
}

export async function handleAnswerRequest(request, response, options = {}) {
  const corsHeaders = getCorsHeaders(request)
  const environment = options.environment ?? process.env

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null, {
      ...corsHeaders,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    })
    return
  }

  if (request.method !== 'POST') {
    const result = createErrorResult(API_ERROR_CODES.METHOD_NOT_ALLOWED, 'Use POST for answer requests.', 405)
    sendJson(response, result.statusCode, result.body, { ...corsHeaders, Allow: 'POST' })
    return
  }

  const rateLimit = answerRateLimiter.check(getClientKey(request, environment))
  if (!rateLimit.allowed) {
    const result = createErrorResult(API_ERROR_CODES.RATE_LIMITED, 'Too many requests. Try again shortly.', 429)
    sendJson(response, result.statusCode, result.body, { ...corsHeaders, 'Retry-After': String(rateLimit.retryAfterSeconds) })
    return
  }

  const contentType = String(request.headers['content-type'] ?? '').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    const result = createErrorResult(API_ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, 'Send the request as application/json.', 415)
    sendJson(response, result.statusCode, result.body, corsHeaders)
    return
  }

  const declaredLength = Number(request.headers['content-length'])
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    const result = createErrorResult(API_ERROR_CODES.REQUEST_TOO_LARGE, 'The request body is too large.', 413)
    sendJson(response, result.statusCode, result.body, corsHeaders)
    return
  }

  try {
    const result = await answerQuestion(await readJsonBody(request), {
      environment,
      fetchImpl: options.fetchImpl,
      providerTimeoutMs: options.providerTimeoutMs,
      typesafeFetchImpl: options.typesafeFetchImpl,
      typesafeTimeoutMs: options.typesafeTimeoutMs,
      includeDiagnostics: options.includeDiagnostics,
    })
    sendJson(response, result.statusCode, result.body, corsHeaders)
  } catch (error) {
    const errorCode = error?.code === API_ERROR_CODES.REQUEST_TOO_LARGE ? API_ERROR_CODES.REQUEST_TOO_LARGE : API_ERROR_CODES.INVALID_JSON
    const statusCode = errorCode === API_ERROR_CODES.REQUEST_TOO_LARGE ? 413 : 400
    const reason = errorCode === API_ERROR_CODES.REQUEST_TOO_LARGE ? 'The request body is too large.' : 'The request body is not valid JSON.'
    const result = createErrorResult(errorCode, reason, statusCode)
    sendJson(response, result.statusCode, result.body, corsHeaders)
  }
}

