import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUARDIAN_AGREEMENT_ITEMS,
  toAgreementRecords,
} from '@/lib/legal/agreements';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  rpc: vi.fn(),
  reportServerError: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mocks.user } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/api/serverError', () => ({
  reportServerError: mocks.reportServerError,
}));
vi.mock('@/lib/observability/server', () => ({ captureServerError: vi.fn() }));

import { POST } from '../route';

const ALL = toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, {
  guardian_privacy: true,
  guardian_attest: true,
});
const post = (b: unknown) =>
  POST(
    new Request('http://localhost/api/consent/guardian', {
      method: 'POST',
      body: JSON.stringify(b),
    }),
  );
let consent: { data: unknown; error: unknown };

beforeEach(() => {
  mocks.user = { id: 'u1' };
  consent = { data: { first: true }, error: null };
  mocks.rpc.mockReset();
  mocks.reportServerError.mockClear();
  mocks.rpc.mockImplementation(async (fn: string) =>
    fn === 'consume_rate_limit'
      ? { data: { allowed: true }, error: null }
      : consent,
  );
});

describe('POST /api/consent/guardian (P3-15)', () => {
  it('보호자 항목 전부 + 관계 → record_guardian_consent(method guardian_in_person)', async () => {
    const res = await post({ agreements: ALL, relation: 'father' });
    expect(res.status).toBe(200);
    expect(
      mocks.rpc.mock.calls.find((c) => c[0] === 'record_guardian_consent')?.[1],
    ).toEqual({
      p_user_id: 'u1',
      p_agreements: GUARDIAN_AGREEMENT_ITEMS.map((i) => ({
        item: i.id,
        version: i.version,
      })),
      p_relation: 'father',
      p_method: 'guardian_in_person',
    });
  });

  it('빠진 항목 400 · 보호자 이름 같은 다른 키 400 · 로그인 안 함 401', async () => {
    expect(
      (await post({ agreements: ALL.slice(1), relation: null })).status,
    ).toBe(400);
    expect(
      (await post({ agreements: ALL, relation: null, phone: '010' })).status,
    ).toBe(400);
    mocks.user = null;
    expect((await post({ agreements: ALL, relation: null })).status).toBe(401);
  });

  it('만 14세 미만이 아니면 409, DB 오류는 500 일반 문구', async () => {
    consent = { data: null, error: { code: 'PT409', message: 'not_under14' } };
    expect((await post({ agreements: ALL, relation: null })).status).toBe(409);
    consent = { data: null, error: { code: 'XX', message: 'secret' } };
    const res = await post({ agreements: ALL, relation: null });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});
