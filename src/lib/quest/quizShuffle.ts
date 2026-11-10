import type { QuizPrompt } from '@/lib/types/database';

/**
 * 퀴즈 보기 섞기 (P7-02, §2.3 "시도마다 서버가 보기 순서를 섞어 내려보냄").
 *
 * 빌드가 보기를 id 순으로 저장하므로(P7-01) 그대로 보여 주면 매번 같은 자리라 "두 번째 보기" 같은 자리 기억으로 풀 수 있음.
 * 채점은 위치가 아니라 보기 id 로 하므로(submit_quiz_answer) 순서는 화면용일 뿐이고 정답과 무관함.
 * 섞는 것: 객관식 options · 빈칸 tokens · 순서 맞추기 lines · 버그 찾기 fixes. 버그 찾기 lines 는 코드 순서라 그대로.
 * 서버(퀘스트 페이지·/api/quest/answer 의 next_quiz)에서 부름. 순수 함수라 입력을 바꾸지 않고 새 객체를 돌려줌.
 */
export function shuffleQuiz<T extends QuizPrompt>(
  quiz: T,
  randomInt: (n: number) => number = cryptoRandomInt,
): T {
  const mix = <I>(xs: readonly I[]) => shuffle(xs, randomInt);
  switch (quiz.kind) {
    case 'multiple_choice':
      return { ...quiz, options: mix(quiz.options) };
    case 'fill_blank':
      return { ...quiz, tokens: mix(quiz.tokens) };
    case 'parsons':
      return { ...quiz, lines: mix(quiz.lines) };
    case 'bug_hunt':
      return { ...quiz, fixes: mix(quiz.fixes) };
    default:
      return quiz;
  }
}

/** Fisher–Yates. randomInt(n) 은 0 이상 n 미만 정수 */
function shuffle<I>(xs: readonly I[], randomInt: (n: number) => number): I[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** crypto 난수로 0 이상 n 미만 (n ≤ 2^32, 거절 표본으로 치우침 없음) */
function cryptoRandomInt(n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % n;
}
