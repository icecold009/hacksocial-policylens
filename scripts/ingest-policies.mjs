import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { samplePolicies } from '../src/data/policies.js'

const outputUrl = new URL('../data/processed/policies.json', import.meta.url)

export function normalizeWhitespace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

export function validatePolicies(policies) {
  const errors = []
  const documentIds = new Set()
  const chunkIds = new Set()

  if (!Array.isArray(policies)) throw new Error('Policies must be an array.')

  policies.forEach((policy) => {
    if (!policy.id || documentIds.has(policy.id)) errors.push(`duplicate or missing document id: ${policy.id || '<empty>'}`)
    documentIds.add(policy.id)
    if (!policy.title) errors.push(`missing title: ${policy.id}`)
    if (!policy.organization) errors.push(`missing organization: ${policy.id}`)
    if (!policy.sourceType) errors.push(`missing source type: ${policy.id}`)
    if (!policy.sourceRightsNote) errors.push(`missing source-rights note: ${policy.id}`)
    if (policy.sourceType !== 'synthetic' && !policy.sourceUrl) errors.push(`missing source URL: ${policy.id}`)
    if (!Array.isArray(policy.sections) || policy.sections.length === 0) errors.push(`missing sections: ${policy.id}`)

    policy.sections?.forEach((section) => {
      const chunkId = `${policy.id}:${section.id}`
      if (!section.id || chunkIds.has(chunkId)) errors.push(`duplicate or missing chunk id: ${chunkId}`)
      chunkIds.add(chunkId)
      if (!section.heading) errors.push(`missing section heading: ${chunkId}`)
      if (!Array.isArray(section.keywords) || section.keywords.length === 0) errors.push(`missing section keywords: ${chunkId}`)
      if (!normalizeWhitespace(section.text)) errors.push(`empty section text: ${chunkId}`)
      if (!section.answer) errors.push(`missing section answer: ${chunkId}`)
    })
  })

  if (errors.length > 0) throw new Error(errors.join('\n'))
}

export function createProcessedPolicies(policies) {
  validatePolicies(policies)
  return policies.map((policy) => ({
    documentId: policy.id,
    title: policy.title,
    organization: policy.organization,
    sourceType: policy.sourceType,
    source: policy.source,
    sourceUrl: policy.sourceUrl,
    publicationDate: policy.publicationDate,
    retrievalDate: policy.retrievalDate,
    sourceRightsNote: policy.sourceRightsNote,
    summary: policy.summary,
    chunks: policy.sections.map((section, index) => ({
      chunkId: `${policy.id}:${section.id}`,
      documentId: policy.id,
      section: section.heading,
      page: null,
      text: normalizeWhitespace(section.text),
      keywords: section.keywords,
      answer: section.answer,
      nextStep: section.nextStep ?? '',
      exampleQuestion: section.exampleQuestion ?? '',
      sourceUrl: policy.sourceUrl,
      ordinal: index,
    })),
  }))
}

export const processedPolicies = createProcessedPolicies(samplePolicies)

export async function runIngestion({ checkOnly = false } = {}) {
  const output = `${JSON.stringify(processedPolicies, null, 2)}\n`
  const chunkCount = processedPolicies.reduce((total, policy) => total + policy.chunks.length, 0)

  if (checkOnly) {
    const existing = await readFile(outputUrl, 'utf8')
    if (existing !== output) throw new Error('Processed policy data is stale. Run npm run ingest.')
    return `Policy ingestion check passed: ${processedPolicies.length} documents, ${chunkCount} chunks`
  }

  await mkdir(new URL('../data/processed/', import.meta.url), { recursive: true })
  await writeFile(outputUrl, output, 'utf8')
  return `Policy ingestion complete: ${processedPolicies.length} documents, ${chunkCount} chunks`
}

if (process.argv[1] && resolvePath(process.argv[1]) === resolvePath(fileURLToPath(import.meta.url))) {
  console.log(await runIngestion({ checkOnly: process.argv.includes('--check') }))
}

