// 에셋 검사 한 번에 (P2-16). CI `e2e-smoke` job이 Chromium을 설치한 뒤 돌린다 (docs/ci.md).
//
//   npm run assets:check                 # SVG·종이 결 타일·래스터·Lottie(구조 + 렌더)·라이선스 기록
//   npm run assets:check -- --no-render  # 브라우저 없이 (Lottie 렌더 검사만 뺌)
//
// 하나라도 실패하면 exit 1. 사운드는 따로: bash scripts/build-sounds.sh check (docs/design/sound.md)

import { runLottie } from './check-lottie.mjs';
import { runLicense } from './license.mjs';
import { runRaster } from './raster.mjs';
import { runSvg } from './svg.mjs';
import { runTextures } from './textures.mjs';

const render = !process.argv.includes('--no-render');
const steps = [
  ['SVG (public/**/*.svg)', () => runSvg({ check: true })],
  ['종이 결 타일 (public/textures)', () => runTextures({ check: true })],
  ['래스터 정지 그림 (raster.config)', () => runRaster({ check: true })],
  [
    `Lottie (public/animations${render ? ', 렌더 포함' : ', 구조만'})`,
    () => runLottie({ render }),
  ],
  ['라이선스 기록 (docs/assets-license.md, P2-17)', () => runLicense()],
];

let failed = 0;
for (const [name, run] of steps) {
  console.log(`\n▶ ${name}`);
  try {
    if (!(await run())) failed++;
  } catch (err) {
    failed++;
    console.error(`  ✗ ${err.message}`);
  }
}
console.log(
  failed ? `\n에셋 검사 실패 ${failed}/${steps.length}` : '\n에셋 검사 통과',
);
if (failed) process.exit(1);
