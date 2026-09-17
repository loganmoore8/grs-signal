import { createServer } from 'node:http';
import { LocalStore } from '../packages/storage/local';
import { api } from '../services/api/handler';
const store = new LocalStore();
const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):3000$/.test(origin)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    const u = new URL(req.url || '/', 'http://127.0.0.1');
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 32000) {
        res.writeHead(413);
        res.end();
        return;
      }
    }
    const result = await api(
      store,
      req.method || 'GET',
      u.pathname,
      Object.fromEntries(u.searchParams),
      raw ? JSON.parse(raw) : null,
      req.headers.authorization === 'Bearer local-demo' ? 'local-demo' : null,
      'local',
    );
    res.writeHead(result.statusCode, result.headers);
    res.end(result.body);
  } catch {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Local request failed' }));
  }
});
server.listen(Number(process.env.LOCAL_API_PORT || 8787), '127.0.0.1', () =>
  console.log('Local API: http://127.0.0.1:8787 (fictional demo, no cloud access)'),
);
