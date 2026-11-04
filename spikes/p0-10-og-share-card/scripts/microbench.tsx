/**
 * 프로세스 안에서 카드 렌더 단계를 나눠 잽니다 (HTTP·Next 서버 오버헤드 제외).
 *   satori(JSX → SVG) / resvg-wasm(@vercel/og 내장과 같은 2.4.0) / resvg-js(네이티브) / next/og ImageResponse 전체
 * 기계 부하에 흔들리지 않게 반복 후 최소값(min)과 중앙값(med)을 함께 봅니다.
 *
 * 실행 (스크래치 앱 루트에서):
 *   npm i --no-save satori@0.15.2 @resvg/resvg-js@2.6.2 @resvg/resvg-wasm@2.4.0 esbuild
 *   npx esbuild microbench.tsx --bundle --platform=node --format=esm --jsx=automatic \
 *     --external:satori --external:@resvg/* --external:next --outfile=mb.mjs && node mb.mjs
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { initWasm, Resvg as ResvgWasm } from '@resvg/resvg-wasm';
// next/og 의 ImageResponse 가 감싸는 @vercel/og (Node 빌드)
import { ImageResponse } from 'next/dist/compiled/@vercel/og/index.node.js';
import { renderCard } from './cards';
import { sampleCard } from './cards/samples';
import { loadFonts } from './lib/fonts';
import type { CardKind } from './cards/types';

const require = createRequire(import.meta.url);
const N = Number(process.env.N ?? 8);

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0], med: s[Math.floor(s.length / 2)] };
}
const fmt = (x: number) => x.toFixed(0).padStart(5);

async function main() {
  const t0 = performance.now();
  await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')));
  console.log(`resvg-wasm init ${(performance.now() - t0).toFixed(0)}ms`);

  const cases: [string, CardKind, string][] = [
    ['levelup(A)', 'levelup', ''],
    ['stage(B)', 'stage', 'style=b'],
    ['stage(A)', 'stage', 'style=a'],
    ['achievement(A)', 'achievement', ''],
    ['weekly(B)', 'weekly', ''],
  ];
  console.log(`case            | first: satori  wasm  native  ImageResponse | min/med x${N}: satori        wasm          native        ImageResponse  | svgKB pngKB(wasm/native)`);
  for (const [name, kind, qs] of cases) {
    const card = renderCard(sampleCard(kind, new URLSearchParams(qs)));
    const { fonts } = await loadFonts(card.families, 'ks');
    const opts = { width: 1200, height: 630, fonts: fonts as never };
    const run = async () => {
      const a = performance.now();
      const svg = await satori(card.element, opts);
      const b = performance.now();
      const rw = new ResvgWasm(svg, { fitTo: { mode: 'width', value: 1200 } });
      const b1 = performance.now();
      const img = rw.render();
      const b2 = performance.now();
      const pngW = img.asPng();
      const c = performance.now();
      phase.push([b1 - b, b2 - b1, c - b2]);
      // loadSystemFonts 기본값(true)은 생성자마다 시스템 폰트를 훑어 수백 ms가 듭니다. 카드 글자는 satori가 path로 바꾸므로 끕니다.
      const pngN = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: false } }).render().asPng();
      const d = performance.now();
      const ir = await new ImageResponse(card.element, { width: 1200, height: 630, fonts: fonts as never }).arrayBuffer();
      const e = performance.now();
      return { s: b - a, w: c - b, n: d - c, ir: e - d, svgKB: svg.length / 1024, pngW: pngW.length / 1024, pngN: pngN.length / 1024, irKB: ir.byteLength / 1024 };
    };
    const phase: number[][] = [];
    const first = await run();
    const rs = [];
    for (let i = 0; i < N; i++) rs.push(await run());
    const ph = phase.slice(1);
    const P = [0, 1, 2].map((k) => stats(ph.map((p) => p[k])).min.toFixed(0));
    const S = stats(rs.map((r) => r.s)), W = stats(rs.map((r) => r.w)), Nn = stats(rs.map((r) => r.n)), I = stats(rs.map((r) => r.ir));
    console.log(
      `${name.padEnd(15)} | ${fmt(first.s)} ${fmt(first.w)} ${fmt(first.n)} ${fmt(first.ir)}        | ${fmt(S.min)}/${fmt(S.med)}  ${fmt(W.min)}/${fmt(W.med)}  ${fmt(Nn.min)}/${fmt(Nn.med)}  ${fmt(I.min)}/${fmt(I.med)}  | ${first.svgKB.toFixed(0)} ${first.pngW.toFixed(0)}/${first.pngN.toFixed(0)} | wasm parse/render/png min ${P.join('/')}`,
    );
  }
  console.log(`rss ${(process.memoryUsage().rss / 1048576).toFixed(0)}MB`);
}

main();
