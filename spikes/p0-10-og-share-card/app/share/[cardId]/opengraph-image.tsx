/**
 * /share/[cardId] 의 og:image. Next가 <meta property="og:image" content=".../opengraph-image?<hash>">를 자동으로 넣습니다.
 * 카드 행을 조회해 같은 카드 컴포넌트를 그립니다 (Node.js 런타임, 번들 서브셋 폰트).
 */
import { ImageResponse } from 'next/og';
import { notFound } from 'next/navigation';
import { renderCard } from '@/cards';
import { getPublicCard } from '@/lib/demoCards';
import { loadFonts } from '@/lib/fonts';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'pyRoad 자랑하기 카드';

export default async function Image({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const row = await getPublicCard(cardId);
  if (!row) notFound();
  const card = renderCard(row.payload);
  const { fonts } = await loadFonts(card.families, 'ks');
  // 실험: Next 기본 헤더(public, immutable, max-age=31536000)를 덮어쓸 수 있는지 확인
  return new ImageResponse(card.element, {
    ...size,
    fonts,
    headers: { 'Cache-Control': 'public, max-age=3600', 'Vercel-CDN-Cache-Control': 'public, max-age=31536000', 'Vercel-Cache-Tag': `share-card-${cardId}` },
  });
}
