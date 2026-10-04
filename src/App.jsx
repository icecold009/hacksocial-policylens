import React, { useEffect, useMemo, useRef, useState } from 'react'
import { samplePolicies } from './data/policies.js'
import { createAnswerResponse, validateAnswerResponse } from './lib/answer-contract.js'
import { requestAnswerWithDeadline } from './lib/answer-request.js'
import { formatEvidenceForCopy } from './lib/evidence-copy.js'
import { retrieveEvidence } from './lib/retrieval.js'

const initialQuery = 'What should I do if I will be absent?'

function createDefaultResponse(policy) {
  return createAnswerResponse({
    policy,
    retrieval: {
      status: 'found',
      evidence: policy.sections[0],
      evidenceStrength: 'strong',
    },
  })
}

function createServiceErrorResponse(policy, errorCode, reason) {
  return createAnswerResponse({
    policy,
    retrieval: { status: 'error', errorCode, reason },
  })
}

function getErrorCopy(errorCode, isDevelopment) {
  switch (errorCode) {
    case 'EMPTY_QUESTION':
      return { title: 'Ask a question first.', recovery: 'Write a question about the selected document.' }
    case 'QUESTION_TOO_LONG':
      return { title: 'That question is too long.', recovery: 'Shorten it to 280 characters or fewer, then try again.' }
    case 'RATE_LIMITED':
      return { title: 'The demo rate limit is active.', recovery: 'Submit your question again after the wait.' }
    case 'SERVICE_BUSY':
      return { title: 'The answer service is at capacity.', recovery: 'Wait briefly, then retry your question.' }
    case 'REQUEST_TIMEOUT':
      return { title: 'The search took too long.', recovery: 'The request was stopped so the page could recover. Try again.' }
    case 'REQUEST_CANCELLED':
      return { title: 'Search cancelled.', recovery: 'You can change the question or try again.' }
    case 'API_UNAVAILABLE':
      return {
        title: 'The answer service is unavailable.',
        recovery: isDevelopment
          ? 'Check that the local answer service is running, then try again.'
          : 'Check your connection and retry. The hosted service may be temporarily unavailable.',
      }
    case 'INVALID_RESPONSE':
      return { title: 'The answer could not be verified.', recovery: 'The response was malformed or did not match trusted policy content. Try again.' }
    default:
      return { title: 'I couldn’t answer that yet.', recovery: 'Try a different question or choose another sample.' }
  }
}

function getStatusLabel(status) {
  if (status === 'found') return 'Found in document'
  if (status === 'needs_review') return 'Needs review'
  if (status === 'error') return 'Could not answer'
  return 'Not found'
}

function getRuntimeChip(response) {
  if (response.evidenceSelection === 'typesafe-active') return 'TypeSafe-assisted evidence'
  if (response.evidenceSelection === 'typesafe-shadow') return 'Shadow reranking · local answers'
  if (response.evidenceSelection === 'deterministic-fallback') return 'Deterministic fallback'
  if (response.answerSource === 'provider') return 'Server provider · grounded evidence'
  return 'Deterministic demo · no API keys'
}

function getEvidenceSelectionLabel(selection) {
  if (selection === 'typesafe-active') return 'TYPESAFE-ASSISTED EVIDENCE'
  if (selection === 'typesafe-shadow') return 'LOCAL DETERMINISTIC EVIDENCE · SHADOW CHECK'
  if (selection === 'deterministic-fallback') return 'LOCAL DETERMINISTIC EVIDENCE · RERANKER FALLBACK'
  return 'LOCAL DETERMINISTIC EVIDENCE'
}

const answerApiBaseUrl = import.meta.env.DEV ? 'http://127.0.0.1:8787' : ''

function keepValidResponse(response, policy) {
  try {
    return validateAnswerResponse(response).valid
      ? response
      : createServiceErrorResponse(policy, 'INVALID_RESPONSE', 'The answer service returned an invalid response. Try again.')
  } catch {
    return createServiceErrorResponse(policy, 'INVALID_RESPONSE', 'The answer service returned an invalid response. Try again.')
  }
}

