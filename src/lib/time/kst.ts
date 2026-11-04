/**
 * 한국 시간(KST, Asia/Seoul) 날짜 계산 (P1-05).
 *
 * 앱의 "하루"는 모두 KST 자정 기준입니다: 3일 연속 스트릭, 출석·데일리 미션(§2.2),
 * 퀴즈 복습 가능일(§2.3), 화면에 보이는 날짜. DB 쪽은 `AT TIME ZONE 'Asia/Seoul'`로 같은 날짜를 셉니다
 * (`00006`의 `has_three_day_streak`).
 *
 * 서버(Vercel은 UTC)와 브라우저(사용자 기기 시간대)에서 같은 결과가 나와야 하므로:
 * - 실행 환경의 시간대(`TZ`, `getHours()` 같은 로컬 메서드)는 쓰지 않음
 * - `toLocaleDateString('ko-KR')`처럼 ICU 버전마다 모양이 다른 문자열을 만들거나 split 하지 않음(B21).
 *   `formatToParts`로 숫자만 꺼내 직접 조립
 * - Asia/Seoul은 1988년 이후 서머타임이 없는 UTC+9 고정이므로, 날짜 키 → 자정 시각은 +9시간으로 계산
 *   (테스트가 Intl 결과와 고정 오프셋 계산이 늘 같은지 확인)
 *
 * 날짜 키는 `'YYYY-MM-DD'` 문자열(SQL `date`와 같은 모양)입니다.
 */

/** KST = UTC+9 (서머타임 없음) */
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `'YYYY-MM-DD'` */
export type KstDateKey = string;

export type DateInput = Date | string | number;

const kstPartsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  numberingSystem: 'latn',
});

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

interface YMD {
  year: number;
  month: number;
  day: number;
}

function toDate(input: DateInput): Date {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`잘못된 날짜: ${String(input)}`);
  }
  return date;
}

/** 이 순간의 KST 연·월·일 */
function kstYmd(input: DateInput): YMD {
  const parts = kstPartsFormat.formatToParts(toDate(input));
  const pick = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((p) => p.type === type)?.value);
  const ymd = { year: pick('year'), month: pick('month'), day: pick('day') };
  if (!Number.isInteger(ymd.year + ymd.month + ymd.day)) {
    throw new RangeError(`KST 날짜를 계산할 수 없음: ${String(input)}`);
  }
  return ymd;
}

function parseKey(key: KstDateKey): YMD {
  const m = DATE_KEY_PATTERN.exec(key);
  if (m) {
    const ymd = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
    // 2026-02-30 같은 없는 날짜 거부 (Date.UTC는 3월 2일로 넘겨 버림)
    const check = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
    if (
      check.getUTCFullYear() === ymd.year &&
      check.getUTCMonth() === ymd.month - 1 &&
      check.getUTCDate() === ymd.day
    ) {
      return ymd;
    }
  }
  throw new RangeError(`잘못된 날짜 키: ${key}`);
}

function formatKey({ year, month, day }: YMD): KstDateKey {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 순간 → 그 순간의 KST 날짜 키. `toKstDateKey('2026-11-03T15:00:00Z')` → `'2026-11-04'` */
export function toKstDateKey(input: DateInput): KstDateKey {
  return formatKey(kstYmd(input));
}

/** 지금의 KST 날짜 키 ("오늘") */
export function kstToday(now: DateInput = Date.now()): KstDateKey {
  return toKstDateKey(now);
}

/** 날짜 키 → 1970-01-01부터 센 일 번호 (날짜끼리 빼서 일수 차를 구할 때) */
export function kstDayNumber(key: KstDateKey): number {
  const { year, month, day } = parseKey(key);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** 순간 → 그 순간의 KST 날짜의 일 번호 */
export function kstDayNumberOf(input: DateInput): number {
  return kstDayNumber(toKstDateKey(input));
}

/** `to - from` 일수. `kstDaysBetween('2026-12-31', '2027-01-01')` → `1` */
export function kstDaysBetween(from: KstDateKey, to: KstDateKey): number {
  return kstDayNumber(to) - kstDayNumber(from);
}

/** 날짜 키에 `days`일을 더한 날짜 키 (음수면 뺌) */
export function addKstDays(key: KstDateKey, days: number): KstDateKey {
  const d = new Date((kstDayNumber(key) + days) * DAY_MS);
  return formatKey({
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  });
}

/** 그 KST 날짜가 시작되는 순간(KST 00:00). `kstStartOfDay('2026-11-04')` → `2026-11-03T15:00:00.000Z` */
export function kstStartOfDay(key: KstDateKey): Date {
  return new Date(kstDayNumber(key) * DAY_MS - KST_OFFSET_MS);
}

/** 이 순간 다음에 오는 KST 자정 (데일리 미션 초기화·복습 가능 시각 안내용) */
export function nextKstMidnight(now: DateInput = Date.now()): Date {
  return kstStartOfDay(addKstDays(toKstDateKey(now), 1));
}

export type KstDateStyle =
  /** `2026년 11월 4일` */
  | 'long'
  /** `11월 4일` */
  | 'monthDay'
  /** `2026. 11. 4.` (좁은 칸용, 예전 ko-KR 표시와 같은 모양) */
  | 'dot';

/**
 * 화면 표시용 KST 날짜. 서버 컴포넌트와 클라이언트 컴포넌트에서 같은 문자열이 나오므로
 * 하이드레이션 불일치가 없습니다. 날짜 키(`'2026-11-04'`)를 넘기면 그 날짜 그대로 씁니다.
 */
export function formatKstDate(
  input: DateInput,
  style: KstDateStyle = 'long',
): string {
  const { year, month, day } =
    typeof input === 'string' && DATE_KEY_PATTERN.test(input)
      ? parseKey(input)
      : kstYmd(input);
  switch (style) {
    case 'monthDay':
      return `${month}월 ${day}일`;
    case 'dot':
      return `${year}. ${month}. ${day}.`;
    default:
      return `${year}년 ${month}월 ${day}일`;
  }
}
