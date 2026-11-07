import { isKsX1001Hangul } from './ksX1001';

/**
 * 닉네임 글자·길이·예약어 규칙 (§2.2 필드 규칙, §12-Q14, P3-11·P3-18).
 *
 * 금칙어 검사가 없는 가벼운 규칙만 둡니다(금칙어 목록을 화면 번들에 넣지 않고 입력 중 바로 안내할 때).
 * 저장 전 최종 검사는 금칙어까지 보는 `validateNickname`(`./nickname`)을 서버에서 다시 부릅니다.
 * 서버·클라이언트 어디서나 import할 수 있는 순수 모듈입니다.
 *
 * 규칙 (DB 00012 `users_nickname_length`·`users_nickname_chars`·`users_nickname_lower_key`와 같음)
 * - 앞뒤 공백을 지우고 NFC로 맞춘 뒤 검사합니다. 자모로 풀린(NFD) 입력도 완성형으로 돌아옵니다.
 * - 2~10자. 글자 수는 코드포인트 수(= PostgreSQL `char_length`). 허용 글자는 모두 BMP 한 글자라 화면 글자 수와 같습니다.
 * - 완성형 한글 KS X 1001 2,350자 + 영문 대소문자 + 숫자만. 띄어쓰기·기호·이모지·옛한글·자모만 쓴 글자·제어 문자는 받지 않습니다.
 *   띄어쓰기를 받지 않는 이유: DB CHECK가 이미 막고 있고, "파이 뱀"처럼 공백으로 예약어·중복을 피해 가거나
 *   공백 개수만 다른 닮은 이름이 생기는 것을 막습니다. 공유 카드·HUD처럼 좁은 자리에서 줄바꿈도 생기지 않습니다.
 * - 예약어: 운영자·캐릭터·자리표시자("모험가1234")로 보일 수 있는 이름. 영문은 대소문자를 가리지 않습니다.
 */

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;

export type NicknameRuleError =
  | 'empty'
  | 'space'
  | 'invisible_char'
  | 'jamo'
  | 'unsupported_hangul'
  | 'invalid_char'
  | 'too_short'
  | 'too_long'
  | 'placeholder'
  | 'reserved';

export type NicknameError = NicknameRuleError | 'banned';

export type NicknameCheck =
  | {
      ok: true;
      /** 저장할 값 (NFC + 앞뒤 공백 제거, 대소문자는 입력 그대로) */
      nickname: string;
      /** 중복 확인 키 (`nicknameKey`) */
      key: string;
    }
  | {
      ok: false;
      reason: NicknameError;
      /** 아이에게 보여 줄 안내 문구 */
      message: string;
      /** 문제가 된 글자 (보이는 글자일 때만. 공백·보이지 않는 글자는 없음) */
      char?: string;
      /** 정규화한 입력 (입력칸 표시용) */
      nickname: string;
    };

const ASCII_ALNUM = /^[A-Za-z0-9]$/;
const COMPAT_JAMO = /^[\u3131-\u318e]$/;
const CONJOINING_JAMO = /^[\u1100-\u11ff\ua960-\ua97f\ud7b0-\ud7ff]+$/;
const HANGUL_SYLLABLE = /^[가-힣]$/;
/** 보이지 않는 글자: 제어 문자, 폭 없는 공백·방향 표시, 한글 채움 문자, BOM 등 (Cc·Cf + 한글 채움) */
const INVISIBLE = /^[\p{Cc}\p{Cf}\u115f\u1160\u3164\uffa0]+$/u;

/**
 * 닉네임 정규화: NFC + 앞뒤 공백 제거. 저장값과 검사 대상은 언제나 이 결과입니다.
 * (안쪽 공백은 지우지 않고 검사에서 막습니다. 아이가 고친 결과를 직접 보게)
 */
export function normalizeNickname(raw: string): string {
  return raw.normalize('NFC').trim();
}

/**
 * 중복 확인 키. **DB 유일 인덱스 `users_nickname_lower_key ON users (lower(nickname))`(00012)와 같은 규칙**입니다.
 *   key = ASCII 대문자 A-Z → 소문자 (NFC + 앞뒤 공백 제거 뒤)
 * 저장되는 닉네임은 이미 NFC·공백 없음·[KS X 1001 한글 + A-Za-z0-9]만이므로, 여기에 대해 PostgreSQL `lower()`는
 * 영문 대문자만 바꾸고 한글·숫자는 그대로 둡니다(로캘과 무관). 그래서 `nicknameKey(n) === lower(n)`이 성립합니다.
 * 이후 마이그레이션에서 키를 따로 저장·비교한다면 `lower(normalize(nickname, NFC))`로 같은 값을 만들면 됩니다.
 */
