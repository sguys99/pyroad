// 빌드 뒤 폰트 확인 (P2-10, docs/design/fonts.md). postbuild에서 돌아 Vercel 빌드에서도 실행된다.
//
//   node scripts/fonts/check-build.mjs   # .next/가 있어야 함 (npm run build 뒤)
//
// 실패 (빌드를 멈춤)
// - 랜딩 말고 다른 라우트에 font preload가 붙음 (Turbopack이 다른 라우트의 next/font 선언을 섞는 누수, P0-14 §4.2)
// - 랜딩 font preload가 랜딩 텍스트 서브셋 2개(제목·본문)를 넘음 (굵기마다 따로 preload 등)
// - 랜딩 CSS에 앱 조각(unicode-range) @font-face가 들어감 / 랜딩 폰트 전송이 예산(150KB, §2.10)을 넘음
// - 코드 글꼴(pyRoad Mono) 조각 CSS가 퀘스트 밖 라우트에 실림, 앱 조각 CSS가 앱 화면에 없음
// 경고만
// - 랜딩 렌더 차단 CSS(gzip)가 예산(15KB, §2.10 · P4-12)을 넘음 — 지금은 Tailwind 기본 CSS가 대부분이라 P4-12에서 줄인다

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { ROOT } from './landing-text.mjs';

const NEXT = join(ROOT, '.next');
export const LANDING_FONT_BUDGET = 150 * 1024;
export const LANDING_CSS_BUDGET = 15 * 1024;
export const LANDING_PRELOAD_MAX = 2;
const LANDING_PAGE = '[project]/src/app/page';

/** 보고할 라우트 (client-reference manifest 경로 → 이름) */
const ROUTES = {
  '/': 'page',
  '/world': '(protected)/world/page',
  '/quest/[questId]': '(protected)/quest/[questId]/page',
  '/settings': '(protected)/settings/page',
  '/notice': 'notice/page',
};

/** next-font-manifest에서 랜딩이 아닌데 preload가 있는 라우트 */
export function findPreloadLeaks(fontManifest) {
  return Object.entries(fontManifest.app ?? {})
    .filter(([route, files]) => route !== LANDING_PAGE && files.length > 0)
    .map(([route, files]) => `${route}: ${files.join(', ')}`);
}

