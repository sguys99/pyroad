// 축하 받은 편지함 (P6-13). 퀘스트 엔진이 축하 이벤트를 넣고, 축하 오버레이만 구독한다.
// React 상태로 두면 이벤트가 도착할 때·다 보여 주고 비울 때마다 퀘스트 셸 전체(이야기 쪽·공책·결과)가 다시 그려져
// 카드 등장과 같은 순간에 긴 작업이 생겼다(P0-13: 비용은 파티클이 아니라 셸 재렌더). 바깥 저장소로 빼서
// 구독하는 작은 컴포넌트(`QuestWorkspace`의 `CelebrationLayer`)만 다시 그린다 (§2.10).

import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';

export interface CelebrationStore {
  get(): CelebrationEvent[];
  /** 새로 받은 축하를 뒤에 붙인다 */
  push(events: CelebrationEvent[]): void;
  /** 앞에서부터 count개를 보여 줬다 */
  dismiss(count: number): void;
  subscribe(fn: () => void): () => void;
}

const EMPTY: CelebrationEvent[] = [];

export function createCelebrationStore(): CelebrationStore {
  let events = EMPTY;
  const subs = new Set<() => void>();
  const set = (next: CelebrationEvent[]) => {
    events = next.length ? next : EMPTY;
    subs.forEach((fn) => fn());
  };
  return {
    get: () => events,
    push: (more) => {
      if (more.length) set([...events, ...more]);
    },
    dismiss: (count) => {
      if (count > 0) set(events.slice(count));
    },
    subscribe: (fn) => {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
  };
}
