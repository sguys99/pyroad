/**
 * 기존 사용자 판별 (P3-12). 온보딩(P3-11) 전에 가입해 학습한 아이는 같은 등록증 흐름을 짧고 반갑게 보여 준다
 * ("다시 만나서 반가워!", 튜토리얼은 고를 수 있게). 순수 함수 — 값은 온보딩 페이지(서버)가 본인 행에서 읽어 넘긴다.
 *
 * 신호: 학습 흔적이 하나라도 있으면 기존 사용자 — 경험치 > 0 · 진행 행(`user_progress`)이 있음 · 이미 닉네임이 있음.
 * 가입 시각(created_at)은 쓰지 않는다: 릴리즈 시각을 코드에 박아야 하고, 가입만 하고 아무것도 안 한 아이는
 * 새 사용자 흐름(튜토리얼 포함)이 더 알맞기 때문. 온보딩 완료 여부(`onboarded_at`)는 관문이 따로 본다.
 */
export type OnboardingVariant = 'new' | 'returning';

export interface ReturningSignals {
  totalXp: number | null | undefined;
  /** 이 사용자의 user_progress 행 수 (모르면 0) */
  progressCount: number | null | undefined;
  nickname: string | null | undefined;
}

export function onboardingVariant(s: ReturningSignals): OnboardingVariant {
  if ((s.totalXp ?? 0) > 0) return 'returning';
  if ((s.progressCount ?? 0) > 0) return 'returning';
  if (s.nickname && s.nickname.trim()) return 'returning';
  return 'new';
}
