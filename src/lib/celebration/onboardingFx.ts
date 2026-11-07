'use client';

import type { MotionBudget } from '@/lib/motion/tier';
import {
  DURATION,
  EASING,
  springTiming,
  tierDuration,
} from '@/lib/motion/tokens';
import { COLOR } from '@/lib/design/tokens';
import { fireConfetti } from '@/lib/confetti';

/**
 * 온보딩 연출 박자표 (P3-11, docs/design/components.md §13). 모두 1회성이고 transform·opacity만 움직인다 (§2.10).
 * 화면(`src/components/onboarding/`)은 언제 부를지만 정하고, 길이·곡선·단계별 대체는 여기서 고른다.
 *
 * | 연출 | full | lite | minimal | 동작 줄이기 |
 * |---|---|---|---|---|
 * | 도장 쾅 | 2.3배 → 0.9배 가속 내려찍기 220ms + body 스프링 안착 + 종이 떨림 + 금색 방울 7개 + 작은 컨페티 | 160ms + 스프링, 떨림·방울 없음, 컨페티 30% | 페이드 150ms | 즉시 (도장 색·글자로 알림) |
 * | 쪽 넘김 | 왼쪽 축으로 넘어가며 사라짐 (page 700ms, page 곡선) | 페이드 140ms | 없음 | 없음 |
 * | 주사위 | 데구르르 한 바퀴 반 (slow 360ms, backOut) + 이름 4번 바뀜 | 70% | 이름만 바뀜 | 이름만 바뀜 |
 *
 * 모든 연출은 `FxHandle.finish()`로 끝 상태로 건너뛸 수 있다 (화면 어디든 누르면, §12-Q28).
 */

export interface FxHandle {
  /** 끝 상태로 바로 (남은 박자의 콜백도 지금 부름) */
  finish(): void;
  done: Promise<void>;
}

const DONE: FxHandle = { finish() {}, done: Promise.resolve() };

function settle(anims: Animation[]): Promise<void> {
  return Promise.all(anims.map((a) => a.finished.catch(() => undefined))).then(
    () => undefined,
  );
}

// ── 도장 ────────────────────────────────────────────────────

/** 도장이 놓이는 기울기 (도). CSS `.ob-stamp`의 최종 transform 과 같아야 한다 */
export const STAMP_ROTATE_DEG = -8;
/** 도장을 찍기 전 카드가 다 채워진 것을 보여 주는 틈 (ms). 동작 줄이기·minimal 은 0 */
export const STAMP_LEAD_MS = 260;

export interface StampOptions {
  budget: MotionBudget;
  /** 흔들릴 종이(등록증) */
  paper?: HTMLElement | null;
  /** 도장이 종이에 닿는 순간 (효과음·마스코트 반응·컨페티) */
  onImpact?: () => void;
}

