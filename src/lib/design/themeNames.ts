/**
 * Tailwind 테마 값 이름 목록 (B44 → P4-12). `cn()`(tailwind-merge 확장)이 프로젝트 토큰 유틸리티를 알게 하는 데만 쓴다.
 *
 * 토큰 원본(`./tokens.ts`)을 import하면 대비표·색 값까지 모든 화면 첫 JS에 실려(약 6KB gzip, 랜딩 포함) 이름만 따로 둔다.
 * 원본과 같은지는 `src/lib/__tests__/utils.test.ts`가 `themeScale()`로 확인한다 → 토큰 이름을 더하거나 바꾸면 여기도 같이 고친다.
 */
export const THEME_NAMES = {
  /** `--text-*` (TYPE) */
  text: [
    'hero',
    'hero-wide',
    'h1',
    'h2',
    'h3',
    'button',
    'button-lg',
    'body',
    'small',
    'caption',
    'kicker',
    'code',
  ],
  /** `--shadow-*` */
  shadow: ['card', 'pop', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'],
  /** `--radius-*` */
  radius: ['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'],
  /** `--spacing-*` (`--spacing` 기본 단위는 빼고) */
  spacing: ['touch', 'gutter'],
  /** `--ease-*` (EASING) */
  ease: ['out', 'in-out', 'press', 'back-out', 'stamp-in', 'ink', 'page'],
  /** FONT_FAMILY */
  font: ['display', 'sans', 'mono'],
} as const satisfies Record<string, readonly string[]>;
