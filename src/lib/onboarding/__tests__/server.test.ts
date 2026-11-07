import { describe, expect, it, vi } from 'vitest';
import {
  AGREEMENT_ITEMS,
  GUARDIAN_AGREEMENT_ITEMS,
  toAgreementRecords,
} from '@/lib/legal/agreements';
import { validateNickname } from '@/lib/profile/nickname';
import {
  agreedRecords,
  completeOnboarding,
  consumeProfileQuota,
  findFreeSuggestion,
  guardianRecords,
  parseOnboardingRequest,
  suggestionCandidates,
} from '../server';

vi.mock('@/lib/observability/server', () => ({ captureServerError: vi.fn() }));

const ALL = toAgreementRecords(AGREEMENT_ITEMS, { terms: true, privacy: true });

/** 고정 난수 (0, 0.37, 0.74, …) */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('parseOnboardingRequest — zod strict', () => {
  const ok = {
    nickname: '용감한여우',
    skin: 'sky',
    grade: 3,
    agreements: ALL,
    age: { year: 2016 },
    guardian: null,
  };
  it('정상 값과 학년 건너뜀(null)', () => {
    expect(parseOnboardingRequest(ok)).toEqual(ok);
    expect(parseOnboardingRequest({ ...ok, grade: null })?.grade).toBeNull();
  });
  it.each([
    ['모르는 스킨', { ...ok, skin: 'gold' }],
    ['학년 7', { ...ok, grade: 7 }],
    ['학년 소수', { ...ok, grade: 2.5 }],
    [
      '학년 빠짐',
      {
        nickname: 'a',
        skin: 'sky',
        agreements: ALL,
        age: { year: 2016 },
        guardian: null,
      },
    ],
    ['나이 답 빠짐', { ...ok, age: undefined }],
    ['나이 답에 생일(일)까지', { ...ok, age: { year: 2012, day: 3 } }],
    [
      '보호자 이름 같은 다른 키',
      { ...ok, guardian: { agreements: [], relation: null, name: '김엄마' } },
    ],
    ['모르는 관계', { ...ok, guardian: { agreements: [], relation: 'uncle' } }],
    ['정해지지 않은 키(실명)', { ...ok, realName: '김민준' }],
    ['동의 기록에 다른 키', { ...ok, agreements: [{ ...ALL[0], at: 'x' }] }],
    ['닉네임이 터무니없이 김', { ...ok, nickname: 'a'.repeat(65) }],
    ['본문 아님', null],
  ])('%s → null', (_label, body) => {
    expect(parseOnboardingRequest(body)).toBeNull();
  });
});

describe('agreedRecords — 필수 동의를 지금 버전으로', () => {
  it('모두 동의 → 저장할 기록 (항목·버전)', () => {
    expect(agreedRecords(ALL)).toEqual(
      AGREEMENT_ITEMS.map((i) => ({ item: i.id, version: i.version })),
    );
  });
  it('필수 하나라도 빠지면 null', () => {
    expect(
      agreedRecords(
        toAgreementRecords(AGREEMENT_ITEMS, { terms: true, privacy: false }),
      ),
    ).toBeNull();
    expect(agreedRecords([])).toBeNull();
  });
  it('지난 버전·모르는 항목이면 null (화면이 오래된 문서를 들고 있음)', () => {
    expect(
      agreedRecords(ALL.map((r) => ({ ...r, version: '2020-01-01' }))),
    ).toBeNull();
    expect(
      agreedRecords([...ALL, { id: 'marketing', version: 'x', agreed: true }]),
    ).toBeNull();
  });
});

describe('guardianRecords — 보호자 항목을 모두 지금 버전으로 (P3-15)', () => {
  const G = toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, {
    guardian_privacy: true,
    guardian_attest: true,
  });
  it('모두 체크 → 기록, 하나라도 빠지거나 아이용 약관 항목이면 null', () => {
    expect(guardianRecords(G)).toEqual(
      GUARDIAN_AGREEMENT_ITEMS.map((i) => ({ item: i.id, version: i.version })),
    );
    expect(
      guardianRecords(
        toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, {
          guardian_privacy: true,
          guardian_attest: false,
        }),
      ),
    ).toBeNull();
    expect(guardianRecords(ALL)).toBeNull();
  });
});

