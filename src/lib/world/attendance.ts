/**
 * 출석 달력·스트릭 방패 (P8-08, §3 F5, §12-Q62 ①②). 판정·지급·방패 정산은 모두 서버(00035 `world_daily_status`·`stamp_attendance`)가 하고,
 * 여기는 그 반환 모양과 화면용 작은 계산만 둔다.
 *
 * - 출석 = 하루 첫 방문 때 "출석 도장"을 직접 누름. 하루 한 번(원장 attendance/<KST 날짜>), XP 없음(§12-Q63 ②)
 * - 7칸 사이클: 칸 = 누적 출석 수 % 7 + 1 — 하루 빠져도 진행 유지(끊겨도 1일차로 돌아가지 않음, §12-Q62 기본값)
 * - 칸별 코인 5·5·10·10·15·20·30(`coinReward('attendance', n)`), 7일째 = 상자(30코인 + 스트릭 방패 1개, 최대 2개)
 * - 방패: 학습(퀘스트·퀴즈)을 빠뜨린 날을 다음 방문 때 서버가 자동으로 메움 — 빠진 날 수만큼 가지고 있을 때만
 */
import type { AchievementInfo } from '@/lib/quest/achievements';
import { coinReward } from '@/lib/quest/coins';
import { addKstDays, type KstDateKey } from '@/lib/time/kst';
import type { Streak } from '@/lib/time/streak';

export const ATTENDANCE_DAYS = 7;
export const MAX_SHIELDS = 2;

export interface StreakStatus extends Streak {
  /** 가진 방패 (0~2) */
  shields: number;
  /** 방패로 메운 날 (최근 7일) */
  shield_days: KstDateKey[];
  /** 이번 호출이 새로 메운 날 */
  filled: KstDateKey[];
}

export interface AttendanceStatus {
  today: KstDateKey;
  /** 누적 출석 수 */
  total: number;
  stamped_today: boolean;
  /** 오늘 찍은 칸(찍었으면) 또는 오늘 찍을 칸 (1~7) */
  day_n: number;
  /** 이번 사이클에 찍은 KST 날짜 (오래된 것부터) */
  cycle: KstDateKey[];
}

/** `world_daily_status` 반환 (00035) */
export interface WorldDailyStatus {
  streak: StreakStatus;
  attendance: AttendanceStatus;
}

/** `stamp_attendance` 반환 (00035). 이미 찍었으면 already_stamped, 코인 0 */
export interface StampAttendanceResult {
  stamped: true;
  already_stamped: boolean;
  day_n: number;
  coins_earned: number;
  coins_balance: number;
  /** 7일째 상자에서 받은 방패 (가득이면 0) */
  shield_granted: number;
  shields: number;
  /** 도장으로 새로 얻은 업적 (P8-09, 예: 출석 도장 7개) */
  new_achievements?: AchievementInfo[];
}

export interface AttendanceCell {
  n: number;
  coins: number;
  /** 찍은 날 (안 찍었으면 없음) */
  day?: KstDateKey;
  /** 오늘 찍을 칸 (아직 안 찍음) */
  next: boolean;
  /** 7일째 상자 */
  chest: boolean;
}

/** 달력 7칸. 오늘 찍었으면 찍은 칸들, 아니면 찍은 칸 + 오늘 찍을 칸 */
export function attendanceCells(a: AttendanceStatus): AttendanceCell[] {
  return Array.from({ length: ATTENDANCE_DAYS }, (_, i) => {
    const n = i + 1;
    return {
      n,
      coins: coinReward('attendance', n),
      day: a.cycle[i],
      next: !a.stamped_today && n === a.day_n,
      chest: n === ATTENDANCE_DAYS,
    };
  });
}

/** 도장을 찍은 뒤 화면 상태 (서버를 다시 읽기 전) */
export function afterStamp(
  a: AttendanceStatus,
  res: StampAttendanceResult,
): AttendanceStatus {
  if (a.stamped_today) return a;
  return {
    ...a,
    stamped_today: true,
    total: a.total + 1,
    day_n: res.day_n,
    cycle: [...a.cycle, a.today],
  };
}

/** 어제를 방패가 메웠는지 ("방패가 불꽃을 지켜 줬어요") */
export function shieldSavedYesterday(
  s: Pick<StreakStatus, 'shield_days'>,
  today: KstDateKey,
): boolean {
  return s.shield_days.includes(addKstDays(today, -1));
}
