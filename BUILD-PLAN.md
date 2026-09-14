# GRS Signal — MVP Build Plan

Source of truth: [MVP specification](./GRS-SIGNAL-MVP-SPEC.md).  
Status: Local MVP implemented and tested. Real Terraform plan/apply, paid research, hosted integration checks and the live pilot remain pending. See [implementation status](docs/implementation-status.md) for evidence and deliberate MVP limits.  
Scope: Fully automatic daily research, three frontend tabs, one detail drawer, approximately $60/month combined operating target.

## 1. Delivery approach

Build the complete application, research worker, tests, release artifacts, and Terraform configuration locally before provisioning AWS resources. Use fixtures and local service adapters throughout development. The first `terraform apply` belongs at the end of the build, after local acceptance and a reviewed deployment plan.

Suggested order:

**Foundation → research worker → local pipeline → qualification → complete frontend → alerts/recovery → Terraform validation and plan → final apply → live checks and seven-day pilot.**

Planning estimate: **10–15 focused developer days to a locally tested, deployment-ready build, followed by deployment checks and a seven-calendar-day unattended pilot**. Cloud credentials and sender setup are deployment dependencies, not prerequisites for completing the local application. Live research quality, account compatibility, and actual cost remain unproven until deployment; fixes discovered then can add time. Estimates are not a delivery commitment.

Keep one repository, one research provider, two Lambda handlers, three DynamoDB tables, and eventually one deployed research environment. Use Terraform HCL for infrastructure; do not use CDK. Do not provision temporary AWS environments or run paid research during the local build. Local demo data and test adapters are developer tooling, not manual ingestion features in the product.

## 2. One-time implementation prerequisites

These are final-deployment dependencies. Represent them as documented configuration inputs during the build; resolve actual values before deployment, not as recurring work for the user:

- AWS account/profile and deployment permissions; default region `us-west-2`.
- OpenAI API project, API credential, billing enabled, and access to the candidate model.
- Initial invited user email addresses and alert recipients.
- Verified SES sender and permission to deliver to the intended recipients.
- Repository connection for Amplify hosting; use the provided hosting domain initially.

Keep credentials out of source control and Terraform variable/state files. Define the Secrets Manager resource in Terraform and populate its value through the final deployment setup script without logging it. Use an existing secured Terraform backend if available; otherwise document protected local state for the first apply and a later migration. Do not perform an early infrastructure apply just to bootstrap state. Commit the provider lockfile; ignore `.terraform`, state files, saved plans, and private variable files.

## 3. Proposed repository layout

The implementation follows this layout with one root npm package and shared TypeScript modules; no additional monorepo orchestration service.

```text
apps/web/                   Next.js shell, tabs, drawer, auth, API client
services/api/               Opportunity read/update and health Lambda
services/research/          Research runner, job polling, normalization, digest
packages/domain/            Schemas, score rules, dedupe, visibility, date logic
packages/storage/           DynamoDB operations, conditional writes, S3 snapshots
config/research.json         Schedule, query groups, rotation, limits, model ID
config/scoring.json          Versioned rubric and exclusion reason definitions
infra/                      Terraform HCL, variables, outputs, provider lockfile
scripts/                    Local dev, packaging, checks, final deployment setup
tests/local/                Fake research provider, local storage, email capture
tests/fixtures/              Labeled procurement scenarios and recorded responses
docs/runbook.md              Deployment, cost review, recovery, rollback
docs/pilot-report.md         Measured research quality, reliability, and costs
```

Use TypeScript, a shared schema validator, a unit/integration test runner, and browser tests for the critical user journey. Pin dependency versions during setup. Keep all model calls inside the research service.

## 4. Milestones and implementation tickets

### M0 — Foundation and contracts

**Estimate:** 0.5–1 developer day.  
**Depends on:** Existing specification.

