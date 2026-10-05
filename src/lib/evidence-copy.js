export function formatEvidenceForCopy(policy, evidence) {
  if (!policy || !Array.isArray(evidence) || evidence.length === 0) return ''

  const passages = evidence.map((item, index) => [
    `Passage ${index + 1}`,
    `Section: ${item.section}`,
    `Source: ${item.sourceUrl?.trim() || policy.source}`,
    `"${item.quote}"`,
  ].join('\n'))

  return [`PolicyLens evidence: ${policy.title}`, ...passages].join('\n\n')
}
