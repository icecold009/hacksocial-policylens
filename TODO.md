# PolicyLens — HackSocial 2026 build TODO

This is the working checklist for turning the current React/Vite MVP into a complete HackSocial submission within the one-week sprint ending **August 31, 2026 at 5:00 p.m. EDT**.

## How to use this file

- Tick a task only after it has been implemented and verified.
- Add evidence after milestone tasks: command output, test name, URL, screenshot, or commit.
- Keep all implementation on the feature branch `codex/hacksocial-mvp` or a new `codex/*` feature branch.
- Do not merge to `main` without explicit approval.
- Prefer a complete, reliable core flow over extra features.
- If a task becomes unsafe or too large for the deadline, mark it `**Deferred:**` and continue with the documented fallback.

## Product definition

**Product:** PolicyLens

**One-line pitch:** A citation-first AI assistant that helps students understand public school policies in plain English without inventing unsupported answers.

**Primary judging angle:** AI/ML plus Visual Design.

**Social-good angle:** Students and families can understand rules that affect attendance, devices, accessibility, and daily school life without needing to interpret dense policy documents alone.

**Core promise:** Every answer shows the evidence used. If the document does not support an answer, PolicyLens says so.

## Current baseline

- [x] Existing React/Vite MVP inspected.
- [x] Existing synthetic attendance and device policies retained as initial fixtures.
- [x] Existing answer and explicit not-found states retained as trust foundations.
- [x] Replace keyword-only matching with tested retrieval.
- [x] Add a provider-backed server-side AI boundary.
- [ ] Add deployment and submission media.

## Priority key

- **P0:** Required for a complete, judgeable submission.
- **P1:** High-value polish or reliability work after all P0 work is complete.
- **P2:** Defer unless P0 and P1 are finished early.

## Milestone 0 — Scope, eligibility, and working agreement

### P0 product decisions

- [x] Confirm the final name: PolicyLens.
- [x] Confirm the final one-line pitch.
- [x] Confirm the primary audience: students and parents.
- [x] Confirm the three demo scenarios:
  - [x] Attendance or absence reporting.
  - [x] Personal device rules.
  - [x] Accessibility or support accommodations.
- [x] Write the final user journey: select source → ask question → retrieve evidence → generate explanation → inspect citation or receive not-found.
- [x] Freeze the P0 scope before adding optional features. Remaining publication and user-testing gates are intentionally external.

### P0 eligibility and submission preflight

- [ ] Confirm every team member is individually registered for HackSocial.
- [ ] Confirm every team member is eligible under the current rules.
- [ ] Confirm the final team has no more than four members.
- [ ] Confirm the project has one submitting team only.
- [ ] Confirm the submission deadline in the Devpost form before final submission.
- [ ] Recheck the official Devpost page and rules on submission day for changes.

### P0 repository workflow

- [x] Confirm work is on a feature branch: `codex/hacksocial-mvp`.
- [x] Confirm the initial working tree is clean before implementation.
- [x] Keep unrelated changes out of this branch.
- [x] Create logical commits for coherent milestones.
- [x] Keep `TODO.md` as the sole active queue and add the repository-owned Codex/GitHub orchestration contract.
- [x] Define deterministic pull-request verification with `.github/workflows/verify.yml`.
- [ ] Connect the repository to a reproducible Codex cloud environment and enable automatic Code review.
- [ ] Protect `main` with required pull requests, the `verify` check, resolved review conversations, and blocked force pushes.
- [ ] Push useful completed checkpoints when implementation is authorized.
- [ ] Keep merge-to-`main` as a separate approval gate.

## Milestone 1 — Architecture and data contract

### P0 answer contract

- [x] Add a documented response schema with these fields:

```json
{
  "status": "found | not_found | needs_review | error",
  "answer": "Plain-English answer",
  "evidence": [
    {
      "documentId": "attendance-policy",
      "section": "Reporting an absence",
      "quote": "Exact supporting text",
      "sourceUrl": "https://example.org/policy"
    }
  ],
  "evidenceStrength": "strong | partial | weak",
  "nextStep": "Optional grounded action",
  "disclaimer": "Confirm important decisions with the school."
}
```

- [x] Reject malformed responses before rendering them.
- [x] Require at least one evidence item for `status: found`.
- [x] Require `status: not_found` when evidence is below the configured threshold.
- [x] Keep official policy text separate from AI-generated explanation text.
- [x] Add a stable error-code list for client-visible failures.

### P0 document and chunk model