function App() {
  const [selectedId, setSelectedId] = useState(samplePolicies[0].id)
  const [question, setQuestion] = useState(initialQuery)
  const [comparisonId, setComparisonId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasAsked, setHasAsked] = useState(false)
  const [copyState, setCopyState] = useState('idle')
  const [comparisonCopyState, setComparisonCopyState] = useState('idle')
  const [comparisonResult, setComparisonResult] = useState(null)
  const [result, setResult] = useState(() => createDefaultResponse(samplePolicies[0]))
  const requestSequence = useRef(0)
  const activeRequestController = useRef(null)

  function cancelPendingRequest(showNotice = false) {
    requestSequence.current += 1
    activeRequestController.current?.abort()
    activeRequestController.current = null
    setIsLoading(false)
    if (showNotice) {
      const policy = samplePolicies.find((item) => item.id === selectedId) ?? samplePolicies[0]
      setResult(createServiceErrorResponse(policy, 'REQUEST_CANCELLED', 'Search cancelled.'))
      setHasAsked(true)
      setComparisonResult(null)
    }
  }

  useEffect(() => () => {
    requestSequence.current += 1
    activeRequestController.current?.abort()
  }, [])

  const selectedPolicy = useMemo(
    () => samplePolicies.find((policy) => policy.id === selectedId) ?? samplePolicies[0],
    [selectedId],
  )
  const activePolicy = selectedPolicy
  const comparisonPolicy = useMemo(
    () => samplePolicies.find((policy) => policy.id === comparisonId && policy.id !== selectedId) ?? null,
    [comparisonId, selectedId],
  )

  function handlePolicyChange(event) {
    cancelPendingRequest()
    setSelectedId(event.target.value)
    setComparisonId('')
    setHasAsked(false)
    setCopyState('idle')
    setComparisonCopyState('idle')
    setComparisonResult(null)
    const nextPolicy = samplePolicies.find((policy) => policy.id === event.target.value) ?? samplePolicies[0]
    setResult(createDefaultResponse(nextPolicy))
  }

  function handleExampleQuestion(exampleQuestion) {
    cancelPendingRequest()
    setQuestion(exampleQuestion)
    setHasAsked(false)
    setCopyState('idle')
    setComparisonCopyState('idle')
    setComparisonResult(null)
  }

  async function submitQuestion() {
    if (isLoading) return
    setHasAsked(true)
    setCopyState('idle')
    setComparisonCopyState('idle')
    setComparisonResult(null)

    setIsLoading(true)
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    const controller = new AbortController()
    activeRequestController.current = controller

    async function requestAnswer(policy) {
      const request = await requestAnswerWithDeadline({
        apiBaseUrl: answerApiBaseUrl,
        policyId: policy.id,
        question,
        signal: controller.signal,
      })

      if (request.type === 'cancelled') return null
      if (request.type === 'timeout') return createServiceErrorResponse(policy, 'REQUEST_TIMEOUT', 'The answer service did not respond before the request deadline.')
      if (request.type === 'unavailable') return createServiceErrorResponse(policy, 'API_UNAVAILABLE', 'The answer service could not be reached.')
      if (request.type === 'rate_limited') {
        const waitDuration = request.retryAfterSeconds
          ? `${request.retryAfterSeconds} second${request.retryAfterSeconds === 1 ? '' : 's'}`
          : null
        const waitMessage = request.retryAfterSeconds
          ? `Wait ${waitDuration} before retrying.`
          : 'Wait briefly before retrying.'
        return createServiceErrorResponse(policy, 'RATE_LIMITED', waitMessage)
      }
      if (request.type === 'service_busy') {
        const waitDuration = request.retryAfterSeconds
          ? `${request.retryAfterSeconds} second${request.retryAfterSeconds === 1 ? '' : 's'}`
          : null
        const waitMessage = request.retryAfterSeconds
          ? `The service is at capacity. Retry in ${waitDuration}.`
          : 'The service is at capacity. Wait briefly, then retry.'
        return createServiceErrorResponse(policy, 'SERVICE_BUSY', waitMessage)
      }
      if (request.type === 'invalid') return createServiceErrorResponse(policy, 'INVALID_RESPONSE', 'The answer service returned a malformed response.')
      return keepValidResponse(request.payload, policy)
    }

    try {
      const policies = [activePolicy, comparisonPolicy].filter(Boolean)
      const responses = await Promise.all(policies.map(requestAnswer))
      if (requestSequence.current !== requestId || !responses[0]) return
      setResult(responses[0])
      if (responses[1] && comparisonPolicy) {
        setComparisonResult({ policy: comparisonPolicy, response: responses[1] })
      }
    } finally {
      if (requestSequence.current === requestId) {
        activeRequestController.current = null
        setIsLoading(false)
      }
    }
  }

  function handleAsk(event) {
    event.preventDefault()
    void submitQuestion()
  }

  function handleRetry() {
    void submitQuestion()
  }

  function handleCancelRequest() {
    cancelPendingRequest(true)
  }

  async function handleCopyEvidence(policy, evidence, setState) {
    const copyText = formatEvidenceForCopy(policy, evidence)
    if (!copyText) return

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyText)
      setState('copied')
    } catch {
      setState('unavailable')
    }
  }

  return (
    <main className="app-shell">
      <a className="skip-link" href="#workspace">Skip to policy workspace</a>
      <header className="topbar">
        <a className="wordmark" href="#top" aria-label="PolicyLens home">
          <span className="wordmark-mark">P</span>
          <span>PolicyLens</span>
        </a>
        <span className="privacy-chip"><span className="chip-dot" /> {getRuntimeChip(result)}</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="eyebrow-line" /> HACKSOCIAL · AI / ML TRACK</div>
        <h1>Make school policies<br /><em>make sense.</em></h1>
        <p className="hero-copy">Ask a question about a selected sample policy. PolicyLens returns a plain-English answer, points to the passage it used, and says when the document does not contain the answer.</p>
      </section>

      <section className="workspace" id="workspace" aria-label="Policy question workspace">
        <aside className="source-panel panel">
          <div className="panel-label"><span>01</span> CHOOSE A SOURCE</div>
          <label className="field-label" htmlFor="policy-select">Sample policy source</label>
          <select id="policy-select" value={selectedId} onChange={handlePolicyChange} disabled={isLoading}>
            {samplePolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.title}</option>)}
          </select>
          <div className="source-card">
            <div className="file-icon" aria-hidden="true">TXT</div>
            <div>
              <strong>{activePolicy.title}</strong>
              <span>{activePolicy.label}</span>
              <code>{activePolicy.source}</code>
            </div>
          </div>
          <div className="source-details" aria-label="Source metadata">
            <span>{activePolicy.organization}</span>
            <span>{activePolicy.sourceType === 'synthetic' ? 'Synthetic source' : 'External URL'}</span>
            <span>{activePolicy.publicationDate ? `Updated ${activePolicy.publicationDate}` : 'Date not provided'}</span>
          </div>
          <p className="source-summary">{activePolicy.summary}</p>
          <p className="source-rights">{activePolicy.sourceRightsNote}</p>
          <div className="divider" />
          <div className="boundary-note" role="note">
            <span className="boundary-note-label">DEMO BOUNDARY</span>
            <p>External policy import is not enabled in this demo. Use the curated synthetic sources above; arbitrary URLs are not fetched.</p>
          </div>
        </aside>

        <div className="query-column">
          <div className="panel-label"><span>02</span> ASK A QUESTION</div>
          <form className="question-form" onSubmit={handleAsk}>
            <label className="sr-only" htmlFor="question">Ask about the selected policy</label>
            <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} rows="3" maxLength="280" disabled={isLoading} aria-describedby="question-count" placeholder="e.g. What happens if I miss school?" />
            <div className="question-footer">
              <span className="character-count" id="question-count">{question.length} / 280</span>
              <div className="request-actions">
                {isLoading && <button className="cancel-button" type="button" onClick={handleCancelRequest}>Cancel search</button>}
                <button className="ask-button" type="submit" disabled={isLoading} aria-busy={isLoading}>{isLoading ? 'Searching evidence…' : 'Find the answer'} <span aria-hidden="true">→</span></button>
              </div>
            </div>
            {activePolicy.sections.length > 0 && <div className="example-questions" aria-label="Example questions">
              <span>TRY AN EXAMPLE</span>
              <div>
                {activePolicy.sections.slice(0, 3).map((section) => <button key={section.id} type="button" onClick={() => handleExampleQuestion(section.exampleQuestion)} disabled={isLoading}>{section.exampleQuestion}</button>)}
              </div>
            </div>}
          </form>

          <div className="compare-control">
            <button className="compare-toggle" type="button" onClick={() => { setComparisonId(comparisonId ? '' : samplePolicies.find((policy) => policy.id !== selectedId)?.id ?? '') }} aria-expanded={Boolean(comparisonId)} aria-controls="compare-panel" disabled={isLoading}>
              {comparisonId ? 'Hide policy comparison' : 'Compare with another sample policy'} <span aria-hidden="true">{comparisonId ? '−' : '+'}</span>
            </button>
            {comparisonId && <div className="compare-panel" id="compare-panel">
              <label className="field-label" htmlFor="compare-select">Second policy</label>
              <select id="compare-select" value={comparisonId} onChange={(event) => { setComparisonId(event.target.value); setComparisonResult(null) }} disabled={isLoading}>
                {samplePolicies.filter((policy) => policy.id !== selectedId).map((policy) => <option key={policy.id} value={policy.id}>{policy.title}</option>)}
              </select>
              <p>Ask once to see how both documents address the same question.</p>
            </div>}
          </div>

          <section className="pipeline-strip" aria-label="How PolicyLens answers">
            <span className="pipeline-label">TRUST LOOP</span>
            <ol>
              <li><strong>Retrieve</strong><span>Search the selected source.</span></li>
              <li><strong>Check</strong><span>Validate the evidence boundary.</span></li>
              <li><strong>Cite</strong><span>Show the exact supporting passage.</span></li>
            </ol>
          </section>

          <section className="answer-panel panel" aria-live="polite" aria-atomic="true" aria-busy={isLoading}>
            <div className="answer-header">
              <div className="panel-label"><span>03</span> GROUNDED RESPONSE</div>
              <span className={`status-pill status-${hasAsked ? result.status : 'ready'}`}>
                <span className="status-dot" /> {!hasAsked ? 'Ready to search' : result.status === 'found' ? 'Found in document' : result.status === 'needs_review' ? 'Needs review' : result.status === 'error' ? 'Could not answer' : 'Not found'}
              </span>
            </div>
            {isLoading ? (
              <div className="loading-content" role="status">
                <div className="loading-icon" aria-hidden="true">⌁</div>
                <h2>Searching the selected policy…</h2>
                <p>Matching evidence first, then checking the answer contract before anything is shown.</p>
              </div>
            ) : !hasAsked ? (
              <div className="empty-content" role="status">
                <div className="empty-icon" aria-hidden="true">?</div>
                <h2>Ask a question to see the evidence.</h2>
                <p>Choose a sample question or write your own. PolicyLens will search only the selected document before showing an answer.</p>
              </div>
            ) : result.status === 'found' ? (
              <div className="answer-content">
                <div className="answer-mode">{getEvidenceSelectionLabel(result.evidenceSelection)} · {result.answerSource === 'provider' ? 'AI-GENERATED EXPLANATION' : 'LOCAL GROUNDED EXPLANATION'} · {result.evidenceStrength.toUpperCase()} EVIDENCE</div>
                {result.providerNotice && <p className="provider-notice" role="status">{result.providerNotice}</p>}
                <h2>{result.answer}</h2>
                <details className="evidence-block" open>
                  <summary className="evidence-heading"><span className="quote-mark" aria-hidden="true">“</span><span>SUPPORTING EVIDENCE · {result.evidence.length}</span></summary>
                  <div className="evidence-list">
                    {result.evidence.map((item, index) => (
                      <div className="evidence-passage" key={`${item.documentId}-${item.section}-${index}`}>
                        <blockquote>{item.quote}</blockquote>
                        <div className="evidence-meta"><span>{item.sourceUrl || activePolicy.source}</span><span>§ {item.section}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="evidence-actions">
                    <button className="copy-button" type="button" onClick={() => handleCopyEvidence(activePolicy, result.evidence, setCopyState)}>
                      {copyState === 'copied' ? 'All evidence copied' : 'Copy all evidence'} <span aria-hidden="true">↗</span>
                    </button>
                    {copyState === 'unavailable' && <span className="copy-status" role="status">Clipboard access is unavailable here.</span>}
                  </div>
                </details>
                <details className="why-answer">
                  <summary>Why this answer?</summary>
                  <p>{result.answerSource === 'provider' ? 'The provider response was accepted only when its answer, next step, and citation matched the trusted response data for the selected passage. Any other output falls back to the local answer.' : 'The local fallback selected the strongest matching passage from this document. PolicyLens shows the exact evidence instead of inventing details outside the source.'}</p>
                </details>
                {result.nextStep && <p className="next-step"><strong>Grounded next step:</strong> {result.nextStep}</p>}
                {activePolicy.sections.filter((section) => section.heading !== result.evidence[0].section).slice(0, 2).length > 0 && <div className="follow-up-questions" aria-label="Suggested follow-up questions">
                  <span>KEEP EXPLORING</span>
                  <div>
                    {activePolicy.sections.filter((section) => section.heading !== result.evidence[0].section).slice(0, 2).map((section) => (
                      <button key={section.id} type="button" onClick={() => handleExampleQuestion(section.exampleQuestion)}>
                        {section.exampleQuestion} <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                </div>}
              </div>
            ) : result.status === 'needs_review' ? (
              <div className="not-found-content">
                <div className="not-found-icon" aria-hidden="true">!</div>
                <h2>There is more than one possible passage.</h2>
                <p>{result.nextStep}</p>
                <div className="candidate-list">
                  {result.evidence.map((candidate, index) => (
                    <div className="evidence-passage" key={`${candidate.documentId}-${candidate.section}-${index}`}>
                      <blockquote>{candidate.quote}</blockquote>
                      <div className="evidence-meta"><span>{candidate.sourceUrl || activePolicy.source}</span><span>§ {candidate.section}</span></div>
                    </div>
                  ))}
                </div>
                <div className="evidence-actions">
                  <button className="copy-button" type="button" onClick={() => handleCopyEvidence(activePolicy, result.evidence, setCopyState)}>
                    {copyState === 'copied' ? 'All evidence copied' : 'Copy all evidence'} <span aria-hidden="true">↗</span>
                  </button>
                  {copyState === 'unavailable' && <span className="copy-status" role="status">Clipboard access is unavailable here.</span>}
                </div>
                <div className="not-found-contract"><span>REVIEW CONTRACT</span> PolicyLens will not silently choose between equally matched passages.</div>
              </div>
            ) : (
              <div className="not-found-content">
                <div className="not-found-icon" aria-hidden="true">?</div>
                <h2>{result.status === 'error' ? getErrorCopy(result.errorCode, import.meta.env.DEV).title : 'I couldn’t find that in this document.'}</h2>
                <p>{result.nextStep} {result.status === 'error' ? getErrorCopy(result.errorCode, import.meta.env.DEV).recovery : 'Try a different question or choose another sample.'}</p>
                <div className="not-found-contract"><span>NOT-FOUND CONTRACT</span> No unsupported answer is presented as fact.</div>
                {result.status === 'error' && <div className="evidence-actions"><button className="retry-button" type="button" onClick={handleRetry}>Try again</button></div>}
              </div>
            )}
          </section>
          {comparisonResult && <section className="comparison-panel panel" aria-label="Policy comparison">
            <div className="panel-label"><span>04</span> SAME QUESTION, SECOND SOURCE</div>
            <div className="comparison-content">
              <div className="comparison-heading">
                <h2>{comparisonResult.policy.title}</h2>
                <span className={`comparison-status status-${comparisonResult.response.status}`}><span className="status-dot" /> {getStatusLabel(comparisonResult.response.status)}</span>
              </div>
              {comparisonResult.response.status === 'found' ? <>
                <p className="comparison-answer">{comparisonResult.response.answer}</p>
                <div className="evidence-list">
                  {comparisonResult.response.evidence.map((item, index) => (
                    <div className="evidence-passage" key={`${item.documentId}-${item.section}-${index}`}>
                      <blockquote>{item.quote}</blockquote>
                      <div className="evidence-meta"><span>{item.sourceUrl || comparisonResult.policy.source}</span><span>§ {item.section}</span></div>
                    </div>
                  ))}
                </div>
                <div className="evidence-actions">
                  <button className="copy-button" type="button" onClick={() => handleCopyEvidence(comparisonResult.policy, comparisonResult.response.evidence, setComparisonCopyState)}>
                    {comparisonCopyState === 'copied' ? 'All evidence copied' : 'Copy all evidence'} <span aria-hidden="true">↗</span>
                  </button>
                  {comparisonCopyState === 'unavailable' && <span className="copy-status" role="status">Clipboard access is unavailable here.</span>}
                </div>
              </> : <p className="comparison-empty">{comparisonResult.response.nextStep || 'This document does not provide a supported answer to that question.'}</p>}
            </div>
          </section>}
          <p className="disclaimer">{result.disclaimer}</p>
        </div>
      </section>

      <footer className="footer">
        <span>POLICYLENS <span className="footer-muted">/</span> HACKSOCIAL MVP</span>
        <span>Evidence first <span className="footer-muted">·</span> Privacy conscious <span className="footer-muted">·</span> Student friendly</span>
      </footer>
    </main>
  )
}

export default App


