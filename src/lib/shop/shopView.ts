/**
 * 상점 화면 규칙 (P9-02): 카드 상태·장착 슬롯·미리 입어 보기·아이용 오류 문구. 판단은 모두 서버(00040)가 다시 하므로 여기는 보여 주기만
 */
import type { Costume } from '@/components/characters/rig/costumes';
import {
  SHOP_ITEMS,
  costumeFromAvatarConfig,
  getShopItem,
  petFromAvatarConfig,
  type PetId,
  type ShopItem,
  type ShopKind,
} from './catalog';
import type { EquipSlot, ShopErrorCode, ShopStatus } from './api';

/** 스트릭 방패 최대 (00035) · 황금키 최대 (스테이지를 깨면 3개로 채워짐, 00040 `golden_keys_full`) */
export const MAX_SHIELDS = 2;
export const MAX_GOLDEN_KEYS = 3;

export const KIND_LABEL: Record<ShopKind, string> = {
  costume: '코스튬',
  pet: '펫',
  frame: '프레임',
  editor_theme: '공책',
  consumable: '소모품',
};
/** 탭 순서 */
export const KIND_ORDER: readonly ShopKind[] = [
  'costume',
  'pet',
  'frame',
  'editor_theme',
  'consumable',
];

/**
 * 카드 상태: 살 수 있음 · 가짐 · 입는 중 · 이번 주 샀음(소모품 한도) · 가득 참(방패 2·황금키 3)
 */
export type ItemState = 'buy' | 'owned' | 'equipped' | 'week_done' | 'full';

/** 장착 슬롯 (소모품은 없음) */
export function equipSlotOf(item: ShopItem): EquipSlot | null {
  switch (item.kind) {
    case 'costume':
      return item.slot;
    case 'consumable':
      return null;
    default:
      return item.kind;
  }
}

export function itemState(item: ShopItem, s: ShopStatus): ItemState {
  if (item.kind === 'consumable') {
    if ((s.bought_this_week[item.id] ?? 0) >= item.weeklyLimit)
      return 'week_done';
    const full =
      item.id === 'streak_shield'
        ? s.shields >= MAX_SHIELDS
        : s.golden_keys >= MAX_GOLDEN_KEYS;
    return full ? 'full' : 'buy';
  }
  const slot = equipSlotOf(item);
  if (slot && s.equipped[slot] === item.id) return 'equipped';
  return s.owned.includes(item.id) ? 'owned' : 'buy';
}

/** 가진 영구 아이템 (카탈로그 순서, 모르는 id는 버림) */
export function ownedItems(s: ShopStatus): ShopItem[] {
  const owned = new Set(s.owned);
  return SHOP_ITEMS.filter((i) => owned.has(i.id));
}

export interface Look {
  costume: Costume;
  pet: PetId | null;
  frame: string | null;
  theme: string | null;
}

/** 지금 입은 모습 위에 `item`을 덮어 입힌 모습 (미리 입어 보기). 소모품·없음이면 지금 모습 그대로 */
export function lookWith(equipped: ShopStatus['equipped'], item?: ShopItem) {
  const config: Record<string, unknown> = { ...equipped };
  const slot = item && equipSlotOf(item);
  if (item && slot) config[slot] = item.id;
  const art = (key: string) => {
    const found = getShopItem(config[key]);
    return found && 'art' in found ? found.art : null;
  };
  return {
    costume: costumeFromAvatarConfig(config),
    pet: petFromAvatarConfig(config),
    frame: art('frame'),
    theme: art('editor_theme'),
  } satisfies Look;
}

/** 아이용 오류 문구 (서버 문구 대신 화면에서 정함 — 다음에 무엇을 하면 되는지까지) */
export const SHOP_ERROR_TEXT: Record<ShopErrorCode, string> = {
  not_enough_coins: '코인이 조금 모자라요. 퀘스트를 풀면 코인이 모여요!',
  already_owned: '벌써 가지고 있는 물건이에요! 내 옷장에서 입어 볼 수 있어요.',
  weekly_limit_reached: '이번 주에는 벌써 샀어요. 월요일에 다시 살 수 있어요.',
  shields_full:
    '방패는 2개까지만 가질 수 있어요. 하나를 쓰고 나면 또 살 수 있어요.',
  golden_keys_full:
    '황금키가 벌써 3개 있어요. 하나를 쓰고 나면 또 살 수 있어요.',
  item_inactive: '이 물건은 지금 팔지 않아요. 다른 물건을 둘러볼까요?',
  item_not_found: '상점에서 이 물건을 찾지 못했어요. 화면을 새로 열어 볼까요?',
  not_owned: '아직 가지고 있지 않은 물건이에요. 먼저 사야 입을 수 있어요.',
  wrong_slot: '그 자리에는 입힐 수 없는 물건이에요.',
  invalid_arguments: '앗, 무언가 잘못 눌렸어요. 다시 해 볼까요?',
  server_error: '앗, 잠깐 문제가 생겼어요. 잠시 후 다시 해 볼까요?',
  network: '인터넷 연결을 확인하고 다시 해 볼까요?',
};

export function shopErrorText(code: string | undefined): string {
  return SHOP_ERROR_TEXT[code as ShopErrorCode] ?? SHOP_ERROR_TEXT.server_error;
}

/** 장착 말씨 (종류마다 아이에게 자연스러운 동사) */
export interface WearWords {
  on: string;
  off: string;
  now: string;
  later: string;
}
const WEAR: Record<Exclude<ShopKind, 'consumable'>, WearWords> = {
  costume: {
    on: '입기',
    off: '벗기',
    now: '입는 중',
    later: '나중에 입을래요',
  },
  pet: {
    on: '데려가기',
    off: '집에 두기',
    now: '함께 다녀요',
    later: '나중에 데려갈래요',
  },
  frame: {
    on: '두르기',
    off: '빼기',
    now: '두르는 중',
    later: '나중에 두를래요',
  },
  editor_theme: {
    on: '쓰기',
    off: '그만 쓰기',
    now: '쓰는 중',
    later: '나중에 쓸래요',
  },
};
export function wearWords(item: ShopItem): WearWords {
  return item.kind === 'consumable' ? WEAR.costume : WEAR[item.kind];
}

/** 카드·시트 상태 글자 */
export function stateLabel(item: ShopItem, state: ItemState): string {
  switch (state) {
    case 'equipped':
      return wearWords(item).now;
    case 'owned':
      return '가지고 있어요';
    case 'week_done':
      return '이번 주에 샀어요';
    case 'full':
      return item.id === 'streak_shield'
        ? `방패가 ${MAX_SHIELDS}개로 가득 찼어요`
        : `황금키가 ${MAX_GOLDEN_KEYS}개로 가득 찼어요`;
    case 'buy':
      return `${item.price.toLocaleString('ko-KR')}코인`;
  }
}
