// 라이선스 기록 검사의 순수 함수 (P2-17, X14). 실행: scripts/assets/license.mjs
//
// 배포되는 에셋 파일마다 docs/assets-license.md에 "열쇠"가 백틱으로 적혀 있어야 한다.
//   - 버전 붙은 폴더(public/sounds/*, textures, images, animations, assets/share-card): `<id>.v<N>` (확장자·`-<폭>w` 뺀 이름)
//   - 폰트 폴더 src/fonts/<이름>/: `src/fonts/<이름>/`
//   - 그 밖의 public 파일: `public/<경로>` 또는 상위 폴더 `public/<폴더>/`
//   - src/app 메타데이터 그림(icon·favicon·opengraph-image 등)과 src에서 import한 그림·소리 파일: 저장소 기준 경로
// 거꾸로, 문서에 적힌 `<id>.v<N>`·에셋 파일 경로가 저장소에 없으면 오래된 기록으로 보고 실패한다.

/** 열쇠가 `<id>.v<N>`인 폴더 (저장소 기준). 파이프라인이 버전 붙은 이름만 만드는 곳 */
export const VERSIONED_DIRS = [
  'public/sounds/sfx',
  'public/sounds/bgm',
  'public/textures',
  'public/images',
  'public/animations',
  'assets/share-card',
];

/** 우리 코드라 기록 대상이 아닌 public 폴더. public/pyodide는 npm 패키지 복사본(git 제외)이라 문서 §5에 한 줄로 */
export const PUBLIC_SKIP = ['public/pyodide/', 'public/workers/'];

/** src/app 파일 기반 메타데이터 그림 (Next.js 규칙 이름) */
export const APP_METADATA_IMAGE =
  /(^|\/)(icon|apple-icon|favicon|opengraph-image|twitter-image)\d*\.(ico|png|jpe?g|gif|svg)$/;

/** 라이선스 기록 대상 확장자 (import 검사·문서의 경로 역검사) */
export const ASSET_EXT =
  /\.(png|jpe?g|webp|avif|gif|svg|ico|json|webm|m4a|mp3|ogg|wav|woff2?|ttf|otf)$/;

const MEDIA_IMPORT_EXT =
  /\.(png|jpe?g|webp|avif|gif|svg|ico|webm|m4a|mp3|ogg|wav|woff2?|ttf|otf)$/;

/** `hero-800w.v1.webp` → `hero.v1`, `tap.v1.m4a` → `tap.v1`, 버전 없는 이름은 확장자만 뺌 */
export function versionedKey(fileName) {
  const m = /^(.+?)(?:-\d+w)?\.(v[1-9]\d*)\.[a-z0-9]+$/.exec(fileName);
  if (m) return `${m[1]}.${m[2]}`;
  return fileName.replace(/\.[^.]+$/, '');
}

/**
 * src 코드의 정적 import 중 그림·소리·폰트 파일 (`import x from '@/../img/a.png'`).
 * @param {string} code
 * @param {string} fromFile 저장소 기준 경로 (예: src/components/landing/AboutSection.tsx)
 * @returns {string[]} 저장소 기준 경로
 */
export function mediaImports(code, fromFile) {
  const out = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)(['"])([^'"\n]+)\1/g;
  for (const m of code.matchAll(re)) {
    const spec = m[2];
    if (!MEDIA_IMPORT_EXT.test(spec)) continue;
    let path;
    if (spec.startsWith('@/')) path = `src/${spec.slice(2)}`;
    else if (spec.startsWith('.'))
      path = `${fromFile.split('/').slice(0, -1).join('/')}/${spec}`;
    else continue; // 패키지 안 파일은 §5(의존성)에서 다룸
    out.push(normalizePath(path));
  }
  return out;
}

/** `a/b/../c/./d` → `a/c/d` */
export function normalizePath(p) {
  const parts = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

/**
 * 기록해야 할 열쇠 목록.
 * @param {{ publicFiles: string[], fontDirs: string[], appFiles: string[], srcImports: string[], extraFiles?: string[] }} input
 *   publicFiles·appFiles·extraFiles: 저장소 기준 파일 경로 (extraFiles는 assets/share-card 등 public 밖 버전 폴더)
 * @returns {Array<{ file: string, keys: string[] }>} keys 중 하나라도 문서에 있으면 통과
 */
export function requiredKeys({
  publicFiles,
  fontDirs,
  appFiles,
  srcImports,
  extraFiles = [],
}) {
  const items = [];
  for (const file of [...publicFiles, ...extraFiles]) {
    if (PUBLIC_SKIP.some((d) => file.startsWith(d))) continue;
    const dir = VERSIONED_DIRS.find((d) => file.startsWith(`${d}/`));
    if (dir) {
      items.push({
        file,
        keys: [
          versionedKey(
            file
              .slice(dir.length + 1)
              .split('/')
              .pop(),
          ),
        ],
      });
      continue;
    }
    // 그 밖의 public 파일: 파일 경로 또는 상위 폴더 (public/ 자체는 제외)
    const segs = file.split('/');
    const keys = [file];
    for (let i = segs.length - 1; i >= 2; i--)
      keys.push(`${segs.slice(0, i).join('/')}/`);
    items.push({ file, keys });
  }
  for (const dir of fontDirs) items.push({ file: dir, keys: [`${dir}/`] });
  for (const file of appFiles)
    if (APP_METADATA_IMAGE.test(file)) items.push({ file, keys: [file] });
  for (const file of new Set(srcImports)) items.push({ file, keys: [file] });
  return items;
}

/** 문서에서 백틱으로 감싼 토큰 */
export function backtickTokens(doc) {
  return new Set([...doc.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()));
}

/**
 * @param {string} doc docs/assets-license.md 내용
 * @param {Array<{ file: string, keys: string[] }>} items requiredKeys 결과
 * @param {(path: string) => boolean} exists 저장소 기준 경로가 있는지
 * @returns {{ missing: string[], stale: string[] }}
 */
export function licenseProblems(doc, items, exists) {
  const tokens = backtickTokens(doc);
  const missing = items
    .filter(({ keys }) => !keys.some((k) => tokens.has(k)))
    .map(({ file, keys }) => `${file} → \`${keys[0]}\``);

  const versioned = new Set(
    items
      .filter(({ file }) =>
        VERSIONED_DIRS.some((d) => file.startsWith(`${d}/`)),
      )
      .map(({ keys }) => keys[0]),
  );
  const stale = [];
  for (const t of tokens) {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*\.v[1-9]\d*$/.test(t)) {
      if (!versioned.has(t)) stale.push(`\`${t}\``);
    } else if (/^src\/fonts\/[^/\s<>]+\/$/.test(t)) {
      if (!exists(t.slice(0, -1))) stale.push(`\`${t}\``);
    } else if (
      /^(public|img|src|assets)\/[^\s*<>{}]+$/.test(t) &&
      ASSET_EXT.test(t) &&
      !exists(t)
    ) {
      stale.push(`\`${t}\``);
    }
  }
  return { missing, stale };
}
