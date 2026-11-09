// 결과 쪽지(OutputPanel, P6-06)의 글 다루기. 정답 기준값(expected_output)은 서버에만 있어(§2.3) 여기서는
// 학생 출력·공개 규칙 유형(validation_type)·공개 안내(expected_output_hint)만으로 견줘 볼 거리를 만든다
import type { ValidationType } from '@/lib/quest/validation';

/** 등장 연출을 거는 앞쪽 줄 수 (긴 출력은 나머지를 그냥 보여 줌) */
export const POP_LINES = 12;

/** 출력을 줄로. 마지막 줄바꿈 뒤의 빈 줄은 버린다 */
export function outputLines(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

/** traceback 마지막 줄 (예: "NameError: name 'x' is not defined") */
export function errorSummary(stderr: string): string {
  return outputLines(stderr.trimEnd()).at(-1)?.trim() ?? '';
}

/** 출력이 달랐을 때 무엇을 견줘 볼지 (규칙 유형은 공개 값이라 써도 됨) */
export function mismatchTip(
  type: ValidationType | undefined,
  stdout: string,
): string {
  if (type === 'code_check')
    return '나온 글자는 괜찮아 보여도, 해 볼 일에서 말한 방법으로 썼는지 공책을 살펴봐요.';
  if (!stdout.trim())
    return '아무 글자도 안 나왔어요. print( )로 보여 줘야 여기에 나와요.';
  if (type === 'output_match')
    return '한 글자씩 견줘 봐요. 띄어쓰기·따옴표·느낌표 하나만 달라도 다른 글자예요.';
  if (type === 'contains' || type === 'contains_any')
    return '해 볼 일에서 말한 글자가 나온 글자 안에 들어 있는지 찾아봐요.';
  return '나온 글자와 쓴 방법이 해 볼 일과 맞는지 하나씩 살펴봐요.';
}
