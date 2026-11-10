// 파이썬 오류를 아이 말로 (P6-07). 결과 쪽지 버그버그 옆·이야기 쪽 파이뱀 대사창이 같은 문장을 쓴다.
// LLM을 부르지 않는 결정적 규칙표 — 더 묻고 싶으면 아이가 "파이뱀에게 물어보기"로.
// 랜딩 체험 공책 안내(src/lib/landing/miniPython/messages.ts)는 print 한 줄 전용이라 여기서는 진짜 traceback 문장을 직접 본다
import { errorLineFromStderr } from '@/lib/editor/stderrLine';

export interface ErrorExplanation {
  /** 파이썬 오류 이름 (예: "NameError"). 못 읽으면 null */
  type: string | null;
  /** 학생 코드에서 오류가 난 줄 (1부터) */
  line: number | null;
  /** 1~2문장 쉬운 설명 (줄 번호 포함) */
  text: string;
}

type Rule = [RegExp, string | ((m: RegExpMatchArray) => string)];

/** 오류 이름: 뜻. 위에서부터 처음 맞는 것. 메시지는 Python 3.12+ 문장 기준 */
const RULES: Rule[] = [
  [
    /^SyntaxError: unterminated (triple-quoted )?string/,
    '따옴표를 열고 닫지 않았어요. 글자 앞뒤에 같은 따옴표가 하나씩 있어야 해요.',
  ],
  [
    /^SyntaxError: '([([{])' was never closed/,
    (m) =>
      `여는 괄호 ${m[1]} 를 닫지 않았어요. 짝이 되는 ${CLOSE[m[1]]} 를 붙여 주세요.`,
  ],
  [
    /^SyntaxError: unmatched '([)\]}])'/,
    (m) => `닫는 괄호 ${m[1]} 가 짝 없이 남았어요. 하나를 지워 볼까요?`,
  ],
  [
    /^SyntaxError: closing parenthesis '(.)' does not match opening parenthesis '(.)'/,
    (m) =>
      `${m[2]} 로 열었으면 ${CLOSE[m[2]] ?? m[1]} 로 닫아야 해요. 괄호 짝을 맞춰 봐요.`,
  ],
  [
    /^SyntaxError: Missing parentheses in call to 'print'/,
    'print 뒤에는 괄호가 있어야 해요. 예: print("안녕")',
  ],
  [
    /^SyntaxError: expected ':'/,
    'if·for·while·def 줄 끝에는 쌍점(:)이 있어야 해요.',
  ],
  [
    /^SyntaxError: invalid character '(.)'/,
    (m) =>
      /[“”‘’]/.test(m[1])
        ? `${m[1]} 는 둥근 따옴표라 주문에 못 써요. 키보드의 " 나 ' 로 바꿔 주세요.`
        : `${m[1]} 기호는 주문에 쓸 수 없어요. 지우고 다시 써 볼까요?`,
  ],
  [
    /^SyntaxError: .*Perhaps you forgot a comma/,
    '값 사이에 쉼표(,)가 빠진 것 같아요. 예: print("나이", 10)',
  ],
  [
    /^SyntaxError: .*Maybe you meant '==' /,
    '같은지 견줄 때는 = 하나가 아니라 == 두 개를 써요.',
  ],
  [
    /^IndentationError: expected an indented block/,
    ':(쌍점)으로 끝난 줄 다음 줄은 빈칸 4개만큼 안으로 들여 써야 해요.',
  ],
  [
    /^IndentationError: unexpected indent/,
    '줄 맨 앞에 필요 없는 빈칸이 있어요. 위 줄과 시작 자리를 맞춰 봐요.',
  ],
  [
    /^(IndentationError|TabError): /,
    '줄마다 들여 쓴 빈칸 수가 달라요. 같은 묶음의 줄은 시작 자리를 똑같이 맞춰요.',
  ],
  [
    /^SyntaxError: /,
    '주문 모양이 조금 이상해요. 괄호·따옴표·쌍점(:)이 빠지지 않았는지 살펴봐요.',
  ],
  [
    /^NameError: name '([^']+)' is not defined(?:\. Did you mean: '([^']+)')?/,
    (m) =>
      m[2]
        ? `${m[1]} 라는 이름은 처음 봐요. 혹시 ${m[2]} 를 쓰려던 걸까요?`
        : `${m[1]} 라는 이름은 처음 봐요. 철자가 맞는지, 글자라면 따옴표로 감쌌는지 살펴봐요.`,
  ],
  [
    /^TypeError: can only concatenate str \(not "(int|float)"\) to str/,
    '글자와 숫자는 + 로 바로 붙일 수 없어요. 숫자를 str( )로 감싸거나 쉼표(,)로 나눠 print 해 봐요.',
  ],
  [
    /^TypeError: unsupported operand type\(s\) for \+: '(int|float)' and 'str'/,
    '숫자와 글자는 + 로 더할 수 없어요. 글자를 int( )로 숫자로 바꾸거나, 숫자를 str( )로 글자로 바꿔 봐요.',
  ],
  [
    /^TypeError: /,
    '서로 섞어 쓸 수 없는 값끼리 셈을 했어요. 숫자인지 글자인지 하나씩 확인해 봐요.',
  ],
  [
    /^ZeroDivisionError: /,
    '0으로는 나눌 수 없어요. 나누는 수가 0이 되지 않게 해 봐요.',
  ],
  [
    /^ValueError: invalid literal for int\(\)/,
    '숫자가 아닌 글자를 int( )로 바꾸려고 했어요. 숫자만 들어 있는지 확인해 봐요.',
  ],
  [
    /^IndexError: /,
    '목록에 없는 번호를 찾았어요. 번호는 0부터 시작해서 개수보다 하나 작은 데서 끝나요.',
  ],
  [
    /^KeyError: (.+)/,
    (m) => `사전에 ${m[1]} 라는 열쇠가 없어요. 열쇠 이름을 다시 확인해 봐요.`,
  ],
  [
    /^AttributeError: /,
    '그 값은 그런 기능이 없어요. 점(.) 뒤에 쓴 이름의 철자를 확인해 봐요.',
  ],
  [
    /^RecursionError: /,
    '함수가 자기 자신을 끝없이 불렀어요. 멈추는 조건이 있는지 살펴봐요.',
  ],
];

const CLOSE: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

const FALLBACK =
  '주문을 돌리다가 막혔어요. 오류 메시지 전체를 열어 보거나 파이뱀에게 물어봐요.';

/** traceback 마지막 줄 (오류 이름: 문장) */
function lastLine(stderr: string): string {
  return stderr.trimEnd().split('\n').at(-1)?.trim() ?? '';
}

export function explainError(stderr: string): ErrorExplanation {
  const last = lastLine(stderr);
  const line = errorLineFromStderr(stderr);
  const type = /^([A-Za-z]+(?:Error|Exception)|KeyboardInterrupt)\b/.exec(
    last,
  )?.[1];
  let body = FALLBACK;
  for (const [re, say] of RULES) {
    const m = last.match(re);
    if (m) {
      body = typeof say === 'string' ? say : say(m);
      break;
    }
  }
  return {
    type: type ?? null,
    line,
    text: line ? `${line}번째 줄을 봐요. ${body}` : body,
  };
}

/** 버그버그 한마디 (장난스럽게, 설명은 파이뱀 몫) */
export function bugbugTaunt(line: number | null): string {
  return line ? `히히, ${line}번째 줄에 숨었지!` : '히히, 버그 찾았다!';
}
