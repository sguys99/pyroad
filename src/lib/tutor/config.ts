import type { TutorRequest } from './types';
import type { LLMProviderType } from './providers/types';

/** 요청 타입별 base max_tokens 한도 */
export const TOKEN_LIMITS: Record<TutorRequest['type'], number> = {
  quest_intro: 1200, // 스토리 도입 + 개념 설명 + 과제 안내
  hint_generator: 1000, // 3단계 힌트, 특히 레벨3은 상세함
  code_feedback: 800, // 에러 분석 + 수정 방향 또는 칭찬 + 개념 정리
  encouragement: 600, // 축하 메시지, 비교적 짧음
  project_guide: 1300, // 다단계 프로젝트 안내, 가장 복잡
  stage_summary: 1200, // 축하 + 개념별 정리 + 키워드 + 다음 스테이지 안내
};

/**
 * Provider별 토큰 배수 (한국어 토크나이저 효율 차이 반영)
 * - anthropic: 기준 (1.0)
 * - openai: 약간 비효율적 (1.1)
 * - gemini: 한국어 토크나이저 가장 비효율적 (1.4)
 */
const PROVIDER_TOKEN_MULTIPLIER: Record<LLMProviderType, number> = {
  anthropic: 1.2,
  openai: 1.2,
  gemini: 1.4,
};

/** provider를 고려한 최종 maxTokens 계산 */
export function getMaxTokens(
  type: TutorRequest['type'],
  provider?: LLMProviderType,
): number {
  const base = TOKEN_LIMITS[type];
  const multiplier = provider ? PROVIDER_TOKEN_MULTIPLIER[provider] : 1.0;
  return Math.round(base * multiplier);
}
