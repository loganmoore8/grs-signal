import { describe, it, expect } from 'vitest';
import { demoCandidates } from './fixtures/opportunities';
import {
  assess,
  createOpportunity,
  mergeOpportunity,
  updateOpportunity,
  shortlistEligible,
  identityKeys,
  viewOf,
  candidateSchema,
  Conflict,
} from '../packages/domain/index';
const now = new Date('2026-09-14T12:00:00Z');
const fixtures = demoCandidates(now);
describe('Qualification and decisions', () => {
  it('ranks clear Connect implementation at 100 and neutral migration at 90', () => {
    expect(assess(fixtures[0]!).score).toBe(100);
    expect(assess(fixtures[2]!).score).toBe(90);
  });
  it('suppresses staffing but retains mixed technology scope', () => {
    expect(assess(fixtures[4]!).disposition).toBe('suppressed');
    const mixed = structuredClone(fixtures[0]!);
    mixed.facts.excludedReason = 'Staffing-led';
    expect(assess(mixed).disposition).toBe('recommended');
  });
  it('does not suppress incomplete evidence for a low provisional score', () => {
    const c = structuredClone(fixtures[3]!);
    c.facts.services = [];
    expect(assess(c).disposition).toBe('needs_verification');
  });
  it('does not inflate scores for repeated service keywords', () => {
    const c = structuredClone(fixtures[0]!);
    c.facts.services = ['ivr', 'ivr', 'ivr'];
    expect(assess(c).breakdown.services).toBe(10);
  });
  it.each(['closed', 'canceled', 'awarded', 'unknown'] as const)(
    'excludes %s procurements',
    (state) => {
      const o = createOpportunity({ ...fixtures[0]!, procurementState: state }, '1', 'run', now);
      expect(shortlistEligible(o, now)).toBe(false);
    },
  );
  it('excludes stale, expired, blocked and unresolved high scores', () => {
    const base = createOpportunity(fixtures[0]!, '1', 'run', now);
    for (const patch of [
      { verifiedAt: '2026-09-01T00:00:00Z' },
      { verifiedAt: '2026-09-15T00:00:00Z' },
      { dueDate: '2026-09-01' },
      { readiness: 'blocked' as const },
      { unresolvedFields: ['Eligibility'] },
    ])
      expect(shortlistEligible({ ...base, ...patch }, now)).toBe(false);
  });
  it('keeps date-only deadline open on its day, closes next day', () => {
    const o = createOpportunity({ ...fixtures[0]!, dueDate: '2026-09-14' }, '1', 'run', now);
    expect(shortlistEligible(o, now)).toBe(true);
    expect(shortlistEligible(o, new Date('2026-09-15T12:00:00Z'))).toBe(false);
  });
  it('preserves user decisions and notes across amendments', () => {
    let o = createOpportunity(fixtures[0]!, '1', 'run', now);
    o = updateOpportunity(
      o,
      { version: 1, status: 'pass', passReason: 'No capacity', notes: 'Keep for later' },
      'user',
      now,
    );
    const amended = mergeOpportunity(o, { ...fixtures[0]!, dueDate: '2026-10-31' }, 'run2', now);
    expect(amended.status).toBe('pass');
    expect(amended.notes).toBe('Keep for later');
    expect(amended.history.at(-1)?.kind).toBe('amendment');
  });
  it('rejects concurrent edits and model-owned PATCH fields', () => {
    const o = createOpportunity(fixtures[0]!, '1', 'run', now);
    expect(() => updateOpportunity(o, { version: 2, status: 'pursue' }, 'user')).toThrow(Conflict);
    expect(() => updateOpportunity(o, { version: 1, score: 100 }, 'user')).toThrow();
    expect(() => candidateSchema.parse({ ...fixtures[0], status: 'won' })).toThrow();
  });
  it('retains a prior deadline and flags conflicting evidence until resolved', () => {
    const o = createOpportunity(fixtures[0]!, '1', 'run', now);
    const amended = mergeOpportunity(
      o,
      { ...fixtures[0]!, dueDate: '2026-12-01', confidence: 'conflicting' },
      'run2',
      now,
    );
    expect(amended.dueDate).toBe(o.dueDate);
    expect(amended.unresolvedFields.join(' ')).toContain('Conflicting dueDate');
    expect(shortlistEligible(amended, now)).toBe(false);
  });
  it('restore keeps a low fit visible without raising score', () => {
    const o = createOpportunity(fixtures[4]!, '1', 'run', now);
    const restored = updateOpportunity(o, { version: 1, restore: true }, 'user', now);
    expect(viewOf(restored)).toBe('recommended');
    expect(restored.score).toBe(o.score);
    expect(shortlistEligible(restored, now)).toBe(false);
  });
  it('preserves bid identity parameters while ignoring tracking', () => {
    const c = {
      ...fixtures[0]!,
      solicitationNumber: null,
      officialUrl: 'https://example.com/bid?id=42&utm_source=email',
    };
    expect(identityKeys(c)[0]).toBe('url:https://example.com/bid?id=42');
  });
});

it('moves expired uncertain listings out of recommendations while preserving pursuit decisions', () => {
  const c = { ...fixtures[0]!, dueDate: '2026-09-01', dueAt: null, confidence: 'partial' as const };
  const o = createOpportunity(c, 'expired', 'run', now);
  expect(o.disposition).toBe('suppressed');
  expect(o.readiness).toBe('blocked');
  expect(viewOf(o)).toBe('filtered');
  expect(viewOf({ ...o, status: 'pursue' })).toBe('pursuing');
});

it('filters expired bids at read time even when saved classification or restore is stale', () => {
  const o = createOpportunity(fixtures[0]!, 'stale', 'run', now);
  const stale = { ...o, dueDate: '2025-04-30', dueAt: null, disposition: 'recommended' as const };
  expect(viewOf(stale, now)).toBe('filtered');
  expect(viewOf({ ...stale, dueAt: '2027-04-30T13:00:00Z' }, now)).toBe('filtered');
  expect(viewOf({ ...stale, restored: true }, now)).toBe('filtered');
  expect(viewOf({ ...stale, status: 'pursue' }, now)).toBe('pursuing');
  expect(viewOf({ ...o, procurementState: 'awarded', restored: true }, now)).toBe('filtered');
});
