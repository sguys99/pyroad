import { useEffect } from 'react';

/**
 * 휴식 알림 미루기 (P8-12). 퀘스트 실행·채점처럼 끊으면 안 되는 동안 켜 두면, 알림 때가 와도 끝날 때까지 기다린다.
 * 화면 여러 곳이 동시에 켤 수 있어 수를 센다 (탭 하나 안의 값이라 모듈 변수로 충분)
 */
let holds = 0;

export function isRestHeld(): boolean {
  return holds > 0;
}

export function useRestHold(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    holds += 1;
    return () => {
      holds -= 1;
    };
  }, [active]);
}
