'use client';

import { useState } from 'react';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import {
  ComboBadge,
  QuizPanel,
  type QuizPanelProps,
} from '@/components/quest/quiz/QuizPanel';
import { useSfx } from '@/components/providers/SoundProvider';
import { recordQuizAnswer, useQuizCombo } from '@/lib/quest/quizCombo';
import { quizLine } from '@/components/quest/quiz/QuizQuest';
import { QuizTryRunView } from '@/components/quest/quiz/QuizTryRun';
import { PyodideProvider } from '@/lib/pyodide/PyodideProvider';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type {
  QuizAnswerResponse,
  QuizAnswerValue,
} from '@/lib/quest/quizAnswer';
import {
  quizStatus,
  WRONG_GAIN,
  type QuizExplainView,
  type QuizMode,
} from '@/lib/quest/useQuizSession';
import { Demo, Section } from './ui';

const HREF = '/dev/design#quiz';

/** 출력 예측형 (§12-Q60 4a): 문제 코드 + 보기는 출력이라 코드 글꼴 */
export const QUIZ_PREDICT: QuizPrompt = {
  kind: 'multiple_choice',
  question: '이 코드를 돌리면 무엇이 나올까?',
  code: 'for i in range(3):\n    print(i)',
  options: [
    { id: 'opt-w9fa', text: '0 1 2 3' },
    { id: 'opt-k7qz', text: '0 1 2' },
    { id: 'opt-b2mx', text: '1 2 3' },
    { id: 'opt-r4tn', text: 'i i i' },
  ],
};
const PREDICT_ANSWER = 'opt-k7qz';
const PREDICT_WHY: Record<string, string> = {
  'opt-w9fa': 'range(3)은 3 바로 앞에서 멈춰요.',
  'opt-b2mx': 'range는 0부터 세기 시작해요.',
};

/** 코드 보기 (`로 감싼 보기) */
const QUIZ_CODE_OPTIONS: QuizPrompt = {
  kind: 'multiple_choice',
  question: '"안녕"을 화면에 보여 주는 주문은 어느 것일까?',
  options: [
    { id: 'opt-m3pd', text: '`print("안녕")`' },
    { id: 'opt-x8ce', text: '`print(안녕)`' },
    { id: 'opt-h5vu', text: '`"안녕".print()`' },
  ],
};

function response(over: Partial<QuizAnswerResponse>): QuizAnswerResponse {
  return {
    correct: false,
    attempt_no: 1,
    mode: 'first',
    stars: 0,
    best_stars: 0,
    xp_awarded: 0,
    total_xp: 120,
    level_before: 2,
    level_after: 2,
    explanation: null,
    revealed: null,
    next_review_on: null,
    next_quiz: null,
    ...over,
  };
}

const base: Omit<
  QuizPanelProps,
  'status' | 'result' | 'submitted' | 'value' | 'misses' | 'mode'
> = {
  title: '반복문 맞혀 보기',
  quiz: QUIZ_PREDICT,
  onChange: () => {},
  bestStars: 0,
  isSubmitting: false,
  error: null,
  onSubmit: () => {},
  onRetry: () => {},
  nextHref: HREF,
  mapHref: HREF,
};

function Still(
  p: Partial<QuizPanelProps> & {
    result?: QuizAnswerResponse | null;
    mode?: QuizMode;
  },
) {
  const result = p.result ?? null;
  return (
    <QuizPanel
      {...base}
      value={null}
      submitted={null}
      misses={[]}
      mode="first"
      {...p}
      result={result}
      status={quizStatus(result)}
    />
  );
}

/** 오답 + "왜 틀렸어요?" 견본 (P7-08): 버튼을 누르면 이 자리에서 생각 중 → 해설 */
function WhyStill({ explain }: { explain?: QuizExplainView }) {
  const [shown, setShown] = useState<QuizExplainView | null>(
    explain ?? null,
  );
  return (
    <Still
      value="opt-b2mx"
      submitted="opt-b2mx"
      misses={['opt-b2mx']}
      result={response({ explanation: PREDICT_WHY['opt-b2mx'] })}
      explain={shown}
      onExplain={() => setShown({ state: 'loading', text: '' })}
    />
  );
}

