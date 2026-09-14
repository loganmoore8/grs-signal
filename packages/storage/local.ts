import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { Conflict, viewOf, type Opportunity } from '../domain/index';
import type { Store, Table } from './store';
type Database = Record<Table, Record<string, unknown>>;
export class LocalStore implements Store {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private directory = resolve('.local')) {}
  private async read(): Promise<Database> {
    try {
      return JSON.parse(await readFile(resolve(this.directory, 'db.json'), 'utf8'));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      return { opportunities: {}, runs: {}, history: {} };
    }
  }
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.tail.then(fn);
    this.tail = p.catch(() => {});
    return p;
  }
  async get<T>(table: Table, id: string) {
    await this.tail;
    return ((await this.read())[table][id] as T) || null;
  }
  async list<T>(table: Table, group?: string) {
    await this.tail;
    const values = Object.values((await this.read())[table]);
    return (
      group
        ? values.filter((v) =>
            table === 'opportunities'
              ? viewOf(v as Opportunity) === group
              : (v as { id: string }).id.startsWith(group + ':'),
          )
        : values
    ) as T[];
  }
  async put(table: Table, id: string, value: unknown, expectedVersion?: number) {
    await this.transaction([{ table, id, value, expectedVersion: expectedVersion ?? -1 }]);
  }
  async transaction(
    changes: { table: Table; id: string; value: unknown; expectedVersion: number }[],
  ) {
    return this.exclusive(async () => {
      const db = await this.read();
      for (const c of changes) {
        const old = db[c.table][c.id] as { version?: number } | undefined;
        if (c.expectedVersion >= 0 && (old?.version ?? 0) !== c.expectedVersion)
          throw new Conflict();
      }
      for (const c of changes) db[c.table][c.id] = c.value;
      await mkdir(this.directory, { recursive: true });
      const file = resolve(this.directory, 'db.json');
      await writeFile(file + '.tmp', JSON.stringify(db, null, 2));
      await rename(file + '.tmp', file);
    });
  }
  async snapshot(key: string, value: unknown) {
    const file = resolve(
      this.directory,
      'snapshots',
      key.replace(/[^a-zA-Z0-9/_-]/g, '_') + '.json',
    );
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value, null, 2));
  }
}
