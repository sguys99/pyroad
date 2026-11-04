/**
 * 금칙어 비교용 정규화 (P1-18).
 *
 * 아이들이 필터를 피하려고 흔히 쓰는 방법을 같은 모양으로 되돌린다.
 * - 띄어쓰기·특수문자·숫자·영문 끼워 넣기: "시 발", "시.발", "시1발", "시x발" → "시발"
 * - 전각·반각 문자: NFKC ("ｓｈｉｔ", 반각 자모)
 * - 자모 풀어 쓰기: "ㅅㅣㅂㅏㄹ" → "시발"
 * - 된소리·비슷한 모음: "씨빨" → "시발", "개쌔끼" → "게세기" (ㅐ/ㅔ, ㅒ/ㅖ 같게)
 * - 늘여 쓰기: "시이이발" → "시발", "조오온나" → "존나"
 *
 * 결과는 비교용일 뿐 화면에 보여 주지 않는다. 금칙어 목록(data/banned-words.json)도 같은 함수로 정규화해서 비교한다.
 */

const SYLLABLE_BASE = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
const JUNG_COUNT = 21;
const JONG_COUNT = 28;

// 호환 자모(ㄱ U+3131 …)의 초성·모음·종성 순서
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ' ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

// 된소리 → 예사소리, 비슷하게 들리는 모음 → 하나로 (비교용)
const PLAIN_CONSONANT: Record<string, string> = {
  ㄲ: 'ㄱ',
  ㄸ: 'ㄷ',
  ㅃ: 'ㅂ',
  ㅆ: 'ㅅ',
  ㅉ: 'ㅈ',
};
const SIMILAR_VOWEL: Record<string, string> = { ㅐ: 'ㅔ', ㅒ: 'ㅖ' };

// 첫가끝 자모(U+1100 …, NFKC 결과에 남을 수 있음) → 호환 자모
const CONJOINING_CHO = 0x1100;
const CONJOINING_JUNG = 0x1161;
const CONJOINING_JONG = 0x11a8;

export function isSyllable(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= SYLLABLE_BASE && c <= SYLLABLE_LAST;
}

export function isCompatJamo(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x3131 && c <= 0x318e;
}

const isVowelJamo = (ch: string) => JUNG.includes(ch);

interface Parts {
  cho: string;
  jung: string;
  jong: string; // '' = 받침 없음
}

export function decompose(ch: string): Parts | null {
  if (!isSyllable(ch)) return null;
  const idx = (ch.codePointAt(0) ?? 0) - SYLLABLE_BASE;
  const jongIdx = idx % JONG_COUNT;
  return {
    cho: CHO[Math.floor(idx / (JUNG_COUNT * JONG_COUNT))],
    jung: JUNG[Math.floor(idx / JONG_COUNT) % JUNG_COUNT],
    jong: jongIdx === 0 ? '' : JONG[jongIdx],
  };
}

function compose({ cho, jung, jong }: Parts): string {
  const l = CHO.indexOf(cho);
  const v = JUNG.indexOf(jung);
  const t = jong ? JONG.indexOf(jong) : 0;
  if (l < 0 || v < 0 || t < 0) return cho + jung + jong;
  return String.fromCodePoint(
    SYLLABLE_BASE + (l * JUNG_COUNT + v) * JONG_COUNT + t,
  );
}

/** 음절의 초성 (호환 자모). 음절이 아니면 그대로 */
export function choseongOf(ch: string): string {
  return decompose(ch)?.cho ?? ch;
}

function conjoiningToCompat(ch: string): string {
  const c = ch.codePointAt(0) ?? 0;
  if (c >= CONJOINING_CHO && c < CONJOINING_CHO + CHO.length)
    return CHO[c - CONJOINING_CHO];
  if (c >= CONJOINING_JUNG && c < CONJOINING_JUNG + JUNG.length)
    return JUNG[c - CONJOINING_JUNG];
  if (c >= CONJOINING_JONG && c < CONJOINING_JONG + JONG.length - 1)
    return JONG[c - CONJOINING_JONG + 1];
  return ch;
}

// 보이지 않는 문자: soft hyphen, 한글 채움 문자(U+115F·U+1160·U+3164·U+FFA0), 폭 없는 공백·방향 표시(U+200B~U+200F),
// word joiner 등(U+2060~U+2064), BOM. 글자 사이에 끼워 금칙어를 피하는 데 쓰임
const INVISIBLE_CODES = [
  0xad, 0x115f, 0x1160, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0x2061,
  0x2062, 0x2063, 0x2064, 0x3164, 0xfeff, 0xffa0,
];
const INVISIBLE = new RegExp(
  `[${String.fromCharCode(...INVISIBLE_CODES)}]`,
  'g',
);

/**
 * 유니코드 정리: 호환 자모는 그대로 두고(NFKC 는 이를 첫가끝 자모로 바꿈) 나머지는 NFKC, 남은 첫가끝 자모는 호환 자모로.
 * 소문자로 바꾸고 보이지 않는 문자(폭 없는 공백, 한글 채움 문자 등)는 지운다.
 */
export function unicodeFold(text: string): string {
  const folded = Array.from(text, (ch) =>
    isCompatJamo(ch) ? ch : ch.normalize('NFKC'),
  )
    .join('')
    .normalize('NFC');
  return Array.from(folded, conjoiningToCompat)
    .join('')
    .replace(INVISIBLE, '')
    .toLowerCase();
}