/** CSS 안의 @font-face를 분류: 조각(unicode-range + url) / 단일 파일(url) / local() 폴백 */
export function classifyFontFaces(css) {
  const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
  const out = { slices: {}, files: [], locals: 0 };
  for (const face of faces) {
    const family = face.match(/font-family:\s*["']?([^;"']+)/)?.[1] ?? '?';
    const url = face.match(/url\(["']?([^)"']+)/)?.[1];
    if (!url) out.locals++;
    else if (/unicode-range/.test(face))
      out.slices[family] = (out.slices[family] ?? 0) + 1;
    else out.files.push(url);
  }
  return out;
}

function readClientManifest(route) {
  const path = join(
    NEXT,
    'server/app',
    `${route}_client-reference-manifest.js`,
  );
  if (!existsSync(path)) return null;
  const sandbox = { globalThis: {} };
  sandbox.globalThis.__RSC_MANIFEST = {};
  vm.runInNewContext(readFileSync(path, 'utf8'), sandbox);
  const manifest = Object.values(sandbox.globalThis.__RSC_MANIFEST)[0];
  const pageKey = `[project]/src/app/${route}`;
  const files = manifest?.entryCSSFiles?.[pageKey];
  if (!files) return null;
  return files.map((f) => (typeof f === 'string' ? f : f.path));
}

/**
 * `/_next/static/...` 주소 → `.next/static/...` 파일 경로.
 * Vercel은 Skew Protection으로 정적 자산 주소에 `?dpl=<배포 ID>`를 붙이므로 쿼리·해시는 떼고 본다 (B42).
 */
export function staticFile(urlPath) {
  const path = urlPath.replace(/[?#].*$/, '');
  return join(NEXT, path.replace(/^\/_next\//, ''));
}

function main() {
  const errors = [];
  const warnings = [];
  const fontManifestPath = join(NEXT, 'server/next-font-manifest.json');
  const landingHtmlPath = join(NEXT, 'server/app/index.html');
  if (!existsSync(fontManifestPath) || !existsSync(landingHtmlPath)) {
    console.error(
      '[fonts:build-check] .next/가 없거나 랜딩이 정적 HTML이 아니에요. npm run build 뒤에 실행하세요.',
    );
    process.exit(1);
  }

  // preload 누수
  const fontManifest = JSON.parse(readFileSync(fontManifestPath, 'utf8'));
  const leaks = findPreloadLeaks(fontManifest);
  if (leaks.length)
    errors.push(
      `랜딩이 아닌 라우트에 font preload가 붙음 (Turbopack 누수?):\n    ${leaks.join('\n    ')}`,
    );

  // 랜딩 HTML: preload·CSS
  const html = readFileSync(landingHtmlPath, 'utf8');
  const preloads = [
    ...html.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g),
  ].map((m) => m[0].match(/href="([^"]+)"/)[1]);
  const stylesheets = [
    ...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g),
  ].map((m) => m[0].match(/href="([^"]+)"/)[1]);
  if (preloads.length > LANDING_PRELOAD_MAX) {
    errors.push(
      `랜딩 font preload ${preloads.length}개 (최대 ${LANDING_PRELOAD_MAX}): ${preloads.join(', ')}`,
    );
  }
  let cssGzip = 0;
  const landingFaces = { slices: {}, files: [], locals: 0 };
  for (const href of stylesheets) {
    const css = readFileSync(staticFile(href), 'utf8');
    cssGzip += gzipSync(css, { level: 9 }).length;
    const c = classifyFontFaces(css);
    for (const [fam, n] of Object.entries(c.slices))
      landingFaces.slices[fam] = (landingFaces.slices[fam] ?? 0) + n;
    landingFaces.files.push(...c.files);
    landingFaces.locals += c.locals;
  }
  if (Object.keys(landingFaces.slices).length) {
    errors.push(
      `랜딩 CSS에 앱 조각 @font-face가 실림: ${JSON.stringify(landingFaces.slices)} (src/fonts/app.css를 랜딩 트리에서 import하지 마세요)`,
    );
  }
  // 랜딩이 받을 수 있는 폰트 = preload + 랜딩 CSS가 가리키는 파일 전부 (최악)
  const fontFiles = new Set([
    ...preloads.map((u) => u.replace(/[?#].*$/, '')),
    ...landingFaces.files.map((u) =>
      u.replace(/^\.\.\/media\//, '/_next/static/media/'),
    ),
  ]);
  let fontBytes = 0;
  for (const url of fontFiles) {
    const p = staticFile(url);
    if (existsSync(p)) fontBytes += readFileSync(p).length;
  }
  if (fontBytes > LANDING_FONT_BUDGET) {
    errors.push(
      `랜딩 폰트 ${(fontBytes / 1024).toFixed(1)}KB > 예산 ${LANDING_FONT_BUDGET / 1024}KB (랜딩 문구 글자 수를 확인)`,
    );
  }
  if (cssGzip > LANDING_CSS_BUDGET) {
    warnings.push(
      `랜딩 렌더 차단 CSS ${(cssGzip / 1024).toFixed(1)}KB(gzip) > 예산 ${LANDING_CSS_BUDGET / 1024}KB — P4-12에서 줄임`,
    );
  }

  // 라우트별 CSS (Turbopack client-reference manifest). 구조가 바뀌어 못 읽으면 경고만
  const rows = [];
  for (const [name, route] of Object.entries(ROUTES)) {
    const files = readClientManifest(route);
    if (!files) {
      warnings.push(
        `${name}: client-reference manifest에서 CSS 목록을 못 읽음 (Next 버전이 바뀌었으면 이 스크립트를 고치세요)`,
      );
      continue;
    }
    const faces = { slices: {}, files: 0 };
    let gz = 0;
    for (const f of files) {
      const css = readFileSync(join(NEXT, f), 'utf8');
      gz += gzipSync(css, { level: 9 }).length;
      const c = classifyFontFaces(css);
      for (const [fam, n] of Object.entries(c.slices))
        faces.slices[fam] = (faces.slices[fam] ?? 0) + n;
      faces.files += c.files.length;
    }
    const preloadCount = (
      fontManifest.app?.[`[project]/src/app/${route}`] ?? []
    ).length;
    const hasMono = !!faces.slices['pyRoad Mono'];
    const hasApp = !!faces.slices['pyRoad Sans'] && !!faces.slices.Jua;
    if (name === '/quest/[questId]' && !hasMono)
      errors.push(`${name}: 코드 글꼴(pyRoad Mono) 조각 CSS가 없음`);
    if (name !== '/quest/[questId]' && hasMono)
      errors.push(`${name}: 퀘스트 밖인데 pyRoad Mono 조각 CSS가 실림`);
    if (name !== '/' && !hasApp)
      errors.push(`${name}: 앱 조각 CSS(Jua·pyRoad Sans)가 없음`);
    rows.push(
      `  ${name.padEnd(17)} preload ${preloadCount} · CSS ${files.length}개 ${(gz / 1024).toFixed(1)}KB(gzip) · ` +
        `조각 ${
          Object.entries(faces.slices)
            .map(([f, n]) => `${f} ${n}`)
            .join(', ') || '없음'
        }${faces.files ? ` · 단일 파일 ${faces.files}` : ''}`,
    );
  }

  console.log(
    `[fonts:build-check] 랜딩 font preload ${preloads.length}개 · 폰트 ${(fontBytes / 1024).toFixed(1)}KB / ${LANDING_FONT_BUDGET / 1024}KB · ` +
      `렌더 차단 CSS ${(cssGzip / 1024).toFixed(1)}KB(gzip)\n${rows.join('\n')}`,
  );
  for (const w of warnings) console.warn(`[fonts:build-check] 경고: ${w}`);
  if (errors.length) {
    console.error(
      `[fonts:build-check] 실패 ${errors.length}건\n- ${errors.join('\n- ')}`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
