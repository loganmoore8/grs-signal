import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { LocalStore } from '../packages/storage/local';
import { reserve, settle, requestReservation } from '../services/research/budget';
import { startRun, tick, ingest, type Run } from '../services/research/engine';
import { FakeProvider } from './local/fake-provider';
import { demoCandidates } from './fixtures/opportunities';
import { api } from '../services/api/handler';
import type { Opportunity } from '../packages/domain/index';
let dir: string, store: LocalStore;
const now = new Date('2026-09-14T12:00:00Z');
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'grs-test-'));
  store = new LocalStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('atomically reserves budgets and settles only once', async () => {
  const results = await Promise.all([
    reserve(store, 'a', 0.8, 20, now),
    reserve(store, 'b', 0.8, 20, now),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const winner = results[0] ? 'a' : 'b';
  await settle(store, winner, 0.12, 2);
  await settle(store, winner, 0.12, 2);
  const b = await store.get<{ spent: number; reserved: number }>('runs', 'budget:day:2026-09-14');
  expect(b?.spent).toBeCloseTo(0.12);
  expect(b?.reserved).toBe(0);
});
it('runs discovery unattended and repeated ticks do not duplicate records', async () => {
  await startRun(store, 'local', now);
  await startRun(store, 'local', now);
  const p = new FakeProvider();
  await tick(store, p, now);
  await tick(store, p, now);
  await tick(store, p, now);
  expect(await store.list('opportunities')).toHaveLength(7);
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.status).toBe('completed');
});
it('merges repeated and concurrent identities', async () => {
  const c = demoCandidates(now)[0]!;
  await Promise.all([ingest(store, c, 'a', now), ingest(store, c, 'b', now)]);
  expect(await store.list('opportunities')).toHaveLength(1);
});
it('unknown submission outcome is never blindly resubmitted', async () => {
  await startRun(store, 'local', now);
  let calls = 0;
  const provider = {
    start: async () => {
      calls++;
      throw new Error('timeout');
    },
    poll: async () => {
      throw new Error('must not poll');
    },
    cancel: async () => {},
  };
  await tick(store, provider, now);
  await tick(store, provider, now);
  expect(calls).toBe(4);
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.status).toBe('partial');
});
it('does not merge different solicitation numbers sharing a portal landing URL', async () => {
  const c = demoCandidates(now)[0]!;
  await ingest(store, c, 'a', now);
  await ingest(store, { ...c, solicitationNumber: 'DEMO-DIFFERENT-99' }, 'b', now);
  expect(await store.list('opportunities')).toHaveLength(2);
});
it('requires authentication and preserves decisions through research', async () => {
  const c = demoCandidates(now)[0]!;
  const o = await ingest(store, c, 'a', now);
  expect((await api(store, 'GET', '/opportunities', {}, null, null)).statusCode).toBe(401);
  const result = await api(
    store,
    'PATCH',
    `/opportunities/${o.id}`,
    {},
    { version: o.version, status: 'pursue' },
    'user',
  );
  expect(result.statusCode).toBe(200);
  await ingest(store, { ...c, dueDate: '2026-11-01' }, 'b', now);
  expect((await store.get<Opportunity>('opportunities', o.id))?.status).toBe('pursue');
});

it('defers a Nova request when the remaining budget cannot cover its token allowance', async () => {
  expect(await reserve(store, 'earlier-research', 1.23, 1, now)).toBe(true);
  expect(await reserve(store, 'terra-retry', requestReservation(2), 2, now)).toBe(false);
});

it('limits synchronous submissions per worker tick and completes on subsequent ticks', async () => {
  await startRun(store, 'live', now);
  const p = new FakeProvider();
  await tick(store, p, now, 1);
  const jobs = await store.list<{ id: string; status: string }>('runs', 'job');
  expect(jobs.filter((j) => j.status === 'polling')).toHaveLength(1);
  expect(jobs.filter((j) => j.status === 'queued')).toHaveLength(3);
  for (let i = 0; i < 5; i++) await tick(store, p, now, 1);
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.status).toBe('completed');
});
