# Guided Reach Solutions — Procurement Intelligence MVP

Working name: **GRS Signal**  
Specification date: September 13, 2026  
Status: Implementation specification; application not yet built or deployed.

## 1. Product decision

Build a small internal application that automatically researches public-sector procurement opportunities and answers:

> What are the 3–5 best opportunities Guided Reach should care about right now, and what should we do next?

The experience is a daily shortlist with evidence and pursuit decisions. Research, ingestion, deduplication, classification, scoring, summaries, and updates run automatically. Users review opportunities and decide whether to pursue them.

### Non-negotiable constraints

| Requirement | Decision |
| --- | --- |
| Low product complexity | Three tabs, reusable opportunity cards, one detail drawer |
| No manual ingestion | No required copying, pasting, forwarding, uploads, or portal checks |
| No dependency on procurement APIs | Use scheduled AI web research against accessible public sources |
| Approximately $2/day | Target at most $60 per 30 days in combined AWS and research API operating costs; enforce usage limits and retain headroom |
| Low implementation effort | One repository, one model provider, managed AWS services, configuration files instead of admin screens |
| Revenue relevance | Show fit, GRS's delivery role, blockers, and next action before general metadata |
| Traceability | Preserve official links, supporting evidence, uncertainty, and suppression reasons |
| Build before deployment | Finish the full application, local checks, artifacts, and Terraform configuration before the final `terraform apply`; live validation follows deployment |

One-time deployment configuration, credentials, and user provisioning are setup work. Exceptional operational faults can require developer attention. Routine discovery must not depend on a human handoff. Pursue/pass decisions remain human business judgments.

The user's successful ChatGPT scheduled research is the pattern to reproduce. This app runs its own API-based research; it does not scrape ChatGPT conversations or depend on exporting an existing ChatGPT task. Equivalent research quality is a validation requirement, not an assumption.

## 2. Audience and procurement scope

Initial audience: approximately 1–5 invited GRS users, using one shared opportunity workspace. All invited users have the same business permissions in the MVP.

Include newly published U.S. state, local government, public authority, utility, and public higher-education procurements. For utilities, include government/public entities and flag unclear ownership. Exclude federal-only, private-sector, and non-U.S. opportunities. Geographic searches rotate across U.S. regions; this is national search reach, not guaranteed comprehensive coverage.

Relevant procurement types include RFP, RFQ, RFI, ITB/IFB, and other clearly identified procurement notices. Label RFIs as early positioning opportunities; do not present them as immediate proposal submissions. Award notices can update an existing record but are not new open opportunities.

### Strong positive scope

- Legacy contact-center migration to CCaaS or cloud.
- Amazon Connect / AWS implementation, migration, optimization, or professional services.
- IVR replacement and redesign; omnichannel modernization.
- Conversational AI, virtual agents, generative AI for customer service.
- Knowledge management tied to customer service or contact-center operations.
- CRM/contact-center integration.
- 311 and citizen-service modernization.
- Existing contact centers adding automation, self-service, AI, or analytics.

### Excluded or suppressed scope

- Outsourced call-center staffing/BPO, temporary agents, generic answering services.
- Contracts whose main purpose is operating a contact center without a material technology implementation workstream.
- Generic telecom/UC hardware and NG911/PSAP infrastructure.
- Commodity licenses without meaningful implementation services.
- Broad enterprise IT procurements where contact-center modernization is incidental.

Scope decisions must use context. An existing contact center requesting AI is a positive signal. A staffing-led procurement with a distinct technology implementation package may be worth a subcontractor role. Generic knowledge management or a mention of AWS alone is insufficient.

## 3. Frontend specification

Use Next.js on Amplify, with a lightweight application shell and API-loaded data. Opening a page must never invoke a model or run research.

### Application shell

- GRS Signal wordmark; working name can be changed without changing architecture.
- Tabs: **Recommended**, **Pursuing**, **Filtered out**.
- Compact search across stored title, agency, and solicitation number.
- Small freshness line: “Research completed …” with a partial/stale/error label where needed.
- Opportunity drawer addressable by URL so an email can link directly to it.
- Desktop-first layout; usable stacked layout on mobile. Keyboard-accessible tabs, buttons, and drawer.

