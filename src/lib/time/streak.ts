/**
 * 지금 이어지는 연속 모험 일수 (P5-07 HUD 불꽃). 스트릭 컬럼은 DB에 없어 완료 시각(`completed_at`)으로 센다.
 *
 * - 하루는 KST 자정 기준(`kst.ts`), 같은 날 여러 번은 하루
 * - 오늘 아직 안 풀었어도 어제까지 이어졌으면 그 일수를 유지(`today: false`) — 자정이 지나자마자 불이 꺼지지 않게
 * - 3일 뱃지(`has_three_day_streak`, TS `hasThreeDayStreak`)와 같은 정의: 최근 완료일이 오늘·어제면
 *   `days >= 3` ⇔ 뱃지 조건 (테스트가 `reward-rules.json` 표로 대조). 뱃지처럼 황금키 완료는 넘기기 전에 뺀다
 */
import { kstDayNumberOf, type DateInput } from './kst';

export interface Streak {
  /** 연속 일수 (0이면 불꽃 꺼짐) */
  days: number;
  /** 오늘(KST)도 풀었는지 */
  today: boolean;
}

export function currentStreak(
  completedAt: readonly (string | null)[],
  now: DateInput = Date.now(),
): Streak {
  const days = new Set(
    completedAt.filter((c): c is string => !!c).map(kstDayNumberOf),
  );
  const todayN = kstDayNumberOf(now);
  const today = days.has(todayN);
  let n = 0;
  for (let d = today ? todayN : todayN - 1; days.has(d); d--) n++;
  return { days: n, today };
}
