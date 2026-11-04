// npm `pyodide` 패키지에서 브라우저 Worker가 쓰는 파일만 public/pyodide/<버전>/으로 복사한다 (B26, §2.9).
// predev·prebuild에서 돌기 때문에 Vercel 빌드(`npm run build`)에서도 실행된다. 복사본은 git에 넣지 않는다.
//
//   node scripts/pyodide/copy-assets.mjs           # 복사 (같은 파일이면 건너뜀)
//   node scripts/pyodide/copy-assets.mjs --check   # 복사본이 최신인지만 확인 (다르면 exit 1)

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PKG_DIR = join(ROOT, 'node_modules/pyodide');
const PUBLIC_ROOT = join(ROOT, 'public/pyodide');

/** Worker가 실제로 받는 파일. 패키지(.whl)는 쓰지 않으므로 lock 파일만 있으면 된다 */
export const PYODIDE_ASSETS = [
  'pyodide.mjs',
  'pyodide.mjs.map',
  'pyodide.asm.mjs',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function main() {
  const check = process.argv.includes('--check');
  const version = JSON.parse(
    readFileSync(join(PKG_DIR, 'package.json'), 'utf8'),
  ).version;
  const expected = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    .dependencies.pyodide;
  if (version !== expected) {
    throw new Error(
      `node_modules/pyodide는 ${version}인데 package.json은 ${expected}예요. npm install을 다시 실행하세요.`,
    );
  }
  const outDir = join(PUBLIC_ROOT, version);
  let copied = 0;
  let stale = 0;
  let raw = 0;
  let gz = 0;
  for (const name of PYODIDE_ASSETS) {
    const src = join(PKG_DIR, name);
    const dest = join(outDir, name);
    const same =
      existsSync(dest) &&
      statSync(dest).size === statSync(src).size &&
      fileHash(dest) === fileHash(src);
    if (!same) {
      stale++;
      if (!check) {
        mkdirSync(outDir, { recursive: true });
        copyFileSync(src, dest);
        copied++;
      }
    }
    if (!name.endsWith('.map')) {
      const buf = readFileSync(src);
      raw += buf.length;
      gz += gzipSync(buf, { level: 9 }).length;
    }
  }
  if (check) {
    if (stale > 0) {
      console.error(
        `public/pyodide/${version}/ 에 다른 파일 ${stale}개 (npm run pyodide:copy)`,
      );
      process.exit(1);
    }
    console.log(`public/pyodide/${version}/ 최신`);
    return;
  }
  // 예전 버전 폴더는 지운다 (버전 경로라 남아 있으면 배포 용량만 늘어남)
  if (existsSync(PUBLIC_ROOT)) {
    for (const entry of readdirSync(PUBLIC_ROOT)) {
      if (entry !== version)
        rmSync(join(PUBLIC_ROOT, entry), { recursive: true, force: true });
    }
  }
  const mb = (n) => (n / 1024 / 1024).toFixed(2);
  console.log(
    `pyodide ${version}: ${copied ? `${copied}개 복사` : '최신'} → public/pyodide/${version}/ ` +
      `(전송 파일 ${mb(raw)}MB, gzip ${mb(gz)}MB)`,
  );
}

main();
