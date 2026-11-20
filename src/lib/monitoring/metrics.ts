/**
 * 운영 지표 (P12-09) — 집계 결과 모양과 화면용 계산(비율·경고). 브라우저 번들(카탈로그)에도 들어가므로 서버 의존성 없음.
 * 집계는 DB 함수 `monitoring_summary`(00062, service_role 전용), 읽기는 `load.ts`. 정의·분모·주의점은 docs/monitoring.md
 */
export const RANGES = [1, 7, 28] as const;
export type RangeDays = (typeof RANGES)[number];

export function parseRange(raw: unknown): RangeDays {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 7;
}

export interface MonitoringSummary {
  days: RangeDays;
  from: string;
  to: string;
  generated_at: string;
  events: {
    active_users: number;
    visitor_sessions: number;
    all_ids: number;
    mobile_ids: number;
    landing_sessions: number;
    cta_sessions: number;
    login_users: number;
    signups: number;
    onboarding_done: number;
    sharers: number;
    quest_starts: number;
    quest_completes: number;
    hints: number;
    hints_l1: number;
    hints_l2: number;
    hints_l3: number;
    free_total: number;
    free_answered: number;
    free_fallback: number;
    free_blocked: number;
    free_answer_blocked: number;
  };
  daily: { day: string; users: number; visitors: number }[];
  cohort: {
    signups: number;
    started: number;
    completed: number;
    stage_cleared: number;
  };
  accounts: {
    created: number;
    age_checked: number;
    under14: number;
    guardian_ok: number;
    onboarded: number;
  };
  retention: {
    d1_cohort: number;
    d1_back: number;
    d7_cohort: number;
    d7_back: number;
  };
  sessions: { sessions: number; completes: number; three_plus: number };
  mobile: { quiz_starts: number; quiz_completes: number };
  motion: { client_users: number; downgraded: number; back_to_full: number };
  /** 튜터 유형(`tutor:<type>` 버킷) → 오늘 허용·한도 초과 수 */
  tutor_today: Record<string, { allowed: number; denied: number }>;
  health: {
    coin_mismatches: number;
    purge_overdue: number;
    hidden_posts: number;
    hidden_comments: number;
    hidden_creations: number;
    reports: number;
  };
}

/** 비율(0~1). 분모가 0이면 null (화면은 "—") */
export function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

/** 이 수보다 분모가 작으면 비율 옆에 "표본 적음" (출시 초기 1~2명으로 100%·0%가 뜨는 것을 오해하지 않게) */
export const SMALL_SAMPLE = 20;

/** P12-04 §4 출시 뒤 기준: 자동 하향 30% 초과, 하향 뒤 "풍성하게"로 되돌림 10% 초과면 임계값 33% 검토 */
export const MOTION_DOWNGRADE_LIMIT = 0.3;
export const MOTION_REVERT_LIMIT = 0.1;

export interface Alert {
  level: 'warn';
  text: string;
}

/** 경고 목록 (docs/monitoring.md "경고 기준"과 같은 규칙). 표본이 작은 비율은 경고하지 않음 */
export function alertsOf(s: MonitoringSummary): Alert[] {
  const out: Alert[] = [];
  const h = s.health;
  if (h.coin_mismatches > 0)
    out.push({
      level: 'warn',
      text: `코인 잔액과 원장이 다른 계정 ${h.coin_mismatches}개`,
    });
  if (h.purge_overdue > 0)
    out.push({
      level: 'warn',
      text: `파기 기한이 지났는데 남은 계정 ${h.purge_overdue}개 — 파기 크론 확인`,
    });
  const hidden = h.hidden_posts + h.hidden_comments + h.hidden_creations;
  if (hidden > 0)
    out.push({
      level: 'warn',
      text: `신고로 숨겨져 살펴볼 글·댓글·작품 ${hidden}개`,
    });
  const m = s.motion;
  const down = ratio(m.downgraded, m.client_users);
  if (
    down !== null &&
    m.client_users >= SMALL_SAMPLE &&
    down > MOTION_DOWNGRADE_LIMIT
  )
    out.push({
      level: 'warn',
      text: `연출 자동 하향 ${pct(down)} (기준 30%)`,
    });
  const back = ratio(m.back_to_full, m.downgraded);
  if (
    back !== null &&
    m.downgraded >= SMALL_SAMPLE &&
    back > MOTION_REVERT_LIMIT
  )
    out.push({
      level: 'warn',
      text: `하향 뒤 “풍성하게”로 되돌림 ${pct(back)} (기준 10%)`,
    });
  const denied = Object.values(s.tutor_today).reduce((a, t) => a + t.denied, 0);
  if (denied > 0)
    out.push({
      level: 'warn',
      text: `오늘 튜터 요청 한도 초과 ${denied}번`,
    });
  return out;
}

/** 0.4567 → "45.7%", null → "—" */
export function pct(r: number | null): string {
  if (r === null) return '—';
  const v = Math.round(r * 1000) / 10;
  return `${v}%`;
}

export function num(n: number): string {
  return n.toLocaleString('ko-KR');
}
