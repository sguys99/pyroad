// 빌드 뒤 폰트 확인 (P2-10, docs/design/fonts.md). postbuild에서 돌아 Vercel 빌드에서도 실행된다.
//
//   node scripts/fonts/check-build.mjs   # .next/가 있어야 함 (npm run build 뒤)
//
// 실패 (빌드를 멈춤)
// - 랜딩 말고 다른 라우트에 font preload가 붙음 (Turbopack이 다른 라우트의 next/font 선언을 섞는 누수, P0-14 §4.2)
// - 랜딩 font preload가 랜딩 텍스트 서브셋 2개(제목·본문)를 넘음 (굵기마다 따로 preload 등)
// - 랜딩 CSS에 앱 조각(unicode-range) @font-face가 들어감 / 랜딩 폰트 전송이 예산(150KB, §2.10)을 넘음
// - 코드 글꼴(pyRoad Mono) 조각 CSS가 퀘스트 밖 라우트에 실림, 앱 조각 CSS가 앱 화면에 없음
// 렌더 차단 CSS 크기는 보고만 한다. 예산(15KB, §2.10)은 scripts/perf/check-landing-budget.mjs가 실패로 막는다 (P4-12)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { ROOT } from './landing-text.mjs';
import { inspectWoff2 } from './woff2.mjs';

// 다른 빌드 폴더를 볼 때만 바꾼다 (격리 worktree의 빌드 결과 확인 등)
const NEXT = process.env.FONTS_CHECK_NEXT_DIR ?? join(ROOT, '.next');
export const LANDING_FONT_BUDGET = 150 * 1024;
/** 첫 화면 preload 목표 (경고만, P4-12). 문구가 늘어도 LANDING_FONT_BUDGET 안에 머물 여유 */
export const LANDING_PRELOAD_TARGET = 100 * 1024;
export const LANDING_PRELOAD_MAX = 2;
/** src/app/app.css에 든 표시 (앱 라우트에 실렸는지 확인용) */
export const APP_CSS_MARKER = '--pyroad-app-css';
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

/**
 * CSS에서 font-family를 정하는 규칙을 뽑는다 (빌드 뒤 랜딩 HTML 글자 검사용, P4-12).
 * kind: display(제목 = `--font-display-landing`) · sans(본문 = `--font-sans-landing`) · mono · inherit · other
 * layer: Tailwind 캐스케이드 층 순위 (theme 0 < base 1 < components 2 < utilities 3 < 층 없음 4)
 * @returns {{ selector: string, kind: string, layer: number, order: number }[]}
 */
export function fontFamilyRules(css, start = 0) {
  const LAYERS = { theme: 0, base: 1, components: 2, utilities: 3 };
  const rules = [];
  const stack = [];
  let prelude = '';
  let order = start;
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' || ch === "'") {
      const end = text.indexOf(ch, i + 1);
      prelude += text.slice(i, end + 1);
      i = end;
    } else if (ch === '{') {
      stack.push(prelude.trim());
      prelude = '';
    } else if (ch === '}') {
      const body = prelude;
      const sel = stack.pop() ?? '';
      prelude = '';
      const fam = body.match(/(?:^|;)\s*font-family:([^;]+)/)?.[1];
      if (!fam || sel.startsWith('@')) continue;
      const kind = /--font-display-landing/.test(fam)
        ? 'display'
        : /--font-sans-landing/.test(fam)
          ? 'sans'
          : /^\s*inherit\s*$/.test(fam)
            ? 'inherit'
            : /pyRoad Mono|monospace/.test(fam)
              ? 'mono'
              : 'other';
      const layerName = stack
        .find((x) => x.startsWith('@layer'))
        ?.replace('@layer', '')
        .trim();
      const layer = layerName in LAYERS ? LAYERS[layerName] : 4;
      for (const one of splitSelectors(sel))
        rules.push({ selector: one, kind, layer, order: order++ });
    } else if (ch === ';' && !stack.length) {
      prelude = ''; // `@layer a, b;` 같은 맨 위 문장
    } else {
      prelude += ch;
    }
  }
  return rules;
}

