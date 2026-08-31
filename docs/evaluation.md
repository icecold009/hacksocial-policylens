# PolicyLens retrieval evaluation

Measured locally on **August 26, 2026** with:

```bash
npm run evaluate
```

The dataset contains 25 manually reviewed synthetic-policy cases: 8 direct questions, 6 paraphrased questions, 4 multi-condition questions, 4 unsupported questions, and 3 adversarial or misleading questions.

| Measure | Result |
| --- | ---: |
| Overall expected outcome | 25/25 |
| Retrieval hit@3 for cases with an expected section | 15/15 |
| Found-answer citation support | 15/15 |
| Malformed-response rejection (synthetic invalid samples) | 3/3 |
| Unsupported-question abstention | 4/4 |
| Multi-condition review routing | 4/4 |
| Adversarial evidence-boundary cases | 3/3 |

The latest local run also measured a maximum deterministic answer latency of under one second. These are measured results for the deterministic local retrieval fallback, not claims about a hosted AI provider. The server-side provider boundary is implemented and tested, but no provider is configured in this repository, so hosted latency, generated-answer citation support, and real-document ingestion are not measured yet.

## Rendered local QA

Measured locally on August 26, 2026 against the production-style server at `http://127.0.0.1:8787/`:

- Desktop: page identity, meaningful content, empty state, grounded attendance answer, exact citation, and unsupported-question abstention all rendered successfully.
- Mobile: the explicit 320×800 viewport rendered meaningful content with no horizontal overflow (`scrollWidth` stayed at 320px).
- Interaction: selecting an example question and submitting it produced the found state and “Reporting an absence” citation; submitting “What is the school lunch menu?” produced the not-found state and contract message.
- Clipboard interaction: the copy-evidence action reported “Evidence copied,” and the clipboard contained the selected section plus the exact source quote.
- Follow-up interaction: selecting the alternate attendance question cleared the previous answer and returned the panel to “Ready to search,” preventing stale evidence from carrying over.
- Accessibility/responsive interaction: the rendered build exposes native keyboard controls plus a skip link, the evidence card is a native expandable source view, and the layout had no horizontal overflow at 1280px, 768px, or 320px.
- Comparison interaction: the same attendance question produced the grounded attendance answer plus an explicit “Not found” result for the Personal devices comparison source; the comparison remained visible without mobile overflow.
- Console health: no relevant warning or error logs were reported during the checked flows.

This is local browser evidence, not proof of hosted, incognito, keyboard-only, or cross-browser behavior. The release smoke command now provides a repeatable HTTP check for either the local production-style server or a verified hosted origin; it does not replace rendered browser QA.

## Hosted release verification

Measured on August 30, 2026 against the Render origin `https://hacksocial-policylens.onrender.com`, deployed from commit `71ace683e292a5f8edd00635e52e8e5c793429ea`:

- `npm run smoke -- --base-url https://hacksocial-policylens.onrender.com` passed for `/healthz`, `/`, a grounded answer with evidence, and an unsupported-question abstention.
- A hosted desktop/fresh-tab browser pass completed the grounded attendance answer, comparison control, and unsupported-question flow.
- The browser console reported no warnings or errors during those flows.
- A 320px mobile viewport showed no horizontal overflow during the local browser pass; a hosted mobile pass, incognito/private-browser pass, complete keyboard-only pass, and peer usability study are not claimed.
- Render free-tier cold-start latency was not benchmarked.

## Development-server note

After the Vite 8.2.2 upgrade, `npm run dev:ui -- --host 127.0.0.1 --port 5174` reached the Vite ready state locally. The production-style `npm start` path and `npm run smoke` are release checks. Hosted desktop/fresh-tab behavior is now verified separately from local browser evidence; incognito/private-browser and complete keyboard-only behavior remain unclaimed.

