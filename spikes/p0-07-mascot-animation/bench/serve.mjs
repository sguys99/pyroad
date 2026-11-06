// P0-07 정적 서버 (포트 3107 고정). 데모·벤치 페이지, 번들(dist), 에셋, 저장소 public/characters(읽기 전용) 제공
import { createServer } from 'node:http';
import { createReadStream, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = fileURLToPath(new URL('../../..', import.meta.url));
const PORT = Number(process.env.PORT ?? 3107);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json',
  '.lottie': 'application/zip',
  '.riv': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
// [URL prefix, 디스크 경로]
const MOUNTS = [
  ['/dist/', join(root, 'dist')],
  ['/assets/', join(root, 'assets')],
  ['/results/', join(root, 'results')],
  ['/repo-characters/pybaem/lottie/', join(repo, 'scripts/assets/__tests__/fixtures/b32')],
  ['/', join(root, 'demo')],
];

const gzCache = new Map();
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const [prefix, dir] = MOUNTS.find(([pre]) => p.startsWith(pre));
  const rel = normalize(p.slice(prefix.length)).replace(/^(\.\.[/\\])+/, '');
  const file = join(dir, rel);
  if (!file.startsWith(dir)) return res.writeHead(403).end();
  let st;
  try {
    st = statSync(file);
    if (!st.isFile()) throw new Error('not file');
  } catch {
    return res.writeHead(404).end('not found');
  }
  const type = TYPES[extname(file)] ?? 'application/octet-stream';
  // 실제 배포(CDN)처럼 텍스트·wasm은 gzip으로 보냄 (네트워크 스로틀 측정이 압축 크기 기준이 되도록)
  if (/gzip/.test(req.headers['accept-encoding'] ?? '') && /\.(js|mjs|css|json|wasm|svg|html|riv|map)$/.test(file)) {
    const key = `${file}:${st.mtimeMs}`;
    let gz = gzCache.get(key);
    if (!gz) gzCache.set(key, (gz = gzipSync(readFileSync(file), { level: 9 })));
    res.writeHead(200, { 'Content-Type': type, 'Content-Encoding': 'gzip', 'Content-Length': gz.length, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' });
    return res.end(gz);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
  createReadStream(file).pipe(res);
});
server.listen(PORT, '127.0.0.1', () => console.log(`P0-07 demo: http://127.0.0.1:${PORT}/`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