/** 직접 풀어 보는 견본: 서버 대신 이 자리에서 채점 (회차 3번, 정답 공개, 다시 풀면 보기 다시 섞기·연습) */
function LiveQuiz() {
  const [quiz, setQuiz] = useState(QUIZ_PREDICT);
  const [value, setValue] = useState<QuizAnswerValue | null>(null);
  const [graded, setGraded] = useState<{
    r: QuizAnswerResponse;
    v: QuizAnswerValue;
  } | null>(null);
  const [misses, setMisses] = useState<QuizAnswerValue[]>([]);
  const [mode, setMode] = useState<QuizMode>('first');
  const [why, setWhy] = useState<QuizExplainView | null>(null);
  // 앱과 같은 탭 메모리 콤보 (P7-09): 연달아 맞히면 배지 + 정답 소리 피치가 올라감
  const combo = useQuizCombo();
  const play = useSfx();
  const status = quizStatus(graded?.r ?? null);
  const line = quizLine(status, mode, graded?.r.attempt_no);
  // 서버 대신 잠깐 생각한 뒤 정답 없는 해설
  const askWhy = () => {
    setWhy({ state: 'loading', text: '' });
    setTimeout(
      () =>
        setWhy((w) =>
          w
            ? {
                state: 'done',
                text: 'print(i)가 몇 번 돌았는지 손가락으로 세어 볼까요? range(3)에서 i는 어디서 시작할까요?',
              }
            : w,
        ),
      1200,
    );
  };

  const submit = () => {
    if (value == null) return;
    const attempt = misses.length + 1;
    const correct = value === PREDICT_ANSWER;
    const judged = mode !== 'practice' && (correct || attempt === 3);
    const stars = judged ? (correct ? 4 - attempt : 1) : 0;
    const r = response({
      correct,
      attempt_no: attempt,
      mode,
      stars,
      best_stars: stars,
      xp_awarded: stars * 10,
      explanation: correct
        ? 'range(3)은 0, 1, 2 세 번 돌아요.'
        : (PREDICT_WHY[value as string] ?? null),
      revealed:
        !correct && attempt === 3
          ? {
              answer: PREDICT_ANSWER,
              explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
            }
          : null,
    });
    setGraded({ r, v: value });
    recordQuizAnswer(correct);
    if (!correct) play('wrong', { gain: WRONG_GAIN });
    if (!correct && attempt < 3) setMisses((m) => [...m, value]);
  };
  const retry = () => {
    const ended = graded?.r.correct || graded?.r.revealed;
    setQuiz((q) =>
      q.kind === 'multiple_choice'
        ? { ...q, options: [...q.options].reverse() }
        : q,
    );
    if (ended) {
      setMisses([]);
      setMode('practice');
    }
    setValue(null);
    setGraded(null);
    setWhy(null);
  };

  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <DialogueBox
        speaker="파이뱀"
        text={line.text}
        tone={line.state === 'cheer' ? 'good' : 'tutor'}
        character={(speaking) => (
          <PybaemRig
            state={speaking && line.state === 'idle' ? 'talk' : line.state}
            talking={speaking}
            size={96}
            label=""
          />
        )}
      />
      <div className="@container">
        <QuizPanel
          {...base}
          quiz={quiz}
          value={value}
          onChange={graded ? () => {} : setValue}
          status={status}
          result={graded?.r ?? null}
          submitted={graded?.v ?? null}
          misses={misses}
          mode={mode}
          onSubmit={submit}
          onRetry={retry}
          explain={why}
          onExplain={askWhy}
          combo={combo}
        />
      </div>
    </div>
  );
}

const CORRECT_3 = response({
  correct: true,
  stars: 3,
  best_stars: 3,
  xp_awarded: 30,
  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
});

/**
 * 정답·오답 연출 (P7-09): "다시 재생"으로 견본을 새로 그려 한 번 더 봄. 정답 = 도장 + 별 하나씩 + 콤보 배지(정답 소리 피치),
 * 오답 = 입력 영역 짧은 흔들림 + 남은 기회, 공개 = 정답 쪽지가 펼쳐짐. minimal·동작 줄이기는 움직임 없이 끝 모습
 */
