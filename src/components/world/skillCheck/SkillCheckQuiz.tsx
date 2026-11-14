'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Compass,
  EyeOff,
  Gift,
  Library,
  Map as MapIcon,
  RotateCcw,
} from 'lucide-react';

import { MyPybaemStatic } from '@/components/profile/MyLook';
import { useSfx } from '@/components/providers/soundContext';
import { QUIZ_INPUTS } from '@/components/quest/quiz/quizInputs';
import type { QuizInputDef } from '@/components/quest/quiz/types';
import { Button } from '@/components/ui/button';
import { fireConfetti } from '@/lib/confetti';
import { withObjectParticle, withParticle } from '@/lib/korean';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import type { QuizKind, QuizPrompt } from '@/lib/quest/questKind';
import type { QuizAnswerValue } from '@/lib/quest/quizAnswer';
import {
  SKILL_CHECK_QUESTIONS,
  skillCheckPassScore,
  type SkillCheckResult,
  type SkillCheckStartResponse,
} from '@/lib/world/skillCheck';
import { worldPath } from '@/lib/world/worldBook';
import '@/components/quest/questWorkspace.css';
import '@/components/quest/quiz/quiz.css';
import '@/components/quest/quiz/daily.css';
import './skillCheck.css';

/** 화면 상태: 처음 들어올 때 서버(페이지)가 정함 */
export type SkillCheckInitial =
  | { kind: 'ready' }
  | { kind: 'done'; result: Omit<SkillCheckResult, 'first_stage_id'> }
  | { kind: 'open' }
  | { kind: 'soon' };

type Phase =
  | { kind: 'intro' }
  | { kind: 'quiz'; questions: QuizPrompt[] }
  | { kind: 'result'; result: Omit<SkillCheckResult, 'first_stage_id'> }
  | { kind: 'open' }
  | { kind: 'soon' };

export interface SkillCheckQuizProps {
  slug: string;
  /** 열 월드 (예: 코드 바다) */
  worldTitle: string;
  /** 앞 월드 (예: 파이썬 섬) */
  prevTitle: string;
  initial: SkillCheckInitial;
}

const API = '/api/world/skill-check';

/**
 * 실력 확인 퀴즈 화면 (P10-03, `/world/[slug]/skill-check`, docs/curriculum/world2.md §7).
 * 안내 → (시작하면 오늘 도전을 씀) 10문제를 한 장씩 → 한 번에 채점 → 결과. 문제 입력은 퀴즈 입력 컴포넌트(QUIZ_INPUTS) 그대로.
 * 문제마다 맞았는지는 알려 주지 않고(하루 1번 시험), 결과도 점수와 "더 연습하면 좋은 단계"만 — 정답·해설은 보여 주지 않음.
 * 합격하면 그 월드 지도로 보내고, 지도가 첫 스테이지 잠금 해제 연출(P5-05)을 튼다
 */
