import { localDay } from '../../packages/domain/index';
import type { Store } from '../../packages/storage/store';
import type { Budget } from './budget';
import config from '../../config/research.json';

export async function costReport(store: Store, now = new Date()) {
  const day = localDay(now),
    month = day.slice(0, 7);
  const budget = await store.get<Budget>('runs', `budget:month:${month}`);
  const elapsed = Number(day.slice(8)),
    days = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate();
  const estimatedApiUsd = budget?.spent || 0;
  const reservedApiUsd = budget?.reserved || 0;
  const projectedApiUsd = ((estimatedApiUsd + reservedApiUsd) / elapsed) * days;
  return {
    month,
    estimatedApiUsd,
    reservedApiUsd,
    projectedApiUsd,
    awsAllowanceUsd: 15,
    actualAwsUsd: null,
    projectedCombinedUsd: projectedApiUsd + 15,
    plannedMonthlyCeilingUsd: config.monthlyUsd + 15,
    basis:
      'Provider token/tool usage at configured prices plus a $15 AWS allowance. This is an estimate; AWS billing is not yet reconciled.',
  };
}
