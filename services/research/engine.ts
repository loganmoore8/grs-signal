import { createHash } from 'node:crypto';
import {
  assess,
  candidateSchema,
  createOpportunity,
  mergeOpportunity,
  identityKeys,
  normalize,
  nextRelevantDate,
  localDay,
  Conflict,
  type Candidate,
  type Opportunity,
} from '../../packages/domain/index';
import type { Store, Identity } from '../../packages/storage/store';
import type { ResearchProvider } from './provider';
import { reserve, settle, usageCost, requestReservation } from './budget';
import config from '../../config/research.json';
export type Job = {
  id: string;
  version: number;
  runId: string;
  status: 'queued' | 'submitting' | 'polling' | 'completed' | 'failed' | 'uncertain' | 'deferred';
  theme: string;
  maxCalls: number;
  responseId?: string;
  startedAt?: string;
  error?: string;
  leaseUntil?: string;
  attempt?: number;
  reservationId?: string;
  candidateIds?: string[];
};
export type Run = {
  id: string;
  version: number;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'partial' | 'budget_deferred';
  jobs: string[];
  candidateCount: number;
  qualifiedCount?: number;
  mode: 'local' | 'live';
};
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
export async function ingest(store: Store, raw: unknown, runId: string, now = new Date()) {
  const c = candidateSchema.parse(raw),
    keys = identityKeys(c).map((k) => `identity:${hash(k)}`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const maps = await Promise.all(keys.map((k) => store.get<Identity>('history', k)));
    let existingId = maps.find(Boolean)?.opportunityId;
    if (existingId && !maps[0] && c.solicitationNumber) {
      const mapped = await store.get<Opportunity>('opportunities', existingId);
      if (
        mapped &&
        ((mapped.solicitationNumber &&
          normalize(mapped.solicitationNumber) !== normalize(c.solicitationNumber)) ||
          normalize(mapped.agency) !== normalize(c.agency) ||
          mapped.state !== c.state)
      )
        existingId = undefined;
    }
    const id = existingId || hash(keys[0]!);
    const old = await store.get<Opportunity>('opportunities', id);
    const opportunity = old
      ? mergeOpportunity(old, c, runId, now)
      : createOpportunity(c, id, runId, now);
    try {
      await store.transaction([
        { table: 'opportunities', id, value: opportunity, expectedVersion: old?.version || 0 },
        ...keys
          .filter((_, i) => !maps[i])
          .map((k) => ({
            table: 'history' as const,
            id: k,
            value: { id: k, opportunityId: id, version: 1 },
            expectedVersion: 0,
          })),
      ]);
      return opportunity;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  throw new Error('Could not reconcile opportunity identity');
}
export async function startRun(store: Store, mode: 'local' | 'live', now = new Date()) {
  const id = `run:${localDay(now)}`;
  if (await store.get('runs', id)) return id;
  const all = await store.list<Run>('runs');
  if (all.some((r) => r.id?.startsWith('run:') && r.status === 'running')) return null;
  const themes = [
    ...config.themes,
    'Recheck active pursuits and previous shortlist for deadline, scope, platform and eligibility changes',
  ];
  const jobs = themes.map((theme, i): Job => ({
    id: `job:${localDay(now)}:${i}`,
    version: 1,
    runId: id,
    status: 'queued',
    theme,
    maxCalls: i === 3 ? 8 : 6,
  }));
  const run: Run = {
    id,
    version: 1,
    startedAt: now.toISOString(),
    status: 'running',
    jobs: jobs.map((j) => j.id),
    candidateCount: 0,
    mode,
  };
  try {
    await store.transaction([
      { table: 'runs', id, value: run, expectedVersion: 0 },
      ...jobs.map((j) => ({ table: 'runs' as const, id: j.id, value: j, expectedVersion: 0 })),
    ]);
  } catch (e) {
    if (!(e instanceof Conflict)) throw e;
  }
  return id;
}
export async function tick(store: Store, provider: ResearchProvider, now = new Date()) {
  const runs = (await store.list<Run>('runs')).filter(
    (r) => r.id?.startsWith('run:') && r.status === 'running',
  );
  for (const run of runs) {
    const jobs = await Promise.all(run.jobs.map((id) => store.get<Job>('runs', id)));
    for (const job of jobs) {
      if (!job || ['completed', 'failed', 'uncertain', 'deferred'].includes(job.status)) continue;
      if (job.leaseUntil && new Date(job.leaseUntil) > now) continue;
      const claimed = {
        ...job,
        version: job.version + 1,
        leaseUntil: new Date(now.getTime() + 90000).toISOString(),
      };
      try {
        await store.put('runs', job.id, claimed, job.version);
      } catch (e) {
        if (e instanceof Conflict) continue;
        throw e;
      }
      const save = async (p: Partial<Job>) => {
        const n = { ...claimed, ...p, version: claimed.version + 1, leaseUntil: undefined };
        await store.put('runs', job.id, n, claimed.version);
      };
      if (job.status === 'submitting') {
        await save({
          status: 'uncertain',
          error: 'Provider submission outcome unknown; reserved cost retained.',
        });
        continue;
      }
      if (job.status === 'queued') {
        const reservationId = `${job.id}:attempt:${job.attempt || 0}`;
        const allowed = await reserve(
          store,
          reservationId,
          requestReservation(job.maxCalls),
          job.maxCalls,
          now,
        );
        if (!allowed) {
          await save({ status: 'deferred', error: 'Daily or monthly research allowance reached.' });
          continue;
        }
        const submitting = {
          ...claimed,
          reservationId,
          status: 'submitting' as const,
          startedAt: now.toISOString(),
          version: claimed.version + 1,
        };
        await store.put('runs', job.id, submitting, claimed.version);
        try {
          const existing = await store.list<Opportunity>('opportunities');
          const known = existing
            .filter(
              (o) =>
                ['pursue', 'submitted'].includes(o.status) ||
                (!['pass', 'won', 'lost'].includes(o.status) &&
                  ['open', 'unknown'].includes(o.procurementState) &&
                  (o.status === 'reviewing' || o.score >= 85)),
            )
            .sort(
              (a, b) =>
                Number(['pursue', 'submitted'].includes(b.status)) -
                  Number(['pursue', 'submitted'].includes(a.status)) ||
                nextRelevantDate(a, now).localeCompare(nextRelevantDate(b, now)) ||
                (a.verifiedAt || '').localeCompare(b.verifiedAt || ''),
            )
            .slice(0, 15);
          const regions = [
            'West: WA OR CA AK HI NV ID MT WY CO UT AZ NM',
            'Midwest: ND SD NE KS MN IA MO WI IL IN MI OH',
            'South: TX OK AR LA MS AL TN KY FL GA SC NC VA WV',
            'Northeast and Mid-Atlantic: PA NY NJ DE MD DC CT RI MA VT NH ME',
          ];
          const dayNumber = Math.floor(now.getTime() / 86400000);
          const responseId = await provider.start({
            jobId: job.id,
            theme: job.theme,
            windowDays: !existing.length || now.getDay() === 0 ? 30 : 7,
            now: now.toISOString(),
            maxCalls: job.maxCalls,
            known,
            geography: regions[dayNumber % regions.length],
          });
          await store.put(
            'runs',
            job.id,
            {
              ...submitting,
              version: submitting.version + 1,
              status: 'polling',
              responseId,
              leaseUntil: undefined,
            },
            submitting.version,
          );
        } catch {
          await store.put(
            'runs',
            job.id,
            {
              ...submitting,
              version: submitting.version + 1,
              status: 'uncertain',
              leaseUntil: undefined,
              error: 'Submission failed or timed out; no automatic duplicate request.',
            },
            submitting.version,
          );
        }
      } else if (job.responseId) {
        if (now.getTime() - new Date(job.startedAt!).getTime() > 3600000) {
          await provider.cancel(job.responseId).catch(() => {});
          await save({
            status: 'failed',
            error: 'Research exceeded its time limit; cost reservation retained.',
          });
          continue;
        }
        let result;
        try {
          result = await provider.poll(job.responseId);
        } catch {
          await save({
            status: 'polling',
            error: 'Temporary retrieval failure; next tick will retry existing response.',
          });
          continue;
        }
        if (result.status === 'pending') {
          await save({ status: 'polling' });
          continue;
        }
        await settle(
          store,
          job.reservationId || job.id,
          usageCost(result.inputTokens, result.outputTokens, result.calls),
          result.calls,
        );
        await store.snapshot(`${run.id}/${job.id}/attempt-${job.attempt || 0}`, result);
        if (result.status === 'failed') {
          const retries = (
            await Promise.all(run.jobs.map((id) => store.get<Job>('runs', id)))
          ).reduce((sum, j) => sum + (j?.attempt || 0), 0);
          if (!job.attempt && retries < 2)
            await save({
              status: 'queued',
              attempt: 1,
              maxCalls: 2,
              responseId: undefined,
              error: 'Retrying a known failed response within recovery allowance.',
            });
          else await save({ status: 'failed', error: result.error });
          continue;
        }
        for (const c of result.candidates) {
          const id = `candidate:${hash(identityKeys(c)[0]!)}`;
          const old = await store.get<{ version: number; queuedAt: string }>('history', id);
          await store.put('history', id, {
            id,
            version: (old?.version || 0) + 1,
            candidate: c,
            runId: run.id,
            queuedAt: old?.queuedAt || now.toISOString(),
            processed: false,
          });
        }
        await save({
          status: 'completed',
          candidateIds: result.candidates.map((c) => `candidate:${hash(identityKeys(c)[0]!)}`),
        });
      }
    }
    const current = await Promise.all(run.jobs.map((id) => store.get<Job>('runs', id)));
    if (
      current.every((j) => j && ['completed', 'failed', 'uncertain', 'deferred'].includes(j.status))
    ) {
      type Queued = {
        id: string;
        version: number;
        candidate: Candidate;
        processed: boolean;
        queuedAt: string;
      };
      const knownIds = [...new Set(current.flatMap((j) => j?.candidateIds || []))];
      const knownQueued = (
        await Promise.all(knownIds.map((id) => store.get<Queued>('history', id)))
      ).filter((q): q is Queued => !!q);
      const pending = [
        ...new Map(
          [...(await store.list<Queued>('history')), ...knownQueued].map((q) => [q.id, q]),
        ).values(),
      ]
        .filter((c) => c.id?.startsWith('candidate:') && !c.processed)
        .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
      const initialProgress = await store.get<Run>('runs', run.id);
      if (!initialProgress || initialProgress.status !== 'running') continue;
      let progress: Run = initialProgress;
      for (const item of pending) {
        if (progress.candidateCount >= config.maxCandidates) break;
        const queued = await store.get<Queued>('history', item.id);
        if (!queued || queued.processed) continue;
        const disposition = assess(queued.candidate).disposition;
        if (disposition !== 'suppressed' && (progress.qualifiedCount || 0) >= config.maxQualified)
          continue;
        await ingest(store, queued.candidate, run.id, now);
        const updated: Run = {
          ...progress,
          version: progress.version + 1,
          candidateCount: progress.candidateCount + 1,
          qualifiedCount: (progress.qualifiedCount || 0) + Number(disposition !== 'suppressed'),
        };
        await store.transaction([
          {
            table: 'history',
            id: queued.id,
            value: { ...queued, processed: true, version: queued.version + 1 },
            expectedVersion: queued.version,
          },
          { table: 'runs', id: run.id, value: updated, expectedVersion: progress.version },
        ]);
        progress = updated;
      }
      /* Candidate progress is committed with the queue marker, so a worker restart
         cannot reset the daily processing allowance. */
      const latest = await store.get<Run>('runs', run.id);
      if (!latest || latest.status !== 'running') continue;
      const status = current.every((j) => j?.status === 'completed')
        ? 'completed'
        : current.some((j) => j?.status === 'deferred')
          ? 'budget_deferred'
          : 'partial';
      await store.put(
        'runs',
        run.id,
        {
          ...latest,
          version: latest.version + 1,
          status,
          completedAt: now.toISOString(),
        },
        latest.version,
      );
    }
  }
}
