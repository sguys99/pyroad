/**
 * 공유 카드 토큰 (P2-19, docs/design/share-card.md). 색은 모두 `@/lib/design/tokens`에서 가져오거나 그 색을 섞어 만든다
 * (리터럴 없음, `tokens:check`). 최종 시안(§12-Q31): 단일 톤 바탕, 테두리 없는 면, 중립 + 초록 + 금색.
 *
 * 크기: 1200×630 마스터. 카카오는 스크랩 이미지를 800×400(2:1)으로 스마트 크롭해 위아래 약 15px씩 잘리므로
 * 핵심 요소는 위아래 20px 안쪽(`SAFE`)에 둔다(P0-10 §4.7). 썸네일은 휴대폰에서 폭 260~300px 안팎(약 1/4)으로 보이므로
 * 꼭 읽혀야 하는 글자는 30px 이상, 핵심 정보는 100px 안팎으로 크게 쓴다.
 */
import {
  COLOR,
  FONT_FAMILY,
  RADIUS,
  WORLD_THEMES,
  blend,
  type WorldId,
} from '@/lib/design/tokens';
import type { Tier } from './types';

export const CARD = { width: 1200, height: 630 } as const;

/** 카카오 2:1 크롭 안전 영역 (위아래 20px) */
export const SAFE = { top: 20, bottom: 20 } as const;

/** 바깥 여백 (안전 영역보다 넉넉히) */
export const PAD = 48;

/** 왼쪽 캐릭터 무대 폭 */
export const STAGE_W = 500;
/** 오른쪽 글 영역 폭 = 1200 − 여백 2 − 무대 − 사이 간격 */
export const GAP = 56;
export const TEXT_W = CARD.width - PAD * 2 - STAGE_W - GAP;

/** 반경: 화면 토큰을 카드 크기(썸네일에서 1/4로 줄어듦)에 맞게 키운 값 */
export const CARD_RADIUS = {
  stage: RADIUS.l * 2,
  chip: RADIUS.pill,
  tile: RADIUS.l,
} as const;

export const FONT = {
  display: FONT_FAMILY.display,
  sans: FONT_FAMILY.sans,
} as const;

/** 글자 크기 (px). 핵심 하나만 크게 */
export const TYPE = {
  kicker: 30,
  /** 10자 닉네임 + 가장 긴 붙는 말(“님이 받았어요”)이 한 줄에 들어가는 최소 크기가 min (테스트) */
  nickname: { max: 54, min: 38 },
  /** 레벨 숫자·퀘스트 수 같은 핵심 수치 */
  hero: 150,
  heroUnit: 64,
  title: { max: 84, oneLineMin: 64, max2: 64, min: 48 },
  body: 30,
  brand: 34,
  brandNote: 24,
} as const;

/** 월드 틴트: 무대 바탕(soft)·땅(tint 옅게)·눈썹 글자(ink). 글자는 ink만 (AA) */
export function worldPalette(world: WorldId) {
  const t = WORLD_THEMES[world];
  const soft = COLOR[t.soft];
  return {
    soft,
    ground: blend(COLOR[t.tint], soft, 0.45),
    ink: COLOR[t.ink],
    tint: COLOR[t.tint],
  };
}

/**
 * 업적 티어 색. 금색은 강조색 그대로, 은색은 중립 회색, 동색은 금색과 오류색을 섞은 구릿빛(새 색상군을 늘리지 않음).
 * - face: 메달 면 · rim: 테두리·아랫면 · light: 하이라이트 · soft: 이름표 바탕 · ink: 이름표 글자(soft 위 AA)
 */
export const TIER_COLOR: Record<
  Tier,
  { face: string; rim: string; light: string; soft: string; ink: string }
> = {
  gold: {
    face: COLOR.accent,
    rim: COLOR.accentLip,
    light: COLOR.accentLight,
    soft: COLOR.accentSoft,
    ink: COLOR.accentText,
  },
  silver: {
    face: blend(COLOR.lineStrong, COLOR.surface, 0.36),
    rim: COLOR.lineStrong,
    light: COLOR.surface,
    soft: COLOR.surface2,
    ink: COLOR.textMuted,
  },
  bronze: {
    face: blend(COLOR.error, COLOR.accent, 0.42),
    rim: blend(COLOR.error, COLOR.accentLip, 0.5),
    light: blend(COLOR.error, COLOR.accentLight, 0.18),
    soft: blend(COLOR.error, COLOR.accentSoft, 0.1),
    ink: blend(COLOR.error, COLOR.accentText, 0.45),
  },
};

export const TIER_LABEL: Record<Tier, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
};

/** 티어 단계 (색을 못 구별해도 알 수 있게 메달 아래 별 개수로도 표시) */
export const TIER_RANK: Record<Tier, 1 | 2 | 3> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

/** 별·코인 (최종 시안 보상 아이콘과 같은 금색 하나) */
export const STAR_COLOR = {
  fill: COLOR.accent,
  line: COLOR.accentLip,
  light: COLOR.accentLight,
  emptyFill: COLOR.line,
  emptyLine: blend(COLOR.lineStrong, COLOR.line, 0.45),
} as const;
