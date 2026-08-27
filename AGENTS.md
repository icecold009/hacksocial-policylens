# PolicyLens agent instructions

## Branch and package boundaries

- Never implement directly on `main`. Start each package on a new `codex/<package-id>-<slug>` branch from the latest `origin/main`.
- `TODO.md` is the only active implementation queue. Do not create a second roadmap or checklist.
- Implement one coherent package per branch and pull request. Use the package issue's outcome, scope, non-goals, acceptance criteria, and verification steps as the boundary.
- Do not mix cleanup, dependency upgrades, deployment changes, or unrelated polish into a package unless the package explicitly includes them.
- Never force-push or rewrite shared history.

## Before implementation

- Inspect the current branch, `git status --porcelain=v1 --untracked-files=all`, the applicable `AGENTS.md`, and the relevant `TODO.md` entries.
- Compare the proposed branch with `origin/main`. Stop and report if the branch has an unexpectedly broad diff or contains unrelated work.
- Preserve pre-existing changes. Do not discard, overwrite, or commit work that does not belong to the package.
- Resolve missing product, architecture, privacy, or deployment decisions before coding when they would materially change the package.

## PolicyLens product contracts

- Keep answers citation-first and fail closed: a `found` answer requires supporting evidence; insufficient evidence must become `not_found` or `needs_review`.
- Never cite a passage from the wrong policy or present generated explanation text as source text.
- Keep provider credentials and provider calls server-side. Never expose secrets, raw provider payloads, private records, or raw user questions in logs or browser bundles.
- Preserve the deterministic local fallback and honest provider-unavailable behavior.
- Use only public or clearly labelled synthetic policy content. PolicyLens is an explainer, not official school, legal, or medical guidance.

## Verification and evidence

- Run `npm run verify` for every implementation package.
- For rendered UI changes, also perform browser checks for the affected flow, keyboard/focus behavior, reduced motion, mobile overflow, loading, and failure states.
- Treat local, CI, preview, production, and physical-device results as separate evidence. Do not claim a layer that was not tested.
- Update the relevant `TODO.md` item and evidence in the same package. Tick a task only after its stated gate passes.

## Commits and pull requests

- Make logical checkpoint commits on the feature branch.
- When the package authorizes publication and GitHub access is available, push the feature branch and open a draft pull request targeting `main`.
- Use the pull request template. Include the package ID, changed behavior, non-goals, verification evidence, risks, deferred work, and deployment impact.
- Keep the pull request draft while required evidence is missing or checks are failing.
- Do not merge, deploy, change production settings, or submit to Devpost without explicit user approval.

## Code Review Rules

### Evidence boundary

- Flag any path that can return `found` without exact supporting evidence, accept a citation from another document, or silently turn weak/ambiguous retrieval into a confident answer.
- Flag any UI copy or documentation that presents local fixture behavior, synthetic data, or unverified results as hosted, production, real-world, or externally validated evidence.

### Privacy and provider boundary

- Flag secrets or private data in tracked files, browser-delivered code, logs, test fixtures, screenshots, or error responses.
- Flag provider requests that include more than the bounded user question and retrieved evidence, or provider responses that bypass answer-contract validation.

### Release safety

- Flag changes that weaken `npm run verify`, bypass the draft-PR and explicit-merge gate, or deploy a SHA different from the reviewed and verified SHA.
- Leave formatting and other deterministic mechanical checks to CI.