export function SkillCheckQuiz({
  slug,
  worldTitle,
  prevTitle,
  initial,
}: SkillCheckQuizProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    initial.kind === 'ready'
      ? { kind: 'intro' }
      : initial.kind === 'done'
        ? { kind: 'result', result: initial.result }
        : initial,
  );
  const [passedNow, setPassedNow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(body: object): Promise<unknown> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setError(json?.error ?? '앗, 잠깐 문제가 생겼어요. 다시 해 볼까요?');
        return null;
      }
      return json;
    } catch {
      setError('인터넷 연결을 확인하고 다시 해 볼까요?');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    const r = (await call({ world: slug })) as SkillCheckStartResponse | null;
    if (!r) return;
    if (r.status === 'ready')
      setPhase({ kind: 'quiz', questions: r.questions });
    else if (r.status === 'done')
      setPhase({ kind: 'result', result: r.result });
    else setPhase({ kind: 'open' });
  }

  async function submit(answers: QuizAnswerValue[]) {
    const r = (await call({ world: slug, answers })) as SkillCheckResult | null;
    if (!r) return;
    setPassedNow(r.passed);
    setPhase({ kind: 'result', result: r });
  }

  const mapHref = worldPath(slug);
  return (
    <div
      className="dq sk flex min-h-dvh flex-col bg-bg"
      data-testid="skill-check"
    >
      <header className="dq-head">
        <Link href="/worlds" className="dq-back">
          <ArrowLeft aria-hidden className="size-4" />
          책장
        </Link>
        <div className="dq-title">
          <span className="dq-k font-sans">{worldTitle} 가는 길</span>
          <h1 className="dq-t font-display">실력 확인 퀴즈</h1>
        </div>
      </header>

      <main className="dq-main">
        {phase.kind === 'intro' && (
          <SkillCheckIntro
            worldTitle={worldTitle}
            prevTitle={prevTitle}
            busy={busy}
            error={error}
            onStart={start}
          />
        )}
        {phase.kind === 'quiz' && (
          <SkillCheckQuestions
            key={phase.questions.map((q) => q.question).join('|')}
            questions={phase.questions}
            busy={busy}
            error={error}
            onSubmit={submit}
            onRestart={start}
          />
        )}
        {phase.kind === 'result' && (
          <SkillCheckResultCard
            result={phase.result}
            worldTitle={worldTitle}
            mapHref={mapHref}
            celebrate={passedNow}
          />
        )}
        {phase.kind === 'open' && (
          <SkillCheckNote
            title={`${withParticle(worldTitle, '은', '는')} 이미 열려 있어요`}
            text="지도를 펼쳐 모험을 이어 가요!"
            href={mapHref}
            label={`${worldTitle} 지도로`}
          />
        )}
        {phase.kind === 'soon' && (
          <SkillCheckNote
            title={`${withParticle(worldTitle, '은', '는')} 아직 만들고 있어요`}
            text="책이 완성되면 실력 확인 퀴즈로 바로 갈 수 있어요. 조금만 기다려 주세요!"
            href="/worlds"
            label="책장 보기"
          />
        )}
      </main>
    </div>
  );
}

/** 안내 쪽: 규칙 다섯 줄 + 시작하기 (시작하면 오늘 도전을 씀) */
export function SkillCheckIntro({
  worldTitle,
  prevTitle,
  busy = false,
  error = null,
  onStart,
}: {
  worldTitle: string;
  prevTitle: string;
  busy?: boolean;
  error?: string | null;
  onStart?: () => void;
}) {
  const pass = skillCheckPassScore(SKILL_CHECK_QUESTIONS);
  return (
    <section
      className="dq-sum sk-intro"
      aria-labelledby="sk-intro-t"
      data-testid="skill-check-intro"
    >
      <span className="dq-sum-rig" aria-hidden>
        <MyPybaemStatic state="wave" size={88} label="" filters={false} />
      </span>
      <h2 id="sk-intro-t" className="dq-sum-t font-display">
        {withObjectParticle(prevTitle)} 이미 잘 알아요?
      </h2>
      <p className="dq-sum-note">
        {SKILL_CHECK_QUESTIONS}문제 중 {pass}문제를 맞히면 {worldTitle}의 첫
        스테이지가 바로 열려요.
      </p>
      <ul className="sk-rules">
        <li>
          <ClipboardCheck aria-hidden />
          객관식·빈칸·순서·버그 찾기 {SKILL_CHECK_QUESTIONS}문제를 다 풀고 한
          번에 채점해요.
        </li>
        <li>
          <CalendarClock aria-hidden />
          하루에 한 번 도전할 수 있어요. 시작하면 오늘 도전을 써요.
        </li>
        <li>
          <EyeOff aria-hidden />
          정답은 알려 주지 않아요. 대신 더 연습하면 좋은 단계를 알려 줘요.
        </li>
        <li>
          <Gift aria-hidden />
          XP·코인은 없어요. {prevTitle} 모험은 그대로 이어 갈 수 있어요.
        </li>
      </ul>
      {error && (
        <p className="qz-error" role="alert">
          {error}
        </p>
      )}
      <Button
        size="lg"
        onClick={onStart}
        loading={busy}
        icon={<ClipboardCheck aria-hidden />}
        data-testid="skill-check-start"
      >
        시작하기
      </Button>
    </section>
  );
}

