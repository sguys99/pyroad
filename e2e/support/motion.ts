// 연출 단계 대체 검사 공용 (P2-12, docs/design/catalog.md §4). 카탈로그(public)와 앱 화면(로그인) 스펙이 같이 쓴다.
//
// "돌고 있는 무한 반복 애니메이션" = document.getAnimations() 중 playState 'running' + iterations Infinity.
// CSS 애니메이션은 animationName으로, 나머지(WAAPI)는 'waapi'로 센다. Framer 일회성·CSS 전환은 유한이라 세지 않는다.

import type { Page } from '@playwright/test';

/**
 * 기능 신호라 minimal에서도 도는 반복 연출 (동작 줄이기에서는 모두 멈춤). 근거: motion-guidelines §2
 * "바쁨 표시(로딩 점·스피너)는 기능 피드백이라 단계와 무관하게 돌고, 동작 줄이기에서만 멈춥니다"
 */
export const MINIMAL_ALLOW: Record<string, string> = {
  'g-caret': '말풍선 타자·AI 튜터 스트리밍 커서 (바쁨 표시, game-ui.css)',
  spin: '로딩 스피너 animate-spin (버튼 loading·실행 중, reduced:animate-none)',
  pulse: '스켈레톤 animate-pulse (화면 로딩, reduced:animate-none)',
  'waking-dot': '실행기 다시 깨우는 중 점 세 개 (globals.css 바쁨 표시)',
  'thinking-dot': 'AI 튜터 생각 중 점 세 개 (globals.css 바쁨 표시)',
  'qr-busy':
    '실행기 준비·재준비 단계 칸의 흐르는 조각 (runControls.css 바쁨 표시, P6-05)',
  'cm-blink':
    '코드 에디터 커서 깜빡임 = 입력 위치 신호 (CodeMirror 기본, 동작 줄이기에서 멈춤)',
  'cm-blink2':
    '코드 에디터 커서 깜빡임 (CodeMirror가 입력마다 cm-blink와 번갈아 씀)',
};

/**
 * 동작 줄이기(단계 full·lite)에서 남는 반복 연출. 움직임이 아니라 표정 단서(§12-Q26):
 * "몸은 멈추고 느린 눈 깜빡임만 남깁니다(7초에 한 번 0.4초, opacity·scaleY)". minimal이면 이것도 없다
 */
export const REDUCED_ALLOW: Record<string, string> = {
  'char-blink-eye-slow': '느린 눈 깜빡임 (예전 캐릭터 SVG, §12-Q26)',
  'char-blink-highlight-slow': '느린 눈 깜빡임의 눈 반짝임 (§12-Q26)',
};

/** 앰비언트: full만 (lite부터 정지 배경). wm-*는 월드 지도 (P5-09, worldMap.css) */
export const AMBIENT = [
  'float-cloud',
  'drift-leaf',
  'stage-shimmer',
  'wm-cloud',
  'wm-wave',
  'wm-boat',
  'wm-bird',
  'wm-flap',
  'wm-spark',
  'wm-leaf',
];

/** 대기 루프: full·lite만 */
export const IDLE_LOOPS = [
  'character-breathe',
  'mascot-bob',
  'step-pulse',
  'stage-pulse',
  'wn-ring',
  'char-blink-eye',
  'char-blink-highlight',
  'char-twinkle',
  // 실행 중 버튼 빛 띠 (runControls.css, P6-05). 꾸밈이라 minimal은 버튼 스피너만
  'qr-sweep',
];

export interface RunningLoop {
  name: string;
  /** 대상 요소 (태그.클래스 앞부분) — 실패 메시지에서 어디인지 알려고 */
  target: string;
}

export function runningLoops(page: Page): Promise<RunningLoop[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.playState === 'running' &&
          a.effect?.getComputedTiming().iterations === Infinity,
      )
      .map((a) => {
        const el = (a.effect as KeyframeEffect | null)?.target as
          | Element
          | null
          | undefined;
        const cls =
          el && typeof el.className === 'string'
            ? el.className
            : (el?.getAttribute('class') ?? '');
        return {
          name:
            'animationName' in a
              ? String((a as CSSAnimation).animationName)
              : 'waapi',
          target: el ? `${el.tagName.toLowerCase()}.${cls.slice(0, 60)}` : '?',
        };
      }),
  );
}

export const loopNames = (loops: RunningLoop[]) => [
  ...new Set(loops.map((l) => l.name)),
];

/** 허용 목록 밖의 반복 연출 (실패 메시지용으로 대상까지) */
export function outside(
  loops: RunningLoop[],
  allow: Record<string, string>,
): RunningLoop[] {
  return loops.filter((l) => !(l.name in allow));
}

/** 흐림(backdrop-filter·filter blur)이 걸린 보이는 요소 수 */
export function blurredCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('body *')) {
      const s = getComputedStyle(el);
      const backdrop =
        s.backdropFilter ||
        (s as unknown as { webkitBackdropFilter?: string })
          .webkitBackdropFilter ||
        'none';
      if (backdrop.includes('blur') || s.filter.includes('blur')) n++;
    }
    return n;
  });
}

/** 연출 단계 + 동작 줄이기 조합 (카탈로그 `?motion=&reduced=`, 사용자 설정 `users.settings.motion`과 같은 값) */
export interface MotionMode {
  name: string;
  tier: 'full' | 'lite' | 'minimal';
  reduced: 'on' | 'off';
}

export const MOTION_MODES: MotionMode[] = [
  { name: 'full', tier: 'full', reduced: 'off' },
  { name: 'lite', tier: 'lite', reduced: 'off' },
  { name: 'minimal', tier: 'minimal', reduced: 'off' },
  { name: '동작 줄이기(full)', tier: 'full', reduced: 'on' },
  { name: 'minimal + 동작 줄이기', tier: 'minimal', reduced: 'on' },
];

/** 단계별 공통 기대값: 반복 연출 목록 검사. 실패하면 이름과 대상을 메시지로 */
export function loopViolations(
  mode: MotionMode,
  loops: RunningLoop[],
): RunningLoop[] {
  if (mode.reduced === 'on') {
    return mode.tier === 'minimal' ? loops : outside(loops, REDUCED_ALLOW);
  }
  if (mode.tier === 'minimal') return outside(loops, MINIMAL_ALLOW);
  if (mode.tier === 'lite')
    return loops.filter((l) => AMBIENT.includes(l.name));
  return [];
}
