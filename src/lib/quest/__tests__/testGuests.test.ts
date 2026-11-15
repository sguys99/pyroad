// 시험 손님 실행 순서 (P11-05): 손님마다 stdin·keys·잠 건너뛰기로 실행, 멈추면 남은 손님은 건너뜀
import { describe, expect, it, vi } from 'vitest';
import type { RunCodeOptions, RunResult } from '@/lib/pyodide/usePyodide';
import { keysLabel, markGuests, runGuests } from '../testGuests';

const ok = (stdout: string): RunResult => ({
  stdout,
  stderr: '',
  success: true,
  outcome: 'ok',
});

describe('runGuests', () => {
  it('손님마다 입력·키·시드를 넣고 잠은 건너뛰며, 그림 명령을 모아 보낼 결과로', async () => {
    const calls: RunCodeOptions[] = [];
    const runCode = vi.fn(async (_code: string, o: RunCodeOptions = {}) => {
      calls.push(o);
      o.onTurtle?.(JSON.stringify([['u']]));
      return {
        ...ok(`손님 ${calls.length}\n`),
        inputs: [{ at: 0, value: 'a' }],
      };
    });
    const updates: string[][] = [];
    const out = await runGuests(
      runCode,
      'code',
      [
        { name: '별똥이', inputs: ['1'] },
        { keys: ['Right', null], seed: 3 },
      ],
      { onUpdate: (g) => updates.push(g.map((x) => x.state)) },
    );
    expect(
      calls.map(({ stdin, keys, seed, skipSleep }) => ({
        stdin,
        keys,
        seed,
        skipSleep,
      })),
    ).toEqual([
      { stdin: ['1'], keys: undefined, seed: undefined, skipSleep: true },
      { stdin: [], keys: ['Right', null], seed: 3, skipSleep: true },
    ]);
    expect(out.guests.map((g) => [g.name, g.state, g.keys])).toEqual([
      ['별똥이', 'done', []],
      ['손님 2', 'done', ['Right']],
    ]);
    expect(out.runs).toEqual([
      { stdout: '손님 1\n', turtle: [['u']] },
      { stdout: '손님 2\n', turtle: [['u']] },
    ]);
    expect(updates[0]).toEqual(['waiting', 'waiting']);
    expect(updates).toContainEqual(['running', 'waiting']);
  });

  it('오류(EOFError 등)가 나면 그 손님은 error, 남은 손님은 skipped, 보낼 결과 없음', async () => {
    const runCode = vi.fn(async () => ({
      ...ok('질문? '),
      success: false,
      errorType: 'EOFError',
      stderr: 'EOFError',
    }));
    const out = await runGuests(runCode, 'code', [
      { inputs: [] },
      { inputs: ['1'] },
    ]);
    expect(runCode).toHaveBeenCalledTimes(1);
    expect(out.guests.map((g) => g.state)).toEqual(['error', 'skipped']);
    expect(out.guests[0].errorType).toBe('EOFError');
    expect(out.runs).toBeNull();
  });

  it('서버 결과를 손님에 붙이고, 키는 보기 쉽게', () => {
    const [a, b] = markGuests(
      [
        { name: 'a', state: 'done', stdout: '', inputs: [], keys: [] },
        { name: 'b', state: 'done', stdout: '', inputs: [], keys: [] },
      ],
      [true, false],
    );
    expect([a.passed, b.passed]).toEqual([true, false]);
    expect(
      keysLabel(['Right', 'Right', 'Up', ...Array(30).fill('Left'), 'space']),
    ).toBe('→ → ↑ ← ×30 스페이스');
  });
});
