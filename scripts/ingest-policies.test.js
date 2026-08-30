import test from 'node:test'
import assert from 'node:assert/strict'
import { samplePolicies } from '../src/data/policies.js'
import { createProcessedPolicies, normalizeWhitespace, validatePolicies } from './ingest-policies.mjs'

test('normalizes source whitespace without changing content words', () => {
  assert.equal(normalizeWhitespace('  A   policy\n\n passage.  '), 'A policy passage.')
})

test('produces stable document and chunk metadata for the reviewable corpus', () => {
  const processed = createProcessedPolicies(samplePolicies)

  assert.equal(processed.length, 3)
  assert.equal(processed[0].documentId, 'attendance')
  assert.equal(processed[0].chunks[0].chunkId, 'attendance:attendance-window')
  assert.equal(processed[0].chunks[0].documentId, processed[0].documentId)
  assert.equal(processed[0].chunks[0].section, 'Reporting an absence')
  assert.equal(processed[0].chunks[0].text, samplePolicies[0].sections[0].text)
  assert.deepEqual(processed[0].chunks[0].keywords, samplePolicies[0].sections[0].keywords)
  assert.equal(processed[0].chunks[0].answer, samplePolicies[0].sections[0].answer)
  assert.equal(processed[0].chunks[0].nextStep, samplePolicies[0].sections[0].nextStep)
  assert.equal(processed[0].chunks[0].exampleQuestion, samplePolicies[0].sections[0].exampleQuestion)
  assert.equal(processed[0].chunks[0].ordinal, 0)
})

test('rejects duplicate documents and incomplete source metadata', () => {
  const duplicate = structuredClone(samplePolicies)
  duplicate[1].id = duplicate[0].id
  assert.throws(() => validatePolicies(duplicate), /duplicate or missing document id/)

  const incomplete = structuredClone(samplePolicies)
  incomplete[0].title = ''
  incomplete[0].sourceRightsNote = ''
  incomplete[0].sections[0].text = '   '
  assert.throws(() => validatePolicies(incomplete), /missing title.*missing source-rights note.*empty section text/s)
})

test('requires a source URL for non-synthetic documents', () => {
  const externalPolicy = structuredClone(samplePolicies[0])
  externalPolicy.sourceType = 'external'
  externalPolicy.sourceUrl = null

  assert.throws(() => validatePolicies([externalPolicy]), /missing source URL/)
})

