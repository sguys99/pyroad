'use client';

import { RewardIcon } from '@/components/ui/reward-icon';
import type { MotionBudget } from '@/lib/motion/tier';
import { CelebrationCta, CountUp, Kicker, delayStyle } from './parts';

interface ChestCardProps {
  stageTitle: string;
  goal: number;
  contents: { coins: number; goldenKeys: number };
  budget: MotionBudget;
  settled: boolean;
  onNext: () => void;
}

/** 뚜껑이 열린 뒤 보상이 톡 튀는 시각 (ms, full 기준) */
const REVEAL_MS = 1100;

/**
 * 스테이지 보물상자 (Phase 8 §3 F11, `SHOW_CHEST`로 숨김 — 지금은 카탈로그에서만). 뚜껑이 두 번 들썩 → 열림 →
 * 안에 든 것(코인·황금키)이 차례로 톡. 내용 공개형(§2: 확률형 뽑기 없음)이라 받은 것을 글자로 그대로 보여 준다
 */
export function ChestCard({
  stageTitle,
  goal,
  contents,
  budget,
  settled,
  onNext,
}: ChestCardProps) {
  const animate = budget.effectDuration > 0 && !settled;
  return (
    <>
      <svg className="cel-chest" viewBox="0 0 64 52" aria-hidden>
        <path className="cel-chest-inner" d="M9 22h46v6H9z" />
        <g className="cel-chest-lid">
          <path
            className="cel-chest-body"
            d="M6 22C6 10 16 4 32 4C48 4 58 10 58 22Z"
          />
          <path className="cel-chest-band" d="M28 12h8v10h-8z" />
        </g>
        <path className="cel-chest-body" d="M6 24h52v24H6z" />
        <path className="cel-chest-band" d="M6 31h52v3H6zM28 26h8v12h-8z" />
      </svg>

      <div className="cel-head">
        <Kicker gold>보물상자</Kicker>
        <h2 id="celebration-title" className="cel-t font-display">
          보물상자가 열렸어요!
        </h2>
        <p className="cel-sub">
          {stageTitle}에서 별 {goal}개를 모았어요
        </p>
      </div>

      <ul className="cel-gains" aria-label="상자에 든 것">
        <li className="cel-gain cel-pop" style={delayStyle(REVEAL_MS)}>
          <RewardIcon kind="coin" size={30} />
          <b>
            +
            <CountUp
              to={contents.coins}
              durationMs={600 * budget.effectDuration}
              delayMs={(REVEAL_MS + 150) * budget.effectDuration}
              animate={animate}
            />
          </b>
          코인
        </li>
        {contents.goldenKeys > 0 && (
          <li className="cel-gain cel-pop" style={delayStyle(REVEAL_MS + 180)}>
            <RewardIcon kind="key" size={30} />
            <b>+{contents.goldenKeys}</b>
            황금키
          </li>
        )}
      </ul>

      <div className="cel-actions">
        <CelebrationCta onClick={onNext}>좋아요!</CelebrationCta>
      </div>
    </>
  );
}
