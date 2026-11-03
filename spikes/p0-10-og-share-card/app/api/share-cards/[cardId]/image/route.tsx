/**
 * 권장안: 공유 카드 이미지 전용 Route Handler (Node.js 런타임).
 *   GET /api/share-cards/{cardId}/image?v={version}
 *
 * - 카드 행(share_cards)을 id로 조회해 그립니다. 쿼리로 받은 문자열은 그리지 않습니다.
 * - 캐시: 브라우저·카카오 등 하위 캐시는 짧게, Vercel CDN은 길게 + 캐시 태그로 즉시 삭제 가능.
 *   비공개 전환/삭제(P9-11) 시 `dangerouslyDeleteByTag('share-card-{id}')`(@vercel/functions)로 CDN에서 지웁니다.
 * - ?v= 는 카드가 다시 그려질 때(아바타 변경, 템플릿 개편) og:image URL을 바꿔 카카오 썸네일 캐시를 우회하는 용도입니다.
 */
import { ImageResponse } from 'next/og';
import { renderCard } from '@/cards';
import { getPublicCard } from '@/lib/demoCards';
import { loadFonts } from '@/lib/fonts';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const tag = `share-card-${cardId}`;
  const row = await getPublicCard(cardId);
  if (!row) {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'public, max-age=60', 'Vercel-CDN-Cache-Control': 'public, max-age=300', 'Vercel-Cache-Tag': tag },
    });
  }
  const card = renderCard(row.payload);
  const { fonts } = await loadFonts(card.families, 'ks');
  const png = await new ImageResponse(card.element, { width: 1200, height: 630, fonts }).arrayBuffer();
  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=3600',
      'Vercel-CDN-Cache-Control': 'public, max-age=31536000',
      'Vercel-Cache-Tag': tag,
      'Content-Disposition': `inline; filename="pyroad-${row.payload.kind}.png"`,
      'X-Robots-Tag': 'noindex',
    },
  });
}