- [x] **B01 — Scaffold the repository.** Add workspace commands for linting, type checking, tests, local web/API/worker development, artifact packaging, and Terraform formatting/validation. Add ignored local credential/environment files and a safe example configuration. Default all development and tests to non-billable local adapters.
- [x] **B02 — Define shared contracts.** Implement Opportunity, Candidate, Evidence, AssessmentFacts, ResearchRun, Job, BudgetReservation, and UserUpdate schemas. Keep machine-owned assessment fields separate from user-owned status/notes/next action.
- [x] **B03 — Add representative fixtures.** Cover a strong Connect opportunity, platform-neutral migration, staffing-only contract, mixed technology/BPO scope, expired deadline, inaccessible document, conflicting dates, and an amendment. Clearly mark synthetic fixtures.

**Exit check:** A fixture can pass from research output through the domain schema into an API-shaped record without losing evidence or date precision. An attempted model-supplied workflow update is rejected.

### M1 — Build the research worker against local contracts

**Estimate:** 1–2 developer days.  
**Depends on:** M0; no API credentials required.

- [x] **B04 — Implement one bounded research job.** Build the real provider integration using the specification's initial model candidate and theme groups. Require live web search in production, official-source references, structured facts, missing-evidence flags, and source-linked claims. Inject a fake provider locally; keep production integration code complete.
- [x] **B05 — Exercise provider lifecycle contracts locally.** Simulate background submission, response-ID retrieval, polling, source annotations, output/tool limits, incomplete responses, and optional no-search normalization. Record the request configuration and a post-apply live capability checklist. Local simulation does not establish actual account support.
- [x] **B06 — Implement usage accounting.** Consume provider-reported token/tool usage, price version, and response IDs. Exercise it using fixture usage records. Charge normalization, repairs, retries, and search content to the same ledger; distinguish simulated estimates from actual spend.
- [x] **B07 — Evaluate labeled fixtures.** Exercise extraction and uncertainty using the representative scenarios and any existing recorded responses. Add a live integration test command for use after deployment; routine tests and build commands must not call the paid API.
- [x] **B08 — Record research configuration and open validation items.** Save prompts, limits, normalization rules, estimated costs, and known source-access limitations. Mark live quality and account compatibility as pending post-apply checks, not blockers to completing the rest of the build.

**Exit checks:**

- Fixture candidates persist through the application contract with their provenance intact.
- Source references survive formatting, and unsupported facts remain unknown.
- Integration code sets documented tool/output limits; tests verify request construction and local budget enforcement.
- Usage fixtures and conservative reservations exercise the $1.25/day research allowance.
- Simulated background research resumes without submitting a replacement response.

**If local checks fail:** Fix the worker contract and failure handling while continuing independent app work. Do not require live paid research as a precondition for building the frontend, and do not introduce manual import as a fallback.

### M2 — Build the local pipeline and Terraform definitions

**Estimate:** 2–3 developer days.  
**Depends on:** M1.

- [x] **B09 — Define AWS infrastructure without provisioning it.** Write Terraform for the three DynamoDB tables, private S3 bucket, packaged Lambda handlers, secret resource, Cognito pool, HTTP API, Amplify app/branch, schedules, SES setup, logs, and budget alarms. Include retention/lifecycle policies, inputs, outputs, and artifact hashes. Do not run apply. No NAT gateway or always-running compute.
- [x] **B10 — Implement resumable job execution.** Persist daily runs, jobs, response IDs, lease expiry, attempts, and checkpoints. Use conditional claims to ensure only one worker owns a job. Start a background response, persist its ID, and return. Poll existing responses on subsequent ticks.
- [x] **B11 — Make budget reservations atomic.** Reserve money and tool-call capacity before dispatch. Include all in-flight work in available capacity. Settle against returned usage; retain conservative reservations when provider acceptance is ambiguous. Do not treat a local timeout as proof that a request was free.
- [x] **B12 — Add the daily research plan.** Configure the three discovery themes, rotating geography/buyer focus, seven-day overlap, weekly 30-day lookback, and first-run seed. Enforce the shared 30-call maximum: discovery 18, verification 8, recovery 4.
- [x] **B13 — Persist overflow and progress.** Limit processing to 30 candidates and detailed qualification to 15 per day. Save additional discovered candidate references for later work. Age queued candidates into priority so they do not disappear behind fresh arrivals. No additional queue service is required for this volume.
- [x] **B14 — Wire scheduling and health.** Define the daily 06:00 America/Los_Angeles start and five-minute poll/recovery tick in Terraform. Exercise both event shapes with a controllable local clock. Prepare a deployment readiness guard so paid work cannot begin before credentials and cloud smoke checks pass. Expose sanitized run status through the local and production API handlers.

