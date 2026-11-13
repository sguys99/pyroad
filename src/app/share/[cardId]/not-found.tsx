import type { Metadata } from 'next';
import { ShareGoneView } from '@/components/share/ShareCardView';

export const metadata: Metadata = {
  title: '볼 수 없는 카드',
  robots: { index: false, follow: false },
};

/** 없음·비공개·만료 공유 카드 (P9-08). 404 상태, 아이 정보 없이 안내 + "나도 해보기" */
export default function ShareNotFound() {
  return <ShareGoneView />;
}