function FeedbackDemos() {
  const [round, setRound] = useState(0);
  return (
    <div className="mt-8 space-y-4" data-testid="quiz-feedback">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-display text-h3">정답·오답 연출 · 콤보 (P7-09)</h3>
        <button
          type="button"
          className="text-small font-semibold text-primary-text underline"
          onClick={() => setRound((r) => r + 1)}
          data-testid="quiz-feedback-replay"
        >
          다시 재생
        </button>
      </div>
      <p className="text-small text-muted-foreground">
        연속 정답 콤보는 저장하지 않는 탭 메모리(quizCombo): 다시 풀기·다음 퀴즈로 가도 이어지고 오답·새로고침이면
        0. 2연속부터 문제 카드 머리에 불꽃 배지, 정답 소리 피치 1 → 1.12 → 1.26(상한). 오답 소리는 작게. 소리만으로
        알리지 않게 배지 글자와 함께.
      </p>
      <div
        key={round}
        className="grid items-start gap-4 md:grid-cols-2"
      >
        <Demo
          label="정답 · 3연속 (⭐⭐⭐ 하나씩 찍힘, 피치 1.26)"
          surface="card"
          data-testid="quiz-fx-correct"
        >
          <div className="@container">
            <Still
              value={PREDICT_ANSWER}
              submitted={PREDICT_ANSWER}
              result={CORRECT_3}
              combo={3}
            />
          </div>
        </Demo>
        <Demo
          label="연습 정답 (별 없이 딱지)"
          surface="card"
          data-testid="quiz-fx-practice"
        >
          <div className="@container">
            <Still
              mode="practice"
              value={PREDICT_ANSWER}
              submitted={PREDICT_ANSWER}
              result={response({
                correct: true,
                mode: 'practice',
                explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
              })}
              combo={2}
            />
          </div>
        </Demo>
        <Demo
          label="오답 2번째 (흔들림 + 마지막 기회)"
          surface="card"
          data-testid="quiz-fx-wrong"
        >
          <div className="@container">
            <Still
              value="opt-w9fa"
              submitted="opt-w9fa"
              misses={['opt-b2mx', 'opt-w9fa']}
              result={response({
                attempt_no: 2,
                explanation: PREDICT_WHY['opt-w9fa'],
              })}
            />
          </div>
        </Demo>
        <Demo
          label="3번째 오답 공개 (쪽지가 펼쳐짐)"
          surface="card"
          data-testid="quiz-fx-revealed"
        >
          <div className="@container">
            <Still
              submitted="opt-w9fa"
              misses={['opt-b2mx', 'opt-r4tn']}
              result={response({
                attempt_no: 3,
                stars: 1,
                best_stars: 1,
                xp_awarded: 10,
                revealed: {
                  answer: PREDICT_ANSWER,
                  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
                },
              })}
            />
          </div>
        </Demo>
        <Demo
          label="콤보 배지 2 · 3 · 5연속"
          note="1연속은 배지 없음. 숫자가 바뀌면 톡 (minimal·동작 줄이기는 그대로)"
          surface="card"
          data-testid="quiz-fx-combo"
        >
          <div className="flex flex-wrap items-center gap-3">
            <ComboBadge combo={2} />
            <ComboBadge combo={3} />
            <ComboBadge combo={5} />
          </div>
        </Demo>
      </div>
    </div>
  );
}

/** 빈칸 채우기 (P7-04). range·print 가 정답, input·len 은 방해 토큰. 둘째 줄은 360px 에서 줄바꿈되는 긴 줄 */
const QUIZ_FILL: QuizPrompt = {
  kind: 'fill_blank',
  question: '빈칸을 채워 0부터 2까지 출력해요',
  code: 'for i in {{bk-r2fa}}(3):\n    {{bk-m8ce}}(i, "번째 바퀴를 돌았어요", "다음 바퀴로 가요")',
  tokens: [
    { id: 'tok-z6nh', text: 'input' },
    { id: 'tok-c3pd', text: 'print' },
    { id: 'tok-k2wq', text: 'len' },
    { id: 'tok-m4xe', text: 'range' },
  ],
};
const FILL_ANSWER = { 'bk-r2fa': 'tok-m4xe', 'bk-m8ce': 'tok-c3pd' };
const FILL_WRONG = { 'bk-r2fa': 'tok-k2wq', 'bk-m8ce': 'tok-c3pd' };
const FILL_WHY = 'range 로 숫자를 만들고 print 로 보여 줘요.';

function FillLive() {
  const [value, setValue] = useState<QuizAnswerValue | null>(null);
  const [graded, setGraded] = useState<{
    r: QuizAnswerResponse;
    v: QuizAnswerValue;
  } | null>(null);
  const [misses, setMisses] = useState<QuizAnswerValue[]>([]);
  const submit = () => {
    if (value == null) return;
    const attempt = misses.length + 1;
    const v = value as Record<string, string>;
    const correct = Object.entries(FILL_ANSWER).every(([b, t]) => v[b] === t);
    const stars = correct ? 4 - attempt : attempt === 3 ? 1 : 0;
    setGraded({
      v: value,
      r: response({
        correct,
        attempt_no: attempt,
        stars,
        best_stars: stars,
        xp_awarded: stars * 10,
        explanation: correct ? FILL_WHY : null,
        revealed:
          !correct && attempt === 3
            ? { answer: FILL_ANSWER, explanation: FILL_WHY }
            : null,
      }),
    });
    if (!correct) setMisses((m) => [...m, value]);
  };
  return (
    <div className="@container">
      <QuizPanel
        {...base}
        quiz={QUIZ_FILL}
        value={value}
        onChange={graded ? () => {} : setValue}
        status={quizStatus(graded?.r ?? null)}
        result={graded?.r ?? null}
        submitted={graded?.v ?? null}
        misses={misses}
        mode="first"
        onSubmit={submit}
        onRetry={() => {
          if (graded?.r.correct || graded?.r.revealed) setMisses([]);
          setValue(null);
          setGraded(null);
        }}
      />
    </div>
  );
}

