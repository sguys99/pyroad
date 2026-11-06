import { describe, expect, it } from 'vitest';
import {
  buildOnboardingSteps,
  isSubmitStep,
  nextStepId,
  prevStepId,
  stepIndex,
} from '../steps';

describe('온보딩 단계 (P3-11)', () => {
  it('약속 → 이름 → 색 → 학년 → 도장, 도장만 저장 뒤 단계', () => {
    const steps = buildOnboardingSteps();
    expect(steps.map((s) => s.id)).toEqual([
      'agree',
      'nickname',
      'skin',
      'grade',
      'stamp',
    ]);
    expect(steps.filter((s) => !s.form).map((s) => s.id)).toEqual(['stamp']);
  });

  it('앞뒤 이동: 처음은 이전 없음, 도장(저장 뒤)에서는 되돌아가지 않음', () => {
    const steps = buildOnboardingSteps();
    expect(prevStepId(steps, 'agree')).toBeNull();
    expect(prevStepId(steps, 'skin')).toBe('nickname');
    expect(prevStepId(steps, 'stamp')).toBeNull();
    expect(nextStepId(steps, 'agree')).toBe('nickname');
    expect(nextStepId(steps, 'stamp')).toBeNull();
    expect(stepIndex(steps, 'grade')).toBe(3);
  });

  it('저장은 도장 바로 앞 단계에서 한 번 — 학년을 이미 알면(P3-15) 색 단계에서', () => {
    const steps = buildOnboardingSteps();
    expect(isSubmitStep(steps, 'grade')).toBe(true);
    expect(isSubmitStep(steps, 'skin')).toBe(false);
    const known = buildOnboardingSteps({ gradeKnown: true });
    expect(known.map((s) => s.id)).not.toContain('grade');
    expect(isSubmitStep(known, 'skin')).toBe(true);
    expect(nextStepId(known, 'skin')).toBe('stamp');
  });
});
