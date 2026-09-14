# GRS Signal — next-chat handover

Prepared 2026-09-13 (America/Los_Angeles).

## Start here

Continue the existing application; do not scaffold a replacement. Repository: [loganmoore8/grs-signal](https://github.com/loganmoore8/grs-signal). Initial delivery branch: `codex/initial-build`. Read this document, `README.md`, `docs/implementation-status.md`, and `docs/runbook.md` before deployment work. Check `git status` for newer user changes.

The complete MVP works locally with fictional data. AWS provisioning, a real Terraform plan/apply, paid research, actual email delivery, and the live pilot remain pending. The current request was to commit/push the app and prepare this handover; it did not request deployment.

## Product and user constraints

- Guided Reach Solutions specializes in Amazon Connect and public-sector contact-center modernization. Find the best 3–5 actionable opportunities automatically, with official evidence and clear next actions.
- Prioritize cloud/CCaaS migrations, AWS/Connect services, IVR, omnichannel, contact-center AI, knowledge, CRM integration and 311 modernization. Suppress staffing/BPO, generic answering services, commodity licenses/hardware, NG911/PSAP and incidental contact-center scope.
- Keep the frontend lean: Recommended, Pursuing, Filtered out, and a detail drawer. No noisy dashboards or additional admin surfaces.
- No manual ingestion or procurement-portal API dependency. Scheduled search-based discovery is the implemented approach; inaccessible sources and incomplete coverage must remain explicit.
- Target roughly $2/day combined operation. Research allowance is $1.25/day and $37.50/month with 30 search calls/day; AWS allowance is $15/month. These are workload controls and estimates, not a guaranteed bill cap.
- Build and verify locally first. Terraform apply belongs at the final deployment stage after a reviewable plan and deployment inputs are ready.

## Current UI direction — preserve it

The user rejected a noisy interface and requested Linear-inspired restraint. The accepted design uses neutral light surfaces, a pale sidebar, subtle separators, compact controls and indigo actions. **Agency is the hero of each list row**, with state inline and the opportunity title underneath; due date and fit sit at the right. Weak matches stay collapsed under More matches.

The latest pass added light Guided Reach branding from guidedreach.com: the original compass PNG, a small “by Guided Reach” attribution, navy wordmark, muted gold active-nav edge and pale gold next-action rule. Keep these accents restrained. No new fonts, dependencies or paid services were introduced. Source attribution and visual verification are in `docs/ui-design-reference.md`.

Primary UI files: `apps/web/components/signal-app.tsx`, `apps/web/app/styles.css`, `apps/web/app/layout.tsx`, and `apps/web/public/guided-reach-mark.png`. Read `apps/web/AGENTS.md` and the relevant installed Next.js guide before editing web code.

## Architecture and code map

| Location                   | Responsibility                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web`                 | Next.js static frontend, Cognito PKCE client, local demo support                                               |
| `services/api/handler.ts`  | List/detail/health and version-checked user updates                                                            |
| `services/research`        | Search provider, resumable scheduled jobs, budgets, alerts                                                     |
| `packages/domain/index.ts` | Contracts, deterministic fit scoring, dedupe, freshness and view rules                                         |
| `packages/storage`         | Local development adapter and production DynamoDB/S3 implementation                                            |
| `config/research.json`     | Model, pricing assumptions, research themes and limits                                                         |
| `config/scoring.json`      | Versioned scoring rubric                                                                                       |
| `infra`                    | Terraform: Amplify, API Gateway, Lambda, Scheduler, DynamoDB, S3, Cognito, Secrets Manager, SES and monitoring |
| `scripts`                  | Local startup, builds, deployment setup and gated live smoke test                                              |
| `tests`                    | 61 tests across 5 files, including 30 labeled qualification scenarios                                          |

The implementation includes conditional leases, persisted provider response IDs, budget reservations, overflow handling, deduplication, evidence, suppression reasons and decision protection. Research does not overwrite user notes/status. Viewing an opportunity does not change its status. All workflow states, pursue/undo, pass reasons and restore remain available.

## Local startup and checks

Use Node.js 22.14+; Node 24 is available on the original machine. Standard commands:

```sh
npm ci
npm run dev
# In another terminal:
npm run check
npm run lint
npm run build
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
```

Original Windows workspace: `C:\Users\Logan\Documents\ChatGPT\GRS-Leads`. Its system Node is older; `scripts/dev.ps1` automatically uses the compatible bundled Node at `C:\Users\Logan\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`. Other scripts can be run with that executable and `--import tsx`, e.g. `scripts/check.ts` and `scripts/build.ts`.

Preview: `http://127.0.0.1:3000`; local API: port 8787. The preview was running when handed over, but process/tool-session handles may not survive a new chat. Check existing listeners before starting another server. `npm run dev` starts both processes. Next.js hot reloads frontend changes; restart the local API process for backend changes.

Local fixture decisions persist in ignored `.local/db.json`; tests use isolated temporary directories. Do not reset local records just to reproduce screenshots. A fresh clone seeds fictional data automatically. Development output uses `.next-dev`, while production uses `.next`, so a production build can run alongside the preview.

Generated artifacts are ignored: `apps/web/out`, `dist/api.zip`, `dist/research.zip`, and `dist/manifest.json`. Rebuild artifacts before planning deployment; historical hashes in the earlier build handoff are not a substitute for the latest manifest. Private env/tfvars files, Terraform plans/state, dependencies and local data are excluded from git.

## Verification and limits

Local type checking, 61 tests, formatting, production static export, Lambda packaging and Terraform validation have passed. Browser acceptance covered desktop and 390px mobile, agency-first rows, branding, drawer, search, notes, pursue/undo, pass/restore and Escape handling. Browser checks were direct acceptance checks, not an automated browser test suite.

During commit preparation the filesystem-heavy overflow test exceeded Vitest's default 5-second timeout on Windows (it completed successfully in about 5.2 seconds when isolated with a longer limit). Only that test now has a 15-second timeout; assertions and application behavior are unchanged.

No live quality/cost claims have been established. In particular, verify the configured model ID, provider capabilities, current API pricing, background/search support, actual tool-call limits and usage accounting before paid smoke testing. Values in `config/research.json` are versioned configuration, not proof of current account availability. Production DynamoDB conditional-write behavior and actual Cognito/SES/Amplify integration need live validation. See the deliberate MVP limits in `docs/implementation-status.md`.

## Next deployment work, when requested

1. Resolve AWS profile/account, protected Terraform state, region, unique Cognito prefix, SES sender/recipients, invited users and Amplify GitHub authorization.
2. Choose the production branch before planning. The initial code is on `codex/initial-build`; the Terraform example uses `main`. **Do not simply set the Terraform branch to the slash-containing development branch**: current `infra/auth-hosting.tf` interpolates the branch into hostname/callback URLs. Establish a DNS-safe release branch such as `main`, or implement and verify correct Amplify branch URL handling first.
3. Rebuild artifacts; produce and review a real saved plan. Do not commit private inputs, state, plans or API keys.
4. At final deployment, follow `docs/runbook.md` for apply, secret injection, invitation and hosting release. Worker readiness remains off until explicitly enabled after successful live checks.
5. Run bounded live checks, then the seven-day unattended pilot and complete `docs/pilot-report.md`. Measure source accuracy, shortlist precision, duplicate handling, reliability and combined costs.

Build-plan items B01–B35 and B37 are complete; B36 is partially complete (local Terraform validation passed, real plan pending). B38–B40 are deployment/live-pilot work.

## Suggested continuation prompt

“Read docs/NEXT-CHAT-HANDOVER.md and inspect the current repository. Continue from this implemented MVP, preserving the lean agency-first UI and subtle GRS branding. Report the concrete next deployment prerequisites; keep Terraform apply and paid research for the final deployment stage.”
