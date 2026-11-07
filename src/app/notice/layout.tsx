// 공지(비로그인 열람)도 앱 화면 웹폰트를 쓴다 (P2-10). 랜딩에는 싣지 않으려고 루트가 아닌 여기서 import
import '@/fonts/app.css';
import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';

/** 공지는 로그인 없이 보는 공개 페이지 (P4-10: 제목 "공지사항 - pyRoad", sitemap에 목록만) */
export const metadata: Metadata = publicPageMetadata({
  title: '공지사항',
  description: 'pyRoad의 새 소식과 안내를 모아 둔 곳이에요.',
});

export default function NoticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
