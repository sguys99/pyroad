/**
 * 공유 카드 글자 규칙 (P2-19, P0-10 §4.1). satori에는 "상자에 맞게 글자 줄이기"가 없어서 글자 폭을 em으로 어림해
 * 크기를 고르고, 그래도 넘치면 grapheme 단위로 잘라 `…`를 붙인다(자모·이모지가 깨지지 않게). 카드 컴포넌트는
 * 마지막 안전장치로 CSS `lineClamp`·`textOverflow: ellipsis`를 같이 건다.
 *
 * - 닉네임: 최대 10자(§12-Q14·P3-11 규칙과 같음). 규칙을 통과한 값만 오지만 카드 단계에서도 한 번 더 자른다
 * - 제목(스테이지·업적 이름): 한 줄에 최소 크기 이상으로 들어가면 한 줄, 아니면 2줄까지 + 줄임표
 * - 숫자: Jua에는 고정폭 숫자(tnum)가 없어 `digitCells`로 한 칸씩 같은 폭 상자에 넣는다
 */

/** 글자 폭 (em). 공유 카드 폰트를 fontTools hmtx로 잰 값 (2026-11-06, `src/fonts/share-card/`) */
export type MetricFont = 'display' | 'sans';
interface Metric {
  /** 한글 평균 (Jua는 0.814, 넓은 글자 0.872 → 넘치지 않게 조금 크게) */
  hangul: number;
  upper: number;
  lower: number;
  digit: number;
  space: number;
  punct: number;
}
export const METRICS: Record<MetricFont, Metric> = {
  display: {
    hangul: 0.83,
    upper: 0.61,
    lower: 0.48,
    digit: 0.63,
    space: 0.3,
    punct: 0.35,
  },
  sans: {
    hangul: 0.864,
    upper: 0.67,
    lower: 0.54,
    digit: 0.66,
    space: 0.23,
    punct: 0.34,
  },
};

/** 닉네임 최대 글자 수 (§12-Q14, P3-11) */
export const NICKNAME_MAX = 10;
/** 줄임표. Jua에 없는 글자라 대체 폰트(pyRoad Sans)로 그려진다 → 폭은 sans 기준 */
export const ELLIPSIS = '…';
const ELLIPSIS_EM = 0.9;

const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });

export function graphemes(s: string): string[] {
  return Array.from(segmenter.segment(s), (x) => x.segment);
}

function charEm(g: string, font: MetricFont): number {
  const m = METRICS[font];
  const c = g.codePointAt(0) ?? 0;
  if (g === ELLIPSIS) return ELLIPSIS_EM;
  if (c === 0x20 || c === 0xa0) return m.space;
  if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3131 && c <= 0x318e)) {
    return m.hangul;
  }
  if (c >= 0x2e80) return 1; // CJK·전각·그 밖 (카드에는 오지 않지만 넘치지 않게 넉넉히)
  if (/[0-9]/.test(g)) return m.digit;
  if (/[A-Z]/.test(g)) return m.upper;
  if (/[a-z]/.test(g)) return m.lower;
  return m.punct;
}

/** 글자 폭 합 (em) */
export function emWidth(s: string, font: MetricFont = 'sans'): number {
  return graphemes(s).reduce((a, g) => a + charEm(g, font), 0);
}

/** maxEm을 넘으면 grapheme 단위로 잘라 `…`를 붙인다 */
export function truncateEm(
  s: string,
  maxEm: number,
  font: MetricFont = 'sans',
): string {
  if (emWidth(s, font) <= maxEm) return s;
  let out = '';
  let w = 0;
  for (const g of graphemes(s)) {
    const cw = charEm(g, font);
    if (w + cw > maxEm - ELLIPSIS_EM) break;
    out += g;
    w += cw;
  }
  return `${out.trimEnd()}${ELLIPSIS}`;
}

