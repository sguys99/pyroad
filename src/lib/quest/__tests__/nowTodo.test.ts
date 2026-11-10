import { describe, expect, it } from 'vitest';
import type { RunResult } from '@/lib/pyodide/usePyodide';
import { nowTodoText } from '../nowTodo';

const base = {
  task: '인사를 출력해요',
  expected: '안녕하세요! 가 나와야 해요',
  runResult: null,
  runIsCurrent: false,
  passed: false,
  isCompleted: false,
};
const run = (r: Partial<RunResult>) =>
  ({ stdout: '', stderr: '', success: true, ...r }) as RunResult;

describe('nowTodoText (P6-10, Q58)', () => {
  it('아직 안 돌렸으면 할 일 + 나와야 하는 모습 + 돌려 보기', () => {
    const t = nowTodoText(base);
    expect(t).toContain('지금 할 일: 인사를 출력해요');
    expect(t).toContain('나와야 하는 모습');
    expect(t).toContain('코드 돌려보기');
  });

  it('오류면 그 줄로, 출력이 다르면 견줘 보기, 고친 뒤면 다시 돌려 보기', () => {
    const err = run({
      success: false,
      hadException: true,
      stderr:
        'Traceback (most recent call last):\n  File "<exec>", line 2, in <module>\nNameError: name x is not defined',
    });
    expect(
      nowTodoText({ ...base, runResult: err, runIsCurrent: true }),
    ).toContain('2번째 줄');
    expect(
      nowTodoText({ ...base, runResult: run({}), runIsCurrent: true }),
    ).toContain('견줘 보고');
    expect(
      nowTodoText({ ...base, runResult: err, runIsCurrent: false }),
    ).toContain('코드를 고쳤네요');
  });

  it('프로젝트는 단계 표시, 통과했으면 다음 퀘스트·복습', () => {
    expect(nowTodoText({ ...base, step: { n: 2, total: 5 } })).toContain(
      '2/5단계',
    );
    expect(
      nowTodoText({
        ...base,
        passed: true,
        runResult: run({}),
        runIsCurrent: true,
      }),
    ).toContain('벌써 해냈어요');
  });
});
