// 시험 손님 채점 (P11-05, 제안 C, §12-Q75 ⑤): "채점"을 누르면 퀘스트의 공개 손님마다 학생 코드를 한 번씩 실행한다.
// 손님 입력은 input()에 차례로(Worker `stdin` 큐, 실시간 입력 채널이 없는 기기에서도 됨), 키는 프레임 순서로 들어가고
// 잠은 건너뛴다(검증 실행). 손님마다 나온 글자·그림을 모아 서버에 보내면 서버가 정답 테이블의 손님별 규칙으로 다시 판정한다.
import type { PublicScenario } from '@/lib/content/schema';
import type { RunInput } from '@/lib/pyodide/types';
import type { RunCodeOptions, RunResult } from '@/lib/pyodide/usePyodide';
import type { TurtleCommand } from '@/lib/turtle/scene';
import { gradeCommands, type GradeRun } from './gradeRuns';

export type GuestState =
  /** 차례를 기다림 */
  | 'waiting'
  | 'running'
  /** 끝까지 돌았음 (통과 여부는 서버 채점 뒤 passed) */
  | 'done'
  /** 오류·시간 초과로 멈춤 */
  | 'error'
  /** 앞 손님에서 멈춰 이 손님은 안 돌림 */
  | 'skipped';

export interface GuestRun {
  name: string;
  state: GuestState;
  stdout: string;
  /** 손님이 input()에 답한 말과 자리 (P11-01 RunInput과 같은 모양) */
  inputs: readonly RunInput[];
  /** 손님이 누를 키 (프레임 순서, 키 없는 프레임은 뺌) */
  keys: string[];
  /** 서버 채점 결과 (채점 전이면 undefined) */
  passed?: boolean;
  /** 오류 종류 (EOFError면 "입력이 더 필요해요") */
  errorType?: string | null;
}

/** 손님 이름: 콘텐츠에 없으면 `손님 1` */
export function guestName(s: PublicScenario, index: number): string {
  return s.name ?? `손님 ${index + 1}`;
}

export function initialGuests(
  scenarios: readonly PublicScenario[],
): GuestRun[] {
  return scenarios.map((s, i) => ({
    name: guestName(s, i),
    state: 'waiting',
    stdout: '',
    inputs: [],
    keys: (s.keys ?? []).filter((k): k is string => k !== null),
  }));
}

type RunCode = (code: string, options?: RunCodeOptions) => Promise<RunResult>;

export interface GuestOutcome {
  guests: GuestRun[];
  /** 결과 쪽지에 보일 실행: 멈춘 손님의 실행(오류 쪽지), 다 돌았으면 마지막 손님의 실행 */
  result: RunResult;
  /** 모두 끝까지 돌았으면 서버에 보낼 손님별 결과 */
  runs: GradeRun[] | null;
}

/**
 * 손님마다 차례로 실행. 한 손님이 오류·시간 초과·멈춤이면 남은 손님은 돌리지 않는다(같은 오류를 되풀이하지 않게).
 * `beforeRun`은 손님 실행 직전(그림판을 비울 때), `onUpdate`는 화면에 보일 손님 목록이 바뀔 때마다
 */
export async function runGuests(
  runCode: RunCode,
  code: string,
  scenarios: readonly PublicScenario[],
  {
    onTurtle,
    beforeRun,
    onUpdate,
  }: {
    onTurtle?: (chunk: string) => void;
    beforeRun?: () => void;
    onUpdate?: (guests: GuestRun[]) => void;
  } = {},
): Promise<GuestOutcome> {
  let guests = initialGuests(scenarios);
  const set = (i: number, patch: Partial<GuestRun>) => {
    guests = guests.map((g, j) => (j === i ? { ...g, ...patch } : g));
    onUpdate?.(guests);
  };
  onUpdate?.(guests);
  const runs: GradeRun[] = [];
  let result: RunResult | null = null;
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    beforeRun?.();
    set(i, { state: 'running' });
    const commands: TurtleCommand[] = [];
    const r = await runCode(code, {
      stdin: s.inputs ?? [],
      ...(s.keys && { keys: s.keys }),
      ...(s.seed !== undefined && { seed: s.seed }),
      skipSleep: true,
      onTurtle: (chunk) => {
        onTurtle?.(chunk);
        try {
          const cmds = JSON.parse(chunk);
          if (Array.isArray(cmds)) commands.push(...cmds);
        } catch {
          // 깨진 묶음은 그림 채점에서 빠짐
        }
      },
    });
    result = r;
    const ok = r.success && !r.isStopped && !r.isTimeout;
    set(i, {
      state: ok ? 'done' : 'error',
      stdout: r.stdout,
      inputs: r.inputs ?? [],
      errorType: r.errorType ?? null,
    });
    if (!ok) {
      guests = guests.map((g, j) => (j > i ? { ...g, state: 'skipped' } : g));
      onUpdate?.(guests);
      return { guests, result: r, runs: null };
    }
    const turtle = gradeCommands(commands);
    runs.push({ stdout: r.stdout, ...(turtle && { turtle }) });
  }
  return { guests, result: result!, runs };
}

/** 서버가 돌려준 손님별 통과 표시를 붙인다 */
export function markGuests(
  guests: readonly GuestRun[],
  passed: readonly boolean[] | undefined,
): GuestRun[] {
  return guests.map((g, i) =>
    passed?.[i] === undefined ? g : { ...g, passed: passed[i] },
  );
}

const KEY_LABEL: Record<string, string> = {
  Left: '←',
  Right: '→',
  Up: '↑',
  Down: '↓',
  space: '스페이스',
  Return: '엔터',
};

/** 손님이 누를 키를 보기 쉽게: `→ → → ↑` (많으면 `→ ×30`처럼 묶음) */
export function keysLabel(keys: readonly string[]): string {
  const parts: string[] = [];
  for (let i = 0; i < keys.length; ) {
    let j = i;
    while (j < keys.length && keys[j] === keys[i]) j++;
    const label = KEY_LABEL[keys[i]] ?? keys[i];
    const n = j - i;
    parts.push(n > 3 ? `${label} ×${n}` : Array(n).fill(label).join(' '));
    i = j;
  }
  return parts.join(' ');
}