export function nicknameKey(nickname: string): string {
  return normalizeNickname(nickname).replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** 자리표시자 "모험가NNNN"(00014·00018 user_profiles_public)과 헷갈리는 이름. "모험가"만 쓴 것도 막음 */
const PLACEHOLDER = /^모험가\d*$/;

/**
 * 운영진으로 보일 수 있는 말. 한글은 들어 있기만 해도("운영자짱") 막고,
 * 영문은 뒤에 숫자만 붙은 경우까지(admin, Admin7) 막습니다(영문 단어 안의 우연한 포함, 예: badminton은 허용).
 */
const STAFF_KOREAN = ['운영자', '운영진', '관리자'];
const STAFF_ASCII = ['admin', 'administrator', 'moderator', 'operator'];

/**
 * 서비스·캐릭터 이름 (키가 정확히 같을 때만). 친구 캐릭터인 척하는 것만 막고 "파이뱀팬", "Pyroad01"은 허용합니다.
 * 캐릭터 이름은 src/components/characters 의 마스코트(파이뱀·버그버그·별똥이)와 맞춥니다.
 */
const RESERVED_EXACT = new Set([
  '파이로드',
  'pyroad',
  '파이뱀',
  'pybaem',
  '버그버그',
  'bugbug',
  '별똥이',
  '선생님',
  '시스템',
  'system',
  'root',
  'staff',
]);

/** 예약어인가 (자리표시자 제외). 인자는 `nicknameKey` 결과 */
function isReservedKey(key: string): boolean {
  if (RESERVED_EXACT.has(key)) return true;
  if (STAFF_KOREAN.some((w) => key.includes(w))) return true;
  return STAFF_ASCII.includes(key.replace(/\d+$/, ''));
}

/** 글자 하나(그래핌)를 보이는 그대로 나누기. 가족 이모지처럼 여러 글자로 된 이모지가 한 덩어리로 안내되게 */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

function isAllowedChar(ch: string): boolean {
  return ASCII_ALNUM.test(ch) || isKsX1001Hangul(ch);
}

type CharProblem = {
  reason: Extract<
    NicknameRuleError,
    'space' | 'invisible_char' | 'jamo' | 'unsupported_hangul' | 'invalid_char'
  >;
  char?: string;
};

function findCharProblem(nickname: string): CharProblem | null {
  for (const g of graphemes(nickname)) {
    if (g.length === 1 && isAllowedChar(g)) continue;
    if (/\s/u.test(g)) return { reason: 'space' };
    if (INVISIBLE.test(g)) return { reason: 'invisible_char' };
    if (COMPAT_JAMO.test(g) || CONJOINING_JAMO.test(g)) {
      return { reason: 'jamo', char: g };
    }
    if (HANGUL_SYLLABLE.test(g))
      return { reason: 'unsupported_hangul', char: g };
    // 허용 글자 뒤에 보이지 않는 글자가 붙어 한 그래핌이 된 경우("가" + U+200D 등).
    // 이모지 묶음(이모지 + U+200D + 이모지)은 보이는 글자가 남으므로 invalid_char
    const visible = Array.from(g).filter((c) => !INVISIBLE.test(c));
    if (visible.every(isAllowedChar)) return { reason: 'invisible_char' };
    return { reason: 'invalid_char', char: g };
  }
  return null;
}

/** 안내 문구. 쉬운 말로, 무엇을 고치면 되는지 함께 알려 줍니다 */
export function nicknameMessage(reason: NicknameError, char?: string): string {
  switch (reason) {
    case 'empty':
      return '닉네임을 써 주세요.';
    case 'space':
      return '띄어쓰기 없이 붙여서 써 주세요.';
    case 'invisible_char':
      return '눈에 안 보이는 글자가 들어 있어요. 지우고 다시 써 볼까요?';
    case 'jamo':
      return char
        ? `'${char}'처럼 자음이나 모음만 쓸 수는 없어요. 완성된 글자로 써 주세요.`
        : '자음이나 모음만 쓸 수는 없어요. 완성된 글자로 써 주세요.';
    case 'unsupported_hangul':
      return char
        ? `'${char}' 글자는 닉네임에 쓸 수 없어요. 다른 글자로 바꿔 볼까요?`
        : '닉네임에 쓸 수 없는 글자가 있어요. 다른 글자로 바꿔 볼까요?';
    case 'invalid_char':
      return char
        ? `'${char}' 글자는 쓸 수 없어요. 한글, 영어, 숫자만 쓸 수 있어요.`
        : '한글, 영어, 숫자만 쓸 수 있어요.';
    case 'too_short':
      return `닉네임은 ${NICKNAME_MIN_LENGTH}글자 이상으로 써 주세요.`;
    case 'too_long':
      return `닉네임은 ${NICKNAME_MAX_LENGTH}글자까지 쓸 수 있어요.`;
    case 'placeholder':
      return "'모험가'와 숫자로 된 이름은 아직 닉네임을 정하지 않은 친구의 이름이라 쓸 수 없어요.";
    case 'reserved':
      return '운영자나 파이로드 친구 캐릭터로 보일 수 있는 이름은 쓸 수 없어요.';
    case 'banned':
      return '친구가 속상하거나 닉네임에 어울리지 않는 말이 들어 있어요. 다른 닉네임을 골라 볼까요?';
  }
}

function fail(
  nickname: string,
  reason: NicknameError,
  char?: string,
): Extract<NicknameCheck, { ok: false }> {
  return {
    ok: false,
    reason,
    message: nicknameMessage(reason, char),
    ...(char === undefined ? {} : { char }),
    nickname,
  };
}

/**
 * 글자·길이·예약어 검사 (금칙어 제외). 순서: 빈 값 → 글자 → 길이 → 자리표시자 → 예약어.
 * 글자를 길이보다 먼저 보는 이유: "ㄱ"·"😀" 같은 입력에 "2글자 이상"보다 "그 글자는 못 써요"가 더 도움이 되기 때문.
 */
export function checkNicknameRules(raw: string): NicknameCheck {
  const nickname = normalizeNickname(raw);
  if (nickname.length === 0) return fail(nickname, 'empty');

  const problem = findCharProblem(nickname);
  if (problem) return fail(nickname, problem.reason, problem.char);

  const length = Array.from(nickname).length;
  if (length < NICKNAME_MIN_LENGTH) return fail(nickname, 'too_short');
  if (length > NICKNAME_MAX_LENGTH) return fail(nickname, 'too_long');

  const key = nicknameKey(nickname);
  if (PLACEHOLDER.test(key)) return fail(nickname, 'placeholder');
  if (isReservedKey(key)) return fail(nickname, 'reserved');

  return { ok: true, nickname, key };
}