function FillBlankDemos() {
  return (
    <>
      <h3 className="mt-8 mb-2 text-h3">빈칸 채우기 (P7-04)</h3>
      <p className="mb-4 text-small text-muted-foreground">
        코드 안 빈칸 버튼 + 아래 낱말 칩(서버가 섞은 순서). 칩을 누르면 강조된
        빈칸에 들어가고 다음 빈칸으로 넘어가요. 찬 빈칸을 누르면 칩이 돌아가고,
        빈 빈칸을 누르면 그 빈칸을 골라요. 같은 낱말을 여러 빈칸에 쓸 수 있어 칩은
        사라지지 않고 흐려져요. 긴 줄은 가로 스크롤 대신 줄바꿈.
      </p>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Demo
          label="직접 풀어 보기 (이 자리 채점)"
          note="range · print 가 정답. 3번째 오답이면 정답 공개"
          surface="card"
          data-testid="quiz-fill-live"
        >
          <FillLive />
        </Demo>
        <Demo
          label="하나 채움 (둘째 빈칸 차례)"
          surface="card"
          data-testid="quiz-fill-partial"
        >
          <div className="@container">
            <Still quiz={QUIZ_FILL} value={{ 'bk-r2fa': 'tok-m4xe' }} />
          </div>
        </Demo>
        <Demo
          label="오답 (넣은 낱말 그대로)"
          note="어느 빈칸이 틀렸는지는 알려 주지 않음"
          surface="card"
          data-testid="quiz-fill-wrong"
        >
          <div className="@container">
            <Still
              quiz={QUIZ_FILL}
              value={FILL_WRONG}
              submitted={FILL_WRONG}
              misses={[FILL_WRONG]}
              result={response({})}
            />
          </div>
        </Demo>
        <Demo
          label="공개 (정답 낱말로 채워 보여 줌)"
          surface="card"
          data-testid="quiz-fill-revealed"
        >
          <div className="@container">
            <Still
              quiz={QUIZ_FILL}
              submitted={FILL_WRONG}
              result={response({
                attempt_no: 3,
                stars: 1,
                best_stars: 1,
                xp_awarded: 10,
                revealed: { answer: FILL_ANSWER, explanation: FILL_WHY },
              })}
            />
          </div>
        </Demo>
      </div>
    </>
  );
}

/**
 * 퀴즈 틀과 객관식 (P7-03). 상태 견본은 화면만 그리는 QuizPanel 에 고정 값을 넣고, 맨 위 견본은 이 자리에서 채점해 흐름을 직접 해 봄
 */
