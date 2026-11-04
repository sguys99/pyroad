// P0-16 정적 서버 (포트 3107: P0-07과 번갈아 사용, 동시에 띄우지 않음)
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT ?? 3107);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.map': 'application/json', '.json': 'application/json' };
const MOUNTS = [['/dist/', join(root, 'dist')], ['/', join(root, 'demo')]];
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const [prefix, dir] = MOUNTS.find(([pre]) => p.startsWith(pre));
  const file = join(dir, normalize(p.slice(prefix.length)).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(dir)) return res.writeHead(403).end();
  try {
    const st = statSync(file);
    if (!st.isFile()) throw 0;
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('not found');
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`P0-16 demo: http://127.0.0.1:${PORT}/`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
