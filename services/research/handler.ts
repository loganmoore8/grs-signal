import { AwsStore, required } from '../../packages/storage/aws';
import { OpenAIResearch } from './provider';
import { configuredResearch } from './credentials';
import { startRun, tick } from './engine';
import { notify, SesMailer } from './alerts';
let store: AwsStore, provider: OpenAIResearch;
export async function handler(event: { action?: 'start' | 'tick' }) {
  store ??= new AwsStore();
  const readiness = await store.get<{ enabled: boolean }>('runs', 'runtime:readiness');
  if (!readiness?.enabled) return { status: 'not_ready', paidCalls: 0 };
  provider ??= await configuredResearch();
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()),
  );
  // The polling schedule can recover a missed daily-start delivery after 06:00.
  if (event.action === 'start' || hour >= 6) await startRun(store, 'live');
  await tick(store, provider, new Date(), 1);
  await notify(store, new SesMailer(), required('APP_URL'));
  return { status: 'processed' };
}
