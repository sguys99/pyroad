// WCAG 2.x 명도 대비 계산 (무드보드 페이지와 scripts/contrast.mjs가 함께 쓴다)

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** text = 본문 4.5:1, large = 큰 글자(24px 또는 18.66px 굵게) 3:1, ui = 버튼 경계·아이콘·포커스 3:1 */
export type PairKind = 'text' | 'large' | 'ui';
export const THRESHOLD: Record<PairKind, number> = { text: 4.5, large: 3, ui: 3 };

export function passes(ratio: number, kind: PairKind): boolean {
  return ratio + 1e-9 >= THRESHOLD[kind];
}

/** 표시용: 소수 둘째 자리에서 내림 (반올림하면 4.496이 4.50으로 보여 통과처럼 읽힌다) */
export function fmtRatio(r: number): string {
  return (Math.floor(r * 100) / 100).toFixed(2);
}
