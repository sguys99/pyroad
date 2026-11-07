'use client';

import { usePathname } from 'next/navigation';
import { HeartHandshake, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useConsentStatus } from './ConsentProvider';
import { GUARDIAN_CONSENT_HREF } from './RestrictedNotice';

/**
 * 보호자 동의 띠 (P3-15, §12-Q36). 로그인 화면 맨 위 한 줄.
 * - 동의 전(제한 모드): 월드맵·게시판·프로필에서 조용한 안내 "공부는 마음껏, 게시판 글쓰기는 보호자 동의 뒤에"
 * - 파기 7일 전부터: 퀘스트 화면을 뺀 모든 화면에서 금색 경고 "보호자 동의가 N일 남았어요"
 * 퀘스트 화면에는 띠를 넣지 않는다(문제 풀이 화면 높이를 지키고 집중을 깨지 않게). 소리·움직임 없음.
 */
const QUIET_PATHS = ['/world', '/board', '/profile'];

export function ConsentBanner({
  force = false,
}: {
  /** 경로와 상관없이 그림 (카탈로그) */
  force?: boolean;
} = {}) {
  const status = useConsentStatus();
  const pathname = usePathname() ?? '';
  if (status?.state !== 'pending') return null;
  const warn = status.warn && status.daysLeft !== null;
  if (!force) {
    if (pathname.startsWith('/quest')) return null;
    if (!warn && !QUIET_PATHS.some((p) => pathname.startsWith(p))) return null;
  }

  return (
    <div
      className="cs-banner"
      data-tone={warn ? 'warn' : 'quiet'}
      role={warn ? 'status' : undefined}
      data-testid="consent-banner"
    >
      <div className="cs-banner-inner">
        <span className="cs-banner-icon" aria-hidden>
          {warn ? <TriangleAlert /> : <HeartHandshake />}
        </span>
        <p className="cs-banner-text">
          {warn ? (
            status.daysLeft === 0 ? (
              <>
                <strong>오늘까지</strong> 보호자 동의가 필요해요. 지나면 계정이
                지워져요.
              </>
            ) : (
              <>
                보호자 동의가 <strong>{status.daysLeft}일</strong> 남았어요.
                지나면 계정이 지워져요.
              </>
            )
          ) : (
            <>공부는 마음껏! 게시판 글쓰기는 보호자 동의 뒤에 해요.</>
          )}
        </p>
        <Link
          href={GUARDIAN_CONSENT_HREF}
          className="cs-banner-link focus-ring"
          data-testid="consent-banner-link"
        >
          보호자 동의하기
        </Link>
      </div>
    </div>
  );
}
