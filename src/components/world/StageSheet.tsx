'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  Check,
  Code2,
  Crown,
  MessageCircleQuestion,
  RotateCcw,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { StageWithStatus } from '@/lib/types/database';
import type { WorldId } from '@/lib/design/tokens';
import type { StageQuestItem } from '@/lib/world/mapData';
import { SHOW_CHEST, SHOW_STARS } from '@/lib/world/flags';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSfx } from '@/components/providers/soundContext';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon, Stars } from '@/components/ui/reward-icon';
import { questNumbers } from '@/lib/quest/stageProgress';
import { usePhoneLike } from '@/lib/hooks/usePhoneLike';
import { isQuizKind, QUIZ_KIND_LABEL } from '@/lib/world/phoneQuiz';
import { starReviewOpen } from '@/lib/quest/starReview';
import { kstToday } from '@/lib/time/kst';
import { Landmark } from './map/MapArt';
import { QUIZ_KIND_ICON } from './PhoneQuizPick';
import { StageChest } from './StageChest';
import { isPerfectStage } from '@/lib/world/chest';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import './map/worldMap.css';
import './stageSheet.css';

/**
 * 스테이지 차례 시트 (P5-06, 시안 `design/prototypes/src/final/World.tsx` StageSheet).
 * 열린 스테이지 노드를 누르면 뜬다: 768px 미만 바텀시트, 이상 책 한 쪽 모양 대화 상자(공통 `Sheet wide`).
 *
 * - 머리: 랜드마크 그림 + "N단계 · 상태" + 제목·설명, 진행 요약(완료 퀘스트 수 막대, SHOW_STARS면 별 합계도)
 * - 차례: 퀘스트마다 순서·제목·배울 개념 한 줄(줄임표)·유형(코드·퀴즈·보스)·상태(완료·하는 중·아직)·폰에서 하기 좋아요(P7-11). 줄 전체가 퀘스트 링크
 *   열린 스테이지 안 퀘스트는 서버 규칙상 모두 열린다(B38 가드는 스테이지 단위) → 건너뛰어 열어도 된다
 * - 완료 퀘스트는 "다시 하기"(복습), 첫 미완료 퀘스트는 강조 줄("지금 차례") + 아래 주 버튼 "시작하기/이어하기" 하나 (P5-14: 줄 안 버튼과 중복 제거)
 * - 퀴즈(P7-11, §12-Q3 C): 유형 태그 "퀴즈 · 종류" + 종류 아이콘, 풀었으면 별(퀴즈 별은 지금도 기록됨 → SHOW_STARS 와 상관없이),
 *   목록 아래 "보너스" 안내 한 줄(잠금·클리어 계산에서 빠짐, `countsForClear`). 휴대폰·태블릿(`usePhoneLike`)이면 휴대폰 추천 퀘스트에 "폰에서 하기 좋아요"
 * - 별(P8-05, SHOW_STARS): 완료 줄에 최고 별. 기존 완료(P8-11 소급 전, best_stars 0)는 빈 별 대신 그리지 않음.
 *   별 3개 미만이고 판정 다음 날(KST)이 된 퀘스트·퀴즈는 "복습 도전 가능" 딱지(§2.3·§12-Q64, `starReviewOpen`)
 * - 보물상자(P8-06, SHOW_CHEST): 진행 요약 아래 별 합계/목표·안에 든 것·"열기" (`StageChest`). 열면 `onChestOpened`
 * - 줄 차례 등장은 CSS(`stageSheet.css`, 연출 단계별). 효과음은 넣지 않음(P5-11)
 */

export type QuestKind = 'code' | 'quiz' | 'boss';
export type QuestRowState = 'done' | 'now' | 'doing' | 'todo';

export interface QuestRow extends StageQuestItem {
  kind: QuestKind;
  state: QuestRowState;
}

/** 보스: quest_type boss, 또는 마지막 스테이지(is_final)의 마지막 퀘스트(지금은 프로젝트 퀘스트) */
export function questRows(
  stage: Pick<StageWithStatus, 'is_final'>,
  quests: StageQuestItem[],
): QuestRow[] {
  const firstTodo = quests.find((q) => q.status !== 'completed')?.id;
  return quests.map((q, i) => ({
    ...q,
    kind:
      q.quest_type === 'boss' || (stage.is_final && i === quests.length - 1)
        ? 'boss'
        : q.quest_type === 'quiz'
          ? 'quiz'
          : 'code',
    state:
      q.status === 'completed'
        ? 'done'
        : q.id === firstTodo
          ? 'now'
          : q.status === 'in_progress'
            ? 'doing'
            : 'todo',
  }));
}