**Exit check:** A simulated scheduled event runs the entire pipeline into local storage/snapshot adapters. Repeated events and worker interruption do not duplicate recoverable work. Budget exhaustion defers work and preserves existing data. Terraform definitions and deployable worker packages exist; AWS behavior remains a post-apply check.

### M3 — Qualification, deduplication, and decision protection

**Estimate:** 2–3 developer days.  
**Depends on:** M2; pure domain functions can be developed once M0 is complete.

- [x] **B15 — Implement the versioned rubric.** Calculate scores from evidenced categories in application code. Keep confidence and readiness separate. Retain provisional results when documents or essential facts are unavailable.
- [x] **B16 — Implement contextual suppression.** Distinguish pure staffing/commodity/telecom/NG911 exclusions from mixed procurements with material GRS implementation scope. Apply a pure-scope exclusion only after checking the mixed-scope exception. Store the reason and evidence.
- [x] **B17 — Implement conservative canonical identity.** Prefer agency/state/solicitation number, then official detail URL. Claim identity mappings conditionally so concurrent results converge on one record. Reconcile additional source URLs to the canonical ID. Do not strip URL parameters that identify bids.
- [x] **B18 — Add amendment handling.** Normalize material facts, detect changes, and append history. Missing fields in a later result do not erase previously supported facts. A conflicting value remains unresolved until evidence establishes precedence.
- [x] **B19 — Protect user-owned fields.** Use allowlisted, version-checked updates for status, notes, pass reason, restore, and user next action. Research merges never write these fields. Keep model-recommended next action separate from a user's saved next action.
- [x] **B20 — Implement view assignment and shortlist selection.** Apply explicit precedence: pursuing/submitted/completed workflow → Pursuing; human pass → Filtered out; restore override → Recommended/More matches; remaining records follow disposition and evidence. The shortlist still enforces freshness, open status, score, and blocker rules after restoration.
- [x] **B21 — Recheck priority opportunities.** Spend the verification allocation on pursuits and shortlist entries, ordered by imminent action dates and oldest verification. Never reset verification time from a search snippet alone. Mark expired/stale records at read time as well as during scheduled maintenance.

**Exit check:** A fixture research update can change dates and fit while preserving a user's pursue/pass decision. Expired, stale, or blocked opportunities cannot appear in the top five. One known duplicate cluster occupies at most one slot. Exercise conditional writes against a local DynamoDB emulator where available; any storage test double must have a post-apply parity check.

### M4 — Build the three-tab application

**Estimate:** 2–3 developer days.  
**Depends on:** M3 and the API contracts; a fixture-based shell can start earlier.

- [x] **B22 — Finish authenticated API access.** Implement the four endpoints, production Cognito sign-in, strict user-field validation, concurrency conflicts, and pagination. Use a development-only identity adapter locally; it must be unavailable in production builds. Verify local unauthorized-access behavior now and actual Cognito/API Gateway enforcement after apply.
- [x] **B23 — Implement correct list queries.** Add the view/sort GSI. Select the top five across eligible candidates, not just an arbitrary database page. Reapply time-dependent eligibility before returning a shortlist; fetch additional bounded pages if necessary. Return an explicit partial-result indicator if a safety bound is reached.
- [x] **B24 — Build the shared shell and card.** Add the three tabs, basic search, score/readiness labels, due date, one-line GRS angle, likely role, blocker, next action, and buttons. Do not add charts or a separate landing dashboard.
- [x] **B25 — Build the detail drawer.** Support direct links and browser Back. Show the brief, official facts, technology scope, evidence, user work, and history. Preserve focus on open/close and support Escape.
- [x] **B26 — Implement review actions.** Viewing does not change status. Support mark reviewing, pursue with undo, pass reason, restore, and all specified status transitions. Optional notes and next action/date must stay optional.
- [x] **B27 — Implement the small view controls.** More matches; New since last visit; Include completed; suppression reason filter. A per-user/per-browser last-visit timestamp is sufficient initially. Show search scope/pagination honestly; do not imply a bounded search has searched all stored records.
- [x] **B28 — Add useful empty and error states.** Distinguish no strong matches, partial research, stale evidence, failed research, and budget deferral. Existing opportunities stay usable during research outages.
- [x] **B29 — Prepare the Amplify release.** Finish the production build configuration and Terraform hosting definitions. Prepare binding of API URL, region, Cognito IDs, and callback URLs from deployment outputs, including the final hosted build. Keep secrets out of frontend bundles. Verify desktop and mobile behavior against the local API; do not create an Amplify app or trigger a hosted deployment yet.

