import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { gzipSync } from 'node:zlib';
import { Conflict, viewOf, type Opportunity } from '../domain/index';
import type { Store, Table } from './store';
export class AwsStore implements Store {
  private db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });
  private s3 = new S3Client({});
  private names: Record<Table, string>;
  constructor() {
    this.names = {
      opportunities: required('OPPORTUNITIES_TABLE'),
      runs: required('RUNS_TABLE'),
      history: required('HISTORY_TABLE'),
    };
  }
  async get<T>(table: Table, id: string) {
    const r = await this.db.send(
      new GetCommand({ TableName: this.names[table], Key: { id }, ConsistentRead: true }),
    );
    return (r.Item as T) || null;
  }
  async put(table: Table, id: string, value: unknown, expectedVersion?: number) {
    try {
      await this.db.send(
        new PutCommand({
          TableName: this.names[table],
          Item: indexed(table, id, value),
          ...condition(expectedVersion),
        }),
      );
    } catch (e) {
      if ((e as Error).name === 'ConditionalCheckFailedException') throw new Conflict();
      throw e;
    }
  }
  async list<T>(table: Table, group?: string) {
    const result: T[] = [];
    const groups = group
      ? [group]
      : table === 'opportunities'
        ? ['recommended', 'pursuing', 'filtered']
        : table === 'runs'
          ? ['run']
          : ['candidate'];
    for (const bucket of groups) {
      let start: Record<string, unknown> | undefined;
      do {
        const r = await this.db.send(
          new QueryCommand({
            TableName: this.names[table],
            IndexName: 'by-group',
            KeyConditionExpression: 'bucket = :bucket',
            ExpressionAttributeValues: { ':bucket': bucket },
            ExclusiveStartKey: start,
            Limit: 200,
          }),
        );
        result.push(...((r.Items as T[]) || []));
        start = r.LastEvaluatedKey;
        if (result.length > 5000)
          throw new Error(
            'Query capacity exceeded; archive completed records before expanding coverage.',
          );
      } while (start);
    }
    return result;
  }
  async transaction(
    changes: { table: Table; id: string; value: unknown; expectedVersion: number }[],
  ) {
    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: changes.map((c) => ({
            Put: {
              TableName: this.names[c.table],
              Item: indexed(c.table, c.id, c.value),
              ...condition(c.expectedVersion),
            },
          })),
        }),
      );
    } catch (e) {
      if ((e as Error).name === 'TransactionCanceledException') throw new Conflict();
      throw e;
    }
  }
  async snapshot(key: string, value: unknown) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: required('SNAPSHOTS_BUCKET'),
        Key: key + '.json.gz',
        Body: gzipSync(JSON.stringify(value)),
        ContentType: 'application/json',
        ContentEncoding: 'gzip',
      }),
    );
  }
}
function indexed(table: Table, id: string, value: unknown) {
  return {
    ...(value as object),
    id,
    bucket:
      table === 'opportunities'
        ? viewOf(value as Opportunity)
        : id.startsWith('candidate:') && (value as { processed?: boolean }).processed
          ? 'processed_candidate'
          : id.split(':')[0],
  };
}
function condition(version?: number) {
  return version === undefined || version < 0
    ? {}
    : version === 0
      ? { ConditionExpression: 'attribute_not_exists(id)' }
      : {
          ConditionExpression: '#v = :v',
          ExpressionAttributeNames: { '#v': 'version' },
          ExpressionAttributeValues: { ':v': version },
        };
}
export function required(key: string) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing server configuration: ${key}`);
  return value;
}
