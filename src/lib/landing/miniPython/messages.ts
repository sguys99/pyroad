import type { MiniError, MiniErrorKind } from './errors';

/**
 * 아이용 오류 안내 (P4-03, 시안 parsePrint 문구 바탕). 버그버그가 말풍선으로 말하고 결과 칸에도 나온다.
 * 무엇이 틀렸는지 + 어떻게 고치는지를 한두 문장으로. 화면 글자라 랜딩 글꼴 서브셋에 들어간다.
 */
const MESSAGES: Record<MiniErrorKind, string | ((d: string) => string)> = {
  empty: '공책이 비어 있어요. print("안녕!")을 써 볼까요?',
  unterminated_string:
    '따옴표를 열었으면 닫아 주세요. 글자 앞뒤에 " 가 하나씩 있어야 해요.',
  unclosed_paren: '닫는 괄호 ) 가 빠졌어요. 주문 맨 끝에 ) 를 붙여 주세요.',
  unmatched_paren: '닫는 괄호 ) 가 너무 많아요. 하나를 지워 볼까요?',
  print_no_parens: 'print 뒤에는 괄호가 있어야 해요. 예: print("안녕!")',
  print_typo: (d) =>
    `print 철자가 조금 달라요. ${d} 대신 print 라고 써 주세요.`,
  print_case:
    '파이썬은 대문자와 소문자를 다르게 봐요. 모두 소문자로 print 라고 써 주세요.',
  korean_keyboard:
    '한글 자판으로 쳐졌어요. 한/영 키를 눌러 영어로 바꾼 뒤 print 를 써 봐요.',
  unknown_function: (d) =>
    `${d} 라는 주문은 몰라요. 화면에 글자를 보이려면 print 를 써요.`,
  unquoted_text: (d) => `글자는 따옴표로 감싸야 해요. 예: print("${d}")`,
  missing_comma: '값 사이에 쉼표(,)가 빠졌어요. 예: print("나이", 10)',
  invalid_char: (d) =>
    d === '×' || d === '÷'
      ? `${d} 기호는 주문에 쓸 수 없어요. 곱하기는 *, 나누기는 / 로 써요.`
      : `${d} 기호는 주문에 쓸 수 없어요. 지우고 다시 써 볼까요?`,
  indent: '줄 맨 앞에 빈칸이 있어요. 빈칸을 지워 볼까요?',
  syntax: '주문 모양이 조금 이상해요. print("안녕!")을 보고 다시 써 볼까요?',
  zero_division: '0으로는 나눌 수 없어요. 다른 숫자로 나눠 볼까요?',
  str_plus_number:
    '글자와 숫자는 + 로 붙일 수 없어요. 숫자도 따옴표로 감싸 볼까요? 예: "나이: " + "10"',
  str_times: '글자는 정수만큼만 곱할 수 있어요. 예: "하" * 3',
  type: '글자에는 그 셈을 쓸 수 없어요. 숫자끼리 셈해 볼까요?',
  unsupported:
    '이 주문은 체험 공책에서는 못 써요. 로그인하면 진짜 파이썬으로 해 볼 수 있어요!',
  too_long: '주문이나 결과가 너무 길어요. 조금 줄여 볼까요?',
  too_big: '숫자가 너무 커요. 조금 작은 숫자로 해 볼까요?',
};

/** 안내에 끼워 넣는 조각은 짧게 (긴 이름이 말풍선을 덮지 않게) */
function short(d: string | undefined): string {
  const chars = [...(d ?? '')];
  return chars.length > 12 ? `${chars.slice(0, 12).join('')}…` : chars.join('');
}

export function explain(error: MiniError): string {
  const m = MESSAGES[error.kind];
  return typeof m === 'function' ? m(short(error.detail)) : m;
}

/** 결과가 비었을 때 (식만 쓰고 print가 없음) */
export const NO_PRINT_HINT =
  '결과가 비어 있어요. 화면에 보이려면 print( ) 로 감싸 주세요.';
