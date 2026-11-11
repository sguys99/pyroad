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
  /** 이미 완료한 퀘스트 (중복 클릭·동시 요청·다시 풀기). 다시 풀기(retry)면 아래 별 값과 새 별 코인만 바뀔 수 있음 */
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
  /** 이번 판정의 별 (P8-05 00032: 첫 완료 = 힌트·황금키 규칙, 다시 풀기 통과 = 3). 판정이 없으면 0 */
  stars: number;
  /** 이 퀘스트의 최고 별 (0 = 아직 기록 없음, 기존 완료는 P8-11 소급 전까지 0일 수 있음) */
  best_stars: number;
  /** 이번에 늘어난 최고 별 (새 별 코인은 이 별 번호만, 이미 받은 번호면 0) */
  new_stars: number;
  /** 황금키로 연 퀘스트를 이번에 처음 직접 풀었음 → XP·뱃지를 이때 받음 */
  solved_directly: boolean;
  /** 황금키가 넣어 준 정답을 그대로 다시 돌림 → 별·보상 없음 */
  solution_copy: boolean;
  /** first = 첫 완료 · review = 복습 도전(다시 풀기) · practice = 판정한 날 다시 풀기(무변화, §12-Q64) · null = 판정 없음 */
  mode?: 'first' | 'review' | 'practice' | null;
  /** 다음 복습 도전이 열리는 날 (KST YYYY-MM-DD) */
  next_review_on?: string | null;
}

/** 다시 풀기(retry)로 별·보상이 바뀌었는지 (월드맵 다시 받기·화면 갱신 기준) */
export function retryChanged(res: QuestCompleteResponse): boolean {
  return res.already_completed && (res.new_stars > 0 || res.solved_directly);
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
