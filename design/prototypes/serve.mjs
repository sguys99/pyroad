// dist/*.html 로컬 미리보기. Artifact가 게시할 때 감싸는 스켈레톤과 비슷하게
// <!doctype html> + charset + viewport(viewport-fit=cover) + 작은 reset으로 감싸서 보여 준다.
//   node serve.mjs [포트]      → http://localhost:4317/
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');

export const SKELETON_HEAD =
  '<!doctype html>\n<html lang="ko">\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
  '<style>html,body{margin:0;padding:0}</style>\n';

export function startServer(port = 4317) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const name = url.pathname.replace(/^\/+/, '');
    if (!name) {
      const files = existsSync(DIST) ? readdirSync(DIST).filter((f) => f.endsWith('.html')) : [];
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        `${SKELETON_HEAD}<title>pyRoad 시안 미리보기</title><body style="font:16px/1.6 system-ui;padding:24px">` +
          `<h1 style="font-size:20px">dist/</h1><ul>${files.map((f) => `<li><a href="/${f}">${f}</a></li>`).join('')}</ul></body>`,
      );
      return;
    }
    const file = join(DIST, name);
    if (!name.endsWith('.html') || name.includes('..') || !existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(SKELETON_HEAD + readFileSync(file, 'utf8'));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 4317);
  await startServer(port);
  console.log(`preview → http://localhost:${port}/`);
}
