// 앱 화면 웹폰트·유틸리티 (app.css 머리 주석: 새 앱 화면 틀은 둘 다 import)
import '@/fonts/app.css';
import '@/app/app.css';
import type { Metadata } from 'next';

/** 관리자 화면 (P12-09). 요청마다 렌더(관리자 확인·CSP nonce), 검색에 내보내지 않음 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '운영 지표',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen bg-background">{children}</main>;
}
