import { kstToday, type DateInput } from '@/lib/time/kst';

/**
 * 만 14세 미만 확인 (P3-15, §12-Q5·Q35). 화면(나이 확인 단계)과 서버(`/api/onboarding`)가 같은 계산을 쓴다.
 *
 * - 묻는 것: 태어난 해 → 그해가 경계(올해 - 14)일 때만 태어난 달 → 그 달이 이번 달이면 "생일이 지났어요?"
 *   날짜(일)는 묻지 않는다. 모르면("잘 모르겠어요") 만 14세 미만으로 본다 (안전한 쪽)
 * - **저장하는 것은 결과(`under14` | `14plus`)뿐**이다. 태어난 해·달은 서버가 계산에만 쓰고 저장·기록하지 않는다 (최소 수집)
 * - 기준 날짜는 KST 오늘 (`src/lib/time/kst.ts`). 실행 환경 시간대에 기대지 않는다
 */
export type AgeBand = 'under14' | '14plus';

export interface AgeAnswer {
  /** 태어난 해 · 'older' = 보기 중 가장 이른 해보다 전 · 'unknown' = 잘 모르겠어요 */
  year: number | 'older' | 'unknown';
  /** 1~12, 경계 해일 때만 */
  month?: number;
  /** 태어난 달이 이번 달일 때만: 이번 달 생일이 지났는지 (모르면 undefined → 만 14세 미만) */
  birthdayPassed?: boolean;
}

export type AgeResult =
  | { band: AgeBand }
  /** 경계 해: 달을 더 물어야 함 */
  | { need: 'month' }
  /** 태어난 달이 이번 달: 생일이 지났는지 물어야 함 */
  | { need: 'birthday' };

/** 화면에 보여 줄 태어난 해 보기 (최근 해부터). 이보다 이른 해는 'older' 하나로 */
export const AGE_YEAR_SPAN = { youngest: 5, oldest: 16 } as const;

export function ageYearOptions(now: DateInput = Date.now()): number[] {
  const y = Number(kstToday(now).slice(0, 4));
  const out: number[] = [];
  for (let a = AGE_YEAR_SPAN.youngest; a <= AGE_YEAR_SPAN.oldest; a++)
    out.push(y - a);
  return out;
}

/** 경계 해 (올해 - 14): 이해에 태어났으면 생일에 따라 만 13세 또는 14세 */
export function boundaryYear(now: DateInput = Date.now()): number {
  return Number(kstToday(now).slice(0, 4)) - 14;
}

/**
 * 답 → 결과. 만 나이 = 올해 - 태어난 해 - (올해 생일이 아직이면 1).
 * 만 14세 이상 = 경계 해보다 앞 · 경계 해이면서 생일이 지남(이번 달 이전 달 · 이번 달이고 지났다고 답함).
 * 'older'는 보기의 가장 이른 해(올해-16)보다 전이라 늘 14세 이상. 잘못된 값·미래 해는 만 14세 미만(안전한 쪽).
 */
export function ageBand(
  answer: AgeAnswer,
  now: DateInput = Date.now(),
): AgeResult {
  const today = kstToday(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const edge = year - 14;
  if (answer.year === 'unknown') return { band: 'under14' };
  if (answer.year === 'older') return { band: '14plus' };
  if (!Number.isInteger(answer.year) || answer.year > year)
    return { band: 'under14' };
  if (answer.year < edge) return { band: '14plus' };
  if (answer.year > edge) return { band: 'under14' };
  const m = answer.month;
  if (m === undefined) return { need: 'month' };
  if (!Number.isInteger(m) || m < 1 || m > 12) return { band: 'under14' };
  if (m < month) return { band: '14plus' };
  if (m > month) return { band: 'under14' };
  if (answer.birthdayPassed === undefined) return { need: 'birthday' };
  return { band: answer.birthdayPassed ? '14plus' : 'under14' };
}
