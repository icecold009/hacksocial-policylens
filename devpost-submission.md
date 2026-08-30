# Title

PolicyLens

## One-line Summary

A citation-first assistant that helps students and families understand public school policies in plain English without inventing unsupported answers.

## Problem

School policies often contain the answer a student needs, but the wording can be dense, scattered, or difficult to interpret quickly. A generic chatbot may produce a fluent answer without showing whether the policy actually supports it. Students and families need a clearer path from a question to the exact passage that answers it—and a trustworthy way to hear “this document does not say.”

## Solution

PolicyLens lets a user choose a clearly labelled policy source, ask a natural-language question, and receive a plain-English explanation grounded in retrieved evidence. The interface shows the answer status, evidence strength, source, section, exact supporting passage, and a grounded next step. When evidence is missing or ambiguous, PolicyLens abstains or asks for review instead of silently guessing.

The default demo is deterministic and runs locally without credentials. An optional server-side provider adapter can generate a constrained explanation from the user question and retrieved evidence, then validates the result against the same answer contract and falls back locally when the provider is unavailable or unsupported.

## Why This Matters

Students and families should not need specialist policy knowledge to understand everyday rules about attendance, devices, accessibility, and support. PolicyLens makes the evidence boundary visible: the source passage remains separate from the generated explanation, and the product treats an unsupported answer as a reason to stop rather than an invitation to hallucinate.

## How We Used AI

- The product is designed around a retrieval-augmented explanation boundary: retrieve relevant source passages first, then optionally ask a provider for a short explanation using only those passages.
- The provider prompt treats policy text as untrusted data, requires exact evidence citations, requires explicit not-found behavior when evidence is insufficient, and asks for uncertainty language for partial evidence.
- Provider output is validated against a stable answer contract. Uncited, malformed, or unsupported output is rejected; bounded retries are limited to safe transient failures.
- No provider credentials are committed or sent to the browser. The current default demo uses deterministic local fallback answers so it remains reproducible without an API key.

No specific hosted model or provider is claimed in this draft because none is configured in the repository.

## How We Used Codex

Codex helped inspect the existing React/Vite MVP, turn the product promise into a tested retrieval and answer contract, add reproducible policy ingestion and evaluation cases, build the local server-side answer boundary, add provider-safe fallback handling, harden production static serving, and iterate on the trust-focused UI. The release work is kept on the feature branch `codex/policylens-prize-max`.

## What We Learned

The most useful trust feature was not a more elaborate answer—it was making the evidence boundary visible and treating unsupported or ambiguous questions as valid product outcomes. We also learned that a deterministic local fallback makes the demo reproducible while preserving a clear path to optional provider-generated explanations behind server-side validation.

## Key Features

- Three clearly labelled synthetic policy sources covering attendance, personal devices, and accessibility support.
- Query normalization and deterministic top-three retrieval with minimum evidence thresholds.
- Found, not-found, needs-review, and error states instead of fabricated answers.
- Exact evidence quotes with source and section metadata.
- Optional same-question comparison across two sample policies, keeping each result tied to its own source.
- Copy-evidence action that keeps the quote, source, and section together for sharing.
- Grounded follow-up questions that clear stale evidence before starting the next search.
- Evidence-strength label, grounded next step, disclaimer, and a “Why this answer?” explanation.
- Server-side request validation, response-contract validation, request-size limits, rate limiting, and optional provider fallback.
- Reproducible ingestion validation and a 25-case local evaluation suite.
- Single-origin production serving through `npm start`, with path-safe static assets and security headers.

## Architecture

The project uses a React/Vite frontend and a small Node HTTP server so the default demo stays dependency-light and the optional provider credential never reaches the browser.

1. `src/data/policies.js` contains the synthetic source documents and their section metadata.
2. `scripts/ingest-policies.mjs` validates the source model and writes the reviewable normalized corpus in `data/processed/policies.json`.
3. `src/lib/retrieval.js` normalizes the question, ranks candidate passages, and returns bounded evidence or an abstention state.
4. `server/answer-service.mjs` validates the request and creates the stable answer contract.
5. `server/provider.mjs` is an optional server-side explanation adapter. It receives only the question and retrieved evidence, validates citations, and falls back to the deterministic answer path.
6. The React UI renders the validated contract and keeps source text separate from the explanation layer.

## Testing Instructions

From the repository root:

```bash
npm install
npm run verify
npm run dev
```

For a production-style local demo:

```bash
npm run build
npm start
```

Then open the local address printed by the server. Try an attendance question such as “What should I do if I will be absent?”, use the optional comparison control to compare the same question with “Personal devices,” and try an unsupported question such as “What is the school lunch menu?”. Inspect the status, exact evidence, source section, comparison status, and “Why this answer?” panel.

Measured local verification passes data validation, the production build, 53 automated tests, and all 25 evaluation cases. The evaluation reports hit@3 of 15/15, found-answer citation support of 15/15, malformed-response rejection of 3/3, and complete coverage for the recorded direct, paraphrased, unsupported, and adversarial case groups.

## Public Demo Link

Render deployment is pending live verification. Until the hosted `/healthz` and browser flow pass, run the production-style local demo with `npm run build && npm start`.

## Public Repository Link

Repository: https://github.com/icecold009/hacksocial-policylens

The implementation for this release is on the `codex/policylens-prize-max` branch.

## Demo Video

The 90–120 second recording is pending. Use [`docs/demo-script.md`](docs/demo-script.md) and show the verified hosted flow when available.

## Screenshot Shot List

Capture these after the UI has been opened in a supported browser and the local or hosted URL is known:

1. Landing state showing the PolicyLens purpose and the three source choices.
2. Attendance question with the plain-English answer and exact “Reporting an absence” evidence.
3. “Why this answer?” expanded, showing the evidence boundary and source metadata.
4. Unsupported question showing the explicit not-found state and next step.
5. Optional needs-review or accessibility scenario showing uncertainty without a fabricated answer.

Do not include terminal secrets, provider credentials, private browser tabs, or personal data in the captures.

## Submission Readiness Notes

### Submitted entry

PolicyLens is already submitted to HackSocial 2026 at https://devpost.com/software/policylens-xopvfe. Update this existing project after the release evidence is verified; do not create a second entry.

## Known Limitations

- The included policy sources are synthetic demo fixtures, not official school policies.
- External URL ingestion is intentionally not implemented; arbitrary documents are not fetched by the demo.
- Semantic embeddings and reranking are not implemented; retrieval is deterministic lexical matching.
- No live provider configuration or peer usability study is claimed.
- Hosted/incognito, keyboard-only, and peer usability checks remain release gates until they are actually run.
- PolicyLens is an explainer, not official school, legal, or medical guidance. Important decisions should be confirmed with the relevant school or support team.

## Release fields

- Hackathon/event: HackSocial 2026
- Public project: https://devpost.com/software/policylens-xopvfe
- Public repository: https://github.com/icecold009/hacksocial-policylens
- Public demo: pending Render verification
- Demo video: pending recording
- Screenshots: pending verified captures

