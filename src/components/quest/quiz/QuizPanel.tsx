'use client';

import { useEffect, useId, useRef } from 'react';
import { Check, Lightbulb, RotateCcw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QuizKind, QuizPrompt } from '@/lib/quest/questKind';
import type {
  QuizAnswerResponse,
  QuizAnswerValue,
} from '@/lib/quest/quizAnswer';
import type { QuizMode, QuizStatus } from '@/lib/quest/useQuizSession';
import {
  PassStamp,
  RewardStrip,
  useSuccessRun,
  type QuestReward,
} from '../QuestSuccess';
import { QUIZ_INPUTS } from './quizInputs';
import type { QuizInputDef } from './types';
import '../outputPanel.css';
import '../questSuccess.css';
import './quiz.css';

/** 한 회차에 틀릴 수 있는 수 (3번째 오답이면 정답 공개, 00026) */
export const QUIZ_TRIES = 3;
export const PRACTICE_NOTE = '내일 다시 도전하면 별을 더 모을 수 있어요';

export interface QuizPanelProps {
  title: string;
  quiz: QuizPrompt;
  value: QuizAnswerValue | null;
  onChange: (value: QuizAnswerValue) => void;
  status: QuizStatus;
  result: QuizAnswerResponse | null;
  submitted: QuizAnswerValue | null;
  misses: readonly QuizAnswerValue[];
  mode: QuizMode;
  bestStars: number;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onRetry: () => void;
  nextHref: string | null;
  mapHref: string;
}

/** 결과 보상 띠 (정답·정답 공개 때). 별은 서버 판정 그대로 보이고(SHOW_STARS 와 무관), 연습은 숫자 없이 안내 한 줄 */
export function quizReward(
  r: QuizAnswerResponse,
  base: Pick<QuestReward, 'title' | 'nextHref' | 'mapHref'>,
  prevBest: number,
): QuestReward {
  const practice = r.mode === 'practice';
  const stars =
    r.stars >= 1 && r.stars <= 3 ? (r.stars as 1 | 2 | 3) : undefined;
  return {
    ...base,
    xp: r.xp_awarded,
    stars,
    forceStarsCoins: true,
    review: practice,
    kicker: practice ? '연습 완료' : r.correct ? '퀴즈 통과' : '퀴즈 끝',
    note: practice
      ? `연습이라 별과 XP는 그대로예요. ${PRACTICE_NOTE}!`
      : r.xp_awarded === 0
        ? `지난번에 받은 별 ${prevBest}개가 그대로 남아요.`
        : !r.correct
          ? `다음 날 복습 도전에서 별을 더 모을 수 있어요.`
          : undefined,
  };
}

/**
 * 퀴즈 오른쪽 쪽 (P7-03): 문제 카드(머리 = 종류 · 복습/연습 딱지, 문제 글, 종류별 입력 슬롯) → 채점 쪽지(정답 도장·해설) →
 * 보상 띠 → 아래 붙은 행동 줄(정답 확인 / 다시 풀기). 화면만 그리고 상태는 useQuizSession 이 가짐 — 카탈로그도 이것을 그대로 진열
 */
