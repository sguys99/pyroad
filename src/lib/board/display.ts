/**
 * 게시판 작성자 표시 (P1-18, X1).
 *
 * user_profiles_public.display_name 은 00014 부터 "닉네임 → 없으면 모험가NNNN(user id 해시)"입니다.
 * 실명(users.display_name 의 Google 이름)·프로필 사진은 뷰로 나오지 않으므로 게시판은 이 값만 씁니다.
 * 닉네임 온보딩(P3-11)이 생기면 같은 값이 자동으로 닉네임이 됩니다.
 */
export const FALLBACK_AUTHOR_NAME = '모험가';

export function authorName(
  profile: { display_name: string | null } | null | undefined,
): string {
  return profile?.display_name?.trim() || FALLBACK_AUTHOR_NAME;
}
