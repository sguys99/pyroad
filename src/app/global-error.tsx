'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/observability/client';

/**
 * 루트 레이아웃까지 깨졌을 때 보이는 화면. 루트 레이아웃 대신 그려지므로 `<html>`·`<body>`를 직접 두고,
 * 전역 CSS가 없을 수 있어 스타일은 인라인으로 둔다.
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
          background: '#f7faf5',
          color: '#1f2937',
          fontFamily: 'system-ui, -apple-system, "Noto Sans KR", sans-serif',
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
                borderRadius: 12,
                background: '#1f7a2c',
                color: '#fff',
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
                borderRadius: 12,
                border: '2px solid #1f7a2c',
                color: '#1f7a2c',
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
