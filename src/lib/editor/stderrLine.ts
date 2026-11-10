// 오류 줄 번호 찾기 (CodeMirror 없음): 결과 쪽지·대사가 쓰고, 에디터 확장(errorLine.ts)은 에디터와 함께 늦게 온다 (P6-16)

/** traceback에 보이는 학생 코드 파일 이름. `public/workers/pyodide-core.mjs`의 `STUDENT_FILENAME`과 같아야 한다 */
export const STUDENT_FILENAME = '<exec>';

const FRAME_RE = new RegExp(
  `File "${STUDENT_FILENAME.replace(/[<>]/g, '\\$&')}", line (\\d+)`,
  'g',
);

/**
 * stderr에서 오류가 난 학생 코드 줄(1부터). 학생 코드 프레임이 여러 개면(함수 호출) 가장 안쪽 = 마지막 것.
 * 경고(`<exec>:2: SyntaxWarning`)나 학생이 직접 쓴 stderr에는 프레임이 없어 null
 */
export function errorLineFromStderr(stderr: string | null | undefined) {
  if (!stderr) return null;
  let line: number | null = null;
  for (const m of stderr.matchAll(FRAME_RE)) line = Number(m[1]);
  return line && line > 0 ? line : null;
}