export function QuizSection() {
  const [round, setRound] = useState(0);
  // 견본의 "직접 실행해 보기"는 진짜 실행기 (lazy: 누르기 전엔 Pyodide를 받지 않음, P7-07)
  return (
    <MotionProvider>
      <PyodideProvider>
      <Section
        id="quiz"
        kicker="퀘스트 (P7-03)"
        title="퀴즈 틀 · 객관식"
        description="보너스 퀴즈 오른쪽 쪽: 문제 카드(눈썹 · 복습/연습 딱지 · 문제 글 · 종류별 입력 슬롯) → 채점 쪽지(정답이면 통과 도장) → 보상 띠(서버가 준 별·XP) → 아래 붙은 정답 확인/다시 풀기. 객관식 보기는 서버가 섞은 순서 그대로, 쪽 폭 30rem 미만 1열·넓으면 2열, 진짜 라디오라 Tab → 방향키로 골라요. 상태는 면 색 + 아이콘 + 글자 꼬리표(고른 답 · 정답 · 아니었어요). 틀린 답은 빨강 대신 금색."
      >
        <Demo
          key={round}
          label="직접 풀어 보기 (이 자리 채점)"
          note="0 1 2가 정답. 틀리면 다시 풀기(보기 다시 섞임, 틀린 보기 흐리게) · 3번째도 틀리면 정답 공개 ⭐1 · 끝난 뒤 다시 풀면 연습"
          surface="card"
          data-testid="quiz-live"
        >
          <button
            type="button"
            className="text-small font-semibold text-primary-text underline"
            onClick={() => setRound((r) => r + 1)}
          >
            처음부터
          </button>
          <LiveQuiz />
        </Demo>

        <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
          <Demo label="기본 (아직 안 고름)" surface="card" data-testid="quiz-default">
            <div className="@container">
              <Still />
            </div>
          </Demo>
          <Demo label="선택" note="정답 확인이 켜짐" surface="card" data-testid="quiz-selected">
            <div className="@container">
              <Still value="opt-b2mx" />
            </div>
          </Demo>
          <Demo
            label="정답 (처음 ⭐⭐⭐ +30 XP)"
            surface="card"
            data-testid="quiz-correct"
          >
            <div className="@container">
              <Still
                value={PREDICT_ANSWER}
                submitted={PREDICT_ANSWER}
                result={response({
                  correct: true,
                  stars: 3,
                  best_stars: 3,
                  xp_awarded: 30,
                  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
                })}
              />
            </div>
          </Demo>
          <Demo
            label="오답 (1번째)"
            note="고른 보기의 해설만, 정답은 알려 주지 않음"
            surface="card"
            data-testid="quiz-wrong"
          >
            <div className="@container">
              <Still
                value="opt-b2mx"
                submitted="opt-b2mx"
                misses={['opt-b2mx']}
                result={response({ explanation: PREDICT_WHY['opt-b2mx'] })}
              />
            </div>
          </Demo>
          <Demo
            label="오답 · 왜 틀렸어요? (P7-08)"
            note="누르면 파이뱀이 정답 없이 생각할 거리를 줌. 3번째 오답(정답 공개)에는 없음"
            surface="card"
            data-testid="quiz-why-button"
          >
            <div className="@container">
              <WhyStill />
            </div>
          </Demo>
          <Demo
            label="왜 틀렸어요? · 생각 중"
            note="파이뱀 생각 중 표정"
            surface="card"
            data-testid="quiz-why-thinking"
          >
            <div className="@container">
              <WhyStill explain={{ state: 'loading', text: '' }} />
            </div>
          </Demo>
          <Demo
            label="왜 틀렸어요? · 해설"
            surface="card"
            data-testid="quiz-why-done"
          >
            <div className="@container">
              <WhyStill
                explain={{
                  state: 'done',
                  text: 'range(1, 4)였다면 1부터 셌겠지요? 그런데 이 코드는 range(3)이에요. 맨 처음 i에는 어떤 숫자가 들어갈까요?',
                }}
              />
            </div>
          </Demo>
          <Demo
            label="왜 틀렸어요? · 저장된 해설"
            note="키 없음·한도·오류·정답 누출 감지 때: 고른 보기 해설 또는 종류별 안내"
            surface="card"
            data-testid="quiz-why-fallback"
          >
            <div className="@container">
              <WhyStill
                explain={{
                  state: 'done',
                  fallback: true,
                  text: `${PREDICT_WHY['opt-b2mx']} 보기를 하나씩 넣어 보고, 컴퓨터가 정말 그렇게 할지 머릿속으로 한 줄씩 따라가 봐요.`,
                }}
              />
            </div>
          </Demo>
          <Demo
            label="다시 풀기 (틀린 보기 흐리게)"
            surface="card"
            data-testid="quiz-retry-state"
          >
            <div className="@container">
              <Still
                quiz={QUIZ_CODE_OPTIONS}
                misses={['opt-x8ce']}
                value="opt-m3pd"
              />
            </div>
          </Demo>
          <Demo
            label="공개 (3번째 오답 → 정답 ⭐1 +10 XP)"
            surface="card"
            data-testid="quiz-revealed"
          >
            <div className="@container">
              <Still
                submitted="opt-w9fa"
                misses={['opt-b2mx', 'opt-r4tn']}
                result={response({
                  attempt_no: 3,
                  stars: 1,
                  best_stars: 1,
                  xp_awarded: 10,
                  revealed: {
                    answer: PREDICT_ANSWER,
                    explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
                  },
                })}
              />
            </div>
          </Demo>
          <Demo
            label="연습 (오늘 이미 별 판정)"
            note="들어올 때 안내 + 연습 딱지"
            surface="card"
            data-testid="quiz-practice"
          >
            <div className="@container">
              <Still mode="practice" bestStars={2} />
            </div>
          </Demo>
          <Demo
            label="연습 정답"
            note="연습은 별·XP 없이 안내 한 줄"
            surface="card"
            data-testid="quiz-practice-done"
          >
            <div className="@container">
              <Still
                mode="practice"
                value={PREDICT_ANSWER}
                submitted={PREDICT_ANSWER}
                result={response({
                  correct: true,
                  mode: 'practice',
                  explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
                })}
              />
            </div>
          </Demo>
          <Demo
            label="복습 도전 (다음 날부터)"
            note="별을 판정한 다음 날(KST) 들어오면. 지금 별보다 많이 받으면 늘어난 별만큼 XP"
            surface="card"
            data-testid="quiz-review"
          >
            <div className="@container">
              <Still mode="review" bestStars={1} />
            </div>
          </Demo>
        </div>

        <FeedbackDemos />
        <FillBlankDemos />
        <BugHuntDemos />
        <ParsonsDemos />
        <TryRunDemos />
      </Section>
      </PyodideProvider>
    </MotionProvider>
  );
}

