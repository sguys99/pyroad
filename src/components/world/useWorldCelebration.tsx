'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';

// 월드맵 위 축하 (P8-08 출석 상자·미션 레벨 업 공용): 띄울 때만 받는 지연 chunk (퀘스트 화면과 같은 오버레이·시퀀서).
// 스테이지 보물상자(P8-06)는 시트를 뒤로 가기로 닫는 흐름과 새로 고침 순서가 맞물려 있어 WorldMap 자체 코드를 그대로 둠
const QuestCelebrations = dynamic(
  () =>
    import('@/components/quest/QuestCelebrations').then(
      (m) => m.QuestCelebrations,
    ),
  { ssr: false },
);

/**
 * 월드맵에서 받은 보상 축하 (출석 7일째 상자·미션 받기로 오른 레벨 — `levelUpEvents`).
 * 시트 위에 대화 상자를 겹치지 않게 부르는 쪽이 시트를 먼저 닫고 `celebrate`. 카드를 닫으면 router.refresh()로
 * HUD 코인·XP·레벨이 그때 올라감(시트를 닫는 뒤로 가기와 겹치면 새로 받은 화면이 묻혀서). 빈 목록이면 아무것도 안 함
 */
export function useWorldCelebration() {
  const router = useRouter();
  const [events, setEvents] = useState<CelebrationEvent[]>([]);
  const layer =
    events.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <QuestCelebrations
            events={events}
            questId=""
            worldHref=""
            onDismiss={() => {
              setEvents([]);
              router.refresh();
            }}
          />,
          document.body,
        )
      : null;
  return { celebrate: setEvents, layer };
}
