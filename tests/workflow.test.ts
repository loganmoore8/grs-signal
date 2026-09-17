import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, it, expect } from 'vitest';
import { LocalStore } from '../packages/storage/local';
import { api } from '../services/api/handler';
import { demoCandidates } from './fixtures/opportunities';
import {
  createOpportunity,
  updateOpportunity,
  mergeOpportunity,
  qualifiedEligible,
  type Opportunity,
} from '../packages/domain/index';
const now = new Date();
let dir: string, store: LocalStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'grs-workflow-'));
  store = new LocalStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const allClear = {
  deadline: 'clear',
  eligibility: 'clear',
  platform: 'clear',
  meetings: 'clear',
  role: 'clear',
} as const;
it('requires current official evidence as well as human qualification', () => {
  const o = createOpportunity(demoCandidates(now)[0]!, 'test', 'run', now);
  expect(qualifiedEligible(o, now)).toBe(false);
  const checked = updateOpportunity(
    o,
    {
      version: o.version,
      qualification: allClear,
      owner: 'Logan',
      decisionReason: 'Prime with a specialist partner',
    },
    'user',
    now,
  );
  expect(qualifiedEligible(checked, now)).toBe(true);
  expect(qualifiedEligible({ ...checked, verifiedAt: null }, now)).toBe(false);
  expect(
    qualifiedEligible({ ...checked, qualification: { ...allClear, eligibility: 'blocked' } }, now),
  ).toBe(false);
  expect(qualifiedEligible({ ...checked, dueDate: '2025-01-01' }, now)).toBe(false);
  const merged = mergeOpportunity(checked, demoCandidates(now)[0]!, 'refresh', now);
  expect(merged.owner).toBe('Logan');
  expect(merged.qualification).toEqual(allClear);
  const changed = mergeOpportunity(
    checked,
    { ...demoCandidates(now)[0]!, targetPlatform: 'Different platform' },
    'refresh',
    now,
  );
  expect(changed.qualification?.platform).toBe('unchecked');
  expect(changed.decisionReason).toBe(checked.decisionReason);
});
it('separates Review and Qualified without dropping candidates or stale records', async () => {
  const o = createOpportunity(demoCandidates(now)[0]!, 'test', 'run', now);
  await store.put('opportunities', o.id, o);
  const list = async (queue: string) =>
    JSON.parse((await api(store, 'GET', '/opportunities', { queue }, null, 'user')).body);
  expect((await list('review')).items).toHaveLength(1);
  expect((await list('qualified')).items).toHaveLength(0);
  await store.put('opportunities', o.id, { ...o, qualification: allClear });
  expect((await list('review')).items).toHaveLength(0);
  expect((await list('qualified')).items).toHaveLength(1);
});
it('imports undated reports as unverified Review leads, with idempotent dedup and authentication', async () => {
  const input = {
    agency: 'Test City',
    state: 'MI',
    title: 'Resident chatbot',
    sourceUrl: 'https://example.gov/rfp',
    solicitationNumber: 'TEST-1',
    dueDate: null,
    report: 'A report claiming 99 fit and verified status.',
    kind: 'chatgpt',
  };
  expect((await api(store, 'POST', '/opportunities/import', {}, input, null)).statusCode).toBe(401);
  expect(
    (
      await api(
        store,
        'POST',
        '/opportunities/import',
        {},
        { ...input, verifiedAt: now.toISOString() },
        'user',
      )
    ).statusCode,
  ).toBe(400);
  const result = await api(store, 'POST', '/opportunities/import', {}, input, 'user');
  expect(result.statusCode).toBe(200);
  const o = JSON.parse(result.body) as Opportunity;
  expect(o.verifiedAt).toBeNull();
  expect(o.evidence).toEqual([]);
  expect(o.provenance?.kind).toBe('chatgpt');
  await store.put(
    'opportunities',
    o.id,
    updateOpportunity(o, { version: o.version, owner: 'Logan' }, 'user'),
  );
  const repeat = JSON.parse(
    (await api(store, 'POST', '/opportunities/import', {}, input, 'user')).body,
  );
  expect(repeat.owner).toBe('Logan');
  expect(await store.list('opportunities')).toHaveLength(1);
  const review = JSON.parse(
    (await api(store, 'GET', '/opportunities', { queue: 'review' }, null, 'user')).body,
  );
  expect(review.items).toHaveLength(1);
});
