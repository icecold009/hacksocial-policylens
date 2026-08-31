export const DEFAULT_PORT = 8787
export const DEFAULT_HOST = '127.0.0.1'

function readPort(environment) {
  const configuredPort = environment.PORT ?? environment.POLICYLENS_API_PORT ?? DEFAULT_PORT
  const port = Number(configuredPort)

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('POLICYLENS_PORT_INVALID')
  }

  return port
}

export function resolveServerConfig(environment = process.env) {
  const host = environment.POLICYLENS_API_HOST
    ?? environment.HOST
    ?? (environment.PORT ? '0.0.0.0' : DEFAULT_HOST)

  if (typeof host !== 'string' || !host.trim() || host.length > 255) {
    throw new Error('POLICYLENS_HOST_INVALID')
  }

  return { host: host.trim(), port: readPort(environment) }
}