/** 버그 찾기 (P7-06): 줄은 코드 순서, 수정안은 서버가 섞은 순서 */
const QUIZ_BUG: QuizPrompt = {
  kind: 'bug_hunt',
  question: '버그버그가 숨은 줄을 찾아 고쳐 볼까?',
  lines: [
    { id: 'ln-x5pc', code: 'name = "파이"' },
    { id: 'ln-h7jq', code: 'for i in range(3)' },
    { id: 'ln-q2vw', code: '    print(name, i)' },
  ],
  fixes: [
    { id: 'fx-e4kr', code: 'for i in range[3]' },
    { id: 'fx-b7nd', code: 'for i in range(3):' },
    { id: 'fx-m9ts', code: 'for i in range(3);' },
  ],
};
const BUG_ANSWER = { line: 'ln-h7jq', fix: 'fx-b7nd' };
const BUG_WHY = 'for 줄 끝에는 콜론(:)이 꼭 있어야 해요.';

/** 이 자리에서 채점 (회차 3번, 3번째 오답이면 정답 공개) */
function LiveBugHunt() {
  const [value, setValue] = useState<QuizAnswerValue | null>(null);
  const [graded, setGraded] = useState<{
    r: QuizAnswerResponse;
    v: QuizAnswerValue;
  } | null>(null);
  const [misses, setMisses] = useState<QuizAnswerValue[]>([]);
  const submit = () => {
    if (value == null || typeof value !== 'object' || !('line' in value))
      return;
    const attempt = misses.length + 1;
    const correct =
      value.line === BUG_ANSWER.line && value.fix === BUG_ANSWER.fix;
    const stars = correct ? 4 - attempt : attempt === 3 ? 1 : 0;
    setGraded({
      v: value,
      r: response({
        correct,
        attempt_no: attempt,
        stars,
        best_stars: stars,
        xp_awarded: stars * 10,
        explanation: correct ? BUG_WHY : null,
        revealed:
          !correct && attempt === 3
            ? { answer: BUG_ANSWER, explanation: BUG_WHY }
            : null,
      }),
    });
    if (!correct && attempt < 3) setMisses((m) => [...m, value]);
  };
  const retry = () => {
    if (graded?.r.correct || graded?.r.revealed) setMisses([]);
    setValue(null);
    setGraded(null);
  };
  return (
    <div className="@container max-w-xl">
      <Still
        quiz={QUIZ_BUG}
        title="버그 잡기"
        value={value}
        onChange={graded ? () => {} : setValue}
        result={graded?.r ?? null}
        submitted={graded?.v ?? null}
        misses={misses}
        onSubmit={submit}
        onRetry={retry}
      />
    </div>
  );
}

function BugHuntDemos() {
  const [round, setRound] = useState(0);
  const picked = { line: 'ln-h7jq', fix: '' };
  const wrong = { line: 'ln-h7jq', fix: 'fx-m9ts' };
  return (
    <>
      <h3 id="quiz-bughunt" className="mt-8 mb-2 text-h3 font-display">
        버그 찾기 (P7-06)
      </h3>
      <p className="mb-4 text-small text-text-muted">
        ① 코드 줄(줄 번호 + 코드, 줄마다 큰 탭 자리)에서 버그 줄을 탭 → 벌레
        표시 + 그 줄 바로 아래 수정안 쪽지 ② 수정안 카드를 고르면 원래 줄
        취소선 + 고친 줄 미리보기. 다른 줄을 고르면 수정안은 비워요. 줄·수정안
        모두 라디오 그룹.
      </p>
      <Demo
        key={round}
        label="직접 풀어 보기 (이 자리 채점)"
        note="2번 줄 + 콜론 수정안이 정답. 3번째도 틀리면 정답 공개"
        surface="card"
        data-testid="quiz-bughunt-live"
      >
        <button
          type="button"
          className="text-small font-semibold text-primary-text underline"
          onClick={() => setRound((r) => r + 1)}
        >
          처음부터
        </button>
        <LiveBugHunt />
      </Demo>
      <div className="mt-4 grid items-start gap-4 md:grid-cols-2">
        <Demo
          label="① 줄 고름 → 수정안 쪽지"
          surface="card"
          data-testid="quiz-bughunt-line"
        >
          <div className="@container">
            <Still quiz={QUIZ_BUG} value={picked} />
          </div>
        </Demo>
        <Demo
          label="② 수정안 고름 → 미리보기"
          note="같은 줄에서 틀렸던 수정안은 흐리게"
          surface="card"
          data-testid="quiz-bughunt-fix"
        >
          <div className="@container">
            <Still
              quiz={QUIZ_BUG}
              value={BUG_ANSWER}
              misses={[{ line: 'ln-h7jq', fix: 'fx-e4kr' }]}
            />
          </div>
        </Demo>
        <Demo
          label="오답"
          note="제출한 줄·수정만, 정답은 알려 주지 않음"
          surface="card"
          data-testid="quiz-bughunt-wrong"
        >
          <div className="@container">
            <Still
              quiz={QUIZ_BUG}
              value={wrong}
              submitted={wrong}
              misses={[wrong]}
              result={response({})}
            />
          </div>
        </Demo>
        <Demo
          label="공개 (3번째 오답)"
          note="정답 줄 + 정답 수정안, 제출한 줄은 고른 줄"
          surface="card"
          data-testid="quiz-bughunt-revealed"
        >
          <div className="@container">
            <Still
              quiz={QUIZ_BUG}
              submitted={{ line: 'ln-q2vw', fix: 'fx-e4kr' }}
              result={response({
                attempt_no: 3,
                stars: 1,
                best_stars: 1,
                xp_awarded: 10,
                revealed: { answer: BUG_ANSWER, explanation: BUG_WHY },
              })}
            />
          </div>
        </Demo>
      </div>
    </>
  );
}

