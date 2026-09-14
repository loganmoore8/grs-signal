import config from '../../config/research.json';
import { localDay, Conflict } from '../../packages/domain/index';
import type { Store } from '../../packages/storage/store';
export type Budget = {
  id: string;
  version: number;
  spent: number;
  reserved: number;
  calls: number;
  reservedCalls: number;
};
export type Reservation = {
  id: string;
  version: number;
  day: string;
  month: string;
  usd: number;
  calls: number;
  settled: boolean;
};
export async function reserve(
  store: Store,
  id: string,
  usd: number,
  calls: number,
  now = new Date(),
) {
  const day = localDay(now),
    month = day.slice(0, 7);
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await store.get<Reservation>('runs', `reservation:${id}`)) return false;
    const d = await getBudget(store, `budget:day:${day}`),
      m = await getBudget(store, `budget:month:${month}`);
    if (
      d.spent + d.reserved + usd > config.dailyUsd ||
      m.spent + m.reserved + usd > config.monthlyUsd ||
      d.calls + d.reservedCalls + calls > config.dailyCalls
    )
      return false;
    try {
      await store.transaction([
        ...[d, m].map((b) => ({
          table: 'runs' as const,
          id: b.id,
          expectedVersion: b.version,
          value: {
            ...b,
            version: b.version + 1,
            reserved: b.reserved + usd,
            reservedCalls: b.reservedCalls + calls,
          },
        })),
        {
          table: 'runs',
          id: `reservation:${id}`,
          expectedVersion: 0,
          value: {
            id: `reservation:${id}`,
            version: 1,
            day,
            month,
            usd,
            calls,
            settled: false,
            priceVersion: config.prices.version,
          },
        },
      ]);
      return true;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  return false;
}
async function getBudget(store: Store, id: string): Promise<Budget> {
  return (
    (await store.get<Budget>('runs', id)) || {
      id,
      version: 0,
      spent: 0,
      reserved: 0,
      calls: 0,
      reservedCalls: 0,
    }
  );
}
export async function settle(store: Store, id: string, usd: number, calls: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await store.get<Reservation>('runs', `reservation:${id}`);
    if (!r || r.settled) return;
    const d = await getBudget(store, `budget:day:${r.day}`),
      m = await getBudget(store, `budget:month:${r.month}`);
    try {
      await store.transaction([
        ...[d, m].map((b) => ({
          table: 'runs' as const,
          id: b.id,
          expectedVersion: b.version,
          value: {
            ...b,
            version: b.version + 1,
            reserved: Math.max(0, b.reserved - r.usd),
            reservedCalls: Math.max(0, b.reservedCalls - r.calls),
            spent: b.spent + usd,
            calls: b.calls + calls,
          },
        })),
        {
          table: 'runs',
          id: r.id,
          expectedVersion: r.version,
          value: {
            ...r,
            version: r.version + 1,
            settled: true,
            estimatedActualUsd: usd,
            actualCalls: calls,
          },
        },
      ]);
      return;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
    }
  }
  throw new Error('Unable to settle budget after concurrent updates');
}
export function usageCost(input: number, output: number, calls: number) {
  return (
    (input / 1e6) * config.prices.inputPerMillion +
    (output / 1e6) * config.prices.outputPerMillion +
    calls * config.prices.searchCall
  );
}