**Exit check:** A local test user can inspect a fixture opportunity, pursue/pass/restore it, and see decisions survive a simulated research update. The complete three-tab application runs locally. Page navigation produces no model calls. Production authentication code exists; cloud sign-in remains to be validated after apply.

### M5 — Alerts, fault handling, and operating controls

**Estimate:** 1–2 developer days.  
**Depends on:** M2–M4.

- [x] **B30 — Add the meaningful-change digest.** Implement production SES delivery and local email capture. Render up to five recommendations with app links under the spec's alert conditions. Compare material changes and deadlines, not wording. Exercise send markers and ambiguous delivery without sending real messages during the build.
- [x] **B31 — Finish fault recovery.** Cover transient failures, malformed output, expired job leases, provider submission uncertainty, source conflicts, and jobs older than 60 minutes. Allow bounded repairs/retries only within remaining daily/monthly allowances.
- [x] **B32 — Add incident alerts.** One alert per incident for full-run failure or more than 36 hours without a successful run. Recovery clears the incident. Send operational messages only to configured recipients.
- [x] **B33 — Implement combined cost reporting.** Define project tags, separate API accounting, and a combined estimate. Test calculations against fixtures; mark actual costs unavailable before deployment. Keep the $15/month AWS allowance distinct from the larger AWS alarm backstops. Alert before the combined forecast reaches $60; AWS-only alarms cannot enforce that target.
- [x] **B34 — Write the short runbook.** Document deployment, enabling/disabling research, credential rotation, inspecting a failed run, resuming safe checkpoints, changing configuration, reviewing costs, and rolling back code without deleting decisions or evidence.

**Exit check:** Injected local faults recover or defer automatically. The app remains available when research is paused. Captured failure alerts are actionable and do not repeat every poll tick. Daily/monthly limits include recovery work. All application functionality is implemented before the final deployment milestone.

### M6 — Complete local acceptance and prepare the final apply

**Depends on:** M0–M5 complete. Included in the build estimate; allow additional time for account-specific deployment issues.

- [x] **B35 — Run complete local acceptance.** Run lint, type checking, domain/integration tests, browser journeys, production frontend build, and Lambda packaging. Test the end-to-end path from simulated scheduled discovery to review decisions, amendment update, and captured digest. Fix local failures before provisioning anything.
- [ ] **B36 — Validate Terraform and prepare a deployment plan.** Run `terraform fmt -check -recursive`, `terraform init -backend=false`, and `terraform validate` in `infra/`. Pin Terraform/provider versions. Once deployment credentials, backend, and variables are available, initialize the intended backend and produce a saved `terraform plan`. Review resource counts, IAM, lifecycle settings, schedule readiness, artifact references, and cost-sensitive services. Keep the plan private and rebuild it if inputs/artifacts change.
- [x] **B37 — Package the deployment handoff.** Provide reproducible build commands, immutable Lambda artifacts/hashes, final hosting build configuration, configuration examples, state handling, secret injection, user/sender setup, cloud smoke tests, and rollback steps. Record local checks as passed and live checks as pending. No required application implementation should be deferred to after apply.

