import type {
  ResearchProvider,
  ResearchRequest,
  ResearchResult,
} from '../../services/research/provider';
import { demoCandidates } from '../fixtures/opportunities';
export class FakeProvider implements ResearchProvider {
  async start(r: ResearchRequest) {
    return `fake|${r.now}|${r.jobId.split(':').at(-1)}`;
  }
  async poll(id: string): Promise<ResearchResult> {
    const [, now, index] = id.split('|');
    const candidates = demoCandidates(new Date(now!));
    const group = Number(index);
    return {
      status: 'completed',
      candidates: group === 3 ? [] : candidates.filter((_, i) => i % 3 === group),
      inputTokens: 3000,
      outputTokens: 1200,
      calls: 2,
    };
  }
  async cancel() {}
}
