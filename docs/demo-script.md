# PolicyLens demo script

Target length: 90–120 seconds.

Use the verified Render URL for the final recording: `https://hacksocial-policylens.onrender.com`. If the service is cold-starting, wait for the page to become responsive before recording; do not claim a latency measurement.

## 0:00–0:15 — Problem and promise

“Students and families often need one answer from a long school policy, but a fluent chatbot is not trustworthy if it cannot show its evidence. PolicyLens is a citation-first assistant: it answers in plain English when the selected source supports the question, and it says when the evidence is missing.”

Show the landing view and the three clearly labelled synthetic source choices.

## 0:15–0:30 — Select a source

Select “Attendance & absences.” Point out that the source is explicitly marked as synthetic, and show the organization/source metadata. Explain that this keeps the demo honest and avoids presenting invented text as an official school rule.

## 0:30–0:55 — Ask a direct question

Ask: “What should I do if I will be absent?”

Show the found state. Read the plain-English answer, then open the evidence area and point to the exact “Reporting an absence” passage. Mention that the next step and disclaimer are grounded guidance, not legal or official school advice.

## 0:55–1:10 — Explain the evidence boundary

Open “Why this answer?”

“PolicyLens separates the explanation from the source text. The answer is shown because this passage matched the question and passed the evidence threshold. The quote is preserved exactly so a student can inspect what the source actually says.”

## 1:10–1:25 — Show a natural-language variant

Ask: “How do I tell the school my child won’t be there?”

Show that normalized wording can still retrieve the attendance passage. If the screen or environment does not produce the expected result, use the recorded evaluation case instead of improvising a claim.

## 1:25–1:45 — Show abstention

Ask: “What is the school lunch menu?”

Show the not-found state. “This is an important product behavior: there is no supporting passage, so PolicyLens does not invent an answer. It tells the user what source or school office to check next.”

## 1:45–2:00 — Close with AI and impact

“The default demo is deterministic and needs no credentials. The optional server-side AI boundary receives only the question and retrieved evidence, requires exact citations, validates the response, and falls back locally if the provider fails. PolicyLens helps students understand everyday rules while keeping the evidence boundary visible.”

End on the answer panel and the one-line impact statement. Do not show API keys, private data, or an unverified live URL.

## Recording checklist

- [x] Use the verified Render URL: `https://hacksocial-policylens.onrender.com`.
- [ ] Hide terminals, secrets, personal browser tabs, and private records.
- [x] Capture the source-selection, found, evidence-explanation, and not-found states.
- [ ] Keep the final recording between 90 and 120 seconds.
- [ ] Verify every URL in the final frame before publishing.

