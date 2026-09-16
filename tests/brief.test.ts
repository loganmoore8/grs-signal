import { expect, it } from 'vitest';
import { assess } from '../packages/domain/index';
import { demoCandidates } from './fixtures/opportunities';
import { researchQueries, SYSTEM_PROMPT } from '../services/research/provider';
import { currentDiscoveryCandidate } from '../services/research/freshness';
const now = new Date('2026-09-16T12:00:00Z');
const base = demoCandidates(now)[0]!;
it('implements the actual brief across all themes without university targeting', () => {
  for (const theme of [
    'Connect',
    '311 citizen and constituent services',
    'Conversational AI chatbots',
  ]) {
    const q = researchQueries({
      jobId: 'brief',
      theme,
      now: now.toISOString(),
      maxCalls: 20,
      windowDays: 14,
      known: [],
    });
    expect(q.length).toBeGreaterThanOrEqual(20);
    expect(q.join(' ')).not.toMatch(/university|site:edu/);
    expect(q.join(' ')).toContain('RFI OR RFQ OR ITN');
    expect(q.join(' ')).toContain('sources sought');
  }
  expect(SYSTEM_PROMPT).toContain('25,000-750,000');
  expect(SYSTEM_PROMPT).toContain('preferences, not hard eligibility');
});
it('scores a realistically primeable local implementation above a large cooperative transformation', () => {
  const small = assess(base, now);
  const large = assess(
    {
      ...base,
      buyerType: 'higher_education',
      buyerProfile: {
        ...base.buyerProfile!,
        scale: 'large',
        procurementScale: 'cooperative',
        primePlausibility: 'unlikely',
        estimatedValueUsd: 9000000,
      },
    },
    now,
  );
  expect(small.score).toBe(100);
  expect(large.score).toBeLessThan(70);
  expect(large.disposition).not.toBe('suppressed');
});
it('treats missing size/value and shorter lead time as preferences, not exclusions', () => {
  const c = { ...base, publicationDate: null, dueDate: '2026-09-22', buyerProfile: undefined };
  expect(assess(c, now).disposition).not.toBe('suppressed');
  expect(assess(c, now).readiness).toBe('actionable');
});
it('retains Denver Water table deadline and Jackson prose deadline evidence', () => {
  const denver = {
    ...base,
    dueDate: '2026-09-30',
    evidence: [
      {
        ...base.evidence[0]!,
        claim: 'Response deadline',
        excerpt: '10575 Customer Experience AI Chatbot 08/31/2026 09/30/2026 Procurement',
      },
    ],
  };
  const jackson = {
    ...base,
    dueDate: '2026-09-22',
    evidence: [
      {
        ...base.evidence[0]!,
        claim: 'Proposal deadline',
        excerpt: 'no later than 3:30 PM Central Time on September 22, 2026.',
      },
    ],
  };
  expect(currentDiscoveryCandidate(denver, now.toISOString())).toBe(true);
  expect(currentDiscoveryCandidate(jackson, now.toISOString())).toBe(true);
});
it('retains a sourced aggregator lead for verification without treating it as official', () => {
  const c = {
    ...base,
    dueDate: '2026-09-24',
    confidence: 'partial' as const,
    verifiedAt: null,
    officialUrl: null,
    evidence: [
      {
        ...base.evidence[0]!,
        official: false,
        claim: 'Response deadline',
        excerpt: 'Response Deadline Sept. 24, 2026',
      },
    ],
  };
  expect(currentDiscoveryCandidate(c, now.toISOString())).toBe(true);
  expect(assess(c, now).disposition).toBe('needs_verification');
});
it('preserves a material 311 subcontracting workstream in a broader ERP procurement', () => {
  const c = {
    ...base,
    role: 'subcontractor' as const,
    buyerProfile: {
      ...base.buyerProfile!,
      primePlausibility: 'unlikely' as const,
      estimatedValueUsd: null,
      procurementScale: 'large_transformation' as const,
    },
    facts: {
      ...base.facts,
      centrality: 'workstream' as const,
      alignment: 'neutral' as const,
      excludedReason: 'Broader ERP replacement',
      materialTechnologyPackage: true,
    },
  };
  expect(assess(c, now).disposition).not.toBe('suppressed');
  expect(assess(c, now).score).toBeLessThan(assess(base, now).score);
});

it('computes Jackson deadline as future rather than trusting model arithmetic', async () => {
  const { sourceDateContext } = await import('../services/research/freshness');
  expect(
    sourceDateContext(
      {
        url: 'https://city.gov',
        title: 'ERP',
        text: 'September 22, 2026',
        fetched: true,
        checkedAt: now.toISOString(),
      },
      now.toISOString(),
    ),
  ).toEqual([{ date: '2026-09-22', daysFromToday: 6 }]);
});
