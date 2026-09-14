import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
await import('./seed');
const children = [
  spawn(process.execPath, ['--import', 'tsx', resolve('scripts/local-server.ts')], {
    stdio: 'inherit',
  }),
  spawn(
    process.execPath,
    [resolve('node_modules/next/dist/bin/next'), 'dev', 'apps/web', '--hostname', '127.0.0.1'],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8787',
        NEXT_PUBLIC_LOCAL_DEMO: 'true',
      },
    },
  ),
];
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit();
  });
for (const child of children)
  child.on('exit', (code) => {
    if (code) {
      for (const other of children) other.kill();
      process.exit(code);
    }
  });
