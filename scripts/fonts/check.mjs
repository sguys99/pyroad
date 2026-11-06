// 폰트 검사 (P2-10, docs/design/fonts.md). prebuild와 CI(lint-typecheck job)에서 돈다. Python 없이 Node만 쓴다.
//
//   npm run fonts:check
//
// 1. 랜딩 문구의 모든 글자가 랜딩 텍스트 서브셋(Jua·pyRoad Sans)에 있는지 (원본 글꼴에 없는 이모지 등은 manifest에 기록된 것만 허용)
// 2. src/fonts/의 폰트 파일이 manifest와 같은지 (손으로 고친 파일·빠진 조각·CSS가 가리키지 않는 파일)
// 3. 이름을 바꿔야 하는 글꼴(OFL 예약 이름)의 name 테이블에 원래 이름이 남지 않았는지
// 4. 글꼴 폴더마다 OFL.txt·README.md가 있는지
// 5. 앱 코드가 외부 폰트(Google Fonts·jsDelivr 등)나 next/font/google을 쓰지 않는지

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, collectLandingText } from './landing-text.mjs';
import { inspectWoff2 } from './woff2.mjs';

const FONTS = join(ROOT, 'src/fonts');
const REBUILD_LANDING = 'npm run fonts:build -- --landing';

/** OFL 예약 이름 때문에 바꾼 글꼴: 폴더 → 남으면 안 되는 이름 (§12-Q27) */
export const RESERVED_NAMES = {
  'pyroad-sans': { family: 'pyRoad Sans', reserved: ['Pretendard'] },
  'pyroad-mono': { family: 'pyRoad Mono', reserved: ['D2Coding'] },
};

/** 이름 레코드 중 원래 이름이 남아도 되는 것: 저작권·상표·제작사·디자이너·설명·URL·라이선스 */
const KEEP_NAME_IDS = new Set([0, 7, 8, 9, 10, 11, 12, 13, 14]);

