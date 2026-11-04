/**
 * 같은 카드를 Edge 런타임으로 (비교용). fs가 없으므로 폰트는 `new URL(..., import.meta.url)` + fetch로
 * 번들 에셋에서 읽습니다. A안 카드(Jua + Pretendard)만 지원합니다.
 */
import { ImageResponse } from 'next/og';
import { renderCard } from '@/cards';
import { sampleCard } from '@/cards/samples';
import type { CardKind } from '@/cards/types';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type EdgeFont = { name: string; data: ArrayBuffer; weight: 400 | 700 | 800; style: 'normal' };
// 같은 배열 객체를 재사용해야 satori의 폰트 파싱 캐시(WeakMap)가 맞습니다
let fontsPromise: Promise<EdgeFont[]> | null = null;
function edgeFonts() {
  fontsPromise ??= Promise.all([
    fetch(new URL('../../../../assets/fonts/Jua.ks2350.ttf', import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL('../../../../assets/fonts/Pretendard-Bold.ks2350.otf', import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL('../../../../assets/fonts/Pretendard-ExtraBold.ks2350.otf', import.meta.url)).then((r) => r.arrayBuffer()),
  ]).then(([jua, p700, p800]) => [
    { name: 'Jua', data: jua, weight: 400, style: 'normal' },
    { name: 'Pretendard', data: p700, weight: 700, style: 'normal' },
    { name: 'Pretendard', data: p800, weight: 800, style: 'normal' },
  ]);
  return fontsPromise;
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== 'levelup' && kind !== 'achievement' && kind !== 'stage') return new Response('not found', { status: 404 });
  const q = new URL(req.url).searchParams;
  q.set('style', 'a');
  const t0 = performance.now();
  const card = renderCard(sampleCard(kind as CardKind, q));
  const t1 = performance.now();
  const fonts = await edgeFonts();
  const t2 = performance.now();
  const img = new ImageResponse(card.element, {
    width: 1200,
    height: 630,
    fonts,
  });
  const png = await img.arrayBuffer();
  const t3 = performance.now();
  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-store',
      'server-timing': `jsx;dur=${(t1 - t0).toFixed(1)}, font;dur=${(t2 - t1).toFixed(1)}, render;dur=${(t3 - t2).toFixed(1)}`,
      'x-png-bytes': String(png.byteLength),
    },
  });
}
