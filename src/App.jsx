import React, { useMemo, useState } from 'react'

const samplePolicies = [
  {
    id: 'attendance',
    title: 'Attendance & absences',
    label: 'Synthetic sample · Attendance handbook',
    source: 'samples/attendance-handbook.txt',
    summary: 'A small, clearly labelled policy excerpt for demonstrating grounded answers.',
    sections: [
      {
        id: 'attendance-window',
        keywords: ['absent', 'absence', 'attendance', 'miss', 'school'],
        heading: 'Reporting an absence',
        text: 'A parent or guardian should notify the school before 9:00 a.m. on a day the student will be absent.',
        answer: 'For an absence, a parent or guardian should notify the school before 9:00 a.m. that morning.',
      },
      {
        id: 'attendance-note',
        keywords: ['note', 'excused', 'documentation', 'return'],
        heading: 'After returning',
        text: 'Students should bring an absence note to the attendance office within three school days of returning.',
        answer: 'After returning, bring an absence note to the attendance office within three school days.',
      },
    ],
  },
  {
    id: 'devices',
    title: 'Personal devices',
    label: 'Synthetic sample · Student handbook',
    source: 'samples/student-handbook.txt',
    summary: 'A synthetic device rule used to test evidence and not-found behavior.',
    sections: [
      {
        id: 'device-class',
        keywords: ['phone', 'device', 'class', 'lesson'],
        heading: 'During class',
        text: 'Personal phones and smart devices should be silenced and kept in a student bag during lessons unless a teacher gives permission.',
        answer: 'During lessons, keep personal phones and smart devices silenced and in your bag unless your teacher gives permission.',
      },
      {
        id: 'device-exception',
        keywords: ['exception', 'medical', 'accessibility', 'permission'],
        heading: 'Support exceptions',
        text: 'A student may use a device for an approved medical or accessibility need after arranging a plan with the school.',
        answer: 'Approved medical or accessibility needs can be supported through a plan arranged with the school.',
      },
    ],
  },
]

const initialQuery = 'What should I do if I will be absent?'

function findEvidence(policy, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return null

  const words = normalizedQuery
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9-]/g, ''))
    .filter((word) => word.length >= 3)
  return policy.sections.find((section) =>
    section.keywords.some((keyword) => words.some((word) => word.includes(keyword) || keyword.includes(word))),
  )
}

function App() {
  const [selectedId, setSelectedId] = useState(samplePolicies[0].id)
  const [question, setQuestion] = useState(initialQuery)
  const [publicUrl, setPublicUrl] = useState('')
  const [customSource, setCustomSource] = useState(null)
  const [result, setResult] = useState({
    status: 'answer',
    evidence: samplePolicies[0].sections[0],
  })

  const selectedPolicy = useMemo(
    () => samplePolicies.find((policy) => policy.id === selectedId) ?? samplePolicies[0],
    [selectedId],
  )
  const activePolicy = customSource ?? selectedPolicy

  function handlePolicyChange(event) {
    setSelectedId(event.target.value)
    setCustomSource(null)
    const nextPolicy = samplePolicies.find((policy) => policy.id === event.target.value) ?? samplePolicies[0]
    setResult({ status: 'answer', evidence: nextPolicy.sections[0] })
  }

  function handleUsePublicUrl(event) {
    event.preventDefault()
    const trimmedUrl = publicUrl.trim()
    if (!trimmedUrl) return

    setCustomSource({
      title: 'Public policy link',
      label: 'External source · fetch not enabled in this local demo',
      source: trimmedUrl,
      summary: 'The URL is shown as the selected source, but the starter does not transmit or fetch it yet.',
      sections: [],
    })
    setResult({ status: 'not-found', reason: 'This local starter does not fetch external documents yet.' })
  }

  function handleAsk(event) {
    event.preventDefault()
    const evidence = findEvidence(activePolicy, question)
    setResult(
      evidence
        ? { status: 'answer', evidence }
        : { status: 'not-found', reason: 'No matching passage was found in the selected document.' },
    )
  }

  return (
    <main className="app-shell">
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

      <section className="workspace" aria-label="Policy question workspace">
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
          <p className="source-summary">{activePolicy.summary}</p>
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
            <textarea id="question" value={question} onChange={(event) => setQuestion(event.target.value)} rows="3" placeholder="e.g. What happens if I miss school?" />
            <div className="question-footer">
              <span className="character-count">{question.length} / 280</span>
              <button className="ask-button" type="submit">Find the answer <span aria-hidden="true">→</span></button>
            </div>
          </form>

          <section className="answer-panel panel" aria-live="polite" aria-atomic="true">
            <div className="answer-header">
              <div className="panel-label"><span>03</span> GROUNDED RESPONSE</div>
              <span className={`status-pill ${result.status === 'answer' ? 'status-found' : 'status-missing'}`}>
                <span className="status-dot" /> {result.status === 'answer' ? 'Found in document' : 'Not found'}
              </span>
            </div>
            {result.status === 'answer' ? (
              <div className="answer-content">
                <h2>{result.evidence.answer}</h2>
                <div className="evidence-block">
                  <div className="evidence-heading"><span className="quote-mark">“</span><span>SUPPORTING EVIDENCE</span></div>
                  <blockquote>{result.evidence.text}</blockquote>
                  <div className="evidence-meta"><span>{activePolicy.source}</span><span>§ {result.evidence.heading}</span></div>
                </div>
              </div>
            ) : (
              <div className="not-found-content">
                <div className="not-found-icon" aria-hidden="true">?</div>
                <h2>I couldn’t find that in this document.</h2>
                <p>{result.reason} Try a different question, choose another sample, or provide a public URL to wire into the next MVP slice.</p>
                <div className="not-found-contract"><span>NOT-FOUND CONTRACT</span> No unsupported answer is presented as fact.</div>
              </div>
            )}
          </section>
          <p className="disclaimer">PolicyLens is an explainer, not a substitute for your school’s official guidance. Always confirm important decisions with the school.</p>
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

