import { describe, expect, it } from 'vitest';
import { avatarLook, publicLook } from '../look';
import { CAPE_COLORS } from '@/components/characters/rig/costumes';

describe('avatarLook·publicLook (P9-05)', () => {
  it('avatar_config 하나로 스킨·코스튬·펫·테두리', () => {
    expect(
      avatarLook({
        skin: 'sky',
        hat: 'hat_wizard',
        cape: 'cape_hero',
        pet: 'pet_chick',
        frame: 'frame_star',
        editor_theme: 'theme_night',
      }),
    ).toEqual({
      skin: 'sky',
      costume: { hat: 'wizard', cape: CAPE_COLORS.hero },
      pet: 'pet_chick',
      frame: 'star',
    });
  });

  it('모르는 값·슬롯이 틀린 값·객체가 아닌 값은 버림 (기본 파이뱀)', () => {
    const plain = { skin: 'green', costume: {}, pet: null, frame: null };
    expect(avatarLook(null)).toEqual(plain);
    expect(avatarLook(['hat_party'])).toEqual(plain);
    expect(
      avatarLook({ hat: 'glasses_round', frame: 'hat_party', pet: 'nope' }),
    ).toEqual(plain);
  });

  it('게시판 작성자: avatar_skin + avatar_look, avatar_look 이 없어도(이전 응답) 스킨만', () => {
    expect(
      publicLook({
        avatar_skin: 'berry',
        avatar_look: { hat: 'hat_crown', frame: 'frame_wave' },
      }),
    ).toMatchObject({
      skin: 'berry',
      costume: { hat: 'crown' },
      frame: 'wave',
    });
    expect(publicLook({ avatar_skin: 'violet' })).toMatchObject({
      skin: 'violet',
      costume: {},
      frame: null,
    });
    expect(publicLook(null).skin).toBe('green');
  });
});
