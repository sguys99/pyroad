'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Code2,
  Crown,
  MessageCircleQuestion,
  RotateCcw,
  Smartphone,
} from 'lucide-react';
import type { StageWithStatus } from '@/lib/types/database';
import type { WorldId } from '@/lib/design/tokens';
import type { StageQuestItem } from '@/lib/world/mapData';
import { SHOW_STARS } from '@/lib/world/flags';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSfx } from '@/components/providers/soundContext';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Stars } from '@/components/ui/reward-icon';
import { Landmark } from './map/MapArt';
import './map/worldMap.css';
import './stageSheet.css';

/**
 * 스테이지 차례 시트 (P5-06, 시안 `design/prototypes/src/final/World.tsx` StageSheet).
 * 열린 스테이지 노드를 누르면 뜬다: 768px 미만 바텀시트, 이상 책 한 쪽 모양 대화 상자(공통 `Sheet wide`).
 *
 * - 머리: 랜드마크 그림 + "N단계 · 상태" + 제목·설명, 진행 요약(완료 퀘스트 수 막대, SHOW_STARS면 별 합계도)
 * - 차례: 퀘스트마다 순서·제목·배울 개념 한 줄(줄임표)·유형(코드·퀴즈·보스)·상태(완료·하는 중·아직)·휴대폰 추천. 줄 전체가 퀘스트 링크
 *   열린 스테이지 안 퀘스트는 서버 규칙상 모두 열린다(B38 가드는 스테이지 단위) → 건너뛰어 열어도 된다
 * - 완료 퀘스트는 "다시 하기"(복습), 첫 미완료 퀘스트는 강조 줄("지금 차례") + 아래 주 버튼 "시작하기/이어하기" 하나 (P5-14: 줄 안 버튼과 중복 제거)
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
}

export function StageSheet({
  stage,
  quests,
  open,
  onOpenChange,
  finalFocus,
  world,
}: StageSheetProps) {
  const play = useSfx();
  if (!stage) return null;
  const rows = questRows(stage, quests);
  const next = rows.find((r) => r.state === 'now');
  const done = rows.filter((r) => r.state === 'done').length;
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
            {next.order}번 퀘스트 {nextVerb}
          </Button>
        )
      }
    >
      <div className="ss-sum">
        <div className="ss-sum-txt">
          <b>
            퀘스트 <span className="ss-num font-display">{done}</span>/
            {rows.length} 완료
          </b>
          {SHOW_STARS && (
            <span className="ss-sum-stars">
              <Stars n={1} max={1} size={18} label={false} /> {stage.stars}/
              {stage.maxStars}
            </span>
          )}
        </div>
        <ProgressBar
          value={done}
          max={Math.max(rows.length, 1)}
          label="이 스테이지에서 끝낸 퀘스트"
          valueText={`${done} / ${rows.length}`}
          size="sm"
        />
      </div>

      <h3 className="ss-k">차례</h3>
      <ol className="ss-list">
        {rows.map((q, i) => {
          const { label, Icon } = KIND[q.kind];
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
                  ) : (
                    q.order
                  )}
                </span>
                <span className="ss-main">
                  <span className="ss-t">
                    <span className="sr-only">{q.order}번 </span>
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
                    {q.is_mobile_friendly && (
                      <span className="ss-tag" data-mobile>
                        <Smartphone
                          aria-hidden
                          className="size-3.5"
                          strokeWidth={2.6}
                        />
                        휴대폰 추천
                      </span>
                    )}
                  </span>
                </span>
                <span className="ss-end">
                  {q.state === 'done' ? (
                    <>
                      {SHOW_STARS && <Stars n={q.best_stars} size={18} />}
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
    </Sheet>
  );
}
