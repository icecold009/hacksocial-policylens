# PolicyLens submission checklist

Use this file as the single canonical pre-submission checklist. Check a box only after recording evidence in the relevant section. Keep implementation work on a separate `codex/*` branch and promote it to `main` only through review and explicit approval.

## Submission identity

- Hackathon: HackSocial 2026
- Devpost project: https://devpost.com/software/policylens-xopvfe
- Canonical repository: https://github.com/icecold009/hacksocial-policylens
- Canonical branch: `main`
- Current main head: `b9a636d639509919c1d318a876e923bc6fb391f6`
- Application release checkpoint: `876cdcd621ee25e4eb23650313df30e04c2b02e3`
- Current Render application commit: `b9a636d639509919c1d318a876e923bc6fb391f6`
- Current Devpost deadline recorded from Devpost: 2026-08-31 21:00 UTC / 2026-09-01 02:30 IST. Re-check the live deadline before the final update.

## 1. Eligibility and submission identity

- [ ] Confirm every team member is registered for HackSocial 2026 and eligible under the current rules.
- [ ] Confirm the team has no more than four members and is entered in only one team.
- [ ] Confirm student, age, and geography requirements for every team member.
- [x] Confirm this is the existing published PolicyLens Devpost project (ID `1398136`), not a second submission.
- [x] Confirm the repository is public and its default branch is `main`.
- [x] Confirm the repository contains no secrets or private data.
- [x] Re-check the live deadline and submission state immediately before the final Devpost update. Devpost connector check at `2026-08-31T17:38:04Z` reported `submissions_open` through `2026-08-31T21:00:00Z`.

## 2. Canonical release and repository hygiene

