'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { StageWithStatus } from '@/lib/types/database';
import type { CelebrationEvent } from '@/lib/quest/celebrationEvents';
import { chestCoins, chestGoal, chestState } from '@/lib/world/chest';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon, Stars } from '@/components/ui/reward-icon';
import './stageChest.css';

export type ChestEvent = Extract<CelebrationEvent, { type: 'chest' }>;

/** 열기 요청 결과 (서버 `open_stage_chest`, 00033) */
export interface ChestOpenResult {
  already_opened: boolean;
  coins_earned: number;
}

const OPEN_ERROR = '상자를 열지 못했어요. 잠시 후 다시 해 볼까요?';

async function requestOpen(stageId: string): Promise<ChestOpenResult> {
  const res = await fetch('/api/world/chest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stageId }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || OPEN_ERROR);
  return body as ChestOpenResult;
}

interface StageChestProps {
  stage: Pick<
    StageWithStatus,
    | 'id'
    | 'title'
    | 'status'
    | 'stars'
    | 'totalQuestCount'
    | 'is_final'
    | 'chestOpened'
  >;
  /**
   * 열었을 때: 새로 열었으면 축하 이벤트(코인은 서버가 준 값), 이미 열려 있었으면(다른 탭 등) null.
   * 부모(월드맵)가 시트를 닫고 축하 오버레이를 띄운 뒤 화면을 새로 고친다
   */
  onOpened: (event: ChestEvent | null) => void;
  /** 열기 요청 (기본 `/api/world/chest`. 카탈로그·테스트용) */
  request?: (stageId: string) => Promise<ChestOpenResult>;
}

/**
 * 스테이지 보물상자 (P8-06, §3 F11). 스테이지 시트 진행 요약 아래 한 줄.
 *
 * - 별 합계(퀴즈 별 포함, `stage.stars`) / 목표(`chestGoal`, 코드 퀘스트 × 3의 70%) + 모으는 중엔 막대
 * - **내용 공개형**(§2.6): 안에 든 것(코인 30, 마지막 스테이지 50)을 열기 전부터 글자로 보여 줌. 확률 없음
 * - 목표를 채우면 상자가 반짝이며 들썩이고(full·lite, 동작 줄이기·minimal은 멈춘 그림) 금색 "열기" 버튼.
 *   받기는 버튼으로만(§12-Q62 ③) — 안 열어도 사라지지 않음. 판정·지급은 서버가 별을 다시 세어서(`open_stage_chest`)
 * - 열었으면 열린 상자 + "받았어요"
 */
export function StageChest({
  stage,
  onOpened,
  request = requestOpen,
}: StageChestProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = chestState(stage);
  if (state === 'none') return null;
  const goal = chestGoal(stage.totalQuestCount);
  const coins = chestCoins(stage.is_final);
  const left = Math.max(goal - stage.stars, 0);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await request(stage.id);
      onOpened(
        res.already_opened
          ? null
          : {
              type: 'chest',
              stageTitle: stage.title,
              goal,
              contents: { coins: res.coins_earned, goldenKeys: 0 },
            },
      );
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : OPEN_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="sc"
      data-state={state}
      data-testid="stage-chest"
      aria-labelledby={`sc-t-${stage.id}`}
    >
      <span className="sc-art" aria-hidden>
        <RewardIcon
          kind={state === 'opened' ? 'chestOpen' : 'chest'}
          size={48}
          className="sc-box"
        />
        {state === 'ready' && (
          <>
            <Sparkles className="sc-glint" data-i="0" strokeWidth={2.4} />
            <Sparkles className="sc-glint" data-i="1" strokeWidth={2.4} />
          </>
        )}
      </span>

      <div className="sc-main">
        <p className="sc-head">
          <b id={`sc-t-${stage.id}`} className="font-display">
            보물상자
          </b>
          <span className="sc-goal">
            <Stars n={1} max={1} size={16} label={false} />
            <span className="sr-only">별</span> {Math.min(stage.stars, goal)}/
            {goal}
          </span>
        </p>
        <p className="sc-say" data-testid="stage-chest-say">
          {state === 'opened'
            ? '열었어요! 안에 든 것을 받았어요'
            : state === 'ready'
              ? '별을 다 모았어요! 상자를 열어 보세요'
              : `별 ${left}개 더 모으면 열려요`}
        </p>
        {state === 'locked' && (
          <ProgressBar
            value={stage.stars}
            max={goal}
            label="보물상자까지 모은 별"
            valueText={`${stage.stars} / ${goal}`}
            size="sm"
          />
        )}
        <p className="sc-in">
          {state === 'opened' ? '받은 것' : '안에 든 것'}
          <span className="sc-pill">
            <RewardIcon kind="coin" size={16} />
            코인 {coins}
          </span>
        </p>
        {error && (
          <p className="sc-err" role="alert">
            {error}
          </p>
        )}
      </div>

      {state === 'ready' && (
        <Button
          variant="reward"
          size="sm"
          loading={busy}
          onClick={open}
          className="sc-open"
          data-testid="stage-chest-open"
        >
          열기
        </Button>
      )}
    </section>
  );
}
