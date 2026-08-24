# PolicyLens

PolicyLens is a privacy-conscious AI/ML MVP for helping students understand public school policies. A user selects a synthetic sample document or provides the URL of a public policy, asks a question, and receives a plain-English answer with supporting evidence—or an explicit not-found state.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

The app is intentionally small and dependency-light for an older laptop. The current demo runs entirely in the browser and does not require credentials, a database, or an AI provider.

## Current MVP scope

- Choose between clearly labelled synthetic sample policies.
- Enter a question and match it against the selected policy's local passages.
- Show a plain-English response, the supporting passage, and a source/section label.
- Show a distinct not-found state when no passage matches.
- Accept a public policy URL as a source selection, while honestly leaving fetching for the next slice.

## Recommended HackSocial track

**AI/ML** — the next implementation slice can add retrieval-augmented generation (RAG): extract text from a public document, retrieve relevant passages, ask an AI model for a constrained explanation, and return citations plus a confidence/not-found decision.

## Privacy boundaries

- No real student information, private school records, or credentials belong in this repository.
- Use only public documents or synthetic samples; confirm that a document is public before adding it.
- Never place API keys in source code. Use a server-side secret boundary when an AI provider is added.
- Keep the not-found behavior fail-closed: if evidence is missing, do not invent an answer.
- Treat an AI response as an explanation layer, not official legal or school guidance.

## Submission checklist

- [ ] Add a documented public sample policy or keep the included synthetic samples.
- [ ] Add the retrieval and AI layer behind a server-side credential boundary.
- [ ] Return source passages and an explicit not-found state for every question.
- [ ] Test empty, ambiguous, unsupported, and long questions.
- [ ] Document the model, prompt constraints, evaluation examples, and known limitations.
- [ ] Run `npm run build` before submission.
- [ ] Keep secrets, private data, and deployment credentials out of Git history.

