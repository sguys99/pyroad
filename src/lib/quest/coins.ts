import { levelUpCoins } from './xp';

/**
 * 코인 금액표 (P8-04, §3 "초기 코인 밸런스안", 확정은 P8-14 docs/balance.md).
 * 지급은 서버(SQL `public.coin_reward`, 00031)만 하고 이 표는 화면 안내·시뮬레이션용 사본.
 * 두 쪽은 `supabase/tests/fixtures/reward-rules.json` "coins" 행으로 대조(vitest rewardRules.test.ts, test:rls RW-1) — 바꾸면 함께.
 *
 * 붙이는 법 (P8-06~09): 보상 RPC 안에서 `PERFORM public.coin_apply(p_user_id, '<source>', '<ref>', public.coin_reward('<kind>', n))`
 * ref 형식은 00030 머리 주석 — mission `<KST 날짜>:<미션 id>` · attendance `<KST 날짜>` · chest `<stage_id>` · achievement `<업적 id>`
 */
export const COIN_RULES = {
  /** 코드 퀘스트 첫 완료 (황금키 완료 0, 퀴즈는 별 코인만) */
  quest: 10,
  /** 프로젝트 퀘스트 첫 완료 (§12-Q65 (a): XP가 코드의 4배라 코인도 4배) */
  project: 40,
  /** 별 1개당, 별 번호마다 처음 한 번 (복습으로 늘어난 별만) */
  star: 5,
  /** 데일리 미션 난이도 1·2·3 (P8-07) */
  mission: [10, 15, 20],
  /** 출석 1~7일째 (P8-08) */
  attendance: [5, 5, 10, 10, 15, 20, 30],
  /** 보물상자: 1 스테이지 · 2 마지막 스테이지 (P8-06) */
  chest: [30, 50],
  /** 업적 티어: 1 브론즈 · 2 실버 · 3 골드 (P8-09) */
  achievement: [10, 30, 100],
} as const;

export type CoinRewardKind = keyof typeof COIN_RULES | 'level_up';

/** SQL `coin_reward(kind, n)`과 같은 값. level_up 의 n 은 레벨, 표 종류는 1부터. 모르는 값·범위 밖은 0 */
export function coinReward(kind: CoinRewardKind, n?: number): number {
  if (kind === 'level_up') return n === undefined ? 0 : levelUpCoins(n);
  const rule: number | readonly number[] | undefined = COIN_RULES[kind];
  if (typeof rule === 'number') return rule;
  if (!rule || n === undefined || !Number.isInteger(n)) return 0;
  return rule[n - 1] ?? 0;
}

/** 레벨을 지나며 받은 코인 (완료·퀴즈 응답의 level_ups, 00031 grant_level_up_coins). 이미 받은 레벨은 coins 0 */
export interface LevelUpCoins {
  level: number;
  coins: number;
}

export function levelUpCoinsTotal(
  levelUps: readonly LevelUpCoins[] | undefined,
): number {
  return (levelUps ?? []).reduce((n, l) => n + l.coins, 0);
}
