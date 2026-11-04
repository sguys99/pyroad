// next build 로그의 라우트 표(Size / First Load JS)와 공유 청크, 경고를 JSON 으로
//   node scripts/routes.mjs <build.log>
import fs from 'node:fs';
const log = fs.readFileSync(process.argv[2], 'utf8').replace(/\x1b\[[0-9;]*m/g, '');
const kb = (s) => (s === '0 B' ? 0 : s.endsWith('kB') ? parseFloat(s) : s.endsWith('MB') ? parseFloat(s) * 1024 : s.endsWith(' B') ? parseFloat(s) / 1024 : null);
const routes = [];
const shared = [];
let sharedTotal = null;
let middleware = null;
for (const line of log.split('\n')) {
  let m = line.match(/^[┌├└]\s+([○ƒ●λ])\s+(\S+)\s+([\d.]+ (?:B|kB|MB))\s+([\d.]+ (?:B|kB|MB))/);
  if (m) { routes.push({ route: m[2], kind: m[1] === '○' ? 'static' : 'dynamic', sizeKB: kb(m[3]), firstLoadKB: kb(m[4]) }); continue; }
  m = line.match(/First Load JS shared by all\s+([\d.]+ (?:B|kB|MB))/);
  if (m) { sharedTotal = kb(m[1]); continue; }
  m = line.match(/^\s+[├└]\s+(\S.*?)\s{2,}([\d.]+ (?:B|kB|MB))$/);
  if (m) { shared.push({ chunk: m[1], kb: kb(m[2]) }); continue; }
  m = line.match(/Middleware\s+([\d.]+ (?:B|kB|MB))/);
  if (m) middleware = kb(m[1]);
}
const warnings = log.split('\n').filter((l) => /Warning:|warn|⚠/.test(l)).map((l) => l.trim());
const seconds = Number(log.match(/build_seconds=(\d+)/)?.[1] ?? NaN);
console.log(JSON.stringify({ note: 'Next.js 15.5 빌드 출력의 크기(압축 기준 추정치). Turbopack 빌드는 라우트별 값이 공유 청크와 맞지 않을 수 있어 실제 전송량은 lighthouse.json 참고', buildSeconds: seconds, sharedTotalKB: sharedTotal, shared, middlewareKB: middleware, routes, warnings }, null, 2));
