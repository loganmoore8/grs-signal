import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { demoCandidates } from './fixtures/opportunities';
import { LocalStore } from '../packages/storage/local';
import type { SourceDocument } from '../services/research/documents';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send = mocks.send;
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}));
import { BedrockResearch, parseResearchResponse } from '../services/research/provider';
let dir: string, store: LocalStore;
const now = '2026-09-14T12:00:00Z';
const c = demoCandidates(new Date(now))[0]!;
const text = c.evidence.map((e) => e.excerpt).join(' ') + ' '.repeat(210);
const docs: SourceDocument[] = [
  { url: c.officialUrl!, title: c.title, text, fetched: true, checkedAt: now },
];
function response(output = JSON.stringify({ candidates: [c] })) {
  return {
    $metadata: {},
    metrics: { latencyMs: 10 },
    usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
    stopReason: 'end_turn' as const,
    output: { message: { role: 'assistant' as const, content: [{ text: output }] } },
  };
}
beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(join(tmpdir(), 'oss-test-'));
  store = new LocalStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('bounds searches and retrieves durable results across restarts without repeating inference', async () => {
  mocks.send
    .mockResolvedValueOnce(
      response(JSON.stringify({ queries: ['Agency current deadline amendment'], urls: [] })),
    )
    .mockResolvedValue(response());
  const search = {
    search: vi.fn().mockResolvedValue([{ url: c.officialUrl, title: c.title, text }]),
  };
  const fetchPage = vi.fn().mockResolvedValue({ url: c.officialUrl, text });
  const p = new BedrockResearch(store, search, fetchPage);
  const id = await p.start({
    jobId: 'test',
    theme: 'Connect',
    windowDays: 30,
    now,
    maxCalls: 2,
    known: [],
  });
  expect((await new BedrockResearch(new LocalStore(dir), search).poll(id)).status).toBe(
    'completed',
  );
  expect(search.search).toHaveBeenCalledTimes(2);
  expect(search.search.mock.calls[1][0]).toContain('amendment');
  expect((await p.poll(id)).inputTokens).toBe(4000);
  expect((await p.poll(id)).outputTokens).toBe(2000);
  expect(mocks.send).toHaveBeenCalledTimes(2);
  expect(mocks.send.mock.calls[0][0].input).toMatchObject({
    modelId: 'us.anthropic.claude-sonnet-4-6',
    inferenceConfig: { maxTokens: 1500 },
  });
});
it('downgrades snippets and removes invented excerpts', () => {
  const r = parseResearchResponse(
    response(),
    docs.map((d) => ({ ...d, fetched: false })),
    2,
    now,
  );
  expect(r.candidates[0]?.confidence).toBe('partial');
  expect(r.candidates[0]?.verifiedAt).toBeNull();
  const invented = {
    ...c,
    evidence: c.evidence.map((e) => ({
      ...e,
      excerpt: 'This invented excerpt is absent from all fetched sources.',
    })),
  };
  expect(
    parseResearchResponse(response(JSON.stringify({ candidates: [invented] })), docs, 2, now)
      .candidates[0]?.evidence,
  ).toHaveLength(0);
});
it('preserves verified source excerpts and usage', () => {
  expect(parseResearchResponse(response(), docs, 2, now)).toMatchObject({
    status: 'completed',
    inputTokens: 2000,
    outputTokens: 1000,
    calls: 2,
  });
  expect(parseResearchResponse(response(), docs, 2, now).candidates[0]?.confidence).toBe(
    'supported',
  );
});
it('preserves costs when output is malformed or truncated', () => {
  expect(parseResearchResponse(response('{bad'), docs, 2, now)).toMatchObject({
    status: 'failed',
    inputTokens: 2000,
    calls: 2,
  });
  expect(
    parseResearchResponse({ ...response(), stopReason: 'max_tokens' }, docs, 2, now).status,
  ).toBe('failed');
});
it('does not return an id when durable storage fails', async () => {
  mocks.send
    .mockResolvedValueOnce(
      response(JSON.stringify({ queries: ['Agency current deadline amendment'], urls: [] })),
    )
    .mockResolvedValue(response());
  vi.spyOn(store, 'put').mockRejectedValue(new Error('storage unavailable'));
  const p = new BedrockResearch(store, { search: async () => [] });
  await expect(
    p.start({ jobId: 'test', theme: 'Connect', windowDays: 30, now, maxCalls: 1, known: [] }),
  ).rejects.toThrow('storage unavailable');
  expect(mocks.send).toHaveBeenCalledTimes(2);
});
it('missing usage retains the reservation instead of declaring zero cost', async () => {
  mocks.send.mockResolvedValue({ ...response(), usage: undefined });
  const p = new BedrockResearch(store, { search: async () => [] });
  await expect(
    p.start({ jobId: 'test', theme: 'Connect', windowDays: 30, now, maxCalls: 1, known: [] }),
  ).rejects.toThrow('omitted usage');
});
it('does not allow an open listing with a past deadline to become actionable', () => {
  const stale = {
    ...c,
    dueDate: '2026-09-02',
    dueAt: null,
    procurementState: 'open',
    ongoing: true,
  };
  const result = parseResearchResponse(
    response(JSON.stringify({ candidates: [stale] })),
    docs,
    2,
    now,
  );
  expect(result.candidates[0]).toMatchObject({
    procurementState: 'unknown',
    ongoing: false,
    confidence: 'partial',
    verifiedAt: null,
  });
  expect(result.candidates[0]?.nextAction).toContain('extension or closure');
});
it('accepts a duplicated runtime opening delimiter without relaxing field validation', () => {
  expect(
    parseResearchResponse(response('{\n' + JSON.stringify({ candidates: [c] })), docs, 2, now)
      .status,
  ).toBe('completed');
  expect(
    parseResearchResponse(
      response('{\n' + JSON.stringify({ candidates: [{ ...c, state: 'North Carolina' }] })),
      docs,
      2,
      now,
    ).status,
  ).toBe('failed');
});

it('accepts the runtime array prefix while retaining the strict object schema', () => {
  expect(
    parseResearchResponse(response('[\n' + JSON.stringify({ candidates: [c] })), docs, 2, now)
      .status,
  ).toBe('completed');
});

it('keeps a date-only deadline without inventing midnight or a timezone', () => {
  const dateOnly = { ...c, dueAt: c.dueDate, dueTimezone: 'UTC' };
  const result = parseResearchResponse(
    response(JSON.stringify({ candidates: [dateOnly] })),
    docs,
    1,
    now,
  );
  expect(result.status).toBe('completed');
  expect(result.candidates[0]?.dueAt).toBeNull();
  expect(result.candidates[0]?.dueDate).toBe(c.dueDate);
  expect(result.candidates[0]?.dueTimezone).toBeNull();
});
