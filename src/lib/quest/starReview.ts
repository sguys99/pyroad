import { kstToday } from '@/lib/time/kst';

/**
 * 별 복습 도전이 열렸는지 (§2.3, §12-Q64): 완료한 퀘스트·퀴즈의 최고 별이 3개 미만이고, 마지막 별 판정일(KST)이 오늘 전.
 * 오늘 판정했으면 다시 풀어도 연습(별·코인·XP 없음). 판정 기록이 없는 예전 완료(P8-05 이전 코드 퀘스트)는 바로 열림.
 * 서버 규칙과 같음: 퀴즈 submit_quiz_answer(00026) review 모드, 코드 complete_quest(00032) retry. 완료 여부는 부르는 쪽이 확인
 */
export function starReviewOpen(
  q: { best_stars: number; stars_judged_on?: string | null },
  today: string = kstToday(),
): boolean {
  return q.best_stars < 3 && (!q.stars_judged_on || q.stars_judged_on < today);
}