/** 문제 쪽: 한 장씩, 앞뒤로 오가며 고칠 수 있고 마지막에 한 번에 채점 */
function SkillCheckQuestions({
  questions,
  busy,
  error,
  onSubmit,
  onRestart,
}: {
  questions: QuizPrompt[];
  busy: boolean;
  error: string | null;
  onSubmit: (answers: QuizAnswerValue[]) => void;
  onRestart: () => void;
}) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<(unknown | null)[]>(() =>
    questions.map(() => null),
  );
  const qid = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  // 문제를 넘기면 그 제목으로 초점 (누른 버튼이 사라져도 초점이 body 로 빠지지 않게, 퀴즈와 같은 규칙 P7-13)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
  }, [step]);

  const quiz = questions[step];
  const def = QUIZ_INPUTS[quiz.kind] as QuizInputDef<QuizKind> | undefined;
  const done = (i: number) => {
    const d = QUIZ_INPUTS[questions[i].kind] as
      | QuizInputDef<QuizKind>
      | undefined;
    return !!d && d.isComplete(values[i] as never, questions[i] as never);
  };
  const last = step === questions.length - 1;
  const allDone = questions.every((_, i) => done(i));
  // 날짜가 바뀌어 오늘 시작 기록이 없으면 새 묶음으로 다시 시작
  const stale = error?.includes('날짜가 바뀌었어요');

  return (
    <div className="dq-sheet">
      <div className="dq-page">
        <div className="qz sk-q">
          <SkillCheckDots
            total={questions.length}
            step={step}
            answered={questions.map((_, i) => done(i))}
          />
          <section className="qz-card" aria-labelledby={qid}>
            <div className="qz-head">
              <span className="qz-k" data-testid="skill-check-round">
                <ClipboardCheck aria-hidden />
                문제 {step + 1} / {questions.length}
                {def ? ` · ${def.label}` : ''}
              </span>
            </div>
            <h2 id={qid} className="qz-q" ref={heading} tabIndex={-1}>
              {quiz.question}
            </h2>
            {def && (
              <div className="qz-input" key={step}>
                <def.Input
                  quiz={quiz as never}
                  value={values[step] as never}
                  onChange={(v: unknown) =>
                    setValues((vs) => vs.map((x, i) => (i === step ? v : x)))
                  }
                  disabled={busy}
                  result={null}
                  misses={[]}
                  labelledBy={qid}
                />
              </div>
            )}
          </section>

          <div className="qz-actions sk-actions">
            {error && (
              <p className="qz-error" role="alert">
                {error}
              </p>
            )}
            {stale ? (
              <Button
                size="lg"
                onClick={onRestart}
                loading={busy}
                icon={<RotateCcw aria-hidden />}
              >
                오늘 문제로 다시 시작
              </Button>
            ) : (
              <div className="sk-nav">
                <Button
                  variant="secondary"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={step === 0 || busy}
                  icon={<ArrowLeft aria-hidden />}
                  data-testid="skill-check-prev"
                >
                  이전
                </Button>
                {last ? (
                  <Button
                    onClick={() => onSubmit(values as QuizAnswerValue[])}
                    disabled={!allDone}
                    loading={busy}
                    icon={<Check aria-hidden />}
                    data-testid="skill-check-submit"
                  >
                    {allDone ? '채점하기' : '모두 풀어요'}
                  </Button>
                ) : (
                  <Button
                    onClick={() => setStep((s) => s + 1)}
                    disabled={!done(step)}
                    iconRight={<ArrowRight aria-hidden />}
                    data-testid="skill-check-next"
                  >
                    다음 문제
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 진행 점: 지금 문제 = 두 겹 테, 답을 고른 문제 = 채운 점. 맞았는지는 보여 주지 않음 */
export function SkillCheckDots({
  total,
  step,
  answered,
}: {
  total: number;
  step: number;
  answered: readonly boolean[];
}) {
  const count = answered.filter(Boolean).length;
  return (
    <ol
      className="sk-dots"
      aria-label={`${total}문제 중 ${count}문제 답을 골랐어요`}
    >
      {Array.from({ length: total }, (_, i) => {
        const state =
          i === step ? 'current' : answered[i] ? 'answered' : 'todo';
        return (
          <li
            key={i}
            className="sk-dot"
            data-state={state}
            aria-current={i === step ? 'step' : undefined}
          >
            <span className="sr-only">
              {i + 1}번 문제:{' '}
              {i === step ? '지금' : answered[i] ? '답 고름' : '아직'}
            </span>
            <span aria-hidden>{i + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 결과 쪽지: 합격(새 월드로 출발) / 아쉬움(점수 + 더 연습하면 좋은 단계 + 내일 다시). 정답·해설 없음 */
export function SkillCheckResultCard({
  result,
  worldTitle,
  mapHref,
  celebrate = false,
  autoFocus = true,
}: {
  result: Omit<SkillCheckResult, 'first_stage_id'>;
  worldTitle: string;
  mapHref: string;
  /** 방금 합격 (컨페티·효과음 한 번) */
  celebrate?: boolean;
  /** 결과가 나오면 제목으로 초점 (카탈로그는 끔) */
  autoFocus?: boolean;
}) {
  const { budget } = useMotionTier();
  const sfx = useSfx();
  const fired = useRef(false);
  useEffect(() => {
    if (!celebrate || fired.current) return;
    fired.current = true;
    sfx('celebrate');
    if (budget.particles > 0)
      fireConfetti(
        { particleCount: 90, spread: 75, origin: { y: 0.55 } },
        { scale: budget.particles },
      );
  }, [celebrate, budget.particles, sfx]);

  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) heading.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const { score, total, pass_score: pass, passed, practice } = result;
  return (
    <section
      className="dq-sum sk-result"
      aria-labelledby="sk-result-t"
      data-passed={passed}
      data-testid="skill-check-result"
    >
      <span className="dq-sum-rig" aria-hidden>
        <MyPybaemStatic
          state={passed ? 'cheer' : 'wave'}
          size={88}
          label=""
          filters={false}
        />
      </span>
      <p className="dq-k font-sans">
        <ClipboardCheck aria-hidden className="size-4" />
        {passed ? '실력 인정!' : '실력 확인 퀴즈 결과'}
      </p>
      <h2
        id="sk-result-t"
        ref={heading}
        tabIndex={-1}
        className="dq-sum-t font-display"
      >
        {passed
          ? `합격! ${withParticle(worldTitle, '이', '가')} 열렸어요`
          : `${total}문제 중 ${score}문제 맞혔어요`}
      </h2>
      <p className="sk-score" data-testid="skill-check-score">
        <b className="font-display">{score}</b>
        <span aria-hidden> / </span>
        <span className="sr-only">점, 만점 </span>
        {total}
        <span className="sk-score-u">
          {passed ? '합격' : `${pass}문제부터 합격`}
        </span>
      </p>
      {practice.length > 0 && (
        <div className="sk-practice" data-testid="skill-check-practice">
          <h3 className="sk-practice-t">
            <Compass aria-hidden className="size-4" />더 연습하면 좋은 단계
          </h3>
          <ul>
            {practice.map((p) => (
              <li key={p.stage_id}>
                <Link
                  href={`${worldPath(p.world_slug)}?stage=${p.stage_id}`}
                  className="sk-practice-a"
                >
                  <span className="sk-practice-n">{p.stage_order}단계</span>
                  <span className="sk-practice-s">{p.stage_title}</span>
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="dq-sum-note">
        {passed
          ? `${worldTitle} 첫 스테이지가 기다려요. 앞 월드 퀘스트도 언제든 다시 풀 수 있어요.`
          : '정답은 알려 주지 않아요. 위 단계를 연습하고 내일 다시 도전해요!'}
      </p>
      {passed ? (
        <Button
          size="lg"
          href={mapHref}
          icon={<MapIcon aria-hidden />}
          data-testid="skill-check-go"
        >
          {worldTitle} 지도 펼치기
        </Button>
      ) : (
        <Button href="/world" icon={<MapIcon aria-hidden />}>
          모험 지도로
        </Button>
      )}
    </section>
  );
}

/** 열렸거나 준비 중인 월드 */
function SkillCheckNote({
  title,
  text,
  href,
  label,
}: {
  title: string;
  text: string;
  href: string;
  label: string;
}) {
  return (
    <section className="dq-sum" data-testid="skill-check-note">
      <span className="dq-sum-rig" aria-hidden>
        <MyPybaemStatic state="happy" size={88} label="" filters={false} />
      </span>
      <h2 className="dq-sum-t font-display">{title}</h2>
      <p className="dq-sum-note">{text}</p>
      <Button href={href} icon={<Library aria-hidden />}>
        {label}
      </Button>
    </section>
  );
}
