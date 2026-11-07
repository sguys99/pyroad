import bannedWords from './data/banned-words.json';
import personalInfoPatterns from './data/personal-info-patterns.json';
import {
  choseongOf,
  compactKorean,
  englishTokens,
  isCompatJamo,
  isSyllable,
  koreanUnits,
  unicodeFold,
  type KoreanUnit,
} from './normalize';

/**
 * 게시판 금칙어·개인정보 필터 (P1-18, 서버 전용 규칙).
 *
 * 목록은 코드가 아니라 데이터 파일(data/*.json)에 있습니다. 걸리면 저장하지 않고 아이용 안내(MODERATION_MESSAGES)를 돌려줍니다.
 * 어떤 단어가 걸렸는지는 화면에 보여 주지 않습니다(우회 방법을 가르치지 않게). ruleId 는 테스트·운영 분석용입니다.
 * 닉네임(P3-11)도 같은 함수를 쓸 수 있습니다.
 */

export type ModerationCategory =
  | 'profanity'
  | 'insult'
  | 'sexual'
  | 'personal_info'
  | 'contact';

export type ModerationResult =
  | { ok: true }
  | { ok: false; category: ModerationCategory; ruleId: string };

/** 아이에게 보여 줄 안내. 무엇이 문제인지는 알려 주되 어떤 단어인지는 말하지 않음 */
export const MODERATION_MESSAGES: Record<ModerationCategory, string> = {
  profanity: '친구가 속상할 수 있는 말이 들어 있어요. 다른 말로 바꿔 볼까요?',
  insult: '친구가 속상할 수 있는 말이 들어 있어요. 다른 말로 바꿔 볼까요?',
  sexual: '게시판에 어울리지 않는 말이 들어 있어요. 다른 말로 바꿔 볼까요?',
  personal_info:
    '전화번호, 주소, 이메일, 학교 같은 개인정보는 올릴 수 없어요. 나를 지키기 위해 빼고 써 볼까요?',
  contact:
    '게시판 밖에서 연락하거나 만나자는 말, 링크는 올릴 수 없어요. 다른 말로 바꿔 볼까요?',
};

type WordCategory = Extract<
  ModerationCategory,
  'profanity' | 'insult' | 'sexual'
>;

interface WordRule {
  category: WordCategory;
  /** 정규화한 음절 목록 */
  chars: string[];
  /** 정규화 전 대표형 (ruleId) */
  source: string;
}

interface PatternRule {
  id: string;
  category: ModerationCategory;
  regex: RegExp;
}

function wordRules(
  groups: Partial<Record<string, string[]>>,
  keepTense = false,
): WordRule[] {
  return Object.entries(groups).flatMap(([category, words]) =>
    (words ?? []).map((source) => ({
      category: category as WordCategory,
      chars: Array.from(compactKorean(source, { keepTense })),
      source,
    })),
  );
}

const KOREAN_WORDS = wordRules(bannedWords.words);
/**
 * 된소리를 접지 않고 비교하는 금칙어 (data `tense`). 접으면 일상어와 같아지는 말:
 * 찐따 → "진다"(가진다·이긴다), 씹년 → "십년", 씹새 → "십세(기)", 좆 ← "쫒아가"(쫓아가 오타), 짱깨 → "시장게임", 딸딸이 → "달달이".
 * 띄어쓰기·숫자·자모 풀어 쓰기·초성 섞기·늘여 쓰기·ㅐ/ㅔ 우회는 그대로 잡고, 된소리를 예사소리로 바꾼 우회만 놓아 줍니다.
 */
const TENSE_WORDS = wordRules(bannedWords.tense, true);
const CHOSEONG_WORDS = wordRules(bannedWords.choseong);
const ALLOW_WORDS = bannedWords.allow.map((w) => Array.from(compactKorean(w)));
const ALLOW_WORDS_TENSE = bannedWords.allow.map((w) =>
  Array.from(compactKorean(w, { keepTense: true })),
);
const ENGLISH_SUBSTRING = Object.entries(bannedWords.english.substring).flatMap(
  ([category, words]) =>
    words.map((w) => ({ category: category as WordCategory, word: w })),
);
const ENGLISH_EXACT = Object.entries(bannedWords.english.exact).flatMap(
  ([category, words]) =>
    words.map((w) => ({ category: category as WordCategory, word: w })),
);
const PATTERNS: PatternRule[] = personalInfoPatterns.patterns.map((p) => ({
  id: p.id,
  category: p.category as ModerationCategory,
  regex: new RegExp(p.pattern, 'u'),
}));

