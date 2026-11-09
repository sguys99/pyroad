'use client';

import type { MotionBudget } from '@/lib/motion/tier';
import {
  DURATION,
  EASING,
  springTiming,
  tierDuration,
} from '@/lib/motion/tokens';
import { INK_BLOT, INK_ROUND } from '@/lib/motion/inkMask';

/**
 * 30초 체험 공책 연출 (P4-02, 시안 `fx.ts` inkReveal·popIn을 앱 방식으로). 모두 1회성 WAAPI, transform·opacity·mask만.
 * `@/lib/design/tokens`·`onboardingFx`는 import하지 않는다 (대비표 문구가 랜딩 글꼴 서브셋에 들어감).
 *
 * | 연출 | full | lite | minimal | 동작 줄이기 |
 * |---|---|---|---|---|
 * | 결과 잉크 번짐 | 잉크 얼룩 마스크가 퍼짐 (page 700ms, ink 곡선) | 둥근 마스크 360ms×0.7 | 페이드 150ms | 없음 (바로 보임) |
 * | 결과 글자 팝 | 아래에서 튀어 올라 prop 스프링(통통) + 잉크 방울 6개 | face 스프링, 작게 | 페이드 | 없음 |
 */

const canAnimate = (el: Element | null): el is HTMLElement =>
  !!el && typeof (el as HTMLElement).animate === 'function';

type MaskStyle = CSSStyleDeclaration & {
  webkitMaskImage: string;
  webkitMaskRepeat: string;
};

/**
 * 잉크 번짐으로 나타나기 (결과 칸). `origin` = 번지기 시작하는 곳 (칸 너비·높이 비율).
 * 마스크 크기와 위치를 px로 함께 움직여 번짐 중심이 제자리에 있게 한다 (% 위치는 크기가 커지면 밀려남)
 */
export function inkReveal(
  el: HTMLElement | null,
  budget: MotionBudget,
  origin: readonly [number, number] = [0.12, 0.62],
) {
  if (!canAnimate(el) || budget.effectDuration === 0) return;
  el.getAnimations().forEach((a) => a.cancel());
  if (!budget.springs) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DURATION.fade,
      easing: EASING.out,
    });
    return;
  }
  const lite = !budget.ambient;
  const r = el.getBoundingClientRect();
  const ox = r.width * origin[0];
  const oy = r.height * origin[1];
  // 가장 먼 모서리까지 덮는 크기 (얼룩 모양은 viewBox 가장자리보다 안쪽이라 넉넉히)
  const far = Math.hypot(
    Math.max(ox, r.width - ox),
    Math.max(oy, r.height - oy),
  );
  const d = Math.ceil(far * (lite ? 2.1 : 2.6));
  const s = el.style as MaskStyle;
  s.maskImage = s.webkitMaskImage = lite ? INK_ROUND : INK_BLOT;
  s.maskRepeat = s.webkitMaskRepeat = 'no-repeat';
  const clear = () => {
    s.maskImage = s.webkitMaskImage = '';
    s.maskRepeat = s.webkitMaskRepeat = '';
  };
  const at = (size: number) =>
    ({
      maskSize: `${size}px ${size}px`,
      webkitMaskSize: `${size}px ${size}px`,
      maskPosition: `${ox - size / 2}px ${oy - size / 2}px`,
      webkitMaskPosition: `${ox - size / 2}px ${oy - size / 2}px`,
    }) as Keyframe;
  el.animate([at(0), at(d)], {
    duration: lite ? tierDuration(DURATION.slow, budget) : DURATION.page,
    easing: EASING.ink,
  }).finished.then(clear, clear);
}

