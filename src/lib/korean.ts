/**
 * 받침에 맞는 조사 ("게임을", "바다가"). 한글로 끝나지 않으면(영어·숫자) 둘 다 보여 준다 ("pyRoad이(가)").
 */
export function withParticle(
  word: string,
  afterBatchim: string,
  afterVowel: string,
): string {
  const last = word.trim().at(-1);
  if (!last) return word;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${afterBatchim}(${afterVowel})`;
  return word + (code % 28 === 0 ? afterVowel : afterBatchim);
}

/** 목적격 조사 ("게임을", "퀴즈를") */
export const withObjectParticle = (word: string) =>
  withParticle(word, '을', '를');
