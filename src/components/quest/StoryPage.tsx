'use client';

import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemStatic, type PybaemState } from '@/components/characters/rig';
import { Landmark } from '@/components/world/map/MapArt';
import { worldTint } from '@/lib/world/worldBook';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { explainError } from '@/lib/quest/errorExplain';
import { HAPPY_MS, useThinkBeat } from './useThinkBeat';
import '@/components/world/map/worldMap.css';

// 첫 화면은 서버에서 그린 정지 그림, 라이브 리그는 나중에 (rig.md 지연 로드, P6-16 번들 예산)
export const PybaemRig = dynamic(
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
  /** 프로젝트 단계 번호 (상자에 번호) */
  step?: number;
  /** 방금 통과한 단계 ("다음 단계" 박자 동안 체크가 톡 찍힘, P6-12) */
  fresh?: boolean;
  /** 지금 단계의 해 볼 일 (프로젝트 단계 checklist, P7-17) */
  sub?: string[];
}

/**
 * "해 볼 일" 체크리스트 항목 (P7-17 콘텐츠 checklist): 코드 퀘스트는 prompt.checklist,
 * 프로젝트는 단계 목표(steps[].step_goal) 목록 + 지금 단계 아래에 그 단계의 checklist. 통과하면 자동으로 체크.
 * checklist 가 없는 예전 행이면 과제 설명 + 기대 결과 안내로 (콘텐츠 빌드 전 배포 사이)
 */
export function missionItems(session: QuestSession): MissionItem[] {
  const sk = session.quest.prompt_skeleton;
  if (session.steps?.length) {
    // "다음 단계" 박자 동안은 통과한 단계를 체크하고 다음 단계를 지금 할 일로 (공책 쪽 StepStrip과 같은 셈)
    const cleared = session.stepCleared;
    const shown = cleared ? cleared + 1 : session.currentStep;
    return session.steps.map((s, i) => ({
      text: s.step_goal,
      step: i + 1,
      done: session.isCompleted || i + 1 < shown,
      current: !session.isCompleted && i + 1 === shown,
      fresh: i + 1 === cleared,
      sub: i + 1 === shown && !session.isCompleted ? s.checklist : undefined,
    }));
  }
  const done = session.isCompleted || !!session.validation?.passed;
  return (sk.checklist ?? [sk.exercise_description, sk.expected_output_hint])
    .filter((t) => t?.trim())
    .map((text) => ({ text, done }));
}

/**
 * 파이뱀 대사 + 자세. 성공 = 응원(`cheer`, 처음엔 기쁨 점프 `happy`, P6-08). 실패 세 경우를 다르게 (P6-07):
 * 오류 = 버그버그가 결과 쪽지에 나타나고 파이뱀은 생각(`think`) → 설명(`teach` + 말하기)으로 쉬운 설명 ·
 * 출력이 다름 = 버그버그 없이 갸우뚱(`confused`) 격려 · 시간 초과 = 차분한 격려(`encourage`)
 */
export function tutorLine(session: QuestSession): {
  state: PybaemState;
  text: string;
} {
  const { validation, runResult } = session;
  // 성공 (P6-08): 응원 자세. 처음 잠깐은 StoryPage가 기쁨 점프(`happy`)로 바꿔 보여 줌 (useThinkBeat + HAPPY_MS)
  if (validation?.passed && (session.isCompleted || !session.steps?.length))
    return {
      state: 'cheer',
      text:
        session.completion === 'review'
          ? '복습 완료! 예전에 배운 주문을 잘 기억하고 있네요. 통과 도장 쾅!'
          : session.steps?.length
            ? '해냈어요! 해 볼 일을 모두 끝냈어요. 통과 도장 쾅!'
            : '해냈어요! 나온 글자가 해 볼 일과 딱 맞아요. 통과 도장 쾅!',
    };
  if (validation?.passed)
    return {
      state: 'happy',
      text: '이 단계 통과! 다음 해 볼 일로 넘어가 볼까요?',
    };
  if (runResult?.hadException)
    return {
      state: 'teach',
      text: `괜찮아요, 버그는 고치라고 있는 거예요. ${explainError(runResult.stderr).text}`,
    };
  if (runResult?.isTimeout || runResult?.outcome === 'output-limit')
    return {
      state: 'encourage',
      text: '주문이 끝나지 않고 계속 돌았어요. 반복이 언젠가 멈추는지 같이 살펴봐요. 천천히 해도 괜찮아요!',
    };
  if (validation)
    return {
      state: 'confused',
      text: '돌아가긴 했는데 나온 글자가 조금 달라요. 해 볼 일을 다시 읽어 봐요!',
    };
  if (session.isCompleted)
    return {
      state: 'wave',
      text:
        session.completion === 'just'
          ? '방금 통과했어요! 한 번 더 돌려 보면 복습이 돼요.'
          : session.reviewChallenge
            ? '복습 도전! 처음 코드에서 다시 짜 봐요. 통과하면 못 모은 별을 채울 수 있어요.'
            : '예전에 통과한 퀘스트예요. 다시 돌려 보며 복습해 봐요! 처음부터 풀고 싶으면 "처음 코드로"를 눌러요.',
    };
  return {
    state: 'idle',
    text: session.steps?.length
      ? session.currentStep > 1
        ? `${session.currentStep}단계 시작! 앞 단계 주문은 공책에 그대로 있어요. 이어서 써 봐요.`
        : '한 단계씩 쌓아 가는 프로젝트예요! 해 볼 일을 위에서부터 차례로 해 봐요.'
      : '이야기를 읽고 해 볼 일을 확인해요. 공책에 주문을 써서 "코드 돌려보기"를 눌러 봐요!',
  };
}