export function QuizPanel(p: QuizPanelProps) {
  const qid = useId();
  const def = QUIZ_INPUTS[p.quiz.kind] as QuizInputDef<QuizKind> | undefined;
  const { result, status } = p;
  const ended = status === 'correct' || status === 'revealed';
  const done = useSuccessRun(status === 'correct', result);
  // 별을 받기 전 값 (보상 띠 안내용): 응답의 best_stars 는 이미 갱신된 값
  const prevBest = result && result.xp_awarded === 0 ? result.best_stars : 0;
  // 채점 쪽지가 화면 밖(좁은 화면은 보기 아래)이면 보이게. 순간 이동이라 동작 줄이기와 무관
  const live = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result) live.current?.scrollIntoView?.({ block: 'nearest' });
  }, [result]);
  const canSubmit =
    !!def && !result && def.isComplete(p.value as never, p.quiz as never);

  return (
    <div className="qz" data-status={status}>
      <section
        className="qz-card"
        aria-labelledby={qid}
        data-testid="quiz-card"
      >
        <div className="qz-head">
          <span className="qz-k">
            <Sparkles aria-hidden />
            보너스 퀴즈{def ? ` · ${def.label}` : ''}
          </span>
          {p.mode === 'review' && (
            <span className="qz-chip" data-tone="review">
              복습 도전
            </span>
          )}
          {p.mode === 'practice' && (
            <span className="qz-chip" data-tone="practice">
              연습
            </span>
          )}
        </div>
        {!result && p.mode !== 'first' && (
          <p className="qz-notice" data-testid="quiz-mode-note">
            {p.mode === 'practice'
              ? `오늘은 연습이에요. ${PRACTICE_NOTE}.`
              : `어제보다 한 뼘 더! 오늘 맞히면 별을 더 모을 수 있어요${p.bestStars ? ` (지금 별 ${p.bestStars}개)` : ''}.`}
          </p>
        )}
        <h2 id={qid} className="qz-q">
          {p.quiz.question}
        </h2>
        {def ? (
          <def.Input
            quiz={p.quiz as never}
            value={p.value as never}
            onChange={p.onChange as never}
            disabled={!!result || p.isSubmitting}
            result={
              result && p.submitted != null
                ? {
                    status: status as 'correct' | 'wrong' | 'revealed',
                    submitted: p.submitted as never,
                    answer: (result.revealed?.answer ?? null) as never,
                  }
                : null
            }
            misses={p.misses as never}
            labelledBy={qid}
          />
        ) : (
          <p className="qz-notice">
            이 퀴즈는 곧 풀 수 있어요. 조금만 기다려 줘요!
          </p>
        )}
      </section>

      <div aria-live="polite" className="qz-live" ref={live}>
        {result && <Verdict result={result} status={status} done={done} />}
      </div>

      {result && ended && (
        <RewardStrip
          reward={quizReward(
            result,
            { title: p.title, nextHref: p.nextHref, mapHref: p.mapHref },
            prevBest,
          )}
          done={done || status === 'revealed'}
        />
      )}

      <div className="qz-actions" data-graded={result ? true : undefined}>
        {p.error && (
          <p className="qz-error" role="alert">
            {p.error}
          </p>
        )}
        {!result ? (
          <Button
            size="lg"
            onClick={p.onSubmit}
            disabled={!canSubmit}
            loading={p.isSubmitting}
            icon={<Check aria-hidden />}
            sfx={false}
            data-testid="quiz-submit"
          >
            {canSubmit || p.isSubmitting ? '정답 확인' : '답을 골라요'}
          </Button>
        ) : (
          <Button
            size={ended ? 'md' : 'lg'}
            variant={ended ? 'secondary' : 'primary'}
            onClick={p.onRetry}
            icon={<RotateCcw aria-hidden />}
            data-testid="quiz-retry"
          >
            {ended ? '한 번 더 풀어 보기' : '다시 풀기'}
          </Button>
        )}
      </div>
    </div>
  );
}

/** 채점 쪽지: 결과 쪽지(OutputPanel)와 같은 면 + 딱지. 상태는 면 색 + 딱지 아이콘·글자로 */
function Verdict({
  result,
  status,
  done,
}: {
  result: QuizAnswerResponse;
  status: QuizStatus;
  done: boolean;
}) {
  const left = QUIZ_TRIES - result.attempt_no;
  const tone =
    status === 'correct' ? 'good' : status === 'wrong' ? 'diff' : undefined;
  const text =
    status === 'revealed'
      ? result.revealed?.explanation
      : (result.explanation ?? undefined);
  return (
    <div
      className="qo-slip qz-verdict"
      data-tone={tone}
      data-testid="quiz-verdict"
      data-status={status}
    >
      <div className="qo-head">
        <span className="qo-k">채점 결과</span>
        <span className="qo-chip" data-tone={tone}>
          {status === 'correct' ? (
            <>
              <Check aria-hidden /> 정답이에요!
            </>
          ) : status === 'wrong' ? (
            <>
              <X aria-hidden /> 아쉬워요
            </>
          ) : (
            <>
              <Lightbulb aria-hidden /> 정답을 알려 줄게요
            </>
          )}
        </span>
      </div>
      {status === 'wrong' && (
        <p className="qz-verdict-t">
          {left > 0
            ? `괜찮아요! ${left}번 더 도전할 수 있어요.`
            : '한 번 더 골라 봐요!'}
        </p>
      )}
      {text && <p className="qo-note">{text}</p>}
      {status === 'correct' && <PassStamp done={done} />}
    </div>
  );
}