- [x] Define document metadata: ID, title, organization, source URL, publication/update date, retrieval date, and source type.
- [x] Define chunk metadata: stable chunk ID, document ID, section, page if available, text, and source URL.
- [x] Normalize whitespace and headings during ingestion.
- [x] Preserve exact source text for citations.
- [x] Prevent duplicate document IDs and chunk IDs.
- [x] Add a source-rights note for every non-synthetic document.

### P0 environment and scripts

- [x] Add `.env.example` with names only; never commit credentials.
- [x] Add `npm test`.
- [x] Add `npm run evaluate`.
- [x] Add `npm run verify` to run the final local gates.
- [x] Keep generated local-only indexes, evaluation artifacts, and local secrets ignored; the reviewable processed corpus remains intentionally tracked.

## Milestone 2 — Source data and retrieval

### P0 source set

- [x] Keep the two existing synthetic policies working.
- [x] Add at least one additional realistic policy fixture.
- [x] Prefer public or synthetic documents only.
- [x] Record attribution and source URLs where applicable; synthetic fixtures carry an explicit rights note.
- [x] Avoid personal student records and private school information.
- [x] Avoid high-stakes medical or legal claims in the demo data.

### P0 ingestion

- [x] Create `scripts/ingest-policies.mjs` or an equivalent reproducible ingestion command.
- [x] Convert source documents into normalized chunks.
- [x] Store processed data in a reviewable format.
- [x] Make ingestion deterministic and repeatable.
- [x] Validate missing titles, empty text, duplicate IDs, and missing source metadata.

### P0 retrieval

- [x] Move matching logic out of `src/App.jsx` into a tested library module.
- [x] Implement lexical retrieval as a deterministic fallback.
- **Deferred:** Add semantic retrieval or embedding reranking for paraphrased questions. The deterministic lexical fallback passes the recorded paraphrase cases; add an embedding dependency only when a runtime and evaluation budget are available.
- [x] Return the top three evidence candidates with scores and metadata.
- [x] Add a minimum evidence threshold.
- [x] Add a tie/ambiguity state instead of silently choosing a weak match.
- [x] Ensure retrieval never returns a citation from the wrong document.
- [x] Add a query normalization step for punctuation, casing, and common wording.
- [x] Add retrieval diagnostics that are safe to expose in development only.

### P0 retrieval acceptance cases

- [x] Direct attendance question returns the correct attendance section.
- [x] Paraphrased attendance question returns the same section.
- [x] Device question returns the class-device section.
- [x] Accessibility question returns the support-exception section.
- [x] Unsupported question returns no evidence.
- [x] Empty question returns a validation message.
- [x] Very long question is rejected or safely truncated.
- [x] Adversarial wording cannot override the evidence boundary.

## Milestone 3 — AI answer layer

### P0 server-side boundary

- [x] Add a server-side `/api/answer` route.
- [x] Keep provider credentials out of browser bundles.
- [x] Validate request method, body shape, question length, and evidence payload.
- [x] Set a request timeout.
- [x] Add a bounded retry policy only for safe transient failures.
- [x] Return stable public error codes without exposing provider payloads or stack traces.
- [x] Do not log raw questions, source contents, credentials, or personal data.

### P0 constrained generation

- [x] Send the model only the user question and retrieved evidence.
- [x] Instruct the model to answer only from supplied evidence.
- [x] Require citations to exact evidence items.
- [x] Require an explicit not-found response when evidence is insufficient.
- [x] Require uncertainty language for partial evidence.
- [x] Prevent instructions inside source documents from becoming model instructions.
- [x] Validate the response against the answer contract.
- [x] Reject uncited or unsupported generated answers.
- [x] Include a clear AI-generated explanation label.

### P0 fallback behavior

- [x] Keep the application usable when the provider is not configured.
- [x] Provide deterministic fixture answers for the recorded demo scenarios.
- [x] Clearly label fallback/demo mode.
- [x] Show a useful provider-error state instead of a blank panel.
- [x] Ensure the fallback never fabricates evidence.

### P1 public URL support, only if safe

- **Deferred:** Validate only `http` and `https` URLs before enabling external fetching.
- **Deferred:** Block localhost, loopback, link-local, private, and internal IP ranges before enabling external fetching.
- **Deferred:** Limit response size before enabling external fetching.
- **Deferred:** Limit fetch time before enabling external fetching.
- **Deferred:** Validate content type before enabling external fetching.
- **Deferred:** Sanitize extracted HTML/text before enabling external fetching.
- **Deferred:** Add an unsupported-document state before enabling external fetching.
- **Deferred:** Add a source fetch failure state before enabling external fetching.
- [x] Document that arbitrary URL ingestion is not supported if these checks cannot be completed.

