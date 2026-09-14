# Deployment status

Deployment account: `062408551112`; region: `us-west-2`; AWS CLI profile: `AdministratorAccess-062408551112`.
Release branch: `main`.
App: https://main.d1t0i4fhkkwocd.amplifyapp.com
API: https://u6suh4aaf5.execute-api.us-west-2.amazonaws.com

AWS infrastructure has been provisioned. Sender, recipient and initial user are `logan.moore@guidedreach.com`. The email identity was already verified and imported. The account is in the SES sandbox, which permits sending to this verified recipient. The Cognito invitation was sent. SNS confirmation and hosted sign-in remain live acceptance steps.

Research now uses **OpenAI GPT-5.6 Terra**, `gpt-5.6-terra`, directly through `https://api.openai.com/v1/responses`, with web search and strict structured output. The worker loads its API credential from AWS Secrets Manager secret `grs-signal/openai`. The value is outside source, artifacts, Lambda environment variables and Terraform state; only the secret ARN is configured. The user explicitly authorized use of the supplied credential after a rotation recommendation.

**Live research remains paused: OpenAI API credits are exhausted.** The key authenticated, the corrected structured-output request was accepted, and background response `resp_01bc3cf53d0449d5006aa7a025639c87d094d58beadf6a5ccd` failed with “You have no credits remaining.” No search ran; the reservation settled at $0. Add credits to the owning organization at https://platform.openai.com/settings/organization/billing/ and rerun the live check before enabling.

The first direct request exposed an unsupported JSON Schema `uri` format. The API schema now omits that format while local Zod validation still enforces HTTP(S) URLs. Source support is checked against provider-returned search/citation metadata. Output is limited to 8,000 tokens with low reasoning effort. Background response IDs survive worker restarts; failed polling retrieves the same response rather than duplicating paid submissions.

Direct API rates are $2/M input tokens, $12/M output tokens and $0.01 per web-search call. Each reservation covers 40,000 estimated input tokens, the full output limit and the allowed search calls. The two-call smoke reserves $0.196. Normal discovery allows six calls per theme and eight recheck calls; at most two failed jobs receive a two-call retry. Daily/monthly workload allowances remain $1.25/$37.50 with 30 daily search calls. Search context is billed as input. Estimates are not an invoice cap; direct API charges are separate from AWS infrastructure charges.

Sources: [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [pricing](https://developers.openai.com/api/docs/pricing).

Historical Bedrock blockers are documented in [Nova access handoff](nova-access-handoff.md) and [the previous access draft](bedrock-access-request.md). No organization policy was modified.

Terraform state and private inputs remain local, ignored by git, with restricted file permissions. A protected local backup is maintained under `~/.aws/grs-signal-state-backup`. Migrate state to a protected shared backend before a second operator uses Terraform.

Local OpenAI verification: 65 tests, type checking and Lambda packaging passed. Tests cover required bounded search, URL schema compatibility, citation-based source downgrades, malformed output accounting, background polling and missing usage. Authentication and request-schema acceptance were tested live; actual research content/quality remains unverified because API credits are exhausted.

Earlier deployed checks passed for unauthenticated API rejection, worker readiness guard, DynamoDB/GSI/conditional transaction races, S3 writes and SES test email acceptance. Amplify build 1 succeeded from `4a16883`; this backend migration does not change the frontend. First hosted sign-in, SNS confirmation, successful web research and the seven-day quality/cost pilot remain pending.

Direct OpenAI deployment completed: secret metadata imported, worker secret-read policy added, obsolete Bedrock IAM policy removed, both Lambda bundles updated. Post-deploy smoke passed (API 401 and worker `not_ready`); final Terraform plan reports no changes.