export function stampSlam(
  stamp: HTMLElement | null,
  { budget, paper, onImpact }: StampOptions,
): FxHandle {
  let impacted = false;
  const impact = () => {
    if (impacted) return;
    impacted = true;
    onImpact?.();
  };
  if (!stamp || typeof stamp.animate !== 'function') {
    impact();
    return DONE;
  }
  // 동작 줄이기: 움직임 0. 도장은 이미 제자리에 그려져 있고 색·글자로 알림
  if (budget.effectDuration === 0) {
    impact();
    return DONE;
  }
  const rot = STAMP_ROTATE_DEG;
  const anims: Animation[] = [];
  // 건너뛰면 내려찍기 뒤 이어지는 안착·떨림·방울을 새로 걸지 않는다 (끝 상태 = CSS 의 제자리)
  let skipped = false;
  let started: Promise<void> = Promise.resolve();
  const splats: HTMLElement[] = [];
  const lead = STAMP_LEAD_MS;

  if (!budget.springs) {
    // minimal: 페이드만
    const a = stamp.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DURATION.fade,
      delay: lead,
      easing: EASING.out,
      fill: 'backwards',
    });
    anims.push(a);
    a.finished.then(impact, impact);
    started = a.finished.then(
      () => undefined,
      () => undefined,
    );
  } else {
    const lite = !budget.ambient; // full 만 앰비언트가 켜짐 → lite 는 짧고 장식 없이
    const slam = stamp.animate(
      [
        { transform: `scale(2.3) rotate(${rot - 14}deg)`, opacity: 0 },
        { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 },
      ],
      {
        duration: lite ? tierDuration(DURATION.base, budget) : DURATION.base,
        delay: lead,
        easing: EASING.stampIn,
        fill: 'backwards',
      },
    );
    anims.push(slam);
    started = slam.finished
      .then(() => {
        impact();
        if (skipped) return;
        anims.push(
          stamp.animate(
            [
              { transform: `scale(0.9) rotate(${rot - 2}deg)` },
              { transform: `rotate(${rot}deg)` },
            ],
            springTiming('body'),
          ),
        );
        if (lite) return;
        if (paper) {
          anims.push(
            paper.animate(
              [
                { transform: 'translate(0, 0)' },
                { transform: 'translate(2px, 1px)' },
                { transform: 'translate(-2px, 0)' },
                { transform: 'translate(0, 0)' },
              ],
              { duration: DURATION.fast, easing: 'steps(3, end)' },
            ),
          );
        }
        splats.push(...inkSplat(stamp, anims));
      })
      .catch(impact);
  }

  // 내려찍기 뒤에 걸린 안착·떨림·방울까지 모두 끝나야 done (그때까지는 건너뛰기로 끝낼 수 있음)
  const done = started
    .then(() => settle(anims))
    .then(() => {
      for (const s of splats) s.remove();
    });
  return {
    finish() {
      skipped = true;
      for (const a of anims) a.finish();
      for (const s of splats) s.remove();
      impact();
    },
    done,
  };
}

/** 도장 둘레로 금색 방울 7개 (일회성 DOM, 끝나면 지움) */
function inkSplat(at: HTMLElement, anims: Animation[]): HTMLElement[] {
  const host = at.parentElement;
  if (!host) return [];
  const r = at.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const cx = r.left - hr.left + r.width / 2;
  const cy = r.top - hr.top + r.height / 2;
  const out: HTMLElement[] = [];
  for (let i = 0; i < 7; i++) {
    const d = document.createElement('i');
    d.className = 'ob-splat';
    d.setAttribute('aria-hidden', 'true');
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const dist = r.width * (0.56 + (i % 3) * 0.12);
    const size = 5 + ((i * 7) % 5);
    d.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
    host.appendChild(d);
    out.push(d);
    anims.push(
      d.animate(
        [
          { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
          {
            transform: `translate(${Math.cos(a) * dist}px, ${Math.sin(a) * dist}px) scale(1)`,
            opacity: 1,
            offset: 0.6,
          },
          {
            transform: `translate(${Math.cos(a) * dist * 1.06}px, ${Math.sin(a) * dist * 1.06}px) scale(1)`,
            opacity: 0,
          },
        ],
        { duration: DURATION.slow * 1.5, easing: EASING.out, fill: 'forwards' },
      ),
    );
  }
  return out;
}

/** 도장 자리에서 작은 컨페티 한 번 (금색 + 초록, 파티클 상한·단계 배율은 fireConfetti) */
export function stampConfetti(stamp: HTMLElement | null, budget: MotionBudget) {
  if (!stamp || budget.particles <= 0) return 0;
  const r = stamp.getBoundingClientRect();
  return fireConfetti(
    {
      particleCount: 44,
      spread: 75,
      startVelocity: 24,
      gravity: 1.1,
      scalar: 0.8,
      ticks: 110,
      origin: {
        x: (r.left + r.width / 2) / window.innerWidth,
        y: (r.top + r.height / 2) / window.innerHeight,
      },
      colors: [
        COLOR.accent,
        COLOR.accentLight,
        COLOR.primaryBright,
        COLOR.primary,
      ],
    },
    { scale: budget.particles },
  );
}

// ── 쪽 넘김 ──────────────────────────────────────────────────

/** 지금 쪽이 왼쪽 축으로 넘어가며 사라짐. 끝나면 done (다음 쪽으로 바꾸는 때) */
export function pageTurnOut(
  page: HTMLElement | null,
  budget: MotionBudget,
): FxHandle {
  if (!page || typeof page.animate !== 'function' || !budget.pageTransition) {
    return DONE;
  }
  if (budget.pageTransition !== 'slide') {
    const a = page.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: DURATION.fast,
      easing: EASING.out,
      fill: 'forwards',
    });
    return { finish: () => a.finish(), done: settle([a]) };
  }
  const a = page.animate(
    [
      { transform: 'perspective(1600px) rotateY(0deg)', opacity: 1 },
      {
        transform: 'perspective(1600px) rotateY(-24deg) translateX(-2%)',
        opacity: 1,
        offset: 0.45,
      },
      {
        transform: 'perspective(1600px) rotateY(-88deg) translateX(-6%)',
        opacity: 0,
      },
    ],
    { duration: DURATION.page, easing: EASING.page, fill: 'forwards' },
  );
  return { finish: () => a.finish(), done: settle([a]) };
}

