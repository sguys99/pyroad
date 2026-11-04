import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 황금키 API: 스테이지 잠금은 use_golden_key RPC 가 users 잠금 아래에서 확인한다 (00006, B38).
// API 는 따로 확인하지 않고 RPC 의 stage_locked 를 403 + 아이용 문구로 돌려준다 (정답 코드는 응답에 넣지 않음)

const QUEST = {
  id: 'q2',
  stage_id: 's2',
  prompt_skeleton: { topic: '조건문', fallback_text: '' },
};
const ANSWER_KEY = {
  expected_output: '참',
  hints: { level_1: '', level_2: '', level_3: '' },
  solution_code: 'print("참")',
  steps: [],
};

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

function chain(data: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    maybeSingle: async () => ({ data, error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: (table: string) =>
      chain(table === 'quest_answer_keys' ? ANSWER_KEY : QUEST),
  }),
}));

import { POST } from '../route';
import { STAGE_LOCKED_MESSAGE } from '@/lib/world/stageLock';

function post(body: object) {
  return new Request('http://localhost/api/quest/golden-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.rpc.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('/api/quest/golden-key', () => {
  it('잠긴 스테이지면 RPC 의 stage_locked 를 403 + 아이용 문구로, 정답 코드는 보내지 않는다', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: 'PT403', message: 'stage_locked' },
    });
    const res = await POST(post({ quest_id: 'q2' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toEqual({ error: STAGE_LOCKED_MESSAGE, code: 'stage_locked' });
    expect(JSON.stringify(body)).not.toContain('print');
    // 인증된 사용자 id 로만 부른다
    expect(mocks.rpc).toHaveBeenCalledWith('use_golden_key', {
      p_user_id: 'u1',
      p_quest_id: 'q2',
    });
  });

  it('열린 스테이지면 정답 코드와 남은 황금키', async () => {
    mocks.rpc.mockResolvedValue({
      data: { golden_keys: 2, charged: true, step: null },
      error: null,
    });
    const res = await POST(post({ quest_id: 'q2' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      solution_code: 'print("참")',
      golden_keys: 2,
      charged: true,
    });
  });
});
