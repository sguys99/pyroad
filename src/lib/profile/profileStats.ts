/**
 * 프로필 화면 값 (P8-13). 서버 `profile_stats`(00038, service_role)가 돌려준 기록을 화면 모양으로 바꾸는 순수 함수.
 * 날짜는 모두 KST 날짜 키(`kst.ts`) — 실행 환경 시간대에 기대지 않음.
 */
import { addKstDays, kstDayNumber, type KstDateKey } from '@/lib/time/kst';

/** `profile_stats` 반환 (00038). stats 는 업적 지표(achievement_stats)라 업적 진행과 같은 수 */
export interface ProfileStatsRaw {
  stats: {
    quests: number;
    no_hint: number;
    stars: number;
    three_stars: number;
    quiz_correct: number;
    reviews: number;
    streak: number;
    errors: number;
    chests: number;
    attendance: number;
  };
  quiz_tries: number;
  quiz_right: number;
  /** 지금 이어지는 연속 학습일 (방패 날 포함) */
  streak: number;
  shields: number;
  /** KST 날짜 → 그날 푼 퀘스트 수 (최근 400일) */
  days: Record<KstDateKey, number>;
  shield_days: KstDateKey[];
  stamp_days: KstDateKey[];
  coins_week: number;
}

/** 퀴즈 정답률 % (시도가 없으면 null — "0%"로 기죽이지 않게) */
export function quizAccuracy(right: number, tries: number): number | null {
  return tries > 0 ? Math.round((right / tries) * 100) : null;
}

/** 'YYYY-MM' */
export type MonthKey = string;

/** 달력이 보여 줄 최대 개월 수 (이번 달 포함) */
export const CALENDAR_MONTHS = 12;

const monthOf = (key: KstDateKey): MonthKey => key.slice(0, 7);

function shiftMonth(month: MonthKey, by: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
}

/** 달력 달 목록(오래된 → 이번 달): 첫 기록이 있는 달부터, 최대 12개월. 기록이 없으면 이번 달 하나 */
export function calendarMonths(
  today: KstDateKey,
  dateKeys: Iterable<KstDateKey>,
): MonthKey[] {
  const last = monthOf(today);
  const oldest = shiftMonth(last, -(CALENDAR_MONTHS - 1));
  let first = last;
  for (const k of dateKeys) {
    const m = monthOf(k);
    if (m < first) first = m;
  }
  if (first < oldest) first = oldest;
  const out: MonthKey[] = [];
  for (let m = first; m <= last; m = shiftMonth(m, 1)) out.push(m);
  return out;
}

/** 잔디 농도 0~3: 0 = 안 함 · 1 = 1개 · 2 = 2~3개 · 3 = 4개 이상 */
export function learnLevel(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return n <= 3 ? 2 : 3;
}

export interface CalendarCell {
  key: KstDateKey;
  day: number;
  /** 그날 푼 퀘스트 수 */
  solved: number;
  level: 0 | 1 | 2 | 3;
  shield: boolean;
  stamp: boolean;
  today: boolean;
  future: boolean;
  /** 낭독: "11월 12일, 퀘스트 3개, 출석 도장" */
  label: string;
}

export interface CalendarMonth {
  month: MonthKey;
  /** "2026년 11월" */
  title: string;
  /** 일요일부터 7칸씩, 달 밖 칸은 null */
  weeks: (CalendarCell | null)[][];
  /** 이 달에 공부한 날 수 · 푼 퀘스트 합 */
  learnedDays: number;
  solved: number;
}

export interface CalendarInput {
  days: Record<KstDateKey, number>;
  shieldDays: ReadonlySet<KstDateKey>;
  stampDays: ReadonlySet<KstDateKey>;
}

function cellLabel(c: Omit<CalendarCell, 'label'>, month: number): string {
  const parts = [`${c.today ? '오늘, ' : ''}${month}월 ${c.day}일`];
  if (c.solved > 0) parts.push(`퀘스트 ${c.solved}개`);
  if (c.shield) parts.push('방패로 지킨 날');
  if (c.stamp) parts.push('출석 도장');
  return parts.join(', ');
}

/** 한 달 달력 (일요일 시작). 요일은 날짜 키의 일 번호로 계산 (1970-01-01 = 목요일) */
export function buildCalendarMonth(
  month: MonthKey,
  input: CalendarInput,
  today: KstDateKey,
): CalendarMonth {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const next = `${shiftMonth(month, 1)}-01`;
  const length = kstDayNumber(next) - kstDayNumber(first);
  const lead = (kstDayNumber(first) + 4) % 7;
  const todayN = kstDayNumber(today);

  const cells: (CalendarCell | null)[] = Array.from(
    { length: lead },
    () => null,
  );
  let learnedDays = 0;
  let solved = 0;
  for (let d = 0; d < length; d++) {
    const key = addKstDays(first, d);
    const n = kstDayNumber(key);
    const count = input.days[key] ?? 0;
    const base = {
      key,
      day: d + 1,
      solved: count,
      level: learnLevel(count),
      shield: input.shieldDays.has(key),
      stamp: input.stampDays.has(key),
      today: n === todayN,
      future: n > todayN,
    };
    if (count > 0) learnedDays++;
    solved += count;
    cells.push({ ...base, label: cellLabel(base, m) });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { month, title: `${y}년 ${m}월`, weeks, learnedDays, solved };
}

/** 최근 얻은 업적 n개 (얻은 시각 늦은 순, 같으면 정렬 순) */
export function recentAchievements<T extends { id: string; sort: number }>(
  defs: readonly T[],
  owned: readonly { achievement_id: string; achieved_at: string }[],
  n = 3,
): (T & { achievedAt: string })[] {
  const at = new Map(owned.map((o) => [o.achievement_id, o.achieved_at]));
  return defs
    .filter((d) => at.has(d.id))
    .map((d) => ({ ...d, achievedAt: at.get(d.id)! }))
    .sort(
      (a, b) =>
        Date.parse(b.achievedAt) - Date.parse(a.achievedAt) || a.sort - b.sort,
    )
    .slice(0, n);
}
