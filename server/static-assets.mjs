import { extname, resolve, sep } from 'node:path'

export const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'",
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
})

const CONTENT_TYPES = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
})

export function getContentType(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export function resolveStaticPath(distRoot, requestPath) {
  let decodedPath
  try {
    decodedPath = decodeURIComponent(requestPath)
  } catch {
    return { kind: 'bad_request' }
  }

  const relativePath = decodedPath === '/' ? '/index.html' : decodedPath
  const candidate = resolve(distRoot, `.${relativePath}`)
  const normalizedRoot = resolve(distRoot)
  if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${sep}`)) return { kind: 'forbidden' }

  return {
    kind: 'file',
    path: candidate,
    contentType: getContentType(candidate),
    hasExtension: Boolean(extname(decodedPath)),
  }
}

