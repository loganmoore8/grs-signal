import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { createHash } from 'node:crypto';
const artifacts: Record<string, { sha256: string; bytes: number }> = {};
await mkdir('dist', { recursive: true });
for (const name of ['api', 'research']) {
  await build({
    entryPoints: [`services/${name}/handler.ts`],
    outfile: `dist/${name}/index.cjs`,
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
  });
  const code = await readFile(`dist/${name}/index.cjs`);
  const zip = zipSync({ 'index.cjs': [code, { mtime: new Date('2020-01-01T00:00:00Z') }] });
  await writeFile(`dist/${name}.zip`, zip);
  artifacts[`${name}.zip`] = {
    sha256: createHash('sha256').update(zip).digest('hex'),
    bytes: zip.length,
  };
}
await writeFile('dist/manifest.json', JSON.stringify(artifacts, null, 2));
console.log('Packaged Lambda artifacts. No deployment performed.');
