import { LocalStore } from '../packages/storage/local';
import { demoCandidates } from '../tests/fixtures/opportunities';
import { ingest, startRun, tick } from '../services/research/engine';
import { FakeProvider } from '../tests/local/fake-provider';
const store = new LocalStore();
if ((await store.list('opportunities')).length === 0) {
  for (const c of demoCandidates()) await ingest(store, c, 'demo-seed');
  await startRun(store, 'local');
  await tick(store, new FakeProvider());
  await tick(store, new FakeProvider());
  console.log('Seeded fictional local demo. No paid API calls.');
} else console.log('Existing local data retained.');
