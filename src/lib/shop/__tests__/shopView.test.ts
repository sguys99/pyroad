import { describe, expect, it } from 'vitest';
import { getShopItem, type ShopItem } from '../catalog';
import type { ShopErrorCode, ShopStatus } from '../api';
import {
  SHOP_ERROR_TEXT,
  equipSlotOf,
  itemState,
  lookWith,
  ownedItems,
  shopErrorText,
  stateLabel,
  wearWords,
} from '../shopView';

// 상점 화면 규칙 (P9-02): 카드 상태·미리 입어 보기·아이용 오류 문구

const item = (id: string) => getShopItem(id) as ShopItem;
const status = (over: Partial<ShopStatus> = {}): ShopStatus => ({
  coins: 1000,
  golden_keys: 0,
  shields: 0,
  week_start: '2026-11-09',
  owned: [],
  bought_this_week: {},
  equipped: { skin: 'green' },
  ...over,
});

describe('itemState', () => {
  it('영구 아이템: 살 수 있음 → 가짐 → 장착 중', () => {
    expect(itemState(item('hat_wizard'), status())).toBe('buy');
    expect(
      itemState(item('hat_wizard'), status({ owned: ['hat_wizard'] })),
    ).toBe('owned');
    expect(
      itemState(
        item('hat_wizard'),
        status({ owned: ['hat_wizard'], equipped: { hat: 'hat_wizard' } }),
      ),
    ).toBe('equipped');
    // 펫·프레임·테마는 종류 이름이 슬롯
    expect(
      itemState(
        item('pet_fox'),
        status({ owned: ['pet_fox'], equipped: { pet: 'pet_fox' } }),
      ),
    ).toBe('equipped');
    expect(
      itemState(
        item('theme_ocean'),
        status({
          owned: ['theme_ocean'],
          equipped: { editor_theme: 'theme_ocean' },
        }),
      ),
    ).toBe('equipped');
  });

  it('소모품: 이번 주 한도 → 이번 주 샀음, 방패 2개면 가득 참, 황금키는 상한 없음 (B72)', () => {
    expect(itemState(item('golden_key'), status())).toBe('buy');
    expect(
      itemState(
        item('golden_key'),
        status({ bought_this_week: { golden_key: 1 } }),
      ),
    ).toBe('week_done');
    expect(itemState(item('golden_key'), status({ golden_keys: 5 }))).toBe(
      'buy',
    );
    expect(itemState(item('streak_shield'), status({ shields: 1 }))).toBe(
      'buy',
    );
    expect(itemState(item('streak_shield'), status({ shields: 2 }))).toBe(
      'full',
    );
    expect(stateLabel(item('streak_shield'), 'full')).toContain('방패가 2개');
  });
});

describe('lookWith (미리 입어 보기)', () => {
  it('지금 입은 것 위에 같은 슬롯만 덮어 입힘, 펫은 따로', () => {
    const equipped = { hat: 'hat_party', cape: 'cape_hero', pet: 'pet_chick' };
    const now = lookWith(equipped);
    expect(now.costume.hat).toBe('party');
    expect(now.pet).toBe('pet_chick');
    const tried = lookWith(equipped, item('hat_crown'));
    expect(tried.costume.hat).toBe('crown');
    expect(tried.costume.cape).toBe(now.costume.cape);
    expect(lookWith(equipped, item('pet_dragon')).pet).toBe('pet_dragon');
    expect(lookWith(equipped, item('frame_star')).frame).toBe('star');
    // 소모품은 모습이 그대로
    expect(lookWith(equipped, item('golden_key'))).toEqual(now);
  });

  it('모르는 id·다른 슬롯 값은 버림', () => {
    expect(lookWith({ hat: 'nope', glasses: 'hat_party' }).costume).toEqual({});
  });
});

describe('슬롯·옷장·말씨', () => {
  it('장착 슬롯: 코스튬은 자기 슬롯, 소모품은 없음', () => {
    expect(equipSlotOf(item('glasses_sun'))).toBe('glasses');
    expect(equipSlotOf(item('pet_turtle'))).toBe('pet');
    expect(equipSlotOf(item('frame_wave'))).toBe('frame');
    expect(equipSlotOf(item('streak_shield'))).toBeNull();
  });

  it('가진 것은 카탈로그 순서, 모르는 id는 버림', () => {
    expect(
      ownedItems(status({ owned: ['pet_fox', 'gone', 'hat_party'] })).map(
        (i) => i.id,
      ),
    ).toEqual(['hat_party', 'pet_fox']);
  });

  it('펫은 "데려가기", 코스튬은 "입기"', () => {
    expect(wearWords(item('pet_fox')).on).toBe('데려가기');
    expect(wearWords(item('hat_party')).off).toBe('벗기');
  });
});

describe('아이용 오류 문구', () => {
  it('API 오류 코드마다 문구가 있고, 모르는 코드는 일반 문구', () => {
    const codes: ShopErrorCode[] = [
      'not_enough_coins',
      'already_owned',
      'weekly_limit_reached',
      'shields_full',
      'item_not_found',
      'item_inactive',
      'not_owned',
      'wrong_slot',
      'invalid_arguments',
      'server_error',
      'network',
    ];
    expect(Object.keys(SHOP_ERROR_TEXT).sort()).toEqual([...codes].sort());
    for (const c of codes) expect(shopErrorText(c)).toBe(SHOP_ERROR_TEXT[c]);
    expect(shopErrorText('???')).toBe(SHOP_ERROR_TEXT.server_error);
    expect(shopErrorText(undefined)).toBe(SHOP_ERROR_TEXT.server_error);
  });
});
