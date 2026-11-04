// P0-06 데모용 정적 서버. 포트 3106 고정.
//   /                    → index.html (spike 폴더)
//   /pyodide/local/...   → spike의 node_modules/pyodide (314.0.7)
//   /pyodide/root/...    → 저장소 루트 node_modules/pyodide (0.29.3, 버전 비교용)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3106;
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOTS = {
  '/pyodide/local/': path.join(HERE, 'node_modules/pyodide'),
  '/pyodide/root/': path.join(HERE, '../../node_modules/pyodide'),
  '/': HERE,
};
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.py': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm', '.zip': 'application/zip', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.map': 'application/json', '.whl': 'application/zip',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const prefix = Object.keys(ROOTS).find((p) => pathname.startsWith(p));
  if (!prefix) { res.writeHead(404); res.end(); return; }
  const base = ROOTS[prefix];
  const file = path.normalize(path.join(base, pathname.slice(prefix.length)));
  if (!file.startsWith(base) || file.includes(`${path.sep}node_modules${path.sep}`) && prefix === '/') {
    res.writeHead(403); res.end(); return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': prefix === '/' ? 'no-store' : 'public, max-age=3600',
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => console.log(`P0-06 demo: http://localhost:${PORT}/`));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
