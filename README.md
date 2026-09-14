# GRS Signal

A lean internal procurement intelligence app for Guided Reach Solutions. Daily research discovers and qualifies public-sector contact-center modernization opportunities. The frontend has Recommended, Pursuing, and Filtered out views with a source-backed detail drawer.

**Deployed:** AWS infrastructure is provisioned in `us-west-2`. Production research uses Claude Sonnet 4.6 on Amazon Bedrock with AgentCore Web Search, model-directed follow-up searches, and procurement-document retrieval. See [deployment status](docs/deployment-status.md) for live checks and remaining gates. The local preview contains clearly labeled fictional opportunities.

## Local quick start

Use Node.js 22.14+ (Node 24 is also supported).

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The command starts the local API, seeds fictional data only when storage is empty, and runs Next.js. Local records persist in ignored `.local/db.json`. No cloud credentials are needed. The demo login is accepted only by the loopback development API; production uses Cognito and rejects missing authentication.

For this machine, a compatible bundled Node executable is available at `C:/Users/Logan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; the system Node installation is older. Use `scripts/dev.ps1` to launch with the compatible runtime automatically.

## Checks and builds

```sh
npm run typecheck
npm test
npm run build
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
```

Production frontend output is `apps/web/out`; Lambda packages are `dist/api.zip` and `dist/research.zip`. Both are ignored generated artifacts. Production builds remove the local demo path and require deployment configuration to sign in.

`npm run demo:research` exercises the fake research provider and persisted pipeline, capturing meaningful alert emails under `.local/snapshots/mail`. It never contacts OpenAI or sends email. A daily run is idempotent, so running it again on the same day does not create a second batch. Automated tests use isolated temporary directories. Artifact hashes are written to `dist/manifest.json`.

## Deployment boundary

Finish local acceptance before running `terraform apply`. The initial AWS apply is complete. Review a saved Terraform plan before applying subsequent changes. Follow [the runbook](docs/runbook.md) for the final plan, apply, configuration, and live checks. The worker defaults to not ready even if schedules exist. The worker uses IAM for Bedrock inference and AgentCore search.

- [Product specification](GRS-SIGNAL-MVP-SPEC.md)
- [Build plan](BUILD-PLAN.md)
- [Implementation status](docs/implementation-status.md)
- [Local build handoff and verification](docs/build-handoff.md)
- [Next-chat handover and continuation notes](docs/NEXT-CHAT-HANDOVER.md)

Local tests establish software behavior. They cannot establish real-source coverage, account permissions, hosted search quality, actual API limits, or the approximately $60/month operating projection. Those remain post-deployment pilot checks.
