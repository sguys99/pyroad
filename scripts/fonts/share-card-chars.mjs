// 공유 카드 폰트 글자 범위 (P2-19, P0-10 §4.3, §12-Q14). build-fonts.mjs(서브셋)·check.mjs·테스트가 같이 쓴다.
//
// - KS X 1001 완성형 한글 2,350자: EUC-KR 한글 영역(0xB0A1~0xC8FE, 25행 × 94칸)을 디코딩해 얻는다.
//   닉네임 규칙(§12-Q14: 완성형 2,350자 + 영문·숫자)과 같은 집합이다
// - 현대 한글 11,172자: 대체 폰트(pyRoad Sans Bold)만 전부 담는다. 콘텐츠(스테이지·업적 이름)에 드문 글자가 와도 두부가 되지 않게

/** KS X 1001 완성형 한글 2,350자 (코드포인트 순) */
export function ksX1001Hangul() {
  const dec = new TextDecoder('euc-kr');
  const out = [];
  for (let row = 0xb0; row <= 0xc8; row++) {
    for (let cell = 0xa1; cell <= 0xfe; cell++) {
      out.push(dec.decode(new Uint8Array([row, cell])));
    }
  }
  return out;
}

/** 현대 한글 음절 11,172자 */
export function allHangul() {
  const out = [];
  for (let c = 0xac00; c <= 0xd7a3; c++) out.push(String.fromCodePoint(c));
  return out;
}

/** 출력 가능한 ASCII (영문·숫자·문장부호·공백) */
export const ASCII = Array.from({ length: 0x7f - 0x20 }, (_, i) =>
  String.fromCodePoint(0x20 + i),
).join('');

/** 현대 호환 자모 ㄱ~ㅎ·ㅏ~ㅣ (U+3131~3163). 옛 자모(ㅥ~ㆎ)는 원본 글꼴에 없고 닉네임에도 받지 않는다 */
export const COMPAT_JAMO = Array.from({ length: 0x3164 - 0x3131 }, (_, i) =>
  String.fromCodePoint(0x3131 + i),
).join('');

/** 카드에 쓰는 기호. 별·메달 같은 그림은 글자가 아니라 자체 SVG 아이콘이다 */
export const CARD_SYMBOLS = '·×…‘’“”→←↑↓~–—・「」『』 ';

/** 닉네임 허용 글자 (§12-Q14): 완성형 2,350자 + 영문 대소문자 + 숫자 */
export function nicknameChars() {
  const alnum =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return [...ksX1001Hangul(), ...alnum];
}

/** 서브셋 글자: `ks2350` = 완성형 2,350자, `full` = 11,172자 (둘 다 ASCII·호환 자모·기호 포함) */
export function shareCardText(range) {
  const hangul = range === 'full' ? allHangul() : ksX1001Hangul();
  return ASCII + COMPAT_JAMO + CARD_SYMBOLS + hangul.join('');
}
