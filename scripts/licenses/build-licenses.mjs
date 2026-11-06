// `/licenses` 오픈소스·에셋 고지 데이터 생성 (P3-14, §12-Q33, docs/assets-license.md §8).
//
//   npm run licenses:build            # src/lib/legal/licenses.generated.json (커밋하는 생성물)
//   npm run licenses:check            # 쓰지 않고 비교만. 다르면 종료 코드 1 (CI lint-typecheck)
//   옵션: --out <file>                # 생성물 경로 (테스트용, 기본 src/lib/legal/licenses.generated.json)
//
// 모으는 것
// - npm: package.json `dependencies`에서 시작해 `dependencies`만 따라간 패키지(플랫폼별 optional·peer 제외)의
//   이름·버전·라이선스·저작권 줄·라이선스 파일 전문(+ NOTICE). 빌드 도구·타입 정의·안 쓰는 의존성은 lib/collect.mjs의 표로 뺀다.
// - 브라우저 파이썬(Pyodide·CPython·Emscripten), 웹폰트 3종 OFL 전문, 사운드 작가 크레딧: notices.mjs
//
// 생성물을 커밋하는 이유: content:build(seed.sql)·fonts:build와 같은 방식. 의존성을 바꾸면(package-lock) 같은 커밋에서
// 다시 만들어야 하고 CI가 드리프트를 잡는다. 빌드(Vercel)는 node_modules를 다시 읽지 않고 커밋된 파일을 그대로 쓴다.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APACHE_MARKER,
  BUILD_ONLY,
  SELF_ONLY,
  SKIP_ROOTS,
  authorOf,
  collectPackages,
  firstDiffLine,
  groupByLicense,
  licenseOf,
  normalizeText,
  packageUrl,
  readLicenseFiles,
  readNoticeFile,
  serialize,
} from './lib/collect.mjs';
import {
  FONTS,
  LICENSE_NAMES,
  MIT_STANDARD,
  PYODIDE_EXPECTED,
  RUNTIME,
  SOUNDS,
} from './notices.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUTPUT = 'src/lib/legal/licenses.generated.json';
const TEXTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'texts');

function readText(path) {
  return normalizeText(readFileSync(path, 'utf8'));
}

/** node_modules의 Pyodide가 고지 텍스트를 맞춘 판과 같은지 */
export function checkPyodideVersion(pkgVersion, lockInfo) {
  const problems = [];
  if (pkgVersion !== PYODIDE_EXPECTED.version)
    problems.push(`pyodide ${pkgVersion} (기대 ${PYODIDE_EXPECTED.version})`);
  if (lockInfo?.python !== PYODIDE_EXPECTED.python)
    problems.push(
      `Python ${lockInfo?.python} (기대 ${PYODIDE_EXPECTED.python})`,
    );
  if (lockInfo?.platform !== PYODIDE_EXPECTED.platform)
    problems.push(
      `플랫폼 ${lockInfo?.platform} (기대 ${PYODIDE_EXPECTED.platform})`,
    );
  return problems;
}

/** 저장소 상태 → 생성물 객체 */
export function buildLicenseData(root = ROOT) {
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

  const pyodideDir = join(root, 'node_modules/pyodide');
  const pyodidePkg = JSON.parse(
    readFileSync(join(pyodideDir, 'package.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(pyodideDir, 'pyodide-lock.json'), 'utf8'),
  );
  const problems = checkPyodideVersion(pyodidePkg.version, lock.info);
  if (problems.length > 0) {
    throw new Error(
      `Pyodide 판이 고지 텍스트와 달라요: ${problems.join(', ')}. ` +
        'scripts/licenses/notices.mjs의 PYODIDE_EXPECTED와 texts/의 MPL·CPython·Emscripten 전문을 새 판으로 바꾸세요',
    );
  }

  const apache = readText(join(TEXTS_DIR, 'Apache-2.0.txt'));
  const { packages, skipped } = collectPackages(root, rootPkg);
  const entries = packages.map(({ name, version, dir, pkg }) => ({
    name,
    version,
    license: licenseOf(pkg),
    url: packageUrl(pkg),
    author: authorOf(pkg),
    text: readLicenseFiles(dir),
    notice: readNoticeFile(dir),
  }));
  const unknown = entries
    .filter((e) => e.license === 'UNKNOWN')
    .map((e) => e.name);
  if (unknown.length > 0) {
    throw new Error(
      `라이선스 표기가 없는 패키지: ${unknown.join(', ')}. 직접 확인하고 notices에 적으세요`,
    );
  }
  const { groups, texts } = groupByLicense(entries, { apache });
  const usesApacheMarker = Object.values(texts).some((t) =>
    t.includes(APACHE_MARKER),
  );

  /** @type {Record<string, string>} */
  const standardTexts = { MIT: MIT_STANDARD };
  if (usesApacheMarker || groups.some((g) => g.license === 'Apache-2.0'))
    standardTexts['Apache-2.0'] = apache;

  const runtime = RUNTIME.map(({ text, ...rest }) => ({
    ...rest,
    text: readText(join(TEXTS_DIR, text)),
  }));
  const fonts = FONTS.map(({ text, ...rest }) => ({
    ...rest,
    text: readText(join(root, text)),
  }));

  return {
    _comment:
      '생성물 (npm run licenses:build, scripts/licenses/build-licenses.mjs). 직접 고치지 마세요. 의존성·에셋을 바꾸면 다시 만들어 함께 커밋',
    licenseNames: LICENSE_NAMES,
    excluded: {
      roots: SKIP_ROOTS,
      selfOnly: SELF_ONLY,
      buildOnly: BUILD_ONLY,
      typesOnly: skipped.filter((n) => n.startsWith('@types/')),
    },
    npm: {
      count: entries.length,
      groups,
      standardTexts,
      texts,
    },
    runtime,
    fonts,
    sounds: SOUNDS,
  };
}

function main() {
  const check = process.argv.includes('--check');
  const data = buildLicenseData();
  const next = serialize(data);
  const outArg = process.argv.indexOf('--out');
  const outPath = resolve(ROOT, outArg > 0 ? process.argv[outArg + 1] : OUTPUT);
  const name = relative(ROOT, outPath);
  const summary = data.npm.groups
    .map((g) => `${g.license} ${g.packages.length}`)
    .join(', ');
  console.log(
    `npm 패키지 ${data.npm.count}개 (${summary}) · 런타임 ${data.runtime.length} · 글꼴 ${data.fonts.length} · 사운드 ${data.sounds.length}`,
  );

  if (check) {
    const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : null;
    if (current === next) {
      console.log(`같음: ${name}`);
      return;
    }
    const diff = current === null ? null : firstDiffLine(current, next);
    console.log(
      `다름: ${name}${current === null ? ' (파일 없음)' : diff ? ` (${diff.line}번째 줄)\n  지금: ${diff.current}\n  새로: ${diff.next}` : ''}`,
    );
    console.error(
      '고지 데이터가 의존성·에셋과 달라요. npm run licenses:build로 다시 만들어 함께 커밋하세요 (package.json·package-lock.json·notices.mjs를 바꿨다면)',
    );
    process.exit(1);
  }
  writeFileSync(outPath, next);
  console.log(
    `썼어요: ${name} (${(Buffer.byteLength(next) / 1024).toFixed(0)}KB)`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
