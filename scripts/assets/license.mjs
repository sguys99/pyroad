// 라이선스 기록 검사 (P2-17, X14): 배포하는 에셋이 모두 docs/assets-license.md에 적혀 있는지
//
//   npm run assets:license    # (assets:check에도 들어 있음) 빠진 기록·오래된 기록이 있으면 exit 1
//
// 열쇠 규칙은 lib/license.mjs 맨 위 주석, 문서 쪽 설명은 docs/assets-license.md "9. 검사".
// 라이선스가 맞는지는 사람이 판단한다. 이 검사는 "파일은 있는데 기록이 없음"·"기록은 있는데 파일이 없음"만 잡는다.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ROOT, isMain, listFiles } from './lib/fsutil.mjs';
import {
  VERSIONED_DIRS,
  licenseProblems,
  mediaImports,
  requiredKeys,
} from './lib/license.mjs';

export const LICENSE_DOC = 'docs/assets-license.md';

const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;

function subdirs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .sort();
}

/** @returns {boolean} 통과 여부 */
export function runLicense({ root = ROOT, docPath = LICENSE_DOC } = {}) {
  const abs = (p) => join(root, p);
  const toRepo = (p) => relative(root, p).split(sep).join('/');

  if (!existsSync(abs(docPath))) {
    console.error(`  ✗ ${docPath}가 없어요`);
    return false;
  }
  const doc = readFileSync(abs(docPath), 'utf8');

  const publicFiles = listFiles(abs('public')).map(toRepo);
  const extraFiles = VERSIONED_DIRS.filter((d) => !d.startsWith('public/'))
    .flatMap((d) => listFiles(abs(d)))
    .map(toRepo);
  const fontDirs = subdirs(abs('src/fonts')).map((n) => `src/fonts/${n}`);
  const appFiles = listFiles(abs('src/app')).map(toRepo);
  const srcImports = listFiles(abs('src'), (p) => SOURCE_EXT.test(p))
    .filter((p) => !/\/__tests__\//.test(p))
    .flatMap((p) => mediaImports(readFileSync(p, 'utf8'), toRepo(p)));

  const items = requiredKeys({
    publicFiles,
    fontDirs,
    appFiles,
    srcImports,
    extraFiles,
  });
  const { missing, stale } = licenseProblems(doc, items, (p) =>
    existsSync(abs(p)),
  );

  for (const m of missing)
    console.error(
      `  ✗ 기록 없음: ${m} — ${docPath}에 출처·라이선스와 함께 적으세요`,
    );
  for (const s of stale)
    console.error(
      `  ✗ 오래된 기록: ${s}가 문서에는 있는데 파일이 없어요 (지웠거나 버전을 올렸으면 표를 고치세요)`,
    );
  if (!missing.length && !stale.length)
    console.log(`  ✓ 에셋 ${items.length}개 모두 ${docPath}에 기록됨`);
  return !missing.length && !stale.length;
}

if (isMain(import.meta.url)) {
  if (!runLicense()) process.exit(1);
}
