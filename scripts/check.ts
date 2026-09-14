import { spawnSync } from 'node:child_process';
const commands = [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/vitest/vitest.mjs', 'run'],
];
for (const command of commands) {
  const r = spawnSync(process.execPath, command, { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
