import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoggedInShell } from '@/components/providers/LoggedInShell';
import { loadOwnUserRow } from '@/lib/supabase/ownUserRow';
// 보호자 동의 띠·안내 스타일 (P3-15): 랜딩 CSS 예산 밖
import '@/components/consent/consent.css';
import { consentStatus } from '@/lib/consent/status';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import { ConsentBanner } from '@/components/consent/ConsentBanner';
import { RestReminder } from '@/components/rest/RestReminder';
import { isTestPagesEnabled } from '@/lib/env/testPages';

/**
 * 로그인 화면은 모두 요청마다 렌더한다: 페이지 CSP의 nonce를 서버 렌더 때 넣어야 하기 때문이다 (B27).
 * (설정·글쓰기처럼 서버 데이터가 없는 화면도 빌드 때 HTML로 굳히면 nonce가 없어 스크립트가 막힌다)
 */
export const dynamic = 'force-dynamic';

/** 로그인 화면은 검색에 내보내지 않는다 (P4-10). robots.txt도 같은 경로를 막는다(`src/lib/seo/site.ts`) */
export const metadata: Metadata = { robots: { index: false, follow: false } };

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
 * 보호자 동의 (P3-15): 만 14세 미만 + 동의 전이면 제한 모드. 상태는 같은 조회로 읽어 `ConsentProvider`로 넘기고(게시판 화면이
 * 글쓰기 자리를 안내로 바꿈), 맨 위 `ConsentBanner`가 안내·파기 7일 전 경고를 보인다. 실제로 막는 것은 게시판 API(`guardianWriteGate`).
 *
 * 휴식 알림 (P8-12): 모든 로그인 화면에 `RestReminder` 하나(클라이언트 타이머, 서버 저장 없음).
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
  // 보호자 동의 상태 (P3-15): 같은 조회 결과로. 모르면 null → 띠·안내 없음 (막는 것은 서버 API)
  const consent = row?.consent ? consentStatus(row.consent) : null;
  return (
    <LoggedInShell>
      <ConsentProvider status={consent}>
        <ConsentBanner />
        {children}
        {/* 휴식 알림 (P8-12): 탭이 보이는 연속 40분. e2e 빨리 감기는 테스트 페이지가 켜진 서버에서만 */}
        <RestReminder allowFastClock={isTestPagesEnabled()} />
      </ConsentProvider>
    </LoggedInShell>
  );
}