/** 공백·보이지 않는 문자(폭 없는 공백, 한글 채움 문자 등)를 빼고도 남는 글자가 있는가 (빈 글 검사) */
export function hasVisibleText(text: string): boolean {
  return unicodeFold(text).replace(/\s/g, '').length > 0;
}

/**
 * 한글 비교 단위 하나. token 은 원문을 공백으로 나눈 단어 번호, start·end 는 그 단어의 첫·마지막 한글인지.
 * 공백을 건너 이어지는 금칙어는 단어 경계에서 시작하고 끝날 때만 인정한다 (filter.ts):
 * "시 발"은 잡고, "가자 위로"(자위)·"수박씨 발라"(씨발) 같은 단어 사이 우연한 이어짐은 넘긴다.
 */
export interface KoreanUnit {
  ch: string;
  token: number;
  start: boolean;
  end: boolean;
}

/** 이어 쓴 자모를 음절로: ㅅ+ㅣ → 시, ㅂ+ㅏ+ㄹ(다음이 모음이 아니면 받침) → 발 */
function composeJamoRuns(units: KoreanUnit[]): KoreanUnit[] {
  const out: KoreanUnit[] = [];
  for (let i = 0; i < units.length; i++) {
    const c = units[i];
    const v = units[i + 1];
    if (CHO.includes(c.ch) && v && isVowelJamo(v.ch)) {
      const t = units[i + 2];
      const afterT = units[i + 3];
      const takeJong =
        !!t &&
        JONG.slice(1).includes(t.ch) &&
        !(afterT && isVowelJamo(afterT.ch));
      const last = takeJong ? t : v;
      out.push({
        ch: compose({ cho: c.ch, jung: v.ch, jong: takeJong ? t.ch : '' }),
        token: c.token,
        start: c.start,
        end: last.end,
      });
      i += takeJong ? 2 : 1;
    } else {
      out.push(c);
    }
  }
  return out;
}

function plainSyllable(ch: string): string {
  const p = decompose(ch);
  if (!p) return PLAIN_CONSONANT[ch] ?? ch;
  return compose({
    cho: PLAIN_CONSONANT[p.cho] ?? p.cho,
    jung: SIMILAR_VOWEL[p.jung] ?? p.jung,
    jong: p.jong ? (PLAIN_CONSONANT[p.jong] ?? p.jong) : '',
  });
}

/** 늘여 쓰기 접기: 앞 음절과 모음이 같은 'ㅇ' 음절은 지우고, 받침이 있으면 앞 음절(받침 없을 때)로 옮김 */
function collapseElongation(units: KoreanUnit[]): KoreanUnit[] {
  const out: KoreanUnit[] = [];
  for (const u of units) {
    const p = decompose(u.ch);
    const prevUnit = out[out.length - 1];
    const prev = prevUnit ? decompose(prevUnit.ch) : null;
    if (
      p &&
      prev &&
      p.cho === 'ㅇ' &&
      p.jung === prev.jung &&
      (!p.jong || !prev.jong)
    ) {
      const merged: KoreanUnit = {
        ...prevUnit,
        ch: p.jong ? compose({ ...prev, jong: p.jong }) : prevUnit.ch,
        end: prevUnit.token === u.token ? prevUnit.end || u.end : prevUnit.end,
      };
      out[out.length - 1] = merged;
      continue;
    }
    out.push(u);
  }
  return out;
}

/**
 * 한글 비교 단위 목록: 한글(음절·호환 자모)만 남기고(띄어쓰기·숫자·영문·기호는 사라짐) 자모 조합 → 된소리·모음 통일 → 늘여 쓰기 접기.
 * "시 발"·"시1발"·"ㅅㅣ발"이 모두 "시발"과 같아진다.
 */
export function koreanUnits(text: string): KoreanUnit[] {
  const units: KoreanUnit[] = [];
  unicodeFold(text)
    .split(/\s+/)
    .forEach((word, token) => {
      const chars = Array.from(word).filter(
        (ch) => isSyllable(ch) || isCompatJamo(ch),
      );
      chars.forEach((ch, i) =>
        units.push({ ch, token, start: i === 0, end: i === chars.length - 1 }),
      );
    });
  const composed = composeJamoRuns(units).map((u) => ({
    ...u,
    ch: plainSyllable(u.ch),
  }));
  return collapseElongation(composed);
}

/** koreanUnits 를 문자열로 (금칙어 목록 정규화·테스트용) */
export function compactKorean(text: string): string {
  return koreanUnits(text)
    .map((u) => u.ch)
    .join('');
}

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

/**
 * 영문 비교용 토큰: 공백으로 나눈 단어마다 숫자·기호 치환(0→o, $→s …) 뒤 영문자만 남김.
 * 한 글자씩 띄어 쓴 단어("f u c k")는 하나로 붙인다. 문장 전체를 붙이면 "has extra" → "hasextra" 같은 오탐이 생겨 단어 단위로 본다.
 */
export function englishTokens(text: string): string[] {
  const words = unicodeFold(text)
    .split(/\s+/)
    .map((w) =>
      Array.from(w, (ch) => LEET[ch] ?? ch)
        .join('')
        .replace(/[^a-z]/g, ''),
    )
    .filter(Boolean);
  const tokens: string[] = [];
  let run = '';
  for (const w of words) {
    if (w.length === 1) {
      run += w;
      continue;
    }
    if (run) tokens.push(run);
    run = '';
    tokens.push(w);
  }
  if (run) tokens.push(run);
  return tokens;
}

export const __test = { composeJamoRuns, collapseElongation, plainSyllable };