/** 결과 글자가 톡 튀어나옴 (+ full은 잉크 방울) */
export function popOut(el: HTMLElement | null, budget: MotionBudget) {
  if (!canAnimate(el) || budget.effectDuration === 0) return;
  if (!budget.springs) {
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DURATION.fade,
      easing: EASING.out,
    });
    return;
  }
  if (!budget.ambient) {
    el.animate(
      [
        { transform: 'scale(0.82)', opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      springTiming('face'),
    );
    return;
  }
  // 잉크가 번지기 시작한 뒤 한 박자 늦게 톡
  el.animate(
    [
      { transform: 'translateY(0.6em) scale(0.3) rotate(-8deg)', opacity: 0 },
      {
        transform: 'translateY(-0.1em) scale(1.08) rotate(1deg)',
        opacity: 1,
        offset: 0.3,
      },
      { transform: 'none', opacity: 1 },
    ],
    { ...springTiming('prop'), delay: DURATION.fast, fill: 'backwards' },
  );
  window.setTimeout(() => dots(el), DURATION.fast);
}

/**
 * 글자 둘레로 잉크 방울 6개 (일회성 DOM, 끝나면 지움). 색은 CSS `.ld-trial-dot`.
 * 결과 칸은 잉크 번짐 마스크가 걸려 있어 방울은 그 바깥(공책 카드)에 붙인다
 */
function dots(at: HTMLElement, tone: 'green' | 'gold' = 'green') {
  if (!at.isConnected) return;
  const host = at.closest<HTMLElement>('.ld-trial-card') ?? at.parentElement;
  if (!host) return;
  const r = at.getBoundingClientRect();
  const hr = host.getBoundingClientRect();
  const cx = r.left - hr.left + Math.min(r.width, 96) / 2;
  const cy = r.top - hr.top + r.height / 2;
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('i');
    d.className = 'ld-trial-dot';
    if (tone === 'gold') d.dataset.tone = 'gold';
    d.setAttribute('aria-hidden', 'true');
    // 위쪽 반원으로 퍼짐 (아래는 칸 바닥)
    // 결과 글자는 위쪽 반원(아래는 칸 바닥), 도장은 둘레 전체
    const a =
      tone === 'gold'
        ? (i / 6) * Math.PI * 2 + 0.4
        : Math.PI + (i / 5) * Math.PI + (i % 2 ? 0.12 : -0.12);
    const dist = 40 + (i % 3) * 12;
    const size = 6 + ((i * 5) % 4);
    d.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
    host.appendChild(d);
    const dx = Math.cos(a) * dist;
    const dy = Math.sin(a) * dist * 0.7;
    d.animate(
      [
        { transform: 'translate(0, 0) scale(0.3)', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(1)`,
          opacity: 1,
          offset: 0.55,
        },
        {
          transform: `translate(${dx * 1.1}px, ${dy * 1.1}px) scale(0.8)`,
          opacity: 0,
        },
      ],
      { duration: DURATION.page, easing: EASING.out, fill: 'forwards' },
    ).finished.then(
      () => d.remove(),
      () => d.remove(),
    );
  }
}

// ── 성공·실패 (P4-03) ─────────────────────────────────────

/** 도장이 놓이는 기울기 (도). CSS `.ld-trial-stamp`의 transform과 같아야 한다 */
export const TRIAL_STAMP_DEG = -9;

/**
 * "첫 주문!" 도장 쾅 (시안 `fx.ts` stampSlam, 온보딩 도장과 같은 박자표: 2.3배 → 0.9배 가속 내려찍기 + body 스프링 안착 +
 * full은 공책 떨림·금색 방울). minimal = 페이드, 동작 줄이기 = 제자리에 바로 (색·글자로 알림). `onImpact`는 닿는 순간 한 번
 */
export function stampSlam(
  stamp: HTMLElement | null,
  budget: MotionBudget,
  { paper, onImpact }: { paper?: HTMLElement | null; onImpact?: () => void },
) {
  let hit = false;
  const impact = () => {
    if (hit) return;
    hit = true;
    onImpact?.();
  };
  if (!canAnimate(stamp) || budget.effectDuration === 0) {
    impact();
    return;
  }
  const rot = TRIAL_STAMP_DEG;
  if (!budget.springs) {
    stamp
      .animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: DURATION.fade,
        easing: EASING.out,
        fill: 'backwards',
      })
      .finished.then(impact, impact);
    return;
  }
  const lite = !budget.ambient;
  stamp
    .animate(
      [
        { transform: `scale(2.3) rotate(${rot - 14}deg)`, opacity: 0 },
        { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 },
      ],
      {
        duration: lite ? tierDuration(DURATION.base, budget) : DURATION.base,
        easing: EASING.stampIn,
        fill: 'backwards',
      },
    )
    .finished.then(() => {
      impact();
      stamp.animate(
        [
          { transform: `scale(0.9) rotate(${rot - 2}deg)` },
          { transform: `rotate(${rot}deg)` },
        ],
        springTiming('body'),
      );
      if (lite) return;
      paper?.animate(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(2px, 1px)' },
          { transform: 'translate(-2px, 0)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: DURATION.fast, easing: 'steps(3, end)' },
      );
      dots(stamp, 'gold');
    })
    .catch(impact);
}

/** 버그 찾음: 공책이 살짝 흔들림 (full만, 시안 celebrate('fail')) */
export function shake(el: HTMLElement | null, budget: MotionBudget) {
  if (!canAnimate(el) || !budget.ambient || budget.effectDuration === 0) return;
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-5px) rotate(-0.3deg)' },
      { transform: 'translateX(4px)' },
      { transform: 'translateX(-2px)' },
      { transform: 'none' },
    ],
    { duration: DURATION.slow, easing: 'steps(4, end)' },
  );
}

/** 토큰 색을 CSS 변수에서 읽는다 (`@/lib/design/tokens`를 import하지 않으려고) */
function tokenColors(names: string[]): string[] {
  const css = getComputedStyle(document.documentElement);
  return names.map((n) => css.getPropertyValue(n).trim()).filter(Boolean);
}

/** 도장 자리에서 작은 컨페티 한 번 (컨페티 모듈은 이때 받는다. 단계 배율·동작 줄이기는 fireConfetti가 본다) */
export function stampConfetti(stamp: HTMLElement | null, budget: MotionBudget) {
  if (!stamp || budget.particles <= 0) return;
  const r = stamp.getBoundingClientRect();
  void import('@/lib/confetti')
    .then(({ fireConfetti }) =>
      fireConfetti(
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
          colors: tokenColors([
            '--accent',
            '--accent-light',
            '--primary-bright',
            '--primary',
          ]),
        },
        { scale: budget.particles },
      ),
    )
    .catch(() => {});
}
