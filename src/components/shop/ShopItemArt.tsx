import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import { PetArt } from '@/components/characters/pets';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { RewardIcon } from '@/components/ui/reward-icon';
import { costumeFromAvatarConfig, type ShopItem } from '@/lib/shop/catalog';
import { cn } from '@/lib/utils';

/**
 * 상점 아이템 그림 (P9-02, 썸네일 계획 P9-01): 코스튬 = 그 조각 하나만 입힌 정지 파이뱀 · 펫 = `PetArt` · 소모품 = `RewardIcon`
 * · 프레임 = 내 아바타 둘레 테두리 · 에디터 테마 = 코드 세 줄 공책 견본. 모두 장식(aria-hidden) — 이름은 옆 글자로.
 * 훅 없음: 서버·클라이언트 어디서나 (카탈로그 견본도 이것을 씀)
 */
export function ShopItemArt({
  item,
  size = 72,
  skin,
}: {
  item: ShopItem;
  size?: number;
  /** 프레임 견본 안 아바타 색 (P3-13 스킨 id) */
  skin?: string | null;
}) {
  switch (item.kind) {
    case 'costume':
      return (
        <PybaemStatic
          size={size}
          costume={costumeFromAvatarConfig({ [item.slot]: item.id })}
          filters={false}
          idPrefix={`shop-${item.id}-${size}`}
          label=""
        />
      );
    case 'pet':
      return <PetArt id={item.id} size={Math.round(size * 0.86)} />;
    case 'consumable':
      return (
        <RewardIcon
          kind={item.id === 'golden_key' ? 'key' : 'shield'}
          size={Math.round(size * 0.62)}
        />
      );
    case 'frame':
      return <FrameArt art={item.art} size={size} skin={skin} />;
    case 'editor_theme':
      return <ThemeArt art={item.art} size={size} />;
  }
}

/** 별 하나 (4갈래 반짝임) */
const SPARK = 'M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3Z';

/** 물결 고리 (극좌표 사인) */
function wavePath(r: number, amp: number, waves: number) {
  const pts = Array.from({ length: 97 }, (_, i) => {
    const t = (i / 96) * Math.PI * 2;
    const rr = r + Math.sin(t * waves) * amp;
    return `${(50 + Math.cos(t) * rr).toFixed(2)} ${(50 + Math.sin(t) * rr).toFixed(2)}`;
  });
  return `M${pts.join('L')}Z`;
}
const WAVE = wavePath(45, 2.4, 12);

/**
 * 프로필 프레임 견본: 아바타 둘레 고리 + 장식 (새싹 잎 · 별 · 물결).
 * shortcut: 실제 프레임 그림은 P9-05(UserAvatar 둘레)가 정함 — 그때 이 견본도 그 그림으로 바꿀 것
 */
export function FrameArt({
  art,
  size,
  skin,
}: {
  art: string;
  size: number;
  skin?: string | null;
}) {
  const inner = size >= 90 ? 96 : size >= 44 ? 48 : 32;
  return (
    <span
      className="shop-frame"
      data-art={art}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="shop-frame-face"
        style={{ transform: `scale(${(size * 0.78) / inner})` }}
      >
        <UserAvatar skin={skin} size={inner as 32 | 48 | 96} />
      </span>
      <svg viewBox="0 0 100 100" className="shop-frame-ring">
        {art === 'wave' ? (
          <path d={WAVE} className="shop-frame-line" />
        ) : (
          <circle cx="50" cy="50" r="45" className="shop-frame-line" />
        )}
        {art === 'sprout' &&
          [-60, 200, 120].map((deg) => (
            <g
              key={deg}
              transform={`rotate(${deg} 50 50) translate(50 5) rotate(-20)`}
            >
              <path d="M0 0 C-7 -3 -9 -10 -4 -14 C1 -10 2 -4 0 0Z" />
              <path d="M0 0 C6 -2 9 -7 6 -11 C1 -9 -1 -4 0 0Z" />
            </g>
          ))}
        {art === 'star' &&
          [-90, -18, 54, 126, 198].map((deg, i) => (
            <path
              key={deg}
              d={SPARK}
              transform={`rotate(${deg} 50 50) translate(95 50) scale(${i % 2 ? 0.9 : 1.25})`}
            />
          ))}
        {art === 'wave' &&
          [20, 160].map((deg) => (
            <circle
              key={deg}
              cx="50"
              cy="5"
              r="3.2"
              transform={`rotate(${deg} 50 50)`}
            />
          ))}
      </svg>
    </span>
  );
}

/**
 * 에디터 테마 견본: 작은 코드 공책 (줄 번호 칸 + 색 막대 세 줄).
 * shortcut: 색은 이름에 맞춘 토큰 틴트 견본 — P9-06이 테마 색을 정하면 그 정의에서 읽을 것
 */
export function ThemeArt({
  art,
  size,
  className,
}: {
  art: string;
  size: number;
  className?: string;
}) {
  return (
    <span
      className={cn('shop-theme', className)}
      data-art={art}
      style={{ width: size, height: Math.round(size * 0.78) }}
      aria-hidden
    >
      <span className="shop-theme-gutter" />
      <span className="shop-theme-lines">
        <span data-i="0" />
        <span data-i="1" />
        <span data-i="2" />
      </span>
    </span>
  );
}
