import { describe, it, expect } from 'vitest';
import { buildFallbackMessage } from '../helpers';
import type { TutorRequest } from '@/lib/tutor/types';
import type { QuestWithStageServer } from '@/lib/types/database';

function makeQuest(
  overrides: Partial<QuestWithStageServer> = {},
): QuestWithStageServer {
  return {
    id: 'test-quest-id',
    stage_id: 'test-stage-id',
    order: 1,
    title: '테스트 퀘스트',
    concept: 'print()',
    validation_type: 'output_match',
    expected_output: '안녕하세요!',
    xp_reward: 50,
    created_at: '',
    stage: { id: 'test-stage-id', title: '테스트 스테이지', order: 1, theme_name: 'test' },
    prompt_skeleton: {
      topic: 'print() 함수로 출력하기',
      learning_goals: ['print() 사용'],
      story_context: '테스트 배경',
      exercise_description: '테스트 설명',
      starter_code: '',
      expected_output_hint: '',
      fallback_text: '폴백 텍스트입니다.',
      hints: {
        level_1: '힌트 1단계',
        level_2: '힌트 2단계',
        level_3: '힌트 3단계',
      },
    },
    ...overrides,
  } as QuestWithStageServer;
}

describe('buildFallbackMessage', () => {
  const quest = makeQuest();

  describe('quest_intro — 기존 동작 유지', () => {
    it('skeleton.fallback_text를 반환', () => {
      const body: TutorRequest = { type: 'quest_intro', quest_id: 'q' };
      expect(buildFallbackMessage(body, quest)).toBe('폴백 텍스트입니다.');
    });
  });

  describe('hint_generator — 기존 동작 유지', () => {
    it.each([1, 2, 3] as const)('level_%i 힌트를 반환', (level) => {
      const body: TutorRequest = {
        type: 'hint_generator',
        quest_id: 'q',
        hint_level: level,
      };
      expect(buildFallbackMessage(body, quest)).toBe(
        quest.prompt_skeleton.hints[`level_${level}`],
      );
    });
  });

  describe('code_feedback (passed=false) — 기존 동작 유지', () => {
    it('오답 시 고정 메시지 반환', () => {
      const body: TutorRequest = {
        type: 'code_feedback',
        quest_id: 'q',
        execution_result: { stdout: '', stderr: '', passed: false },
      };
      expect(buildFallbackMessage(body, quest)).toBe(
        '앗, 조금 고쳐볼까요? 힌트를 사용해보세요! 💡',
      );
    });
  });

  describe('code_feedback (passed=true) — 맥락별 메시지 풀', () => {
    it('힌트 0회 시 적절한 칭찬 메시지 반환', () => {
      const body: TutorRequest = {
        type: 'code_feedback',
        quest_id: 'q',
        hints_used: 0,
        execution_result: { stdout: '안녕하세요!', stderr: '', passed: true },
      };
      const msg = buildFallbackMessage(body, quest);
      expect(msg).toBeTruthy();
      expect(msg).not.toBe('대단해요! 정답이에요! 🎉'); // 기존 단일 메시지가 아님
    });

    it('힌트 1-2회 시 메시지 반환', () => {
      const body: TutorRequest = {
        type: 'code_feedback',
        quest_id: 'q',
        hints_used: 2,
        execution_result: { stdout: '안녕하세요!', stderr: '', passed: true },
      };
      const msg = buildFallbackMessage(body, quest);
      expect(msg).toBeTruthy();
    });

    it('힌트 3회 시 메시지 반환', () => {
      const body: TutorRequest = {
        type: 'code_feedback',
        quest_id: 'q',
        hints_used: 3,
        execution_result: { stdout: '안녕하세요!', stderr: '', passed: true },
      };
      const msg = buildFallbackMessage(body, quest);
      expect(msg).toBeTruthy();
    });

    it('20회 호출 시 2개 이상 다른 메시지 출현', () => {
      const body: TutorRequest = {
        type: 'code_feedback',
        quest_id: 'q',
        hints_used: 0,
        execution_result: { stdout: '안녕하세요!', stderr: '', passed: true },
      };
      const messages = new Set<string>();
      for (let i = 0; i < 20; i++) {
        messages.add(buildFallbackMessage(body, quest));
      }
      expect(messages.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('encouragement — 맥락별 메시지 풀 + 플레이스홀더 치환', () => {
    it('힌트 0회 + standard XP', () => {
      const body: TutorRequest = {
        type: 'encouragement',
        quest_id: 'q',
        hints_used: 0,
        earned_xp: 75,
      };
      const msg = buildFallbackMessage(body, quest);
      expect(msg).toBeTruthy();
      expect(msg).not.toBe('퀘스트를 완료했어요! 정말 대단해요! 🎉🐍');
    });

    it('힌트 2회 + high XP — {earned_xp} 치환됨', () => {
      const body: TutorRequest = {
        type: 'encouragement',
        quest_id: 'q',
        hints_used: 2,
        earned_xp: 150,
      };
      const msg = buildFallbackMessage(body, quest);
      expect(msg).not.toContain('{earned_xp}');
      expect(msg).not.toContain('{topic}');
    });

    it('{topic} 플레이스홀더가 실제 토픽으로 치환됨', () => {
      const body: TutorRequest = {
        type: 'encouragement',
        quest_id: 'q',
        hints_used: 0,
        earned_xp: 150,
      };
      // 20회 반복하여 {topic} 포함 메시지가 나올 때까지
      let foundTopicInterpolation = false;
      for (let i = 0; i < 30; i++) {
        const msg = buildFallbackMessage(body, quest);
        if (msg.includes('print() 함수로 출력하기')) {
          foundTopicInterpolation = true;
          break;
        }
      }
      // topic 치환이 되는 메시지가 풀에 존재하는지 확인
      // (모든 메시지가 topic을 포함하지는 않으므로 30회 반복)
      expect(foundTopicInterpolation).toBe(true);
    });

    it('20회 호출 시 2개 이상 다른 메시지 출현', () => {
      const body: TutorRequest = {
        type: 'encouragement',
        quest_id: 'q',
        hints_used: 0,
        earned_xp: 75,
      };
      const messages = new Set<string>();
      for (let i = 0; i < 20; i++) {
        messages.add(buildFallbackMessage(body, quest));
      }
      expect(messages.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('project_guide — 기존 동작 유지', () => {
    it('steps가 없으면 skeleton.fallback_text 반환', () => {
      const body: TutorRequest = {
        type: 'project_guide',
        quest_id: 'q',
        current_step: 1,
        total_steps: 5,
        step_goal: '목표',
      };
      expect(buildFallbackMessage(body, quest)).toBe('폴백 텍스트입니다.');
    });
  });
});
