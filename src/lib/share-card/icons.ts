/**
 * 공유 카드 자체 아이콘 (P2-19). 이모지 대신 SVG 문자열 → data URI `<img>`로 넣는다(이모지 폰트·외부 CDN 없음, P0-10 §4.5).
 * - 별·코인 모양은 최종 시안 보상 아이콘(`design/prototypes/src/final/reward.tsx`)과 같다: 금색 하나 + 그 진한 톤 외곽선 1px 안팎
 * - 메달 안 그림·작은 기호는 24 격자 단순 선 그림(자체 제작). 흐림·필터 없음
 * - `<text>`·`<foreignObject>`·래스터 `<image>` 금지(resvg가 못 그림). 테스트가 모든 아이콘을 검사한다
 */
import { COLOR } from '@/lib/design/tokens';
import { svgDataUri } from './svg';
import { STAR_COLOR, TIER_COLOR, TIER_RANK } from './tokens';
import type { BadgeIcon, Tier } from './types';

const STAR =
  'M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z';

const svg = (viewBox: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;

/** 별 (채움·빈 별). 빈 별은 중립 면 + 옅은 선 */
export function starSvg(filled: boolean): string {
  if (!filled) {
    return svg(
      '0 0 32 32',
      `<path d="${STAR}" fill="${STAR_COLOR.emptyFill}" stroke="${STAR_COLOR.emptyLine}" stroke-width="1.1" stroke-linejoin="round"/>`,
    );
  }
  return svg(
    '0 0 32 32',
    `<path d="${STAR}" fill="${STAR_COLOR.fill}" stroke="${STAR_COLOR.line}" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<path d="M12.6 11.6l1.6-3" stroke="${STAR_COLOR.light}" stroke-width="1.8" stroke-linecap="round"/>`,
  );
}

/** 반짝이 (4갈래 별). 무대 장식 */
export function sparkleSvg(color: string = COLOR.accent): string {
  return svg(
    '0 0 24 24',
    `<path d="M12 1.5c.7 5.6 4.9 9.8 10.5 10.5-5.6.7-9.8 4.9-10.5 10.5C11.3 16.9 7.1 12.7 1.5 12 7.1 11.3 11.3 7.1 12 1.5z" fill="${color}"/>`,
  );
}

/** 24 격자 선 그림 (stroke = 색, 두께 2.2) */
const GLYPH: Record<BadgeIcon | 'flag', string> = {
  code: '<path d="M8.5 7.5 4 12l4.5 4.5M15.5 7.5 20 12l-4.5 4.5M13.4 5.5l-2.8 13"/>',
  bug:
    '<path d="M8.5 9.5a3.5 3.5 0 0 1 7 0"/><rect x="7" y="9.5" width="10" height="10" rx="5"/>' +
    '<path d="M12 12.5v7M3.5 13h3.5M17 13h3.5M4.5 8.5l2.8 2M19.5 8.5l-2.8 2M4.5 19l2.9-2M19.5 19l-2.9-2M10 6l-1.5-2M14 6l1.5-2"/>',
  flame:
    '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.3 2.4-5.2 3.6-7.6.4 1.7 1.3 2.8 2.4 3.4C11.9 7.6 13 5 15.5 3c-.3 3 1 5.1 2.2 6.9.9 1.4 1.8 2.9 1.8 5.1 0 3.4-3.6 6-7.5 6z"/>' +
    '<path d="M12 21c-1.7 0-2.8-1.1-2.8-2.6 0-1.7 1.6-2.6 2.2-4.2 1.4 1 3.4 2.2 3.4 4.2 0 1.5-1.1 2.6-2.8 2.6z"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  book: '<path d="M12 6.5C10.3 5 7.6 4.5 4 4.7v13.6c3.6-.2 6.3.3 8 1.8 1.7-1.5 4.4-2 8-1.8V4.7c-3.6-.2-6.3.3-8 1.8z"/><path d="M12 6.5v13.6"/>',
  bulb: '<path d="M9 17.5h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17.5h5.2V15.8c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  crown: '<path d="M4 18.5h16M4.5 15.5 3 7l5 3.5L12 4.5l4 6L21 7l-1.5 8.5z"/>',
  flag: '<path d="M5 21V4M5 4.5c4.5-2 7.5 2 14 0v9c-6.5 2-9.5-2-14 0"/>',
};

export function glyphSvg(
  icon: BadgeIcon | 'flag',
  color: string,
  width = 2.2,
): string {
  return svg(
    '0 0 24 24',
    `<g fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${GLYPH[icon]}</g>`,
  );
}

/**
 * 업적 메달: 리본 두 갈래(뒤) → 아랫면(단색 오프셋, 흐림 그림자 대신) → 테두리 → 면 → 안쪽 고리 → 하이라이트 → 그림.
 * viewBox 0 0 200 220
 */
export function medalSvg(tier: Tier, icon: BadgeIcon): string {
  const c = TIER_COLOR[tier];
  const glyph = GLYPH[icon];
  return svg(
    '0 0 200 220',
    // 리본 (초록 = 브랜드 주색, 끝은 V자로 자름)
    `<path d="M62 120 40 208l26-12 18 22 22-84z" fill="${COLOR.primary}"/>` +
      `<path d="M138 120l22 88-26-12-18 22-22-84z" fill="${COLOR.primaryLip}"/>` +
      // 아랫면 + 테두리 + 면
      `<circle cx="100" cy="98" r="84" fill="${c.rim}"/>` +
      `<circle cx="100" cy="92" r="84" fill="${c.rim}"/>` +
      `<circle cx="100" cy="92" r="76" fill="${c.face}"/>` +
      `<circle cx="100" cy="92" r="60" fill="none" stroke="${c.rim}" stroke-width="3" opacity="0.55"/>` +
      `<path d="M52 66a56 56 0 0 1 34-28" fill="none" stroke="${c.light}" stroke-width="7" stroke-linecap="round" opacity="0.9"/>` +
      // 그림 (24 격자를 4배)
      `<g transform="translate(52 44) scale(4)" fill="none" stroke="${c.rim}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`,
  );
}

/** 티어 단계 별 점 (메달 아래, 색 대신 개수로도 구별) */
export function tierPipsSvg(tier: Tier): string {
  const n = TIER_RANK[tier];
  const c = TIER_COLOR[tier];
  let body = '';
  for (let i = 0; i < 3; i++) {
    const on = i < n;
    body += `<g transform="translate(${i * 36} 0)"><path d="${STAR}" fill="${on ? c.face : STAR_COLOR.emptyFill}" stroke="${on ? c.rim : STAR_COLOR.emptyLine}" stroke-width="1.4" stroke-linejoin="round"/></g>`;
  }
  return svg('0 0 104 32', body);
}

/** pyRoad 로고 표시 (펼친 책 + 길). 글자는 카드 쪽 Jua 글자로 */
export function brandMarkSvg(): string {
  return svg(
    '0 0 32 32',
    `<path d="M16 8.5C13.5 6.3 9.6 5.6 4.5 5.9v18.6c5.1-.3 9 .4 11.5 2.6 2.5-2.2 6.4-2.9 11.5-2.6V5.9C22.4 5.6 18.5 6.3 16 8.5z" fill="${COLOR.surface}" stroke="${COLOR.text}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M16 8.5v18.6" stroke="${COLOR.text}" stroke-width="2"/>` +
      `<path d="M7.5 20.5c2.2-2.6 4.6-1.4 6-3.6M18.5 13.5c2.4.6 4.4-.8 6-2.6" fill="none" stroke="${COLOR.primary}" stroke-width="2" stroke-linecap="round" stroke-dasharray="0.1 3.4"/>`,
  );
}

export const iconUri = svgDataUri;

/** 테스트용: 카드가 쓰는 모든 아이콘 SVG */
export function allIconSvgs(): string[] {
  const tiers: Tier[] = ['bronze', 'silver', 'gold'];
  const icons = Object.keys(GLYPH) as (BadgeIcon | 'flag')[];
  return [
    starSvg(true),
    starSvg(false),
    sparkleSvg(),
    brandMarkSvg(),
    ...icons.map((i) => glyphSvg(i, COLOR.text)),
    ...tiers.flatMap((t) => [
      tierPipsSvg(t),
      ...icons
        .filter((i): i is BadgeIcon => i !== 'flag')
        .map((i) => medalSvg(t, i)),
    ]),
  ];
}
