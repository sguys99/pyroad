/**
 * 상점·인벤토리·장착 API 계약 + 브라우저용 얇은 fetch 헬퍼 (P9-03). 규칙은 모두 서버(00040 `purchase_item`·`equip_item`·`shop_status`)가 정하고
 * 여기는 반환 모양과 호출만 둔다. 클라이언트 쓰기 경로는 이 API 뿐(§2.3)
 *
 * - GET  /api/shop                       → `ShopStatus`
 * - POST /api/shop/purchase { itemId }   → `PurchaseResult` | `ShopError`
 * - POST /api/shop/equip { slot, itemId } → `EquipResult` | `ShopError` (itemId null = 벗기)
 *
 * 장착 원본: 외형(skin·hat·glasses·cape·bg·pet·frame)은 `users.avatar_config`, 에디터 테마는 `users.settings.editor_theme`
 * (`user_equipped` 테이블은 두지 않음 — 원본이 둘이면 어긋남). skin 은 무료 6색(P3-13), 나머지는 가진 아이템만
 */

/** 아이템·스킨 id 형식 (DB CHECK `shop_items_id_format` 과 같음). API 경계 검사용 */
export const ITEM_ID = /^[a-z][a-z0-9_]{1,39}$/;

export const EQUIP_SLOTS = [
  'skin',
  'hat',
  'glasses',
  'cape',
  'bg',
  'pet',
  'frame',
  'editor_theme',
] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

/** 슬롯별 장착 id (avatar_config 그대로 + editor_theme). 모르는 키가 있을 수 있어 그리기는 `costumeFromAvatarConfig` 등으로 */
export type Equipped = Partial<Record<EquipSlot, string | null>> &
  Record<string, unknown>;

export interface ShopStatus {
  coins: number;
  golden_keys: number;
  /** 가진 스트릭 방패 (0~2) */
  shields: number;
  /** 이번 주 월요일 (KST, YYYY-MM-DD). 소모품 한도는 이 날 0시에 다시 열림 */
  week_start: string;
  /** 가진 영구 아이템 id (산 순서) */
  owned: string[];
  /** 이번 주 소모품 구매 수 (`{ golden_key: 1 }`). 없으면 키 없음 */
  bought_this_week: Record<string, number>;
  equipped: Equipped;
}

export interface PurchaseResult {
  item_id: string;
  kind: 'costume' | 'frame' | 'editor_theme' | 'pet' | 'consumable';
  price: number;
  coins_balance: number;
  golden_keys: number;
  shields: number;
  /** 소모품이면 이번 주 몇 개째(1~), 영구 아이템은 0 */
  bought_this_week: number;
}

export interface EquipResult {
  slot: EquipSlot;
  item_id: string | null;
  equipped: Equipped;
}

/** 실패 이유 코드 (아이용 문구는 `error`에 같이 옴) */
export type ShopErrorCode =
  | 'not_enough_coins'
  | 'already_owned'
  | 'weekly_limit_reached'
  | 'shields_full'
  | 'golden_keys_full'
  | 'item_not_found'
  | 'item_inactive'
  | 'not_owned'
  | 'wrong_slot'
  | 'invalid_arguments'
  | 'server_error'
  | 'network';

export interface ShopError {
  error: string;
  code: ShopErrorCode;
}

export type ShopResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ShopError };

const NETWORK: ShopError = {
  error: '인터넷 연결을 확인하고 다시 해 볼까요?',
  code: 'network',
};

async function call<T>(
  url: string,
  init?: RequestInit,
): Promise<ShopResponse<T>> {
  try {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: body as T };
    return {
      ok: false,
      status: res.status,
      error: body?.code
        ? (body as ShopError)
        : {
            error: '앗, 잠깐 문제가 생겼어요. 잠시 후 다시 해 볼까요?',
            code: 'server_error',
          },
    };
  } catch {
    return { ok: false, status: 0, error: NETWORK };
  }
}

const post = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const fetchShopStatus = () =>
  call<ShopStatus>('/api/shop', { cache: 'no-store' });

export const purchaseItem = (itemId: string) =>
  call<PurchaseResult>('/api/shop/purchase', post({ itemId }));

export const equipItem = (slot: EquipSlot, itemId: string | null) =>
  call<EquipResult>('/api/shop/equip', post({ slot, itemId }));
