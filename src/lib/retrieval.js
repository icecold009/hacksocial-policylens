const STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'an',
  'and',
  'are',
  'be',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'if',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'or',
  'please',
  'should',
  'tell',
  'that',
  'the',
  'this',
  'to',
  'what',
  'when',
  'will',
  'with',
  'you',
  'your',
])

const TERM_ALIASES = new Map([
  ['absent', 'absence'],
  ['absences', 'absence'],
  ['attendance', 'attendance'],
  ['attending', 'attendance'],
  ['accommodations', 'accessibility'],
  ['accommodation', 'accessibility'],
  ['accessible', 'accessibility'],
  ['access', 'accessibility'],
  ['accessibility', 'accessibility'],
  ['classes', 'class'],
  ['classroom', 'accessibility'],
  ['lessons', 'lesson'],
  ['health', 'medical'],
  ['missed', 'miss'],
  ['missing', 'miss'],
  ['notify', 'report'],
  ['notification', 'report'],
  ['parent', 'parent'],
  ['parents', 'parent'],
  ['phones', 'phone'],
  ['smartphone', 'phone'],
  ['smartphones', 'phone'],
  ['students', 'student'],
  ['devices', 'device'],
  ['reviewed', 'review'],
  ['reviewing', 'review'],
  ['using', 'use'],
])

export const MAX_QUESTION_LENGTH = 280
export const RETRIEVAL_ERROR_CODES = Object.freeze({
  INVALID_POLICY: 'INVALID_POLICY',
  EMPTY_QUESTION: 'EMPTY_QUESTION',
  QUESTION_TOO_LONG: 'QUESTION_TOO_LONG',
})

export function normalizeQuery(query) {
  if (typeof query !== 'string') return ''

  return query
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function canonicalizeTerm(term) {
  return TERM_ALIASES.get(term) ?? term
}

function tokenizeText(text, { removeStopWords = true } = {}) {
  return normalizeQuery(text)
    .split(' ')
    .map(canonicalizeTerm)
    .filter((term) => term && (!removeStopWords || !STOP_WORDS.has(term)) && term.length >= 2)
}

export function tokenizeQuery(query) {
  return [...new Set(tokenizeText(query))]
}

function scoreSection(section, queryTerms) {
  const sectionTerms = new Set(section.keywords.flatMap((keyword) => tokenizeText(keyword, { removeStopWords: false })))
  const matchedTerms = queryTerms.filter((term) => sectionTerms.has(term))

  return {
    ...section,
    score: matchedTerms.length,
    matchedTerms,
  }
}

export function retrieveEvidence(policy, query, options = {}) {
  const maxLength = options.maxLength ?? MAX_QUESTION_LENGTH

  if (!policy || !Array.isArray(policy.sections)) {
    return {
      status: 'error',
      errorCode: RETRIEVAL_ERROR_CODES.INVALID_POLICY,
      reason: 'The selected policy could not be searched.',
      candidates: [],
    }
  }

  if (typeof query !== 'string' || !query.trim()) {
    return {
      status: 'error',
      errorCode: RETRIEVAL_ERROR_CODES.EMPTY_QUESTION,
      reason: 'Ask a question before searching the document.',
      candidates: [],
    }
  }

  if (query.length > maxLength) {
    return {
      status: 'error',
      errorCode: RETRIEVAL_ERROR_CODES.QUESTION_TOO_LONG,
      reason: `Questions must be ${maxLength} characters or fewer.`,
      candidates: [],
    }
  }

  const queryTerms = tokenizeQuery(query)
  if (queryTerms.length === 0) {
    return {
      status: 'not_found',
      reason: 'The question did not contain searchable policy terms.',
      candidates: [],
    }
  }

  const candidates = policy.sections
    .map((section) => scoreSection(section, queryTerms))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, 3)

  const [best, second] = candidates
  if (!best || best.score === 0) {
    return {
      status: 'not_found',
      reason: 'No matching passage was found in the selected document.',
      queryTerms,
      candidates,
    }
  }

  const normalizedQuery = normalizeQuery(query)
  const hasMultipleIntents = /\b(and|also|then|after|while)\b/.test(normalizedQuery) || normalizedQuery.includes('what happens')
  const hasCrossSectionDeviceQuestion = queryTerms.includes('class') && queryTerms.includes('accessibility')
  const secondHasUniqueEvidence = second?.matchedTerms.some((term) => !best.matchedTerms.includes(term))

  if (second && second.score > 0 && (best.score === second.score || (secondHasUniqueEvidence && (hasMultipleIntents || hasCrossSectionDeviceQuestion)))) {
    return {
      status: 'needs_review',
      reason: 'More than one passage matches this question. Review the evidence before relying on an answer.',
      queryTerms,
      candidates,
      evidenceStrength: 'partial',
    }
  }

  return {
    status: 'found',
    evidence: best,
    evidenceStrength: best.score >= 2 ? 'strong' : 'partial',
    queryTerms,
    candidates,
  }
}
