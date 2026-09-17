import { z } from 'zod';
import { candidateSchema, safeUrl } from './index';

export const importSchema = z
  .object({
    agency: z.string().trim().min(1).max(250),
    state: z.string().regex(/^[A-Z]{2}$/),
    title: z.string().trim().min(1).max(500),
    sourceUrl: safeUrl,
    solicitationNumber: z.string().trim().max(200).default(''),
    dueDate: z.string().date().nullable(),
    report: z.string().trim().min(1).max(5000),
    kind: z.enum(['chatgpt', 'manual']),
  })
  .strict();
export type ImportInput = z.infer<typeof importSchema>;
export function importedCandidate(input: ImportInput) {
  return candidateSchema.parse({
    agency: input.agency,
    state: input.state,
    title: input.title,
    solicitationNumber: input.solicitationNumber || null,
    buyerType: 'other',
    procurementType: 'other',
    publicationDate: null,
    dueDate: input.dueDate,
    dueAt: null,
    dueTimezone: null,
    officialUrl: null,
    sourceUrls: [input.sourceUrl],
    procurementState: 'unknown',
    ongoing: false,
    legacyPlatform: null,
    targetPlatform: null,
    scope: input.report,
    whyFits: 'Imported lead. Fit has not been independently assessed.',
    role: 'unknown',
    blockers: [],
    confirmedBlocker: false,
    nextAction:
      'Read the linked procurement documents and verify the reported deadline, scope and eligibility.',
    actionDates: [],
    confidence: 'partial',
    facts: {
      centrality: 'none',
      services: [],
      alignment: 'unknown',
      substance: 'none',
      roleClarity: 'unknown',
      excludedReason: null,
      materialTechnologyPackage: false,
      inScopeBuyer: true,
    },
    evidence: [],
    unresolvedFields: ['Imported report has not been independently verified'],
    verifiedAt: null,
  });
}