- [x] Promote the verified prize-max release through PR #3 into `main`.
- [x] Record the final documentation checkpoint: `b9a636d639509919c1d318a876e923bc6fb391f6`.
- [x] Resolve stale PRs: PR #1 and PR #3/#4 merged; stale draft PR #2 closed as superseded.
- [x] Remove obsolete remote branches; GitHub currently reports only `main`.
- [x] Confirm the local checkout tracks `origin/main` at `b9a636d`.
- [x] Run `git diff --check`.
- [x] Pass Node 22 GitHub Actions verification on `main` (run #13).
- [x] Run `npm ci` from the lockfile.
- [x] Run `npm run verify` (53 tests pass; evaluation 25/25).
- [x] Run `npm run smoke` against the local production server.
- [x] Run `npm audit --omit=optional --audit-level=moderate` (0 vulnerabilities).
- [ ] Re-run every release gate after the final code or deployment change.
- [ ] Confirm the final review branch has no unrelated files or untracked release artifacts. Preserve the user-supplied `AGENTS.md` unless it is intentionally added in a separate package.

## 3. Product behavior and trust boundaries

- [x] Curated synthetic policy sources are clearly labeled as deterministic demo content.
- [x] The UI states that external arbitrary policy URL import is not enabled in this demo.
- [x] A supported question returns a grounded answer with exact evidence.
- [x] A paraphrased supported question passes the local evaluation suite.
- [x] An unsupported question abstains instead of guessing.
- [x] The comparison flow works in the hosted desktop browser pass.
- [x] “Why this answer?” and evidence-copy controls are present.
- [x] Loading, visible focus, reduced-motion, pointer-aware hover, and press-feedback styles are implemented.
- [x] Confirm the live Render origin is healthy and hosted smoke passes. After the transient Render Singapore incident cleared, `/healthz` returned HTTP 200 with `{\"status\":\"ok\",\"checks\":{\"build\":\"ok\"}}` and hosted smoke passed on 2026-08-31.
- [x] Hosted desktop supported and unsupported flows complete with no console errors.
- [ ] Complete a fresh incognito/private-browser test of the hosted supported, paraphrased, comparison, and unsupported flows.
- [ ] Complete a keyboard-only walkthrough and record visible focus plus usable primary controls.
- [ ] Test the hosted app around a 320px viewport and confirm no horizontal overflow.
- [ ] Measure hosted cold-start or answer latency before making any hosted-performance claim.
- [ ] Run an optional peer usability test and record the participant count and findings.

## 4. Deployment alignment

- [x] Render uses `npm ci && npm run build` and `npm start`.
- [x] Configure the Render Health Check Path as `/healthz`; verified in the Render dashboard on 2026-08-31 at 18:08 UTC.
- [x] Record the currently verified Render URL: https://hacksocial-policylens.onrender.com
- [x] Record the currently verified deployed application commit: `b9a636d639509919c1d318a876e923bc6fb391f6`.
- [x] Change the Render service auto-deploy branch to `main`; verified in the Render dashboard and service branch link on 2026-08-31 at 18:08 UTC.
- [x] Trigger a fresh deploy from the intended `main` commit and confirm it succeeds. Render deploy `dep-daas7v3bc2fs738i45e0` reports `Deploy succeeded | Live` for source `b9a636d639509919c1d318a876e923bc6fb391f6`.
- [x] Resolve the transient public availability failure: after the Render Singapore incident moved through recovery, `/healthz` returned HTTP 200 and the deployed service is live.
- [x] Rerun `npm run smoke -- --base-url https://hacksocial-policylens.onrender.com` and repeat hosted browser checks after the repair. Hosted smoke passed; live browser supported, paraphrased, and unsupported flows produced the expected evidence/not-found states with no console logs.
- [ ] Record the final deployment URL, deployed commit, and verification date/time in `README.md`, `docs/evaluation.md`, and the Devpost notes.

## 5. Demo assets

- [x] Capture the landing/source-selection screen.
- [x] Capture a supported answer with evidence.
- [x] Capture the “Why this answer?” explanation.
- [x] Capture the unsupported-question abstention.
- [x] Set the clean landing capture as the Devpost thumbnail.
- [ ] Upload all four final screenshots to the Devpost gallery.
- [ ] Record a 90–120 second video from the live Render app.
- [ ] In the video, state the problem and impact, select a source, show a supported answer and exact evidence, show a paraphrased question, demonstrate abstention, and close with the practical benefit.
- [ ] Check the recording for secrets, private tabs, terminal output, placeholder copy, and misleading live-provider claims.
- [ ] Publish the video and verify that its URL plays in an incognito window.
- [ ] Add the final video URL to the existing Devpost project and verify it was saved.

## 6. Devpost final page

- [x] Keep the existing Devpost project published and editable.
- [x] Set the website to https://hacksocial-policylens.onrender.com.
- [x] Set the repository to https://github.com/icecold009/hacksocial-policylens (root, canonical `main`).
- [x] Include the problem, solution, architecture, AI/Codex use, testing, and limitations in the description.
- [x] Remove stale branch references and placeholder language from the project copy.
- [x] Correct the testing claim to 53 tests and preserve the exact release-commit explanation.
- [x] Re-submit the existing project and confirm its submitted state.
- [ ] Add the final video URL.
- [ ] Upload the four gallery screenshots.
- [ ] Review the published page in an incognito window and open every repository, live-demo, video, and image link.
- [ ] Re-submit/update the existing project after all media and copy changes.
- [ ] Save a final screenshot or timestamped note showing the completed Devpost page.

## 7. Final evidence packet

- [ ] Save the final outputs for `npm ci`, `npm run verify`, `npm run smoke`, and the dependency audit.
- [ ] Save the green GitHub Actions run URL for the final `main` commit.
- [ ] Save hosted smoke output and browser verification notes.
- [ ] Save the final repository, Render, video, and Devpost URLs.
- [ ] Verify the Devpost description names the same `main` release and deployed commit as the final evidence.
- [ ] Final sign-off: no placeholders, no secrets, required links open, and all claims are backed by evidence.

## 8. Explicitly deferred product roadmap

These are not required for the current submission and should not delay the evidence package:

- [ ] Configure and test a real provider only when credentials are available; never commit secrets.
- [ ] Add curated public-source ingestion with rights, attribution, and ingestion tests.
- [ ] Add policy version/change comparison.
- [ ] Add embeddings or reranking only after measuring the deterministic retrieval baseline.
- [ ] Add authentication, persistence, database storage, or multi-school tenancy.
- [ ] Add arbitrary URL ingestion only with allowlisting, SSRF defenses, size/time limits, parsing, rights checks, and tests.

## Evidence update rule

After each completed item, add the command, URL, commit, screenshot path, or manual observation that proves it. If a later change invalidates an item, uncheck it and record the new verification needed. Update this file through its own feature branch and pull request; do not edit `main` directly.

### Current known screenshot paths

- `C:\Users\91829\AppData\Local\Temp\policylens-release\01-landing.png`
- `C:\Users\91829\AppData\Local\Temp\policylens-release\02-supported-answer.png`
- `C:\Users\91829\AppData\Local\Temp\policylens-release\03-why-answer.png`
- `C:\Users\91829\AppData\Local\Temp\policylens-release\04-unsupported-question.png`

