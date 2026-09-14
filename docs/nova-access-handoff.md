# Nova grounding access handoff

The Nova integration is ready for an organization administrator to resolve the live-access gate. No organization policy was modified and no support message was sent.

## Observed denial

- Workload account: `062408551112`, region `us-west-2`.
- Model/profile: `us.amazon.nova-2-lite-v1:0`.
- Action: `bedrock:InvokeTool`.
- Resource: `arn:aws:bedrock::062408551112:system-tool/amazon.nova_grounding`.
- Explicit-deny SCP: `arn:aws:organizations::985539802568:policy/o-dseyvfpdiw/service_control_policy/p-g1pt37l5`.
- Bedrock request: `e7c69027-2e95-48bd-b7a9-cb6809a70861`, HTTP 403.
- `organizations:DescribePolicy` is also unavailable to the current deployment-account session, so the policy content/cause has not been inspected.

## Required organization review

An authorized administrator of management account `985539802568` must inspect that SCP and allow the workload's Nova grounding action under the organization's intended controls. Adding another IAM Allow in the workload account cannot override this explicit Deny. Do not remove the entire SCP.

AWS documents that grounding uses `aws:RequestedRegion` value `unspecified`. If this denial comes from a region-restriction statement, a narrowly scoped exception for the grounding action may be appropriate. That cause is a hypothesis until the policy is read, not a confirmed diagnosis. Review the actual statement before choosing any change.

Reference: https://docs.aws.amazon.com/nova/latest/nova2-userguide/web-grounding.html#permissions-required

## After the restriction is resolved

Use the deployment profile and run `ALLOW_LIVE_RESEARCH=true npx tsx scripts/live-research-check.ts`. Inspect the archived response for schema compatibility, citations and actual token usage. A successful model catalog lookup alone is insufficient. Research stays paused until the live test passes. Then follow `docs/runbook.md` to enable and observe the first scheduled run.
