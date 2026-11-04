// P0-05 spike static server (port 3105 only).
//
// URL scheme:  /m/<mode>/<path>
//   mode   = plain  : no isolation headers
//            coep   : COOP same-origin + COEP require-corp
//            cred   : COOP same-origin + COEP credentialless
//            coop   : COOP same-origin only (control)
//            dip    : Document-Isolation-Policy: isolate-and-credentialless (Chrome-only proposal)
//            csp    : strict CSP (script-src 'self' 'wasm-unsafe-eval', no 'unsafe-eval') / cspcoep: csp + COOP/COEP
//   path   = web/...            -> spikes/p0-05-pyodide-input/web/...
//            pyodide/<ver>/...  -> self-hosted Pyodide (314.0.7 | 0.27.5)
//            xo/plain.png       -> image WITHOUT CORP/CORS (like a random 3rd-party image)
//            xo/corp.png        -> image with Cross-Origin-Resource-Policy: cross-origin
//            xo/cors.png        -> image with Access-Control-Allow-Origin: * (no CORP)
//            xo/script.js       -> script with ACAO:* and no CORP (like Kakao SDK)
// Cross-origin tests load xo/* through the other host name (localhost <-> 127.0.0.1).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 3105;
const root = path.dirname(fileURLToPath(import.meta.url));
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data:",
  "style-src 'self'",
].join('; ');
const MODES = {
  plain: {},
  coop: { 'Cross-Origin-Opener-Policy': 'same-origin' },
  coep: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' },
  cred: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' },
  dip: { 'Document-Isolation-Policy': 'isolate-and-credentialless' },
  // B27 대비: Pyodide가 'unsafe-eval' 없이 'wasm-unsafe-eval'만으로 도는지
  csp: { 'Content-Security-Policy': CSP },
  cspcoep: {
    'Content-Security-Policy': CSP,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
};
const PYODIDE = {
  '314.0.7': path.join(root, 'node_modules/pyodide'),
  '0.27.5': path.join(root, 'node_modules/pyodide027'),
};
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.png': 'image/png',
  '.py': 'text/plain; charset=utf-8',
};
// 2x2 red PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==',
  'base64',
);

const quiet = process.env.QUIET === '1';

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const m = url.pathname.match(/^\/m\/([a-z]+)\/(.*)$/);
    if (!m || !MODES[m[1]]) return send(res, 404, {}, 'use /m/<plain|coep|cred|coop|dip|csp|cspcoep>/...');
    const headers = { ...MODES[m[1]] };
    const rest = m[2];

    if (rest.startsWith('xo/')) {
      const h = { ...headers, 'Cache-Control': 'no-store' };
      if (rest === 'xo/corp.png') h['Cross-Origin-Resource-Policy'] = 'cross-origin';
      if (rest === 'xo/cors.png' || rest === 'xo/script.js') h['Access-Control-Allow-Origin'] = '*';
      if (rest === 'xo/script.js') return send(res, 200, { ...h, 'Content-Type': TYPES['.js'] }, 'window.__xoScript = true;');
      if (/^xo\/(plain|corp|cors)\.png$/.test(rest)) return send(res, 200, { ...h, 'Content-Type': 'image/png' }, PNG);
      return send(res, 404, h, 'nope');
    }

    let file;
    if (rest.startsWith('web/')) {
      file = path.join(root, rest);
      headers['Cache-Control'] = 'no-store';
    } else if (rest.startsWith('pyodide/')) {
      const [, ver, ...p] = rest.split('/');
      if (!PYODIDE[ver]) return send(res, 404, headers, 'unknown pyodide version');
      file = path.join(PYODIDE[ver], ...p);
      headers['Cache-Control'] = 'public, max-age=3600';
    } else return send(res, 404, headers, 'not found');

    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return send(res, 404, headers, 'not found');
    }
    headers['Content-Type'] = TYPES[path.extname(file)] ?? 'application/octet-stream';
    if (!quiet) console.log(m[1], rest);
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`P0-05 spike server: http://localhost:${PORT}/m/plain/web/index.html`));

function send(res, status, headers, body) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}
