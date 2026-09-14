import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { demoCandidates } from './fixtures/opportunities';
import { LocalStore } from '../packages/storage/local';
const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: class {
    send = mocks.send;
  },
  ConverseCommand: class {
    constructor(public input: unknown) {}
  },
}));
import { BedrockResearch, parseNovaResponse } from '../services/research/provider';
let dir: string, store: LocalStore;
const now = new Date('2026-09-01T12:00:00Z');
const request = {
  jobId: 'a',
  theme: 'Connect',
  windowDays: 7,
  now: now.toISOString(),
  maxCalls: 1,
  known: [],
};
function response(supported = true, text?: string) {
  const c = demoCandidates(now)[0]!;
  return {
    $metadata: {},
    metrics: { latencyMs: 10 },
    stopReason: 'end_turn' as const,
    usage: { inputTokens: 2000, outputTokens: 1000, totalTokens: 3000 },
    output: {
      message: {
        role: 'assistant' as const,
        content: [
          { text: text ?? JSON.stringify({ candidates: [c] }) },
          ...(supported
            ? [
                {
                  citationsContent: {
                    content: [],
                    citations: [{ location: { web: { url: c.officialUrl! } } }],
                  },
                },
              ]
            : []),
        ],
      },
    },
  };
}
beforeEach(async () => {
  vi.clearAllMocks();
  dir = await mkdtemp(join(tmpdir(), 'nova-test-'));
  store = new LocalStore(dir);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
it('uses native Nova grounding and persists results across provider restarts without another paid call', async () => {
  mocks.send.mockResolvedValue(response());
  const id = await new BedrockResearch(store).start(request);
  const result = await new BedrockResearch(new LocalStore(dir)).poll(id);
  expect(result).toMatchObject({ status: 'completed', calls: 1, inputTokens: 2000 });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  expect(mocks.send.mock.calls[0][0].input).toMatchObject({
    modelId: 'us.amazon.nova-2-lite-v1:0',
    inferenceConfig: { maxTokens: 5000 },
    toolConfig: { tools: [{ systemTool: { name: 'nova_grounding' } }] },
  });
});
it('downgrades URLs found only in generated text', () => {
  const result = parseNovaResponse(response(false));
  expect(result.candidates[0]?.confidence).toBe('partial');
  expect(result.candidates[0]?.verifiedAt).toBeNull();
});
it('preserves supported citations and reported usage', () => {
  const result = parseNovaResponse(response());
  expect(result.candidates[0]?.confidence).toBe('supported');
  expect(result).toMatchObject({ inputTokens: 2000, outputTokens: 1000, calls: 1 });
});
it('retains usage when output is malformed or truncated', () => {
  expect(parseNovaResponse(response(true, '{bad'))).toMatchObject({
    status: 'failed',
    inputTokens: 2000,
    calls: 1,
  });
  expect(parseNovaResponse({ ...response(), stopReason: 'max_tokens' })).toMatchObject({
    status: 'failed',
    candidates: [],
    outputTokens: 1000,
  });
});
it('does not return an id when durable storage fails', async () => {
  mocks.send.mockResolvedValue(response());
  vi.spyOn(store, 'put').mockRejectedValue(new Error('storage unavailable'));
  await expect(new BedrockResearch(store).start(request)).rejects.toThrow('storage unavailable');
  expect(mocks.send).toHaveBeenCalledTimes(1);
});
it('extracts generated text from citation content blocks', () => {
  const r = response();
  const text = r.output.message.content[0].text!;
  expect(
    parseNovaResponse({
      ...r,
      output: {
        message: {
          role: 'assistant',
          content: [{ citationsContent: { content: [{ text }], citations: [] } }],
        },
      },
    }).status,
  ).toBe('completed');
});
