// 실행 중 stdout을 화면에 흘려 보여 주는 작은 저장소 (P1-09, §2.9 stdout 스트리밍).
//
// Worker는 출력을 묶어서 자주 보내므로, 이 값을 퀘스트 셸의 state로 두면 조각마다 셸 전체
// (대화 패널·에디터·상태바)가 다시 그려진다. 출력창만 useSyncExternalStore로 구독해서
// 다시 그리는 범위를 출력창 하나로 줄인다.

import { MAX_OUTPUT_LENGTH } from './constants';

export interface LiveOutputSnapshot {
  /** 지금까지 받은 출력 (화면 상한 MAX_OUTPUT_LENGTH까지만) */
  text: string;
  /** 상한을 넘어 뒷부분을 버렸는지 */
  clipped: boolean;
}

export interface LiveOutputStore {
  append(chunk: string): void;
  reset(): void;
  getSnapshot(): LiveOutputSnapshot;
  subscribe(listener: () => void): () => void;
}

const EMPTY: LiveOutputSnapshot = { text: '', clipped: false };

/**
 * 실행 중 출력 저장소. 상한을 넘으면 앞부분만 남긴다
 * (실행이 끝난 뒤 결과도 `truncateOutput`으로 앞부분 MAX_OUTPUT_LENGTH자를 보여 주므로 같은 모양)
 */
export function createLiveOutputStore(
  limit: number = MAX_OUTPUT_LENGTH,
): LiveOutputStore {
  let snapshot = EMPTY;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    append(chunk) {
      if (!chunk || snapshot.clipped) return;
      const next = snapshot.text + chunk;
      snapshot =
        next.length > limit
          ? { text: next.slice(0, limit), clipped: true }
          : { text: next, clipped: false };
      emit();
    },
    reset() {
      if (snapshot === EMPTY) return;
      snapshot = EMPTY;
      emit();
    },
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
