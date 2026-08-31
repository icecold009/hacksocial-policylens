import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../data/policies.js'
import { createAnswerResponse, validateAnswerResponse } from './answer-contract.js'
import { retrieveEvidence } from './retrieval.js'

const attendance = samplePolicies.find((policy) => policy.id === 'attendance')

test('builds a valid found response with exact citation evidence', () => {
  const response = createAnswerResponse({
    policy: attendance,
    retrieval: retrieveEvidence(attendance, 'How do I report an absence?'),
  })

  assert.equal(response.status, 'found')
  assert.equal(response.evidence.length, 1)
  assert.equal(response.evidence[0].documentId, 'attendance')
  assert.equal(response.evidence[0].section, 'Reporting an absence')
  assert.equal(validateAnswerResponse(response).valid, true)
})

test('allows an honest not-found response without evidence', () => {
  const response = createAnswerResponse({
    policy: attendance,
    retrieval: retrieveEvidence(attendance, 'Can I wear blue shoes?'),
  })

  assert.equal(response.status, 'not_found')
  assert.equal(response.evidence.length, 0)
  assert.equal(validateAnswerResponse(response).valid, true)
})

test('rejects a found response that has no evidence', () => {
  const validation = validateAnswerResponse({
    status: 'found',
    answer: 'Unsupported answer',
    evidence: [],
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /at least one evidence item/)
})

test('rejects a found response with an empty explanation', () => {
  const validation = validateAnswerResponse({
    status: 'found',
    answer: '   ',
    evidence: [{ documentId: 'attendance', section: 'Reporting an absence', quote: 'Notify the school.', sourceUrl: null }],
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /non-empty answer/)
})

test('rejects an empty provider notice', () => {
  const validation = validateAnswerResponse({
    status: 'not_found',
    answer: '',
    evidence: [],
    evidenceStrength: 'weak',
    nextStep: 'Try another question.',
    disclaimer: 'Test disclaimer',
    providerNotice: '  ',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /providerNotice/)
})

test('rejects malformed development diagnostics', () => {
  const validation = validateAnswerResponse({
    status: 'not_found',
    answer: '',
    evidence: [],
    evidenceStrength: 'weak',
    nextStep: 'Try another question.',
    disclaimer: 'Test disclaimer',
    diagnostics: { queryTerms: ['question'], candidates: [{ id: 'attendance-window', score: 1, matchedTerms: [7] }] },
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /diagnostics\.candidates/)
})

test('rejects malformed evidence without throwing', () => {
  const validation = validateAnswerResponse({
    status: 'found',
    answer: 'Malformed response',
    evidence: null,
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /evidence must be an array/)
})

test('rejects evidence on not-found responses', () => {
  const validation = validateAnswerResponse({
    status: 'not_found',
    answer: '',
    evidence: [{ documentId: 'attendance', section: 'Reporting an absence', quote: 'Notify the school.', sourceUrl: null }],
    evidenceStrength: 'weak',
    nextStep: 'Try another question.',
    disclaimer: 'Test disclaimer',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /must not contain evidence/)
})

test('rejects oversized answer contract fields', () => {
  const validation = validateAnswerResponse({
    status: 'found',
    answer: 'a'.repeat(2_001),
    evidence: [{ documentId: 'attendance', section: 'Reporting an absence', quote: 'Notify the school.', sourceUrl: null }],
    evidenceStrength: 'strong',
    nextStep: '',
    disclaimer: 'Test disclaimer',
  })

  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /answer must be a string/)
})

