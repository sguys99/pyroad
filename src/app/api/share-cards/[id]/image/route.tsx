import { ImageResponse } from 'next/og';
import { renderShareCard, SHARE_CARD_FILENAME } from '@/lib/share-card/cards';
import { loadShareCardFonts } from '@/lib/share-card/fonts';
import {
  loadPublicShareCard,
  shareCardCacheHeaders,
} from '@/lib/share-card/publicCard';
import { CARD } from '@/lib/share-card/tokens';

/**
 * 공유 카드 PNG (P9-07, §2.5, P0-10). 1200×630, `share_cards` 스냅샷만으로 그린다 — 쿼리 문자열(`?v=`)은 캐시 키일 뿐 읽지 않음.
 *
 * - **Node.js 런타임**(Edge 는 폰트·@vercel/og 로 함수 크기 한도 초과). 폰트는 `src/fonts/share-card/`를
 *   `next.config.ts` `outputFileTracingIncludes`로 이 함수에 번들(외부 네트워크 없음)
 * - 렌더가 장당 수백 ms CPU 라 CDN 캐시 필수: `shareCardCacheHeaders`(1년, 단 만료 시각까지) + 태그 `share-card-{id}`
 * - 없음·비공개·만료(90일, §12-Q67)는 404, 캐시하지 않음
 */
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const card = await loadPublicShareCard(id);
  if (card === 'error')
    return new Response('잠시 뒤에 다시 열어 주세요.', {
      status: 503,
      headers: NO_STORE,
    });
  if (!card)
    return new Response('카드를 찾을 수 없어요.', {
      status: 404,
      headers: NO_STORE,
    });

  return new ImageResponse(renderShareCard(card.data), {
    ...CARD,
    fonts: await loadShareCardFonts(),
    headers: {
      ...shareCardCacheHeaders(card.id, card.expiresAt),
      'Content-Disposition': `inline; filename="${SHARE_CARD_FILENAME[card.data.kind]}"`,
      'X-Robots-Tag': 'noindex',
    },
  });
}
