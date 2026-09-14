/** Final-deployment tooling. Never called by dev, tests, build, or Terraform. */
import { execFileSync } from 'node:child_process';
import { SecretsManagerClient, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AmplifyClient, StartJobCommand, GetJobCommand } from '@aws-sdk/client-amplify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
const action = process.argv[2];
if (!['configure', 'release-web', 'enable', 'pause', 'smoke'].includes(action || ''))
  throw new Error(
    'Usage: deployment.ts configure|release-web|enable|pause|smoke. Only after the final terraform apply.',
  );
if (process.env.ALLOW_DEPLOYMENT_SETUP !== 'true')
  throw new Error(
    'Final deployment setup is disabled. Set ALLOW_DEPLOYMENT_SETUP=true only at deployment time.',
  );
const d = JSON.parse(
  execFileSync('terraform', ['-chdir=infra', 'output', '-json', 'deployment'], {
    encoding: 'utf8',
  }),
) as {
  region: string;
  openai_secret_arn: string;
  user_pool_id: string;
  amplify_app_id: string;
  branch: string;
  runs_table: string;
  worker_name: string;
  api_url: string;
  app_url: string;
};
const options = { region: d.region },
  db = DynamoDBDocumentClient.from(new DynamoDBClient(options));
if (action === 'configure') {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error(
      'OPENAI_API_KEY is required in the process environment; do not put it in Terraform variables.',
    );
  await new SecretsManagerClient(options).send(
    new PutSecretValueCommand({ SecretId: d.openai_secret_arn, SecretString: key }),
  );
  for (const email of (process.env.INVITE_EMAILS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    try {
      await new CognitoIdentityProviderClient(options).send(
        new AdminCreateUserCommand({
          UserPoolId: d.user_pool_id,
          Username: email,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          DesiredDeliveryMediums: ['EMAIL'],
        }),
      );
    } catch (e) {
      if ((e as Error).name !== 'UsernameExistsException') throw e;
    }
  }
  console.log('Credential configured and requested invitations processed. Research remains gated.');
}
if (action === 'enable' || action === 'pause') {
  if (action === 'enable' && process.env.LIVE_CHECKS_PASSED !== 'true')
    throw new Error('Complete cloud smoke checks before setting LIVE_CHECKS_PASSED=true.');
  await db.send(
    new PutCommand({
      TableName: d.runs_table,
      Item: {
        id: 'runtime:readiness',
        bucket: 'runtime',
        enabled: action === 'enable',
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  console.log(
    action === 'enable'
      ? 'Scheduled research enabled.'
      : 'Research paused; existing opportunities remain accessible.',
  );
}
if (action === 'release-web') {
  const client = new AmplifyClient(options);
  const start = await client.send(
    new StartJobCommand({ appId: d.amplify_app_id, branchName: d.branch, jobType: 'RELEASE' }),
  );
  const id = start.jobSummary?.jobId;
  if (!id) throw new Error('Amplify did not return a job ID.');
  console.log(`Hosting build started: ${id}`);
  for (let i = 0; i < 90; i++) {
    const r = await client.send(
      new GetJobCommand({ appId: d.amplify_app_id, branchName: d.branch, jobId: id }),
    );
    const status = r.job?.summary?.status;
    if (status === 'SUCCEED') {
      console.log(`Hosted build ready: ${d.app_url}`);
      break;
    }
    if (['FAILED', 'CANCELLED'].includes(status || '')) throw new Error(`Hosting build ${status}`);
    if (i === 89)
      throw new Error('Hosting build still running; inspect Amplify before enabling research.');
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
if (action === 'smoke') {
  const unauthorized = await fetch(`${d.api_url}/opportunities`);
  if (unauthorized.status !== 401)
    throw new Error('Expected unauthenticated API access to be rejected.');
  const ready = await db.send(
    new GetCommand({ TableName: d.runs_table, Key: { id: 'runtime:readiness' } }),
  );
  if (ready.Item?.enabled)
    throw new Error('Pause research before the no-spend readiness smoke check.');
  const r = await new LambdaClient(options).send(
    new InvokeCommand({
      FunctionName: d.worker_name,
      Payload: Buffer.from(JSON.stringify({ action: 'tick' })),
    }),
  );
  const body = JSON.parse(Buffer.from(r.Payload || []).toString());
  if (body.status !== 'not_ready')
    throw new Error('Worker readiness guard did not return not_ready.');
  console.log(
    'Unauthenticated access rejected; worker readiness guard passed. Authenticated UI, SES and live provider validation remain separate release checks.',
  );
}