/** 공백 정리, 제어문자·방향 제어·폭 없는 문자 제거 */
export function cleanText(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 닉네임: 정리 후 최대 10자. 넘으면 10자 + `…` (규칙을 통과한 값이면 그대로) */
export function normalizeNickname(s: string, max = NICKNAME_MAX): string {
  const gs = graphemes(cleanText(s));
  return gs.length > max
    ? `${gs.slice(0, max).join('')}${ELLIPSIS}`
    : gs.join('');
}

export interface FitOptions {
  max: number;
  min: number;
  font?: MetricFont;
}

/** 한 줄: 상자 폭에 맞는 글자 크기(max~min). 최소 크기로도 넘치면 자른다 */
export function fitLine(
  s: string,
  boxWidth: number,
  { max, min, font = 'sans' }: FitOptions,
): { text: string; fontSize: number } {
  const em = Math.max(emWidth(s, font), 0.01);
  const ideal = Math.floor(boxWidth / em);
  if (ideal >= min) return { text: s, fontSize: Math.min(max, ideal) };
  return { text: truncateEm(s, boxWidth / min, font), fontSize: min };
}

/**
 * 제목: 한 줄에 `oneLineMin` 이상으로 들어가면 한 줄. 아니면 2줄 크기(max2~min)로 다시 맞추고
 * 그래도 넘치면 2줄 분량에서 자른다. 줄바꿈 자체는 satori가 한다(`wordBreak: keep-all`, 낱말 단위)
 * → 낱말 경계 손실을 생각해 2줄 용량은 90%로 어림한다
 */
export function fitTitle(
  s: string,
  boxWidth: number,
  {
    max,
    oneLineMin,
    max2,
    min,
    font = 'display',
  }: {
    max: number;
    oneLineMin: number;
    max2: number;
    min: number;
    font?: MetricFont;
  },
): { text: string; fontSize: number; lines: 1 | 2 } {
  const text = cleanText(s);
  const em = Math.max(emWidth(text, font), 0.01);
  const one = Math.floor(boxWidth / em);
  if (one >= oneLineMin) {
    return { text, fontSize: Math.min(max, one), lines: 1 };
  }
  const capacity = 2 * boxWidth * 0.9;
  const two = Math.floor(capacity / em);
  if (two >= min) return { text, fontSize: Math.min(max2, two), lines: 2 };
  return {
    text: truncateEm(text, capacity / min, font),
    fontSize: min,
    lines: 2,
  };
}

/** 숫자 고정폭: "128" → ["1","2","8"]. 카드는 칸마다 같은 폭(`digitWidth`) 상자에 넣는다 */
export function digitCells(n: number): string[] {
  return String(Math.max(0, Math.floor(n))).split('');
}

/**
 * 고정폭 숫자 한 칸의 폭 (em). 넓은 숫자(0·4·6)에 맞춘 값 — Jua "4"가 0.628em이라 0.6 칸에서 양옆 1%씩 넘지만
 * 큰 숫자에서 "1"의 빈틈이 덜 벌어진다
 */
export function digitWidth(font: MetricFont): number {
  return font === 'display' ? 0.6 : METRICS.sans.digit;
}

/**
 * "레벨 128 달성!"처럼 [앞말 · 숫자 · 뒷말] 한 줄이 상자에 들어가는 숫자 크기.
 * 앞뒤 말은 `unitSize`(고정), 숫자는 `max`에서 줄여 맞춘다
 */
export function fitNumberRow(
  value: number,
  boxWidth: number,
  {
    max,
    unitSize,
    before = '',
    after = '',
    gap = 0,
  }: {
    max: number;
    unitSize: number;
    before?: string;
    after?: string;
    gap?: number;
  },
): number {
  const words = (before ? 1 : 0) + (after ? 1 : 0);
  const fixed =
    (emWidth(before, 'display') + emWidth(after, 'display')) * unitSize +
    words * gap;
  const digits = digitCells(value).length * digitWidth('display');
  return Math.max(
    unitSize,
    Math.min(max, Math.floor((boxWidth - fixed) / digits)),
  );
}
