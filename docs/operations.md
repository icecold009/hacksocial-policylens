# Operations and privacy

## Runtime data flow

The default demo uses the curated synthetic policies bundled with the app. The browser sends a policy ID and question to the answer service. The local retrieval code returns passages and an answer; the service does not persist questions or log request bodies.

External transmission is opt-in and server-side:

- TypeSafe runs only when `POLICYLENS_TYPESAFE_MODE` is `shadow` or `active` and all required credentials/configuration are valid. It receives the question, policy ID, and up to three retrieved candidates with their IDs, headings, text, retrieval scores, and matched terms. Its response can select only a supplied candidate. `off` is the default.
- The optional explanation provider runs only for found evidence with a configured endpoint, key, and model. It receives the question and one selected passage with its section, quote, source URL, and the application-approved answer and next step. The returned answer is accepted only when those approved fields and the exact citation are unchanged.
- Upstream services apply their own retention and logging rules. Do not enter real student information or private school records.

There is no user account, database, analytics, or document-upload path in this demo.

## Request and provider limits

Limits are in-memory and apply independently in each running Node process:

| Limit | Default |
| --- | ---: |
| Requests per client key | 30 per minute |
| In-flight answer requests | 8 |
| Concurrent upstream fetch attempts shared by both adapters | 4 |
| Upstream fetch attempts shared by both adapters | 20 per minute |
| Browser answer deadline | 12 seconds |
| TypeSafe timeout / attempts | 3 seconds / 2 |
| Explanation provider timeout / attempts | 6 seconds / 2 |

The upstream budget counts each actual fetch attempt, including retries; it is a request-volume cap, not a monetary spend limit. Configure spend limits with the provider as well. Process restarts reset these counters, and multiple service instances each have an independent budget. Use a shared rate-limit store before scaling horizontally.

By default, client identity uses the direct socket address. Set `POLICYLENS_TRUST_PROXY=true` only when the hosting proxy is trusted and overwrites `X-Forwarded-For`; otherwise clients can choose a spoofed forwarded value. Direct-IP limits also mean students behind one school NAT share a bucket. There is no distinct student identity in this anonymous demo.

## Health and release identification

`GET /healthz` reports whether the built app shell is present and returns a release label. Configure `POLICYLENS_RELEASE_ID` with a short commit SHA or release ID to populate it. The response accepts only 1–80 ASCII letters, digits, dots, underscores, or hyphens; missing or invalid values report `unknown`. This endpoint does not prove the provider, database, or external policy source is healthy.

## Local release checks

Run these commands from a clean feature-branch checkout:

```sh
npm ci
npm run verify
npm run smoke
npm audit --omit=optional --audit-level=moderate
npm run measure:latency
```

`npm run measure:latency` builds on the checked-in `dist` and starts the configured local API only when its port is free; it refuses to start a second instance. `npm run measure:latency -- https://host.example` probes the supplied service without starting a local process. Both modes send two warm-up and ten measured synthetic answer requests, validate that each answer has evidence, and report median and p95. The report includes only the base URL, release ID, and aggregate times. A successful local run does not establish hosted latency. Record the target, release ID, date, and sample count with any measurement.

## Outage and rollback procedure

1. Check `/healthz`, the GitHub Actions run for the exact feature commit, and provider status without exposing credentials or request content.
2. Run `npm run smoke -- --base-url <service-origin>` from an authorized environment to check app shell, health, a synthetic found answer, and a synthetic abstention.
3. For a provider outage, leave TypeSafe off or shadow and allow deterministic fallback. For API saturation, 429 and 503 responses include `Retry-After`; wait before retrying.
4. If a release is unhealthy, use the hosting dashboard to redeploy the previous known-good release, then rerun health, smoke, and a browser pass. This repository does not automate or perform a production rollback.
5. Record the failing release ID, deployment, observed symptom, rollback target, and verification result. Never copy questions, provider payloads, secrets, or student data into incident notes.

Hosted performance and deployment status must be measured separately from local checks. A PR, CI run, local browser run, or old deployment record does not prove the current hosted service is updated or healthy.
