import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ShareCardView } from '@/components/share/ShareCardView';
import {
  loadPublicShareCard,
  shareCardImagePath,
} from '@/lib/share-card/publicCard';
import { shareCardSummary } from '@/lib/share-card/summary';
import { SITE_NAME } from '@/lib/seo/site';

/**
 * 공유 페이지 (P9-08, P0-10). 카카오톡 등으로 링크를 받은 보호자·친구가 로그인 없이 연다.
 *
 * - 공개 조회는 `loadPublicShareCard`(service_role `share_card_public`: 공개·만료 전만, user_id 없음)뿐
 * - 그리는 글자·메타는 카드 스냅샷에서만 — 쿼리 문자열은 읽지 않는다(searchParams 를 받지 않음)
 * - `robots: noindex`(링크를 받은 사람만 보는 곳), og:image = 카드 PNG(`?v=version`, 카드가 바뀌면 카카오 썸네일도 새로),
 *   og:url = 이 페이지
 * - 요청마다 렌더(DB 조회 + CSP nonce). 미들웨어는 이 경로에서 세션 갱신을 건너뛴다(`src/middleware.ts`)
 * - 없음·비공개·만료 → `not-found.tsx`(404), 조회 실패 → 던져서 오류 화면(500, 미리보기 수집기가 빈 카드를 캐시하지 않게)
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ cardId: string }> };

// generateMetadata 와 페이지가 같은 요청에서 한 번만 조회
const loadCard = cache(async (id: string) => {
  const card = await loadPublicShareCard(id);
  if (card === 'error') throw new Error('share card unavailable');
  return card;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cardId } = await params;
  const card = await loadCard(cardId);
  if (!card) return { robots: { index: false, follow: false } };
  const { headline, alt } = shareCardSummary(card.data);
  const url = `/share/${card.id}`;
  const image = {
    url: shareCardImagePath(card.id, card.version),
    width: 1200,
    height: 630,
    alt,
  };
  const description = '파이뱀과 함께 파이썬 모험 중! 박수를 보내 주세요.';
  return {
    title: headline,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: 'ko_KR',
      title: headline,
      description,
      url,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title: headline,
      description,
      images: [image],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { cardId } = await params;
  const card = await loadCard(cardId);
  if (!card) notFound();
  const { headline, alt } = shareCardSummary(card.data);
  return (
    <ShareCardView
      kind={card.data.kind}
      headline={headline}
      alt={alt}
      imageSrc={shareCardImagePath(card.id, card.version)}
    />
  );
}
