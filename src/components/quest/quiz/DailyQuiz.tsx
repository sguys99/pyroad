'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarCheck, Check, Flame, Map } from 'lucide-react';

import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { track } from '@/lib/analytics/track';
import type { DailyQuizResult } from '@/lib/quest/dailyQuiz';
import type { QuizAnswerResponse } from '@/lib/quest/quizAnswer';
import { useQuizSession } from '@/lib/quest/useQuizSession';
import { formatKstDate } from '@/lib/time/kst';
import type { QuestWithStage, UserProgress } from '@/lib/types/database';
import { QuestStatusBar } from '../QuestStatusBar';
import { CelebrationLayer } from '../QuestWorkspace';
import { QuizPanel } from './QuizPanel';
import '../questWorkspace.css';
import './quiz.css';
import './daily.css';

export interface DailyItem {
  /** 정답 필드를 지우고 보기를 섞은 퀴즈 퀘스트 (서버) */
  quest: QuestWithStage;
  progress: UserProgress | null;
  /** 오늘 고를 때 복습 칸이었는지 */
  review: boolean;
}

/** 한 문제의 오늘 결과. xp 는 이 화면에서 푼 것만 알 수 있음(다시 들어오면 null) */
export interface DailyOutcome {
  status: DailyQuizResult;
  stars: number;
  bestStars: number;
  xp: number | null;
}

const MAP_HREF = '/world';

/** 서버가 센 오늘 결과 → 요약용 (별은 오늘 판정한 별, 연습이면 0) */
function initialOutcomes(
  items: readonly DailyItem[],
  results: Record<string, DailyQuizResult>,
  today: string,
): Record<string, DailyOutcome> {
  const out: Record<string, DailyOutcome> = {};
  for (const { quest, progress } of items) {
    const status = results[quest.id];
    if (!status) continue;
    out[quest.id] = {
      status,
      stars: progress?.stars_judged_on === today ? (progress.stars ?? 0) : 0,
      bestStars: progress?.best_stars ?? 0,
      xp: null,
    };
  }
  return out;
}

/**
 * 오늘의 퀴즈 화면 (P7-10, `/daily`): 머리(지도로 · 날짜 · 진행 점) → 문제 쪽 하나(QuizPanel, 퀴즈 퀘스트와 같은 useQuizSession) →
 * 다 풀면 요약 쪽지. 문제마다 세션을 새로 열고(key) 콤보는 탭 스토어로 이어짐. 이미 오늘 다 풀었으면 요약으로 시작.
 * 서버가 router.refresh() 로 새 목록을 줘도 이 화면은 처음 받은 목록을 지킴 (같은 날 같은 문제)
 */
