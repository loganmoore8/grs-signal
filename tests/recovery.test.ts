import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { LocalStore } from '../packages/storage/local';
import { startRun, tick, ingest, type Run } from '../services/research/engine';
import { reserve } from '../services/research/budget';
import { notify } from '../services/research/alerts';
import { costReport } from '../services/research/cost';
import { FakeProvider } from './local/fake-provider';
import { demoCandidates } from './fixtures/opportunities';
import type { ResearchResult } from '../services/research/provider';
let dir: string, store: LocalStore;
const now = new Date('2026-09-14T12:00:00Z');
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'grs-recovery-'));
  store = new LocalStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('retries only two known failed jobs once within the 30-call allowance', async () => {
  await startRun(store, 'local', now);
  let starts = 0;
  const provider = {
    start: async () => `response-${++starts}`,
    poll: async (id: string): Promise<ResearchResult> => ({
      status: 'failed',
      candidates: [],
      calls: Number(id.split('-')[1]) <= 4 ? 6 : 2,
      inputTokens: 1000,
      outputTokens: 0,
      error: 'Malformed',
    }),
    cancel: async () => {},
  };
  for (let i = 0; i < 5; i++) await tick(store, provider, now);
  expect(starts).toBe(6);
  expect(
    (await store.get<{ calls: number }>('runs', 'budget:day:2026-09-14'))?.calls,
  ).toBeLessThanOrEqual(30);
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.status).toBe('partial');
});
it('defers research when reservations consume the allowance', async () => {
  await reserve(store, 'existing', 1.25, 30, now);
  await startRun(store, 'local', now);
  await tick(
    store,
    {
      start: async () => {
        throw new Error('must not submit');
      },
      poll: async () => {
        throw new Error('must not poll');
      },
      cancel: async () => {},
    },
    now,
  );
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.status).toBe('budget_deferred');
});
// This fixture exercises hundreds of real filesystem operations on the local adapter.
// Give slower disks room to finish before teardown removes its temporary directory.
it('retains overflow and preserves daily counters across repeated ticks', async () => {
  const base = demoCandidates(now)[0]!;
  const candidates = Array.from({ length: 40 }, (_, i) => ({
    ...base,
    agency: `Agency ${i}`,
    solicitationNumber: `BID-${i}`,
    officialUrl: `https://example.com/${i}`,
  }));
  const provider = {
    start: async () => 'result',
    poll: async (): Promise<ResearchResult> => ({
      status: 'completed',
      candidates,
      inputTokens: 100,
      outputTokens: 100,
      calls: 1,
    }),
    cancel: async () => {},
  };
  await startRun(store, 'local', now);
  await tick(store, provider, now);
  await tick(store, provider, now);
  await tick(store, provider, now);
  expect(await store.list('opportunities')).toHaveLength(15);
  expect((await store.get<Run>('runs', 'run:2026-09-14'))?.qualifiedCount).toBe(15);
  const pending = (await store.list<{ processed: boolean }>('history', 'candidate')).filter(
    (c) => !c.processed,
  );
  expect(pending).toHaveLength(25);
}, 15000);
it('captures one meaningful digest, stays quiet on repeats, and alerts on amendments', async () => {
  await startRun(store, 'local', now);
  await tick(store, new FakeProvider(), now);
  await tick(store, new FakeProvider(), now);
  const sent: string[] = [];
  const mailer = {
    send: async (_: string, text: string) => {
      sent.push(text);
    },
  };
  await notify(store, mailer, 'https://app.example.com', now);
  await notify(store, mailer, 'https://app.example.com', now);
  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain('?opportunity=');
  await ingest(store, { ...demoCandidates(now)[0]!, dueDate: '2026-11-15' }, 'amendment', now);
  await notify(store, mailer, 'https://app.example.com', now);
  expect(sent).toHaveLength(2);
});
it('records ambiguous email delivery without sending a duplicate', async () => {
  await startRun(store, 'local', now);
  await tick(store, new FakeProvider(), now);
  await tick(store, new FakeProvider(), now);
  let attempts = 0;
  const mailer = {
    send: async () => {
      attempts++;
      throw new Error('timeout after send');
    },
  };
  await notify(store, mailer, 'https://app.example.com', now);
  await notify(store, mailer, 'https://app.example.com', now);
  expect(attempts).toBe(1);
});
it('reports estimates separately from unavailable AWS billing', async () => {
  await reserve(store, 'a', 1, 20, now);
  const report = await costReport(store, now);
  expect(report.actualAwsUsd).toBeNull();
  expect(report.projectedCombinedUsd).toBeCloseTo(15 + 30 / 14);
  expect(report.plannedMonthlyCeilingUsd).toBe(105);
});