const KIND: Record<QuestKind, { label: string; Icon: typeof Code2 }> = {
  code: { label: '코드', Icon: Code2 },
  quiz: { label: '퀴즈', Icon: MessageCircleQuestion },
  boss: { label: '보스', Icon: Crown },
};

const STATE_TEXT: Record<QuestRowState, string> = {
  done: '완료',
  now: '지금 차례',
  doing: '하는 중',
  todo: '아직',
};

interface StageSheetProps {
  /** 열린 스테이지 (닫히는 동안에도 내용이 남게 마지막 값을 준다) */
  stage: StageWithStatus | null;
  quests: StageQuestItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalFocus?: () => HTMLElement | null;
  /** 월드 번호 → 그림 틴트 (시트는 body에 떠서 지도의 data-world를 물려받지 못함) */
  world?: WorldId;
  /** 오늘 KST 날짜 키 (복습 도전 판정, 테스트·카탈로그용. 기본 지금) */
  today?: string;
  /** 보물상자를 열었을 때 (P8-06, `StageChest` onOpened). 없으면 열어도 아무것도 하지 않음(카탈로그) */
  onChestOpened?: (events: CelebrationEvent[] | null) => void;
}

export function StageSheet({
  stage,
  quests,
  open,
  onOpenChange,
  finalFocus,
  world,
  today = kstToday(),
  onChestOpened,
}: StageSheetProps) {
  const play = useSfx();
  const phone = usePhoneLike();
  if (!stage) return null;
  const rows = questRows(stage, quests);
  const next = rows.find((r) => r.state === 'now');
  // 숫자는 코드 퀘스트(보스 포함)끼리 — 월드맵 노드 "1/7"과 같은 기준. 퀴즈는 보너스라 따로 (B53, §12-Q60)
  const nums = questNumbers(quests);
  const codeRows = rows.filter((r) => r.kind !== 'quiz');
  const quizRows = rows.filter((r) => r.kind === 'quiz');
  const done = codeRows.filter((r) => r.state === 'done').length;
  const quizDone = quizRows.filter((r) => r.state === 'done').length;
  const quizStars = quizRows.reduce((n, r) => n + (r.best_stars ?? 0), 0);
  const nextNo = next && nums.get(next.id);
  const nextVerb =
    next && (next.status === 'in_progress' || done > 0)
      ? '이어하기'
      : '시작하기';

  return (
    <Sheet
      wide
      open={open}
      onOpenChange={onOpenChange}
      className="ss"
      data-testid="stage-sheet"
      finalFocus={finalFocus}
      closeLabel="차례 닫기"
      media={
        // 지도와 같은 랜드마크 그림: 재질 변수(.wm)와 칠(.wm-art) 규칙을 같이 쓴다 (worldMap.css)
        <div className="wm ss-art" data-world={world} aria-hidden>
          <div className="wm-art">
            <svg viewBox="-85 -175 170 190" className="wm-layer">
              <Landmark theme={stage.theme_name} boss={stage.is_final} />
            </svg>
          </div>
        </div>
      }
      title={
        <>
          <span className="ss-kicker font-sans">
            {stage.order}단계 ·{' '}
            {stage.status === 'completed' ? '통과한 곳' : '지금 모험 중'}
          </span>
          {stage.title}
        </>
      }
      description={stage.description || undefined}
      footer={
        next && (
          <Button
            href={`/quest/${next.id}`}
            size="lg"
            iconRight={<ArrowRight aria-hidden />}
            className="ss-cta"
            data-testid="stage-sheet-start"
          >
            {nextNo?.quiz
              ? `보너스 퀴즈 ${nextNo.n} 풀기`
              : `${nextNo?.n ?? next.order}번 퀘스트 ${nextVerb}`}
          </Button>
        )
      }
    >
      <div className="ss-sum">
        <div className="ss-sum-txt">
          <b>
            퀘스트 <span className="ss-num font-display">{done}</span>/
            {codeRows.length} 완료
          </b>
          {SHOW_STARS && (
            <span className="ss-sum-stars">
              <Stars n={1} max={1} size={18} label={false} /> {stage.stars}/
              {stage.maxStars}
            </span>
          )}
        </div>
        {SHOW_STARS && isPerfectStage(stage) && (
          <span className="ss-perfect" data-testid="stage-sheet-perfect">
            <Crown aria-hidden className="size-4" strokeWidth={2.6} />
            완벽해요! 별을 모두 모았어요
          </span>
        )}
        <ProgressBar
          value={done}
          max={Math.max(codeRows.length, 1)}
          label="이 스테이지에서 끝낸 퀘스트"
          valueText={`${done} / ${codeRows.length}`}
          size="sm"
        />
        {quizRows.length > 0 && (
          <p className="ss-sum-quiz" data-testid="stage-sheet-quiz-sum">
            <Sparkles aria-hidden className="size-4" strokeWidth={2.4} />
            보너스 퀴즈 {quizDone}/{quizRows.length}
            {quizStars > 0 && (
              <span className="ss-sum-quiz-stars">
                <RewardIcon kind="star" size={16} />
                <span className="sr-only">별</span> {quizStars}
              </span>
            )}
          </p>
        )}
      </div>

      {SHOW_CHEST && (
        <StageChest stage={stage} onOpened={onChestOpened ?? (() => {})} />
      )}

      <h3 className="ss-k">차례</h3>
      <ol className="ss-list">
        {rows.map((q, i) => {
          const quizKind =
            q.kind === 'quiz' && isQuizKind(q.quiz_kind) ? q.quiz_kind : null;
          const { label, Icon } = quizKind
            ? {
                label: `퀴즈 · ${QUIZ_KIND_LABEL[quizKind]}`,
                Icon: QUIZ_KIND_ICON[quizKind],
              }
            : KIND[q.kind];
          const no = nums.get(q.id);
          return (
            <li
              key={q.id}
              className="ss-li"
              style={{ '--i': i } as React.CSSProperties}
            >
              <Link
                href={`/quest/${q.id}`}
                onClick={() => play('tap')}
                className="ss-row"
                data-state={q.state}
                data-kind={q.kind}
                aria-current={q.state === 'now' ? 'step' : undefined}
              >
                <span className="ss-no" aria-hidden>
                  {q.state === 'done' ? (
                    <Check className="size-5" strokeWidth={3} />
                  ) : no?.quiz ? (
                    <Sparkles className="size-5" strokeWidth={2.4} />
                  ) : (
                    (no?.n ?? q.order)
                  )}
                </span>
                <span className="ss-main">
                  <span className="ss-t">
                    <span className="sr-only">
                      {no?.quiz
                        ? `보너스 퀴즈 ${no.n}, `
                        : `${no?.n ?? q.order}번 `}
                    </span>
                    {q.title}
                  </span>
                  {q.concept && (
                    // 복습할 퀘스트를 고르기 쉽게 배울 개념 한 줄. 줄 이름에도 들어간다(스크린리더도 같은 단서)
                    <span className="ss-c">
                      <span className="sr-only">{', 배울 개념 '}</span>
                      {q.concept}
                    </span>
                  )}
                  <span className="ss-tags">
                    <span className="ss-tag" data-kind={q.kind}>
                      <Icon
                        aria-hidden
                        className="size-3.5"
                        strokeWidth={2.6}
                      />
                      {label}
                    </span>
                    <span className="ss-tag" data-state={q.state}>
                      {STATE_TEXT[q.state]}
                    </span>
                    {q.state === 'done' && starReviewOpen(q, today) && (
                      <span
                        className="ss-tag"
                        data-review
                        data-testid="stage-sheet-review"
                      >
                        <CalendarCheck
                          aria-hidden
                          className="size-3.5"
                          strokeWidth={2.6}
                        />
                        복습 도전 가능
                      </span>
                    )}
                    {q.is_mobile_friendly && phone && (
                      <span className="ss-tag" data-mobile>
                        <Smartphone
                          aria-hidden
                          className="size-3.5"
                          strokeWidth={2.6}
                        />
                        폰에서 하기 좋아요
                      </span>
                    )}
                  </span>
                </span>
                <span className="ss-end">
                  {q.state === 'done' ? (
                    <>
                      {/* 코드 퀘스트 별은 P8-05부터 기록(SHOW_STARS), 퀴즈 별은 P7부터. 0(소급 전 기존 완료)은 그리지 않음 */}
                      {(SHOW_STARS || q.kind === 'quiz') &&
                        q.best_stars > 0 && (
                          <Stars n={q.best_stars} size={18} />
                        )}
                      <span className="ss-act">
                        <RotateCcw
                          aria-hidden
                          className="size-4"
                          strokeWidth={2.6}
                        />
                        다시 하기
                      </span>
                    </>
                  ) : (
                    <ArrowRight
                      aria-hidden
                      className="ss-go size-5"
                      strokeWidth={2.4}
                    />
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {rows.some((r) => r.kind === 'quiz') && (
        // 퀴즈는 스테이지 잠금·클리어 계산에서 빠진다 (countsForClear, §12-Q60)
        <p className="ss-bonus" data-testid="stage-sheet-bonus">
          <Sparkles aria-hidden className="size-4" strokeWidth={2.4} />
          퀴즈는 보너스예요 — 안 풀어도 다음 스테이지가 열려요
        </p>
      )}
    </Sheet>
  );
}
