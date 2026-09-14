import { spawnSync } from 'node:child_process';
for (const command of [
  ['node_modules/next/dist/bin/next', 'build', 'apps/web'],
  ['--import', 'tsx', 'scripts/package.ts'],
]) {
  const r = spawnSync(process.execPath, command, {
    stdio: 'inherit',
    env: { ...process.env, NEXT_PUBLIC_LOCAL_DEMO: 'false' },
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
