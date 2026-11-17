import { ImageResponse } from 'next/og';
import { renderShareCard, SHARE_CARD_FILENAME } from '@/lib/share-card/cards';
import { loadShareCardFonts } from '@/lib/share-card/fonts';
import {
  loadPublicShareCard,
  shareCardCacheHeaders,
  shareCardImagePath,
} from '@/lib/share-card/publicCard';
import { CARD } from '@/lib/share-card/tokens';

/**
 * 공유 카드 PNG (P9-07, §2.5, P0-10). 1200×630, `share_cards` 스냅샷만으로 그린다 — 그림에 쓰는 쿼리 문자열은 없다.
 *
 * - `?v=` 는 CDN 캐시 키라 지금 version 이 아니면 그리지 않고 제 주소로 보낸다(B106): 아무 값이나 붙여 CDN 을 건너뛰고
 *   장당 렌더 CPU 를 끝없이 쓰게 하는 길을 막음. 옛 version 주소(카카오 미리보기 등)도 새 그림으로 이어짐
 *
 * - **Node.js 런타임**(Edge 는 폰트·@vercel/og 로 함수 크기 한도 초과). 폰트는 `src/fonts/share-card/`를
 *   `next.config.ts` `outputFileTracingIncludes`로 이 함수에 번들(외부 네트워크 없음)
 * - 렌더가 장당 수백 ms CPU 라 CDN 캐시 필수: `shareCardCacheHeaders`(1년, 단 만료 시각까지) + 태그 `share-card-{id}`
 * - 없음·비공개·만료(90일, §12-Q67)는 404, 캐시하지 않음
 */
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const card = await loadPublicShareCard(id, { art: true });
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
  const canonical = shareCardImagePath(card.id, card.version);
  const url = new URL(request.url);
  if (url.search !== canonical.slice(canonical.indexOf('?')))
    return new Response(null, {
      status: 308,
      headers: { ...NO_STORE, Location: canonical },
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
