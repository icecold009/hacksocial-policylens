import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveServerConfig } from './runtime-config.mjs'

test('uses local defaults without exposing the development server', () => {
  assert.deepEqual(resolveServerConfig({}), { host: '127.0.0.1', port: 8787 })
  assert.deepEqual(resolveServerConfig({ POLICYLENS_API_PORT: '9000' }), { host: '127.0.0.1', port: 9000 })
})

test('uses the hosting port and external interface when PORT is provided', () => {
  assert.deepEqual(resolveServerConfig({ PORT: '3000' }), { host: '0.0.0.0', port: 3000 })
  assert.deepEqual(resolveServerConfig({ PORT: '3000', POLICYLENS_API_HOST: '127.0.0.1' }), { host: '127.0.0.1', port: 3000 })
})

test('rejects invalid server configuration', () => {
  assert.throws(() => resolveServerConfig({ PORT: '0' }), /POLICYLENS_PORT_INVALID/)
  assert.throws(() => resolveServerConfig({ POLICYLENS_API_HOST: ' ' }), /POLICYLENS_HOST_INVALID/)
})

