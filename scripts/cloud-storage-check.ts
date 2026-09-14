import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { AwsStore } from '../packages/storage/aws';
import { Conflict } from '../packages/domain/index';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
if (process.env.ALLOW_DEPLOYMENT_SETUP !== 'true')
  throw new Error('Deployment checks are disabled.');
const d = JSON.parse(
  execFileSync('terraform', ['-chdir=infra', 'output', '-json', 'deployment'], {
    encoding: 'utf8',
  }),
);
Object.assign(process.env, {
  AWS_REGION: d.region,
  OPPORTUNITIES_TABLE: d.opportunities_table,
  RUNS_TABLE: d.runs_table,
  HISTORY_TABLE: d.history_table,
  SNAPSHOTS_BUCKET: d.snapshots_bucket,
});
const store = new AwsStore(),
  id = `deployment_check:${randomUUID()}`;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: d.region }));
try {
  await store.put('runs', id, { version: 1 }, 0);
  const attempts = await Promise.allSettled(
    [1, 2].map(() =>
      store.transaction([{ table: 'runs', id, expectedVersion: 1, value: { version: 2 } }]),
    ),
  );
  if (
    attempts.filter((r) => r.status === 'fulfilled').length !== 1 ||
    !attempts.some((r) => r.status === 'rejected' && r.reason instanceof Conflict)
  )
    throw new Error('Conditional transaction race failed');
  if ((await store.get<{ version: number }>('runs', id))?.version !== 2)
    throw new Error('Consistent read failed');
  await store.list('opportunities');
  await store.snapshot(id, {
    check: 'conditional transaction and query passed',
    at: new Date().toISOString(),
  });
  console.log(
    'Live DynamoDB reads, GSI queries, conditional transaction race and S3 evidence write passed.',
  );
} finally {
  await db.send(new DeleteCommand({ TableName: d.runs_table, Key: { id } }));
}
