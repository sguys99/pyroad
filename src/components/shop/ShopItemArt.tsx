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

/**
 * 프로필 프레임 견본 = 그 테두리를 두른 내 아바타 (P9-05 `AvatarFrameRing` 원본 그대로, HUD·프로필·게시판과 같은 그림).
 * 장식이 칩 밖으로 조금 나오므로 칸의 80% 크기로
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
  return (
    <span
      className="shop-frame"
      data-art={art}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <UserAvatar skin={skin} frame={art} size={Math.round(size * 0.8)} />
    </span>
  );
}

/** 견본 코드 세 줄 (토큰 종류, 폭 %): `for i in range(3):` / `    print("안녕")` / `# 세 번 인사` */
const THEME_SAMPLE: [string, number][][] = [
  [
    ['keyword', 14],
    ['text', 6],
    ['keyword', 10],
    ['func', 22],
    ['number', 7],
  ],
  [
    ['indent', 10],
    ['func', 22],
    ['string', 34],
  ],
  [['comment', 52]],
];

/**
 * 에디터 테마 견본 (P9-06): 줄 번호 칸 + 코드 세 줄을 그 테마의 실제 색으로 (키워드·이름·함수·숫자·문자열·주석, 둘째 줄은
 * 커서가 있는 활성 줄). `data-editor-theme`이 퀘스트 에디터와 같은 토큰 블록(globals.css, 원본 tokens.ts `EDITOR_THEMES`)을 건다
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
      data-editor-theme={art}
      style={{
        width: size,
        height: Math.round(size * 0.78),
        ['--u' as string]: `${size / 100}px`,
      }}
      aria-hidden
    >
      <span className="shop-theme-gutter">
        {THEME_SAMPLE.map((_, i) => (
          <span key={i} data-active={i === 1 || undefined} />
        ))}
      </span>
      <span className="shop-theme-lines">
        {THEME_SAMPLE.map((line, i) => (
          <span key={i} data-active={i === 1 || undefined}>
            {line.map(([t, w], j) => (
              <span key={j} data-t={t} style={{ width: `${w}%` }} />
            ))}
          </span>
        ))}
      </span>
    </span>
  );
}
