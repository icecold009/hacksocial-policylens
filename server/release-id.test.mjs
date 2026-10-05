import test from 'node:test'
import assert from 'node:assert/strict'
import { getReleaseId } from './release-id.mjs'

test('exposes only a bounded release identifier on health responses', () => {
  assert.equal(getReleaseId({ POLICYLENS_RELEASE_ID: 'c429b50' }), 'c429b50')
  assert.equal(getReleaseId({ POLICYLENS_RELEASE_ID: 'release_2026.10' }), 'release_2026.10')
  assert.equal(getReleaseId({ POLICYLENS_RELEASE_ID: 'secret token' }), 'unknown')
  assert.equal(getReleaseId({ POLICYLENS_RELEASE_ID: 'x'.repeat(81) }), 'unknown')
  assert.equal(getReleaseId({}), 'unknown')
})
