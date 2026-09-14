# Draft AWS model-access request — not sent

Please enable Amazon Bedrock Mantle inference for `openai.gpt-5.6-luna` in AWS account `062408551112`, region `us-west-2`.

Use case: GRS Signal, an internal Guided Reach Solutions procurement intelligence application. It researches public-sector contact-center modernization opportunities using official sources and Bedrock Web Search. Expected research allowance is $1.25/day and $37.50/month.

At 2026-09-14 06:55 UTC, signed requests to `https://bedrock-mantle.us-west-2.api.aws/openai/v1/responses` return HTTP 401, code `access_denied`, with the message:

> openai.gpt-5.6-luna is not available for this account. You can explore other available models on Amazon Bedrock. For additional access options, contact AWS Sales at https://aws.amazon.com/contact-us/sales-support/

Latest request ID: `req_g3nmnwaiy7kynpaunavnhpxl4mqd2kp7bq3zw42itdcbbo7mnj4a`.

Checks completed:

- Region, model ID, Responses endpoint and SigV4 signing verified.
- Model agreement created; agreement status AVAILABLE.
- `get-foundation-model-availability` returns authorization AUTHORIZED, entitlement AVAILABLE and region AVAILABLE.
- Mantle model listing returns Luna with status available.
- Request made with AdministratorAccess; application IAM simulations allow the selected model plus regional search and fetch.
- Rejection persists after agreement activation and propagation time. No successful inference has run.

Please check account-level eligibility and enablement for proprietary OpenAI models on Mantle. The application remains paused pending a successful bounded live check.
