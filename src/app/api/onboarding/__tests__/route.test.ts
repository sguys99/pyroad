import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AGREEMENT_ITEMS,
  GUARDIAN_AGREEMENT_ITEMS,
  toAgreementRecords,
} from '@/lib/legal/agreements';

const mocks = vi.hoisted(() => ({
  user: { id: '11111111-1111-1111-1111-111111111111' } as { id: string } | null,
  rpc: vi.fn(),
  trackServerEvent: vi.fn(),
  reportServerError: vi.fn(),
  xp: 0,
  progress: 0,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    // wasReturningUser (P3-12): users.total_xp · user_progress 행 수
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === 'users'
            ? { maybeSingle: async () => ({ data: { total_xp: mocks.xp } }) }
            : Promise.resolve({ count: mocks.progress }),
      }),
    }),
  }),
}));
vi.mock('@/lib/analytics/server', () => ({
  trackServerEvent: mocks.trackServerEvent,
}));
vi.mock('@/lib/api/serverError', () => ({
  reportServerError: mocks.reportServerError,
}));
vi.mock('@/lib/observability/server', () => ({ captureServerError: vi.fn() }));
// 카드 다시 그리기·CDN 지우기는 purge.test.ts 가 확인 (P9-11)
vi.mock('@/lib/share-card/purge', () => ({
  withShareCardPurge: (_a: unknown, _u: string, run: () => unknown) => run(),
}));

import { POST } from '../route';

const ALL = toAgreementRecords(AGREEMENT_ITEMS, { terms: true, privacy: true });
const body = (over: Record<string, unknown> = {}) => ({
  nickname: '용감한여우',
  skin: 'berry',
  grade: 4,
  agreements: ALL,
  age: { year: 2016 },
  guardian: null,
  ...over,
});

