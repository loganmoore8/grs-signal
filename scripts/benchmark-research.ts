/** Paid, opt-in comparison against user-supplied discovery examples. Does not ingest. */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AwsStore } from '../packages/storage/aws';
import { BedrockResearch } from '../services/research/provider';
import { reserve, settle, requestReservation, usageCost } from '../services/research/budget';
import benchmark from '../config/research-benchmark.json';
import { assess } from '../packages/domain/index';
if (process.env.ALLOW_LIVE_RESEARCH !== 'true')
  throw Error('Set ALLOW_LIVE_RESEARCH=true to authorize paid benchmark calls.');
const mode = process.argv[2] || 'sources';
if (!['sources', 'discovery'].includes(mode)) throw Error('Use sources or discovery');
const d = JSON.parse(
  execFileSync('terraform', ['-chdir=infra', 'output', '-json', 'deployment'], {
    encoding: 'utf8',
  }),
);
const search = JSON.parse(
  execFileSync('terraform', ['-chdir=infra', 'output', '-json', 'research_search'], {
    encoding: 'utf8',
  }),
);
Object.assign(process.env, {
  AWS_REGION: d.region,
  OPPORTUNITIES_TABLE: d.opportunities_table,
  RUNS_TABLE: d.runs_table,
  HISTORY_TABLE: d.history_table,
  SNAPSHOTS_BUCKET: d.snapshots_bucket,
  SEARCH_GATEWAY_URL: search.url,
  SEARCH_REGION: search.region,
});
const store = new AwsStore(),
  now = new Date(),
  reservation = `brief-benchmark:${randomUUID()}`,
  calls = mode === 'sources' ? 0 : 4;
if (!(await reserve(store, reservation, requestReservation(calls), calls, now)))
  throw Error('Budget cannot cover benchmark; no paid request submitted.');
console.log(JSON.stringify({ mode, reservation }));
const provider = new BedrockResearch(store);
const id = await provider.start({
  jobId: reservation,
  theme:
    'Conversational AI, virtual agents, chatbots and generative AI for local government and public authorities',
  windowDays: 14,
  now: now.toISOString(),
  maxCalls: calls,
  known: [],
  ...(mode === 'sources' ? { sourceUrls: benchmark.cases.map((c) => c.sourceUrl) } : {}),
});
const result = await provider.poll(id);
await settle(
  store,
  reservation,
  usageCost(result.inputTokens, result.outputTokens, result.calls),
  result.calls,
);
await store.snapshot(reservation, { mode, id, result });
console.log(
  JSON.stringify(
    {
      mode,
      id,
      status: result.status,
      cost: usageCost(result.inputTokens, result.outputTokens, result.calls),
      diagnostics: result.diagnostics,
      error: result.error,
      candidates: result.candidates.map((c) => ({
        agency: c.agency,
        title: c.title,
        dueDate: c.dueDate,
        role: c.role,
        buyerProfile: c.buyerProfile,
        confidence: c.confidence,
        score: assess(c, now).score,
      })),
      cases: benchmark.cases.map((c) => ({
        agency: c.agency,
        retained: result.candidates.some(
          (r) =>
            r.solicitationNumber === c.solicitationNumber ||
            r.agency.toLowerCase().includes(c.agency.toLowerCase()),
        ),
      })),
    },
    null,
    2,
  ),
);
if (result.status !== 'completed') process.exitCode = 1;
