# PolicyLens final release checklist

Release branch: `codex/policylens-prize-max`

PolicyLens is already submitted to HackSocial 2026. Keep this branch separate from `main`; update the existing Devpost project only after each release gate has evidence.

## Completed in this release slice

- [x] Replace the external URL control with an explicit demo-boundary note.
- [x] Label the deterministic, credential-free demo mode near the primary workflow.
- [x] Add pointer-aware hover states, press feedback, and reduced-motion-safe transitions.
- [x] Add `npm run smoke` for health, app-shell, grounded-answer, and abstention checks.
- [x] Add Node 22 GitHub Actions verification and dependency audit.
- [x] Refresh README, Devpost copy, evaluation notes, and the demo script without stale claims.

## Before publishing the release

- [x] Run `npm ci`, `npm run verify`, `npm run smoke`, and `npm audit --omit=optional --audit-level=moderate` from the final checkout.
- [x] Publish the feature branch through the connected GitHub integration.
- [x] Deploy commit `71ace683e292a5f8edd00635e52e8e5c793429ea` to Render with `npm ci && npm run build`, `npm start`, and `/healthz` as the health check.
- [x] Run `npm run smoke -- --base-url https://hacksocial-policylens.onrender.com`.
- [x] Test the live app in a fresh hosted browser with supported, comparison, and unsupported questions.
- [x] Verify desktop rendering, local 320px mobile layout, visible focus, copy evidence, comparison, loading, and no console errors. Incognito/private-browser and complete keyboard-only verification remain open.
- [x] Record the live URL, deployment date, and exact commit; do not claim hosted latency because it was not benchmarked.
- [x] Capture the source-selection, found-answer, “Why this answer?”, and not-found screenshots.
- [ ] Record and publish the 90–120 second demo video without secrets or private data.
- [x] Update the existing Devpost entry with the live demo, repository, and final description; video and screenshot uploads remain open until those media assets are published.
- [x] Re-submit the existing Devpost project and confirm the submitted state.

## Explicitly deferred

- [ ] Semantic embeddings or reranking.
- [ ] Arbitrary URL fetching or crawling.
- [ ] Authentication, persistence, databases, or multi-school tenancy.
- [ ] New provider credentials or claims about hosted AI generation.

## Honest boundaries

- Demo policies are synthetic examples, not official school guidance.
- External policy URLs are not fetched.
- The deterministic fallback is the reproducible source of truth when no provider is configured.
- PolicyLens is an explainer; important decisions should be confirmed with the relevant school or support team.
