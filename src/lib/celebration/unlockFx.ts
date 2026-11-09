'use client';

import type { MotionBudget } from '@/lib/motion/tier';
import { EASING, springTiming } from '@/lib/motion/tokens';
import { INK_BLOT, INK_ROUND } from '@/lib/motion/inkMask';

/**
 * 스테이지 잠금 해제 연출 박자표 (P5-05, 시안 `design/prototypes/src/final/beats.ts` buildUnlock).
 * 모든 애니메이션은 처음에 delay 를 붙여 한꺼번에 만든다(WAAPI → 컴포지터가 돌림), 메인 스레드는 상태 바꾸기 큐만.
 * 1회성이고 transform·opacity 위주, 길 그리기(stroke-dashoffset)·잉크 번짐(mask)만 예외 (motion-guidelines §2).
 *
 * | 박자 | full (약 3.5초) | lite (약 2.2초) |
 * |---|---|---|
 * | ① 통과 도장 쾅 | 2.3배 → 0.9배 220ms + body 안착 + 지도 떨림 + 잉크 튐 6 | 160ms + body 안착 |
 * | ② 잉크 길 | 650ms (ink 곡선) | 360ms |
 * | ③ 자물쇠 | 흔들흔들 420ms → 반으로 깨져 떨어짐 + 조각 5 | 바로 깨짐 300ms |
 * | ④ 랜드마크 깨어남 | 잉크 방울 톡 → 얼룩 마스크로 스케치가 컬러로 600ms | 둥근 번짐 360ms |
 * | ⑤ 파이뱀 이동 | 길을 따라 깡충 2번 720ms + 착지 눌림 (펫은 160ms 늦게 작게 3번) | 미끄러져 500ms (펫도 같이) |
 * | ⑥ 열림 | 이름표 팝(body) + "열렸어요!" 도장 | 이름표 팝(face) + 도장 160ms |
 *
 * minimal·동작 줄이기는 이 함수를 부르지 않는다: 화면이 끝 상태로 바로 바뀌고 문구(토스트)만 (useStageUnlock).
 * `finish()`는 어느 순간이든 끝 상태로 (남은 큐도 지금 부름), `cancel()`은 효과를 모두 걷음(끝 상태를 React 가 그린 뒤).
 */

export interface UnlockEls {
  /** 도장이 찍힐 때 살짝 떨리는 지도 (.world-map) */
  map: HTMLElement | null;
  /** 이전 노드의 통과 도장 (.wn-stamp). 월드의 첫 스테이지면 null → 도장·길·이동 없이 ③부터 */
  stamp: HTMLElement | null;
  splats: HTMLElement[];
  /** 새로 긋는 길 (pathLength=1, 레이아웃마다 하나) + 그 위 종이 점선 */
  roads: SVGElement[];
  stitches: SVGElement[];
  /** 자물쇠 (흔들림) · 깨진 두 반쪽 · 조각 */
  lock: HTMLElement | null;
  halves: HTMLElement[];
  shards: HTMLElement[];
  drop: HTMLElement | null;
  /** 지금 보이는 레이아웃의 컬러 랜드마크 겹 + 번짐 중심·크기 (그 겹 안 px) */
  ink: HTMLElement | null;
  inkAt: { x: number; y: number; size: number };
  /** 지금 위치 파이뱀을 옮기는 겹 + 길 위 점들 (처음 자리 기준 px). 비면 이동 없이 열릴 때 톡 나타남 */
  walker: HTMLElement | null;
  walk: ReadonlyArray<{ x: number; y: number }>;
  /** 동행 펫 겹 (P5-08, 없으면 null) + 펫 자리 기준 길 위 점들. full 은 PET_LAG 늦게 작게 깡충, lite 는 파이뱀과 같이 */
  pet?: HTMLElement | null;
  petWalk?: ReadonlyArray<{ x: number; y: number }>;
  /** 새 스테이지 이름표 (열릴 때 팝) */
  plate: HTMLElement | null;
  banner: HTMLElement | null;
}

