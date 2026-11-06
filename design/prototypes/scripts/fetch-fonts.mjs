// 프로토타입에 인라인할 폰트 원본을 .font-cache/에 준비한다 (폰트 바이너리는 커밋하지 않음).
//   node scripts/fetch-fonts.mjs
// - Pretendard Variable: npm `pretendard` 패키지(이 폴더 devDependency)에서 복사
// - D2Coding Regular: naver/d2codingfont GitHub 릴리스 zip (P0-14 download-fonts.sh와 같은 출처)
// Jua·Gaegu·Gowun Dodum은 Google Fonts <link>로 쓰므로 받지 않는다 (Artifact 페이지 계약).
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CACHE = join(ROOT, '.font-cache');
mkdirSync(CACHE, { recursive: true });

export const FONT_SOURCES = {
  pretendard: join(CACHE, 'PretendardVariable.ttf'),
  d2coding: join(CACHE, 'D2Coding-Regular.ttf'),
};

function findFile(dir, pred) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      const hit = findFile(p, pred);
      if (hit) return hit;
    } else if (pred(name, p)) return p;
  }
  return null;
}

export function ensureFonts() {
  if (!existsSync(FONT_SOURCES.pretendard)) {
    const src = join(ROOT, 'node_modules/pretendard/dist/public/variable/PretendardVariable.ttf');
    if (!existsSync(src)) throw new Error('npm install 먼저 실행하세요 (pretendard 패키지 없음)');
    copyFileSync(src, FONT_SOURCES.pretendard);
    console.log('  ✓ Pretendard Variable ← npm pretendard');
  }
  if (!existsSync(FONT_SOURCES.d2coding)) {
    const zip = join(CACHE, 'd2coding.zip');
    const url = 'https://github.com/naver/d2codingfont/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip';
    if (!existsSync(zip)) {
      console.log(`  ↓ ${url}`);
      execFileSync('curl', ['-fsSL', '--retry', '2', '--max-time', '300', '-o', zip, url], { stdio: 'inherit' });
    }
    const out = join(CACHE, 'd2coding-x');
    if (!existsSync(out)) execFileSync('python3', ['-I', '-m', 'zipfile', '-e', zip, out], { stdio: 'inherit' });
    // 리거처 없는 기본판 Regular (P0-14)
    const ttf = findFile(join(out), (n, p) => /^D2Coding-Ver[\d.]+-\d+\.ttf$/.test(n) && !p.includes('Ligature'));
    if (!ttf) throw new Error('D2Coding Regular TTF를 zip에서 찾지 못함');
    copyFileSync(ttf, FONT_SOURCES.d2coding);
    console.log('  ✓ D2Coding Regular ← GitHub 릴리스');
  }
  return FONT_SOURCES;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ensureFonts();
  console.log(`fonts ready → ${CACHE}`);
}