## Milestone 4 — Final student experience

### P0 source panel

- [x] Show the selected document title.
- [x] Show organization and source type.
- [x] Show source URL or synthetic-source label.
- [x] Show publication/update date when available.
- [x] Show a short explanation of why the source is trustworthy or synthetic.
- [x] Add a reset source action.

### P0 question panel

- [x] Keep the character limit visible.
- [x] Validate empty questions.
- [x] Add two or three example questions.
- [x] Disable duplicate submission while a request is pending.
- [x] Show a loading state that explains what is happening: searching evidence, then writing explanation.

### P0 answer panel

- [x] Show the plain-English answer first.
- [x] Show a found/not-found/needs-review status.
- [x] Show exact evidence text.
- [x] Show source and section metadata.
- [x] Show evidence strength without pretending it is legal certainty.
- [x] Add a “Why this answer?” explanation.
- [x] Add the grounded next step when available.
- [x] Keep the disclaimer visible but unobtrusive.

### P0 trust and failure states

- [x] Empty state before the first question.
- [x] Loading state.
- [x] Found state.
- [x] Partial-evidence state.
- [x] Not-found state.
- [x] Invalid-source state.
- [x] Provider-unavailable state.
- [x] Timeout state.
- [x] Rate-limit state.
- [x] Network-offline state.

### P0 accessibility and responsive quality

- [x] Keyboard-complete source selection and question flow.
- [x] Visible `:focus-visible` treatment.
- [x] Correct labels for every form control.
- [x] Appropriate `aria-live` behavior for answer updates.
- [x] Screen-reader-friendly status labels.
- [x] Sufficient color contrast.
- [x] No information conveyed by color alone.
- [x] Touch-safe button sizes.
- [x] No horizontal overflow at 320px.
- [x] Usable layout at mobile, tablet, and desktop widths.
- [x] Respect `prefers-reduced-motion`.
- [x] Avoid hover-only interactions.

### P1 high-impact polish

- [x] Add a compact share/copy evidence card.
- [x] Add suggested follow-up questions after an answer.
- [x] Add an evidence drawer or expandable source view.
- [x] Add a “compare two policies” feature only if the core flow is already stable.
- [x] Add a small visual explanation of the retrieval pipeline for the demo video.

## Milestone 5 — Evaluation and quality evidence

### P0 evaluation dataset

Create `data/evaluation/questions.json` with at least 25 manually reviewed cases:

- [x] 8 directly answerable questions.
- [x] 6 paraphrased questions.
- [x] 4 multi-condition questions.
- [x] 4 unsupported questions.
- [x] 3 adversarial or misleading questions.

### P0 metrics

- [x] Measure retrieval hit@3.
- [x] Measure citation-support rate.
- [x] Measure unsupported-question abstention rate.
- [x] Measure malformed-response rejection rate.
- [x] Measure local response latency.
- [ ] Measure hosted response latency.
- [x] Save the actual results in `docs/evaluation.md`.
- [x] Label all numbers as measured results, not projected claims.

Suggested targets:

- [x] At least 85% retrieval hit@3.
- [x] 100% citation coverage on positive demo cases.
- [x] At least 95% correct abstention on unsupported cases.
- [ ] Zero fabricated answers in the final recorded demo.
- [x] Local fixture response under one second.
- [ ] Hosted response within an acceptable live-demo window.

### P0 automated tests

- [x] Retrieval unit tests.
- [x] Chunking and metadata tests.
- [x] Answer-contract validation tests.
- [x] Not-found tests.
- [x] Empty and oversized input tests.
- [x] Provider error and timeout tests.
- [x] Citation/document-integrity tests.
- [x] API route tests.
- [x] Production build test.

### P0 manual usability test

- [ ] Test with at least three peers or students.
- [ ] Ask whether the purpose is clear within five seconds.
- [ ] Ask whether they can identify the evidence.
- [ ] Ask whether the not-found state is understandable.
- [ ] Test keyboard-only navigation.
- [ ] Test mobile width.
- [ ] Record actual feedback and resulting changes.

## Milestone 6 — Security, privacy, and reliability

