import type { MonitoringSummary } from './metrics';

/** `/dev/design` 카탈로그·테스트용 견본 (실제 데이터 아님). 출시 1주 차쯤의 그럴듯한 7일 값 */
export function sampleSummary(): MonitoringSummary {
  const users = [0, 0, 0, 0, 0, 0, 0, 38, 61, 72, 69, 80, 77, 91];
  const visitors = [0, 0, 0, 0, 0, 0, 0, 210, 180, 160, 175, 150, 140, 165];
  return {
    days: 7,
    from: '2026-11-18',
    to: '2026-11-24',
    generated_at: '2026-11-24T09:30:00+09:00',
    events: {
      active_users: 214,
      visitor_sessions: 1180,
      all_ids: 1394,
      mobile_ids: 502,
      landing_sessions: 1090,
      cta_sessions: 318,
      login_users: 240,
      signups: 152,
      onboarding_done: 131,
      sharers: 29,
      quest_starts: 1460,
      quest_completes: 1122,
      hints: 486,
      hints_l1: 301,
      hints_l2: 129,
      hints_l3: 56,
      free_total: 88,
      free_answered: 6,
      free_fallback: 71,
      free_blocked: 9,
      free_answer_blocked: 2,
    },
    daily: users.map((u, i) => ({
      day: `2026-11-${String(11 + i).padStart(2, '0')}`,
      users: u,
      visitors: visitors[i],
    })),
    cohort: { signups: 150, started: 128, completed: 117, stage_cleared: 46 },
    accounts: {
      created: 149,
      age_checked: 138,
      under14: 121,
      guardian_ok: 97,
      onboarded: 131,
    },
    retention: { d1_cohort: 112, d1_back: 49, d7_cohort: 0, d7_back: 0 },
    sessions: { sessions: 402, completes: 1122, three_plus: 151 },
    mobile: { quiz_starts: 96, quiz_completes: 71 },
    motion: { client_users: 205, downgraded: 23, back_to_full: 1 },
    tutor_today: {
      hint_generator: { allowed: 64, denied: 0 },
      quest_intro: { allowed: 41, denied: 0 },
      free_question: { allowed: 12, denied: 2 },
      concept_explain: { allowed: 9, denied: 0 },
    },
    health: {
      coin_mismatches: 0,
      purge_overdue: 0,
      hidden_posts: 1,
      hidden_comments: 0,
      hidden_creations: 0,
      reports: 4,
    },
  };
}
