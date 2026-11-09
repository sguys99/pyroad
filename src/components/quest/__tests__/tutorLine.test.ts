import { describe, expect, it } from 'vitest';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { tutorLine } from '../StoryPage';

const ok = { stdout: 'a\n', stderr: '', success: true, outcome: 'ok' };
const session = (s: Partial<QuestSession>) =>
  ({ validation: null, runResult: null, steps: null, ...s }) as QuestSession;

describe('tutorLine 성공 (P6-08)', () => {
  it('코드 퀘스트는 통과하는 순간(완료 응답 전에도) 응원 + 통과 도장', () => {
    const line = tutorLine(
      session({
        validation: { passed: true, type: 'output_match' },
        runResult: ok as QuestSession['runResult'],
        isCompleted: false,
      }),
    );
    expect(line.state).toBe('cheer');
    expect(line.text).toContain('통과 도장 쾅');
  });

  it('프로젝트는 마지막 단계까지 끝내야 응원, 중간 단계는 기쁨', () => {
    const steps = [{}, {}] as QuestSession['steps'];
    const passed = {
      validation: { passed: true, type: 'output_match' as const },
      steps,
    };
    expect(tutorLine(session({ ...passed, isCompleted: false })).state).toBe(
      'happy',
    );
    expect(tutorLine(session({ ...passed, isCompleted: true })).state).toBe(
      'cheer',
    );
  });
});

describe('tutorLine 완료한 퀘스트 (Q57)', () => {
  it('복습으로 통과하면 복습 완료, 통과 전엔 방금/예전을 구분', () => {
    const passed = {
      validation: { passed: true, type: 'output_match' as const },
      runResult: ok as QuestSession['runResult'],
      isCompleted: true,
    };
    expect(
      tutorLine(session({ ...passed, completion: 'review' })).text,
    ).toContain('복습 완료');
    expect(
      tutorLine(session({ isCompleted: true, completion: 'just' })).text,
    ).toContain('방금 통과');
    expect(
      tutorLine(session({ isCompleted: true, completion: 'before' })).text,
    ).toContain('예전에 통과');
  });
});
