/**
 * 내 화면(월드맵·프로필)의 이름·아바타 (P3-13).
 *
 * `users.display_name`(옛 가입 트리거가 복사한 provider 실명, ③ 00022에서 "모험가NNNN"으로 정리)과
 * `users.avatar_url`(provider 프로필 사진)은 읽지 않는다. 다른 아이에게 보이는 값과 같은 공개 프로필
 * (`user_public_profiles`: 닉네임 → 없으면 "모험가NNNN", 파이뱀 스킨, ① 00018·00021)을 본인 화면에도 쓴다
 * → 내 화면과 게시판에 보이는 내 모습이 늘 같다 (§2.6 공개 정보 = 닉네임 + 캐릭터 아바타).
 */
import { authorName } from '@/lib/board/display';
import { getSkin, type SkinId } from './skins';

/** `supabase.from('users').select(OWN_PROFILE_SELECT).eq('id', user.id).single()` (회귀 APP-4가 같은 쿼리) */
export const OWN_PROFILE_SELECT =
  'id, total_xp, current_level, coins, user_public_profiles(public_name, avatar_skin)' as const;

export interface PublicProfileRow {
  public_name: string | null;
  avatar_skin: string | null;
}

export interface OwnProfileRow {
  id: string;
  total_xp: number;
  current_level: number;
  /** 코인 잔액 (P8-03 users.coins) */
  coins: number;
  /** 1:1 임베딩이라 객체지만, 관계 추론이 바뀌어도 깨지지 않게 배열도 받음 */
  user_public_profiles: PublicProfileRow | PublicProfileRow[] | null;
}

export interface OwnProfile {
  id: string;
  total_xp: number;
  current_level: number;
  /** 코인 잔액 (월드맵 HUD, P8-04) */
  coins: number;
  /** 보이는 이름: 닉네임, 없으면 "모험가NNNN" (공개 프로필 행이 없으면 "모험가") */
  name: string;
  skin: SkinId;
}

export function toOwnProfile(row: OwnProfileRow): OwnProfile {
  const pub = Array.isArray(row.user_public_profiles)
    ? row.user_public_profiles[0]
    : row.user_public_profiles;
  return {
    id: row.id,
    total_xp: row.total_xp,
    current_level: row.current_level,
    coins: row.coins,
    name: authorName({ display_name: pub?.public_name ?? null }),
    skin: getSkin(pub?.avatar_skin).id,
  };
}