/** 앱 코드에 있으면 안 되는 외부 폰트 출처 */
export const EXTERNAL_FONT_PATTERNS = [
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /next\/font\/google/,
  /cdn\.jsdelivr\.net\/[^'"\s]*(?:font|pretendard|d2coding)/i,
  /fonts-archive/,
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * 랜딩 글자 중 서브셋에 없는 것. 원본 글꼴에 없는 글자(notInFont)는 시스템 폰트로 그리는 것으로 받아들인다.
 * @param {string[]} chars 랜딩 문구 글자
 * @param {Set<number>} codepoints 서브셋 cmap
 * @param {string} notInFont manifest에 기록된 "원본에 없음" 글자
 */
export function findMissingLandingChars(chars, codepoints, notInFont) {
  const allowed = new Set([...notInFont]);
  return chars.filter(
    (ch) => !codepoints.has(ch.codePointAt(0)) && !allowed.has(ch),
  );
}

/** name 레코드에 남은 예약 이름 [nameID, 값] 목록 */
export function findReservedNames(names, reserved) {
  return Object.entries(names)
    .filter(([id]) => !KEEP_NAME_IDS.has(Number(id)))
    .filter(([, value]) => reserved.some((r) => value.includes(r)));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function main() {
  const errors = [];
  const manifestPath = join(FONTS, 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(
      '[fonts:check] src/fonts/manifest.json이 없어요. npm run fonts:build를 먼저 실행하세요.',
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // 1. 랜딩 글자
  const landing = collectLandingText(manifest.landing.entries);
  const prevChars = new Set([...manifest.landing.chars]);
  const added = landing.chars.filter((c) => !prevChars.has(c));
  for (const [key, info] of Object.entries(manifest.landing.fonts)) {
    const path = join(FONTS, info.file);
    if (!existsSync(path)) {
      errors.push(`랜딩 서브셋 파일이 없음: src/fonts/${info.file}`);
      continue;
    }
    const buf = readFileSync(path);
    if (sha256(buf) !== info.sha256) {
      errors.push(
        `src/fonts/${info.file}가 manifest와 다름 (손으로 고쳤거나 manifest를 안 커밋함). ${REBUILD_LANDING}`,
      );
    }
    const { codepoints } = inspectWoff2(buf);
    const missing = findMissingLandingChars(
      landing.chars,
      codepoints,
      info.notInFont,
    );
    if (missing.length) {
      errors.push(
        `랜딩 문구에 서브셋(${key}: src/fonts/${info.file})에 없는 글자가 있어요: ${missing.join(' ')}\n` +
          `    → 랜딩 문구가 바뀌었으면 ${REBUILD_LANDING} 를 실행하고 src/fonts/ 변경을 같은 커밋에 넣으세요.`,
      );
    }
  }
  if (!errors.length && added.length) {
    // 글자는 서브셋에 있지만(우연히 겹침) manifest 기록과 다르면 알려만 준다
    console.warn(
      `[fonts:check] 랜딩 글자 기록(manifest)에 없는 글자 ${added.join('')} — 서브셋에는 있음. 다음에 ${REBUILD_LANDING}`,
    );
  }

  // 2. 조각 파일·CSS
  const expected = new Map();
  for (const info of Object.values(manifest.landing.fonts))
    expected.set(info.file, info.sha256);
  for (const fam of Object.values(manifest.families)) {
    for (const [file, hash] of Object.entries(fam.files))
      expected.set(file, hash);
    const css = readFileSync(join(FONTS, fam.css), 'utf8');
    const urls = [...css.matchAll(/url\('\.\/([^']+)'\)/g)].map(
      (m) => `${fam.css.split('/')[0]}/${m[1]}`,
    );
    const listed = Object.keys(fam.files);
    if (urls.length !== listed.length || urls.some((u) => !fam.files[u])) {
      errors.push(
        `${fam.css}의 url()이 manifest 조각 목록과 다름. npm run fonts:build`,
      );
    }
  }
  const onDisk = walk(FONTS)
    .filter((p) => p.endsWith('.woff2'))
    .map((p) => relative(FONTS, p));
  for (const file of onDisk) {
    if (!expected.has(file))
      errors.push(`manifest에 없는 폰트 파일: src/fonts/${file}`);
  }
  for (const [file, hash] of expected) {
    const p = join(FONTS, file);
    if (!existsSync(p)) errors.push(`폰트 파일이 없음: src/fonts/${file}`);
    else if (sha256(readFileSync(p)) !== hash)
      errors.push(`manifest와 다른 폰트 파일: src/fonts/${file}`);
  }

  // 3. 예약 이름 (폴더의 모든 woff2)
  for (const [dir, { family, reserved }] of Object.entries(RESERVED_NAMES)) {
    for (const file of onDisk.filter((f) => f.startsWith(`${dir}/`))) {
      const { names } = inspectWoff2(readFileSync(join(FONTS, file)));
      const left = findReservedNames(names, reserved);
      if (names[1] !== family || left.length) {
        errors.push(
          `src/fonts/${file}: 글꼴 이름이 ${family}가 아니거나 예약 이름이 남음 ${JSON.stringify(left)}`,
        );
      }
    }
  }

  // 4. 라이선스
  for (const fam of Object.values(manifest.families)) {
    const dir = fam.css.split('/')[0];
    for (const f of ['OFL.txt', 'README.md']) {
      if (!existsSync(join(FONTS, dir, f)))
        errors.push(`src/fonts/${dir}/${f}가 없음 (OFL 고지)`);
    }
  }

  // 5. 외부 폰트
  const codeFiles = walk(join(ROOT, 'src')).filter((p) =>
    /\.(tsx?|css|mjs|js)$/.test(p),
  );
  for (const p of codeFiles) {
    const text = readFileSync(p, 'utf8');
    for (const re of EXTERNAL_FONT_PATTERNS) {
      if (re.test(text))
        errors.push(
          `${relative(ROOT, p)}: 외부 폰트 사용 (${re}). 폰트는 src/fonts/에서 자체 호스팅`,
        );
    }
  }

  if (errors.length) {
    console.error(
      `[fonts:check] 실패 ${errors.length}건\n- ${errors.join('\n- ')}`,
    );
    process.exit(1);
  }
  const landingKb =
    Object.values(manifest.landing.fonts).reduce((n, f) => n + f.bytes, 0) /
    1024;
  console.log(
    `[fonts:check] 통과: 랜딩 글자 ${landing.chars.length}개(모듈 ${landing.files.length}개) · 랜딩 서브셋 ${landingKb.toFixed(1)}KB · ` +
      `조각 ${Object.values(manifest.families)
        .map((f) => `${f.family} ${f.faces}`)
        .join(', ')}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
