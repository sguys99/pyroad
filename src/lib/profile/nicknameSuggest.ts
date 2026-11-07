/**
 * 랜덤 추천 닉네임 (P3-11 온보딩 기본값): "꾸미는 말 + 모험 친구" 조합, 필요하면 숫자 2개.
 *
 * - 모든 조합(+ 숫자)이 `validateNickname`을 통과하는지 `__tests__/nicknameSuggest.test.ts`가 전부 확인합니다.
 *   목록을 고치면 그 테스트가 2~10자·KS X 1001·금칙어·예약어를 다시 봅니다.
 * - 꾸미는 말은 4자, 이름은 4자 이하로 둬서 숫자 2개를 붙여도 10자를 넘지 않습니다.
 * - 중복은 DB가 정합니다. 저장이 중복으로 실패하면 `{ withNumber: true }`로 다시 추천하세요(20×20×100 = 4만 가지).
 * - 보안용 난수가 아니므로 `Math.random`이면 충분합니다. 테스트는 rng를 넣어 결과를 고정합니다.
 */

export const NICKNAME_ADJECTIVES = [
  '용감한',
  '반짝이는',
  '씩씩한',
  '똑똑한',
  '신나는',
  '즐거운',
  '날쌘',
  '튼튼한',
  '상냥한',
  '부지런한',
  '행복한',
  '빛나는',
  '재빠른',
  '든든한',
  '명랑한',
  '꼼꼼한',
  '슬기로운',
  '동글동글',
  '엉뚱한',
  '멋진',
] as const;

export const NICKNAME_NOUNS = [
  '탐험가',
  '코더',
  '여우',
  '고래',
  '다람쥐',
  '펭귄',
  '토끼',
  '부엉이',
  '거북이',
  '수달',
  '판다',
  '고양이',
  '강아지',
  '돌고래',
  '기사',
  '마법사',
  '발명가',
  '우주인',
  '로봇',
  '공룡',
] as const;

/** 0 이상 1 미만 난수 (Math.random과 같은 약속) */
export type Rng = () => number;

export interface SuggestNicknameOptions {
  /** 끝에 숫자 2개(00~99)를 붙임. 중복으로 저장이 실패했을 때 */
  withNumber?: boolean;
}

function pick<T>(list: readonly T[], rng: Rng): T {
  const i = Math.min(
    list.length - 1,
    Math.max(0, Math.floor(rng() * list.length)),
  );
  return list[i];
}

/** 추천 닉네임 하나. 예: "용감한여우", `{ withNumber: true }`면 "용감한여우07" */
export function suggestNickname(
  rng: Rng = Math.random,
  { withNumber = false }: SuggestNicknameOptions = {},
): string {
  const base = pick(NICKNAME_ADJECTIVES, rng) + pick(NICKNAME_NOUNS, rng);
  if (!withNumber) return base;
  const n = Math.min(99, Math.max(0, Math.floor(rng() * 100)));
  return base + String(n).padStart(2, '0');
}