- [x] Do not commit API keys, tokens, cookies, or deployment credentials.
- [x] Do not include real student names, IDs, grades, or private records.
- [x] Do not transmit unnecessary personal information to the AI provider.
- [x] Sanitize rendered source content.
- [x] Prevent prompt injection from source-document text.
- [x] Add request size limits.
- [x] Add rate limiting or a documented demo limit.
- [x] Avoid exposing internal error details to users.
- [x] Add a Content Security Policy if compatible with deployment.
- [x] Review third-party package licenses.
- [x] Keep synthetic sources clearly labelled.
- [x] Document known limitations.
- [x] Document that PolicyLens is an explainer, not official school, legal, or medical guidance.
- [ ] Triage and remediate the current Vite/esbuild development-server advisories in a separate dependency package before public preview. Evidence: `npm audit` on 2026-08-27 reported one high and one moderate vulnerability and a semver-major Vite fix; keep the Vite development server private and re-run `npm audit` plus `npm run verify` after the upgrade.

## Milestone 7 — Deployment and operations

- [ ] Choose one hosting target for the frontend and API.
- [ ] Add production environment variables through the host dashboard.
- [x] Configure a health check or smoke-test route.
- [ ] Deploy a preview before production.
- [ ] Test the deployed app from a fresh/incognito browser.
- [ ] Test without cached local state.
- [ ] Test provider configured.
- [ ] Test provider unavailable.
- [ ] Test unsupported question.
- [ ] Test mobile viewport.
- [ ] Test keyboard-only flow.
- [ ] Record the final live URL in `README.md`.
- [ ] Record the deployment date and known limitations.

## Milestone 8 — Documentation and Devpost package

### P0 repository documentation

- [x] Update `README.md` with the final product story.
- [x] Document local setup.
- [ ] Document the production demo URL.
- [x] Document the architecture.
- [x] Document the retrieval and AI boundaries.
- [x] Document the model/provider used, if any.
- [x] Document fallback behavior.
- [x] Document evaluation methodology and measured results.
- [x] Document privacy, safety, and limitations.
- [x] Document attribution and third-party licenses.
- [ ] Add screenshots or a short GIF if appropriate.

### P0 demo video

- [ ] Keep the video between 90 and 120 seconds.
- [ ] Start with the problem and target user.
- [ ] Show source selection.
- [ ] Show a direct question.
- [ ] Show the answer and exact evidence.
- [ ] Show a paraphrased question.
- [ ] Show an unsupported question and explicit abstention.
- [ ] Show the live deployed product.
- [ ] End with the one-line impact statement.
- [ ] Avoid showing API keys, private tabs, terminal secrets, or personal data.

### P0 Devpost description

- [x] Add a clear project title.
- [x] Add a one-sentence tagline.
- [x] Explain the student problem.
- [x] Explain the PolicyLens solution.
- [x] Explain what makes it different from a generic chatbot.
- [x] Explain the retrieval/evidence/abstention pipeline.
- [x] Explain the technology stack.
- [x] Explain the AI safety and privacy boundaries.
- [x] Explain what was learned.
- [ ] Link the live demo.
- [ ] Link the source repository.
- [ ] Embed the demo video.
- [ ] Add screenshots.
- [x] State limitations honestly.
- [x] Do not claim user counts, accuracy, impact, or partnerships without evidence.

## Final verification checklist

- [ ] `npm install` succeeds from a clean checkout.
- [ ] `npm run dev` starts the application.
- [x] `npm run build` succeeds.
- [x] `npm test` succeeds.
- [x] `npm run evaluate` succeeds.
- [x] `npm run verify` succeeds.
- [x] `git diff --check` succeeds.
- [x] No secrets are present in tracked files.
- [x] No private data is present in tracked files.
- [ ] The live URL loads from an incognito browser.
- [x] The core demo flow works end to end locally.
- [x] The unsupported-question flow abstains locally.
- [x] The repository is clean except for intentional, committed work.
- [ ] The feature branch is pushed if publication has been authorized.
- [ ] The Devpost form contains the repository, live link, description, screenshots, and video.
- [ ] Submission is complete at least two hours before the official deadline.

## Definition of done

PolicyLens is ready to submit when a judge can:

1. Open the live link.
2. Understand the product immediately.
3. Select a realistic policy.
4. Ask a natural-language question.
5. Receive a useful plain-English answer.
6. Inspect the exact supporting evidence.
7. See the source and section.
8. Ask an unsupported question and see PolicyLens abstain.
9. Understand the privacy and AI limitations.
10. Reproduce the project from the repository.

## Deliberately deferred unless time remains

- [ ] Authentication and user accounts.
- [ ] Persistent chat history.
- [ ] Database-backed multi-school tenancy.
- [ ] Native mobile application.
- [ ] Social feed or community features.
- [ ] Automatic crawling of arbitrary websites.
- [ ] Custom model training.
- [ ] Multi-language support.
- [ ] Complex analytics dashboard.
- [ ] Broad policy coverage beyond the polished demo scenarios.
