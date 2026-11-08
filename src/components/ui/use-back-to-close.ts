'use client';

import { useEffect, useRef } from 'react';

/** 열린 겹창이 쌓은 기록 항목 표시 (`history.state`의 키) */
export const OVERLAY_HISTORY_KEY = '__pyroadOverlay';

let seq = 0;

function overlayKeyOf(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const v = (state as Record<string, unknown>)[OVERLAY_HISTORY_KEY];
  return typeof v === 'string' ? v : null;
}

/**
 * 뒤로 가기로 겹창(시트·모달) 닫기 (P4-09). 모바일에서 아이들은 시트를 닫으려고 기기 뒤로 가기를 누른다:
 * 그대로 두면 랜딩을 떠나 버린다(이전 사이트·빈 탭).
 *
 * - 열리면 같은 주소로 기록 항목을 하나 쌓는다(`history.state`에 표시 키). 지금 상태(Next.js 라우터 내부 값)를 그대로
 *   복사하므로 라우터는 같은 화면으로 본다
 * - 뒤로 가기(`popstate`)로 그 항목을 벗어나면 `close()`를 부른다 → 겹창이 닫히고 주소·화면은 그대로
 * - 닫기 버튼·Esc·덮개로 닫으면 쌓은 항목을 `history.back()`으로 거둔다(뒤로 가기를 한 번 더 눌러야 떠나는 일이 없게)
 * - 쌓기는 다음 틱에: 개발 모드 StrictMode의 "마운트 → 정리 → 마운트"에서 두 번 쌓고 한 번 거두는 일을 막는다
 * - 기록 API를 못 쓰면(샌드박스 등) 아무것도 하지 않는다. 닫기·Esc는 원래대로 동작
 */
export function useBackToClose(
  open: boolean,
  close: () => void,
  enabled = true,
) {
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open || !enabled || typeof window === 'undefined') return;
    const key = `o${++seq}-${Date.now().toString(36)}`;
    let pushed = false;

    const onPop = () => {
      if (!pushed) return;
      // 앞으로 가기로 다시 이 항목에 왔으면 그대로 둔다
      if (overlayKeyOf(window.history.state) === key) return;
      pushed = false;
      closeRef.current();
    };

    const timer = window.setTimeout(() => {
      try {
        const state = window.history.state;
        window.history.pushState(
          {
            ...(state && typeof state === 'object' ? state : {}),
            [OVERLAY_HISTORY_KEY]: key,
          },
          '',
          window.location.href,
        );
        pushed = true;
        window.addEventListener('popstate', onPop);
      } catch {
        // 기록을 못 쌓아도 겹창은 그대로 쓸 수 있다
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      // 다른 방법(닫기·Esc·덮개)으로 닫혔고 쌓은 항목이 아직 맨 위면 거둔다
      if (pushed && overlayKeyOf(window.history.state) === key) {
        try {
          window.history.back();
        } catch {
          // 무시
        }
      }
    };
  }, [open, enabled]);
}
