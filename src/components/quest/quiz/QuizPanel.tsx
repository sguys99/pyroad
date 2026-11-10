'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import {
  Check,
  Flame,
  Lightbulb,
  MessageCircleQuestion,
  Play,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { RewardIcon } from '@/components/ui/reward-icon';
import type { QuizKind, QuizPrompt } from '@/lib/quest/questKind';
import type {
  QuizAnswerResponse,
  QuizAnswerValue,
} from '@/lib/quest/quizAnswer';
import type {
  QuizExplainView,
  QuizMode,
  QuizStatus,
} from '@/lib/quest/useQuizSession';
import { PybaemRig } from '../StoryPage';
import {
  PassStamp,
  RewardStrip,
  useSuccessRun,
  type QuestReward,
} from '../QuestSuccess';
import { quizRunCode } from '@/lib/quest/quizCode';
import { COMBO_BADGE_MIN, comboRate } from '@/lib/quest/quizCombo';
import { QUIZ_INPUTS } from './quizInputs';
import type { QuizInputDef } from './types';
import '../outputPanel.css';
import '../questSuccess.css';
import './quiz.css';

/** 한 회차에 틀릴 수 있는 수 (3번째 오답이면 정답 공개, 00026) */
export const QUIZ_TRIES = 3;
export const PRACTICE_NOTE = '내일 다시 도전하면 별을 더 모을 수 있어요';

// "직접 실행해 보기" 칸(에디터·실행기)은 누를 때 불러옴 — 퀴즈 첫 화면 JS·Pyodide 를 늘리지 않음 (P7-07)
const QuizTryRun = dynamic(() => import('./QuizTryRun'), {
  ssr: false,
  loading: () => (
    <p className="qz-try-wait" role="status">
      실행 칸을 펼치는 중이에요…
    </p>
  ),
});

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
  /** 링크 대신 같은 화면에서 다음 문제로 (오늘의 퀴즈, P7-10) + 그 버튼 글자 */
  onNext?: () => void;
  nextLabel?: string;
  /** 오답 뒤 "왜 틀렸어요?" 파이뱀 해설 (P7-08). onExplain 이 없으면 버튼을 그리지 않음 */
  explain?: QuizExplainView | null;
  onExplain?: () => void;
  /** 이 탭의 연속 정답 수 (P7-09, quizCombo). 2부터 머리에 불꽃 배지, 정답 소리 피치 */
  combo?: number;
  /** 머리 눈썹 대신 보일 출처 (오늘의 퀴즈: "1단계 파이썬 마을 입구 · 퀴즈 제목", B53). 없으면 "보너스 퀴즈 · 종류" */
  source?: string;
}

const EXPLAIN_THINKING = '음… 어디서 헷갈렸는지 같이 생각해 볼게요…';

