'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  RestReminderDialog,
  type RestPhase,
} from '@/components/rest/RestReminderDialog';
import { REST_MS } from '@/lib/rest/restTimer';
import { Demo, Section } from './ui';

/** 견본 카운트다운 길이: 5분을 기다리지 않게 10초로 당김 */
const DEMO_REST_MS = 10_000;

/** 휴식 알림 (P8-12): 40분을 기다리지 않고 단계별로 띄워 보는 견본. 고르면 실제와 같은 다음 단계로 넘어감 */
export function RestSection() {
  const [phase, setPhase] = useState<RestPhase | null>(null);
  const [restMs, setRestMs] = useState(DEMO_REST_MS);
  const [endsAt, setEndsAt] = useState(0);
  const startRest = (ms: number) => {
    setRestMs(ms);
    setEndsAt(Date.now() + ms);
    setPhase('rest');
  };
  return (
    <Section
      id="rest"
      kicker="건강한 재미 (P8-12)"
      title="휴식 알림"
      description="로그인 화면 어디서든 탭이 보이는 연속 40분이면 파이뱀이 쉬자고 권해요(막지 않음). 10분 넘게 탭을 숨기거나 입력이 없으면 처음부터. 퀘스트 실행·채점 중이나 다른 대화 상자가 떠 있으면 끝날 때까지 미룸. '조금만 더'는 20분 뒤 다시. 서버 저장 없이 탭 세션(sessionStorage)."
    >
      <Demo
        label="시간 당겨 띄우기"
        note="권유(파이뱀 뿌듯 + 눈·기지개·물 제안, '5분 쉬기'에 첫 초점, Esc·덮개 = 조금만 더) → 쉬는 중(파이뱀 잠, 남은 시간·진행바, 견본은 10초) → 다 쉬었어요(응원). 등장은 공통 모달 연출(full 떠오름 · lite 짧게 · minimal 페이드 · 동작 줄이기 즉시), 효과음은 대사 블립을 작게"
        data-testid="rest-demo"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPhase('ask')}
            data-testid="rest-demo-ask"
          >
            40분 됨 (권유)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startRest(DEMO_REST_MS)}
          >
            쉬는 중 (10초)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startRest(REST_MS)}
          >
            쉬는 중 (실제 5분)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPhase('back')}
          >
            다 쉬었어요
          </Button>
        </div>
        <RestReminderDialog
          phase={phase}
          restEndsAt={endsAt}
          restMs={restMs}
          onRest={() => startRest(DEMO_REST_MS)}
          onMore={() => setPhase(null)}
          onRestEnd={() => setPhase('back')}
          onClose={() => setPhase(null)}
        />
      </Demo>
    </Section>
  );
}
