## Codex package workflow

- Work only on a feature branch. Never edit or merge `main` directly.
- One bounded package uses one feature branch and one pull request.
- Before editing, inspect the current checkout, branch, remote, working tree, backlog, and existing PRs.
- Use the repository’s existing canonical backlog. Do not create duplicate TODO plans.
- Every package must define its goal, scope, non-goals, files, tests, acceptance criteria, and evidence.
- Preserve unrelated work and never discard dirty changes without explicit approval.
- Run the repository’s real verification commands and report exact results and commit SHA.
- Treat local checks, GitHub checks, reviews, hosted testing, deployment, and user-reported evidence as separate.
- Do not fabricate external evidence, live-provider results, deployment results, or review approval.
- Do not merge, deploy, publish, submit, or expose secrets without explicit user approval.
- After implementation, stop for independent ChatGPT validation before the next package.
