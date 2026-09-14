# Implementation status

Local MVP implemented; deployment and live validation are pending. No AWS resources, paid OpenAI requests, or real alert emails were created during the build.

## Delivered

- Next.js static frontend: Recommended, Pursuing, Filtered out, search, evidence brief, score explanation, notes, next action/date, workflow status, pursue/undo, pass reasons and restore. Desktop and 390px mobile layouts checked in the browser.
- Local persistent API and fictional research adapter. Production Cognito code uses authorization code with PKCE, session renewal and sign-out. API Gateway JWT enforcement is defined in Terraform.
- Scheduled research: three discovery themes, rotating geography, priority rechecks, provenance checks, strict output contracts, deterministic scoring, contextual suppression and canonical identity matching.
- Conditional leases, persisted response IDs, overflow queue, checkpointed candidate counts, bounded retries, and retained reservations for ambiguous submissions. No portal API or manual ingestion dependency.
- Shared research allowance: $1.25/day, $37.50/month, 30 search calls/day. A $15 AWS allowance produces a planned $52.50/month total; this is not a guaranteed bill cap. A combined forecast at $55 sends an operational alert.
- SES change/deadline digests with send markers; incident detection; CloudWatch/SNS worker-error alerts. Terraform includes private evidence storage, retention, IAM, tables/indexes, hosting, authentication and schedules.
- Production web output, Lambda ZIPs and SHA-256 manifest, final-deployment setup/smoke/enable/pause scripts, configuration examples and runbook.

## Verification

Tests cover domain contracts, 30 synthetic qualification scenarios, provider contracts, budget races, failed and ambiguous requests, queue overflow, deduplication, API authorization/decision preservation, digest duplication and cost estimates. Browser checks exercised pursue, pass, restore, saved notes, nested dialog dismissal, and desktop/mobile layouts. See [the build handoff](build-handoff.md) for final command results.

Synthetic cases test qualification rules against supplied facts. They do not establish live extraction accuracy, procurement coverage or live shortlist precision. Local persistence is a development adapter, not a DynamoDB emulator; transaction behavior requires post-apply parity checks.

## Deliberate MVP choices and limits

- One OpenAI provider. No portal-specific crawlers, manual imports, CRM synchronization, scoring editor or separate admin dashboard. Rejection reasons are retained; rubric changes are versioned configuration/code changes.
- GSI queries collect/rank the view, then paginate the API response. At 5,000 queried records the request fails rather than returning a misleading top five. Archive/query expansion is required before that scale. GSI lists are eventually consistent; a just-saved decision may briefly remain in its old list.
- Candidate queue entries are structured research results. The 15-record qualification cap controls publication into opportunity records; tool/token limits bound provider work. Overflow is retained and aged forward.
- Excerpts, facts and raw provider responses are retained; raw responses expire after 90 days. This does not mirror every source PDF. The pilot must validate excerpt accuracy and official-source assertions.
- Material-change detection covers service categories, platform, deadlines, state and blockers, not every prose edit. Conflicting deadlines retain the prior date and stay off the shortlist until resolved. Activity is capped at 100 entries per opportunity.
- API cost uses reported usage and configured rates. Actual AWS billing is unavailable in the app and must be reconciled during the pilot. Reservations control workload, not the provider's exact invoice. Uncertain email outcomes are retained instead of blindly retried.
- No standalone browser-test harness is bundled. Browser acceptance was exercised directly; unit/integration checks are reproducible with `npm run check`.

## Final deployment work

1. Supply AWS/account, repository/branch, sender/recipient and Cognito-domain inputs. Confirm Amplify repository authorization, SES readiness and SNS subscriptions.
2. Commit/push the release, build artifacts, configure protected state and review the real saved Terraform plan. Backend-free validation has run; plan/apply have not.
3. At final deployment, apply the reviewed plan, inject the secret, invite users and release hosting using the prepared scripts.
4. Verify hosted sign-in, storage/conditional writes, S3, SES and the bounded paid model smoke test. Verify actual `max_tool_calls` enforcement and usage reporting. The smoke test shares the deployed budget ledger.
5. Enable readiness after those checks, then run seven unattended days and complete [the pilot report](pilot-report.md), including measured quality and combined cost.

Use [the runbook](runbook.md) for commands and recovery. Worker readiness remains off until enabled during final deployment.