function post(b: unknown) {
  return POST(
    new Request('http://localhost/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    }),
  );
}

/** RPC 이름별 응답 */
function rpcReplies(replies: Record<string, unknown>) {
  mocks.rpc.mockImplementation(async (fn: string, args: unknown) => {
    const r = replies[fn];
    return typeof r === 'function' ? r(args) : r;
  });
}

beforeEach(() => {
  mocks.user = { id: '11111111-1111-1111-1111-111111111111' };
  mocks.rpc.mockReset();
  mocks.trackServerEvent.mockClear();
  mocks.reportServerError.mockClear();
  mocks.xp = 0;
  mocks.progress = 0;
  rpcReplies({
    consume_rate_limit: { data: { allowed: true }, error: null },
    complete_onboarding: { data: { first: true }, error: null },
    is_nickname_taken: { data: false, error: null },
  });
});

describe('POST /api/onboarding (P3-11)', () => {
  it('검사한 값으로 complete_onboarding 한 번 + 처음이면 onboarding_complete (닉네임 없이)', async () => {
    const res = await post(body({ nickname: ' 용감한여우 ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      first: true,
      restricted: false,
    });
    const call = mocks.rpc.mock.calls.find(
      (c) => c[0] === 'complete_onboarding',
    );
    expect(call?.[1]).toEqual({
      p_user_id: '11111111-1111-1111-1111-111111111111',
      p_nickname: '용감한여우',
      p_skin: 'berry',
      p_grade: 4,
      p_agreements: AGREEMENT_ITEMS.map((i) => ({
        item: i.id,
        version: i.version,
      })),
      p_method: 'self',
      p_age_band: 'under14',
      p_guardian_agreements: null,
      p_guardian_relation: null,
    });
    expect(mocks.trackServerEvent).toHaveBeenCalledTimes(1);
    const ev = mocks.trackServerEvent.mock.calls[0][0];
    expect(ev).toMatchObject({
      name: 'onboarding_complete',
      props: { skin: 'berry', grade_given: true, returning: false },
      dedupeKey: 'onboarding_complete',
    });
    expect(JSON.stringify(ev.props)).not.toContain('여우');
  });

  it('기존 사용자(진행 행이 있음)면 returning: true (P3-12)', async () => {
    mocks.progress = 3;
    expect((await post(body())).status).toBe(200);
    expect(mocks.trackServerEvent.mock.calls[0][0].props).toEqual({
      skin: 'berry',
      grade_given: true,
      returning: true,
    });
  });

  it('나이: 서버가 다시 계산해 결과만 넘김 (태어난 해는 RPC 에 가지 않음), 모름 = 만 14세 미만', async () => {
    await post(body({ age: { year: 1990 } }));
    await post(body({ age: { year: 'unknown' } }));
    const calls = mocks.rpc.mock.calls.filter(
      (c) => c[0] === 'complete_onboarding',
    );
    expect(calls.map((c) => c[1].p_age_band)).toEqual(['14plus', 'under14']);
    expect(JSON.stringify(calls)).not.toContain('1990');
  });

  it('만 14세 미만 + 보호자 동의 → 보호자 기록·관계, 빠지면 400, 만 14세 이상이면 보호자 기록은 무시', async () => {
    const G = toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, {
      guardian_privacy: true,
      guardian_attest: true,
    });
    expect(
      (await post(body({ guardian: { agreements: G, relation: 'mother' } })))
        .status,
    ).toBe(200);
    const call = mocks.rpc.mock.calls.find(
      (c) => c[0] === 'complete_onboarding',
    );
    expect(call?.[1]).toMatchObject({
      p_age_band: 'under14',
      p_guardian_agreements: GUARDIAN_AGREEMENT_ITEMS.map((i) => ({
        item: i.id,
        version: i.version,
      })),
      p_guardian_relation: 'mother',
    });
    const partial = await post(
      body({ guardian: { agreements: G.slice(0, 1), relation: null } }),
    );
    expect(partial.status).toBe(400);
    expect((await partial.json()).error).toBe('guardian_agreements_required');
    mocks.rpc.mockClear();
    await post(
      body({
        age: { year: 'older' },
        guardian: { agreements: G, relation: 'father' },
      }),
    );
    expect(
      mocks.rpc.mock.calls.find((c) => c[0] === 'complete_onboarding')?.[1],
    ).toMatchObject({
      p_age_band: '14plus',
      p_guardian_agreements: null,
    });
  });

  it('다시 저장(first=false)이면 이벤트 없음', async () => {
    rpcReplies({
      consume_rate_limit: { data: { allowed: true }, error: null },
      complete_onboarding: { data: { first: false }, error: null },
    });
    expect((await post(body({ grade: null }))).status).toBe(200);
    expect(mocks.trackServerEvent).not.toHaveBeenCalled();
  });

  it('로그인 안 함 → 401, 저장 안 함', async () => {
    mocks.user = null;
    expect((await post(body())).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['글자 규칙', { nickname: '파이 뱀' }, 'invalid_nickname'],
    ['예약어', { nickname: '운영자' }, 'invalid_nickname'],
    ['자리표시자', { nickname: '모험가1234' }, 'invalid_nickname'],
    ['금칙어', { nickname: 'fuckyou' }, 'invalid_nickname'],
    [
      '필수 동의 빠짐',
      {
        agreements: toAgreementRecords(AGREEMENT_ITEMS, {
          terms: true,
          privacy: false,
        }),
      },
      'agreements_required',
    ],
    [
      '지난 약관 버전',
      { agreements: ALL.map((r) => ({ ...r, version: '2000-01-01' })) },
      'agreements_required',
    ],
    ['모르는 스킨', { skin: 'gold' }, 'invalid_body'],
    ['학년 0', { grade: 0 }, 'invalid_body'],
  ])('%s → 400 %s, RPC 안 부름', async (_l, over, error) => {
    const res = await post(body(over));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(error);
    expect(
      mocks.rpc.mock.calls.some((c) => c[0] === 'complete_onboarding'),
    ).toBe(false);
  });

  it('닉네임 중복(23505) → 409 + 비어 있는 추천 이름, DB 메시지 없음', async () => {
    rpcReplies({
      consume_rate_limit: { data: { allowed: true }, error: null },
      complete_onboarding: {
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "users_nickname_lower_key"',
        },
      },
      is_nickname_taken: { data: false, error: null },
    });
    const res = await post(body());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe('nickname_taken');
    expect(json.suggestion).toMatch(/^\S{2,10}$/);
    expect(JSON.stringify(json)).not.toContain('users_nickname_lower_key');
  });

  it('그 밖의 DB 오류 → 500 일반 문구 + reportServerError', async () => {
    rpcReplies({
      consume_rate_limit: { data: { allowed: true }, error: null },
      complete_onboarding: {
        data: null,
        error: { code: 'XX000', message: 'secret detail' },
      },
    });
    const res = await post(body());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
    expect(mocks.reportServerError).toHaveBeenCalledTimes(1);
  });

  it('요청 한도 → 429 + Retry-After', async () => {
    rpcReplies({
      consume_rate_limit: {
        data: { allowed: false, retry_after: 30 },
        error: null,
      },
    });
    const res = await post(body());
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
