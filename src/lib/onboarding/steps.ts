/**
 * 첫 로그인 온보딩 단계 (P3-11). 화면은 `src/components/onboarding/OnboardingFlow.tsx`.
 *
 * 단계는 **목록 하나**로만 정한다. 화면은 지금 단계의 id로 내용을 고르고(`renderStep`), 진행 표시·뒤로·다음은 이 목록의 순서만 본다.
 * 그래서 단계를 더할 때는 ① 여기 `buildOnboardingSteps`에 한 줄 ② 화면의 `renderStep`에 한 갈래 ③ 그 단계의 `canLeave` 조건만 고친다.
 *
 * ▼ P3-15 (만 14세 미만 보호자 동의) 끼울 자리: `agree` 바로 다음.
 *   buildOnboardingSteps({ ageCheck: true, guardian: needsGuardian }) →
 *   agree → age(생년 또는 학년 확인) → guardian(보호자와 함께 동의, 만 14세 미만일 때만) → nickname → …
 *   `age`에서 학년을 받으면 뒤의 `grade` 단계는 `options.gradeKnown`으로 빼면 된다.
 */

export type OnboardingStepId =
  | 'agree'
  // P3-15: | 'age' | 'guardian'
  | 'nickname'
  | 'skin'
  | 'grade'
  | 'stamp';

export interface OnboardingStep {
  id: OnboardingStepId;
  /** 진행 표시 아래 짧은 이름 (화면 낭독기: "3단계 중 2단계, 이름") */
  label: string;
  /** 서버에 저장하기 전 단계인지 (마지막 `stamp`는 저장 뒤 축하) */
  form: boolean;
}

export interface OnboardingStepOptions {
  /** 학년을 이미 알면(P3-15 나이 확인에서 받음) 학년 단계를 뺀다 */
  gradeKnown?: boolean;
}

const STEP: Record<OnboardingStepId, OnboardingStep> = {
  agree: { id: 'agree', label: '약속', form: true },
  nickname: { id: 'nickname', label: '이름', form: true },
  skin: { id: 'skin', label: '색', form: true },
  grade: { id: 'grade', label: '학년', form: true },
  stamp: { id: 'stamp', label: '도장', form: false },
};

/** 이번 아이가 거칠 단계 (순서대로) */
export function buildOnboardingSteps(
  options: OnboardingStepOptions = {},
): readonly OnboardingStep[] {
  return [
    STEP.agree,
    // ▼ P3-15: ...(options.ageCheck ? [STEP.age] : []), ...(options.guardian ? [STEP.guardian] : []),
    STEP.nickname,
    STEP.skin,
    ...(options.gradeKnown ? [] : [STEP.grade]),
    STEP.stamp,
  ];
}

export function stepIndex(
  steps: readonly OnboardingStep[],
  id: OnboardingStepId,
): number {
  return steps.findIndex((s) => s.id === id);
}

/** 다음 단계 id (마지막이면 null) */
export function nextStepId(
  steps: readonly OnboardingStep[],
  id: OnboardingStepId,
): OnboardingStepId | null {
  const i = stepIndex(steps, id);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1].id : null;
}

/** 이전 단계 id (처음이거나 저장 뒤 축하 단계면 null — 저장한 뒤에는 되돌아가지 않음) */
export function prevStepId(
  steps: readonly OnboardingStep[],
  id: OnboardingStepId,
): OnboardingStepId | null {
  const i = stepIndex(steps, id);
  if (i <= 0 || !steps[i].form) return null;
  return steps[i - 1].id;
}

/** 저장 요청을 보낼 단계 = 마지막 입력 단계 (그다음이 도장) */
export function isSubmitStep(
  steps: readonly OnboardingStep[],
  id: OnboardingStepId,
): boolean {
  const next = nextStepId(steps, id);
  return next !== null && !STEP[next].form;
}
