# Attribution and licenses

## Policy content

All policy text in this repository is synthetic content created for the PolicyLens demo. It is not copied from a real school handbook, and no student records or private school documents are included. The source metadata marks these fixtures as synthetic and carries an explicit source-rights note.

## Direct project dependencies

The direct dependencies declared in `package.json` and installed from `package-lock.json` are MIT-licensed:

| Package | Installed version | License | Role |
| --- | --- | --- | --- |
| React | 18.3.1 | MIT | UI runtime |
| React DOM | 18.3.1 | MIT | Browser rendering |
| Vite | 5.4.21 | MIT | Development server and production bundler |
| `@vitejs/plugin-react` | 4.7.0 | MIT | React-aware Vite integration |

The installed dependency tree was checked locally on August 26, 2026: 63 package manifests reported a license field and none were missing one. Recheck dependency metadata before redistributing a future lockfile or adding new packages.

## External services

The default demo does not call an external AI provider, database, analytics service, or document-hosting service. The optional provider adapter is disabled unless all three `POLICYLENS_AI_*` environment variables are configured server-side.
