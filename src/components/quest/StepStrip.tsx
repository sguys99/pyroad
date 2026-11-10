'use client';

import { ArrowRight, Check } from 'lucide-react';
import './stepStrip.css';

export interface StepStripProps {
  /** 단계 목표 (공개 값 steps[].step_goal) */
  goals: string[];
  /** 지금 단계 (1부터) */
  current: number;
  /** 방금 통과해 다음 단계로 넘어가기 직전인 단계 ("다음 단계" 박자). 아니면 null */
  cleared?: number | null;
  /** 프로젝트를 마쳤으면 모든 칸이 끝냄 */
  completed?: boolean;
  /** 박자 건너뛰고 바로 다음 단계로 */
  onSkip?: () => void;
}

/**
 * 프로젝트 단계 띠 (P6-12): 공책 쪽 맨 위 "단계 2/5" + 칸 막대 + 지금 단계 목표.
 * 헤더의 스테이지 진행 점(P6-02, 어느 퀘스트인지 — 점·금색 알약)과 겹쳐 보이지 않게 칸 막대·주색 초록만 쓴다(이 퀘스트 안의 진행).
 * 단계를 통과하면 그 칸이 채워지고 "N단계 통과!" → 다음 목표가 나타나는 박자(`cleared`), "다음 단계로"로 바로 넘김.
 * 연출은 한 번만 도는 CSS transform·opacity (minimal 페이드, 동작 줄이기 없음)
 */
export function StepStrip({
  goals,
  current,
  cleared = null,
  completed = false,
  onSkip,
}: StepStripProps) {
  const total = goals.length;
  // 박자 동안은 이미 다음 단계를 보여 준다 (해 볼 일 체크리스트와 같은 셈)
  const shown = completed ? total : cleared ? cleared + 1 : current;
  const label = completed
    ? `${total}단계 모두 완성!`
    : cleared
      ? `${cleared}단계 통과!`
      : `단계 ${shown}/${total}`;

  return (
    <section
      className="qp"
      aria-label="프로젝트 단계"
      data-testid="step-strip"
      data-step={shown}
      data-beat={cleared ? 'pass' : undefined}
    >
      <div className="qp-row">
        <p className="qp-k" aria-live="polite">
          {(completed || cleared) && <Check aria-hidden strokeWidth={3} />}
          {label}
        </p>
        <ol className="qp-track">
          {goals.map((_, i) => {
            const n = i + 1;
            const state =
              completed || n < shown
                ? 'done'
                : n === shown
                  ? 'current'
                  : 'todo';
            return (
              <li
                key={n}
                className="qp-seg"
                data-state={state}
                data-fresh={n === cleared || undefined}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="sr-only">
                  {n}단계
                  {state === 'done'
                    ? ' (끝냄)'
                    : state === 'current'
                      ? ' (지금)'
                      : ''}
                </span>
              </li>
            );
          })}
        </ol>
        {cleared && onSkip && (
          <button
            type="button"
            className="qp-skip"
            onClick={onSkip}
            data-testid="step-skip"
          >
            <span className="qp-skip-t">다음 단계로</span>
            <ArrowRight aria-hidden />
          </button>
        )}
      </div>
      {!completed && (
        <p className="qp-goal" key={shown}>
          {cleared && <span className="qp-next">다음</span>}
          {goals[shown - 1]}
        </p>
      )}
    </section>
  );
}