/** 새 쪽이 오른쪽에서 펼쳐지며 들어옴 (글자는 처음부터 보임: transform 만, §2.10 규칙 5) */
export function pageTurnIn(page: HTMLElement | null, budget: MotionBudget) {
  if (!page || typeof page.animate !== 'function' || !budget.pageTransition) {
    return;
  }
  if (budget.pageTransition !== 'slide') {
    page.animate([{ opacity: 0.4 }, { opacity: 1 }], {
      duration: DURATION.fast,
      easing: EASING.out,
    });
    return;
  }
  page.animate(
    [
      { transform: 'perspective(1600px) rotateY(14deg) translateX(3%)' },
      { transform: 'perspective(1600px) rotateY(0deg)' },
    ],
    { duration: DURATION.slow, easing: EASING.out },
  );
}

// ── 주사위 ──────────────────────────────────────────────────

/** 이름이 바뀌어 보이는 횟수와 간격 (minimal·동작 줄이기는 0번 = 바로 결과) */
export function diceRollFrames(budget: MotionBudget): {
  frames: number;
  frameMs: number;
} {
  if (!budget.springs || budget.effectDuration === 0)
    return { frames: 0, frameMs: 0 };
  return { frames: 4, frameMs: tierDuration(DURATION.instant, budget) };
}

/** 주사위 아이콘이 데구르르 (아이콘 요소에) */
export function diceRoll(icon: Element | null, budget: MotionBudget) {
  if (!icon || typeof icon.animate !== 'function' || !budget.springs) return;
  if (budget.effectDuration === 0) return;
  icon.animate(
    [
      { transform: 'rotate(0deg) scale(1)' },
      { transform: 'rotate(-28deg) scale(0.9)', offset: 0.18 },
      { transform: 'rotate(400deg) scale(1.18)', offset: 0.72 },
      { transform: 'rotate(360deg) scale(1)' },
    ],
    {
      duration: tierDuration(DURATION.slow * 1.5, budget),
      easing: EASING.out,
    },
  );
}

/** 파이뱀 색을 고른 칸이 톡 (선택 표시는 색·체크로 이미 보임) */
export function swatchPop(el: Element | null, budget: MotionBudget) {
  if (!el || typeof el.animate !== 'function' || !budget.springs) return;
  if (budget.effectDuration === 0) return;
  el.animate(
    [{ transform: 'scale(0.9)' }, { transform: 'scale(1)' }],
    springTiming('prop'),
  );
}
