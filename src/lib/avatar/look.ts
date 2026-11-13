/**
 * 꾸민 모습 (P9-05): `users.avatar_config` 하나 → 모든 화면이 그리는 값. 라이브(`PybaemRig`)·정지(`PybaemStatic`·`UserAvatar`)가 같이 쓴다.
 *
 * - 내 화면: `MyLookProvider`(로그인 레이아웃이 avatar_config 를 넘김, 상점이 장착하면 바로 갱신) → `useMyLook()`
 * - 다른 아이(게시판): 공개 프로필 `avatar_skin` + `avatar_look`(00042, 모자·안경·망토·배경·테두리 id만) → `publicLook()`
 * 모르는 값은 버린다(`costumeFromAvatarConfig`·`petFromAvatarConfig`·`getShopItem`)
 */
import type { Costume } from '@/components/characters/rig/costumes';
import type { PetId } from '@/lib/shop/catalog';
import { lookWith } from '@/lib/shop/shopView';
import { skinFromAvatarConfig, type SkinId } from './skins';

export interface AvatarLook {
  skin: SkinId;
  costume: Costume;
  /** 동행 펫 (지도·상점 거울만, 공개 아바타에는 없음) */
  pet: PetId | null;
  /** 아바타 테두리 그림 키 (`sprout`·`star`·`wave`) */
  frame: string | null;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function avatarLook(config: unknown): AvatarLook {
  const c = asObject(config);
  const { costume, pet, frame } = lookWith(c);
  return { skin: skinFromAvatarConfig(c), costume, pet, frame };
}

/** 게시판 작성자 (`user_profiles_public`의 avatar_skin·avatar_look). 이전 응답처럼 avatar_look 이 없어도 스킨만으로 */
export function publicLook(
  author:
    | { avatar_skin?: string | null; avatar_look?: unknown }
    | null
    | undefined,
): AvatarLook {
  return avatarLook({
    ...asObject(author?.avatar_look),
    skin: author?.avatar_skin,
  });
}
