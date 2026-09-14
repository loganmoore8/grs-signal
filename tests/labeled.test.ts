import { expect, it } from 'vitest';
import { createOpportunity, shortlistEligible } from '../packages/domain/index';
import { labeledScenarios } from './fixtures/labeled-scenarios';
const now = new Date('2026-09-14T12:00:00Z');
it.each(labeledScenarios(now))(
  '$label follows its labeled qualification outcome',
  ({ candidate, expected }) => {
    const o = createOpportunity(candidate, 'scenario', 'fixture', now);
    expect(shortlistEligible(o, now)).toBe(expected === 'shortlist');
    expect(o.disposition === 'suppressed').toBe(expected === 'suppressed');
  },
);
