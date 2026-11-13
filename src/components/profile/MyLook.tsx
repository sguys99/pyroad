'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
} from 'react';
import { PybaemStatic } from '@/components/characters/rig/RigStatic';
import type { Costume } from '@/components/characters/rig/costumes';
import { avatarLook, type AvatarLook } from '@/lib/avatar/look';
import { getSkin, type SkinPalette } from '@/lib/avatar/skins';
import { UserAvatar, type UserAvatarProps } from './UserAvatar';

/**
 * 내 꾸민 모습 (P9-05). 로그인 레이아웃이 요청마다 읽은 `users.avatar_config`로 시작하고, 상점이 장착·벗기면 `setConfig`로 바로 바꾼다
 * (레이아웃은 클라이언트 이동에서 다시 렌더되지 않으므로 상점 → 지도로 돌아가도 새 모습이 보이게).
 * 공급자가 없으면(카탈로그·테스트) 기본 파이뱀
 */
interface MyLookValue {
  look: AvatarLook;
  setConfig: (config: unknown) => void;
}

const EMPTY = avatarLook(null);
const Ctx = createContext<MyLookValue>({ look: EMPTY, setConfig: () => {} });

export function MyLookProvider({
  config,
  children,
}: {
  config: unknown;
  children: React.ReactNode;
}) {
  const [state, setState] = useState({ from: config, value: config });
  // 서버가 새 값을 주면(새로 고침) 그 값으로 (렌더 중 상태 맞추기)
  if (state.from !== config) setState({ from: config, value: config });
  const setConfig = useCallback(
    (next: unknown) => setState((s) => ({ ...s, value: next })),
    [],
  );
  const value = useMemo<MyLookValue>(
    () => ({ look: avatarLook(state.value), setConfig }),
    [state.value, setConfig],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMyLook(): AvatarLook {
  return useContext(Ctx).look;
}

export function useSetMyLook(): (config: unknown) => void {
  return useContext(Ctx).setConfig;
}

/** 리그에 그대로 펼치는 값: `<PybaemRig {...useMyPybaem()} />` (학생의 파이뱀으로 그리는 곳만, rig.md §6¾) */
export function useMyPybaem(): { costume: Costume; palette: SkinPalette } {
  const { costume, skin } = useMyLook();
  return useMemo(
    () => ({ costume, palette: getSkin(skin).palette }),
    [costume, skin],
  );
}

/** 내 아바타 (HUD·프로필 등 서버 컴포넌트에서도 둘 수 있게) */
export function MyAvatar(
  props: Omit<UserAvatarProps, 'skin' | 'costume' | 'frame'>,
) {
  const { skin, costume, frame } = useMyLook();
  return <UserAvatar {...props} skin={skin} costume={costume} frame={frame} />;
}

/** 내 파이뱀 정지 그림 (지연 로드 리그의 `loading` 자리 등, 라이브와 같은 모습) */
export function MyPybaemStatic(props: ComponentProps<typeof PybaemStatic>) {
  return <PybaemStatic {...useMyPybaem()} {...props} />;
}