export function DailyQuiz({
  items,
  results,
  today,
  userId,
  initialXP,
  initialLevel,
}: {
  items: DailyItem[];
  results: Record<string, DailyQuizResult>;
  today: string;
  userId: string;
  initialXP: number;
  initialLevel: number;
}) {
  const [list] = useState(items);
  const [start] = useState(() => initialOutcomes(items, results, today));
  const [outcomes, setOutcomes] = useState(start);
  const [step, setStep] = useState(() => {
    const i = list.findIndex((it) => !(it.quest.id in start));
    return i === -1 ? list.length : i;
  });
  const [xp, setXP] = useState(initialXP);
  const [level, setLevel] = useState(initialLevel);
  const [maxCombo, setMaxCombo] = useState(0);

  const doneCount = list.filter((it) => it.quest.id in outcomes).length;
  const startDone = Object.keys(start).length;

  useEffect(() => {
    track('daily_quiz_open', { total: list.length, done: startDone });
  }, [list.length, startDone]);

  // 이 화면에서 마지막 문제를 끝냈을 때 한 번
  const finished = useRef(startDone === list.length);
  useEffect(() => {
    if (finished.current || list.length === 0 || doneCount < list.length)
      return;
    finished.current = true;
    const all = Object.values(outcomes);
    track('daily_quiz_finish', {
      correct: all.filter((o) => o.status === 'correct').length,
      stars: all.reduce((n, o) => n + o.stars, 0),
    });
  }, [doneCount, list.length, outcomes]);

  const onEnd = useCallback((id: string, r: QuizAnswerResponse) => {
    // 한 문제는 처음 끝난 결과만 (그 뒤 "한 번 더 풀어 보기"는 연습)
    setOutcomes((o) =>
      id in o
        ? o
        : {
            ...o,
            [id]: {
              status: r.correct ? 'correct' : 'revealed',
              stars: r.stars,
              bestStars: r.best_stars,
              xp: r.xp_awarded,
            },
          },
    );
    if (r.stars > 0) {
      setXP(r.total_xp);
      setLevel(r.level_after);
    }
  }, []);
  const onCombo = useCallback(
    (n: number) => setMaxCombo((m) => Math.max(m, n)),
    [],
  );

  // 다음 문제·요약으로 넘어가면 그 제목으로 초점 (누른 버튼이 사라져 초점이 body 로 빠지지 않게, P7-13). 처음 열 때는 그대로
  const main = useRef<HTMLElement>(null);
  const firstStep = useRef(step);
  useEffect(() => {
    if (step === firstStep.current) return;
    firstStep.current = -1;
    main.current
      ?.querySelector<HTMLElement>('h2')
      ?.focus({ preventScroll: true });
  }, [step]);

  const current = list[step];
  return (
    <div className="dq flex min-h-dvh flex-col bg-bg" data-testid="daily-quiz">
      <header className="dq-head">
        <Link href={MAP_HREF} className="dq-back">
          <ArrowLeft aria-hidden className="size-4" />
          월드맵
        </Link>
        <div className="dq-title">
          <span className="dq-k font-sans">
            {formatKstDate(today, 'monthDay')}
          </span>
          <h1 className="dq-t font-display">오늘의 퀴즈</h1>
        </div>
        {list.length > 0 && (
          <DailyDots
            items={list.map((it) => ({
              id: it.quest.id,
              outcome: outcomes[it.quest.id],
            }))}
            step={step}
          />
        )}
      </header>

      <main className="dq-main" ref={main}>
        {list.length === 0 ? (
          <DailyEmpty />
        ) : current ? (
          <div key={current.quest.id} className="dq-sheet">
            <DailyQuestion
              item={current}
              userId={userId}
              xp={xp}
              level={level}
              last={step === list.length - 1}
              onEnd={onEnd}
              onCombo={onCombo}
              onNext={() => setStep((s) => s + 1)}
            />
          </div>
        ) : (
          <DailySummary
            outcomes={list.flatMap((it) => outcomes[it.quest.id] ?? [])}
            maxCombo={startDone === list.length ? null : maxCombo}
          />
        )}
      </main>

      {!current && <QuestStatusBar xp={xp} level={level} earnedXP={null} />}
    </div>
  );
}

/** 문제 하나: 퀴즈 퀘스트와 같은 세션·패널, 다음 버튼만 같은 화면 안으로 */
function DailyQuestion({
  item,
  userId,
  xp,
  level,
  last,
  onEnd,
  onCombo,
  onNext,
}: {
  item: DailyItem;
  userId: string;
  xp: number;
  level: number;
  last: boolean;
  onEnd: (id: string, r: QuizAnswerResponse) => void;
  onCombo: (n: number) => void;
  onNext: () => void;
}) {
  const s = useQuizSession({
    quest: item.quest,
    progress: item.progress,
    userId,
    initialXP: xp,
    initialLevel: level,
    initialGoldenKeys: 0,
  });
  const { result, combo } = s;
  const id = item.quest.id;
  useEffect(() => {
    if (result && (result.correct || result.revealed)) onEnd(id, result);
  }, [result, id, onEnd]);
  useEffect(() => onCombo(combo), [combo, onCombo]);

  return (
    <>
      <div className="dq-page">
        <QuizPanel
          title={item.quest.title}
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
          nextHref={null}
          mapHref={MAP_HREF}
          onNext={onNext}
          nextLabel={last ? '오늘 결과 보기' : '다음 문제'}
        />
      </div>
      <QuestStatusBar xp={s.userXP} level={s.userLevel} earnedXP={s.earnedXP} />
      <CelebrationLayer session={s} worldHref={MAP_HREF} />
    </>
  );
}

