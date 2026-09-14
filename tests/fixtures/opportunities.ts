import { candidateSchema, type Candidate } from '../../packages/domain/index';
export function demoCandidates(now = new Date()): Candidate[] {
  const date = (days: number) =>
    new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  const base: Candidate = {
    agency: 'City of Cedar Bay (fictional)',
    state: 'WA',
    buyerType: 'local',
    title: 'Citizen contact center modernization',
    solicitationNumber: 'DEMO-2026-041',
    procurementType: 'RFP',
    publicationDate: date(-2),
    dueDate: date(24),
    dueAt: null,
    dueTimezone: 'America/Los_Angeles',
    officialUrl: 'https://example.com/demo/cedar-bay',
    sourceUrls: ['https://example.com/demo/cedar-bay'],
    procurementState: 'open',
    ongoing: false,
    legacyPlatform: 'Avaya',
    targetPlatform: 'Amazon Connect',
    scope:
      'Migrate an on-premises contact center to Amazon Connect, redesign IVR and integrate citizen-service CRM workflows.',
    whyFits:
      'A defined Connect migration with IVR and CRM integration gives GRS a clear implementation role.',
    role: 'prime',
    blockers: [],
    confirmedBlocker: false,
    nextAction:
      'Confirm public-sector reference requirements and schedule a technical qualification review.',
    actionDates: [{ label: 'Questions close', date: date(8) }],
    confidence: 'supported',
    facts: {
      centrality: 'primary',
      services: ['migration', 'ivr', 'integration'],
      alignment: 'connect',
      substance: 'substantial',
      roleClarity: 'clear',
      excludedReason: null,
      materialTechnologyPackage: true,
      inScopeBuyer: true,
    },
    evidence: [
      {
        claim: 'Migration scope and response deadline',
        excerpt:
          'FICTIONAL DEMO: The city seeks Amazon Connect migration, IVR redesign and CRM integration. Responses due on the date displayed.',
        url: 'https://example.com/demo/cedar-bay',
        official: true,
        locator: 'Demo scope, section 2',
        checkedAt: now.toISOString(),
      },
    ],
    unresolvedFields: [],
    verifiedAt: now.toISOString(),
  };
  const make = (patch: Partial<Candidate>) => {
    const c = { ...structuredClone(base), ...patch };
    c.sourceUrls = c.officialUrl ? [c.officialUrl] : [];
    c.evidence = c.officialUrl
      ? [
          {
            ...base.evidence[0]!,
            url: c.officialUrl,
            excerpt: `FICTIONAL DEMO: ${c.scope} Response deadline: ${c.dueDate}.`,
          },
        ]
      : [];
    return candidateSchema.parse(c);
  };
  return [
    make({}),
    make({
      agency: 'North Valley Public Utility (fictional)',
      state: 'OR',
      buyerType: 'utility',
      title: 'Customer service AI and self-service expansion',
      solicitationNumber: 'DEMO-NV-118',
      officialUrl: 'https://example.com/demo/north-valley',
      legacyPlatform: 'Amazon Connect',
      targetPlatform: 'AWS',
      facts: { ...base.facts, services: ['ai', 'knowledge', 'analytics'], alignment: 'aws' },
      scope:
        'Add virtual agents, guided knowledge and quality analytics to an existing cloud contact center.',
      whyFits:
        'An AWS-aligned expansion focused on AI, knowledge and analytics matches GRS delivery capabilities.',
      nextAction: 'Validate the knowledge sources and integration boundaries.',
      dueDate: date(18),
    }),
    make({
      agency: 'Lakewood State University (fictional)',
      state: 'CA',
      buyerType: 'higher_education',
      title: 'Student services omnichannel transformation',
      solicitationNumber: 'DEMO-LSU-22',
      officialUrl: 'https://example.com/demo/lakewood',
      legacyPlatform: 'Cisco UCCX',
      targetPlatform: 'Platform-neutral cloud',
      facts: {
        ...base.facts,
        alignment: 'neutral',
        services: ['migration', 'omnichannel', 'integration'],
      },
      scope:
        'Replace campus contact-center software with cloud voice, chat, and student CRM integrations.',
      whyFits: 'Platform-neutral cloud migration leaves room for an Amazon Connect solution.',
      nextAction: 'Confirm student-system integration requirements.',
      dueDate: date(32),
    }),
    make({
      agency: 'Metro Transit Authority (fictional)',
      state: 'CO',
      buyerType: 'authority',
      title: 'Passenger information virtual assistant',
      solicitationNumber: 'DEMO-MTA-19',
      officialUrl: 'https://example.com/demo/transit',
      legacyPlatform: null,
      targetPlatform: null,
      confidence: 'partial',
      unresolvedFields: ['Platform eligibility', 'Full scope document'],
      verifiedAt: null,
      blockers: ['Full solicitation is not publicly accessible.'],
      facts: {
        ...base.facts,
        alignment: 'unknown',
        services: ['ai', 'knowledge'],
        roleClarity: 'plausible',
      },
      scope:
        'Notice describes virtual agents for passenger inquiries. Full technology scope is unavailable.',
      whyFits:
        'Potential customer-service AI work; platform and delivery scope need official confirmation.',
      nextAction: 'Automatically recheck accessible official sources for the scope document.',
    }),
    make({
      agency: 'Harbor County (fictional)',
      state: 'FL',
      title: 'Overflow call-center agent staffing',
      solicitationNumber: 'DEMO-HC-8',
      officialUrl: 'https://example.com/demo/staffing',
      legacyPlatform: null,
      targetPlatform: null,
      role: 'unknown',
      facts: {
        ...base.facts,
        services: [],
        alignment: 'unknown',
        centrality: 'none',
        substance: 'none',
        roleClarity: 'unknown',
        excludedReason: 'Staffing / BPO only',
        materialTechnologyPackage: false,
      },
      scope: 'Provide temporary agents and operate overflow telephone support.',
      whyFits: 'No material technology modernization work identified.',
      nextAction: 'No pursuit recommended.',
    }),
    make({
      agency: 'Prairie Public Services (fictional)',
      state: 'KS',
      title: '311 CRM and telephony integration',
      solicitationNumber: 'DEMO-PPS-31',
      officialUrl: 'https://example.com/demo/311',
      facts: { ...base.facts, services: ['311', 'integration'], alignment: 'neutral' },
      whyFits: 'A focused citizen-service integration package creates a plausible specialist role.',
      role: 'subcontractor',
      blockers: ['Prime contractor must hold the required purchasing vehicle.'],
      scope: 'Integrate 311 case management with cloud contact-center routing.',
      dueDate: date(13),
    }),
    make({
      agency: 'East Ridge Authority (fictional)',
      state: 'VA',
      title: 'Legacy IVR replacement',
      solicitationNumber: 'DEMO-ERA-4',
      officialUrl: 'https://example.com/demo/expired',
      dueDate: date(-4),
      procurementState: 'closed',
    }),
  ];
}
