import { beforeEach, expect, it, vi } from 'vitest';
import { demoCandidates } from './fixtures/opportunities';
const mocks = vi.hoisted(() => ({ create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() }));
vi.mock('openai', () => ({
  default: class {
    responses = mocks;
  },
}));
import { BedrockResearch } from '../services/research/provider';
const now = new Date('2026-09-01T12:00:00Z');
beforeEach(() => vi.clearAllMocks());
it('constructs a bounded background request with required search and a strict schema', async () => {
  mocks.create.mockResolvedValue({ id: 'response-1' });
  expect(
    await new BedrockResearch('us-west-2').start({
      jobId: 'a',
      theme: 'Connect',
      windowDays: 7,
      now: now.toISOString(),
      maxCalls: 6,
      known: [],
    }),
  ).toBe('response-1');
  expect(mocks.create.mock.calls[0]![0]).toMatchObject({
    background: true,
    max_tool_calls: 6,
    max_output_tokens: 8000,
    tool_choice: 'required',
    text: { format: { strict: true } },
  });
});
it('downgrades invented source URLs even if output claims source support', async () => {
  mocks.retrieve.mockResolvedValue({
    status: 'completed',
    output: [],
    output_text: JSON.stringify({ candidates: [demoCandidates(now)[0]] }),
  });
  const result = await new BedrockResearch('us-west-2').poll('r');
  expect(result.candidates[0]?.confidence).toBe('partial');
  expect(result.candidates[0]?.verifiedAt).toBeNull();
});
it('preserves returned source references and usage for supported results', async () => {
  const c = demoCandidates(now)[0]!;
  mocks.retrieve.mockResolvedValue({
    status: 'completed',
    usage: { input_tokens: 2000, output_tokens: 1000 },
    output: [{ type: 'web_search_call', action: { sources: [{ url: c.officialUrl }] } }],
    output_text: JSON.stringify({ candidates: [c] }),
  });
  const result = await new BedrockResearch('us-west-2').poll('r');
  expect(result.candidates[0]?.confidence).toBe('supported');
  expect(result).toMatchObject({ inputTokens: 2000, outputTokens: 1000, calls: 1 });
});
it('rejects malformed output without losing usage accounting', async () => {
  mocks.retrieve.mockResolvedValue({
    status: 'completed',
    usage: { input_tokens: 2000 },
    output: [],
    output_text: '{bad',
  });
  expect(await new BedrockResearch('us-west-2').poll('r')).toMatchObject({
    status: 'failed',
    inputTokens: 2000,
    candidates: [],
  });
});
