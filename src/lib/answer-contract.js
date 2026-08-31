export const ANSWER_STATUSES = ['found', 'not_found', 'needs_review', 'error']
export const EVIDENCE_STRENGTHS = ['strong', 'partial', 'weak']
export const ANSWER_LIMITS = Object.freeze({
  answer: 2_000,
  nextStep: 1_000,
  disclaimer: 500,
  providerNotice: 500,
  evidenceItems: 3,
  documentId: 64,
  section: 200,
  quote: 4_000,
  sourceUrl: 2_048,
  diagnosticTerms: 64,
  diagnosticCandidates: 3,
})

const DISCLAIMER = 'PolicyLens is an explainer, not a substitute for your school’s official guidance. Confirm important decisions with the school.'

function toEvidenceItem(policy, section) {
  return {
    documentId: policy.id,
    section: section.heading,
    quote: section.text,
    sourceUrl: policy.sourceUrl ?? null,
  }
}

export function createAnswerResponse({ policy, retrieval }) {
  if (!retrieval || !policy) {
    return {
      status: 'error',
      answerSource: 'local',
      answer: '',
      evidence: [],
      evidenceStrength: 'weak',
      nextStep: 'Reload the selected policy and try again.',
      disclaimer: DISCLAIMER,
      errorCode: 'INVALID_ANSWER_INPUT',
    }
  }

  if (retrieval.status === 'found') {
    return {
      status: 'found',
      answerSource: 'local',
      answer: retrieval.evidence.answer,
      evidence: [toEvidenceItem(policy, retrieval.evidence)],
      evidenceStrength: retrieval.evidenceStrength,
      nextStep: retrieval.evidence.nextStep ?? '',
      disclaimer: DISCLAIMER,
    }
  }

  if (retrieval.status === 'needs_review') {
    return {
      status: 'needs_review',
      answerSource: 'local',
      answer: 'I found more than one possible passage. Review the evidence before relying on an answer.',
      evidence: retrieval.candidates.map((candidate) => toEvidenceItem(policy, candidate)),
      evidenceStrength: 'partial',
      nextStep: retrieval.reason,
      disclaimer: DISCLAIMER,
    }
  }

  return {
    status: retrieval.status,
    answerSource: 'local',
    answer: '',
    evidence: [],
    evidenceStrength: 'weak',
    nextStep: retrieval.reason ?? 'No grounded answer is available.',
    disclaimer: DISCLAIMER,
    ...(retrieval.errorCode ? { errorCode: retrieval.errorCode } : {}),
  }
}

export function validateAnswerResponse(response) {
  const errors = []

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return { valid: false, errors: ['Response must be an object.'] }
  }

  if (!ANSWER_STATUSES.includes(response.status)) {
    errors.push('status must be one of found, not_found, needs_review, or error.')
  }

  if (response.answerSource !== undefined && !['local', 'provider'].includes(response.answerSource)) {
    errors.push('answerSource must be local or provider when present.')
  }
  if (response.providerNotice !== undefined && (typeof response.providerNotice !== 'string' || !response.providerNotice.trim() || response.providerNotice.length > ANSWER_LIMITS.providerNotice)) {
    errors.push('providerNotice must be a non-empty string when present.')
  }
  if (response.diagnostics !== undefined) {
    if (!response.diagnostics || typeof response.diagnostics !== 'object' || Array.isArray(response.diagnostics)) {
      errors.push('diagnostics must be an object when present.')
    } else {
      if (!Array.isArray(response.diagnostics.queryTerms) || response.diagnostics.queryTerms.length > ANSWER_LIMITS.diagnosticTerms || response.diagnostics.queryTerms.some((term) => typeof term !== 'string' || term.length > ANSWER_LIMITS.section)) {
        errors.push('diagnostics.queryTerms must be an array of strings.')
      }
      if (!Array.isArray(response.diagnostics.candidates) || response.diagnostics.candidates.length > ANSWER_LIMITS.diagnosticCandidates) {
        errors.push('diagnostics.candidates must be an array.')
      } else {
        response.diagnostics.candidates.forEach((candidate, index) => {
          if (!candidate || typeof candidate !== 'object' || typeof candidate.id !== 'string' || candidate.id.length > ANSWER_LIMITS.documentId || typeof candidate.score !== 'number' || !Number.isFinite(candidate.score) || !Array.isArray(candidate.matchedTerms) || candidate.matchedTerms.length > ANSWER_LIMITS.diagnosticTerms || candidate.matchedTerms.some((term) => typeof term !== 'string' || term.length > ANSWER_LIMITS.section)) {
            errors.push(`diagnostics.candidates[${index}] is malformed.`)
          }
        })
      }
    }
  }

  if (typeof response.answer !== 'string' || response.answer.length > ANSWER_LIMITS.answer) {
    errors.push('answer must be a string.')
  }
  if (response.status === 'found' && typeof response.answer === 'string' && !response.answer.trim()) {
    errors.push('found responses require a non-empty answer.')
  }

  if (!Array.isArray(response.evidence)) {
    errors.push('evidence must be an array.')
  } else {
    if (response.evidence.length > ANSWER_LIMITS.evidenceItems) errors.push(`evidence must contain at most ${ANSWER_LIMITS.evidenceItems} items.`)
    response.evidence.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        errors.push(`evidence[${index}] must be an object.`)
        return
      }
      if (typeof item.documentId !== 'string' || !item.documentId.trim() || item.documentId.length > ANSWER_LIMITS.documentId) errors.push(`evidence[${index}].documentId is required.`)
      if (typeof item.section !== 'string' || !item.section.trim() || item.section.length > ANSWER_LIMITS.section) errors.push(`evidence[${index}].section is required.`)
      if (typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > ANSWER_LIMITS.quote) errors.push(`evidence[${index}].quote is required.`)
      if (item.sourceUrl !== null && (typeof item.sourceUrl !== 'string' || item.sourceUrl.length > ANSWER_LIMITS.sourceUrl)) errors.push(`evidence[${index}].sourceUrl must be a string or null.`)
    })
  }

  if (response.status === 'found' && Array.isArray(response.evidence) && response.evidence.length === 0) {
    errors.push('found responses require at least one evidence item.')
  }
  if ((response.status === 'not_found' || response.status === 'error') && Array.isArray(response.evidence) && response.evidence.length > 0) {
    errors.push(`${response.status} responses must not contain evidence.`)
  }
  if (response.status === 'needs_review' && Array.isArray(response.evidence) && response.evidence.length === 0) {
    errors.push('needs_review responses require evidence candidates.')
  }

  if (!EVIDENCE_STRENGTHS.includes(response.evidenceStrength)) {
    errors.push('evidenceStrength must be strong, partial, or weak.')
  }

  if (typeof response.nextStep !== 'string' || response.nextStep.length > ANSWER_LIMITS.nextStep) errors.push('nextStep must be a string.')
  if (typeof response.disclaimer !== 'string' || !response.disclaimer.trim() || response.disclaimer.length > ANSWER_LIMITS.disclaimer) errors.push('disclaimer is required.')

  return { valid: errors.length === 0, errors }
}

