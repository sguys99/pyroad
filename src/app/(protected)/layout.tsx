import { redirect } from 'next/navigation';
import { LoggedInShell } from '@/components/providers/LoggedInShell';
import { loadOwnUserRow } from '@/lib/supabase/ownUserRow';

/**
 * 로그인 화면은 모두 요청마다 렌더한다: 페이지 CSP의 nonce를 서버 렌더 때 넣어야 하기 때문이다 (B27).
 * (설정·글쓰기처럼 서버 데이터가 없는 화면도 빌드 때 HTML로 굳히면 nonce가 없어 스크립트가 막힌다)
 */
export const dynamic = 'force-dynamic';

/**
 * 인증 검증은 src/lib/supabase/middleware.ts에서 처리합니다.
 * 미들웨어가 미인증 사용자를 이미 리다이렉트하므로 여기서 중복 호출하지 않습니다.
 *
 * 온보딩 관문 (P3-11): 첫 로그인 온보딩(약관 동의·닉네임·파이뱀 색·학년)을 마치지 않은(`users.onboarded_at` NULL) 사용자는
 * 어떤 로그인 화면으로 와도 `/onboarding`으로 보낸다. 조회는 움직임·사운드 설정과 같은 한 번(`loadOwnUserRow`, React cache)이라
 * 요청마다 DB 호출이 늘지 않는다. 미들웨어에 두지 않은 이유: 미들웨어는 정적 파일 밖 모든 요청에서 돌아 그때마다 DB를 부르게 됨.
 * 값을 모르면(조회 실패·00023 미적용) 막지 않는다 — 관문은 안내이고, 저장 권한은 `/api/onboarding`이 따로 지킨다.
 * TODO(P3-12): 기존 사용자(닉네임이 이미 있거나 학습 기록이 있는 아이)는 지금은 새 사용자와 같이 온보딩 전체를 거친다.
 *   P3-12에서 "닉네임 확인 + 약관 동의"만 받는 짧은 흐름으로 나누고, 그 전까지 자리표시자 "모험가1234"로 표시한다.
 *
 * 로그인 화면 틀(`<main>`, 움직임·사운드 설정 동기화, 앱 웹폰트)은 `LoggedInShell` — `/onboarding`과 같이 쓴다.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const row = await loadOwnUserRow();
  if (row && row.onboardedAt === null) redirect('/onboarding');
  return <LoggedInShell>{children}</LoggedInShell>;
}
