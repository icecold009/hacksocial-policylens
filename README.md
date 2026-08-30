# PolicyLens

PolicyLens is a privacy-conscious AI/ML MVP for helping students understand public school policies. A user selects a synthetic sample document or provides the URL of a public policy, asks a question, and receives a plain-English answer with supporting evidence—or an explicit not-found or needs-review state.

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts both the Vite UI and the local answer API. To run them separately, use `npm run dev:ui` and `npm run dev:api`.

For a production build:

```bash
npm run build
npm run preview
```

To serve the built app and API from one origin:

```bash
npm run build
npm start
```

The server uses `POLICYLENS_API_PORT=8787` and `127.0.0.1` for local defaults. Hosting platforms can provide their usual `PORT` value; when `PORT` is present, the server listens on `0.0.0.0` unless `POLICYLENS_API_HOST` or `HOST` overrides it. `/healthz` reports a degraded response until the production build exists.

The optional provider endpoint must use HTTPS outside local development. If the application runs behind a trusted reverse proxy, set `POLICYLENS_TRUST_PROXY=true` so rate limiting can use the first `X-Forwarded-For` address; leave it false when proxy headers are not controlled by the deployment.

Verification commands:

```bash
npm test
npm run evaluate
npm run verify
```

The app is intentionally small and dependency-light for an older laptop. The current local demo uses the React UI plus a local server-side answer boundary and does not require credentials, a database, or an AI provider.

## Current MVP scope

- Choose between three clearly labelled synthetic sample policies.
- Normalize and rank question terms against local passages with a deterministic top-three retrieval fallback.
- Return a stable answer contract with status, evidence, evidence strength, next step, and disclaimer fields.
- Show a plain-English response, exact supporting passage, and source/section label.
- Compare the same question across two synthetic sample policies with separate evidence or explicit abstention.
- Route equally matched passages to a needs-review state instead of silently choosing one.
- Show a distinct not-found state when no passage matches.
- Accept a public policy URL as a source selection, while honestly leaving fetching for the next slice.

## Current architecture

- `src/data/policies.js` contains the synthetic policy documents and source metadata.
- `src/lib/retrieval.js` normalizes queries, ranks evidence candidates, and enforces empty, oversized, not-found, and ambiguity states.
- `src/lib/answer-contract.js` builds and validates the response shape that the UI renders.
- `src/data/policies.js` is the canonical runtime policy source. `scripts/ingest-policies.mjs` validates it and produces the reviewable normalized corpus at `data/processed/policies.json`, including the retrieval and fallback-answer fields used by the runtime.
- `server/answer-service.mjs` exposes the local `POST /api/answer` boundary with request-size, method, JSON, policy, and response validation.
- `server/provider.mjs` contains the optional environment-configured provider adapter, exact-citation check, timeout, bounded retry, and local fallback behavior.
- Development-only retrieval diagnostics can be requested through the server helper with `NODE_ENV=development` and `includeDiagnostics: true`; they contain candidate IDs and scores, never source quotes.
- `server/static-assets.mjs` provides path-safe production asset serving and security headers for `npm start`.
- `data/evaluation/questions.json` and `scripts/evaluate.mjs` provide the 25-case local evaluation.

The measured results are recorded in [`docs/evaluation.md`](docs/evaluation.md). The answer service is deterministic by default; when all provider settings in `.env.example` are configured, it can request a constrained explanation server-side and falls back locally if the provider is unavailable or returns unsupported evidence. No provider credential is sent to the browser. Dependency and synthetic-source attribution is recorded in [`docs/attribution.md`](docs/attribution.md).

The answer API also applies an in-memory limit of 30 requests per client per minute for the local demo. It does not persist client identifiers or request content.

The answer contract is:

```json
{
  "status": "found | not_found | needs_review | error",
  "answer": "Plain-English answer",
  "evidence": [{ "documentId": "attendance", "section": "Reporting an absence", "quote": "Exact supporting text", "sourceUrl": null }],
  "evidenceStrength": "strong | partial | weak",
  "nextStep": "Optional grounded action",
  "disclaimer": "Confirm important decisions with the school."
}
```

`found` responses require evidence; empty, oversized, invalid, unsupported, and ambiguous requests receive explicit status or error-code results instead of a fabricated answer.

## Current AI/ML boundary

**AI/ML** — PolicyLens already has the core retrieval-augmented explanation boundary: it retrieves passages locally, can send only the question and those passages to an optional server-side provider, requires exact citations, validates the returned contract, and falls back to a deterministic local explanation when the provider is unavailable. Semantic embeddings, arbitrary-document ingestion, and hosted-provider measurement remain future work.

## Privacy boundaries

- No real student information, private school records, or credentials belong in this repository.
- Use only public documents or synthetic samples; confirm that a document is public before adding it.
- Never place API keys in source code. Use a server-side secret boundary when an AI provider is added.
- Keep the not-found behavior fail-closed: if evidence is missing, do not invent an answer.
- Treat an AI response as an explanation layer, not official legal or school guidance.

## Submission checklist

- [x] Keep the included synthetic samples clearly labelled and documented.
- [x] Keep the retrieval and optional AI explanation layer behind a server-side credential boundary.
- [x] Return source passages and an explicit not-found state for every question.
- [x] Test empty, ambiguous, unsupported, and long questions.
- [x] Document prompt constraints, evaluation examples, and known limitations.
- [x] Run `npm run build` before submission.
- [x] Keep secrets, private data, and deployment credentials out of Git history.
- [ ] Add an authorized public repository URL, live demo, screenshots, and demo video.

The local Devpost draft and timed recording outline are in [`devpost-submission.md`](devpost-submission.md) and [`docs/demo-script.md`](docs/demo-script.md). They contain explicit placeholders until publication and media capture are authorized.


