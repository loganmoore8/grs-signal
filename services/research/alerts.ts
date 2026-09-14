import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { createHash } from 'node:crypto';
import { shortlistEligible, rank, localDay, type Opportunity } from '../../packages/domain/index';
import type { Store } from '../../packages/storage/store';
import type { Run } from './engine';
import { costReport } from './cost';
export interface Mailer {
  send(subject: string, text: string): Promise<void>;
}
export class SesMailer implements Mailer {
  private client = new SESClient({});
  async send(subject: string, text: string) {
    const sender = process.env.ALERT_SENDER,
      recipients = process.env.ALERT_RECIPIENTS?.split(',').filter(Boolean);
    if (!sender || !recipients?.length) throw new Error('Alert delivery is not configured');
    await this.client.send(
      new SendEmailCommand({
        Source: sender,
        Destination: { ToAddresses: recipients },
        Message: { Subject: { Data: subject }, Body: { Text: { Data: text } } },
      }),
    );
  }
}
export async function notify(store: Store, mailer: Mailer, baseUrl: string, now = new Date()) {
  const runs = (await store.list<Run>('runs'))
    .filter((r) => r.id?.startsWith('run:'))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const latest = runs[0],
    success = runs.find((r) => r.status === 'completed');
  if (!latest) return;
  const costs = await costReport(store, now);
  if (costs.projectedCombinedUsd >= 55)
    await sendOnce(
      store,
      mailer,
      `cost:${costs.month}`,
      'GRS Signal · Cost forecast needs attention',
      `Combined monthly forecast: $${costs.projectedCombinedUsd.toFixed(2)}. ${costs.basis} Check actual billing before increasing research limits. ${baseUrl}`,
    );
  const stale = !success || now.getTime() - new Date(success.completedAt!).getTime() > 36 * 3600000;
  const incident = await store.get<{ version: number; active: boolean }>(
    'runs',
    'incident:research',
  );
  if (stale && latest.status !== 'running') {
    if (!incident?.active) {
      await store.put(
        'runs',
        'incident:research',
        { id: 'incident:research', version: (incident?.version || 0) + 1, active: true },
        incident?.version || 0,
      );
      await sendOnce(
        store,
        mailer,
        `incident:${latest.id}`,
        'GRS Signal · Research needs attention',
        `Research is ${latest.status}. Existing opportunities remain available. Inspect the run and job error records. ${baseUrl}`,
      );
    }
  } else if (!stale && incident?.active)
    await store.put(
      'runs',
      'incident:research',
      { id: 'incident:research', version: incident.version + 1, active: false },
      incident.version,
    );
  if (!latest.completedAt) return;
  const all = await store.list<Opportunity>('opportunities');
  const previous = await store.get<{ fingerprints: Record<string, string> }>(
    'runs',
    'digest:previous',
  );
  const relevant = all
    .filter((o) => shortlistEligible(o, now) || ['pursue', 'submitted'].includes(o.status))
    .sort(rank);
  const changed = relevant.filter((o) => previous?.fingerprints[o.id] !== o.fingerprint);
  const deadlineKey = (o: Opportunity) => {
    if (o.procurementState !== 'open') return null;
    const dates = [o.dueDate, ...o.actionDates.map((d) => d.date)].filter((d): d is string =>
      Boolean(d),
    );
    const days = dates
      .map((d) => Math.round((Date.parse(d) - Date.parse(localDay(now))) / 86400000))
      .filter((d) => [0, 1, 3, 7].includes(d));
    return days.length ? `${o.id}:${Math.min(...days)}:${dates.join(',')}` : null;
  };
  for (const o of relevant) {
    const key = deadlineKey(o);
    if (
      key &&
      o.verifiedAt &&
      now.getTime() - Date.parse(o.verifiedAt) <= 72 * 3600000 &&
      !(await store.get('history', `deadline:${key}`))
    ) {
      if (!changed.some((c) => c.id === o.id)) changed.push(o);
    }
  }
  if (!changed.length) return;
  const top = changed.slice(0, 5),
    text = top
      .map(
        (o) =>
          `${o.score}/100 · ${o.title}\n${o.agency}, ${o.state}\n${o.whyFits}\nProcurement: ${o.procurementState} · Evidence: ${o.confidence}\nNext: ${o.userNextAction || o.nextAction}\nDue: ${o.dueDate || 'Unconfirmed'}\n${baseUrl}/?opportunity=${o.id}`,
      )
      .join('\n\n');
  const digestKey = createHash('sha256')
    .update(top.map((o) => o.id + o.fingerprint + (deadlineKey(o) || '')).join('|'))
    .digest('hex')
    .slice(0, 24);
  await sendOnce(
    store,
    mailer,
    `digest:${latest.id}:${digestKey}`,
    'GRS Signal · Opportunities worth your attention',
    text,
  );
  for (const o of top) {
    const key = deadlineKey(o);
    if (key) await store.put('history', `deadline:${key}`, { id: `deadline:${key}`, version: 1 });
  }
  await store.put('runs', 'digest:previous', {
    id: 'digest:previous',
    fingerprints: {
      ...previous?.fingerprints,
      ...Object.fromEntries(top.map((o) => [o.id, o.fingerprint])),
    },
  });
}
async function sendOnce(store: Store, mailer: Mailer, id: string, subject: string, text: string) {
  if (await store.get('history', id)) return;
  try {
    await store.put('history', id, { id, version: 1, status: 'sending' }, 0);
  } catch {
    return;
  }
  try {
    await mailer.send(subject, text);
    await store.put('history', id, { id, version: 2, status: 'sent' }, 1);
  } catch {
    await store.put(
      'history',
      id,
      {
        id,
        version: 2,
        status: 'uncertain',
        error: 'Delivery outcome uncertain; inspect before retrying.',
      },
      1,
    );
  }
}