/** 머리 진행 점: 끝난 문제는 별(정답 공개는 전구 대신 점선), 지금 문제는 강조. 글자로도 상태를 읽어 줌 */
export function DailyDots({
  items,
  step,
}: {
  items: { id: string; outcome?: DailyOutcome }[];
  step: number;
}) {
  const done = items.filter((it) => it.outcome).length;
  return (
    <ol
      className="dq-dots"
      aria-label={`오늘의 퀴즈 진행, ${items.length}문제 중 ${done}문제 풀었어요`}
    >
      {items.map(({ id, outcome }, i) => {
        const state = outcome
          ? outcome.status
          : i === step
            ? 'current'
            : 'todo';
        const label = `${i + 1}번 문제: ${
          outcome
            ? outcome.status === 'correct'
              ? `정답${outcome.stars ? `, 별 ${outcome.stars}개` : ''}`
              : '정답 공개'
            : i === step
              ? '지금 푸는 중'
              : '아직'
        }`;
        return (
          <li
            key={id}
            className="dq-dot"
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            data-testid="daily-dot"
          >
            <span className="sr-only">{label}</span>
            <span aria-hidden className="dq-dot-face">
              {outcome?.status === 'correct' ? (
                <Check strokeWidth={3} />
              ) : (
                i + 1
              )}
            </span>
            {outcome && outcome.stars > 0 && (
              <span aria-hidden className="dq-dot-stars">
                {Array.from({ length: outcome.stars }, (_, k) => (
                  <RewardIcon key={k} kind="star" size={12} />
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 끝 요약 쪽지: 맞힌 수 · 받은 별 · XP · 최고 콤보 + 내일 복습 안내. 다시 들어온 날은 XP·콤보를 모르면 뺌 */
export function DailySummary({
  outcomes,
  maxCombo,
}: {
  outcomes: readonly DailyOutcome[];
  /** 이 화면에서 본 최고 콤보 (다시 들어오면 null) */
  maxCombo: number | null;
}) {
  const total = outcomes.length;
  const correct = outcomes.filter((o) => o.status === 'correct').length;
  const stars = outcomes.reduce((n, o) => n + o.stars, 0);
  const xp = outcomes.every((o) => o.xp !== null)
    ? outcomes.reduce((n, o) => n + (o.xp ?? 0), 0)
    : null;
  const reviewLeft = outcomes.filter((o) => o.bestStars < 3).length;
  const all = correct === total;
  return (
    <section
      className="dq-sum"
      aria-labelledby="daily-sum-title"
      data-testid="daily-summary"
    >
      <span className="dq-sum-rig" aria-hidden>
        <PybaemStatic
          state={all ? 'cheer' : 'wave'}
          size={88}
          label=""
          filters={false}
        />
      </span>
      <p className="dq-k font-sans">
        <CalendarCheck aria-hidden className="size-4" />
        오늘의 퀴즈 끝!
      </p>
      <h2 id="daily-sum-title" className="dq-sum-t font-display" tabIndex={-1}>
        {total}문제 중 {correct}문제 맞혔어요
      </h2>
      <ul className="dq-sum-row" aria-label="오늘 받은 것">
        <li className="dq-sum-item" data-testid="daily-sum-stars">
          <RewardIcon kind="star" size={26} />
          <span className="sr-only">별 {stars}개</span>
          <b aria-hidden>{stars}</b>
          <span className="dq-sum-u" aria-hidden>
            별
          </span>
        </li>
        {xp !== null && (
          <li className="dq-sum-item" data-testid="daily-sum-xp">
            <span className="dq-sum-xp" aria-hidden>
              XP
            </span>
            <b>+{xp}</b>
            <span className="sr-only">XP</span>
          </li>
        )}
        {maxCombo !== null && maxCombo >= 2 && (
          <li className="dq-sum-item" data-testid="daily-sum-combo">
            <Flame aria-hidden className="dq-sum-flame" />
            <span className="sr-only">최고 {maxCombo}연속 정답</span>
            <b aria-hidden>{maxCombo}</b>
            <span className="dq-sum-u" aria-hidden>
              연속
            </span>
          </li>
        )}
      </ul>
      <p className="dq-sum-note">
        내일 또 만나요!{' '}
        {reviewLeft > 0
          ? `별이 3개가 안 된 퀴즈 ${reviewLeft}개는 내일 복습 도전으로 별을 더 모을 수 있어요.`
          : '내일은 새 퀴즈와 복습 도전이 기다려요.'}
      </p>
      <Button
        href={MAP_HREF}
        icon={<Map aria-hidden />}
        data-testid="daily-to-map"
      >
        월드맵으로
      </Button>
    </section>
  );
}

/** 열린 퀴즈가 아직 없음 */
export function DailyEmpty() {
  return (
    <section className="dq-sum" data-testid="daily-empty">
      <span className="dq-sum-rig" aria-hidden>
        <PybaemStatic state="wave" size={88} label="" filters={false} />
      </span>
      <h2 className="dq-sum-t font-display">아직 풀 퀴즈가 없어요</h2>
      <p className="dq-sum-note">
        첫 스테이지를 지나면 오늘의 퀴즈가 열려요. 먼저 모험을 떠나 볼까요?
      </p>
      <Button href={MAP_HREF} icon={<Map aria-hidden />}>
        월드맵으로
      </Button>
    </section>
  );
}
