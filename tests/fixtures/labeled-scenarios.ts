import type { Candidate } from '../../packages/domain/index';
import { demoCandidates } from './opportunities';

// Synthetic qualification cases, not evidence of live extraction accuracy or discovery recall.
export function labeledScenarios(now: Date) {
  const base = demoCandidates(now)[0]!;
  const cases: {
    label: string;
    candidate: Candidate;
    expected: 'shortlist' | 'suppressed' | 'review';
  }[] = [];
  const add = (
    label: string,
    patch: Partial<Candidate>,
    expected: 'shortlist' | 'suppressed' | 'review',
  ) => cases.push({ label, candidate: { ...structuredClone(base), ...patch }, expected });
  const positives: [string, Candidate['facts']['services'], Candidate['facts']['alignment']][] = [
    ['Connect migration', ['migration'], 'connect'],
    ['AWS IVR redesign', ['ivr', 'integration', 'analytics'], 'aws'],
    ['Platform-neutral CCaaS migration', ['migration', 'ivr', 'integration'], 'neutral'],
    ['Omnichannel modernization', ['omnichannel', 'ivr', 'integration'], 'connect'],
    ['Customer-service virtual agents', ['ai', 'knowledge', 'analytics'], 'aws'],
    ['Knowledge integration', ['knowledge', 'integration', 'ai'], 'connect'],
    ['311 citizen services', ['311', 'ivr', 'integration'], 'neutral'],
    ['CRM contact-center integration', ['integration', 'migration', 'omnichannel'], 'aws'],
    ['Contact-center analytics and automation', ['analytics', 'ai', 'ivr'], 'aws'],
    ['Existing Connect optimization', ['analytics', 'ivr', 'knowledge'], 'connect'],
  ];
  for (const [label, services, alignment] of positives)
    add(label, { facts: { ...base.facts, services, alignment } }, 'shortlist');
  for (const label of [
    'Staffing-only BPO',
    'Temporary agents',
    'Answering service',
    'Operate the contact center',
    'Generic telecom hardware',
    'NG911 infrastructure',
    'Commodity licenses',
    'Incidental enterprise IT',
  ])
    add(
      label,
      { facts: { ...base.facts, excludedReason: label, materialTechnologyPackage: false } },
      'suppressed',
    );
  add(
    'Inaccessible official document',
    { confidence: 'partial', unresolvedFields: ['Document inaccessible'] },
    'review',
  );
  add('Conflicting official dates', { confidence: 'conflicting' }, 'review');
  add('Aggregator-only discovery', { officialUrl: null, evidence: [] }, 'review');
  add('Unverified official state', { verifiedAt: null }, 'review');
  add(
    'Stale evidence',
    { verifiedAt: new Date(now.getTime() - 80 * 3600000).toISOString() },
    'review',
  );
  add('Expired response deadline', { dueDate: '2020-01-01' }, 'suppressed');
  add('Unknown procurement state', { procurementState: 'unknown' }, 'review');
  add('Closed notice', { procurementState: 'closed' }, 'suppressed');
  add('Canceled procurement', { procurementState: 'canceled' }, 'suppressed');
  add('Already awarded', { procurementState: 'awarded' }, 'suppressed');
  add(
    'Confirmed eligibility blocker',
    { confirmedBlocker: true, blockers: ['Required vehicle unavailable'] },
    'review',
  );
  add(
    'BPO with material Connect implementation workstream',
    { facts: { ...base.facts, excludedReason: 'Staffing-led', materialTechnologyPackage: true } },
    'shortlist',
  );
  return cases;
}