export interface UnlockCues {
  /** 자물쇠가 깨지는 순간 (효과음 자리) */
  lock?: () => void;
  /** 파이뱀이 걷기 시작 · 도착 */
  walk?: () => void;
  land?: () => void;
  /** 노드가 열린 상태로 바뀜 (React 상태) */
  open?: () => void;
}

export interface UnlockScene {
  total: number;
  done: Promise<void>;
  playing(): boolean;
  finish(): void;
  cancel(): void;
}

type MaskStyle = CSSStyleDeclaration & {
  webkitMaskImage: string;
  webkitMaskRepeat: string;
};

/** 길 위 점들: SVG 사용자 단위 → 화면 px 이동량 (처음 점 기준). k = px / 지도 1단위 (시안 samplePath) */
export function samplePath(
  path: SVGGeometryElement,
  k: number,
  n = 13,
): { x: number; y: number }[] {
  const len = path.getTotalLength();
  const p0 = path.getPointAtLength(0);
  return Array.from({ length: n }, (_, i) => {
    const p = path.getPointAtLength((len * i) / (n - 1));
    return { x: (p.x - p0.x) * k, y: (p.y - p0.y) * k };
  });
}

/** 깡충 이동 키프레임: 길 점을 따라 가며 sin 으로 뛰고, 마지막에 착지 눌림 */
export function hopFrames(
  pts: ReadonlyArray<{ x: number; y: number }>,
  hops = 2,
  height = 26,
): Keyframe[] {
  const last = pts[pts.length - 1];
  const kf: Keyframe[] = pts.map((p, i) => {
    const t = i / (pts.length - 1);
    const hop = Math.abs(Math.sin(t * Math.PI * hops)) * height;
    const squash = i === pts.length - 1 ? ' scale(1.12, 0.88)' : '';
    return {
      transform: `translate(${p.x}px, ${p.y - hop}px)${squash}`,
      offset: t * 0.92,
    };
  });
  kf.push({ transform: `translate(${last.x}px, ${last.y}px)`, offset: 1 });
  return kf;
}

/** 동행 펫이 파이뱀 뒤를 따라오는 지연 (full, ms). 끝 시각(total)보다 짧아 연출 안에 도착 */
export const PET_LAG = 160;

