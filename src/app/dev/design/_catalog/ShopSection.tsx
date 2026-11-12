'use client';

import { useMemo } from 'react';
import { MotionProvider } from '@/components/providers/MotionProvider';
import { RewardIcon } from '@/components/ui/reward-icon';
import { ShopItemArt } from '@/components/shop/ShopItemArt';
import { ShopScreen, type ShopApi } from '@/components/shop/ShopScreen';
import { PurchaseCard } from '@/components/quest/celebrations/PurchaseCard';
import { CtaAutoFocus } from '@/components/quest/celebrations/parts';
import '@/components/quest/celebrations/celebration.css';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  RARITY_LABEL,
  SHOP_ITEMS,
  getShopItem,
  weeklyLimitOf,
  type ShopKind,
} from '@/lib/shop/catalog';
import type { ShopStatus } from '@/lib/shop/api';
import { equipSlotOf, lookWith } from '@/lib/shop/shopView';
import { Demo, Section } from './ui';

const GROUPS: { kind: ShopKind; label: string; note: string }[] = [
  {
    kind: 'costume',
    label: '코스튬 (150~900)',
    note: '썸네일 = 그 조각 하나만 입힌 정지 파이뱀(PybaemStatic). 조각을 더 그리면 P9-04가 새 마이그레이션으로 추가',
  },
  {
    kind: 'pet',
    label: '동행 펫 (900~1,500)',
    note: '썸네일·지도 모두 PetArt 같은 그림. 지도에서는 PetSlot 이 살짝 통통 뜀',
  },
  {
    kind: 'frame',
    label: '프로필 프레임 (300)',
    note: '썸네일 = 그 프레임을 두른 내 아바타(고리 + 새싹·별·물결, P9-02 견본). 실제 그림은 P9-05 (UserAvatar 둘레)',
  },
  {
    kind: 'editor_theme',
    label: '에디터 테마 (450)',
    note: '썸네일 = 코드 세 줄 공책 견본(이름에 맞춘 토큰 틴트, P9-02). 실제 색은 P9-06 (대비 AA)',
  },
  {
    kind: 'consumable',
    label: '소모품 (주 1개)',
    note: '한 주 = KST 월요일 0시부터. 썸네일 = 보상 아이콘',
  },
];

export function ShopSection() {
  return (
    <Section
      id="shop"
      kicker="P9-01"
      title="상점 아이템 카탈로그"
      description="src/lib/shop/catalog.ts 가 원본이고 DB shop_items(00039)는 구매 RPC가 가격을 읽는 사본(드리프트 테스트). 가격은 §12-Q65 확정가, 근거는 docs/balance.md “상점 가격표”. 화면(상점 UI)은 P9-02."
    >
      {GROUPS.map((g) => (
        <Demo
          key={g.kind}
          label={g.label}
          note={g.note}
          data-testid={`shop-catalog-${g.kind}`}
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SHOP_ITEMS.filter((i) => i.kind === g.kind).map((item) => {
              const limit = weeklyLimitOf(item);
              return (
                <li
                  key={item.id}
                  className="flex flex-col items-center gap-1.5 rounded-xl bg-card p-3 text-center shadow-card"
                  data-item={item.id}
                >
                  <div className="flex size-18 items-center justify-center">
                    <ShopItemArt item={item} size={72} />
                  </div>
                  <p className="font-display text-body">{item.name}</p>
                  <p className="flex items-center gap-1 text-small font-semibold tabular-nums">
                    <RewardIcon kind="coin" size={18} />
                    {item.price.toLocaleString('ko-KR')}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {RARITY_LABEL[item.rarity]}
                    {limit !== null && ` · 한 주에 ${limit}개`}
                  </p>
                </li>
              );
            })}
          </ul>
        </Demo>
      ))}
    </Section>
  );
}

/** 가짜 서버: 가격·가짐·주 한도만 흉내 (규칙 원본은 00040, 화면 확인용) */
function fakeShop(start: ShopStatus, failStatus = false): ShopApi {
  let s = start;
  const wait = () => new Promise((r) => setTimeout(r, 350));
  const fail = (code: 'not_enough_coins' | 'already_owned' | 'weekly_limit_reached' | 'server_error') => ({
    ok: false as const,
    status: 409,
    error: { code, error: code },
  });
  return {
    status: async () => {
      await wait();
      return failStatus ? fail('server_error') : { ok: true, data: s };
    },
    purchase: async (id) => {
      await wait();
      const item = getShopItem(id)!;
      if (s.coins < item.price) return fail('not_enough_coins');
      if (s.owned.includes(id)) return fail('already_owned');
      const week = s.bought_this_week[id] ?? 0;
      if (item.kind === 'consumable' && week >= item.weeklyLimit)
        return fail('weekly_limit_reached');
      const consumable = item.kind === 'consumable';
      s = {
        ...s,
        coins: s.coins - item.price,
        golden_keys: s.golden_keys + (id === 'golden_key' ? 1 : 0),
        shields: s.shields + (id === 'streak_shield' ? 1 : 0),
        owned: consumable ? s.owned : [...s.owned, id],
        bought_this_week: consumable
          ? { ...s.bought_this_week, [id]: week + 1 }
          : s.bought_this_week,
      };
      return {
        ok: true,
        data: {
          item_id: id,
          kind: item.kind,
          price: item.price,
          coins_balance: s.coins,
          golden_keys: s.golden_keys,
          shields: s.shields,
          bought_this_week: consumable ? week + 1 : 0,
        },
      };
    },
    equip: async (slot, itemId) => {
      await wait();
      const equipped = { ...s.equipped };
      if (itemId) equipped[slot] = itemId;
      else delete equipped[slot];
      s = { ...s, equipped };
      return { ok: true, data: { slot, item_id: itemId, equipped } };
    },
  };
}