No dashboard charts, maps, pipeline-dollar metrics, kanban, AI chat, source-management page, import page, or scoring sliders.

### Recommended

Default view. Display at most five actionable high-fit opportunities, followed by a collapsed **More matches** list. Show fewer than three when fewer qualify; never pad with weak results.

An opportunity qualifies for the main shortlist when all are true:

1. Workflow status is `new` or `reviewing`.
2. Fit score is at least 85.
3. Material fit claims have official-source support.
4. Official open/closing information was successfully checked within 72 hours.
5. Procurement is open, or explicitly ongoing with no fixed deadline.
6. No confirmed blocker prevents a plausible GRS prime, subcontractor, or partner role.

Rank by fit descending; break ties by evidence confidence, nearest verified future action deadline, then first discovery time descending. Urgency never increases fit.

**More matches** contains eligible 70–84 matches plus provisional, stale, or blocked high-fit matches with explicit labels. A “New since last visit” toggle filters this view and the main shortlist. Viewing alone does not change workflow status.

For a healthy run with no qualifiers: “No strong opportunities found in the latest research.” For a failed or partial run: retain prior findings and explain freshness; never imply the market was fully checked.

### Pursuing

Default list includes `pursue` and `submitted`. A compact “Include completed” toggle adds `won` and `lost`. Sort by next action date, then due date. No mandatory owner assignment, task creation, or note entry.

Each item offers status changes and optional next action/date and notes. Display material procurement changes prominently without changing the user's status.

### Filtered out

List low-fit records, system suppressions, and human passes. A simple reason filter and the global search are sufficient. Visually distinguish **System filtered** from **Passed by GRS**.

Show title, agency, score or “Unscored,” exclusion/pass reason, supporting source, and **Restore to review**. Restoring records an override and puts the item in `reviewing`; it becomes visible in More matches even if its score stays low. Future runs preserve that override. Restoration does not raise fit or erase evidence.

Do not fill this section with every irrelevant web result. Store excluded candidates that plausibly matched a GRS theme and were actually assessed. Do not claim exhaustive rejection coverage.

### Opportunity card

Show, in order:

1. Fit score and plain-language fit label; separate readiness label when needed.
2. Official title or concise display title, agency, state.
3. Procurement type and due date; nearest earlier mandatory/questions deadline if known.
4. One sentence explaining the GRS delivery opportunity.
5. Likely role and the most consequential blocker or uncertainty.
6. Recommended next action.
7. **Review**, **Pursue**, **Pass**, and **Official source** actions.

Review opens the drawer; a deliberate “Mark reviewing” action sets status. Pursue changes status immediately with undo. Pass opens a small reason picker; explanation is optional. Use reasons including staffing-only, incidental scope, platform restriction, eligibility, deadline, no capacity, duplicate, and other. A duplicate flag can be retained for investigation without deleting either record.

### Detail drawer

Order content as a decision brief:

| Block | Content |
| --- | --- |
| Header | Title, agency, state, fit, readiness, evidence confidence, workflow status |
| GRS brief | Why it fits, modernization scope, likely role, major blockers, next action |
| Procurement facts | Solicitation number/type, publication date, due date/time/timezone, other action dates, official URL |
| Technology | Current/legacy platform, target requirements, AWS/Connect alignment, integrations |
| Evidence | Short supporting excerpts, source links, document page/section where available, explicit versus inferred claims |
| Work | Status, optional next action/date, optional notes |
| History | First found, last verified, amendments, decision changes, score/rule version |

Use neutral styling for ordinary records, stronger typography and a restrained accent for strong fits, amber for uncertainty, and explicit blocker text. Color is never the only indicator. A high fit score can coexist with a blocker.

## 4. Automated research workflow

**Discover → ingest → deduplicate → classify → score → summarize → review → pursue/pass.**

Run daily at **06:00 America/Los_Angeles**, with daylight-saving behavior handled by EventBridge Scheduler. Schedule and budgets are deployment configuration, not frontend controls. Target completion within 30 minutes; this is an operational target, not guaranteed delivery time.

### Daily work allocation