describe('추천 이름', () => {
  it('입력한 이름 + 숫자 두 개 (10자 안), 모두 검사 통과', () => {
    const c = suggestionCandidates('코딩왕', seq(0.07, 0.5, 0.3, 0.9));
    expect(c[0]).toBe('코딩왕07');
    for (const name of c) expect(validateNickname(name).ok).toBe(true);
  });
  it('9~10자 이름이면 숫자를 붙이지 않고 랜덤 추천 + 숫자', () => {
    for (const name of suggestionCandidates('가나다라마바사아자')) {
      expect(name.startsWith('가나다라마바사아자')).toBe(false);
      expect(validateNickname(name).ok).toBe(true);
    }
  });
  it('비어 있는 첫 후보를 고름, DB 오류면 undefined', async () => {
    const taken = new Set(['코딩왕07']);
    const admin = {
      rpc: vi.fn(async (_fn: string, args: { p_nickname: string }) => ({
        data: taken.has(args.p_nickname),
        error: null,
      })),
    };
    expect(
      await findFreeSuggestion(admin as never, 'u', '코딩왕', seq(0.07, 0.42)),
    ).toBe('코딩왕42');
    const broken = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'x' } })),
    };
    expect(await findFreeSuggestion(broken as never, 'u', '코딩왕')).toBe(
      undefined,
    );
  });
});

describe('consumeProfileQuota — 한도 RPC', () => {
  it('거부면 retryAfter, DB 실패면 통과(fail-open)', async () => {
    const deny = {
      rpc: vi.fn(async () => ({
        data: { allowed: false, retry_after: 12 },
        error: null,
      })),
    };
    expect(
      await consumeProfileQuota(deny as never, 'u', 'profile:nickname', {}),
    ).toEqual({ allowed: false, retryAfter: 12 });
    expect(deny.rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_user_id: 'u',
      p_bucket: 'profile:nickname',
      p_per_minute: 30,
      p_per_day: 300,
    });
    const fail = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'down' } })),
    };
    expect(
      await consumeProfileQuota(fail as never, 'u', 'profile:onboarding', {
        PROFILE_LIMIT_ONBOARDING: '3/9',
      }),
    ).toEqual({ allowed: true, retryAfter: 0 });
    expect(fail.rpc.mock.calls[0]).toMatchObject([
      'consume_rate_limit',
      { p_per_minute: 3, p_per_day: 9 },
    ]);
  });
});

describe('completeOnboarding — RPC 결과', () => {
  const input = {
    nickname: '용감한여우',
    skin: 'sky' as const,
    grade: null,
    agreements: [{ item: 'terms', version: 'v' }],
    ageBand: 'under14' as const,
    guardian: null,
  };
  it('성공 → first, 23505 → taken, 그 밖 → error', async () => {
    const ok = {
      rpc: vi.fn(async () => ({ data: { first: true }, error: null })),
    };
    expect(await completeOnboarding(ok as never, 'u', input)).toEqual({
      ok: true,
      first: true,
      restricted: false,
    });
    expect(ok.rpc.mock.calls[0]).toMatchObject([
      'complete_onboarding',
      {
        p_user_id: 'u',
        p_grade: null,
        p_method: 'self',
        p_age_band: 'under14',
        p_guardian_agreements: null,
        p_guardian_relation: null,
      },
    ]);
    const dup = {
      rpc: vi.fn(async () => ({ data: null, error: { code: '23505' } })),
    };
    expect(await completeOnboarding(dup as never, 'u', input)).toEqual({
      ok: false,
      reason: 'taken',
    });
    const other = {
      rpc: vi.fn(async () => ({ data: null, error: { code: 'PT400' } })),
    };
    expect(await completeOnboarding(other as never, 'u', input)).toMatchObject({
      ok: false,
      reason: 'error',
    });
  });
});
