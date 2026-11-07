import { describe, expect, it } from 'vitest';
import { OWN_PROFILE_SELECT, toOwnProfile } from '../ownProfile';

const base = { id: 'u1', total_xp: 120, current_level: 2 };

describe('내 화면 프로필 (P3-13)', () => {
  it('users 의 실명·사진 컬럼을 고르지 않는다', () => {
    expect(OWN_PROFILE_SELECT).not.toMatch(/display_name|avatar_url|nickname/);
    expect(OWN_PROFILE_SELECT).toMatch(
      /user_public_profiles\(public_name, avatar_skin\)/,
    );
  });

  it('공개 프로필의 이름·스킨을 쓴다', () => {
    expect(
      toOwnProfile({
        ...base,
        user_public_profiles: { public_name: '코딩왕', avatar_skin: 'sky' },
      }),
    ).toEqual({ ...base, name: '코딩왕', skin: 'sky' });
  });

  it('배열 임베딩·자리표시자 이름도 받는다', () => {
    expect(
      toOwnProfile({
        ...base,
        user_public_profiles: [
          { public_name: '모험가0448', avatar_skin: null },
        ],
      }),
    ).toMatchObject({ name: '모험가0448', skin: 'green' });
  });

  it('공개 프로필 행이 없거나 모르는 스킨이면 "모험가"·기본 스킨', () => {
    expect(toOwnProfile({ ...base, user_public_profiles: null })).toMatchObject(
      { name: '모험가', skin: 'green' },
    );
    expect(
      toOwnProfile({
        ...base,
        user_public_profiles: { public_name: '  ', avatar_skin: 'gold' },
      }),
    ).toMatchObject({ name: '모험가', skin: 'green' });
  });
});