/** 결과 보상 띠 (정답·정답 공개 때). 별은 서버 판정 그대로 보이고(SHOW_STARS 와 무관), 연습은 숫자 없이 안내 한 줄 */
export function quizReward(
  r: QuizAnswerResponse,
  base: Pick<
    QuestReward,
    'title' | 'nextHref' | 'mapHref' | 'onNext' | 'nextLabel'
  >,
  prevBest: number,
): QuestReward {
  const practice = r.mode === 'practice';
  // 정답이면 별은 채점 쪽지가 도장처럼 찍어 보여 줌 → 보상 띠에서 또 보이지 않게. 공개(쪽지에 별 없음)만 띠에
  const stars =
    !r.correct && r.stars >= 1 && r.stars <= 3
      ? (r.stars as 1 | 2 | 3)
      : undefined;
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
  const heading = useRef<HTMLHeadingElement>(null);
  // 초점 이동 (P7-13): 채점되면 채점 쪽지로(낭독기는 초점이 간 쪽지를 읽음 — 따로 aria-live 로 또 읽지 않음),
  // 다시 풀면 문제 제목으로. 제출·다시 풀기 버튼이 바뀌거나 비활성이 되며 초점이 body 로 빠지지 않게
  // 채점 쪽지가 생기거나 사라질 때만. 처음부터 채점된 채로 그린 카탈로그 견본은 그대로 둔다 —
  // 견본마다 하이드레이션 뒤 페이지를 끌고 가 느린 CI에서 다른 스펙의 좌표가 빗나갔음 (B54)
  const hadResult = useRef(!!result);
  useEffect(() => {
    const had = hadResult.current;
    hadResult.current = !!result;
    if (!!result === had) return;
    if (result) {
      live.current?.scrollIntoView?.({ block: 'nearest' });
      live.current
        ?.querySelector<HTMLElement>('.qz-verdict')
        ?.focus({ preventScroll: true });
    } else if (had) {
      heading.current?.focus({ preventScroll: true });
    }
  }, [result]);
  // 정답(또는 공개) 뒤 돌려 볼 코드: 맞힌 제출값 / 공개된 정답으로 조립 (정답을 새로 받지 않음)
  const tryCode =
    result && ended
      ? quizRunCode(
          p.quiz,
          status === 'revealed'
            ? (result.revealed?.answer ?? null)
            : p.submitted,
        )
      : null;
  // 이 채점 결과에서 열었는지 (다시 풀면 닫힘)
  const [triedFor, setTriedFor] = useState<QuizAnswerResponse | null>(null);
  const tryOpen = !!result && triedFor === result;
  const tryId = useId();
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
            {p.source ?? `보너스 퀴즈${def ? ` · ${def.label}` : ''}`}
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
          <ComboBadge combo={p.combo ?? 0} />
        </div>
        {!result && p.mode !== 'first' && (
          <p className="qz-notice" data-testid="quiz-mode-note">
            {p.mode === 'practice'
              ? `오늘은 연습이에요. ${PRACTICE_NOTE}.`
              : `어제보다 한 뼘 더! 오늘 맞히면 별을 더 모을 수 있어요${p.bestStars ? ` (지금 별 ${p.bestStars}개)` : ''}.`}
          </p>
        )}
        <h2 id={qid} className="qz-q" ref={heading} tabIndex={-1}>
          {p.quiz.question}
        </h2>
        {def ? (
          <div className="qz-input">
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
          </div>
        ) : (
          <p className="qz-notice">
            이 퀴즈는 곧 풀 수 있어요. 조금만 기다려 줘요!
          </p>
        )}
      </section>

      <div className="qz-live" ref={live}>
        {result && (
          <Verdict
            result={result}
            status={status}
            done={done}
            combo={p.combo ?? 0}
          />
        )}
      </div>

      {status === 'wrong' && p.onExplain && (
        <WhyWrong explain={p.explain ?? null} onExplain={p.onExplain} />
      )}
      {/* 이 쪽의 단 하나의 알림 자리: 채점은 초점 이동이 맡고, 여기는 해설이 다 왔을 때만 */}
      <p className="sr-only" aria-live="polite" data-testid="quiz-announce">
        {status === 'wrong' && p.explain && p.explain.state !== 'loading'
          ? `파이뱀: ${p.explain.text}`
          : ''}
      </p>

      {tryCode && (
        <div className="qz-try-wrap">
          <Button
            variant="secondary"
            size="md"
            icon={<Play aria-hidden />}
            aria-expanded={tryOpen}
            aria-controls={tryId}
            onClick={() => setTriedFor(tryOpen ? null : result)}
            data-testid="quiz-try-toggle"
          >
            {tryOpen ? '실행 칸 접기' : '직접 실행해 보기'}
          </Button>
          <div id={tryId}>
            {tryOpen && <QuizTryRun code={tryCode} kind={p.quiz.kind} />}
          </div>
        </div>
      )}

      {result && ended && (
        <RewardStrip
          reward={quizReward(
            result,
            {
              title: p.title,
              nextHref: p.nextHref,
              mapHref: p.mapHref,
              onNext: p.onNext,
              nextLabel: p.nextLabel,
            },
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

/**
 * "왜 틀렸어요?" (P7-08): 오답 쪽지 아래 버튼 → 누르면 그 자리에 파이뱀 대사창(생각 중 표정 → 해설).
 * 정답은 말하지 않음(서버가 거름). 3번 틀려 정답이 공개되면(revealed) 그리지 않음
 */
function WhyWrong({
  explain,
  onExplain,
}: {
  explain: QuizExplainView | null;
  onExplain: () => void;
}) {
  // 버튼이 대사창으로 바뀌면 초점을 대사창으로 (생각 중 문구를 읽고, 해설은 패널 알림 자리가 읽음)
  const box = useRef<HTMLDivElement>(null);
  const opened = !!explain;
  useEffect(() => {
    if (opened) box.current?.focus({ preventScroll: true });
  }, [opened]);
  if (!explain) {
    return (
      <Button
        variant="secondary"
        size="md"
        icon={<MessageCircleQuestion aria-hidden />}
        onClick={onExplain}
        className="qz-why-btn"
        data-testid="quiz-why"
      >
        파이뱀, 왜 틀렸어요?
      </Button>
    );
  }
  const thinking = explain.state === 'loading';
  const state = thinking
    ? 'think'
    : explain.state === 'error'
      ? 'encourage'
      : 'teach';
  return (
    <div
      ref={box}
      tabIndex={-1}
      className="qz-why"
      data-state={explain.state}
      aria-busy={thinking || undefined}
      data-testid="quiz-why-bubble"
    >
      <DialogueBox
        speaker={
          <>
            파이뱀
            {explain.fallback && (
              <span className="qz-why-tag">저장된 해설</span>
            )}
          </>
        }
        text={thinking ? EXPLAIN_THINKING : explain.text}
        live={false}
        tone="tutor"
        character={(speaking) => (
          <PybaemRig
            state={speaking && !thinking ? 'talk' : state}
            talking={speaking && !thinking}
            size={72}
            label=""
          />
        )}
      />
    </div>
  );
}

/** 채점 쪽지: 결과 쪽지(OutputPanel)와 같은 면 + 딱지. 상태는 면 색 + 딱지 아이콘·글자로 */
function Verdict({
  result,
  status,
  done,
  combo,
}: {
  result: QuizAnswerResponse;
  status: QuizStatus;
  done: boolean;
  combo: number;
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
      tabIndex={-1}
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
              <Lightbulb aria-hidden /> 같이 정답을 볼까요?
            </>
          )}
        </span>
      </div>
      {status === 'wrong' && (
        <p className="qz-verdict-t">
          {left > 0
            ? `괜찮아요! ${left === 1 ? '마지막으로 ' : ''}${left}번 더 도전할 수 있어요.`
            : '한 번 더 골라 봐요!'}
        </p>
      )}
      {status === 'correct' && <VerdictStars result={result} />}
      {status === 'correct' && combo >= COMBO_BADGE_MIN && (
        <span className="sr-only">{combo}연속 정답이에요.</span>
      )}
      {text && <p className="qo-note">{text}</p>}
      {status === 'correct' && (
        <PassStamp done={done} rate={comboRate(combo)} />
      )}
    </div>
  );
}

/**
 * 정답 쪽지의 별 (P7-09): 받은 별 수만큼 도장처럼 하나씩 찍힘(full·lite, CSS). minimal·동작 줄이기는 처음부터 찍힌 모습.
 * 연습은 별 없이 "연습 정답" 딱지. 별을 이미 받은 복습(xp 0)도 이번 판정 별을 그대로 보여 줌
 */
function VerdictStars({ result }: { result: QuizAnswerResponse }) {
  if (result.mode === 'practice')
    return (
      <p className="qz-stars" data-testid="quiz-verdict-practice">
        <span className="qz-chip" data-tone="practice">
          연습 정답
        </span>
      </p>
    );
  const n = Math.min(3, Math.max(0, result.stars));
  if (n === 0) return null;
  return (
    <p className="qz-stars" data-testid="quiz-verdict-stars">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="qz-star" style={{ '--i': i } as CSSProperties}>
          <RewardIcon kind="star" size={28} />
        </span>
      ))}
      <span className="sr-only">별 {n}개</span>
    </p>
  );
}

/**
 * 연속 정답 배지 (P7-09, §12-Q60 4c): 2연속부터 문제 카드 머리 오른쪽에 불꽃 + "N연속". 숫자가 바뀌면 톡(full·lite).
 * 소리(정답 피치 상승)와 같은 정보를 글자로도 보여 줌
 */
export function ComboBadge({ combo }: { combo: number }) {
  if (combo < COMBO_BADGE_MIN) return null;
  return (
    <span className="qz-combo" data-testid="quiz-combo">
      <Flame aria-hidden />
      {/* 숫자와 "연속"은 붙여서 "2연속" (요약 카드와 같은 띄어쓰기) */}
      <span>
        <b key={combo} className="qz-combo-n">
          {combo}
        </b>
        연속
      </span>
      <span className="sr-only"> 정답</span>
    </span>
  );
}
