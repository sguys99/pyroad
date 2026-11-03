/**
 * resvg 래스터화 비용이 어디서 나오는지: satori 출력 SVG에서 요소를 하나씩 빼고 다시 래스터화합니다.
 * 빌드/실행은 microbench.tsx 와 같습니다 (출력 mb-profile.mjs).
 */
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { initWasm, Resvg as ResvgWasm } from '@resvg/resvg-wasm';
import { renderCard } from './cards';
import { sampleCard } from './cards/samples';
import { loadFonts } from './lib/fonts';
import type { CardKind } from './cards/types';

// @vercel/og 와 같은 resvg-wasm 2.4.0 으로 잽니다 (네이티브는 비율만 비슷하고 절대값이 5~8배 작음)
const time = (svg: string, n = 4) => {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    new ResvgWasm(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
    xs.push(performance.now() - a);
  }
  return Math.min(...xs).toFixed(0);
};
void Resvg;

async function main() {
  await initWasm(readFileSync(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm')));
  for (const [kind, qs] of [['levelup', ''], ['stage', 'style=b']] as [CardKind, string][]) {
    const card = renderCard(sampleCard(kind, new URLSearchParams(qs)));
    const { fonts } = await loadFonts(card.families, 'ks');
    const svg = await satori(card.element, { width: 1200, height: 630, fonts: fonts as never });
    const filters = (svg.match(/<filter/g) ?? []).length;
    const images = (svg.match(/<image/g) ?? []).length;
    const noFilter = svg.replace(/ filter="url\([^)]*\)"/g, '');
    const noImage = svg.replace(/<image [^>]*\/>/g, '');
    // 배경 이미지(첫 <image>)만 제거
    const noBg = svg.replace(/<image [^>]*\/>/, '');
    // 캐릭터/장식 data URI 안의 SVG 필터 제거
    const innerNoFilter = svg.replace(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g, (_m, b64: string) => {
      const inner = Buffer.from(b64, 'base64').toString('utf-8').replace(/ filter="url\([^)]*\)"/g, '');
      return `data:image/svg+xml;base64,${Buffer.from(inner).toString('base64')}`;
    });
    // 장식 SVG를 미리 PNG로 래스터화해 넣으면? (실제로는 빌드 시 1회 생성해 정적 에셋으로 둠)
    const pre = svg.replace(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/g, (_m, b64: string) => {
      const png = new Resvg(Buffer.from(b64, 'base64').toString('utf-8'), { font: { loadSystemFonts: false } }).render().asPng();
      return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
    });
    console.log(`${kind}${qs ? `(${qs})` : ''}: filters=${filters} images=${images} svg=${(svg.length / 1024).toFixed(0)}KB`);
    console.log(`  전체 ${time(svg)}ms | satori 필터(box/text-shadow) 제거 ${time(noFilter)}ms | 이미지 내부 SVG 필터 제거 ${time(innerNoFilter)}ms | 배경 이미지 제거 ${time(noBg)}ms | 모든 <image> 제거 ${time(noImage)}ms | 장식 SVG→PNG 사전 래스터화 ${time(pre)}ms`);
  }
}
main();
