import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const uiArguments = [viteEntry, ...process.argv.slice(2)]
const developmentEnvironment = { ...process.env, NODE_ENV: 'development' }
const children = [
  spawn(process.execPath, ['server/index.mjs'], { env: developmentEnvironment, stdio: 'inherit' }),
  spawn(process.execPath, uiArguments, { env: developmentEnvironment, stdio: 'inherit' }),
]

let shuttingDown = false

function shutdown(exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  children.forEach((child) => child.kill())
  setTimeout(() => process.exit(exitCode), 100)
}

children.forEach((child) => {
  child.on('exit', (code) => {
    if (!shuttingDown && code !== 0) shutdown(code ?? 1)
  })
})

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
