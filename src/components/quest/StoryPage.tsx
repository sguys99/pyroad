'use client';

import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemStatic, type PybaemState } from '@/components/characters/rig';
import { Landmark } from '@/components/world/map/MapArt';
import { worldTint } from '@/lib/world/worldBook';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import '@/components/world/map/worldMap.css';

// 첫 화면은 서버에서 그린 정지 그림, 라이브 리그는 나중에 (rig.md 지연 로드, P6-16 번들 예산)
const PybaemRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.PybaemRig),
  {
    ssr: false,
    loading: () => <PybaemStatic state="idle" size={96} label="" />,
  },
);

export interface MissionItem {
  text: string;
  done: boolean;
  /** 지금 할 차례 (프로젝트 단계) */
  current?: boolean;
}

/**
 * "해 볼 일" 체크리스트 항목. 콘텐츠에 따로 나눈 목록이 없어(§12 결정 필요) 지금 있는 필드로 만든다:
 * 프로젝트는 단계 목표(steps[].step_goal), 코드 퀘스트는 과제 설명 + 기대 결과 안내(있으면). 통과하면 자동으로 체크
 */
export function missionItems(session: QuestSession): MissionItem[] {
  const sk = session.quest.prompt_skeleton;
  if (session.steps?.length) {
    return session.steps.map((s, i) => ({
      text: s.step_goal,
      done: session.isCompleted || i + 1 < session.currentStep,
      current: !session.isCompleted && i + 1 === session.currentStep,
    }));
  }
  const done = session.isCompleted || !!session.validation?.passed;
  return [sk.exercise_description, sk.expected_output_hint]
    .filter((t) => t?.trim())
    .map((text) => ({ text, done }));
}

/** 파이뱀 대사 + 자세. 성공·오류 연출은 P6-07·P6-08이 다듬는다 */
export function tutorLine(session: QuestSession): {
  state: PybaemState;
  text: string;
} {
  const { validation, runResult } = session;
  if (validation?.passed && session.isCompleted)
    return {
      state: 'cheer',
      text: '해냈어요! 해 볼 일을 모두 끝냈어요. 통과 도장 쾅!',
    };
  if (validation?.passed)
    return {
      state: 'happy',
      text: '이 단계 통과! 다음 해 볼 일로 넘어가 볼까요?',
    };
  if (runResult?.hadException)
    return {
      state: 'think',
      text: '괜찮아요, 버그는 고치라고 있는 거예요. 결과에 나온 단서를 같이 볼까요?',
    };
  if (validation)
    return {
      state: 'think',
      text: '돌아가긴 했는데 나온 글자가 조금 달라요. 해 볼 일을 다시 읽어 봐요!',
    };
  if (session.isCompleted)
    return {
      state: 'wave',
      text: '이미 통과한 퀘스트예요. 다시 풀어 보며 복습해 봐요!',
    };
  return {
    state: 'idle',
    text: session.steps?.length
      ? '한 단계씩 쌓아 가는 프로젝트예요! 해 볼 일을 위에서부터 차례로 해 봐요.'
      : '이야기를 읽고 해 볼 일을 확인해요. 공책에 주문을 써서 "코드 돌려보기"를 눌러 봐요!',
  };
}

interface StoryPageProps {
  session: QuestSession;
  /** 대사창 바로 아래 (모바일 "공책 펼치기") */
  action?: React.ReactNode;
  /** 그 아래 (힌트·황금키 줄 P6-09 + 튜터 대화, P6-10이 다시 그림) */
  children?: React.ReactNode;
}

/**
 * 책 펼침 왼쪽 쪽 "이야기" (P6-01, 최종 시안 Quest.tsx StoryPage):
 * 눈썹(N권 · 스테이지 · 퀘스트 번호) + 제목(Jua) + 스테이지 삽화 + 이야기 + "해 볼 일" 체크리스트 + 파이뱀 대사창.
 * 해 볼 일 카드는 서버에서 그린 그대로 보이는 첫 화면 큰 요소(LCP, P6-16) — 숨겼다 나타나는 연출을 걸지 않는다
 */
export function StoryPage({ session, action, children }: StoryPageProps) {
  const { quest } = session;
  const { stage } = quest;
  const sk = quest.prompt_skeleton;
  const no = stage.world?.no;
  const items = missionItems(session);
  const line = tutorLine(session);

  return (
    <article className="qs" aria-labelledby="quest-title">
      <p className="qs-kicker">
        {no ? `${no}권 · ` : ''}
        {stage.title} · 퀘스트 {stage.order}-{quest.order}
      </p>
      <h1 id="quest-title" className="qs-title font-display">
        {quest.title}
      </h1>

      <div className="wm qs-art" data-world={worldTint(no ?? 0)} aria-hidden>
        <svg viewBox="-200 -112 400 132" className="wm-art">
          <path
            className="wm-f wm-sage"
            d="M-640 -2 C-360 -18 -150 -24 -40 -6 S200 -28 640 -8 V40 H-640Z"
          />
          <Landmark theme={stage.theme_name} />
        </svg>
      </div>

      <p className="qs-story">{sk.story_context}</p>

      <section className="qs-task" aria-labelledby="quest-task">
        <h2 id="quest-task" className="qs-task-k">
          해 볼 일
        </h2>
        <ul className="qs-checks">
          {items.map((item, i) => (
            <li
              key={i}
              className="qs-check"
              data-done={item.done || undefined}
              data-current={item.current || undefined}
            >
              <span className="qs-box" aria-hidden>
                {item.done && <Check strokeWidth={3} />}
              </span>
              <span>
                {item.text}
                <span className="sr-only">
                  {item.done ? ' (완료)' : item.current ? ' (지금 할 일)' : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <DialogueBox
        className="qs-tutor"
        speaker="파이뱀"
        text={line.text}
        tone={line.state === 'cheer' ? 'good' : 'tutor'}
        data-testid="quest-dialogue"
        character={(speaking) => (
          <PybaemRig
            state={speaking && line.state === 'idle' ? 'talk' : line.state}
            talking={speaking}
            size={96}
            label=""
          />
        )}
      />

      {action}
      {children && <div className="qs-chat">{children}</div>}
    </article>
  );
}