Terraform validation checks configuration, not remote-service behavior. Backend-free initialization supports local validation; a real plan can read AWS/state and needs account configuration, but it does not provision the proposed resources. [Terraform validation](https://developer.hashicorp.com/terraform/cli/commands/validate), [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan).

**Build-complete gate:** The entire app works locally, production artifacts build, Terraform validates, deployment inputs are documented, and the final plan is reviewable when account access is available. A missing cloud credential does not prevent finishing local implementation; it does prevent claiming a completed real plan or live verification.

### M7 — Final deployment, live validation, and unattended pilot

**Elapsed time:** Seven consecutive calendar days; approximately 1 developer day to review results and resolve small issues, with additional time if a release gate fails.  
**Depends on:** M6. This is the first deployment stage; do not move an apply into an earlier milestone.

- [ ] **B38 — Apply and complete deployment setup.** Apply the current reviewed saved Terraform plan at the end of the build. Run the already-written setup script to populate secrets, resolve hosted configuration, provision invited users, and complete the hosted frontend build. Account/SES verification prerequisites must be satisfied before alerts can work. Terraform provisioning and a successful hosted app release are distinct checks; wait for both. Research remains gated until readiness passes. [Terraform apply](https://developer.hashicorp.com/terraform/cli/commands/apply)
- [ ] **B39 — Validate live integrations and enable the pilot.** Verify actual Cognito/JWT enforcement, DynamoDB conditional writes, S3 access, SES delivery, and model search/background/output/usage controls. Run a bounded research smoke test and save its measured cost and evidence. Then enable the worker's operational readiness flag through the deployment script; this flag is application data, not a resource change outside Terraform. Run seven unattended days with real daily limits and no manual ingestion or operator-started daily jobs.
- [ ] **B40 — Evaluate quality, economics, and release.** Use the labeled scenarios and live sample to check the 80% labeled-set shortlist precision target, evidence, deduplication, and uncertainty. Project 30-day cost from actual API and attributable AWS usage, including polling/logs/storage/hosting. Require at most $60 without credits. Finish the spec's release checklist and record results and sample sizes in `docs/pilot-report.md`.

If cost fails, reduce discovery breadth/frequency within the daily schedule, context size, candidate volume, and unnecessary retries. Preserve essential verification and user-decision safety. If quality fails, tune research and scoring with a new recorded version; never fill the top five with weaker matches to meet a count. Material changes to the research path require another unattended validation period.

## 5. Focused verification matrix

Tests should protect business behavior and failure recovery. Avoid snapshotting cosmetic card details or writing tests that simply repeat configuration values.

| Area | Verification |
| --- | --- |
| Scoring/classification | Representative mixed-scope and exclusion examples; platform-neutral migration; incomplete evidence; no keyword inflation |
| Dates/freshness | Unknown timezone, date-only deadline, midnight/daylight-saving boundaries, deadline extension, stale verification |
| Persistence | Replayed ingestion, simultaneous identity claims, amendments, user edit during research merge |
| Budget/jobs | Duplicate schedule delivery, lease recovery, response-ID polling, ambiguous submission, daily/monthly exhaustion, no repeated paid work |
| API/auth | Unauthenticated access denied; model-owned fields cannot be patched; stale revision rejected; no secret disclosure |
| UI | Sign in → inspect source evidence → pursue → pass → restore → refresh; direct drawer links; keyboard/mobile usability |
| Alerts | Meaningful-change detection, completed-send deduplication, failure/recovery incidents |
| Terraform before apply | Formatting/validation, reproducible artifacts, plan review when credentials exist; no provisioning |
| Live checks after apply | Actual auth/service/provider behavior, seven unattended days, source quality, actual cost projection |

Mock provider responses for all build-time tests. Local adapters must be development-only and production must fail closed if required service configuration is missing. Keep live integration tests separate and run them only in the final deployment stage. Passing mocks does not prove AWS permissions, account limits, actual research quality, or real spend.

## 6. Scope and release discipline

Do not create new product surfaces to solve internal implementation problems. Source access, prompts, pricing, and scoring stay in configuration; run diagnostics stay in logs and the runbook. The frontend gets only concise health/freshness indicators.

If time is tight, simplify implementation details while preserving the spec: plain styling, simple controls, no owner assignments, no full-text search service, and no custom domain. Keep authentication, evidence, deduplication, decision protection, budget limits, and the automatic pipeline.

The build handoff is **the complete locally working application plus validated Terraform and deployable artifacts**. `terraform apply` comes at the end. Live smoke checks and the seven-day pilot validate the deployed system; they do not substitute for finishing the build first.
