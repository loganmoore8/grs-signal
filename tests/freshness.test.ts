import { expect, it } from 'vitest';
import { deadlineRank, currentDiscoveryCandidate } from '../services/research/freshness';
import { demoCandidates } from './fixtures/opportunities';
const now = '2026-09-14T12:00:00Z';
const doc = (text: string) => ({
  url: 'https://utility.org/solicitations',
  title: 'Contact Center RFP',
  text,
  fetched: true,
  checkedAt: now,
});
it('ranks current deadline evidence ahead of expired bids regardless of index publication date', () => {
  expect(deadlineRank(doc('Due on April 30, 2025, no later than 1 PM'), now)).toBe(-20);
  expect(deadlineRank(doc('Response Deadline: October 2, 2026 by 5 p.m.'), now)).toBe(20);
  expect(
    deadlineRank(doc('Published September 2026. Contract performance through 2027.'), now),
  ).toBe(0);
  expect(deadlineRank(doc('Proposal Due Date 09/15/26 2PM AKST'), now)).toBe(20);
});
it('does not discard evergreen indexes with both archived and active notices', () => {
  expect(deadlineRank(doc('Due on April 30, 2025. Response deadline: October 2, 2026.'), now)).toBe(
    20,
  );
});
it('requires an evidenced deadline or explicit ongoing intake for current discovery', () => {
  const c = demoCandidates(new Date(now))[0]!;
  expect(currentDiscoveryCandidate({ ...c, dueDate: null, dueAt: null, ongoing: false }, now)).toBe(
    false,
  );
  expect(currentDiscoveryCandidate({ ...c, dueDate: '2025-04-30', dueAt: null }, now)).toBe(false);
  expect(currentDiscoveryCandidate({ ...c, evidence: [] }, now)).toBe(false);
  expect(
    currentDiscoveryCandidate(
      {
        ...c,
        dueDate: '2026-10-02',
        dueAt: null,
        evidence: [
          { ...c.evidence[0]!, official: true, excerpt: 'Response deadline October 2, 2026' },
        ],
      },
      now,
    ),
  ).toBe(true);
});

it('rejects a future year invented from an expired source deadline', () => {
  const c = demoCandidates(new Date(now))[0]!;
  expect(
    currentDiscoveryCandidate(
      {
        ...c,
        dueDate: '2026-10-02',
        dueAt: null,
        evidence: [
          { ...c.evidence[0]!, official: true, excerpt: 'Response deadline October 2, 2025' },
        ],
      },
      now,
    ),
  ).toBe(false);
});
