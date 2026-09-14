import { SignatureV4 } from '@smithy/signature-v4';
import { Hash } from '@smithy/hash-node';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { z } from 'zod';
export type SearchHit = { url: string; title: string; text: string; publishedDate?: string };
export interface Search {
  search(query: string): Promise<SearchHit[]>;
}
const hitsSchema = z.object({
  results: z.array(
    z.object({
      url: z.string().url(),
      title: z
        .string()
        .nullish()
        .transform((v) => v || ''),
      text: z.string(),
      publishedDate: z
        .string()
        .nullish()
        .transform((v) => v || undefined),
    }),
  ),
});
export class AgentCoreSearch implements Search {
  private tool?: string;
  private signer: SignatureV4;
  constructor(
    private endpoint = process.env.SEARCH_GATEWAY_URL!,
    region = process.env.SEARCH_REGION || 'us-east-1',
  ) {
    if (!endpoint) throw new Error('Search gateway is not configured');
    this.signer = new SignatureV4({
      credentials: defaultProvider(),
      region,
      service: 'bedrock-agentcore',
      sha256: Hash.bind(null, 'sha256'),
    });
  }
  private async call(method: string, params: unknown) {
    const url = new URL(this.endpoint);
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
    const signed = await this.signer.sign({
      method: 'POST',
      protocol: url.protocol,
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        host: url.hostname,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body,
    });
    const response = await fetch(url, {
      method: 'POST',
      headers: signed.headers,
      body,
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new Error(
        `Search gateway returned HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`,
      );
    const text = await response.text();
    const message = JSON.parse(
      text.startsWith('event:') || text.startsWith('data:')
        ? text
            .split('\n')
            .find((l) => l.startsWith('data:'))!
            .slice(5)
        : text,
    );
    if (message.error || message.result?.isError)
      throw new Error(
        'Search gateway rejected the tool call: ' +
          JSON.stringify(message.error || message.result).slice(0, 500),
      );
    return message.result;
  }
  async search(query: string): Promise<SearchHit[]> {
    if (!this.tool) {
      const result = await this.call('tools/list', {});
      this.tool = result.tools?.find((t: { name: string }) =>
        /(?:^|___)WebSearch$/.test(t.name),
      )?.name;
      if (!this.tool) throw new Error('WebSearch tool is missing from gateway');
    }
    const result = await this.call('tools/call', {
      name: this.tool,
      arguments: { query: query.slice(0, 200), maxResults: 5 },
    });
    const structured = result.structuredContent;
    const parsed = structured?.results
      ? structured
      : JSON.parse(result.content.find((c: { type: string }) => c.type === 'text').text);
    return hitsSchema.parse(parsed).results;
  }
}
