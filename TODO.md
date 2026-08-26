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
- [ ] Replace keyword-only matching with tested retrieval.
- [ ] Add a server-side AI boundary.
- [ ] Add evaluation, deployment, documentation, and submission media.

## Priority key

- **P0:** Required for a complete, judgeable submission.
- **P1:** High-value polish or reliability work after all P0 work is complete.
- **P2:** Defer unless P0 and P1 are finished early.

## Milestone 0 — Scope, eligibility, and working agreement

### P0 product decisions

- [ ] Confirm the final name: PolicyLens.
- [ ] Confirm the final one-line pitch.
- [ ] Confirm the primary audience: students and parents.
- [ ] Confirm the three demo scenarios:
  - [ ] Attendance or absence reporting.
  - [ ] Personal device rules.
  - [ ] Accessibility or support accommodations.
- [ ] Write the final user journey: select source → ask question → retrieve evidence → generate explanation → inspect citation or receive not-found.
- [ ] Freeze the P0 scope before adding optional features.

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
- [ ] Keep unrelated changes out of this branch.
- [ ] Create logical commits for coherent milestones.
- [ ] Push useful completed checkpoints when implementation is authorized.
- [ ] Keep merge-to-`main` as a separate approval gate.

## Milestone 1 — Architecture and data contract

### P0 answer contract

- [ ] Add a documented response schema with these fields:

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

- [ ] Reject malformed responses before rendering them.
- [ ] Require at least one evidence item for `status: found`.
- [ ] Require `status: not_found` when evidence is below the configured threshold.
- [ ] Keep official policy text separate from AI-generated explanation text.
- [ ] Add a stable error-code list for client-visible failures.

### P0 document and chunk model

- [ ] Define document metadata: ID, title, organization, source URL, publication/update date, retrieval date, and source type.
- [ ] Define chunk metadata: stable chunk ID, document ID, section, page if available, text, and source URL.
- [ ] Normalize whitespace and headings during ingestion.
- [ ] Preserve exact source text for citations.
- [ ] Prevent duplicate document IDs and chunk IDs.
- [ ] Add a source-rights note for every non-synthetic document.

### P0 environment and scripts

- [ ] Add `.env.example` with names only; never commit credentials.
- [ ] Add `npm test`.
- [ ] Add `npm run evaluate`.
- [ ] Add `npm run verify` to run the final local gates.
- [ ] Keep generated indexes, evaluation artifacts, and local secrets ignored.

## Milestone 2 — Source data and retrieval

### P0 source set

- [ ] Keep the two existing synthetic policies working.
- [ ] Add at least one additional realistic policy fixture.
- [ ] Prefer public or synthetic documents only.
- [ ] Record attribution and source URLs.
- [ ] Avoid personal student records and private school information.
- [ ] Avoid high-stakes medical or legal claims in the demo data.

### P0 ingestion

- [ ] Create `scripts/ingest-policies.mjs` or an equivalent reproducible ingestion command.
- [ ] Convert source documents into normalized chunks.
- [ ] Store processed data in a reviewable format.
- [ ] Make ingestion deterministic and repeatable.
- [ ] Validate missing titles, empty text, duplicate IDs, and missing source metadata.

### P0 retrieval

- [ ] Move matching logic out of `src/App.jsx` into a tested library module.
- [ ] Implement lexical retrieval as a deterministic fallback.
- [ ] Add semantic retrieval or embedding reranking for paraphrased questions.
- [ ] Return the top three evidence candidates with scores and metadata.
- [ ] Add a minimum evidence threshold.
- [ ] Add a tie/ambiguity state instead of silently choosing a weak match.
- [ ] Ensure retrieval never returns a citation from the wrong document.
- [ ] Add a query normalization step for punctuation, casing, and common wording.
- [ ] Add retrieval diagnostics that are safe to expose in development only.

### P0 retrieval acceptance cases

- [ ] Direct attendance question returns the correct attendance section.
- [ ] Paraphrased attendance question returns the same section.
- [ ] Device question returns the class-device section.
- [ ] Accessibility question returns the support-exception section.
- [ ] Unsupported question returns no evidence.
- [ ] Empty question returns a validation message.
- [ ] Very long question is rejected or safely truncated.
- [ ] Adversarial wording cannot override the evidence boundary.

## Milestone 3 — AI answer layer

### P0 server-side boundary

