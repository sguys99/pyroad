import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOTION_SETTINGS,
  MOTION_BUDGETS,
  lowerTier,
  motionBudget,
  normalizeMotionSettings,
  resolvePolicy,
  resolveReduced,
  stepDown,
} from '../tier';
import { motionSettingsSchema } from '../schema';

describe('단계표 (P0-16 §4.5 + 계획서 P2-15)', () => {
  it('lite: 마스코트 30fps 상한·파티클 30%·페이지 전환 유지, 앰비언트·패럴랙스·흐림 끔', () => {
    expect(MOTION_BUDGETS.lite).toMatchObject({
      mascot: 'live',
      mascotFps: 30,
      mascotSecondary: false,
      particles: 0.3,
      effectDuration: 0.7,
      pageTransition: 'fade',
      ambient: false,
      parallax: false,
      blur: false,
      bigShadow: false,
      idleLoops: true,
      bgm: true,
      sfx: true,
    });
  });

  it('minimal: 대기 루프·파티클 0, 전환만, BGM 끔·효과음 유지', () => {
    expect(MOTION_BUDGETS.minimal).toMatchObject({
      mascot: 'transitions',
      mascotFps: 0,
      idleLoops: false,
      blink: 'off',
      particles: 0,
      springs: false,
      pageTransition: 'none',
      bgm: false,
      sfx: true,
    });
  });

  it('full은 모두 켬', () => {
    const full = MOTION_BUDGETS.full;
    expect([full.ambient, full.parallax, full.blur, full.bigShadow]).toEqual([
      true,
      true,
      true,
      true,
    ]);
    expect(full.mascotFps).toBe(60);
  });
});

describe('reduced-motion 대체 (§12-Q26): 움직임 0, 느린 깜빡임만', () => {
  it.each(['full', 'lite'] as const)(
    '%s + reduced → 움직임 0, 파티클 0, 마스코트 정지 + 느린 깜빡임',
    (tier) => {
      const b = motionBudget(tier, true);
      expect(b).toMatchObject({
        particles: 0,
        effectDuration: 0,
        springs: false,
        mascot: 'still',
        mascotFps: 0,
        idleLoops: false,
        blink: 'slow',
        ambient: false,
        parallax: false,
        pageTransition: 'none',
        lottie: 'still',
      });
    },
  );

  it('blur·그림자·BGM은 움직임이 아니라 단계를 따른다', () => {
    expect(motionBudget('full', true)).toMatchObject({
      blur: true,
      bigShadow: true,
      bgm: true,
      sfx: true,
    });
    expect(motionBudget('minimal', true)).toMatchObject({
      blur: false,
      bgm: false,
      blink: 'off',
    });
  });

  it('reduced가 아니면 단계표 그대로', () => {
    expect(motionBudget('lite', false)).toBe(MOTION_BUDGETS.lite);
  });
});

describe('정책', () => {
  const measured = { tier: 'lite' as const, source: 'measured' as const };

  it('사용자 설정 > 감지, reduced는 별도 축', () => {
    expect(
      resolvePolicy({ tier: 'auto', reduced: 'system' }, measured, false),
    ).toEqual({ tier: 'lite', reduced: false, source: 'measured' });
    expect(
      resolvePolicy({ tier: 'full', reduced: 'system' }, measured, true),
    ).toEqual({ tier: 'full', reduced: true, source: 'user' });
    expect(
      resolvePolicy({ tier: 'auto', reduced: 'off' }, measured, true).reduced,
    ).toBe(false);
    expect(
      resolvePolicy({ tier: 'auto', reduced: 'on' }, measured, false).reduced,
    ).toBe(true);
  });

  it('resolveReduced', () => {
    expect(resolveReduced('system', true)).toBe(true);
    expect(resolveReduced('system', false)).toBe(false);
    expect(resolveReduced('on', false)).toBe(true);
    expect(resolveReduced('off', true)).toBe(false);
  });

  it('단계 비교', () => {
    expect(lowerTier('full', 'lite')).toBe('lite');
    expect(lowerTier('minimal', 'lite')).toBe('minimal');
    expect(stepDown('full')).toBe('lite');
    expect(stepDown('minimal')).toBe('minimal');
  });
});

describe('설정 값 검사', () => {
  it('normalizeMotionSettings: 저장된 값을 믿지 않고 모르는 값은 기본값', () => {
    expect(normalizeMotionSettings({ tier: 'lite', reduced: 'on' })).toEqual({
      tier: 'lite',
      reduced: 'on',
    });
    expect(normalizeMotionSettings({ tier: 'turbo', reduced: 3 })).toEqual(
      DEFAULT_MOTION_SETTINGS,
    );
    expect(normalizeMotionSettings(null)).toEqual(DEFAULT_MOTION_SETTINGS);
    expect(normalizeMotionSettings(['lite'])).toEqual(DEFAULT_MOTION_SETTINGS);
    expect(normalizeMotionSettings({ tier: 'minimal' })).toEqual({
      tier: 'minimal',
      reduced: 'system',
    });
  });

  it('motionSettingsSchema(서버 쓰기): 두 키만, 정해진 값만', () => {
    expect(
      motionSettingsSchema.safeParse({ tier: 'auto', reduced: 'system' })
        .success,
    ).toBe(true);
    for (const bad of [
      { tier: 'auto' },
      { tier: 'fast', reduced: 'system' },
      { tier: 'lite', reduced: 'yes' },
      { tier: 'lite', reduced: 'on', measured: 'minimal' },
      'lite',
      null,
    ]) {
      expect(motionSettingsSchema.safeParse(bad).success).toBe(false);
    }
  });
});
