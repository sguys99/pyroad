'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';
import { COLOR, LINE, RADIUS, SYSTEM_FONT_STACK } from '@/lib/design/tokens';

/**
 * 루트 레이아웃까지 깨졌을 때 보이는 화면. 루트 레이아웃 대신 그려지므로 `<html>`·`<body>`를 직접 두고,
 * 전역 CSS가 없을 수 있어 스타일은 인라인으로 두고, 값은 디자인 토큰 원본(TS)에서 가져온다 (P2-09). 웹폰트도 없을 수 있어 시스템 글꼴
 * 에러는 Sentry로 보고한다 (P1-16, DSN이 없으면 보고하지 않음).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error, {
      tags: { area: 'global-error' },
      ...(error.digest && { extra: { digest: error.digest } }),
    });
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: COLOR.bg,
          color: COLOR.text,
          fontFamily: SYSTEM_FONT_STACK,
        }}
      >
        <main style={{ maxWidth: 360, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>
            앗, 문제가 생겼어요
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: '0 0 24px' }}>
            잠깐 길을 잃었어요. 다시 해 볼까요?
          </p>
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                padding: '0 20px',
                border: 'none',
                borderRadius: RADIUS.m,
                background: COLOR.primary,
                color: COLOR.onPrimary,
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              다시 해 보기
            </button>
            {/* 루트 레이아웃이 깨진 상태라 클라이언트 라우터 대신 전체 새로고침으로 이동한다 */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0 20px',
                borderRadius: RADIUS.m,
                border: `${LINE.ui}px solid ${COLOR.lineStrong}`,
                background: COLOR.surface,
                color: COLOR.text,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              처음으로
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
