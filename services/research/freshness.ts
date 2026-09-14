import type { Candidate } from '../../packages/domain/index';
import { expired } from '../../packages/domain/index';
import type { SourceDocument } from './documents';

// Rank explicit deadline evidence, not publication metadata or years in file paths.
function deadlineDates(text: string) {
  const deadlines: number[] = [];
  const pattern =
    /(?:responses? (?:deadline|due(?: date)?)|submission deadline|bid closing|proposal(?:s)? (?:due(?: date)?|deadline)|closing date|due on|proposals? must be (?:received|submitted))[\s\S]{0,70}?(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})/gi;
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
    c.evidence.some(
      (e) =>
        e.official &&
        (deadlineDates(e.excerpt).some(
          (d) => new Date(d).toISOString().slice(0, 10) === (c.dueDate || c.dueAt?.slice(0, 10)),
        ) ||
          (c.ongoing && /ongoing|rolling|open until filled/i.test(e.excerpt))),
    ) &&
    Boolean(c.dueDate || c.dueAt || (c.ongoing && c.procurementState === 'open'))
  );
}
