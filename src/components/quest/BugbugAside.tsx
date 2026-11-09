'use client';

import dynamic from 'next/dynamic';
import {
  BugBugStatic,
  PybaemStatic,
  type BugBugState,
} from '@/components/characters/rig';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { bugbugTaunt, explainError } from '@/lib/quest/errorExplain';

const RIG_SIZE = 72;

// 버그버그는 오류가 났을 때만 그린다: 라이브 리그는 그때 불러오고, 그 사이는 같은 모습의 정지 그림 (rig.md 지연 로드)
const BugBugRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.BugBugRig),
  {
    ssr: false,
    loading: () => <BugBugStatic state="found" size={RIG_SIZE} label="" />,
  },
);

/**
 * 오류 쪽지 아래 버그버그 (P6-07, errorAside 자리): 빨간 경고 대신 장난꾸러기가 통통 뛰어 들어와 한마디.
 * 등장 = full: 옆에서 통통 뛰어 들어옴(`appear` → 자동 대기) · lite: 제자리 깜짝 점프 한 번(`found`) ·
 * minimal·동작 줄이기: 리그가 움직임 없이 표정·후광 색만(§12-Q26). 화면 밖·숨긴 탭에서는 리그가 스스로 멈춘다.
 * 쉬운 설명은 이야기 쪽 파이뱀 대사창이 하고, 이야기 쪽이 안 보이는 lg 미만에서만 여기 파이뱀 쪽지로 한 번 더 보여 준다.
 * 효과음 자리(P6-14): 등장 순간 `useSfx` 'bug' (지금은 세션이 결과를 받자마자 재생)
 */
export function BugbugAside({
  stderr,
  action,
}: {
  stderr: string;
  /** 설명 아래 "파이뱀에게 더 물어보기" (Q56: AI 피드백은 아이가 원할 때만) */
  action?: React.ReactNode;
}) {
  const { tier, reduced } = useMotionTier();
  const { line, text } = explainError(stderr);
  const state: BugBugState = !reduced && tier === 'full' ? 'appear' : 'found';
  return (
    <div className="qo-bug-aside" data-testid="bugbug-aside">
      <div className="qo-bug-row">
        <span
          className="qo-bug-rig"
          data-testid="bugbug-helper"
          data-rig-state={state}
        >
          <BugBugRig state={state} size={RIG_SIZE} label="" lookAt={false} />
        </span>
        <SpeechBubble
          speaker="버그버그"
          tone="bug"
          tail="left"
          className="qo-bug-bubble"
        >
          {bugbugTaunt(line)}
        </SpeechBubble>
      </div>
      <div className="qo-bug-row qo-bug-explain" data-testid="error-explain">
        <span className="qo-bug-rig qo-bug-rig-tutor">
          <PybaemStatic state="teach" size={56} label="" filters={false} />
        </span>
        <SpeechBubble speaker="파이뱀" tail="left" className="qo-bug-bubble">
          {text}
        </SpeechBubble>
      </div>
      {action}
    </div>
  );
}

/** 오류를 고친 다음 실행: 버그버그가 화해하고 잠깐 뒤 사라진다 (OutputPanel이 시간을 잰다) */
export function BugbugMakeup() {
  return (
    <div
      className="qo-bug-row qo-bug-bye"
      data-testid="bugbug-makeup"
      role="status"
    >
      <span className="qo-bug-rig">
        <BugBugRig state="makeup" size={RIG_SIZE} label="" lookAt={false} />
      </span>
      <SpeechBubble
        speaker="버그버그"
        tone="good"
        tail="left"
        className="qo-bug-bubble"
      >
        버그를 고쳤구나! 이번엔 내가 졌어. 우리 화해하자!
      </SpeechBubble>
    </div>
  );
}