/** 순서 맞추기 (P7-05). 들여쓰기 단계까지 정하는 구구단 견본 */
const QUIZ_PARSONS: QuizPrompt = {
  kind: 'parsons',
  question: '구구단 2단을 보여 주는 코드가 되도록 줄을 맞춰 보자',
  indent: true,
  lines: [
    { id: 'ln-m2xa', code: 'print(2, "x", i, "=", 2 * i)' },
    { id: 'ln-f5tb', code: 'print("2단 끝!")' },
    { id: 'ln-q8wd', code: 'for i in range(1, 10):' },
  ],
};
const PARSONS_ANSWER = [
  { id: 'ln-q8wd', indent: 0 },
  { id: 'ln-m2xa', indent: 1 },
  { id: 'ln-f5tb', indent: 0 },
];
const PARSONS_WRONG = [
  { id: 'ln-q8wd', indent: 0 },
  { id: 'ln-m2xa', indent: 1 },
  { id: 'ln-f5tb', indent: 1 },
];

/** 직접 정렬해 보기: 이 자리 채점 (순서·들여쓰기 모두 맞아야) */
function LiveParsons() {
  const [value, setValue] = useState<QuizAnswerValue | null>(null);
  const [graded, setGraded] = useState<QuizAnswerResponse | null>(null);
  const [submitted, setSubmitted] = useState<QuizAnswerValue | null>(null);
  const submit = () => {
    const correct = JSON.stringify(value) === JSON.stringify(PARSONS_ANSWER);
    setSubmitted(value);
    setGraded(
      response({
        correct,
        stars: correct ? 3 : 0,
        best_stars: correct ? 3 : 0,
        xp_awarded: correct ? 30 : 0,
        explanation: correct ? 'for 안의 줄만 한 칸 들여 써요.' : null,
      }),
    );
  };
  return (
    <div className="@container">
      <QuizPanel
        {...base}
        title="구구단 줄 맞추기"
        quiz={QUIZ_PARSONS}
        value={value}
        onChange={graded ? () => {} : setValue}
        status={quizStatus(graded)}
        result={graded}
        submitted={submitted}
        misses={[]}
        mode="first"
        onSubmit={submit}
        onRetry={() => {
          setGraded(null);
          setValue(null);
        }}
      />
    </div>
  );
}

function ParsonsDemos() {
  const q = { ...base, title: '구구단 줄 맞추기', quiz: QUIZ_PARSONS };
  return (
    <div className="mt-8 space-y-4" data-testid="quiz-parsons">
      <h3 className="font-display text-h3">순서 맞추기 (P7-05)</h3>
      <p className="max-w-3xl text-small text-muted-foreground">
        아래 줄 조각을 누르면 내 코드 맨 아래에 붙고, 내 코드의 줄을 누르면
        돌아가요. 손잡이를 끌거나 위/아래 버튼으로 순서를, 들여쓰기 퀴즈면 ← →
        버튼으로 0~4칸을 정해요(점선 안내선). 틀리면 어느 줄인지는 알려 주지
        않고 &quot;어딘가 순서가 달라요&quot;, 정답 공개는 정답 순서로.
      </p>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Demo
          label="직접 맞춰 보기 (들여쓰기)"
          note="for → print(한 칸) → print(0칸)"
          surface="card"
          data-testid="quiz-parsons-live"
        >
          <LiveParsons />
        </Demo>
        <Demo label="반쯤 쌓음" surface="card" data-testid="quiz-parsons-partial">
          <div className="@container">
            <Still {...q} value={PARSONS_ANSWER.slice(0, 2)} />
          </div>
        </Demo>
        <Demo
          label="오답 (제출 순서 그대로)"
          note="어느 줄이 틀렸는지는 정답이라 표시 안 함"
          surface="card"
          data-testid="quiz-parsons-wrong"
        >
          <div className="@container">
            <Still
              {...q}
              value={PARSONS_WRONG}
              submitted={PARSONS_WRONG}
              result={response({})}
            />
          </div>
        </Demo>
        <Demo
          label="공개 (정답 순서)"
          surface="card"
          data-testid="quiz-parsons-revealed"
        >
          <div className="@container">
            <Still
              {...q}
              submitted={PARSONS_WRONG}
              result={response({
                attempt_no: 3,
                stars: 1,
                best_stars: 1,
                xp_awarded: 10,
                revealed: {
                  answer: PARSONS_ANSWER,
                  explanation: 'for 안의 줄만 한 칸 들여 써요.',
                },
              })}
            />
          </div>
        </Demo>
      </div>
    </div>
  );
}

