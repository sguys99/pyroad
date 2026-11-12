/**
 * 상점 아이템 카탈로그 + 가격표 (P9-01, §3 "코인 밸런스", §12-Q65 확정가, 근거 docs/balance.md "상점 가격표").
 *
 * 단일 진실 원천: **이 표**. DB `public.shop_items`(00039)는 구매 RPC(P9-03)가 가격·한도를 서버에서 읽으려고 둔 사본이고,
 * 단위 테스트(`__tests__/catalog.test.ts`)가 마이그레이션 INSERT 를 읽어 열마다 대조한다(드리프트 테스트).
 * 값을 바꾸면 새 마이그레이션에 같은 `INSERT … ON CONFLICT DO UPDATE` 를 쓰고(적용한 파일은 고치지 않음) 테스트가 마지막 값을 본다.
 * 한번 판 id 는 바꾸거나 지우지 않는다(인벤토리·`avatar_config` 에 저장됨) — 그만 팔 때는 새 마이그레이션에서 `is_active = false`.
 *
 * - 가격 범위(§12-Q65): 코스튬 150~900 · 프레임 300 · 에디터 테마 450 · 펫 900~1,500 · 황금키 240 · 방패 180 (DB CHECK 도 같은 범위)
 * - 주 구매 한도 `weeklyLimit`: 황금키·방패만 1. 주 = KST 월요일 00:00 ~ 일요일 24:00 (`kstWeekStart`, SQL `public.kst_week_start`)
 * - `art`: 그림 키. 코스튬은 리그 코스튬 슬롯의 종류(`Hat`·`Glasses`·`Backdrop` kind, 망토는 `CAPE_COLORS` 키),
 *   펫은 `PET_ART`(src/components/characters/pets.tsx), 프레임·테마는 P9-05·P9-06이 그 키로 그림
 * - 저장(P9-03·P9-05): `users.avatar_config` 에 슬롯마다 **아이템 id** (`{ skin, hat, glasses, cape, bg, pet }`) — 스킨(팔레트 재색칠)은
 *   P3-13 무료 6색 그대로라 상점 아이템이 아니다. `costumeFromAvatarConfig`·`petFromAvatarConfig` 가 모르는 값은 버린다
 */
import type {
  BackdropKind,
  CapeKind,
  Costume,
  GlassesKind,
  HatKind,
} from '@/components/characters/rig/costumes';
import { CAPE_COLORS } from '@/components/characters/rig/costumes';

export const SHOP_KINDS = [
  'costume',
  'frame',
  'editor_theme',
  'pet',
  'consumable',
] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];

/** 코스튬 슬롯 (리그 P0-07 §4.6: 모자 = 머리 그룹, 안경 = 얼굴 그룹, 망토 = 몸 뒤, 배경 = 리그 밖) */
export const COSTUME_SLOTS = ['hat', 'glasses', 'cape', 'bg'] as const;
export type CostumeSlot = (typeof COSTUME_SLOTS)[number];

export type ShopRarity = 'common' | 'rare' | 'epic';
export const RARITY_LABEL: Record<ShopRarity, string> = {
  common: '보통',
  rare: '희귀',
  epic: '전설',
};

interface ItemBase {
  /** `^[a-z][a-z0-9_]{1,39}$`, 종류 접두사(hat_·pet_ …) */
  id: string;
  name: string;
  /** 상점 설명 한 줄 (초등학생용 쉬운 말) */
  description: string;
  price: number;
  rarity: ShopRarity;
  /** 상점 정렬 (종류 안에서 오름차순) */
  sort: number;
}

export type CostumeItem = ItemBase & { kind: 'costume' } & (
    | { slot: 'hat'; art: HatKind }
    | { slot: 'glasses'; art: GlassesKind }
    | { slot: 'cape'; art: CapeKind }
    | { slot: 'bg'; art: BackdropKind }
  );
export type PetId = 'pet_chick' | 'pet_turtle' | 'pet_fox' | 'pet_dragon';
export type PetItem = ItemBase & { kind: 'pet'; id: PetId };
export type FrameItem = ItemBase & { kind: 'frame'; art: string };
export type EditorThemeItem = ItemBase & { kind: 'editor_theme'; art: string };
export type ConsumableItem = ItemBase & {
  kind: 'consumable';
  id: 'golden_key' | 'streak_shield';
  /** 한 주(KST 월요일 시작)에 살 수 있는 개수 */
  weeklyLimit: number;
};
export type ShopItem =
  | CostumeItem
  | PetItem
  | FrameItem
  | EditorThemeItem
  | ConsumableItem;

