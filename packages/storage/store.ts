import type { Opportunity } from '../domain/index';
export interface Store {
  get<T>(table: 'opportunities' | 'runs' | 'history', id: string): Promise<T | null>;
  put(
    table: 'opportunities' | 'runs' | 'history',
    id: string,
    value: unknown,
    expectedVersion?: number,
  ): Promise<void>;
  list<T>(table: 'opportunities' | 'runs' | 'history', group?: string): Promise<T[]>;
  transaction(
    changes: {
      table: 'opportunities' | 'runs' | 'history';
      id: string;
      value: unknown;
      expectedVersion: number;
    }[],
  ): Promise<void>;
  snapshot(key: string, value: unknown): Promise<void>;
}
export type Table = 'opportunities' | 'runs' | 'history';
export type Identity = { id: string; opportunityId: string; version: number };
export async function opportunities(store: Store) {
  return store.list<Opportunity>('opportunities');
}