/** "직접 실행해 보기" 상태 견본용 실행기 (진짜 Worker 대신 고정 상태) */
function stillRunner(
  status: 'loading' | 'ready',
  stdout = '',
): Parameters<typeof QuizTryRunView>[0]['runtime'] {
  return {
    status,
    restarting: null,
    loadStage: status === 'loading' ? 'download' : null,
    isRunning: false,
    runCode: async (): Promise<RunResult> => ({
      stdout,
      stderr: '',
      success: true,
    }),
    stop: () => {},
    retry: () => {},
  };
}
const TRY_CODE = QUIZ_PREDICT.kind === 'multiple_choice' ? QUIZ_PREDICT.code! : '';
const TRY_EDITED = 'for i in range(5):\n    print(i)';

/** 정답 뒤 "직접 실행해 보기" (P7-07, §12-Q60 4b 코드 바꿔 보기) */
function TryRunDemos() {
  return (
    <div className="mt-8 space-y-4" data-testid="quiz-try-demos">
      <h3 id="quiz-try" className="mb-2 text-h3 font-display">
        직접 실행해 보기 (P7-07)
      </h3>
      <p className="text-small text-muted-foreground">
        정답(또는 정답 공개) 뒤 채점 쪽지 아래 버튼. 맞힌 답으로 조립한 코드(출력 예측형 객관식은 문제 코드, 빈칸은 채운 코드, 순서는
        정답 순서 + 들여쓰기, 버그 찾기는 고친 줄)가 공책 에디터에 들어가고, 코드 퀘스트와 같은 실행 줄·결과 쪽지로 돌려요. 실행기는 이
        버튼을 누를 때 처음 불러와요. 도전 문구는 코드에서 자동(숫자 → 글자 → 한 줄). 바꿔 돌려도 채점·보상과 무관, &quot;처음
        코드로&quot;로 되돌리기. 문제 코드가 없는 객관식은 버튼 없음.
      </p>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <Demo
          label="버튼 (정답 뒤) — 진짜 실행기"
          note="누르면 Pyodide를 이때 처음 받아요"
          surface="card"
          data-testid="quiz-try-button"
        >
          <div className="@container">
            <Still
              value={PREDICT_ANSWER}
              submitted={PREDICT_ANSWER}
              result={response({
                correct: true,
                stars: 3,
                best_stars: 3,
                xp_awarded: 30,
                explanation: 'range(3)은 0, 1, 2 세 번 돌아요.',
              })}
            />
          </div>
        </Demo>
        <Demo label="열림 · 실행기 불러오는 중" surface="card" data-testid="quiz-try-loading">
          <QuizTryRunView code={TRY_CODE} kind="multiple_choice" runtime={stillRunner('loading')} />
        </Demo>
        <Demo label="출력" surface="card" data-testid="quiz-try-output">
          <QuizTryRunView
            code={TRY_CODE}
            kind="multiple_choice"
            runtime={stillRunner('ready', '0\n1\n2\n')}
            initial={{ result: { stdout: '0\n1\n2\n', stderr: '', success: true } }}
          />
        </Demo>
        <Demo
          label="코드 바꿔 실행"
          note="range(5)로 바꿔 돌림 · 처음 코드로가 켜짐"
          surface="card"
          data-testid="quiz-try-edited"
        >
          <QuizTryRunView
            code={TRY_CODE}
            kind="multiple_choice"
            runtime={stillRunner('ready', '0\n1\n2\n3\n4\n')}
            initial={{
              code: TRY_EDITED,
              result: { stdout: '0\n1\n2\n3\n4\n', stderr: '', success: true },
            }}
          />
        </Demo>
      </div>
    </div>
  );
}
