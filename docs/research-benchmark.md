# Research brief and benchmark

The user's complete scheduled-task prompt is versioned in `config/research-brief.json` and used by both the planner and final qualifier. Search themes and query rotation cover citizen-service AI, CRM, knowledge, cloud modernization and contact centers. Discovery no longer deliberately targets universities. RFI, RFQ, ITN, sources-sought and market-research queries supplement RFP queries.

Scoring is deterministic: technical centrality 20, service scope 10, AWS alignment 10, prime potential 25, buyer fit 15, project size 10, publication recency 5 and response window 5. Population, budget and 14-day windows are preferences, not eligibility gates. Unknown size/value earns neutral partial credit. Profiles preserve unknowns; third-party AI contract-value estimates are not official budgets. A broader procurement can remain a subcontracting/partner lead while receiving a lower whole-contract prime score.

New-opportunity digests do not repeatedly notify for changes to unpursued discoveries. Tracked pursuits continue receiving meaningful amendments and verified deadline reminders. Operational failure/cost alerts remain separate.

## User-supplied comparison cases

As of September 16, 2026:

| Case | Source observation | Prior pipeline weakness |
| --- | --- | --- |
| Grand Rapids, 920-45-269 | HigherGov lists chatbot scope and September 24 deadline; official BidNet document restricted. Its value range is explicitly an AI estimate. | Narrow contact-center scope and official-only discovery gate could discard a credible lead instead of retaining uncertainty. |
| Denver Water, 10575 | Official procurement table lists AI Chatbot, August 31 release and September 30 deadline. Detailed platform requirements still require review. | A table row lacks adjacent “proposal due” prose required by the old regex. |
| Jackson, 20477-092226 | Official notice lists September 22 deadline and material citizen self-service/311 scope within ERP. | Contact-center-only qualification and exact deadline-prefix matching could reject the notice. |

These are user-provided leads, not evidence that the app discovered them independently. Their reported ChatGPT scores are not copied into GRS. The benchmark source list is separate from production queries and is not a hardcoded discovery feed.

Run opt-in paid validation with `ALLOW_LIVE_RESEARCH=true npx tsx scripts/benchmark-research.ts sources` (zero search calls, supplied-source extraction) or `... discovery` (four ordinary searches, no supplied URLs). AWS profile and normal daily/monthly budgets apply. Benchmark results are archived but not automatically ingested. Diagnostics distinguish retrieved/fetched sources, extracted candidates and post-extraction rejection reasons. Discovery source snapshots retain URL inventories for coverage analysis.

During validation, Bedrock rejected the expanded strict JSON grammar. Final qualification now supplies the full schema in the prompt and validates output locally; the smaller planning schema remains constrained. Malformed or truncated output fails closed. Known pre-inference schema rejections account for prior planning/search usage; ambiguous failures retain reservations. Regression tests cover this behavior.

## Completed source benchmark

Final source-seeded run `provider:3b747bcb-ea50-4444-97d6-2b9ab1be0d3b` retained all three supplied examples. Estimated cost $0.1719795; zero searches, 27 fetched sources. Grand Rapids scored 83, Denver Water 88, Jackson 45 with subcontractor role. All are partial confidence, not verified shortlist entries. Population fields and official budgets remain null. The model's narrative size/prime assumptions still require reviewer scrutiny.

Jackson initially exposed a false model date comparison (September 22 described as past on September 16). Source date comparisons are now computed in code and supplied with the evidence; the final run correctly retained Jackson. The four-search discovery attempt retrieved UCHRA and other chatbot pages but failed final schema validation before qualification. This is not a completed independent-discovery benchmark and does not establish recall of the three user examples. Today's regular search allowance was exhausted by the scheduled run and that four-query check; no cap increase was made.
