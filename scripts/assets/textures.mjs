// 종이 결 타일 → public/textures/<id>.v<N>.png (P2-16). 정의는 lib/textures.mjs의 TEXTURES.
//
//   npm run assets:textures            # 없는 타일만 만든다 (있는 파일을 다른 그림으로 덮어쓰지 않음)
//   npm run assets:textures -- --check # 파일이 정의와 같은 그림인지·예산·남은 파일 확인 (다르면 exit 1)
//
// `/textures/*`는 1년 immutable 캐시라서 그림을 바꾸려면 TEXTURES의 version을 올리고, 옛 파일은 한 릴리즈 뒤에 지운다.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { decodePalettePng, encodePalettePng } from './lib/png.mjs';
import {
  TEXTURES,
  TEXTURE_MAX_BYTES,
  renderTexture,
  sameImage,
  textureFileName,
} from './lib/textures.mjs';
import {
  ROOT,
  VERSIONED_NAME,
  isMain,
  kb,
  listFiles,
  rel,
} from './lib/fsutil.mjs';
import { rasterTextureOutputs } from './raster.mjs';

export const TEXTURE_DIR = join(ROOT, 'public/textures');

/** @returns {boolean} 통과 여부 */
export function runTextures({
  check = false,
  dir = TEXTURE_DIR,
  rasterOutputs = rasterTextureOutputs(),
} = {}) {
  let ok = true;
  const fail = (msg) => {
    ok = false;
    console.error(`  ✗ ${msg}`);
  };
  if (!check) mkdirSync(dir, { recursive: true });
  const expected = new Set();
  for (const def of TEXTURES) {
    const name = textureFileName(def);
    expected.add(name);
    const dest = join(dir, name);
    const img = renderTexture(def);
    if (existsSync(dest)) {
      const buf = readFileSync(dest);
      let same = false;
      try {
        same = sameImage(decodePalettePng(buf), img);
      } catch {
        same = false;
      }
      if (!same) {
        fail(
          `${rel(dest)}: 정의(TEXTURES)와 다른 그림이에요. 같은 이름을 덮어쓰지 말고 version을 올리세요 (immutable 캐시)`,
        );
      } else if (buf.length > TEXTURE_MAX_BYTES) {
        fail(`${rel(dest)}: ${kb(buf.length)} > 예산 ${kb(TEXTURE_MAX_BYTES)}`);
      } else {
        console.log(`  = ${rel(dest)} (${kb(buf.length)})`);
      }
      continue;
    }
    if (check) {
      fail(`${rel(dest)}이 없어요. npm run assets:textures 로 만드세요`);
      continue;
    }
    const png = encodePalettePng(img);
    if (png.length > TEXTURE_MAX_BYTES) {
      fail(
        `${name}: ${kb(png.length)} > 예산 ${kb(TEXTURE_MAX_BYTES)} (단계 수·크기를 줄이세요)`,
      );
      continue;
    }
    writeFileSync(dest, png);
    console.log(
      `  + ${rel(dest)} (${kb(png.length)}, ${def.size}px, ${def.levels}단계)`,
    );
  }
  // 정의에 없는 파일: 옛 버전이면 경고(한 릴리즈 뒤 지우기), 래스터 texture 항목의 출력이면 통과, 아니면 실패
  for (const file of listFiles(dir)) {
    const name = basename(file);
    if (expected.has(name) || rasterOutputs.includes(name)) continue;
    const id = name.replace(/\.v\d+\.png$/, '');
    if (VERSIONED_NAME.test(name) && TEXTURES.some((d) => d.id === id)) {
      console.warn(
        `  ! ${rel(file)}: 옛 버전이에요. 배포된 적이 있으면 한 릴리즈 뒤에 지우세요`,
      );
    } else {
      fail(`${rel(file)}: TEXTURES에 없는 파일이에요 (생성물만 두는 폴더)`);
    }
  }
  return ok;
}

if (isMain(import.meta.url)) {
  const check = process.argv.includes('--check');
  console.log(`종이 결 타일${check ? ' 확인' : ''} (public/textures)`);
  if (!runTextures({ check })) process.exit(1);
}