/** 가격 범위 (§12-Q65). DB CHECK `shop_items_price_range` 와 같다 */
export const PRICE_RANGE: Record<ShopKind, readonly [number, number]> = {
  costume: [150, 900],
  frame: [300, 300],
  editor_theme: [450, 450],
  pet: [900, 1500],
  consumable: [180, 240],
};

export const SHOP_ITEMS: readonly ShopItem[] = [
  // ── 코스튬 (리그에 이미 그림이 있는 10종, 새 조각은 P9-04에서 새 마이그레이션으로) ──
  {
    id: 'hat_party',
    kind: 'costume',
    slot: 'hat',
    art: 'party',
    name: '파티 고깔',
    description: '줄무늬 고깔모자를 쓰면 매일이 생일 같아요!',
    price: 150,
    rarity: 'common',
    sort: 10,
  },
  {
    id: 'glasses_round',
    kind: 'costume',
    slot: 'glasses',
    art: 'round',
    name: '동글 안경',
    description: '똑똑해 보이는 동그란 안경이에요.',
    price: 150,
    rarity: 'common',
    sort: 20,
  },
  {
    id: 'bg_paper',
    kind: 'costume',
    slot: 'bg',
    art: 'paper',
    name: '모험 공책 배경',
    description: '모험 공책 한 장 위에 파이뱀이 서요.',
    price: 150,
    rarity: 'common',
    sort: 30,
  },
  {
    id: 'hat_explorer',
    kind: 'costume',
    slot: 'hat',
    art: 'explorer',
    name: '탐험가 모자',
    description: '정글도 사막도 문제없는 챙 넓은 모자예요.',
    price: 300,
    rarity: 'common',
    sort: 40,
  },
  {
    id: 'glasses_sun',
    kind: 'costume',
    slot: 'glasses',
    art: 'sun',
    name: '멋쟁이 선글라스',
    description: '햇살이 쨍쨍해도 끄떡없어요.',
    price: 300,
    rarity: 'common',
    sort: 50,
  },
  {
    id: 'cape_hero',
    kind: 'costume',
    slot: 'cape',
    art: 'hero',
    name: '영웅 망토',
    description: '바람에 펄럭이는 빨간 망토예요.',
    price: 450,
    rarity: 'rare',
    sort: 60,
  },
  {
    id: 'hat_wizard',
    kind: 'costume',
    slot: 'hat',
    art: 'wizard',
    name: '마법사 모자',
    description: '별이 반짝이는 코딩 마법사 모자예요.',
    price: 600,
    rarity: 'rare',
    sort: 70,
  },
  {
    id: 'bg_island',
    kind: 'costume',
    slot: 'bg',
    art: 'island',
    name: '파이썬 섬 배경',
    description: '모험이 시작된 파이썬 섬을 뒤에 둬요.',
    price: 600,
    rarity: 'rare',
    sort: 80,
  },
  {
    id: 'cape_night',
    kind: 'costume',
    slot: 'cape',
    art: 'night',
    name: '밤하늘 망토',
    description: '별빛처럼 깊은 파란 망토예요.',
    price: 750,
    rarity: 'rare',
    sort: 90,
  },
  {
    id: 'hat_crown',
    kind: 'costume',
    slot: 'hat',
    art: 'crown',
    name: '황금 왕관',
    description: '코드 왕국의 주인만 쓸 수 있는 왕관이에요!',
    price: 900,
    rarity: 'epic',
    sort: 100,
  },
  // ── 프로필 프레임 (아바타 테두리, 그림은 P9-05) ──
  {
    id: 'frame_sprout',
    kind: 'frame',
    art: 'sprout',
    name: '새싹 테두리',
    description: '파릇파릇 새싹이 아바타를 감싸요.',
    price: 300,
    rarity: 'common',
    sort: 110,
  },
  {
    id: 'frame_star',
    kind: 'frame',
    art: 'star',
    name: '별빛 테두리',
    description: '작은 별들이 아바타 둘레에서 반짝여요.',
    price: 300,
    rarity: 'common',
    sort: 120,
  },
  {
    id: 'frame_wave',
    kind: 'frame',
    art: 'wave',
    name: '파도 테두리',
    description: '시원한 파도가 아바타를 둘러요.',
    price: 300,
    rarity: 'common',
    sort: 130,
  },
  // ── 에디터 테마 (코드 공책 색, 적용은 P9-06) ──
  {
    id: 'theme_night',
    kind: 'editor_theme',
    art: 'night',
    name: '밤하늘 공책',
    description: '어두운 밤하늘 색 공책에서 코드를 써요.',
    price: 450,
    rarity: 'common',
    sort: 210,
  },
  {
    id: 'theme_ocean',
    kind: 'editor_theme',
    art: 'ocean',
    name: '바다 공책',
    description: '맑은 바닷물 색 공책이에요.',
    price: 450,
    rarity: 'common',
    sort: 220,
  },
  {
    id: 'theme_candy',
    kind: 'editor_theme',
    art: 'candy',
    name: '솜사탕 공책',
    description: '달콤한 분홍빛 공책이에요.',
    price: 450,
    rarity: 'common',
    sort: 230,
  },
  // ── 동행 펫 (월드맵 PetSlot, 그림 PET_ART) ──
  {
    id: 'pet_chick',
    kind: 'pet',
    name: '삐약이',
    description: '노란 병아리가 지도 위를 졸졸 따라와요.',
    price: 900,
    rarity: 'rare',
    sort: 310,
  },
  {
    id: 'pet_turtle',
    kind: 'pet',
    name: '꼬북이',
    description: '느려도 끝까지 가는 아기 거북이에요.',
    price: 1100,
    rarity: 'rare',
    sort: 320,
  },
  {
    id: 'pet_fox',
    kind: 'pet',
    name: '여울이',
    description: '꼬리가 복슬복슬한 아기 여우예요.',
    price: 1300,
    rarity: 'rare',
    sort: 330,
  },
  {
    id: 'pet_dragon',
    kind: 'pet',
    name: '용용이',
    description: '작은 날개를 파닥이는 아기 용이에요!',
    price: 1500,
    rarity: 'epic',
    sort: 340,
  },
  // ── 소모품 (주 1개 구매 한도, §12-Q65) ──
  {
    id: 'streak_shield',
    kind: 'consumable',
    name: '스트릭 방패',
    description:
      '하루 쉬어도 불꽃이 꺼지지 않게 지켜 줘요. 한 주에 1개만 살 수 있어요.',
    price: 180,
    rarity: 'common',
    sort: 410,
    weeklyLimit: 1,
  },
  {
    id: 'golden_key',
    kind: 'consumable',
    name: '황금키',
    description: '꽉 막힌 퀘스트 하나를 열어 줘요. 한 주에 1개만 살 수 있어요.',
    price: 240,
    rarity: 'common',
    sort: 420,
    weeklyLimit: 1,
  },
];

