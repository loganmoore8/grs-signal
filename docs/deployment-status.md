# Deployment status

Deployment account: `062408551112`; region: `us-west-2`; AWS CLI profile: `AdministratorAccess-062408551112`.
Release branch: `main`.
App: https://main.d1t0i4fhkkwocd.amplifyapp.com
API: https://u6suh4aaf5.execute-api.us-west-2.amazonaws.com

AWS infrastructure has been provisioned. Sender, recipient and initial user are `logan.moore@guidedreach.com`. The email identity was already verified and imported. The account is in the SES sandbox, which permits sending to this verified recipient. The Cognito invitation was sent. SNS confirmation and hosted sign-in remain live acceptance steps.

Research is configured for `openai.gpt-5.6-terra` through Amazon Bedrock Mantle, signed with refreshable IAM credentials. No separate OpenAI API key is needed. Luna inference was denied despite reported access. Terra was selected and deployed on 2026-09-14. Its agreement is AVAILABLE, but a live request also returned HTTP 401 `access_denied`: `openai.gpt-5.6-terra is not available for this account`. The rejected request reservation was released. Research remains paused. See [the prepared access request](bedrock-access-request.md). The empty OpenAI secret was removed with its seven-day recovery period.

The response endpoint is `/openai/v1/responses`. The legacy `/v1` route can list models but rejects web search. IAM permits the selected model and regional web search/fetch. A regression test verifies SigV4 authentication and the endpoint. Live DynamoDB exposed the reserved `bucket` attribute; GSI queries now use an expression alias.

Terra regional token pricing is $2.20/M input and $13.20/M output. Output is limited to 8,000 tokens per request. Reservations cover a 40,000-input-token estimate, the full output limit and the tool allowance; larger actual inputs can still exceed an estimate. AWS Pricing API confirms Oregon web-search queries cost $0.012 each (SKU E6H6Z5RYDRVX7HF9, effective 2026-08-01). The app keeps its $1.25/day, $37.50/month research allowance and 30 daily calls. These remain estimates and workload controls, not a guaranteed invoice cap. Reconcile research charges on AWS without double-counting them as infrastructure.

Sources: [model pricing](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-terra.html), [web search](https://docs.aws.amazon.com/bedrock/latest/userguide/web-search.html), [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/).

Terraform state and private inputs remain local, ignored by git, with restricted file permissions. A protected local backup is maintained under `~/.aws/grs-signal-state-backup`. Migrate state to a protected shared backend before a second operator uses Terraform.

Local verification: 62 tests, type checking and production builds passed. Initial live checks passed for unauthenticated API rejection and the worker readiness guard. Rejected model checks did not run inference; their budget reservations were released. Amplify build 1 succeeded from release commit `4a16883`. The hosted page loads and redirects to the correct Cognito PKCE sign-in. Live DynamoDB reads/GSI queries/conditional transaction races and S3 writes passed. SES accepted a deployment test email. Final Terraform plan reports no changes. First sign-in, SNS subscription confirmation, successful Bedrock research, and the seven-day quality/cost pilot remain pending.

Terra release: `d4f9cf8`; 63 tests, type checking, formatting and production builds passed. The worker remains paused pending actual model access.
