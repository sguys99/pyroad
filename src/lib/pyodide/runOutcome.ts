// 코드 실행이 "성공"인지 판정한다 (B25, §2.4).
// 워커 v2(P1-09 프로토콜)는 done 메시지로 예외 여부(`outcome`, `hadException`)를 직접 알려 주므로 그 값을 쓴다.
// 경고(SyntaxWarning 등)는 예외가 아니므로 stderr에 경고가 있어도 성공이다.
// outcome이 없는 결과(예전 형식)만 stderr 내용으로 추측한다.

import { MAX_OUTPUT_LENGTH } from './constants';
import type { RunOutcome } from './types';

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

/**
 * 워커 실행 결과가 성공인지.
 * - `outcome`이 있으면(워커 v2) 끝까지 예외 없이 실행됐을 때(`'ok'`)만 성공
 * - 없으면(예전 형식) 워커가 성공이라고 했거나 stderr에 경고만 있으면 성공
 */
export function isRunSuccessful(result: {
  success: boolean;
  stderr: string;
  outcome?: RunOutcome;
}): boolean {
  if (result.outcome) return result.outcome === 'ok';
  return result.success || isWarningOnlyStderr(result.stderr);
}

/** 화면·튜터에 넘기는 출력을 MAX_OUTPUT_LENGTH로 자른다 */
export function truncateOutput(output: string): string {
  if (output.length > MAX_OUTPUT_LENGTH) {
    return (
      output.slice(0, MAX_OUTPUT_LENGTH) + '\n\n...출력이 너무 길어서 잘렸어요'
    );
  }
  return output;
}
