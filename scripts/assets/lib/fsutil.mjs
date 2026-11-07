// 에셋 스크립트 공용 (P2-16)

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

/** `node scripts/assets/x.mjs`로 직접 실행했는지 (check.mjs가 import할 때는 false) */
export function isMain(metaUrl) {
  return (
    process.argv[1] !== undefined &&
    pathToFileURL(resolve(process.argv[1])).href === metaUrl
  );
}

export function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** 디렉토리 아래 파일 목록 (재귀, 없으면 빈 배열). 결과는 정렬된 절대 경로 */
export function listFiles(dir, filter = () => true) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (filter(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

export const rel = (p) => relative(ROOT, p);

export function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

/** 버전 붙은 파일 이름 `<이름>.v<N>.<확장자>` (immutable 캐시 대상) */
export const VERSIONED_NAME =
  /^[a-z0-9]+(?:-[a-z0-9]+)*\.v[1-9]\d*\.[a-z0-9]+$/;
