'use client';

import { useState } from 'react';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { DialogueBox } from '@/components/ui/dialogue-box';
import { PybaemRig } from '@/components/characters/rig/MascotRig';
import {
  QuizPanel,
  type QuizPanelProps,
} from '@/components/quest/quiz/QuizPanel';
import { quizLine } from '@/components/quest/quiz/QuizQuest';
import type { QuizPrompt } from '@/lib/quest/questKind';
import type {
  QuizAnswerResponse,
  QuizAnswerValue,
} from '@/lib/quest/quizAnswer';
import { quizStatus, type QuizMode } from '@/lib/quest/useQuizSession';
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
  const status = quizStatus(graded?.r ?? null);
  const line = quizLine(status, mode, graded?.r.attempt_no);

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
        />
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
  return (
    <MotionProvider>
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

        <FillBlankDemos />
      </Section>
    </MotionProvider>
  );
}
