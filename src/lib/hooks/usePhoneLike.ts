import { useSyncExternalStore } from 'react';

/**
 * 코드 입력이 불편한 기기: 좁은 화면(lg 1024px 미만) 또는 터치 화면. 코드 키보드(P6-04, `CodePanel`)와
 * 폰 퀴즈 추천(P7-11, 월드맵·스테이지 시트·코드 퀘스트 쪽지)이 같은 판정을 쓴다. CSS 자리 잡기는 questWorkspace.css 같은 조건
 */
export const PHONE_QUERY = '(max-width: 63.99rem), (pointer: coarse)';

// matchMedia가 없는 환경(jsdom)은 넓은 화면으로 본다
function subscribe(onChange: () => void) {
  const mq = window.matchMedia?.(PHONE_QUERY);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

/** 서버 렌더·첫 하이드레이션은 false (넓은 화면 모양으로 시작) */
export function usePhoneLike(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(PHONE_QUERY).matches ?? false,
    () => false,
  );
}
