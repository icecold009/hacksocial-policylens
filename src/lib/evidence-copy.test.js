import test from 'node:test'
import assert from 'node:assert/strict'
import { formatEvidenceForCopy } from './evidence-copy.js'

test('formats every cited passage with its section and source', () => {
  const result = formatEvidenceForCopy({ title: 'Sample policy', source: 'samples/policy.txt' }, [
    { section: 'First section', quote: 'First supporting passage.', sourceUrl: null },
    { section: 'Second section', quote: 'Second supporting passage.', sourceUrl: 'https://school.example/policy' },
  ])

  assert.match(result, /Passage 1\nSection: First section\nSource: samples\/policy\.txt/)
  assert.match(result, /Passage 2\nSection: Second section\nSource: https:\/\/school\.example\/policy/)
  assert.match(result, /"First supporting passage\."[\s\S]*"Second supporting passage\."/)
})

test('returns an empty string when there is nothing to copy', () => {
  assert.equal(formatEvidenceForCopy({ title: 'Sample' }, []), '')
})
