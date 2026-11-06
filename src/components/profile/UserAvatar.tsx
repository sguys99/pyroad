import { PybaemStatic } from '@/components/characters/rig';
import { getSkin } from '@/lib/avatar/skins';
import { cn } from '@/lib/utils';

/**
 * 사용자 아바타 (P3-13, §2.6·§12-Q34): 그 아이가 고른 색의 파이뱀 정지 그림. provider 프로필 사진은 쓰지 않는다.
 *
 * - 훅 없음('use client' 아님): 서버 컴포넌트(프로필)·클라이언트 컴포넌트(게시판 댓글) 어디서나
 * - 장식(`aria-hidden`): 이름은 옆에 글자로 둔다. 스킨 이름을 읽어 줄 필요가 있으면 호출부가 글자로
 * - 크기 32(게시판·HUD) · 48(월드맵 요약) · 96(프로필 머리). 둥근 surface-2 칩 + idle 파이뱀(칩과 같은 크기)
 * - `skin`은 공개 프로필의 `avatar_skin`(NULL·모르는 값 = 기본 숲초록)
 */
export type UserAvatarSize = 32 | 48 | 96;

export interface UserAvatarProps {
  skin?: string | null;
  size?: UserAvatarSize;
  className?: string;
}

export function UserAvatar({ skin, size = 48, className }: UserAvatarProps) {
  const s = getSkin(skin);
  return (
    <span
      aria-hidden
      data-testid="user-avatar"
      data-skin={s.id}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* 리그 avatar 틀(128)은 몸이 아래로 치우쳐 있어 칩 가운데로 4% 올림 (원 밖으로 잘리는 부위 없음) */}
      <PybaemStatic
        state="idle"
        size={size}
        palette={s.palette}
        label=""
        filters={false}
        className="-translate-y-[4%]"
      />
    </span>
  );
}
