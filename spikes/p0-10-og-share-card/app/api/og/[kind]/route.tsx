/**
 * 공유 카드 이미지 (Node.js 런타임) — 스파이크용 측정 라우트.
 *   GET /api/og/levelup?nick=...&fonts=ks|ui|full|google|woff&fallback=0|1
 * Server-Timing 헤더로 단계별 시간(jsx 생성, 폰트 로드, satori+resvg 렌더)을 돌려줍니다.
 *
 * 실제 구현(P9-07)에서는 `/share/[cardId]/opengraph-image.tsx` 또는 `/api/share-cards/[cardId]/image`가
 * share_cards 행을 조회해 같은 카드 컴포넌트를 그립니다.
 */
import { ImageResponse } from 'next/og';
import { renderCard } from '@/cards';
import { sampleCard } from '@/cards/samples';
import type { CardKind } from '@/cards/types';
import { loadFonts, type FontStrategy } from '@/lib/fonts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KINDS: CardKind[] = ['levelup', 'stage', 'achievement', 'weekly'];
let served = 0;

export async function GET(req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as CardKind)) return new Response('not found', { status: 404 });
  const q = new URL(req.url).searchParams;
  const strategy = (q.get('fonts') ?? 'ks') as FontStrategy;
  const fallback = q.get('fallback') !== '0';

  const t0 = performance.now();
  const card = renderCard(sampleCard(kind as CardKind, q), { grain: q.get('grain') === '1' });
  const t1 = performance.now();
  const { fonts, bytes } = await loadFonts(card.families, strategy, { text: card.text, fallback, memo: q.get('memo') !== '0' });
  const t2 = performance.now();
  const img = new ImageResponse(card.element, { width: 1200, height: 630, fonts });
  const png = await img.arrayBuffer();
  const t3 = performance.now();
  served++;

  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      // 실제 구현: 카드 행이 바뀌지 않는 한 이미지도 바뀌지 않으므로 CDN에 길게 캐시 (§보고서 5.3)
      'cache-control': 'no-store',
      'server-timing': `jsx;dur=${(t1 - t0).toFixed(1)}, font;dur=${(t2 - t1).toFixed(1)}, render;dur=${(t3 - t2).toFixed(1)}`,
      'x-font-bytes': String(bytes),
      'x-png-bytes': String(png.byteLength),
      'x-rss-mb': (process.memoryUsage().rss / 1048576).toFixed(0),
      'x-served': String(served),
    },
  });
}