/** text[i] 가 금칙어 글자 w 와 같은가. mixed 면 초성만 쓴 자모도 같은 것으로 봄 ("ㅅ발") */
function charMatches(
  textCh: string,
  wordCh: string,
  mixed: boolean,
): 'exact' | 'jamo' | null {
  if (textCh === wordCh) return isSyllable(textCh) ? 'exact' : 'jamo';
  if (
    mixed &&
    isCompatJamo(textCh) &&
    isSyllable(wordCh) &&
    choseongOf(wordCh) === textCh
  ) {
    return 'jamo';
  }
  return null;
}

/**
 * 단위 목록에서 금칙어 찾기.
 * - 한 단어(공백 사이) 안이면 그대로 인정
 * - 공백을 건너 이어지면 첫 글자가 단어의 시작, 끝 글자가 단어의 끝일 때만 인정 ("시 발" O, "가자 위로" X)
 * - mixed(음절 금칙어): 초성 자모를 섞어 쓴 것도 인정하되 음절이 하나 이상 그대로 있어야 함
 *   (초성만으로 쓴 줄임말은 choseong 목록으로만 — "ㄱㅅ"(감사) 같은 오탐 방지)
 */
function findWord(
  units: KoreanUnit[],
  blocked: boolean[],
  rules: WordRule[],
  mixed: boolean,
) {
  for (const rule of rules) {
    const n = rule.chars.length;
    for (let i = 0; i + n <= units.length; i++) {
      let exact = 0;
      let ok = true;
      for (let k = 0; k < n; k++) {
        const m = blocked[i + k]
          ? null
          : charMatches(units[i + k].ch, rule.chars[k], mixed);
        if (!m) {
          ok = false;
          break;
        }
        if (m === 'exact') exact++;
      }
      if (!ok || (mixed && exact === 0)) continue;
      const first = units[i];
      const last = units[i + n - 1];
      if (first.token !== last.token && !(first.start && last.end)) continue;
      return rule;
    }
  }
  return null;
}

/** 허용 단어(시발점 등)가 차지한 자리를 표시해서 금칙어 비교에서 뺌 */
function allowMask(units: KoreanUnit[], allowWords: string[][]): boolean[] {
  const blocked = new Array<boolean>(units.length).fill(false);
  for (const allow of allowWords) {
    for (let i = 0; i + allow.length <= units.length; i++) {
      if (allow.every((ch, k) => units[i + k].ch === ch)) {
        for (let k = 0; k < allow.length; k++) blocked[i + k] = true;
      }
    }
  }
  return blocked;
}

/** 글 하나를 검사. 빈 문자열은 통과 (빈 값 검사는 호출하는 쪽에서) */
export function moderateText(text: string): ModerationResult {
  if (!text) return { ok: true };

  // 1. 개인정보·외부 연락 (원문 모양이 중요하므로 정규화 전 NFKC 텍스트로)
  const folded = unicodeFold(text);
  for (const p of PATTERNS) {
    if (p.regex.test(folded))
      return { ok: false, category: p.category, ruleId: p.id };
  }

  // 2. 한글 금칙어 (tense 목록은 된소리를 살린 단위로 따로 비교)
  const units = koreanUnits(text);
  const blocked = allowMask(units, ALLOW_WORDS);
  const tenseUnits = koreanUnits(text, { keepTense: true });
  const word =
    findWord(units, blocked, KOREAN_WORDS, true) ??
    findWord(
      tenseUnits,
      allowMask(tenseUnits, ALLOW_WORDS_TENSE),
      TENSE_WORDS,
      true,
    ) ??
    findWord(units, blocked, CHOSEONG_WORDS, false);
  if (word)
    return {
      ok: false,
      category: word.category,
      ruleId: `word:${word.source}`,
    };

  // 3. 영문 금칙어 (단어 단위)
  for (const token of englishTokens(text)) {
    const exact = ENGLISH_EXACT.find((e) => e.word === token);
    if (exact)
      return {
        ok: false,
        category: exact.category,
        ruleId: `en:${exact.word}`,
      };
    const sub = ENGLISH_SUBSTRING.find((e) => token.includes(e.word));
    if (sub)
      return { ok: false, category: sub.category, ruleId: `en:${sub.word}` };
  }

  return { ok: true };
}

/** 여러 칸(제목·내용)을 차례로 검사해서 처음 걸린 칸을 알려 줌 */
export function moderateFields<K extends string>(
  fields: Partial<Record<K, string>>,
):
  | { ok: true }
  | { ok: false; field: K; category: ModerationCategory; ruleId: string } {
  for (const [field, value] of Object.entries(fields) as [
    K,
    string | undefined,
  ][]) {
    if (value === undefined) continue;
    const r = moderateText(value);
    if (!r.ok) return { ...r, field };
  }
  return { ok: true };
}
