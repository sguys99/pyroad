import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { THEME_NAMES } from '@/lib/design/themeNames';

/**
 * 프로젝트 토큰을 아는 tailwind-merge (B44). 기본 tailwind-merge는 `text-small`·`text-caption`·`shadow-card`·
 * `px-gutter` 같은 이름을 모른다 → `text-small`을 글자색으로 보고 뒤의 `text-text-muted`가 지워 버리고(크기 사라짐),
 * `shadow-card`를 그림자 색으로 보며, `px-gutter`와 `px-4`가 서로 덮지 못했다.
 * 이름은 `THEME_NAMES`(토큰 원본과 같은지 테스트가 확인). 토큰 원본을 직접 import하지 않는다: 모든 화면 첫 JS가 커진다 (P4-12)
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...THEME_NAMES.text],
      shadow: [...THEME_NAMES.shadow],
      radius: [...THEME_NAMES.radius],
      spacing: [...THEME_NAMES.spacing],
      ease: [...THEME_NAMES.ease],
      font: [...THEME_NAMES.font],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