/** 이야기 쪽 머리: 눈썹(N권 · 스테이지 · 퀘스트 번호) + 제목(Jua) + 스테이지 삽화 + 이야기. 퀴즈 이야기 쪽(P7-03)도 같이 씀 */
export function StoryHead({ quest }: { quest: QuestSession['quest'] }) {
  const { stage } = quest;
  const no = stage.world?.no;
  return (
    <>
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

      <p className="qs-story">{quest.prompt_skeleton.story_context}</p>
    </>
  );
}

interface StoryPageProps {
  session: QuestSession;
  /** 대사창 바로 아래 "파이뱀에게 물어보기" (P6-10, AskPybaem) */
  ask?: React.ReactNode;
  /** 대사창 바로 아래 (모바일 "공책 펼치기") */
  action?: React.ReactNode;
  /** 그 아래 (힌트·황금키 줄 P6-09) */
  children?: React.ReactNode;
}

/**
 * 책 펼침 왼쪽 쪽 "이야기" (P6-01, 최종 시안 Quest.tsx StoryPage):
 * 눈썹(N권 · 스테이지 · 퀘스트 번호) + 제목(Jua) + 스테이지 삽화 + 이야기 + "해 볼 일" 체크리스트 + 파이뱀 대사창.
 * 해 볼 일 카드는 서버에서 그린 그대로 보이는 첫 화면 큰 요소(LCP, P6-16) — 숨겼다 나타나는 연출을 걸지 않는다
 */
export function StoryPage({ session, ask, action, children }: StoryPageProps) {
  const { quest } = session;
  const items = missionItems(session);
  const said = tutorLine(session);
  // 오류면 먼저 생각하는 박자 (minimal 짧게 · 동작 줄이기는 바로 설명)
  const thinking = useThinkBeat(
    session.runResult,
    !!session.runResult?.hadException,
  );
  // 통과하면 먼저 기쁨 점프(happy: 웅크림 → 점프 두 번 + 젤리) 뒤 응원(cheer). 동작 줄이기는 바로 응원
  const jumping = useThinkBeat(
    session.runResult,
    said.state === 'cheer',
    HAPPY_MS,
  );
  const line = thinking
    ? {
        state: 'think' as const,
        text: '음… 어디 보자. 버그버그가 어디 숨었을까?',
      }
    : jumping
      ? { ...said, state: 'happy' as const }
      : said;

  return (
    <article className="qs" aria-labelledby="quest-title">
      <StoryHead quest={quest} />

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
              data-step={item.step}
              data-fresh={item.fresh || undefined}
            >
              <span className="qs-box" aria-hidden>
                {item.done ? <Check strokeWidth={3} /> : item.step}
              </span>
              <span>
                {item.text}
                <span className="sr-only">
                  {item.done ? ' (완료)' : item.current ? ' (지금 할 일)' : ''}
                </span>
                {item.sub?.length ? (
                  <ul className="qs-subchecks">
                    {item.sub.map((text, j) => (
                      <li key={j}>{text}</li>
                    ))}
                  </ul>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <DialogueBox
        className="qs-tutor"
        speaker="파이뱀"
        text={line.text}
        tone={line.state === 'cheer' || jumping ? 'good' : 'tutor'}
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

      {ask}
      {action}
      {children}
    </article>
  );
}
