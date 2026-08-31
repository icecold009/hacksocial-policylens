# PolicyLens

PolicyLens is a privacy-conscious AI/ML MVP for helping students understand school policies. A user selects a clearly labelled synthetic sample document, asks a question, and receives a plain-English answer with supporting evidence—or an explicit not-found or needs-review state.

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
npm run smoke
```

For a deployed or already-running server, point the same smoke checks at its origin:

```bash
npm run smoke -- --base-url https://hacksocial-policylens.onrender.com
```

The verified Render origin for this release is:

```text
https://hacksocial-policylens.onrender.com
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
- Explain that arbitrary external policy import is intentionally outside the demo boundary.

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
- `scripts/smoke.mjs` checks the production-style server health, app shell, grounded answer, and abstention path.

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

## Release status

- Canonical branch: `main`
- Main release checkpoint: `876cdcd621ee25e4eb23650313df30e04c2b02e3`
- The prize-max slice contains five release commits after the reviewed hardening base and was promoted into `main` as one squashed release checkpoint.
- Verification: `npm run verify`, `npm run smoke`, and the dependency audit are the required release gates.
- Deployment: [https://hacksocial-policylens.onrender.com](https://hacksocial-policylens.onrender.com), verified against commit `71ace683e292a5f8edd00635e52e8e5c793429ea` on August 30, 2026.
- Hosted verification: `npm run smoke -- --base-url https://hacksocial-policylens.onrender.com` passed, and the hosted desktop flow covered a grounded answer, comparison, and unsupported-question abstention with no console warnings or errors. The free Render service may cold-start after inactivity.
- Submission: the existing HackSocial 2026 PolicyLens entry remains the single Devpost project to update.

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
- [x] Add a deterministic production smoke command and a GitHub Actions verification workflow.
- [x] Deploy and smoke-test the exact release commit on Render.
- [ ] Add the demo video and captured screenshots to the existing Devpost entry.

The Devpost write-up and timed recording outline are in [`devpost-submission.md`](devpost-submission.md) and [`docs/demo-script.md`](docs/demo-script.md). They distinguish verified hosted evidence from the still-unpublished media assets.


