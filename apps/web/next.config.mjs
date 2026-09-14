import { fileURLToPath } from 'node:url';
const config = {
  turbopack: { root: fileURLToPath(new URL('../../', import.meta.url)) },
  output: 'export',
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
};
export default config;
