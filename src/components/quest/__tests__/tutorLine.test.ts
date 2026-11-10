import { describe, expect, it } from 'vitest';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import { missionItems, tutorLine } from '../StoryPage';

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

describe('프로젝트 단계 (P6-12)', () => {
  const steps = [
    { step_goal: '하나' },
    { step_goal: '둘' },
    { step_goal: '셋' },
  ] as QuestSession['steps'];
  const base = {
    steps,
    quest: { prompt_skeleton: {} } as QuestSession['quest'],
    isCompleted: false,
    stepCleared: null,
  };

  it('해 볼 일은 단계 번호와 지금 단계, "다음 단계" 박자 동안은 통과한 단계를 체크하고 다음 단계가 지금', () => {
    const now = missionItems(session({ ...base, currentStep: 2 }));
    expect(now.map((i) => [i.step, i.done, !!i.current])).toEqual([
      [1, true, false],
      [2, false, true],
      [3, false, false],
    ]);
    const beat = missionItems(
      session({ ...base, currentStep: 2, stepCleared: 2 }),
    );
    expect(beat[1]).toMatchObject({ done: true, fresh: true });
    expect(beat[2].current).toBe(true);
  });

  it('두 번째 단계부터 처음 대사는 이어서 쓰라는 안내', () => {
    expect(tutorLine(session({ ...base, currentStep: 1 })).text).toContain(
      '한 단계씩',
    );
    expect(tutorLine(session({ ...base, currentStep: 3 })).text).toContain(
      '3단계 시작',
    );
  });
});
