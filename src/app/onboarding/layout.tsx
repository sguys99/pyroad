import type { Metadata } from 'next';
import { LoggedInShell } from '@/components/providers/LoggedInShell';
// 온보딩 전용 스타일: 랜딩 렌더 차단 CSS 예산(§2.10)에 넣지 않으려고 globals.css 대신 여기서
import '@/components/onboarding/onboarding.css';

export const metadata: Metadata = {
  title: '모험가 등록',
  robots: { index: false, follow: false },
};

/**
 * 첫 로그인 온보딩 (P3-11)·튜토리얼 다시 보기. `(protected)` 밖에 둔다: 그 레이아웃이 온보딩 전 사용자를 이리로 보내므로
 * 안에 두면 리다이렉트가 돈다. 로그인 확인은 미들웨어(보호 경로 `/onboarding`)와 페이지가 한다.
 * 요청마다 렌더: 페이지 CSP nonce (B27). 틀(`<main>`, 움직임·사운드 설정, 앱 웹폰트)은 로그인 화면과 같은 `LoggedInShell`.
 */
export const dynamic = 'force-dynamic';

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LoggedInShell>{children}</LoggedInShell>;
}
