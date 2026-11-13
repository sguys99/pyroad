import type { Costume } from '@/components/characters/rig/costumes';
import { PybaemStatic } from '@/components/characters/rig';
import { getSkin } from '@/lib/avatar/skins';
import { cn } from '@/lib/utils';
import { AvatarFrameRing } from './AvatarFrameRing';

/**
 * 사용자 아바타 (P3-13, §2.6·§12-Q34, 꾸민 모습 P9-05): 그 아이의 파이뱀 정지 그림. provider 프로필 사진은 쓰지 않는다.
 *
 * - 훅 없음('use client' 아님): 서버 컴포넌트(프로필)·클라이언트 컴포넌트(게시판 댓글) 어디서나. 내 아바타는 `MyAvatar`(MyLook.tsx)
 * - 장식(`aria-hidden`): 이름은 옆에 글자로 둔다
 * - 크기 32(게시판·HUD) · 48(월드맵 요약) · 96(프로필 머리), 상점 견본은 그 사이 아무 크기. 둥근 surface-2 칩 + idle 파이뱀
 * - `skin`·`costume`·`frame`은 `avatarLook`/`publicLook`(src/lib/avatar/look.ts)이 avatar_config·공개 프로필에서 만든 값
 * - 모자: 끝이 머리 위로 높아(마법사 −12) 칩에서 잘리므로, 모자를 쓰면 파이뱀을 조금 줄여 아래로 내린다 (모든 크기 같은 비율 →
 *   32px 에서도 모자 끝까지 칩 안). 테두리는 칩 가장자리에 겹쳐 그려 바깥 크기는 그대로(레이아웃이 밀리지 않음)
 */
export interface UserAvatarProps {
  skin?: string | null;
  costume?: Costume;
  /** 테두리 그림 키 (`sprout`·`star`·`wave`, 모르는 값은 테두리 없음) */
  frame?: string | null;
  size?: number;
  className?: string;
}

export function UserAvatar({
  skin,
  costume,
  frame,
  size = 48,
  className,
}: UserAvatarProps) {
  const s = getSkin(skin);
  const hat = Boolean(costume?.hat);
  return (
    <span
      aria-hidden
      data-testid="user-avatar"
      data-skin={s.id}
      data-hat={costume?.hat}
      data-frame={frame ?? undefined}
      className={cn('relative inline-grid shrink-0 rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <span className="inline-flex size-full items-center justify-center overflow-hidden rounded-full bg-surface-2">
        {/* 리그 avatar 틀(128)은 몸이 아래로 치우쳐 있어 칩 가운데로 4% 올림. 모자는 줄여서 내림(모자 끝 = 칩 안) */}
        <PybaemStatic
          state="idle"
          size={size}
          palette={s.palette}
          costume={costume}
          label=""
          filters={false}
          className={hat ? 'translate-y-[9%] scale-[0.8]' : '-translate-y-[4%]'}
        />
      </span>
      {frame && <AvatarFrameRing art={frame} />}
    </span>
  );
}
