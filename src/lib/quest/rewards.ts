import type { BadgeType } from './badges';
import type { LevelUpCoins } from './coins';

/**
 * 완료·황금키·리셋 API 응답 (P1-03). 값은 모두 DB 함수(00006)가 한 트랜잭션에서 정한 것입니다.
 * 축하 연출은 "이번 요청에서 새로 일어난 일"만 보고 정합니다 (P1-10 축하 시퀀서도 이 형태를 씀).
 */
export interface StageClearInfo {
  stage_id: string;
  order: number;
  title: string;
  /** 스테이지 퀘스트의 개념 (퀘스트 순서) */
  concepts: string[];
}

/** POST /api/quest/complete */
export interface QuestCompleteResponse {
  /** 이미 완료한 퀘스트 (중복 클릭·동시 요청·다시 풀기). 아래 값은 현재 값이고 새로 받은 것은 없음 */
  already_completed: boolean;
  /** 이번에 받은 XP (황금키를 쓴 퀘스트는 0) */
  xp_gained: number;
  total_xp: number;
  level_before: number;
  level_after: number;
  /** 이번에 새로 받은 뱃지 (축하 순서). 황금키를 쓴 퀘스트는 늘 빈 배열 (Q25, 00019) */
  new_badges: BadgeType[];
  /** 이번 완료로 스테이지를 클리어했으면 그 스테이지 */
  stage_cleared: StageClearInfo | null;
  /** 같은 스테이지의 다음 미완료 퀘스트 (스테이지를 클리어했으면 null) */
  next_quest_id: string | null;
  golden_keys: number;
  /** 보상 계산에 쓴 DB 값 (B05: 요청 본문 값이 아님) */
  hints_used: number;
  used_golden_key: boolean;
  /** 이번 요청에서 늘어난 코인 전부 (첫 완료 + 레벨 업, P8-04 00031). 이미 완료·황금키 완료는 0 (레벨 업이 없으면) */
  coins_earned: number;
  /** 코인 잔액 (users.coins) */
  coins_balance: number;
  /** 이번에 지나간 레벨마다 받은 코인 (이미 받은 레벨은 0) */
  level_ups: LevelUpCoins[];
}

/** POST /api/quest/golden-key */
export interface GoldenKeyResponse {
  solution_code: string;
  golden_keys: number;
  /** false: 이미 황금키로 연 코드 퀘스트라 차감하지 않음 */
  charged: boolean;
}

/** 오류 응답 (모든 보상 API 공통). error 는 아이에게 그대로 보여 줄 수 있는 문구 */
export interface RewardErrorResponse {
  error: string;
  code: string;
}

export function levelChanged(res: QuestCompleteResponse): boolean {
  return res.level_after > res.level_before;
}