- [ ] Add a server-side `/api/answer` route.
- [ ] Keep provider credentials out of browser bundles.
- [ ] Validate request method, body shape, question length, and evidence payload.
- [ ] Set a request timeout.
- [ ] Add a bounded retry policy only for safe transient failures.
- [ ] Return stable public error codes without exposing provider payloads or stack traces.
- [ ] Do not log raw questions, source contents, credentials, or personal data.

### P0 constrained generation

- [ ] Send the model only the user question and retrieved evidence.
- [ ] Instruct the model to answer only from supplied evidence.
- [ ] Require citations to exact evidence items.
- [ ] Require an explicit not-found response when evidence is insufficient.
- [ ] Require uncertainty language for partial evidence.
- [ ] Prevent instructions inside source documents from becoming model instructions.
- [ ] Validate the response against the answer contract.
- [ ] Reject uncited or unsupported generated answers.
- [ ] Include a clear AI-generated explanation label.

### P0 fallback behavior

- [ ] Keep the application usable when the provider is not configured.
- [ ] Provide deterministic fixture answers for the recorded demo scenarios.
- [ ] Clearly label fallback/demo mode.
- [ ] Show a useful provider-error state instead of a blank panel.
- [ ] Ensure the fallback never fabricates evidence.

### P1 public URL support, only if safe

- [ ] Validate only `http` and `https` URLs.
- [ ] Block localhost, loopback, link-local, private, and internal IP ranges.
- [ ] Limit response size.
- [ ] Limit fetch time.
- [ ] Validate content type.
- [ ] Sanitize extracted HTML/text.
- [ ] Add an unsupported-document state.
- [ ] Add a source fetch failure state.
- [ ] Document that arbitrary URL ingestion is not supported if these checks cannot be completed.

## Milestone 4 — Final student experience

### P0 source panel

- [ ] Show the selected document title.
- [ ] Show organization and source type.
- [ ] Show source URL or synthetic-source label.
- [ ] Show publication/update date when available.
- [ ] Show a short explanation of why the source is trustworthy or synthetic.
- [ ] Add a reset source action.

### P0 question panel

- [ ] Keep the character limit visible.
- [ ] Validate empty questions.
- [ ] Add two or three example questions.
- [ ] Disable duplicate submission while a request is pending.
- [ ] Show a loading state that explains what is happening: searching evidence, then writing explanation.

### P0 answer panel

- [ ] Show the plain-English answer first.
- [ ] Show a found/not-found/needs-review status.
- [ ] Show exact evidence text.
- [ ] Show source and section metadata.
- [ ] Show evidence strength without pretending it is legal certainty.
- [ ] Add a “Why this answer?” explanation.
- [ ] Add the grounded next step when available.
- [ ] Keep the disclaimer visible but unobtrusive.

### P0 trust and failure states

- [ ] Empty state before the first question.
- [ ] Loading state.
- [ ] Found state.
- [ ] Partial-evidence state.
- [ ] Not-found state.
- [ ] Invalid-source state.
- [ ] Provider-unavailable state.
- [ ] Timeout state.
- [ ] Rate-limit state.
- [ ] Network-offline state.

### P0 accessibility and responsive quality

- [ ] Keyboard-complete source selection and question flow.
- [ ] Visible `:focus-visible` treatment.
- [ ] Correct labels for every form control.
- [ ] Appropriate `aria-live` behavior for answer updates.
- [ ] Screen-reader-friendly status labels.
- [ ] Sufficient color contrast.
- [ ] No information conveyed by color alone.
- [ ] Touch-safe button sizes.
- [ ] No horizontal overflow at 320px.
- [ ] Usable layout at mobile, tablet, and desktop widths.
- [ ] Respect `prefers-reduced-motion`.
- [ ] Avoid hover-only interactions.

### P1 high-impact polish

- [ ] Add a compact share/copy evidence card.
- [ ] Add suggested follow-up questions after an answer.
- [ ] Add an evidence drawer or expandable source view.
- [ ] Add a “compare two policies” feature only if the core flow is already stable.
- [ ] Add a small visual explanation of the retrieval pipeline for the demo video.

## Milestone 5 — Evaluation and quality evidence

### P0 evaluation dataset

Create `data/evaluation/questions.json` with at least 25 manually reviewed cases:

