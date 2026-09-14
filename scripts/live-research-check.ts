import OpenAI from 'openai';
import { configuredResearch } from '../services/research/credentials';
import { usageCost, reserve, settle, requestReservation } from '../services/research/budget';
import { AwsStore } from '../packages/storage/aws';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
if (process.env.ALLOW_LIVE_RESEARCH !== 'true')
  throw new Error(
    'Live research is disabled. Enable only during the final deployment validation stage.',
  );
const now = new Date();
const deployment = JSON.parse(
  execFileSync('terraform', ['-chdir=infra', 'output', '-json', 'deployment'], {
    encoding: 'utf8',
  }),
);
process.env.AWS_REGION = deployment.region;

process.env.OPPORTUNITIES_TABLE = deployment.opportunities_table;
process.env.RUNS_TABLE = deployment.runs_table;
process.env.HISTORY_TABLE = deployment.history_table;
process.env.SNAPSHOTS_BUCKET = deployment.snapshots_bucket;
const store = new AwsStore(),
  reservation = `deployment-smoke:${randomUUID()}`;
const provider = await configuredResearch();
if (!(await reserve(store, reservation, requestReservation(2), 2, now)))
  throw new Error('Research budget is exhausted; live check was not submitted.');
console.log(`Budget reservation: ${reservation}`);
const id = await provider
  .start({
    jobId: 'deployment-smoke',
    theme:
      'Find one recent U.S. public-sector contact-center modernization procurement with official evidence.',
    windowDays: 30,
    now: now.toISOString(),
    maxCalls: 2,
    known: [],
  })
  .catch(async (error: unknown) => {
    if (error instanceof OpenAI.APIError && [400, 401, 403, 404, 422].includes(error.status || 0)) {
      await settle(store, reservation, 0, 0);
    }
    throw error;
  });
await store.put(
  'runs',
  `smoke:${reservation}`,
  { responseId: id, reservation, createdAt: now.toISOString() },
  0,
);
console.log(`Started bounded live response ${id}. This command incurs API charges.`);
let finished = false;
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  const result = await provider.poll(id);
  if (result.status === 'pending') continue;
  await settle(
    store,
    reservation,
    usageCost(result.inputTokens, result.outputTokens, result.calls),
    result.calls,
  );
  await store.snapshot(reservation, result);
  console.log(
    JSON.stringify(
      {
        status: result.status,
        candidates: result.candidates.length,
        supportedCandidates: result.candidates.filter((c) => c.confidence === 'supported').length,
        calls: result.calls,
        estimatedUsd: usageCost(result.inputTokens, result.outputTokens, result.calls),
        error: result.error,
      },
      null,
      2,
    ),
  );
  if (
    result.status !== 'completed' ||
    result.calls < 1 ||
    result.calls > 2 ||
    !result.candidates.some((c) => c.confidence === 'supported')
  )
    process.exitCode = 1;
  finished = true;
  break;
}
if (!finished) {
  await provider.cancel(id);
  throw new Error(
    'Bounded live check timed out; cancellation requested. Inspect provider usage before retrying.',
  );
}
