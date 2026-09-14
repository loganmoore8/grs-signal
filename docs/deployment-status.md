# Deployment status

Deployment account: `062408551112`; region: `us-west-2`; AWS CLI profile: `AdministratorAccess-062408551112`.
Release branch: `main`.
App: https://main.d1t0i4fhkkwocd.amplifyapp.com
API: https://u6suh4aaf5.execute-api.us-west-2.amazonaws.com

AWS infrastructure has been provisioned. Sender, recipient and initial user are `logan.moore@guidedreach.com`. The email identity was already verified and imported. The account is in the SES sandbox, which permits sending to this verified recipient. The Cognito invitation was sent. SNS confirmation and hosted sign-in remain live acceptance steps.

Research now uses `openai.gpt-5.6-luna` through Amazon Bedrock Mantle, signed with refreshable IAM credentials. No separate OpenAI API key is needed. Model agreement is AVAILABLE, authorization is AUTHORIZED, and regional entitlement is AVAILABLE. Nevertheless, Mantle inference returns HTTP 401 `access_denied`: the model is not available for this account. Research remains paused. See [the prepared access request](bedrock-access-request.md). The empty OpenAI secret was removed with its seven-day recovery period.

The response endpoint is `/openai/v1/responses`. The legacy `/v1` route can list models but rejects web search. IAM permits the selected model and regional web search/fetch. A regression test verifies SigV4 authentication and the endpoint. Live DynamoDB exposed the reserved `bucket` attribute; GSI queries now use an expression alias.

Bedrock regional token pricing is $0.22/M input and $1.32/M output. AWS Pricing API confirms Oregon web-search queries cost $0.012 each (SKU E6H6Z5RYDRVX7HF9, effective 2026-08-01). The app keeps its $1.25/day, $37.50/month research allowance and 30 daily calls. These remain estimates and workload controls, not a guaranteed invoice cap. Reconcile research charges on AWS without double-counting them as infrastructure.

Sources: [model pricing](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-56-luna.html), [web search](https://docs.aws.amazon.com/bedrock/latest/userguide/web-search.html), [Bedrock pricing](https://aws.amazon.com/bedrock/pricing/).

Terraform state and private inputs remain local, ignored by git, with restricted file permissions. A protected local backup is maintained under `~/.aws/grs-signal-state-backup`. Migrate state to a protected shared backend before a second operator uses Terraform.

Local verification: 62 tests, type checking and production builds passed. Initial live checks passed for unauthenticated API rejection and the worker readiness guard. Rejected model checks did not run inference; their budget reservations were released. Amplify build 1 succeeded from release commit `4a16883`. The hosted page loads and redirects to the correct Cognito PKCE sign-in. Live DynamoDB reads/GSI queries/conditional transaction races and S3 writes passed. SES accepted a deployment test email. Final Terraform plan reports no changes. First sign-in, SNS subscription confirmation, successful Bedrock research, and the seven-day quality/cost pilot remain pending.
