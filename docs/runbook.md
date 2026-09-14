# GRS Signal operating runbook

## Build first

Complete local checks and generate artifacts. The repository must be committed/pushed to the configured Amplify repository before the final hosted build. No apply, cloud environment, paid research, or real email delivery is part of ordinary development.

Use Node 22.14+ and the committed npm/provider lockfiles. Terraform HCL targets Terraform 1.14+ and AWS provider 6.x. Run:

```sh
npm ci
npm run check
npm run build
terraform -chdir=infra fmt -check -recursive
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
```

## Final deployment prerequisites

1. AWS credentials/profile with deployment access; choose `us-west-2` unless there is a reason to change it.
2. Copy `infra/terraform.tfvars.example` into ignored `infra/terraform.tfvars` and enter repository, branch, unique Cognito prefix, sender, and recipients.
3. Ensure Amplify's GitHub app is authorized for the repository. No repository token is stored in Terraform. If the account/repository connection requires setup, complete it at deployment time before applying hosting resources.
4. Use an existing protected remote Terraform backend if available. Otherwise the first deployment uses protected local state; keep it out of git, restrict access, back it up securely, and migrate to a protected shared backend before another operator uses Terraform. Do not create a bootstrap environment during the local build.
5. Verify the SES sender email when AWS issues the verification request. In the SES sandbox, recipients must also be verified; production access is an account prerequisite if needed. Application automation does not eliminate one-time account verification.
6. Build Lambda ZIPs and retain the exact artifacts used by the plan. Terraform must be replanned if artifacts or inputs change.
7. Confirm the SNS email subscriptions for operational recipients. These cover worker failures separately from application SES digests.

## Plan and apply at the end

```sh
terraform -chdir=infra init
terraform -chdir=infra plan -out=release.tfplan
terraform -chdir=infra show release.tfplan
# Final infrastructure deployment only:
terraform -chdir=infra apply release.tfplan
```

Plans/state may contain sensitive infrastructure configuration. Do not commit or publish them. Review IAM, hosting URLs, callback URLs, schedule targets, resource retention, and anticipated costs. The configuration protects opportunities/history/evidence from accidental destruction.

## Configure the deployed application

The setup script never runs from Terraform, ordinary builds, tests, or preview startup. Set `ALLOW_DEPLOYMENT_SETUP=true` in your process environment at deployment time. Supply comma-separated `INVITE_EMAILS` for initial users. Research uses `us.anthropic.claude-sonnet-4-6` through Bedrock Converse and AgentCore Web Search in `us-east-1`. Terraform provisions the IAM-authenticated gateway and connector, and grants the worker only the model and gateway invocation permissions. No API key is needed.

```sh
npx tsx scripts/deployment.ts configure
npx tsx scripts/deployment.ts release-web
npx tsx scripts/deployment.ts smoke
```

`configure` sends invitations to the explicitly configured emails. `release-web` runs and checks the Amplify build. `smoke` verifies unauthenticated access rejection and a no-spend readiness guard. It does not prove the authenticated app or Bedrock integration.

Complete sign-in, real storage read/write, correct sources, and SES checks. For a separate bounded Bedrock/search test, set `ALLOW_LIVE_RESEARCH=true` and run `npx tsx scripts/live-research-check.ts`. This paid test reserves the configured token allowance (currently $0.27802) and two search calls against the deployed ledger, settles returned usage and saves a snapshot. It fails if the result is incomplete, malformed, or exceeds the search-call bound. Schema-valid empty or partial findings pass the operational check; inspect evidence separately and evaluate coverage during the pilot. Do not run it repeatedly or in CI. Validate actual compatibility, citation handling, evidence and usage before declaring live research ready.

After live checks pass, set `LIVE_CHECKS_PASSED=true` and run:

```sh
npx tsx scripts/deployment.ts enable
```

The next daily schedule starts research. Runtime readiness is persisted application data, not Terraform-managed infrastructure. The normal workflow needs no manual input or daily command.

Run `ALLOW_DEPLOYMENT_SETUP=true npx tsx scripts/cloud-storage-check.ts` to verify real conditional writes, GSI queries and S3 storage.

## Pause and recover

`npx tsx scripts/deployment.ts pause` disables paid worker activity while preserving frontend access. Schedules may still invoke the readiness check at negligible usage. To stop those invocations too, change `schedules_enabled` through a reviewed Terraform plan/apply.

Inspect the latest `run:*` and `job:*` records in the Runs table and CloudWatch logs. Jobs in `polling` retain a provider response ID: continue retrieving that response, never start a replacement simply because retrieval failed. `uncertain` means submission outcome is unknown; its budget reservation remains charged conservatively. Reconcile with provider records before changing it. Known failed responses receive at most one bounded retry, with two search calls each and at most two jobs retried per run.

The provider performs initial discovery (including a publication-date-filtered query), reads initial documents, uses Sonnet to choose follow-up searches and document URLs, fetches linked procurement attachments, then performs final structured qualification. It accounts for both model calls, then saves the result before returning an ID. Only one is submitted per worker invocation. Subsequent ticks read that result without another paid call. Planning has a 45-second timeout and 1,500-output-token limit; final qualification has a 120-second timeout and 6,500-output-token limit. Lambda has 512 MB memory and a 300-second timeout and job leases last 330 seconds. Timeouts retain the reservation; no blind replay occurs. A partial run keeps completed findings. Deferred candidates remain queued for subsequent daily work. Human notes/status/pass/restore fields must not be edited by recovery scripts.

Send markers distinguish sent and uncertain email outcomes. Do not delete a marker to force a retry without inspecting delivery; SES can accept a message even if a caller times out.

## Costs and retention

The authenticated `/health` response includes a combined forecast using the API ledger plus the $15 AWS allowance; actual AWS billing is explicitly unavailable there. A $55 forecast warning is sent once per calendar month. Compare with AWS billing during the pilot, reconciling model/search charges with the ledger without double-counting them; this estimate is not a combined invoice or hard spending cutoff.

The US Sonnet 4.6 profile is priced at $3.30/M input and $16.50/M output tokens. Both planning and final qualification count toward the shared 8,000 output-token allowance and reported usage. Bedrock accounting uses actual reported tokens and AgentCore search calls and versioned rates. Daily reservations share $1.25 and 30 search calls across jobs; monthly research allowance is $37.50 per calendar month. Search input can be larger than expected, so reservation limits are conservative workload controls, not a precise provider billing cutoff.

AWS's $15/month allowance is a planning target. Activate the `Project` cost allocation tag in the billing account for project filtering. Review attributable AWS charges alongside the API ledger; Model and AgentCore search charges appear on the AWS bill. The existing $15 Project-tag budget covers infrastructure; reconcile Bedrock and AgentCore usage with AWS billing. Verify the combined 30-day projection during the pilot. Raw evidence snapshots expire after 90 days and CloudWatch logs after 14 days. Compact facts/history remain with records.

## Rollback

Pause research, restore the previous application commit and its artifact ZIPs, review a fresh Terraform plan, and apply only the intended infrastructure/code updates. Rebuild the hosted frontend from the matching commit. Do not destroy tables or evidence buckets to roll back code. Schema changes must remain compatible with retained records or include a separately tested migration.
