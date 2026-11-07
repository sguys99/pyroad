import { TYPE } from '@/lib/design/tokens';

/**
 * 코드 글자 크기 단계 (P2-18, docs/design/editor.md).
 * D2Coding(pyRoad Mono)은 반각이 0.5em이라 **짝수 px에서만** 한글 1자 = 영문 2자 폭이 정확히 맞는다.
 * 홀수 px(15px)는 반각이 반올림돼 주석 `#` 열이 3~4px 어긋난다(P2-01·P2-10 실측) → 14·16·18·20만 둔다.
 * px로 둔다(rem 아님): 브라우저 글자 크기 배율이 곱해지면 홀수·소수 px가 될 수 있어서
 */
export const CODE_FONT_SIZES = [14, 16, 18, 20] as const;

export type CodeFontSize = (typeof CODE_FONT_SIZES)[number];

/** 기본 16px (= `TYPE.code`) */
export const DEFAULT_CODE_FONT_SIZE: CodeFontSize = TYPE.code.size;

/** 행간 (= `TYPE.code`). 글자 크기와 상관없이 같은 비율 */
export const CODE_LINE_HEIGHT = TYPE.code.lineHeight;

/**
 * 기기 저장소 키 (움직임 `pyroad.motion.v1`·소리 `pyroad.sound.v1`과 같은 이름 규칙). 개인정보가 아닌 읽기 선호라
 * 로그아웃 뒤에도 남긴다. 로그인 사용자 서버 저장은 아직 없음(보고서 제안)
 */
export const CODE_FONT_SIZE_STORAGE_KEY = 'pyroad.codeFontSize.v1';

export function isCodeFontSize(v: unknown): v is CodeFontSize {
  return (CODE_FONT_SIZES as readonly unknown[]).includes(v);
}

/** 저장소에서 읽은 믿을 수 없는 값 → 단계 값 (모르는 값·홀수 px는 기본값) */
export function normalizeCodeFontSize(raw: unknown): CodeFontSize {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return isCodeFontSize(n) ? n : DEFAULT_CODE_FONT_SIZE;
}

/** 한 단계 크게(+1)·작게(-1). 끝에서는 그대로 */
export function stepCodeFontSize(
  size: CodeFontSize,
  dir: 1 | -1,
): CodeFontSize {
  const i = CODE_FONT_SIZES.indexOf(size);
  const next = Math.min(CODE_FONT_SIZES.length - 1, Math.max(0, i + dir));
  return CODE_FONT_SIZES[next];
}
