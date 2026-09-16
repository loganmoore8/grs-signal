import type { Candidate } from '../../packages/domain/index';
import { expired } from '../../packages/domain/index';
import type { SourceDocument } from './documents';

// Rank explicit deadline evidence, not publication metadata or years in file paths.
function deadlineDates(text: string) {
  const deadlines: number[] = [];
  const pattern =
    /(?:responses? (?:deadline|due(?: date)?)|submission deadline|bid closing|proposal(?:s)? (?:due(?: date)?|deadline)|closing date|due on|proposals? must be (?:received|submitted))[\s\S]{0,70}?(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi;
  for (const m of text.matchAll(pattern)) {
    const value = Date.parse(m[1]!.replace(/(\d)(st|nd|rd|th)/g, '$1'));
    if (Number.isFinite(value)) deadlines.push(value);
  }
  return deadlines;
}

export function deadlineRank(doc: SourceDocument, now: string) {
  const deadlines = deadlineDates(doc.text);
  if (!deadlines.length) return 0;
  const today = Date.parse(now.slice(0, 10));
  return deadlines.some((d) => d >= today) ? 20 : -20;
}

export function currentDiscoveryCandidate(c: Candidate, now: string) {
  return (
    !expired(c, new Date(now)) &&
    !['closed', 'canceled', 'awarded'].includes(c.procurementState) &&
    c.facts.inScopeBuyer &&
    (!c.facts.excludedReason || c.facts.materialTechnologyPackage) &&
    c.evidence.some((e) => {
      // Discovery-only sources can retain a lead for verification; they cannot
      // establish supported confidence or trigger shortlist alerts.
      const target = c.dueDate || c.dueAt?.slice(0, 10);
      // Table rows often separate the deadline header from the date. The exact
      // excerpt was already checked against source text by parseResearchResponse.
      const dates = [
        ...e.excerpt.matchAll(
          /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi,
        ),
      ]
        .map((m) => Date.parse(m[1]!.replace(/(\d)(st|nd|rd|th)/g, '$1')))
        .filter(Number.isFinite);
      const deadlineContext = /due|deadline|closing|submit|submission|bid|response/i.test(
        e.claim + ' ' + e.excerpt + ' ' + e.locator,
      );
      return (
        (deadlineContext && dates.some((d) => new Date(d).toISOString().slice(0, 10) === target)) ||
        (c.ongoing && /ongoing|rolling|open until filled/i.test(e.excerpt)) ||
        (!target &&
          c.procurementState === 'open' &&
          /accepting (?:bids|proposals)|open solicitation/i.test(e.excerpt))
      );
    })
  );
}

export function sourceDateContext(doc: SourceDocument, now: string) {
  const dates = [
    ...doc.text.matchAll(
      /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/gi,
    ),
  ]
    .map((m) => Date.parse(m[1]!.replace(/(\d)(st|nd|rd|th)/g, '$1')))
    .filter(Number.isFinite);
  return [...new Set(dates)].slice(0, 30).map((d) => ({
    date: new Date(d).toISOString().slice(0, 10),
    daysFromToday: Math.round((d - Date.parse(now.slice(0, 10))) / 86400000),
  }));
}
