import { Frame, Palette } from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import { PetArt } from '@/components/characters/pets';
import { RewardIcon } from '@/components/ui/reward-icon';
import {
  RARITY_LABEL,
  SHOP_ITEMS,
  costumeFromAvatarConfig,
  weeklyLimitOf,
  type ShopItem,
  type ShopKind,
} from '@/lib/shop/catalog';
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
    note: '그림은 P9-05 (UserAvatar 둘레). 썸네일 = 그 프레임을 두른 내 아바타',
  },
  {
    kind: 'editor_theme',
    label: '에디터 테마 (450)',
    note: '색은 P9-06 (토큰 틴트, 대비 AA). 썸네일 = 코드 세 줄 견본',
  },
  {
    kind: 'consumable',
    label: '소모품 (주 1개)',
    note: '한 주 = KST 월요일 0시부터. 썸네일 = 보상 아이콘',
  },
];

function Thumb({ item }: { item: ShopItem }) {
  switch (item.kind) {
    case 'costume':
      return (
        <PybaemStatic
          size={72}
          costume={costumeFromAvatarConfig({ [item.slot]: item.id })}
          filters={false}
          idPrefix={`shop-${item.id}`}
          label=""
        />
      );
    case 'pet':
      return <PetArt id={item.id} size={64} />;
    case 'consumable':
      return (
        <RewardIcon
          kind={item.id === 'golden_key' ? 'key' : 'shield'}
          size={44}
        />
      );
    case 'frame':
      return <Frame aria-hidden className="size-9 text-muted-foreground" />;
    case 'editor_theme':
      return <Palette aria-hidden className="size-9 text-muted-foreground" />;
  }
}

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
                    <Thumb item={item} />
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
