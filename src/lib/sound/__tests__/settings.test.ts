import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOUND_SETTINGS,
  effectiveGain,
  mergeSettings,
  normalizeSettings,
  pickNewerSettings,
} from '../settings';
import { soundSettingsSchema } from '../schema';

describe('사운드 설정', () => {
  it('기본값: 효과음 켜짐·BGM 꺼짐 (§12-Q8), 00012 DB 기본값과 같은 모양', () => {
    expect(DEFAULT_SOUND_SETTINGS).toEqual({
      version: 1,
      muted: false,
      master: 0.8,
      sfx: { enabled: true, volume: 0.7 },
      bgm: { enabled: false, volume: 0.4 },
      voice: { enabled: true, volume: 0.9 },
      updatedAt: 0,
    });
    expect(soundSettingsSchema.safeParse(DEFAULT_SOUND_SETTINGS).success).toBe(
      true,
    );
  });

  it('믿을 수 없는 값은 고친다: 범위 밖은 자르고 모르는 값은 기본값', () => {
    expect(
      normalizeSettings({
        muted: 'yes',
        master: 3,
        sfx: { enabled: false, volume: -1 },
        bgm: null,
        updatedAt: -5,
        extra: 1,
      }),
    ).toEqual({
      ...DEFAULT_SOUND_SETTINGS,
      master: 1,
      sfx: { enabled: false, volume: 0 },
    });
    expect(normalizeSettings([1, 2])).toEqual(DEFAULT_SOUND_SETTINGS);
  });

  it('merge: 바꾼 키만, updatedAt은 늘기만 함 (같은 밀리초에 두 번 바꿔도 순서 유지)', () => {
    const a = mergeSettings(DEFAULT_SOUND_SETTINGS, { muted: true }, 1000);
    const b = mergeSettings(a, { bgm: { enabled: true } }, 1000);
    expect(a.updatedAt).toBe(1000);
    expect(b.updatedAt).toBe(1001);
    expect(b).toMatchObject({
      muted: true,
      bgm: { enabled: true, volume: 0.4 },
    });
  });

  it('pickNewer: 서버·기기 중 updatedAt이 늦은 쪽 (같으면 서버)', () => {
    const local = { ...DEFAULT_SOUND_SETTINGS, muted: true, updatedAt: 10 };
    expect(
      pickNewerSettings(local, { ...DEFAULT_SOUND_SETTINGS, updatedAt: 9 }),
    ).toBe(local);
    expect(
      pickNewerSettings(local, { ...DEFAULT_SOUND_SETTINGS, updatedAt: 10 })
        .muted,
    ).toBe(false);
    expect(pickNewerSettings(null, null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(pickNewerSettings(local, null)).toBe(local);
  });

  it('실효 gain: 마스터 × 카테고리, 음소거·꺼짐이면 0', () => {
    expect(effectiveGain(DEFAULT_SOUND_SETTINGS, 'sfx')).toBeCloseTo(0.56);
    expect(effectiveGain(DEFAULT_SOUND_SETTINGS, 'bgm')).toBe(0);
    expect(
      effectiveGain({ ...DEFAULT_SOUND_SETTINGS, muted: true }, 'sfx'),
    ).toBe(0);
  });
});
