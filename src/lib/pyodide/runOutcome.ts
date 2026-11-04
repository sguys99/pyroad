// 코드 실행이 "성공"인지 판정한다 (B25).
// 지금 워커는 `success = !stderr`만 보내서 경고(SyntaxWarning 등)만 떠도 실패가 된다.
// 워커가 예외 여부를 따로 알려 주지 않으므로 stderr 내용으로 판정한다.
// P1-09에서 워커가 예외 여부를 직접 보내면 이 함수만 그 값으로 바꾸면 된다.

// Python warnings 모듈의 기본 출력 형식: `<파일>:<줄>: <분류>Warning: <메시지>`
// 예: `<exec>:1: SyntaxWarning: invalid escape sequence '\d'`
const WARNING_HEADER = /^.+:\d+: [A-Za-z_][A-Za-z0-9_]*Warning: /;
// 경고 아래에 붙는 소스 줄은 들여쓰기로 시작한다
const WARNING_SOURCE_LINE = /^\s+\S/;

/**
 * stderr에 경고가 1개 이상 있고 경고 말고는 아무것도 없으면 true.
 * 모르는 형식은 모두 경고가 아닌 것으로 본다(예외 Traceback, 차단 모듈 안내, 학생이 직접 쓴 stderr 등).
 */
export function isWarningOnlyStderr(stderr: string): boolean {
  if (stderr.includes('Traceback (most recent call last)')) return false;
  let afterWarning = false;
  for (const line of stderr.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    if (WARNING_HEADER.test(line)) {
      afterWarning = true;
    } else if (!(afterWarning && WARNING_SOURCE_LINE.test(line))) {
      return false;
    }
  }
  return afterWarning;
}

/** 워커 실행 결과가 성공인지. 워커가 성공이라고 했거나, stderr에 경고만 있으면 성공 */
export function isRunSuccessful(result: {
  success: boolean;
  stderr: string;
}): boolean {
  return result.success || isWarningOnlyStderr(result.stderr);
}