/** 쉼표로 선택자를 나눈다 (괄호 안 쉼표는 그대로) */
function splitSelectors(sel) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && !depth) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 대략의 선택자 명시도 [id, class·속성·가상 클래스, 태그]. :where()는 0 */
export function specificity(selector) {
  const s = selector
    .replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')
    .replace(/::[\w-]+/g, ' ');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w\\[\]-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? [])
    .length;
  const tags = (s.match(/(^|[\s>+~(])[a-z][\w-]*/gi) ?? []).length;
  return ids * 1e6 + classes * 1e3 + tags;
}

/** 화면에 글자로 안 나오는 곳 (검사하지 않음) */
const SKIP_TEXT =
  'script, style, noscript, template, title, desc, .sr-only, [hidden]';

/**
 * 렌더된 HTML의 글자를 글꼴별로 모은다 (CSS 캐스케이드를 대략 흉내: 층 → 명시도 → 순서, 맞는 규칙이 없으면 부모를 물려받음).
 * @param {string} html
 * @param {ReturnType<typeof fontFamilyRules>} rules
 * @returns {Promise<Record<string, { text: string, samples: string[] }>>}
 */
export async function textByFont(html, rules) {
  const { JSDOM } = await import('jsdom');
  const { document } = new JSDOM(html).window;
  const usable = rules.filter((r) => {
    try {
      document.documentElement.matches(r.selector);
      return true;
    } catch {
      return false; // jsdom이 모르는 선택자
    }
  });
  const memo = new Map();
  const kindOf = (el) => {
    if (!el) return 'sans';
    if (memo.has(el)) return memo.get(el);
    let best = null;
    for (const r of usable) {
      if (!el.matches(r.selector)) continue;
      const key = [r.layer, specificity(r.selector), r.order];
      if (
        !best ||
        key[0] > best.key[0] ||
        (key[0] === best.key[0] &&
          (key[1] > best.key[1] ||
            (key[1] === best.key[1] && key[2] > best.key[2])))
      )
        best = { key, kind: r.kind };
    }
    const kind =
      !best || best.kind === 'inherit' ? kindOf(el.parentElement) : best.kind;
    memo.set(el, kind);
    return kind;
  };
  const out = {};
  const walker = document.createTreeWalker(document.body, 4 /* TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || !n.data.trim() || el.closest(SKIP_TEXT)) continue;
    const kind = kindOf(el);
    out[kind] ??= { text: '', samples: [] };
    out[kind].text += n.data;
    out[kind].samples.push(n.data.trim());
  }
  return out;
}

/**
 * 글꼴에 없는 글자와 그 글자가 든 문구 (공백·제어 문자, 원본에 없다고 기록된 글자 제외)
 * @param {{ text: string, samples: string[] }} used
 * @param {Set<number>} codepoints
 * @param {string} notInFont
 */
export function findMissingGlyphs(used, codepoints, notInFont = '') {
  const allowed = new Set([...notInFont]);
  const missing = [
    ...new Set(
      [...used.text].filter(
        (ch) =>
          !/[\s\p{Cc}\p{Cf}]/u.test(ch) &&
          !allowed.has(ch) &&
          !codepoints.has(ch.codePointAt(0)),
      ),
    ),
  ];
  const samples = used.samples
    .filter((t) => missing.some((ch) => t.includes(ch)))
    .slice(0, 5);
  return { missing, samples };
}

async function main() {
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
  let preloadBytes = 0;
  for (const url of preloads) {
    const p = staticFile(url);
    if (existsSync(p)) preloadBytes += readFileSync(p).length;
  }
  if (preloadBytes > LANDING_PRELOAD_TARGET) {
    warnings.push(
      `랜딩 font preload ${(preloadBytes / 1024).toFixed(1)}KB > 목표 ${LANDING_PRELOAD_TARGET / 1024}KB (P4-12, docs/design/fonts.md §4)`,
    );
  }
  if (fontBytes > LANDING_FONT_BUDGET) {
    errors.push(
      `랜딩 폰트 ${(fontBytes / 1024).toFixed(1)}KB > 예산 ${LANDING_FONT_BUDGET / 1024}KB (랜딩 문구 글자 수를 확인)`,
    );
  }
  // 랜딩 HTML 글자가 실제로 그 글꼴 서브셋에 있는지 (P4-12): 제목 글꼴 자리 → Jua, 본문 → pyRoad Sans.
  // 서브셋 글자는 소스에서 모으므로(landing-text.mjs) 빠진 자리를 렌더 결과로 한 번 더 본다. 클라이언트에서만 뜨는 글자는 e2e(landing-fonts.spec.ts)
  const preloadFonts = {};
  for (const url of preloads) {
    const p = staticFile(url);
    if (!existsSync(p)) continue;
    const { names, codepoints } = inspectWoff2(readFileSync(p));
    if (names[1] === 'Jua') preloadFonts.display = codepoints;
    else if (names[1] === 'pyRoad Sans') preloadFonts.sans = codepoints;
  }
  const manifest = JSON.parse(
    readFileSync(join(ROOT, 'src/fonts/manifest.json'), 'utf8'),
  );
  const notInFont = {
    display: manifest.landing.fonts.jua?.notInFont ?? '',
    sans: manifest.landing.fonts.sans?.notInFont ?? '',
  };
  let order = 0;
  const rules = [];
  for (const href of stylesheets) {
    const r = fontFamilyRules(readFileSync(staticFile(href), 'utf8'), order);
    order += r.length;
    rules.push(...r);
  }
  const used = await textByFont(html, rules);
  const glyphRows = [];
  for (const kind of ['display', 'sans']) {
    if (!used[kind]) continue;
    if (!preloadFonts[kind]) {
      errors.push(
        `랜딩 ${kind} 글꼴 preload를 못 찾음 (preload: ${preloads.join(', ')})`,
      );
      continue;
    }
    const { missing, samples } = findMissingGlyphs(
      used[kind],
      preloadFonts[kind],
      notInFont[kind],
    );
    glyphRows.push(
      `${kind} ${new Set(used[kind].text.replace(/\s/g, '')).size}자`,
    );
    if (missing.length)
      errors.push(
        `랜딩 HTML의 ${kind === 'display' ? '제목(Jua)' : '본문(pyRoad Sans)'} 글자가 서브셋에 없음: ${missing.join(' ')}\n` +
          `    예: ${samples.map((t) => JSON.stringify(t.slice(0, 40))).join(', ')}\n` +
          '    → npm run fonts:build -- --landing 후 다시 빌드. 그래도 남으면 scripts/fonts/landing-text.mjs가 그 자리를 못 찾는 것 (node scripts/fonts/landing-text.mjs --why)',
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
    let appCss = false;
    for (const f of files) {
      const css = readFileSync(join(NEXT, f), 'utf8');
      gz += gzipSync(css, { level: 9 }).length;
      if (css.includes(APP_CSS_MARKER)) appCss = true;
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
    // 앱 화면 유틸리티 CSS (src/app/app.css, P4-12): 앱 라우트에는 있고 랜딩에는 없어야 한다
    if (name !== '/' && !appCss)
      errors.push(
        `${name}: 앱 화면 CSS(src/app/app.css)가 없음 — 그 화면 틀에서 '@/app/app.css'를 import하세요`,
      );
    if (name === '/' && appCss)
      errors.push(
        '/: 랜딩에 앱 화면 CSS(src/app/app.css)가 실림 (렌더 차단 CSS 예산)',
      );
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
      `렌더 차단 CSS ${(cssGzip / 1024).toFixed(1)}KB(gzip) · HTML 글자 검사 ${glyphRows.join(', ') || '없음'}\n${rows.join('\n')}`,
  );
  for (const w of warnings) console.warn(`[fonts:build-check] 경고: ${w}`);
  if (errors.length) {
    console.error(
      `[fonts:build-check] 실패 ${errors.length}건\n- ${errors.join('\n- ')}`,
    );
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
