import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { FONT_FAMILY, themeCssVars } from '@/lib/design/tokens';

/**
 * `@theme` 변수 이름에서 Tailwind 유틸리티 값 이름을 뽑는다: `--text-small` → `small`, `--shadow-card` → `card`.
 * `--text-small--line-height`처럼 `--`가 한 번 더 붙은 하위 값은 뺀다. 원본은 `themeCssVars()`(globals.css `@theme`과 같음을 테스트가 확인)
 */
export function themeScale(
  prefix: string,
  vars: Record<string, string> = themeCssVars(),
): string[] {
  const head = `--${prefix}-`;
  return Object.keys(vars)
    .filter((k) => k.startsWith(head) && !k.slice(head.length).includes('--'))
    .map((k) => k.slice(head.length));
}

/**
 * 프로젝트 토큰을 아는 tailwind-merge (B44). 기본 tailwind-merge는 `text-small`·`text-caption`·`shadow-card`·
 * `px-gutter` 같은 이름을 모른다 → `text-small`을 글자색으로 보고 뒤의 `text-text-muted`가 지워 버리고(크기 사라짐),
 * `shadow-card`를 그림자 색으로 보며, `px-gutter`와 `px-4`가 서로 덮지 못했다.
 * 토큰 원본(`src/lib/design/tokens.ts`)에서 이름을 뽑으므로 토큰을 더하면 자동으로 따라온다.
 */
const vars = themeCssVars();
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: themeScale('text', vars),
      shadow: themeScale('shadow', vars),
      radius: themeScale('radius', vars),
      spacing: themeScale('spacing', vars),
      ease: themeScale('ease', vars),
      font: Object.keys(FONT_FAMILY),
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
