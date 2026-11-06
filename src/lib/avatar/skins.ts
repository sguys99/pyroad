/**
 * 파이뱀 스킨 카탈로그 (P3-13, §12-Q34). 공개 아바타 = "내 파이뱀 색" 하나.
 *
 * - 저장: `users.avatar_config.skin` (온보딩 P3-11에서 고름). 다른 사람에게는 `user_public_profiles.avatar_skin`
 *   (동기화 트리거가 모르는 값을 NULL로 바꿔 복사, 00021)으로만 보인다. NULL·모르는 값 = 기본 `green`
 * - 그리기: 리그 팔레트 덮어쓰기(`PybaemStatic palette={skinPalette(id)}`). Phase 9 꾸미기(F6, 스킨 = 팔레트 재색칠)·
 *   HUD 아바타·공유 카드가 같은 값을 쓴다
 * - 색: 스타일 B(그림책) 기준. 외곽선은 몸색의 진한 톤(`tonal`), 눈·입(ink)·바닥 그림자는 모든 스킨이 같다.
 *   단색 바탕 `#F6F4EF`·주색 초록·금색과 어울리게 채도를 낮춘 파스텔이고, 32px HUD 크기와 색각 이상(적록·청황)에서도
 *   구분되도록 색상뿐 아니라 밝기를 벌려 두었다(검사: `__tests__/skins.test.ts`의 색각 시뮬레이션 ΔE)
 * - 캐릭터 고유색이라 디자인 토큰이 아니다 (docs/design/tokens.md §6 예외, `tokens:check` ALLOW)
 *
 * ⚠️ id 목록은 DB와 같아야 한다: `supabase/migrations/00021_public_avatar_skin.sql`의 `ARRAY[…]` 두 곳
 *    (CHECK·동기화 트리거). 단위 테스트가 대조한다. 한번 쓴 id는 바꾸거나 지우지 않는다(저장된 값이 기본색으로 돌아감)
 */
import type { PybaemPalette } from '@/components/characters/rig/pybaem';

export const SKIN_IDS = [
  'green',
  'sky',
  'sunset',
  'berry',
  'violet',
  'sunny',
] as const;

export type SkinId = (typeof SKIN_IDS)[number];

export const DEFAULT_SKIN_ID: SkinId = 'green';

/** 스킨이 덮어쓰는 팔레트 키 (ink·shadow는 모든 스킨이 같음) */
export type SkinPalette = Pick<
  PybaemPalette,
  | 'body'
  | 'bodyDark'
  | 'bodyLight'
  | 'belly'
  | 'outline'
  | 'cheek'
  | 'cheekAlpha'
  | 'tongue'
>;

export interface PybaemSkin {
  id: SkinId;
  /** 아이에게 보이는 이름 (고르기 화면·낭독기) */
  name: string;
  palette: SkinPalette;
}

export const PYBAEM_SKINS: readonly PybaemSkin[] = [
  {
    id: 'green',
    name: '숲초록',
    // = PYBAEM_PALETTES.B (기본 파이뱀, 테스트가 대조)
    palette: {
      body: '#9CCB80',
      bodyDark: '#77A862',
      bodyLight: '#C4E2AE',
      belly: '#EAF1CF',
      outline: '#5F804E',
      cheek: '#F2879B',
      cheekAlpha: '0.84',
      tongue: '#E07A6C',
    },
  },
  {
    id: 'sky',
    name: '하늘파랑',
    palette: {
      body: '#88BCE2',
      bodyDark: '#6499C2',
      bodyLight: '#B9D8EF',
      belly: '#E9F2F8',
      outline: '#4C7596',
      cheek: '#F2879B',
      cheekAlpha: '0.84',
      tongue: '#E07A6C',
    },
  },
  {
    id: 'sunset',
    name: '노을주황',
    palette: {
      body: '#E08B57',
      bodyDark: '#C26D3C',
      bodyLight: '#EFB48C',
      belly: '#FBEBDD',
      outline: '#94532B',
      cheek: '#E8657A',
      cheekAlpha: '0.82',
      tongue: '#C9584A',
    },
  },
  {
    id: 'berry',
    name: '딸기분홍',
    palette: {
      body: '#F2B3C4',
      bodyDark: '#DA8DA2',
      bodyLight: '#F8D3DD',
      belly: '#FDF0F3',
      outline: '#A45C70',
      cheek: '#E45A7C',
      cheekAlpha: '0.85',
      tongue: '#D45A66',
    },
  },
  {
    id: 'violet',
    name: '보라별',
    palette: {
      body: '#9580CB',
      bodyDark: '#7763AE',
      bodyLight: '#BCAEE0',
      belly: '#EEEAF8',
      outline: '#594888',
      cheek: '#F2879B',
      cheekAlpha: '0.84',
      tongue: '#E07A6C',
    },
  },
  {
    id: 'sunny',
    name: '햇살노랑',
    palette: {
      body: '#F3DA7A',
      bodyDark: '#D9B84A',
      bodyLight: '#F8E9AE',
      belly: '#FDF8E2',
      outline: '#9A7F22',
      cheek: '#F08A86',
      cheekAlpha: '0.84',
      tongue: '#E07A6C',
    },
  },
];

const BY_ID = new Map<string, PybaemSkin>(PYBAEM_SKINS.map((s) => [s.id, s]));

export function isSkinId(value: unknown): value is SkinId {
  return typeof value === 'string' && BY_ID.has(value);
}

/** id → 스킨. 모르는 값·NULL은 기본(숲초록) */
export function getSkin(id: unknown): PybaemSkin {
  return BY_ID.get(isSkinId(id) ? id : DEFAULT_SKIN_ID)!;
}

/** 리그 `palette` prop에 그대로 넣는 덮어쓰기 (스타일 B 기준) */
export function skinPalette(id: unknown): SkinPalette {
  return getSkin(id).palette;
}

/** `users.avatar_config`(jsonb) → 스킨 id. 객체가 아니거나 모르는 값이면 기본 */
export function skinFromAvatarConfig(config: unknown): SkinId {
  const skin =
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>).skin
      : undefined;
  return isSkinId(skin) ? skin : DEFAULT_SKIN_ID;
}
