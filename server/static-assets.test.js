import test from 'node:test'
import assert from 'node:assert/strict'
import { getContentType, resolveStaticPath } from './static-assets.mjs'

const distRoot = 'C:\\project\\dist'

test('resolves the root request to the built index', () => {
  const result = resolveStaticPath(distRoot, '/')

  assert.equal(result.kind, 'file')
  assert.equal(result.path.endsWith('dist\\index.html'), true)
  assert.equal(result.contentType, 'text/html; charset=utf-8')
})

test('rejects encoded traversal outside the build directory', () => {
  assert.equal(resolveStaticPath(distRoot, '/%2e%2e/package.json').kind, 'forbidden')
})

test('reports malformed URL encoding without exposing filesystem details', () => {
  assert.deepEqual(resolveStaticPath(distRoot, '/%not-valid'), { kind: 'bad_request' })
})

test('derives content types from the final asset path', () => {
  assert.equal(getContentType('C:\\project\\dist\\assets\\index.js'), 'text/javascript; charset=utf-8')
  assert.equal(getContentType('C:\\project\\dist\\unknown.bin'), 'application/octet-stream')
})

