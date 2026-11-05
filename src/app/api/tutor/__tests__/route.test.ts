import { describe, it, expect, vi, beforeEach } from 'vitest';

// 비스트림 /api/tutor 의 응답 표시값만 본다. 프롬프트·권한·힌트 기록은 helpers·stream-route 테스트에서
const mocks = vi.hoisted(() => ({
  callTutor: vi.fn(),
  recordHint: vi.fn(),
  allowServerKey: vi.fn(),
}));

vi.mock('../helpers', () => ({
  prepareTutorCall: async (request: Request) => ({
    systemPrompt: 'sys',
    userPrompt: 'user',
    providerType: 'anthropic',
    customApiKey: 'sk-own',
    hasAnyKey: true,
    fast: false,
    fallbackProviders: ['gemini'],
    quest: {},
    answerKey: null,
    body: await request.json(),
    recordHint: null,
    allowServerKey: mocks.allowServerKey,
  }),
  buildFallbackMessage: () => '저장된 답변이에요',
}));
vi.mock('@/lib/tutor/client', () => ({ callTutor: mocks.callTutor }));

import { POST } from '../route';
import { clearTutorCache } from '@/lib/tutor/cache';

function post(body: object) {
  return new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/tutor 의 is_fallback (B18 남은 문제)', () => {
  beforeEach(() => {
    clearTutorCache();
    mocks.callTutor.mockReset();
  });

  it('다른 provider로 폴백해 AI가 답했으면 "저장된 답변"이 아니다', async () => {
    mocks.callTutor.mockResolvedValue({
      ok: true,
      text: '제미나이가 답했어요',
      provider_used: 'gemini',
      was_fallback: true,
    });

    const data = await (
      await POST(post({ type: 'code_feedback', quest_id: 'q1' }))
    ).json();
    expect(data).toMatchObject({
      message: '제미나이가 답했어요',
      is_fallback: false,
      provider_used: 'gemini',
    });
  });

  it('모든 provider가 실패해 저장된 답변을 보내면 is_fallback', async () => {
    mocks.callTutor.mockResolvedValue({ ok: false, text: '' });

    const data = await (
      await POST(post({ type: 'code_feedback', quest_id: 'q1' }))
    ).json();
    expect(data).toMatchObject({
      message: '저장된 답변이에요',
      is_fallback: true,
    });
  });

  it('서버 키 전역 예산 확인(allowServerKey)과 요청 signal 을 callTutor 에 넘긴다 (P1-22)', async () => {
    mocks.callTutor.mockResolvedValue({ ok: true, text: '답' });
    const request = post({ type: 'code_feedback', quest_id: 'q1' });
    await POST(request);
    expect(mocks.callTutor.mock.calls[0][7]).toEqual({
      signal: request.signal,
      allowServerKey: mocks.allowServerKey,
    });
  });
});
