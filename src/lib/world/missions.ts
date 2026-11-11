/**
 * 데일리 미션 (P8-07, §3 F4). 미션 풀·배정·진행 판정·지급은 모두 서버(00034 `daily_missions_today`·`claim_daily_mission`)가 하고,
 * 여기는 그 반환 모양과 화면용 작은 계산만 둔다 — 진행을 TS 로 다시 세지 않음(한 곳).
 *
 * - 하루 3개(할 수 있는 것만이라 더 적을 수 있음), KST 자정에 새로 배정. 진행은 기존 기록(완료 시각·힌트·퀴즈 시도)을 그 KST 날짜로 셈
 * - 보상: 난이도 1~3 = 코인 10·15·20(`coinReward('mission', n)`) + XP 15(§12-Q63 ②). "받기" 버튼으로만(§12-Q62 ③)
 * - 안 받은 보상은 7일 동안 받을 수 있음(`pending`, 지난날 것)
 */
import {
  nextKstMidnight,
  type DateInput,
  type KstDateKey,
} from '@/lib/time/kst';

export type MissionKind =
  | 'quest_clear'
  | 'no_hint'
  | 'review'
  | 'daily_quiz'
  | 'quiz_correct';

export interface DailyMission {
  id: string;
  title: string;
  kind: MissionKind;
  /** 1~3 */
  difficulty: number;
  target: number;
  /** 0..target (서버가 target 에서 자름) */
  progress: number;
  coins: number;
  xp: number;
  claimed: boolean;
}

/** 지난날 달성했는데 안 받은 미션 (받을 수 있는 날 = 오늘과 지난 6일) */
export interface PendingMission extends DailyMission {
  day: KstDateKey;
}

/** 월드맵 HUD 미션 칸이 쓰는 오늘 상태 */
export interface DailyMissionsState {
  day: KstDateKey;
  missions: DailyMission[];
  pending: PendingMission[];
}

/** `daily_missions_today` 반환 (00034). assigned false = 오늘 아직 배정 전(읽기만 한 호출) */
export interface DailyMissionsRpcResult {
  assigned: boolean;
  day: KstDateKey;
  quiz_ids?: string[];
  missions?: DailyMission[];
  pending?: PendingMission[];
}

/** `claim_daily_mission` 반환 (00034). 이미 받았으면 already_claimed, 코인·XP 0 */
export interface ClaimMissionResult {
  claimed: true;
  already_claimed: boolean;
  /** 미션 코인만 */
  mission_coins: number;
  xp_earned: number;
  /** 레벨 업 코인 포함 */
  coins_earned: number;
  coins_balance: number;
  total_xp: number;
  level_before: number;
  level_after: number;
  level_ups: { level: number; coins: number }[];
}

/** 달성했고 아직 안 받음 → "받기" */
export function missionReady(m: DailyMission): boolean {
  return !m.claimed && m.progress >= m.target;
}

/** 지금 받을 수 있는 보상 수 (오늘 + 지난날) — HUD 칸 점 */
export function readyCount(state: DailyMissionsState | null): number {
  if (!state) return 0;
  return (
    state.missions.filter(missionReady).length +
    state.pending.filter(missionReady).length
  );
}

/** 다음 KST 자정까지 남은 시간 (ms) */
export function msUntilKstMidnight(now: DateInput = Date.now()): number {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return nextKstMidnight(now).getTime() - t;
}

/** "3시간 12분" · "12분" · "1분 안" (분은 올림 — 0분이 보이지 않게) */
export function formatTimeLeft(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (ms < 60_000) return '1분 안';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