- [ ] 8 directly answerable questions.
- [ ] 6 paraphrased questions.
- [ ] 4 multi-condition questions.
- [ ] 4 unsupported questions.
- [ ] 3 adversarial or misleading questions.

### P0 metrics

- [ ] Measure retrieval hit@3.
- [ ] Measure citation-support rate.
- [ ] Measure unsupported-question abstention rate.
- [ ] Measure malformed-response rejection rate.
- [ ] Measure local response latency.
- [ ] Measure hosted response latency.
- [ ] Save the actual results in `docs/evaluation.md`.
- [ ] Label all numbers as measured results, not projected claims.

Suggested targets:

- [ ] At least 85% retrieval hit@3.
- [ ] 100% citation coverage on positive demo cases.
- [ ] At least 95% correct abstention on unsupported cases.
- [ ] Zero fabricated answers in the final recorded demo.
- [ ] Local fixture response under one second.
- [ ] Hosted response within an acceptable live-demo window.

### P0 automated tests

- [ ] Retrieval unit tests.
- [ ] Chunking and metadata tests.
- [ ] Answer-contract validation tests.
- [ ] Not-found tests.
- [ ] Empty and oversized input tests.
- [ ] Provider error and timeout tests.
- [ ] Citation/document-integrity tests.
- [ ] API route tests.
- [ ] Production build test.

### P0 manual usability test

- [ ] Test with at least three peers or students.
- [ ] Ask whether the purpose is clear within five seconds.
- [ ] Ask whether they can identify the evidence.
- [ ] Ask whether the not-found state is understandable.
- [ ] Test keyboard-only navigation.
- [ ] Test mobile width.
- [ ] Record actual feedback and resulting changes.

## Milestone 6 — Security, privacy, and reliability

- [ ] Do not commit API keys, tokens, cookies, or deployment credentials.
- [ ] Do not include real student names, IDs, grades, or private records.
- [ ] Do not transmit unnecessary personal information to the AI provider.
- [ ] Sanitize rendered source content.
- [ ] Prevent prompt injection from source-document text.
- [ ] Add request size limits.
- [ ] Add rate limiting or a documented demo limit.
- [ ] Avoid exposing internal error details to users.
- [ ] Add a Content Security Policy if compatible with deployment.
- [ ] Review third-party package licenses.
- [ ] Keep synthetic sources clearly labelled.
- [ ] Document known limitations.
- [ ] Document that PolicyLens is an explainer, not official school, legal, or medical guidance.

## Milestone 7 — Deployment and operations

- [ ] Choose one hosting target for the frontend and API.
- [ ] Add production environment variables through the host dashboard.
- [ ] Configure a health check or smoke-test route.
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

- [ ] Update `README.md` with the final product story.
- [ ] Document local setup.
- [ ] Document the production demo URL.
- [ ] Document the architecture.
- [ ] Document the retrieval and AI boundaries.
- [ ] Document the model/provider used, if any.
- [ ] Document fallback behavior.
- [ ] Document evaluation methodology and measured results.
- [ ] Document privacy, safety, and limitations.
- [ ] Document attribution and third-party licenses.
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

- [ ] Add a clear project title.
- [ ] Add a one-sentence tagline.
- [ ] Explain the student problem.
- [ ] Explain the PolicyLens solution.
- [ ] Explain what makes it different from a generic chatbot.
- [ ] Explain the retrieval/evidence/abstention pipeline.
- [ ] Explain the technology stack.
- [ ] Explain the AI safety and privacy boundaries.
- [ ] Explain what was learned.
- [ ] Link the live demo.
- [ ] Link the source repository.
- [ ] Embed the demo video.
- [ ] Add screenshots.
- [ ] State limitations honestly.
- [ ] Do not claim user counts, accuracy, impact, or partnerships without evidence.

## Final verification checklist

- [ ] `npm install` succeeds from a clean checkout.
- [ ] `npm run dev` starts the application.
- [ ] `npm run build` succeeds.
- [ ] `npm test` succeeds.
- [ ] `npm run evaluate` succeeds.
- [ ] `npm run verify` succeeds.
- [ ] `git diff --check` succeeds.
- [ ] No secrets are present in tracked files.
- [ ] No private data is present in tracked files.
- [ ] The live URL loads from an incognito browser.
- [ ] The core demo flow works end to end.
- [ ] The unsupported-question flow abstains.
- [ ] The repository is clean except for intentional, committed work.
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
