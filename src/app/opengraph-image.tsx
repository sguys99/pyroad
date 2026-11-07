import { ImageResponse } from 'next/og';
import { OG_IMAGE_ALT } from '@/lib/seo/site';
import { loadShareCardFonts } from '@/lib/share-card/fonts';
import { SiteOgCard } from '@/lib/share-card/site';
import { CARD } from '@/lib/share-card/tokens';

/**
 * 사이트 공유 미리보기 그림 (P4-10). 공유 카드(P2-19)와 같은 틀·번들 폰트·리그 직렬화로 그린다(`src/lib/share-card/site.tsx`).
 *
 * **빌드 때 한 번 정적으로 만든다**: 요청 값(쿼리·쿠키·헤더)을 읽지 않고 `force-static`이라 Next가 PNG를 미리 만들어 둔다.
 * 폰트는 빌드 때 `src/fonts/share-card/`에서 읽으므로 런타임 함수·파일 추적이 필요 없다.
 * Next가 `og:image`(+ `twitter:image`)·크기·대체 글·형식을 메타에 붙이고 주소에 내용 해시를 달아 바뀌면 새 주소가 된다.
 */
export const dynamic = 'force-static';
export const runtime = 'nodejs';

export const alt = OG_IMAGE_ALT;
export const size = { width: CARD.width, height: CARD.height };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(<SiteOgCard />, {
    ...size,
    fonts: await loadShareCardFonts(),
  });
}
