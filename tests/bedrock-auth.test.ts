import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => async () => ({
    accessKeyId: 'TESTACCESSKEY',
    secretAccessKey: 'test-secret-for-signing-only',
    sessionToken: 'test-session',
  }),
}));
import { BedrockResearch } from '../services/research/provider';
afterEach(() => vi.unstubAllGlobals());
it('signs research requests with IAM on the Bedrock web-search Responses endpoint', async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: 'response-test' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  await new BedrockResearch('us-west-2').start({
    jobId: 'test',
    theme: 'Connect',
    windowDays: 7,
    now: '2026-09-14T00:00:00Z',
    maxCalls: 2,
    known: [],
  });
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(String(url)).toBe('https://bedrock-mantle.us-west-2.api.aws/openai/v1/responses');
  const headers = new Headers(init.headers);
  expect(headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
  expect(headers.get('authorization')).toContain('/us-west-2/bedrock-mantle/aws4_request');
  expect(headers.get('x-amz-security-token')).toBe('test-session');
  expect(JSON.parse(init.body as string)).toMatchObject({
    model: 'openai.gpt-5.6-terra',
    background: true,
    max_tool_calls: 2,
    tools: [{ type: 'web_search', external_web_access: true }],
  });
});
