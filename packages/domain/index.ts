import { z } from 'zod';
import scoring from '../../config/scoring.json';

export const statuses = ['new', 'reviewing', 'pursue', 'pass', 'submitted', 'won', 'lost'] as const;
export type View = 'recommended' | 'pursuing' | 'filtered';
export const safeUrl = z
  .string()
  .url()
  .refine((v) => /^https?:\/\//.test(v), 'HTTP(S) URL required');
const nullableText = z.string().max(4000).nullable();
export const evidenceSchema = z
  .object({
    claim: z.string(),
    excerpt: z.string().max(1200),
    url: safeUrl,
    official: z.boolean(),
    locator: nullableText,
    checkedAt: z.string().datetime(),
  })
  .strict();
export const factsSchema = z
  .object({
    centrality: z.enum(['none', 'incidental', 'workstream', 'primary']),
    services: z.array(
      z.enum([
        'migration',
        'ivr',
        'omnichannel',
        'ai',
        'knowledge',
        'integration',
        '311',
        'analytics',
      ]),
    ),
    alignment: z.enum(['unknown', 'incompatible', 'neutral', 'aws', 'connect']),
    substance: z.enum(['none', 'limited', 'substantial']),
    roleClarity: z.enum(['unknown', 'plausible', 'clear']),
    excludedReason: nullableText,
    materialTechnologyPackage: z.boolean(),
    inScopeBuyer: z.boolean(),
  })
  .strict();
export const candidateSchema = z
  .object({
    agency: z.string().min(1).max(250),
    state: z.string().regex(/^[A-Z]{2}$/),
    buyerType: z.enum(['state', 'local', 'authority', 'utility', 'higher_education', 'other']),
    title: z.string().min(1).max(500),
    solicitationNumber: nullableText,
    procurementType: z.enum(['RFP', 'RFQ', 'RFI', 'ITB', 'IFB', 'other']),
    publicationDate: z.string().date().nullable(),
    dueDate: z.string().date().nullable(),
    dueAt: z.string().datetime({ offset: true }).nullable(),
    dueTimezone: nullableText,
    officialUrl: safeUrl.nullable(),
    sourceUrls: z.array(safeUrl).max(20),
    procurementState: z.enum(['open', 'closed', 'canceled', 'awarded', 'unknown']),
    ongoing: z.boolean(),
    legacyPlatform: nullableText,
    targetPlatform: nullableText,
    scope: z.string().max(5000),
    whyFits: z.string().max(1500),
    role: z.enum(['prime', 'subcontractor', 'partner', 'unknown']),
    blockers: z.array(z.string()).max(20),
    confirmedBlocker: z.boolean(),
    nextAction: z.string().max(1500),
    actionDates: z.array(z.object({ label: z.string(), date: z.string().date() })).max(10),
    confidence: z.enum(['supported', 'partial', 'conflicting']),
    facts: factsSchema,
    evidence: z.array(evidenceSchema).max(30),
    unresolvedFields: z.array(z.string()).max(30),
    verifiedAt: z.string().datetime().nullable(),
  })
  .strict();
export type Candidate = z.infer<typeof candidateSchema>;
export const researchOutputSchema = z
  .object({ candidates: z.array(candidateSchema).max(50) })
  .strict();
export type Opportunity = Candidate & {
  id: string;
  status: (typeof statuses)[number];
  score: number;
  breakdown: Record<string, number>;
  disposition: 'recommended' | 'needs_verification' | 'low_fit' | 'suppressed';
  readiness: 'actionable' | 'needs_verification' | 'blocked';
  firstFoundAt: string;
  updatedAt: string;
  version: number;
  ruleVersion: string;
  notes: string;
  userNextAction: string;
  userNextDate: string | null;
  passReason: string | null;
  restored: boolean;
  history: HistoryEntry[];
  fingerprint: string;
  runId: string;
};
export type HistoryEntry = { at: string; kind: string; message: string; actor: string };
export const patchSchema = z
  .object({
    version: z.number().int().positive(),
    status: z.enum(statuses).optional(),
    notes: z.string().max(5000).optional(),
    userNextAction: z.string().max(1500).optional(),
    userNextDate: z.string().date().nullable().optional(),
    passReason: z.string().max(200).nullable().optional(),
    restore: z.boolean().optional(),
  })
  .strict();
export type UserPatch = z.infer<typeof patchSchema>;
export class Conflict extends Error {
  constructor() {
    super('This opportunity changed. Refresh and try again.');
  }
}

export function assess(c: Candidate) {
  const f = c.facts;
  const breakdown = {
    centrality: { none: 0, incidental: 10, workstream: 20, primary: 30 }[f.centrality],
    services: [0, 10, 20, 25][Math.min(new Set(f.services).size, 3)]!,
    alignment: { unknown: 0, incompatible: 0, neutral: 10, aws: 15, connect: 20 }[f.alignment],
    substance: { none: 0, limited: 5, substantial: 15 }[f.substance],
    role: { unknown: 0, plausible: 5, clear: 10 }[f.roleClarity],
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const excluded = !f.inScopeBuyer || Boolean(f.excludedReason && !f.materialTechnologyPackage);
  const incomplete =
    c.confidence !== 'supported' ||
    !c.officialUrl ||
    !c.evidence.some((e) => e.official) ||
    c.unresolvedFields.length > 0;
  const disposition = excluded
    ? 'suppressed'
    : incomplete
      ? 'needs_verification'
      : score >= scoring.review
        ? 'recommended'
        : 'low_fit';
  const readiness = c.confirmedBlocker
    ? 'blocked'
    : incomplete
      ? 'needs_verification'
      : 'actionable';
  return { score, breakdown, disposition, readiness } as const;
}
export function localDay(now: Date, timezone = 'America/Los_Angeles') {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function expired(o: Candidate, now: Date) {
  if (o.dueAt) return new Date(o.dueAt).getTime() <= now.getTime();
  if (!o.dueDate) return false;
  let day: string;
  try {
    day = localDay(now, o.dueTimezone || 'America/Los_Angeles');
  } catch {
    day = localDay(now);
  }
  return o.dueDate < day;
}
export function shortlistEligible(o: Opportunity, now = new Date()) {
  return (
    ['new', 'reviewing'].includes(o.status) &&
    o.score >= scoring.shortlist &&
    o.disposition !== 'suppressed' &&
    o.confidence === 'supported' &&
    o.readiness === 'actionable' &&
    o.unresolvedFields.length === 0 &&
    o.procurementState === 'open' &&
    !expired(o, now) &&
    Boolean(o.dueDate || o.dueAt || o.ongoing) &&
    Boolean(o.officialUrl && o.evidence.some((e) => e.official)) &&
    Boolean(o.verifiedAt) &&
    new Date(o.verifiedAt!).getTime() <= now.getTime() &&
    now.getTime() - new Date(o.verifiedAt!).getTime() <= scoring.freshHours * 3600000
  );
}
export function viewOf(o: Opportunity): View {
  if (['pursue', 'submitted', 'won', 'lost'].includes(o.status)) return 'pursuing';
  if (o.status === 'pass') return 'filtered';
  if (o.restored) return 'recommended';
  return ['low_fit', 'suppressed'].includes(o.disposition) ? 'filtered' : 'recommended';
}
export function nextRelevantDate(o: Candidate, now = new Date()) {
  const day = localDay(now);
  return (
    [o.dueDate, ...o.actionDates.map((d) => d.date)]
      .filter((d): d is string => !!d && d >= day)
      .sort()[0] || '9999'
  );
}
export function rank(a: Opportunity, b: Opportunity) {
  return (
    b.score - a.score ||
    Number(b.confidence === 'supported') - Number(a.confidence === 'supported') ||
    nextRelevantDate(a).localeCompare(nextRelevantDate(b)) ||
    b.firstFoundAt.localeCompare(a.firstFoundAt)
  );
}
export function normalize(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9]/g, '');
}
export function canonicalUrl(v: string) {
  const u = new URL(v);
  u.hash = '';
  for (const k of [...u.searchParams.keys()])
    if (k.startsWith('utm_') || ['fbclid', 'gclid'].includes(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.href;
}
export function identityKeys(c: Candidate) {
  const keys: string[] = [];
  if (c.solicitationNumber)
    keys.push(`sol:${normalize(c.agency)}:${c.state}:${normalize(c.solicitationNumber)}`);
  if (c.officialUrl) keys.push(`url:${canonicalUrl(c.officialUrl)}`);
  return keys.length
    ? keys
    : [
        `fallback:${normalize(c.agency)}:${c.state}:${normalize(c.title)}:${c.publicationDate || c.dueDate || 'unknown'}`,
      ];
}
export function fingerprint(c: Candidate) {
  return JSON.stringify([
    c.dueDate,
    c.dueAt,
    c.procurementState,
    c.legacyPlatform,
    c.targetPlatform,
    { ...c.facts, services: [...new Set(c.facts.services)].sort() },
    [...c.blockers].sort(),
  ]);
}
export function createOpportunity(
  c: Candidate,
  id: string,
  runId: string,
  now = new Date(),
): Opportunity {
  return {
    ...c,
    ...assess(c),
    id,
    runId,
    status: 'new',
    version: 1,
    ruleVersion: scoring.version,
    firstFoundAt: now.toISOString(),
    updatedAt: now.toISOString(),
    notes: '',
    userNextAction: '',
    userNextDate: null,
    passReason: null,
    restored: false,
    fingerprint: fingerprint(c),
    history: [
      {
        at: now.toISOString(),
        kind: 'discovered',
        message: 'Discovered and assessed automatically',
        actor: 'research',
      },
    ],
  };
}
export function mergeOpportunity(
  old: Opportunity,
  c: Candidate,
  runId: string,
  now = new Date(),
): Opportunity {
  // Null extraction values do not erase previously supported facts.
  const next = { ...c };
  for (const k of [
    'solicitationNumber',
    'publicationDate',
    'dueDate',
    'dueAt',
    'dueTimezone',
    'officialUrl',
    'legacyPlatform',
    'targetPlatform',
  ] as const)
    if (next[k] === null) next[k] = old[k];
  if (!c.verifiedAt) next.verifiedAt = old.verifiedAt;
  if (c.confidence === 'conflicting') {
    for (const k of [
      'dueDate',
      'dueAt',
      'dueTimezone',
      'procurementState',
      'legacyPlatform',
      'targetPlatform',
    ] as const) {
      if (next[k] !== old[k]) {
        next.unresolvedFields = [
          ...new Set([
            ...next.unresolvedFields,
            `Conflicting ${k}: prior ${old[k] ?? 'unknown'}, new ${next[k] ?? 'unknown'}`,
          ]),
        ];
      }
    }
    next.dueDate = old.dueDate;
    next.dueAt = old.dueAt;
    next.dueTimezone = old.dueTimezone;
    next.verifiedAt = null;
  }
  next.sourceUrls = [...new Set([...old.sourceUrls, ...c.sourceUrls])].slice(0, 20);
  next.evidence = [
    ...c.evidence,
    ...old.evidence.filter((e) => !c.evidence.some((n) => n.url === e.url && n.claim === e.claim)),
  ].slice(0, 30);
  const fp = fingerprint(next),
    changed = fp !== old.fingerprint;
  const history = changed
    ? [
        ...old.history,
        {
          at: now.toISOString(),
          kind: 'amendment',
          message: `Official facts updated${old.dueDate !== next.dueDate ? `: due date ${old.dueDate || 'unknown'} → ${next.dueDate}` : ''}`,
          actor: 'research',
        },
      ]
    : old.history;
  return {
    ...old,
    ...next,
    ...assess(next),
    version: old.version + 1,
    updatedAt: now.toISOString(),
    runId,
    fingerprint: fp,
    history: history.slice(-100),
  };
}
export function updateOpportunity(
  o: Opportunity,
  input: unknown,
  actor: string,
  now = new Date(),
): Opportunity {
  const p = patchSchema.parse(input);
  if (p.version !== o.version) throw new Conflict();
  if (p.status === 'pass' && !p.passReason) throw new Error('Choose a pass reason.');
  const { version: _, restore, ...fields } = p;
  const next = { ...o, ...fields, version: o.version + 1, updatedAt: now.toISOString() };
  if (restore) {
    next.status = 'reviewing';
    next.restored = true;
    next.passReason = null;
  }
  if (p.status === 'pass') next.restored = false;
  next.history = [
    ...o.history,
    {
      at: now.toISOString(),
      kind: 'decision',
      message: restore
        ? 'Restored to review'
        : p.status
          ? `Status changed to ${p.status}${p.passReason ? `: ${p.passReason}` : ''}`
          : 'Notes or next action updated',
      actor,
    },
  ].slice(-100);
  return next;
}
