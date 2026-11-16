// 채점 요청 본문의 실행 결과 (P11-05). 채점·완료 API가 같이 쓰고, 화면(useQuestSession)이 같은 모양으로 보낸다.
//
// 서버는 Python을 실행하지 않는다: 브라우저가 실행한 출력과 turtle 명령을 받아 정답 테이블 규칙으로 다시 판정한다
// (§2.3 stdout 재채점과 같은 신뢰 수준). 그래서 여기서는 크기·모양만 믿지 않고 확인한다.
import type { TurtleCommand } from '@/lib/turtle/scene';
import { finalFrame } from '@/lib/turtle/snapshot';

/** 한 번 실행한 결과 (시험 손님이면 손님 하나) */
export interface GradeRun {
  stdout: string;
  /** 이 실행의 turtle 명령 (src/lib/turtle/scene.ts 형식). 그리지 않았으면 없음 */
  turtle?: TurtleCommand[];
}

/** 채점 요청에 실리는 실행: 손님이 있으면 손님마다(`runs`), 없으면 한 번(`stdout`·`turtle`) */
export interface GradePayload {
  stdout: string;
  turtle?: TurtleCommand[];
  runs?: GradeRun[];
}

/** 출력 합 상한 (완료 API 기존 값과 같음) */
export const MAX_GRADE_STDOUT = 100_000;
/** turtle 명령 합 상한: 실행 한 번 5만(TURTLE_MAX_COMMANDS)의 두 배 — 게임은 프레임마다 세므로 넘으면 끝 쪽만 보낸다 */
export const MAX_GRADE_COMMANDS = 100_000;
/** 손님 수 상한 (콘텐츠 스키마 scenarios max) */
export const MAX_GRADE_RUNS = 8;

export type ParsedGrade =
  | { ok: true; payload: GradePayload }
  | { ok: false; error: 'invalid' | 'too_large' };

function parseTurtle(value: unknown): TurtleCommand[] | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || !value.every(Array.isArray)) return null;
  return value as TurtleCommand[];
}

/** 요청 본문의 stdout·turtle·runs를 읽는다. 모양이 틀리면 invalid, 상한을 넘으면 too_large */
export function parseGradePayload(body: Record<string, unknown>): ParsedGrade {
  const stdout = typeof body.stdout === 'string' ? body.stdout : '';
  const turtle = parseTurtle(body.turtle);
  if (turtle === null) return { ok: false, error: 'invalid' };
  let runs: GradeRun[] | undefined;
  if (body.runs !== undefined) {
    if (!Array.isArray(body.runs) || body.runs.length > MAX_GRADE_RUNS)
      return { ok: false, error: 'invalid' };
    runs = [];
    for (const raw of body.runs as unknown[]) {
      const run = raw as Record<string, unknown> | null;
      if (typeof run !== 'object' || run === null)
        return { ok: false, error: 'invalid' };
      const t = parseTurtle(run.turtle);
      if (typeof run.stdout !== 'string' || t === null)
        return { ok: false, error: 'invalid' };
      runs.push({ stdout: run.stdout, ...(t && { turtle: t }) });
    }
  }
  const all = [{ stdout, turtle }, ...(runs ?? [])];
  const chars = all.reduce((n, r) => n + r.stdout.length, 0);
  const commands = all.reduce((n, r) => n + (r.turtle?.length ?? 0), 0);
  if (chars > MAX_GRADE_STDOUT || commands > MAX_GRADE_COMMANDS)
    return { ok: false, error: 'too_large' };
  return {
    ok: true,
    payload: { stdout, ...(turtle && { turtle }), ...(runs && { runs }) },
  };
}

/** 보내기 전에 명령을 줄인다: 상한을 넘으면(긴 게임) 끝난 화면을 다시 그리는 짧은 스트림으로 (그림 규칙은 남은 그림을 봄) */
export function gradeCommands(
  commands: readonly TurtleCommand[],
): TurtleCommand[] | undefined {
  if (!commands.length) return undefined;
  return commands.length <= MAX_GRADE_COMMANDS
    ? [...commands]
    : finalFrame(commands);
}
