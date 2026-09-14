# Deployment status

Deployment account: `062408551112`; region: `us-west-2`; AWS CLI profile: `AdministratorAccess-062408551112`.
Release branch: `main`.
App: https://main.d1t0i4fhkkwocd.amplifyapp.com
API: https://u6suh4aaf5.execute-api.us-west-2.amazonaws.com

AWS infrastructure has been provisioned. Sender, recipient and initial user are `logan.moore@guidedreach.com`. The email identity was already verified and imported. The account is in the SES sandbox, which permits sending to this verified recipient. The Cognito invitation was sent. SNS confirmation and hosted sign-in remain live acceptance steps.

Research is configured for **Amazon Nova 2 Lite**, `us.amazon.nova-2-lite-v1:0`, through Bedrock Converse with the `nova_grounding` built-in tool and IAM authentication. No API key is required. The US inference profile routes to Oregon, N. Virginia and Ohio.

**Live research remains paused:** a real grounded request returned `AccessDeniedException` (HTTP 403), explicitly denied by AWS Organizations SCP `p-g1pt37l5`, organization `o-dseyvfpdiw`, management account `985539802568`. Denied action: `bedrock:InvokeTool`; resource: `arn:aws:bedrock::062408551112:system-tool/amazon.nova_grounding`. Request ID: `e7c69027-2e95-48bd-b7a9-cb6809a70861`. The rejected check's reservation was released. This is an organization policy restriction, not a subscription problem. The deployment account cannot read the SCP. See [the Nova access handoff](nova-access-handoff.md). Earlier Luna/Terra denials are retained in [the historical draft](bedrock-access-request.md).

Nova runs synchronously, with a 240-second client timeout, 300-second Lambda timeout and 330-second job lease. Each invocation submits at most one request. Raw responses are archived to S3 and compact results stored in DynamoDB before returning a response ID. Subsequent polling reads that stored result without another inference. Ambiguous failures retain reservations and are never blindly resubmitted. Output is limited to 5,000 tokens; prompts request at most three candidates per theme. Provider citation metadata, rather than URLs in generated text, controls source support.

AWS Pricing API confirms US/Oregon rates of $0.33/M input tokens, $2.75/M output tokens and $0.03 per grounded request (SKUs `73SJJMU52K4VFYET`, `9KATGVAHXXQ8S8W5`, `3AGCP8ST6JKUMY3Z`, effective 2026-08-01). Each request reserves $0.05695 for a 40,000-input-token estimate, full output limit and grounding. The ledger's `calls` now counts grounded API requests, not internal search queries; Nova does not expose the former provider's search-call limiter. Four theme requests plus at most two failed-response retries are scheduled per run. Daily/monthly allowances remain $1.25/$37.50 with 30 daily request slots. These are workload estimates, not an AWS invoice cap.

Sources: [Nova web grounding](https://docs.aws.amazon.com/nova/latest/nova2-userguide/web-grounding.html), [Nova pricing](https://aws.amazon.com/nova/pricing/).

Terraform state and private inputs remain local, ignored by git, with restricted file permissions. A protected local backup is maintained under `~/.aws/grs-signal-state-backup`. Migrate state to a protected shared backend before a second operator uses Terraform.

Local Nova verification: 65 tests, type checking, Lambda packaging and Terraform validation passed. Tests cover durable results across restarts, source downgrades, usage on malformed output, storage failure and one submission per worker tick. The real grounded request was denied before research ran, so output quality and live response compatibility are still unverified.

Earlier deployed checks passed for unauthenticated API rejection, the worker readiness guard, DynamoDB reads/GSI queries/conditional transaction races, S3 writes and SES test email acceptance. Amplify build 1 succeeded from `4a16883`; this backend migration does not change the frontend. First hosted sign-in, SNS subscription confirmation, successful grounded research and the seven-day quality/cost pilot remain pending.

Nova infrastructure apply completed: 0 resources added, 3 updated, 0 destroyed (worker IAM policy and both Lambda bundles; worker timeout increased to 300 seconds). Research readiness remains disabled.
Post-deploy smoke passed: unauthenticated API rejected and worker returned `not_ready`. Final Terraform plan reports no changes.
