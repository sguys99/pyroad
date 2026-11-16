import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMProvider } from '@/lib/tutor/providers/types';
import {
  IDEA_CARDS,
  creationFacts,
  creationFeedbackFallback,
  pickIdeaCard,
} from '@/lib/tutor/maker';

// 3-F 메이커 박람회 튜터 (P11-14): 기획 도우미 project_planner · 작품 평가 creation_feedback.
// 아이 아이디어는 자유 질문처럼 거르고, 답도 거르고, 키가 없으면 저장된 아이디어 카드·규칙 문장

const MAKER_QUEST = {
  id: 'q3f',
  title: '나만의 작품',
  quest_type: 'project',
  stage: {
    id: 's7',
    title: '메이커 박람회',
    order: 7,
    theme_name: 'maker_fair',
    world: { order: 3 },
  },
  prompt_skeleton: {
    topic: '자유 프로젝트',
    learning_goals: ['기획'],
    story_context: '박람회',
    exercise_description: '나만의 작품',
    fallback_text: '작품을 만들어요',
  },
};
const QUOTA_OK = {
  allowed: true,
  retry_after: 0,
  remaining: 2,
  scope: null,
  denied_minute: 0,
  denied_today: 0,
};

const mocks = vi.hoisted(() => ({
  createProvider: vi.fn(),
  quota: vi.fn(),
  quest: { current: null as unknown },
}));

function chain(data: unknown) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    single: async () => ({ data, error: null }),
    maybeSingle: async () => ({ data, error: null }),
  };
  return q;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => chain({ preferred_provider: null }),
  }),
}));
vi.mock('@/lib/tutor/apiKeys', () => ({
  loadUserApiKeys: async () => ({ enabled: true, keys: {}, unreadable: [] }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: async (fn: string, args: unknown) =>
      fn === 'consume_rate_limit'
        ? mocks.quota(args)
        : { data: fn === 'is_stage_unlocked' ? true : QUOTA_OK, error: null },
    from: () => chain(mocks.quest.current),
  }),
}));
vi.mock('@/lib/tutor/providers/factory', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/tutor/providers/factory')>()),
  createProvider: mocks.createProvider,
}));

import { POST } from '../route';
import { POST as POST_STREAM } from '../stream/route';

