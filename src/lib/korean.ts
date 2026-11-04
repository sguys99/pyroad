/**
 * 받침에 맞는 목적격 조사 ("게임을", "퀴즈를"). 한글로 끝나지 않으면(영어·숫자) 둘 다 보여 준다.
 */
export function withObjectParticle(word: string): string {
  const last = word.trim().at(-1);
  if (!last) return word;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return `${word}을(를)`;
  return word + (code % 28 === 0 ? '를' : '을');
}