const BY_ID = new Map<string, ShopItem>(SHOP_ITEMS.map((i) => [i.id, i]));

export function getShopItem(id: unknown): ShopItem | undefined {
  return typeof id === 'string' ? BY_ID.get(id) : undefined;
}

/** 주 구매 한도 (없으면 null = 한 번 사면 영구 소장) */
export function weeklyLimitOf(item: ShopItem): number | null {
  return item.kind === 'consumable' ? item.weeklyLimit : null;
}

export const PET_IDS = SHOP_ITEMS.filter(
  (i): i is PetItem => i.kind === 'pet',
).map((i) => i.id);

export function isPetId(value: unknown): value is PetId {
  return getShopItem(value)?.kind === 'pet';
}

function configField(config: unknown, key: string): unknown {
  return config && typeof config === 'object' && !Array.isArray(config)
    ? (config as Record<string, unknown>)[key]
    : undefined;
}

/** `users.avatar_config.pet` → 펫 id. 없거나 모르는 값이면 null (지도에 펫 없음) */
export function petFromAvatarConfig(config: unknown): PetId | null {
  const pet = configField(config, 'pet');
  return isPetId(pet) ? pet : null;
}

/** `users.avatar_config` 슬롯별 아이템 id → 리그 `costume` prop. 슬롯이 맞지 않거나 모르는 id는 버림 */
export function costumeFromAvatarConfig(config: unknown): Costume {
  const costume: Costume = {};
  for (const slot of COSTUME_SLOTS) {
    const item = getShopItem(configField(config, slot));
    if (item?.kind !== 'costume' || item.slot !== slot) continue;
    if (item.slot === 'hat') costume.hat = item.art;
    else if (item.slot === 'glasses') costume.glasses = item.art;
    else if (item.slot === 'cape') costume.cape = CAPE_COLORS[item.art];
    else costume.bg = item.art;
  }
  return costume;
}