const RICH: ShopStatus = {
  coins: 1240,
  golden_keys: 1,
  shields: 1,
  week_start: '2026-11-09',
  owned: ['hat_party', 'glasses_round', 'pet_chick'],
  bought_this_week: { streak_shield: 1 },
  equipped: { skin: 'green', hat: 'hat_party', pet: 'pet_chick' },
};
const POOR: ShopStatus = {
  ...RICH,
  coins: 80,
  owned: [],
  bought_this_week: {},
  equipped: { skin: 'pink' },
};

/** 구매 축하 카드 견본 (끝 모습). 실제 연출은 위 상점 화면에서 사 보면 축하 시퀀서로 뜸 */
function PurchaseSample({ itemId }: { itemId: string }) {
  const { budget } = useMotionTier();
  const item = getShopItem(itemId)!;
  const wearable = item.kind === 'costume' || item.kind === 'pet';
  return (
    <div
      className="rounded-2xl bg-scrim px-3 py-6"
      data-testid={`catalog-purchase-${itemId}`}
    >
      <CtaAutoFocus.Provider value={false}>
        <div className="cel-card" data-kind="purchase" data-settled>
          <PurchaseCard
            event={{
              type: 'purchase',
              itemId,
              price: item.price,
              coinsLeft: 1600 - item.price,
              look: wearable
                ? {
                    ...lookWith({ hat: 'hat_party' }, item),
                    skin: 'green',
                  }
                : undefined,
            }}
            budget={budget}
            settled
            onNext={() => {}}
          />
        </div>
      </CtaAutoFocus.Provider>
    </div>
  );
}

export function ShopScreenSection() {
  const rich = useMemo(() => fakeShop(RICH), []);
  const poor = useMemo(() => fakeShop(POOR), []);
  const broken = useMemo(() => fakeShop(RICH, true), []);
  return (
    <MotionProvider>
      <Section
        id="shop-screen"
        kicker="P9-02"
        title="상점 화면"
        description="/shop. 줄무늬 차양 간판 + 거울 무대(지금 입은 모습, 입으면 기뻐 뜀) · 상점|내 옷장 탭 · 종류 탭 · 희귀도 진열 칸(보통 회색·희귀 하늘빛·전설 금색 + full 빛 줄기). 칸을 누르면 시트에서 지금 입은 것 위에 덮어 미리 입어 보기(펫은 옆에) → 사기 → 구매 확인(가격·지금·남는 코인) → 축하 시퀀서 구매 카드 → 바로 입기. 코인 부족은 모자란 만큼과 모으는 방법, 서버 거절은 이유 코드별 아이용 문구. 아래 화면은 가짜 서버라 마음껏 사 봐도 돼요."
      >
        <Demo
          label="상점 화면 (코인 1,240 · 파티 고깔·삐약이 장착 · 방패는 이번 주 샀음)"
          note={`장착은 ${equipSlotOf(getShopItem('hat_party')!)} 슬롯처럼 종류별 한 칸. 진짜 화면은 월드맵 HUD 상점 칩·코인 칩·메뉴 시트에서 들어와요`}
          data-testid="catalog-shop-screen"
        >
          <ShopScreen initial={RICH} api={rich} embedded />
        </Demo>
          <Demo
            label="코인이 모자란 아이 (80코인, 빈 옷장)"
            note="칸 가격이 흐리게, 시트는 사기 대신 “코인이 N개 모자라요” + 모으는 방법"
            data-testid="catalog-shop-poor"
          >
            <ShopScreen initial={POOR} api={poor} embedded />
          </Demo>
          <Demo
            label="못 읽었을 때 (오류 상태)"
            note="“다시 열기”는 /api/shop 을 다시 부름 (이 견본은 계속 실패)"
            data-testid="catalog-shop-error"
          >
            <ShopScreen initial={null} api={broken} embedded />
          </Demo>
        <Demo
          label="구매 축하 카드 (끝 모습): 코스튬 · 전설 펫 · 소모품"
          note="금빛 빛살(희귀도 색) → 산 물건을 입은 파이뱀 기쁨 점프(펫은 옆에) · 컨페티 badge · 효과음 chest. 입을 수 있으면 “바로 입기”(상점 화면이 줄 때만), 소모품은 “좋아요!”"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <PurchaseSample itemId="hat_wizard" />
            <PurchaseSample itemId="pet_dragon" />
            <PurchaseSample itemId="golden_key" />
          </div>
        </Demo>
      </Section>
    </MotionProvider>
  );
}
