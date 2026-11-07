import { describe, expect, it } from 'vitest';
import { consentStatus, isRestricted } from '../status';

const NOW = Date.parse('2026-11-06T03:00:00Z');
const inDays = (d: number) => new Date(NOW + d * 86_400_000).toISOString();

describe('보호자 동의 상태 (P3-15)', () => {
  it('만 14세 이상 · 동의 마침 → 제한 없음', () => {
    expect(
      consentStatus(
        {
          age_band: '14plus',
          guardian_consented_at: null,
          consent_deadline: null,
        },
        NOW,
      ),
    ).toEqual({ state: 'ok' });
    expect(
      consentStatus(
        {
          age_band: 'under14',
          guardian_consented_at: inDays(-1),
          consent_deadline: inDays(5),
        },
        NOW,
      ).state,
    ).toBe('ok');
  });

  it('만 14세 미만 동의 전 → 제한, 남은 날·7일 경고', () => {
    const far = consentStatus(
      {
        age_band: 'under14',
        guardian_consented_at: null,
        consent_deadline: inDays(29.5),
      },
      NOW,
    );
    expect(far).toEqual({
      state: 'pending',
      deadline: inDays(29.5),
      daysLeft: 30,
      warn: false,
    });
    expect(isRestricted(far)).toBe(true);
    const near = consentStatus(
      {
        age_band: 'under14',
        guardian_consented_at: null,
        consent_deadline: inDays(6.2),
      },
      NOW,
    );
    expect(near).toMatchObject({ daysLeft: 7, warn: true });
    expect(
      consentStatus(
        {
          age_band: 'under14',
          guardian_consented_at: null,
          consent_deadline: inDays(-2),
        },
        NOW,
      ),
    ).toMatchObject({ daysLeft: 0, warn: true });
  });

  it('나이 확인 결과가 없으면 제한 (안전한 쪽), 기한은 없음', () => {
    expect(
      consentStatus(
        { age_band: null, guardian_consented_at: null, consent_deadline: null },
        NOW,
      ),
    ).toEqual({
      state: 'pending',
      deadline: null,
      daysLeft: null,
      warn: false,
    });
  });
});
