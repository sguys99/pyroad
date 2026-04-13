import type { TutorRequest } from './types';

/** 요청 타입별 max_tokens 한도 */
export const TOKEN_LIMITS: Record<TutorRequest['type'], number> = {
  quest_intro: 600, // 스토리 도입 + 개념 설명 + 과제 안내
  hint_generator: 500, // 3단계 힌트, 특히 레벨3은 상세함
  code_feedback: 600, // 에러 분석 + 수정 방향 또는 칭찬 + 개념 정리
  encouragement: 400, // 축하 메시지, 비교적 짧음
  project_guide: 700, // 다단계 프로젝트 안내, 가장 복잡
  stage_summary: 600, // 축하 + 개념별 정리 + 키워드 + 다음 스테이지 안내
};
