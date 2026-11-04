import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  trackServerEvent: vi.fn(),
  rpcData: null as unknown,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: U1 } } }) },
  }),
}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }));
vi.mock('@/lib/quest/grade', () => ({
  gradeSubmission: async () => ({ status: 'graded', passed: true }),
}));
vi.mock('@/lib/quest/rewardRpc', () => ({
  completeQuestRpc: async () => ({ ok: true, data: mocks.rpcData }),
  rewardError: (code: string) => Response.json({ code }, { status: 400 }),
}));
vi.mock('@/lib/analytics/server', () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

import { POST } from '../route';

const U1 = '11111111-1111-1111-1111-111111111111';
const QUEST = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b';

function complete() {
  return POST(
    new Request('http://localhost/api/quest/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quest_id: QUEST,
        code_submitted: 'print(1)',
        stdout: '1\n',
        // 클라이언트가 보낸 값은 무시됨 (B05)
        hints_used: 0,
        used_golden_key: false,
      }),
    }),
  );
}

const result = (over: Record<string, unknown> = {}) => ({
  already_completed: false,
  xp_gained: 10,
  total_xp: 110,
  level_before: 1,
  level_after: 2,
  new_badges: [],
  stage_cleared: null,
  next_quest_id: null,
  golden_keys: 3,
  hints_used: 2,
  used_golden_key: true,
  ...over,
});

beforeEach(() => {
  mocks.trackServerEvent.mockClear();
});

describe('POST /api/quest/complete — 분석 이벤트 (P1-17)', () => {
  it('처음 완료하면 DB 함수가 정한 값으로 quest_complete 를 서버가 기록', async () => {
    mocks.rpcData = result();
    expect((await complete()).status).toBe(200);
    expect(mocks.trackServerEvent).toHaveBeenCalledTimes(1);
    expect(mocks.trackServerEvent.mock.calls[0][0]).toMatchObject({
      userId: U1,
      name: 'quest_complete',
      props: {
        quest_id: QUEST,
        hints_used: 2,
        used_golden_key: true,
        level_up: true,
        stage_cleared: false,
      },
      path: '/quest/[id]',
      dedupeKey: `quest_complete:${QUEST}`,
    });
  });

  it('이미 완료한 퀘스트(다시 풀기·중복 클릭)는 기록하지 않음', async () => {
    mocks.rpcData = result({ already_completed: true });
    expect((await complete()).status).toBe(200);
    expect(mocks.trackServerEvent).not.toHaveBeenCalled();
  });
});
