/**
 * 공개 공유 페이지 (비로그인 열람). 카카오 스크랩 봇이 읽는 OG 메타를 만듭니다.
 * - og:image 는 같은 폴더의 opengraph-image.tsx 가 자동 생성 (1200×630)
 * - robots noindex: 아이 닉네임이 검색엔진에 쌓이지 않게
 * - og:url 은 이 페이지 자신 (카카오는 og:url이 다르면 그 주소를 다시 긁음)
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cardHeadline, getPublicCard } from '@/lib/demoCards';

type Props = { params: Promise<{ cardId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cardId } = await params;
  const row = await getPublicCard(cardId);
  if (!row) return { title: 'pyRoad', robots: { index: false, follow: false } };
  const title = cardHeadline(row.payload);
  const description = '파이뱀 선생님과 퀘스트를 깨며 파이썬을 배워요. 나도 해보기!';
  return {
    title: `${title} | pyRoad`,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `/share/${cardId}` },
    openGraph: { type: 'website', siteName: 'pyRoad', locale: 'ko_KR', url: `/share/${cardId}`, title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SharePage({ params }: Props) {
  const { cardId } = await params;
  const row = await getPublicCard(cardId);
  if (!row) notFound();
  return (
    <main style={{ maxWidth: 720, margin: '40px auto', padding: 16, fontFamily: 'sans-serif', textAlign: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/share/${cardId}/opengraph-image`} alt={cardHeadline(row.payload)} style={{ width: '100%', borderRadius: 16 }} />
      <h1 style={{ fontSize: 24 }}>{cardHeadline(row.payload)}</h1>
      <a href="/" style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 999, background: '#3FC48C', color: '#fff', fontWeight: 700 }}>나도 해보기</a>
    </main>
  );
}