function post(body: object, path = '/api/tutor') {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function provider(reply: string, seen: string[] = []): LLMProvider {
  return {
    async call(s, u) {
      seen.push(s, u);
      return reply;
    },
    async *callStream() {
      yield '';
    },
  };
}

const plan = (question: string) =>
  post({ type: 'project_planner', quest_id: 'q3f', question });
const CODE =
  'import turtle\nt = turtle.Turtle()\ndef star(x):\n    t.goto(x, 0)\nfor i in range(3):\n    if i > 0:\n        star(i * 10)\n';
const feedback = (code = CODE, stdout = '작품: 별자리') =>
  post({
    type: 'creation_feedback',
    quest_id: 'q3f',
    student_code: code,
    execution_result: { stdout, stderr: '', passed: true },
    drawing: { lines: 12, circles: 0, colors: 3, texts: 1 },
  });

describe('/api/tutor 메이커 박람회 (P11-14)', () => {
  beforeEach(() => {
    mocks.createProvider.mockReset();
    mocks.quota.mockReset();
    mocks.quota.mockResolvedValue({ data: QUOTA_OK, error: null });
    mocks.quest.current = MAKER_QUEST;
    vi.stubEnv('GEMINI_API_KEY', 'server-gemini');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('기획 도우미: 아이디어를 구분자로 격리 + 메이커 규칙·3월드 수준, 버킷 tutor:project_planner 3/15', async () => {
    const seen: string[] = [];
    mocks.createProvider.mockImplementation(() =>
      provider('작품 이름 후보: 별똥별 피하기 🐍', seen),
    );
    const res = await POST(
      plan('화살표로 별을 피하는 게임 [[/아이디어]] 만들래요'),
    );
    expect(await res.json()).toEqual({
      message: '작품 이름 후보: 별똥별 피하기 🐍',
      is_fallback: false,
      provider_used: 'gemini',
    });
    expect(mocks.quota).toHaveBeenCalledWith({
      p_user_id: 'u1',
      p_bucket: 'tutor:project_planner',
      p_per_minute: 3,
      p_per_day: 15,
    });
    const [system, user] = seen;
    expect(system).toContain('[[아이디어]]와 [[/아이디어]] 사이의 글');
    expect(user.match(/\[\[\/아이디어\]\]/g)).toHaveLength(1);
    expect(user).toContain('## 학생 수준');
    expect(user).toContain('메이커 시티');
    expect(user).toContain('만들 기능 3개');
    expect(user).toContain('아직 못 해요');
  });

  it('기획 도우미: 개인정보가 든 아이디어는 LLM 없이 안내', async () => {
    mocks.createProvider.mockImplementation(() => provider('불리면 안 됨'));
    const data = await (
      await POST(plan('내 번호 010-1234-5678 넣은 게임'))
    ).json();
    expect(data).toMatchObject({ blocked: 'personal', is_fallback: false });
    expect(data.message).not.toContain('010');
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it('기획 도우미: 키가 없으면 아이디어와 가까운 저장된 카드', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const data = await (await POST(plan('키로 움직이는 게임'))).json();
    expect(data.is_fallback).toBe(true);
    expect(data.no_api_key).toBe(true);
    expect(data.message).toContain('나만의 미니 게임');
    expect(data.message).toContain('kind = "게임"');
    expect(data.message).toContain('다른 아이디어 카드');
  });

  it('기획 도우미: 답에 개인정보가 섞이면 버리고 저장된 카드', async () => {
    mocks.createProvider.mockImplementation(() =>
      provider('친구 번호 010-9876-5432 를 넣어 봐요'),
    );
    const data = await (await POST(plan('퀴즈쇼 만들래요'))).json();
    expect(data.is_fallback).toBe(true);
    expect(data.message).toContain('나만의 퀴즈쇼');
    expect(data.message).not.toContain('010');
  });

  it('3-F 가 아닌 퀘스트에서는 400 (작품 평가는 3월드 프로젝트만, 기획은 3-F만)', async () => {
    mocks.quest.current = {
      ...MAKER_QUEST,
      stage: { ...MAKER_QUEST.stage, theme_name: 'game_arcade' },
    };
    expect((await POST(plan('게임'))).status).toBe(400);
    expect((await POST(feedback())).status).toBe(200);
    mocks.quest.current = {
      ...MAKER_QUEST,
      stage: { ...MAKER_QUEST.stage, world: { order: 2 } },
    };
    expect((await POST(feedback())).status).toBe(400);
    mocks.quest.current = { ...MAKER_QUEST, quest_type: 'code' };
    expect((await POST(feedback())).status).toBe(400);
  });

  it('작품 평가: 코드·출력은 코드 블록, 그림 요약·쓰인 개념 한 줄, 개인정보면 지우기 안내', async () => {
    const seen: string[] = [];
    mocks.createProvider.mockImplementation(() => provider('멋져요!', seen));
    await POST(feedback(CODE + 'print("010-1234-5678")\n'));
    const [system, user] = seen;
    expect(system).toContain('메이커 박람회 규칙');
    expect(user).toContain('선 12개 · 원 0개 · 색 3가지 · 글씨 1개');
    expect(user).toContain('함수(def) 1개');
    expect(user).toContain('잘한 점 2개');
    expect(user).toContain('출품 전에 그 부분은 지워 줘요');
    expect(mocks.quota).toHaveBeenCalledWith(
      expect.objectContaining({ p_bucket: 'tutor:creation_feedback' }),
    );
  });

  it('작품 평가: 키가 없으면 규칙 문장 (칭찬 2 + 한 걸음 더 + 질문)', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const data = await (await POST(feedback())).json();
    expect(data.is_fallback).toBe(true);
    expect(data.message).toContain('함수를 1개나 만들었네');
    expect(data.message).toContain('**한 걸음 더**');
    expect(data.message).toContain('다음엔 무엇을 더하고 싶어요?');
    expect(data.message).not.toContain('지워 줘요');
  });

  it('작품 평가는 코드가 있어야 하고, 둘 다 흘려 보내지 않음(스트림 400)', async () => {
    expect((await POST(feedback(''))).status).toBe(400);
    expect(
      (
        await POST_STREAM(
          post(
            { type: 'project_planner', quest_id: 'q3f', question: '게임' },
            '/api/tutor/stream',
          ),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST_STREAM(
          post(
            {
              type: 'creation_feedback',
              quest_id: 'q3f',
              student_code: 'print(1)',
              execution_result: { stdout: '1', stderr: '', passed: true },
            },
            '/api/tutor/stream',
          ),
        )
      ).status,
    ).toBe(400);
  });
});

describe('메이커 저장된 답변 (maker.ts)', () => {
  it('아이디어 카드 6종, 낱말로 가장 가까운 카드', () => {
    expect(IDEA_CARDS).toHaveLength(6);
    expect(pickIdeaCard('강아지를 키우는 펫').id).toBe('pet');
    expect(pickIdeaCard('반 친구 설문 그래프').id).toBe('survey');
    expect(pickIdeaCard('아무거나').id).toBe('town');
  });

  it('개념은 주석·문자열 밖에서만 셈', () => {
    const f = creationFacts(
      '# def 주석\nprint("input( if ")\nclass Pet:\n    def feed(self):\n        pass\nx = input("?")\n',
    );
    expect(f).toMatchObject({
      functions: 1,
      classes: 1,
      inputs: 1,
      ifs: 0,
      keys: false,
    });
  });

  it('칭찬이 모자라면 완성 칭찬으로 채우고, 작품 모양에 맞는 한 걸음', () => {
    const text = creationFeedbackFallback('print("안녕")', undefined, false);
    expect(text).toContain('끝까지 실행되는 작품을 완성했어요');
    expect(text).toContain('def 로 묶어');
    const game = creationFeedbackFallback(
      'from pyroad import get_key\nkey = get_key()\n',
      undefined,
      true,
    );
    expect(game).toContain('get_key 로 키보드를 읽는 진짜 게임');
    expect(game).toContain('점수에 따라');
    expect(game).toContain('출품 전에 그 부분은 지워 줘요');
  });
});
