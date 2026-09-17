import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { ZodError } from 'zod';
import {
  Conflict,
  rank,
  shortlistEligible,
  qualifiedEligible,
  updateOpportunity,
  viewOf,
  type Opportunity,
  type View,
} from '../../packages/domain/index';
import type { Store } from '../../packages/storage/store';
import { AwsStore } from '../../packages/storage/aws';
import type { Run } from '../research/engine';
import { importSchema, importedCandidate } from '../../packages/domain/import';
import { ingest } from '../research/engine';
import scoring from '../../config/scoring.json';
import { costReport } from '../research/cost';
export async function api(
  store: Store,
  method: string,
  path: string,
  query: Record<string, string | undefined>,
  body: unknown,
  actor: string | null,
  mode = 'live',
) {
  const response = (statusCode: number, data: unknown) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(data),
  });
  if (!actor) return response(401, { error: 'Sign in to access GRS Signal.' });
  try {
    if (method === 'GET' && path === '/health') {
      const runs = (await store.list<Run>('runs'))
        .filter((r) => r.id?.startsWith('run:'))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      return response(200, {
        mode,
        lastRun: runs[0] || null,
        lastSuccessfulRun: runs.find((r) => r.status === 'completed') || null,
        cost: await costReport(store),
      });
    }
    if (method === 'POST' && path === '/opportunities/import') {
      const input = importSchema.parse(body);
      const opportunity = await ingest(
        store,
        importedCandidate(input),
        'import:' + new Date().toISOString(),
        new Date(),
        { kind: input.kind, actor, notes: input.report },
      );
      return response(200, opportunity);
    }
    if (method === 'GET' && path === '/opportunities') {
      const view = (query.view || 'recommended') as View;
      if (!['recommended', 'pursuing', 'filtered'].includes(view))
        return response(400, { error: 'Unknown view' });
      let rows = (await store.list<Opportunity>('opportunities')).filter((o) => viewOf(o) === view);
      if (query.queue && !['review', 'qualified'].includes(query.queue))
        return response(400, { error: 'Unknown queue' });
      if (view === 'recommended' && query.queue)
        rows = rows.filter((o) =>
          query.queue === 'qualified' ? qualifiedEligible(o) : !qualifiedEligible(o),
        );
      if (view === 'pursuing' && query.completed !== 'true')
        rows = rows.filter((o) => !['won', 'lost'].includes(o.status));
      if (query.q) {
        const q = query.q.toLowerCase();
        rows = rows.filter((o) =>
          `${o.title} ${o.agency} ${o.solicitationNumber}`.toLowerCase().includes(q),
        );
      }
      if (query.reason)
        rows = rows.filter(
          (o) => (o.passReason || o.facts.excludedReason || o.disposition) === query.reason,
        );
      if (query.since) rows = rows.filter((o) => o.firstFoundAt > query.since!);
      rows.sort(
        view === 'pursuing'
          ? (a, b) =>
              (a.userNextDate || a.dueDate || '9999').localeCompare(
                b.userNextDate || b.dueDate || '9999',
              )
          : rank,
      );
      const shortlist =
        view === 'recommended' && !query.queue
          ? rows.filter((o) => shortlistEligible(o)).slice(0, scoring.maxShortlist)
          : [];
      const rest = rows.filter((o) => !shortlist.some((s) => s.id === o.id));
      const offset = Math.max(0, Number(query.cursor) || 0),
        items = rest.slice(offset, offset + 50);
      return response(200, {
        shortlist,
        items,
        total: rows.length,
        nextCursor: offset + 50 < rest.length ? String(offset + 50) : null,
      });
    }
    const match = path.match(/^\/opportunities\/([a-zA-Z0-9-]+)$/);
    if (match) {
      const o = await store.get<Opportunity>('opportunities', match[1]!);
      if (!o) return response(404, { error: 'Opportunity not found' });
      if (method === 'GET') return response(200, o);
      if (method === 'PATCH') {
        const updated = updateOpportunity(o, body, actor);
        await store.put('opportunities', o.id, updated, o.version);
        return response(200, updated);
      }
    }
    return response(404, { error: 'Not found' });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Query capacity exceeded'))
      return response(503, {
        error:
          'The view exceeds its current capacity. No partial ranking was returned; archive completed records before expanding coverage.',
      });
    if (e instanceof Conflict) return response(409, { error: e.message });
    if (e instanceof ZodError)
      return response(400, {
        error: 'Invalid request fields',
        details: e.issues.map((i) => i.message),
      });
    if (e instanceof Error && e.message === 'Choose a pass reason.')
      return response(400, { error: e.message });
    throw e;
  }
}
let store: AwsStore;
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const auth = (
    event.requestContext as unknown as { authorizer?: { jwt?: { claims?: { sub?: string } } } }
  ).authorizer?.jwt?.claims?.sub;
  try {
    store ??= new AwsStore();
    return await api(
      store,
      event.requestContext.http.method,
      event.rawPath,
      event.queryStringParameters || {},
      event.body ? JSON.parse(event.body) : null,
      auth || null,
    );
  } catch (e) {
    console.error('API request failed', { name: (e as Error).name });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to complete request. Try again.' }),
    };
  }
}
