import React, { useMemo, useState } from 'react'
import { samplePolicies } from './data/policies.js'
import { createAnswerResponse, validateAnswerResponse } from './lib/answer-contract.js'
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

function getErrorCopy(errorCode) {
  switch (errorCode) {
    case 'EMPTY_QUESTION':
      return { title: 'Ask a question first.', recovery: 'Write a question about the selected document.' }
    case 'QUESTION_TOO_LONG':
      return { title: 'That question is too long.', recovery: 'Shorten it to 280 characters or fewer, then try again.' }
    case 'RATE_LIMITED':
      return { title: 'The demo rate limit is active.', recovery: 'Wait briefly before trying another question.' }
    case 'API_UNAVAILABLE':
      return { title: 'The answer service is unavailable.', recovery: 'Start the local API and try again.' }
    case 'INVALID_RESPONSE':
      return { title: 'The answer could not be verified.', recovery: 'Try again; unsupported or malformed answers are never rendered.' }
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
  const [publicUrl, setPublicUrl] = useState('')
  const [customSource, setCustomSource] = useState(null)
  const [comparisonId, setComparisonId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasAsked, setHasAsked] = useState(false)
  const [copyState, setCopyState] = useState('idle')
  const [comparisonResult, setComparisonResult] = useState(null)
  const [result, setResult] = useState(() => createDefaultResponse(samplePolicies[0]))

  const selectedPolicy = useMemo(
    () => samplePolicies.find((policy) => policy.id === selectedId) ?? samplePolicies[0],
    [selectedId],
  )
  const activePolicy = customSource ?? selectedPolicy
  const comparisonPolicy = useMemo(
    () => samplePolicies.find((policy) => policy.id === comparisonId && policy.id !== selectedId) ?? null,
    [comparisonId, selectedId],
  )

  function handlePolicyChange(event) {
    setSelectedId(event.target.value)
    setCustomSource(null)
    setComparisonId('')
    setHasAsked(false)
    setCopyState('idle')
    setComparisonResult(null)
    const nextPolicy = samplePolicies.find((policy) => policy.id === event.target.value) ?? samplePolicies[0]
    setResult(createDefaultResponse(nextPolicy))
  }

  function handleUsePublicUrl(event) {
    event.preventDefault()
    const trimmedUrl = publicUrl.trim()
    if (!trimmedUrl) return

    setCustomSource({
      id: 'public-policy-url',
      title: 'Public policy link',
      label: 'External source · fetch not enabled in this local demo',
      organization: 'External source',
      sourceType: 'external',
      source: trimmedUrl,
      sourceUrl: trimmedUrl,
      summary: 'The URL is shown as the selected source, but the starter does not transmit or fetch it yet.',
      sourceRightsNote: 'External fetching is disabled in this local demo.',
      sections: [],
    })
    setComparisonId('')
    setHasAsked(true)
    setCopyState('idle')
    setComparisonResult(null)
    setResult(createAnswerResponse({
      policy: { id: 'public-policy-url', sourceUrl: trimmedUrl },
      retrieval: { status: 'not_found', reason: 'This local starter does not fetch external documents yet.' },
    }))
  }

  function handleResetSource() {
    setCustomSource(null)
    setPublicUrl('')
    setComparisonId('')
    setHasAsked(false)
    setCopyState('idle')
    setComparisonResult(null)
    setResult(createDefaultResponse(selectedPolicy))
  }

  function handleExampleQuestion(exampleQuestion) {
    setQuestion(exampleQuestion)
    setHasAsked(false)
    setCopyState('idle')
    setComparisonResult(null)
  }

  async function handleAsk(event) {
    event.preventDefault()
    setHasAsked(true)
    setCopyState('idle')
    setComparisonResult(null)

    if (activePolicy.sourceType === 'external') {
      setResult(createAnswerResponse({
        policy: activePolicy,
        retrieval: { status: 'not_found', reason: 'This local starter does not fetch external documents yet.' },
      }))
      return
    }

    setIsLoading(true)

    async function requestAnswer(policy) {
      try {
        const response = await fetch(`${answerApiBaseUrl}/api/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policyId: policy.id, question }),
        })
        const payload = await response.json()
        return keepValidResponse(payload, policy)
      } catch {
        return createServiceErrorResponse(policy, 'API_UNAVAILABLE', 'The local answer service is unavailable. Try again in a moment.')
      }
    }

    try {
      const policies = [activePolicy, comparisonPolicy].filter(Boolean)
      const responses = await Promise.all(policies.map(requestAnswer))
      setResult(responses[0])
      if (responses[1] && comparisonPolicy) {
        setComparisonResult({ policy: comparisonPolicy, response: responses[1] })
      }
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyEvidence() {
    const evidence = result.evidence[0]
    if (!evidence) return

    const copyText = [
      `PolicyLens evidence: ${activePolicy.title}`,
      `Section: ${evidence.section}`,
      `Source: ${activePolicy.source}`,
      `\"${evidence.quote}\"`,
    ].join('\n')

    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(copyText)
      setCopyState('copied')
    } catch {
      setCopyState('unavailable')
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
        <span className="privacy-chip"><span className="chip-dot" /> Local demo · no API keys</span>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="eyebrow-line" /> HACKSOCIAL · AI / ML TRACK</div>
        <h1>Make school policies<br /><em>make sense.</em></h1>
        <p className="hero-copy">Ask a question about a public or sample policy. PolicyLens returns a plain-English answer, points to the passage it used, and says when the document does not contain the answer.</p>
      </section>

      <section className="workspace" id="workspace" aria-label="Policy question workspace">
        <aside className="source-panel panel">
          <div className="panel-label"><span>01</span> CHOOSE A SOURCE</div>
          <label className="field-label" htmlFor="policy-select">Sample policy document</label>
          <select id="policy-select" value={selectedId} onChange={handlePolicyChange}>
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
          {customSource && <button className="source-reset" type="button" onClick={handleResetSource}>Back to sample policies <span aria-hidden="true">↩</span></button>}
          <div className="source-details" aria-label="Source metadata">
            <span>{activePolicy.organization}</span>
            <span>{activePolicy.sourceType === 'synthetic' ? 'Synthetic source' : 'External URL'}</span>
            <span>{activePolicy.publicationDate ? `Updated ${activePolicy.publicationDate}` : 'Date not provided'}</span>
          </div>
          <p className="source-summary">{activePolicy.summary}</p>
          <p className="source-rights">{activePolicy.sourceRightsNote}</p>
          <div className="divider" />
          <form className="url-form" onSubmit={handleUsePublicUrl}>
            <label className="field-label" htmlFor="public-url">Or provide a public policy URL</label>
            <input id="public-url" type="url" value={publicUrl} onChange={(event) => setPublicUrl(event.target.value)} placeholder="https://school.example/policy.pdf" />
            <button className="secondary-button" type="submit">Use public URL <span aria-hidden="true">↗</span></button>
          </form>
          <p className="privacy-note"><span aria-hidden="true">↳</span> This MVP keeps the demo local. External documents are not fetched yet.</p>
        </aside>

        <div className="query-column">
          <div className="panel-label"><span>02</span> ASK A QUESTION</div>
          <form className="question-form" onSubmit={handleAsk}>
            <label className="sr-only" htmlFor="question">Ask about the selected policy</label>
            <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} rows="3" maxLength="280" disabled={isLoading} aria-describedby="question-count" placeholder="e.g. What happens if I miss school?" />
            <div className="question-footer">
              <span className="character-count" id="question-count">{question.length} / 280</span>
              <button className="ask-button" type="submit" disabled={isLoading} aria-busy={isLoading}>{isLoading ? 'Searching evidence…' : 'Find the answer'} <span aria-hidden="true">→</span></button>
            </div>
            {activePolicy.sections.length > 0 && <div className="example-questions" aria-label="Example questions">
              <span>TRY AN EXAMPLE</span>
              <div>
                {activePolicy.sections.slice(0, 3).map((section) => <button key={section.id} type="button" onClick={() => handleExampleQuestion(section.exampleQuestion)} disabled={isLoading}>{section.exampleQuestion}</button>)}
              </div>
            </div>}
          </form>

          {!customSource && <div className="compare-control">
            <button className="compare-toggle" type="button" onClick={() => { setComparisonId(comparisonId ? '' : samplePolicies.find((policy) => policy.id !== selectedId)?.id ?? '') }} aria-expanded={Boolean(comparisonId)} aria-controls="compare-panel">
              {comparisonId ? 'Hide policy comparison' : 'Compare with another sample policy'} <span aria-hidden="true">{comparisonId ? '−' : '+'}</span>
            </button>
            {comparisonId && <div className="compare-panel" id="compare-panel">
              <label className="field-label" htmlFor="compare-select">Second policy</label>
              <select id="compare-select" value={comparisonId} onChange={(event) => { setComparisonId(event.target.value); setComparisonResult(null) }}>
                {samplePolicies.filter((policy) => policy.id !== selectedId).map((policy) => <option key={policy.id} value={policy.id}>{policy.title}</option>)}
              </select>
              <p>Ask once to see how both documents address the same question.</p>
            </div>}
          </div>}

          <section className="pipeline-strip" aria-label="How PolicyLens answers">
            <span className="pipeline-label">TRUST LOOP</span>
            <ol>
              <li><strong>Retrieve</strong><span>Search the selected source.</span></li>
              <li><strong>Check</strong><span>Validate the evidence boundary.</span></li>
              <li><strong>Cite</strong><span>Show the exact supporting passage.</span></li>
            </ol>
          </section>

          <section className="answer-panel panel" aria-live="polite" aria-atomic="true">
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
                <div className="answer-mode">{result.answerSource === 'provider' ? 'AI-GENERATED EXPLANATION' : 'LOCAL GROUNDED EXPLANATION'} · {result.evidenceStrength.toUpperCase()} EVIDENCE</div>
                {result.providerNotice && <p className="provider-notice" role="status">{result.providerNotice}</p>}
                <h2>{result.answer}</h2>
                <details className="evidence-block" open>
                  <summary className="evidence-heading"><span className="quote-mark" aria-hidden="true">“</span><span>SUPPORTING EVIDENCE</span></summary>
                  <blockquote>{result.evidence[0].quote}</blockquote>
                  <div className="evidence-meta"><span>{activePolicy.source}</span><span>§ {result.evidence[0].section}</span></div>
                  <div className="evidence-actions">
                    <button className="copy-button" type="button" onClick={handleCopyEvidence}>
                      {copyState === 'copied' ? 'Evidence copied' : 'Copy evidence'} <span aria-hidden="true">↗</span>
                    </button>
                    {copyState === 'unavailable' && <span className="copy-status" role="status">Clipboard access is unavailable here.</span>}
                  </div>
                </details>
                <details className="why-answer">
                  <summary>Why this answer?</summary>
                  <p>{result.answerSource === 'provider' ? 'The explanation was generated from the retrieved passages above. PolicyLens checked that every citation exactly matched supplied evidence before rendering it.' : 'The local fallback selected the strongest matching passage from this document. PolicyLens shows the exact evidence instead of inventing details outside the source.'}</p>
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
                  {result.evidence.slice(0, 3).map((candidate) => (
                    <blockquote key={`${candidate.documentId}-${candidate.section}`}>{candidate.quote}<footer>§ {candidate.section}</footer></blockquote>
                  ))}
                </div>
                <div className="not-found-contract"><span>REVIEW CONTRACT</span> PolicyLens will not silently choose between equally matched passages.</div>
              </div>
            ) : (
              <div className="not-found-content">
                <div className="not-found-icon" aria-hidden="true">?</div>
                <h2>{result.status === 'error' ? getErrorCopy(result.errorCode).title : 'I couldn’t find that in this document.'}</h2>
                <p>{result.nextStep} {result.status === 'error' ? getErrorCopy(result.errorCode).recovery : 'Try a different question, choose another sample, or provide a public URL to wire into the next MVP slice.'}</p>
                <div className="not-found-contract"><span>NOT-FOUND CONTRACT</span> No unsupported answer is presented as fact.</div>
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
                <blockquote>{comparisonResult.response.evidence[0].quote}</blockquote>
                <div className="evidence-meta"><span>{comparisonResult.policy.source}</span><span>§ {comparisonResult.response.evidence[0].section}</span></div>
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