| Work | Initial maximum allocation |
| --- | --- |
| Discovery | 18 web-search tool calls across three bounded research jobs |
| Verification/changes | 8 calls prioritizing active pursuits and the previous shortlist |
| Retry/recovery | 4 calls, only where needed |
| Total | 30 calls per local calendar day, shared by all work and retries |

These are tool calls, not assumed equivalent counts of unique search queries or sites. Unused calls need not be spent. At most 30 candidate records enter processing per day and 15 receive detailed qualification; retain overflow in a persistent queue. Pending items age into priority and are not silently lost.

Discovery groups:

1. Connect/AWS, CCaaS, legacy migration, IVR.
2. Omnichannel, 311/citizen services, CRM integration.
3. Contact-center AI, virtual agents, knowledge, self-service, analytics.

Search primarily for notices published in the last seven days, with overlapping windows to catch indexing delay. Rotate state/region and buyer-type emphasis. Once weekly, replace part of the normal discovery allocation with a 30-day lookback; do not add a separate unbudgeted job. On the first run, use a bounded 30-day seed search within the same limits.

Do not rely on a single broad query, require literal “Amazon Connect,” or use only `.gov` domains: official procurement platforms and higher-education sites may use other domains.

### Sources and verification

- Use web search for discovery and accessible page reading. OpenAI supports hosted web search in the Responses API; results include source information suitable for citation. [Official web-search documentation](https://developers.openai.com/api/docs/guides/tools-web-search)
- Aggregators and snippets may identify leads. Material claims and dates need an agency page or a procurement portal demonstrably used by that agency.
- Verify publication date separately from first discovery date and search-engine timestamps.
- Prefer the latest official amendment over the original notice. Record conflicts rather than guessing which date is correct.
- Keep inaccessible/login-protected results as incomplete evidence; attempt accessible official alternatives and bounded later retries. Never make a user upload a document for the pipeline to continue.
- Recheck active pursuits and shortlist entries first, prioritizing imminent deadlines and the oldest successful check. If the budget cannot cover all, record unverified items as stale.
- A successful HTTP response or search mention alone does not reset `lastVerifiedAt`; the relevant official procurement facts must have been checked.
- A search-based MVP cannot guarantee coverage of unindexed pages or protected documents. Display this limitation in a brief coverage tooltip.

No portal credential automation, CAPTCHA bypass, per-portal scraping framework, paid procurement subscription, inbound email integration, or routine direct PDF/OCR pipeline is required for v1. Store returned research/evidence in S3; dedicated document collection can come later.

### Research output contract

Each research job receives the date/window, thematic focus, remaining limits, exclusions, and a compact set of known opportunities relevant to that job. Do not send the entire database or rely on model conversation memory for deduplication.

Return structured candidates with the fields in section 6 plus:

- `sourceReferences`: URL, title, official/discovery-only designation, checked timestamp.
- `evidence`: field/claim, short excerpt, source reference, locator if available.
- `assessmentFacts`: classification and rubric inputs, with evidence references.
- `unresolvedFields` and `accessIssues`.
- `observedChanges` for existing records.

Validate output with a shared schema. If the chosen model/tool combination needs a separate formatting call, use a small no-search normalization call charged to the same budget. Preserve source references through normalization. Allow one bounded repair; then quarantine invalid output and continue other work.

The model must treat source content as evidence, never as instructions. It must not invent platform names, values, dates, solicitation numbers, or eligibility. Unknown fields are null. Recommendations and role hypotheses are explicitly inferred. The model never writes directly to DynamoDB or decides user workflow status.

## 5. Classification and scoring

Keep fit, readiness, and evidence confidence separate. Fit is not a win probability or revenue estimate.

### Deterministic fit rubric, version 1

The model extracts evidenced categories; application code assigns these points. Choose exactly one value per component.

| Component | Allowed points |
| --- | --- |
| Modernization centrality | 0 unrelated; 10 incidental; 20 distinct workstream; 30 primary purpose |
| Match to GRS delivery services | 0 none; 10 one material service; 20 two; 25 three or more |
| Platform alignment | 0 incompatible/unknown; 10 explicitly platform-neutral and cloud-suitable; 15 AWS explicitly permitted/preferred; 20 Connect/AWS implementation explicitly in scope |
| Services substance | 0 commodity/operations-only; 5 limited configuration/support; 15 substantial design, migration, implementation, integration, or optimization |
| Plausible GRS role | 0 unidentified; 5 plausible role with unresolved delivery boundary; 10 clearly identifiable delivery package |

Sum to 0–100. Unknown inputs earn no confirmed points; display the score as **Provisional** when material evidence is missing. No keyword repetition bonuses. Eligibility and timing remain separate from capability fit. The score reflects reviewed evidence, so an incomplete opportunity must not be confidently rejected merely for lacking points.

Labels: 85–100 Strong fit; 70–84 Worth reviewing; 50–69 Low priority; 0–49 Weak fit. These are starting thresholds, to be calibrated before launch.

### Disposition rules

Evaluate in this order:

1. Out of geography/buyer scope or clearly excluded purpose → `suppressed`, with evidence and reason.
2. Mixed scope with a material GRS technology package → score that package, identify partner/subcontractor role, retain procurement-wide blockers.
3. Insufficient or conflicting material evidence → `needs_verification`, not low-fit suppression.
4. Otherwise, score ≥70 → `recommended`; score <70 → `low_fit`.

Expired/canceled status removes a record from the main shortlist without labeling its technical scope irrelevant. A platform mandate incompatible with GRS is a blocker; platform-neutral language is not a blocker.

Evidence confidence: `supported` (material claims backed by official sources), `partial` (some material facts unavailable), `conflicting` (unresolved official-source contradictions). Readiness: `actionable`, `needs_verification`, `blocked`.

Human restore/pass overrides affect visibility and workflow, not the extracted score. “No capacity” must not train the scope classifier. Feedback is logged for developer-led rubric revisions; no autonomous self-modifying weights in v1.

## 6. Data model and lifecycle

| Group | Required stored fields |
| --- | --- |
| Identity | `id`, agency, normalized agency, state, buyer type, official title, optional display title, solicitation number, procurement type, official source URL, additional source references |
| Dates | publication date, due date, due time/timezone if known, action deadlines, first discovered, last seen, last successful verification |
| Scope | current/legacy platform, target platform requirements, modernization scope, themes |
| Assessment | 0–100 fit score or null before assessment, score breakdown, why it fits, likely role (`prime/subcontractor/partner/unknown`), major blockers, recommended next action, confidence, readiness, disposition, reason codes, evidence |
| User work | workflow status, optional next action/date, notes, pass reason, restore override, updated by/at |
| Provenance | schema/prompt/rule/model versions, research run IDs, fact fingerprint, revision number, history references |

Unknown values are null, not fabricated defaults. Date-only deadlines retain date-only precision; never invent midnight or a timezone. If the official deadline day has passed, remove it from the shortlist. On that day, show “Due today — time unverified” where appropriate. Keep publication date, first discovered date, and last verified date distinct.

Separate state fields:

- Workflow: `new / reviewing / pursue / pass / submitted / won / lost`.
- Procurement: `open / closed / canceled / awarded / unknown`.
- Disposition: `recommended / needs_verification / low_fit / suppressed`.
- Processing: `pending / researching / assessed / retry_pending / failed`.

An official award must not set GRS's workflow to won/lost. A missed deadline must not erase a pursuit. Daily research updates only machine-owned fields; use optimistic concurrency for user changes.

### Deduplication and amendments

Primary identity: normalized agency + state + normalized solicitation number. Fallback: normalized official detail-page URL. Remove only known tracking parameters; preserve query parameters that identify the solicitation.

If neither exists, compare agency/state, title, and dates conservatively. Do not merge on title similarity alone. Retain uncertain matches with `possibleDuplicateOf`; prevent a known duplicate cluster from occupying multiple shortlist slots. Flag uncertain cases without blocking the rest of the run.

Merge repeat discoveries into a single canonical record and preserve all provenance. Normalize material facts before hashing so wording changes alone do not trigger amendments. Changes to deadlines, scope, eligibility, platform mandates, or cancellation create a history entry. Preserve original facts and the newer supporting source. Never overwrite user notes, pass reasons, or status during a merge.

## 7. Minimal AWS implementation

Default region: `us-west-2`, subject to service/model access validation. Use a single TypeScript repository and Terraform HCL for repeatable infrastructure. Build and test the entire application locally before the first `terraform apply`. Use development-only provider/storage/identity/email adapters and clearly labeled fixtures; do not provision intermediate AWS environments or require paid research during the build. Complete live account, model, and cost validation after final deployment.

Terraform must cover the application infrastructure, hosting definitions, IAM, schedules, retention, and alarms. Prepare packaging and one-time deployment setup scripts alongside the app. Keep secret values outside Terraform state and source control; populate Secrets Manager securely during final setup. Application runtime readiness starts false, so scheduled paid work cannot begin before configuration and cloud smoke checks pass. The setup script enables readiness after those checks. Backend/state setup must not require an early infrastructure apply; use an existing secured backend or documented protected local state initially.

| Component | Responsibility |
| --- | --- |
| Next.js + Amplify Hosting | Static application shell where practical; authenticated API-loaded screens |
| Cognito | Invite-only sign-in; no public registration |
| API Gateway HTTP API | JWT-protected read/update endpoints |
| Application Lambda | List/detail queries, user edits, health summary |
| Research Lambda | Start/poll research jobs, validate findings, dedupe, score, persist results, assemble digest |
| EventBridge Scheduler | Daily start plus a small periodic recovery/poll tick |
| DynamoDB on-demand | Opportunities, jobs/runs, identity mappings, budget ledger, decisions/history |
| S3 private bucket | Compressed research responses and evidence snapshots |
| Secrets Manager | API credential |
| SES | One digest per completed daily run when there is meaningful new/actionable information; failure alerts |
| CloudWatch + AWS Budgets | Logs, failure/cost indicators, budget notifications |

Select **OpenAI Responses API with hosted web search** for v1. Initial cost-test candidate: **GPT-5.6 Luna**, whose documentation lists web search and structured output support. Keep the model ID configurable and verify account access/quality before launch. Do not add Bedrock or a provider-abstraction framework in v1. [Model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

### Resumable execution

Use a single persisted daily run with bounded jobs. A worker starts a background response, records its response ID, and exits. A five-minute scheduler tick polls pending jobs and advances the pipeline; idle ticks return immediately. Explicitly configure provider retention sufficient for polling and save completed output promptly. OpenAI documents asynchronous background responses and status polling. [Background execution](https://developers.openai.com/api/docs/guides/background)

Do not hold Lambda open while a long research request completes. Lambda invocations have a finite timeout, so research state must survive invocation boundaries. [Lambda timeout documentation](https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html)

Use conditional writes to claim jobs and prevent overlapping workers. Store checkpoints after every completed job. Polling must retrieve an existing response, not start another paid run. Retry known transient failures at most twice, including all work in the shared budget. For an ambiguous submission timeout, reserve its possible cost and do not blindly submit a duplicate; reconcile when possible or defer the job. Expire stalled jobs after 60 minutes, attempt cancellation where supported, and mark the run partial. Do not launch overlapping daily runs.

### Storage and API simplicity

Use three logical DynamoDB tables: Opportunities, Runs (including job/budget records), and History (including identity mappings if convenient). Materialize a `viewGroup` and sortable key on each opportunity, with a GSI for the three UI views. User restore overrides participate in view assignment. Query paginated groups; avoid full-table scans on every page request. Basic search may filter a bounded, paginated result set, clearly offering more results; no full-text service in v1.

Minimum endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /opportunities?view=...&cursor=...` | Ranked/paginated cards and simple search/toggles |
| `GET /opportunities/{id}` | Full drawer and recent history |
| `PATCH /opportunities/{id}` | Allowlisted user fields, pass/restore/status actions, expected revision |
| `GET /health` | Sanitized last-run/freshness/partial status |

Research execution is internal; omit a public “Run research” button. Read access and writes require Cognito tokens validated by the HTTP API authorizer. [API Gateway JWT authorization](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html)

Keep API keys server-side and S3 private. Treat excerpts and model text as untrusted plain text; allow only safe HTTP(S) source links. Do not expose a general server-side URL-fetch endpoint. Limit API traffic, payload sizes, worker concurrency, and logs. No VPC/NAT gateway, RDS, OpenSearch, vector database, or always-running server is needed.

## 8. Cost envelope and controls

Operating target: approximately **$2/day / $60 per 30 days**, including AWS and separately billed OpenAI API usage. Excludes developer labor, taxes, existing ChatGPT subscription, custom domain, and any separately approved paid data subscriptions. Do not rely on promotional credits to demonstrate affordability.

| Budget bucket | Initial allowance |
| --- | --- |
| Research API: search + all tokens + repairs/retries | $1.25/day and $37.50 per 30 days |
| AWS hosting, jobs, API, storage, auth, alerts, logs | $15/month planning allowance |
| Remaining headroom against $60 | $7.50/month |

These are budget allocations, not fixed service quotes. Verify actual AWS charges during the pilot. Development build frequency can increase Amplify charges.

Illustrative API workload at published standard short-context prices:

| Usage | Calculation | Cost/day |
| --- | --- | --- |
| 30 web-search calls | 30 × $0.01 | $0.30 |
| 1M input tokens, including billed search content | 1 × $0.20 with Luna | $0.20 |
| 100K total billed output tokens, including reasoning | 0.1 × $1.20 with Luna | $0.12 |
| Example total | Search + input + output | **$0.62** |

This is arithmetic for an assumed workload, not a prediction of research quality or tokens consumed. Search content is billed in addition to tool calls. Longer contexts or model changes alter rates; reprice before enabling them. [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Luna rates and context conditions](https://developers.openai.com/api/docs/models/gpt-5.6-luna)

Controls:

1. Persist daily/monthly estimated spending and reservations in DynamoDB. Reserve a conservative job allowance atomically before dispatch; settle with provider-reported usage afterward.
2. Configure supported per-request tool-call and output limits. Treat the 30-call daily allowance as shared across discovery, rechecks, retries, and recovery. Confirm enforcement in the initial integration test; prompt instructions alone are not a limit.
3. Bound local input, returned candidates, and context growth. Start with 1M input / 100K billed output daily planning thresholds; check usage after each job and reserve for in-flight work. Hosted search can expand input unpredictably, so thresholds are not an exact billing cutoff.
4. Stop starting research when the daily/monthly research allowance would be exceeded. Save unfinished work for a later eligible run; do not discard it or require manual import.
5. No premium-model fallback, unlimited deep research, or automatic budget increases.
6. Retain raw research snapshots for 90 days and operational logs for 14 days. Keep concise evidence and decisions with retained opportunity records. Configure lifecycle rules and alarms.
7. Use modest build frequency, Lambda timeouts/concurrency, authenticated API throttling, and one region. Alerts at $30/$45/$55 AWS account/project spend are a backstop; track OpenAI separately and report combined estimates operationally.

AWS budget alerts are delayed notifications, not an exact $2/day kill switch. The system must enforce workload limits itself; the total infrastructure bill cannot be guaranteed to stop at a precise daily amount. [AWS budget guidance](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-best-practices.html)

## 9. Updates, notifications, and failure behavior

Send a short daily digest only when there are new strong matches, material changes to pursuits, or a verified action deadline within seven days. Include up to five recommendations, why each fits, next action, and app links. Do not send routine “nothing changed” emails. Deduplicate sends by run/date and content; retries must not intentionally resend a completed digest. An ambiguous email-delivery result may need operational reconciliation.

| Condition | Required behavior |
| --- | --- |
| Healthy run, no relevant results | Clear empty state, successful run timestamp |
| Some jobs fail | Keep completed findings, label partial run, bounded automatic retry |
| Full run fails or >36 hours without a successful run | Preserve existing records, show stale status, send one operational alert per incident |
| Budget exhausted | Pause new research, show delayed freshness, resume automatically when allowance resets |
| Source inaccessible | Mark missing evidence; try alternate official sources within budget; continue other records |
| Date/source conflict | Show uncertainty, keep conflicting references, remove from actionable shortlist until resolved |
| Deadline passes/cancellation | Remove from shortlist, retain record and user decisions |
| Amendment changes qualification | Reassess, record before/after, notify if material; never auto-pursue |

A request to human-review a business opportunity is expected. A request to paste research, upload documents, or repair ordinary ingestion is not part of the product workflow.

## 10. Build order and acceptance criteria

### Milestone 1 — Build the complete system locally

Implement the research runner, schema, budget ledger, persistence, qualification, API, authentication integration, three-tab frontend, detail drawer, and alerts. Exercise research and service behavior with local adapters and fixtures. Complete production integration code without making live credentials or a paid pilot a prerequisite for finishing the app.

Local acceptance: simulated scheduled discovery flows into the UI, evidence survives normalization, decisions survive amendments, budgets/recovery work under injected faults, and production artifacts build. Use approximately 30 labeled scenarios. Fixtures must remain visibly fictional in development and must not be shipped as live opportunities.

### Milestone 2 — Prepare Terraform and the deployment handoff

Complete Terraform, artifact packaging, configuration examples, secret/setup scripts, and the runbook. Run formatting and backend-free validation. When deployment credentials/backend/inputs are available, produce and review the actual Terraform plan. Local validation and mocked tests do not verify remote services or real costs. No apply belongs in these first two milestones.

### Milestone 3 — Final apply, live smoke checks, and pilot

At the end of the build, apply the reviewed Terraform plan and run the prepared final setup/hosting release steps. Verify live authentication, storage, alerts, and actual model search/background/output behavior. Start with a bounded research smoke test, then enable operational readiness and the unattended pilot. Measure source quality and actual API/AWS cost. If quality or economics fail, tune within the same scope/budget and validate again; do not quietly increase spending or introduce manual ingestion.

### MVP release checklist

- [ ] All application functionality, local tests, production artifacts, and Terraform configuration were completed before the first apply; record local versus post-deployment validation separately.
- [ ] A seven-day pilot completes routine discovery-to-dashboard updates without copying, forwarding, uploading, or portal interaction.
- [ ] A research run can be interrupted and resumed without duplicate canonical records or overwritten user decisions.
- [ ] Repeated discovery and an amendment to the same agency/solicitation produce one opportunity with history.
- [ ] A high-fit expired, canceled, stale, or definitively blocked record cannot occupy the actionable shortlist.
- [ ] Missing documents produce provisional/needs-verification behavior, not a fabricated fact or confident suppression.
- [ ] Confirmed staffing-only, commodity-license, generic UC, and NG911 fixtures are suppressed; mixed implementation scope remains reviewable.
- [ ] Platform-neutral cloud modernization can qualify without mentioning AWS; keyword repetition does not increase points.
- [ ] Every main-shortlist fit rationale and deadline has supporting official evidence and a verification timestamp.
- [ ] Top five contains no known duplicate cluster and is never padded when fewer qualify.
- [ ] Pass and restore survive future research runs; no-capacity passes do not change scoring rules.
- [ ] Fault injection covers malformed output, provider timeout, source failure, repeated scheduler delivery, and exhausted budget.
- [ ] Daily call/output limits and budget reservations are exercised with retries and in-flight work; budget exhaustion leaves the UI usable.
- [ ] Unauthenticated users cannot read or mutate opportunity data; model/source content cannot execute as HTML or alter user status.
- [ ] Pilot cost projects to no more than $60/30 days using measured model usage and attributable AWS costs, without promotional credits. If not, reduce workload before release.
- [ ] On the labeled evaluation set, at least 80% of displayed shortlist candidates are judged worth reviewing by GRS. Report the sample size; do not treat this as a guarantee of live-market recall.

One-time evaluation by GRS is product validation, not an ongoing ingestion requirement. Do not measure discovery recall without an independently assembled comparison set. Useful early measures are shortlist precision, supported-claim accuracy, duplicate rate, freshness, unattended run success, and cost per useful finding.

## 11. Explicitly deferred

- Procurement portal APIs, custom portal crawlers, automated portal accounts/logins.
- Manual intake/import/upload workflows and inbound email processing.
- Comprehensive 50-state source coverage or claims of guaranteed discovery.
- OCR, bulk document ingestion, vector search, and a research chatbot.
- CRM integrations, proposal generation/submission, contact enrichment, and outreach.
- Pipeline forecasting, account intelligence, partner databases, and autonomous pursuit decisions.
- Rule editing in the frontend, automatic weight learning, multiple model providers, complex permissions.

Keep the first release focused: **open the app, see the strongest evidence-backed opportunities, and decide where GRS should spend time.**