export function playUnlock(
  e: UnlockEls,
  budget: MotionBudget,
  cues: UnlockCues = {},
): UnlockScene {
  const lite = !budget.ambient;
  const anims: Animation[] = [];
  const timers: number[] = [];
  const queue: { at: number; fn: () => void; ran: boolean }[] = [];
  const a = (
    el: Element | null | undefined,
    kf: Keyframe[],
    at: number,
    dur: number,
    easing = 'linear',
    fill: FillMode = 'both',
  ) => {
    if (!el || typeof (el as HTMLElement).animate !== 'function') return;
    anims.push(
      (el as HTMLElement).animate(kf, {
        delay: Math.round(at),
        duration: Math.max(1, Math.round(dur)),
        easing,
        fill,
      }),
    );
  };
  const cue = (at: number, fn?: () => void) => {
    if (fn) queue.push({ at: Math.round(at), fn, ran: false });
  };

  const body = springTiming(lite ? 'face' : 'body');
  const slam = lite ? 160 : 220;

  // ① 이전 노드 통과 도장 쾅
  let roadEnd = 0;
  if (e.stamp) {
    const rot =
      parseFloat(getComputedStyle(e.stamp).getPropertyValue('--rot')) || -10;
    a(
      e.stamp,
      [
        { transform: `scale(2.3) rotate(${rot - 14}deg)`, opacity: 0 },
        { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 },
      ],
      0,
      slam,
      EASING.stampIn,
    );
    a(
      e.stamp,
      [
        { transform: `scale(0.9) rotate(${rot - 2}deg)`, opacity: 1 },
        { transform: `rotate(${rot}deg)`, opacity: 1 },
      ],
      slam,
      body.duration,
      body.easing,
      'forwards',
    );
    if (!lite) {
      a(
        e.map,
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(2px, 1px)' },
          { transform: 'translate(-2px, 0)' },
          { transform: 'translate(0, 0)' },
        ],
        slam,
        120,
        'steps(3, end)',
        'none',
      );
      e.splats.forEach((s, i) => {
        const ang = (i / e.splats.length) * Math.PI * 2 + 0.5;
        const dist = 40 + (i % 3) * 12;
        a(
          s,
          [
            { transform: 'translate(0, 0) scale(0.4)', opacity: 1 },
            {
              transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(1)`,
              opacity: 1,
              offset: 0.6,
            },
            {
              transform: `translate(${Math.cos(ang) * dist * 1.06}px, ${Math.sin(ang) * dist * 1.06}px) scale(1)`,
              opacity: 0,
            },
          ],
          slam,
          620,
          EASING.out,
          'none',
        );
      });
    }
    // ② 잉크 길
    const roadAt = lite ? 260 : 300;
    const roadDur = lite ? 360 : 650;
    for (const r of e.roads)
      a(
        r,
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        roadAt,
        roadDur,
        EASING.ink,
      );
    roadEnd = roadAt + roadDur;
    for (const s of e.stitches)
      a(s, [{ opacity: 0 }, { opacity: 0.9 }], roadEnd, 360, EASING.out);
  }

  // ③ 자물쇠 흔들흔들 → ④ 잉크 방울 → 스케치가 컬러로 + 자물쇠 깨짐
  let wakeAt = roadEnd;
  if (!lite) {
    a(
      e.lock,
      [
        { transform: 'none' },
        { transform: 'rotate(-14deg)', offset: 0.2 },
        { transform: 'rotate(11deg)', offset: 0.4 },
        { transform: 'rotate(-8deg)', offset: 0.6 },
        { transform: 'rotate(5deg)', offset: 0.8 },
        { transform: 'none' },
      ],
      Math.max(0, roadEnd - 380),
      420,
      'ease-in-out',
      'none',
    );
    const dropAt = Math.max(0, roadEnd - 100);
    a(
      e.drop,
      [
        { transform: 'translateY(-90px) rotate(-45deg)', opacity: 1 },
        { transform: 'translateY(0) rotate(-45deg)', opacity: 1, offset: 0.85 },
        { transform: 'translateY(0) rotate(-45deg) scale(1.8)', opacity: 0 },
      ],
      dropAt,
      280,
      'cubic-bezier(0.5, 0, 1, 0.6)',
      'none',
    );
    wakeAt = dropAt + 260;
  }
  const wakeDur = lite ? 360 : 600;
  if (e.ink) {
    const s = e.ink.style as MaskStyle;
    s.maskImage = s.webkitMaskImage = lite ? INK_ROUND : INK_BLOT;
    s.maskRepeat = s.webkitMaskRepeat = 'no-repeat';
    const { x, y, size } = e.inkAt;
    const at = (d: number) =>
      ({
        visibility: 'visible',
        maskSize: `${d}px ${d}px`,
        webkitMaskSize: `${d}px ${d}px`,
        maskPosition: `${x - d / 2}px ${y - d / 2}px`,
        webkitMaskPosition: `${x - d / 2}px ${y - d / 2}px`,
      }) as Keyframe;
    a(e.ink, [at(0), at(size)], wakeAt, wakeDur, EASING.ink);
  }
  const breakDur = lite ? 300 : 460;
  const fall = 'cubic-bezier(0.5, 0, 0.9, 0.5)';
  e.halves.forEach((h, i) => {
    const dir = i === 0 ? -1 : 1;
    a(
      h,
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${dir * 10}px, -6px) rotate(${dir * 16}deg)`,
          opacity: 1,
          offset: 0.3,
        },
        {
          transform: `translate(${dir * 26}px, 36px) rotate(${dir * 48}deg)`,
          opacity: 0,
        },
      ],
      wakeAt,
      breakDur,
      fall,
      'forwards',
    );
  });
  if (!lite)
    e.shards.forEach((s, i) => {
      const ang =
        -Math.PI / 2 + ((i - (e.shards.length - 1) / 2) * Math.PI) / 4;
      const dist = 26 + (i % 2) * 10;
      a(
        s,
        [
          { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
          {
            transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist + 30}px) rotate(${(i % 2 ? 1 : -1) * 120}deg)`,
            opacity: 0,
          },
        ],
        wakeAt,
        520,
        EASING.out,
        'none',
      );
    });
  cue(wakeAt, cues.lock);
  const wakeEnd = wakeAt + wakeDur;

  // ⑤ 파이뱀 이동 (동행 펫은 같은 길을 따라옴, P5-08)
  const walkAt = wakeEnd - (lite ? 100 : 200);
  let walkEnd = walkAt;
  const move = (
    el: HTMLElement | null | undefined,
    pts: ReadonlyArray<{ x: number; y: number }>,
    lag: number,
    hops: number,
    height: number,
  ) => {
    if (pts.length < 2) {
      // 월드의 첫 스테이지: 걸어올 길이 없어 열릴 때 톡 나타남
      a(
        el,
        [
          { transform: 'translateY(12px) scale(0.6)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        walkAt + lag,
        body.duration,
        body.easing,
      );
      return 200;
    }
    if (lite) {
      const last = pts[pts.length - 1];
      a(
        el,
        [
          { transform: 'translate(0px, 0px)' },
          { transform: `translate(${last.x}px, ${last.y}px)` },
        ],
        walkAt,
        500,
        EASING.out,
      );
      return 500;
    }
    a(el, hopFrames(pts, hops, height), walkAt + lag, 720, 'linear');
    return 720;
  };
  if (e.walker) {
    walkEnd = walkAt + move(e.walker, e.walk, 0, 2, 26);
    if (e.walk.length > 1) cue(walkAt, cues.walk);
  }
  if (e.pet) move(e.pet, e.petWalk ?? [], lite ? 0 : PET_LAG, 3, 14);
  cue(walkEnd, cues.land);

  // ⑥ 열림: 이름표 팝 + "열렸어요!" 도장
  const openAt = walkEnd - 120;
  cue(openAt, cues.open);
  a(
    e.plate,
    [
      { transform: 'translateY(10px) scale(0.55) rotate(-6deg)', opacity: 0 },
      { transform: 'none', opacity: 1, offset: 0.2 },
      { transform: 'none', opacity: 1 },
    ],
    openAt,
    body.duration,
    body.easing,
    'none',
  );
  const bannerAt = walkEnd + 120;
  a(
    e.banner,
    [
      { transform: 'scale(2.3) rotate(-19deg)', opacity: 0 },
      { transform: 'scale(0.9) rotate(-7deg)', opacity: 1 },
    ],
    bannerAt,
    slam,
    EASING.stampIn,
  );
  a(
    e.banner,
    [
      { transform: 'scale(0.9) rotate(-7deg)', opacity: 1 },
      { transform: 'rotate(-5deg)', opacity: 1 },
    ],
    bannerAt + slam,
    body.duration,
    body.easing,
    'forwards',
  );
  const total =
    Math.max(openAt + body.duration, bannerAt + slam + body.duration) + 250;

  // 큐·끝
  let state: 'playing' | 'done' = 'playing';
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const runCues = () => {
    for (const q of queue)
      if (!q.ran) {
        q.ran = true;
        q.fn();
      }
  };
  const end = () => {
    if (state === 'done') return;
    state = 'done';
    timers.forEach((t) => window.clearTimeout(t));
    runCues();
    resolve();
  };
  for (const q of queue)
    timers.push(
      window.setTimeout(() => {
        if (q.ran) return;
        q.ran = true;
        q.fn();
      }, q.at),
    );
  timers.push(window.setTimeout(end, total));

  return {
    total,
    done,
    playing: () => state === 'playing',
    finish() {
      if (state === 'done') return;
      for (const an of anims) {
        try {
          an.finish();
        } catch {
          an.cancel();
        }
      }
      end();
    },
    cancel() {
      timers.forEach((t) => window.clearTimeout(t));
      anims.forEach((an) => an.cancel());
      if (e.ink) {
        const s = e.ink.style as MaskStyle;
        s.maskImage = s.webkitMaskImage = '';
        s.maskRepeat = s.webkitMaskRepeat = '';
      }
      if (state === 'playing') {
        state = 'done';
        resolve();
      }
    },
  };
}
