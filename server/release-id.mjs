const SAFE_RELEASE_ID = /^[A-Za-z0-9._-]{1,80}$/

export function getReleaseId(environment = process.env) {
  const value = environment?.POLICYLENS_RELEASE_ID
  return typeof value === 'string' && SAFE_RELEASE_ID.test(value) ? value : 'unknown'
}
