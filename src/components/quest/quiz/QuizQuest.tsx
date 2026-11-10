'use client';

import { DialogueBox } from '@/components/ui/dialogue-box';
import type { PybaemState } from '@/components/characters/rig';
import type { QuestSessionOptions } from '@/lib/quest/useQuestSession';
import {
  useQuizSession,
  type QuizMode,
  type QuizStatus,
} from '@/lib/quest/useQuizSession';
import { stageDots } from '@/lib/quest/stageProgress';
import { worldPath } from '@/lib/world/worldBook';
import { QuestHeader } from '../QuestHeader';
import { QuestStatusBar } from '../QuestStatusBar';
import { CelebrationLayer } from '../QuestWorkspace';
import { PybaemRig, StoryHead } from '../StoryPage';
import { HAPPY_MS, useThinkBeat } from '../useThinkBeat';
import { PRACTICE_NOTE, QUIZ_TRIES, QuizPanel } from './QuizPanel';
import '../questWorkspace.css';
import '@/components/world/map/worldMap.css';
import './quiz.css';

/** 파이뱀 대사 + 자세 (퀴즈 상태·모드별) */
export function quizLine(
  status: QuizStatus,
  mode: QuizMode,
  attemptNo = 0,
): { state: PybaemState; text: string } {
  switch (status) {
    case 'correct':
      return {
        state: 'cheer',
        text:
          mode === 'practice'
            ? `연습도 정답! ${PRACTICE_NOTE}.`
            : '정답이에요! 통과 도장 쾅!',
      };
    case 'wrong':
      return {
        state: 'encourage',
        text: `아쉬워요! 틀려도 괜찮아요. 아직 ${QUIZ_TRIES - attemptNo}번 더 도전할 수 있으니 천천히 다시 생각해 봐요.`,
      };
    case 'revealed':
      return {
        state: 'teach',
        text: '괜찮아요, 같이 정답을 볼까요? 까닭을 알면 다음엔 꼭 맞힐 수 있어요!',
      };
    default:
      return mode === 'review'
        ? {
            state: 'wave',
            text: '복습 도전! 예전에 푼 퀴즈예요. 오늘 맞히면 별을 더 모을 수 있어요.',
          }
        : mode === 'practice'
          ? {
              state: 'idle',
              text: `오늘은 연습이에요. 마음껏 풀어 봐요! ${PRACTICE_NOTE}.`,
            }
          : {
              state: 'idle',
              text: '보너스 퀴즈예요! 문제를 잘 읽고 답을 고른 다음 "정답 확인"을 눌러요.',
            };
  }
}

/**
 * 퀴즈 퀘스트 렌더러 (P7-03, §2.5). 코드 퀘스트와 같은 책 펼침 언어: 헤더 · [이야기 쪽(머리·파이뱀 대사) | 퀴즈 쪽(QuizPanel)] · 상태바 · 축하.
 * 공책·실행기가 없어 번호 탭 없이, lg 미만은 두 쪽을 위아래로 이어 한 번에 스크롤(행동 줄은 아래에 붙음)
 */
export function QuizQuest(props: QuestSessionOptions) {
  const s = useQuizSession(props);
  const { quest } = s;
  const worldHref = worldPath(quest.stage.world?.slug);
  const done = s.status === 'correct' || s.status === 'revealed';
  const dots = stageDots(
    quest.stage.quests ?? [],
    quest.id,
    done || props.progress?.status === 'completed',
    quest.stage.unlocked,
  );
  const nextId =
    dots
      .slice(dots.findIndex((d) => d.current) + 1)
      .find((d) => d.state !== 'locked')?.id ?? null;
  const said = quizLine(s.status, s.mode, s.result?.attempt_no);
  // 정답이면 먼저 기쁨 점프(happy) 뒤 응원(cheer) — 코드 퀘스트 StoryPage 와 같은 박자 (P7-09). 동작 줄이기는 바로 응원
  const jumping = useThinkBeat(s.result, said.state === 'cheer', HAPPY_MS);
  const line = jumping ? { ...said, state: 'happy' as const } : said;

  return (
    <div className="qw-root flex h-dvh flex-col bg-bg">
      <QuestHeader
        worldHref={worldHref}
        bgm={quest.stage.world?.bgm ?? null}
        stageTitle={quest.stage.title}
        stageOrder={quest.stage.order}
        questTitle={quest.title}
        dots={dots}
      />
      <div className="qw-book qz-book">
        <div className="qw-page qw-page-l">
          <article className="qs" aria-labelledby="quest-title">
            <StoryHead quest={quest} />
            <DialogueBox
              className="qs-tutor"
              speaker="파이뱀"
              text={line.text}
              tone={said.state === 'cheer' ? 'good' : 'tutor'}
              // 채점 결과는 채점 쪽지(초점 이동)가 읽음 — 대사로 또 읽지 않게 (P7-13)
              live={false}
              data-testid="quest-dialogue"
              character={(speaking) => (
                <PybaemRig
                  state={
                    speaking && line.state === 'idle' ? 'talk' : line.state
                  }
                  talking={speaking}
                  size={96}
                  label=""
                />
              )}
            />
          </article>
        </div>
        <div className="qw-page qw-page-r">
          <QuizPanel
            title={quest.title}
            quiz={s.quiz}
            value={s.value}
            onChange={s.setValue}
            status={s.status}
            result={s.result}
            submitted={s.submitted}
            misses={s.misses}
            mode={s.mode}
            bestStars={s.bestStars}
            isSubmitting={s.isSubmitting}
            error={s.error}
            onSubmit={s.submit}
            onRetry={s.retry}
            explain={s.explain}
            onExplain={s.askWhy}
            combo={s.combo}
            nextHref={nextId ? `/quest/${nextId}` : null}
            mapHref={worldHref}
          />
        </div>
      </div>
      <QuestStatusBar xp={s.userXP} level={s.userLevel} earnedXP={s.earnedXP} />
      <CelebrationLayer session={s} worldHref={worldHref} />
    </div>
  );
}
