// DB 행 → 콘텐츠 원본 (build.ts 의 반대 방향). seed.sql 에서 content/ 를 처음 만들 때 씁니다
// (scripts/content/extract-from-seed.ts). 결과는 스키마로 다시 검사하므로 모양이 틀리면 오류가 납니다.

import {
  parseStoredRule,
  simplifyRule,
  type ValidationRule,
  type ValidationType,
} from '@/lib/quest/validation';

import {
  parseQuest,
  parseWith,
  StageSchema,
  type Quest,
  type Stage,
} from './schema';

type Row = Record<string, unknown>;

// prompt_skeleton 의 공개 키 (이 순서로 YAML 에 씀). 이 밖의 키가 있으면 스키마 검사에서 오류
const PROMPT_KEYS = [
  'topic',
  'learning_goals',
  'story_context',
  'exercise_description',
  'starter_code',
  'expected_output_hint',
  'checklist',
  'example_output',
  'fallback_text',
  'is_challenge',
] as const;

export function stageFromRow(row: Row): Stage {
  const parsed = parseWith(StageSchema, {
    id: row.id,
    order: row.order,
    title: row.title,
    theme_name: row.theme_name,
    description: row.description,
    is_final: row.is_final,
  });
  if (!parsed.ok)
    throw new Error(`stage ${row.id}: ${parsed.errors.join('; ')}`);
  return parsed.value;
}

/** quests 행 + quest_answer_keys 행 → 퀘스트 원본 */
export function questFromRows(quest: Row, answer: Row | undefined): Quest {
  const where = `quest ${quest.id}`;
  if (!answer) throw new Error(`${where}: quest_answer_keys 행이 없어요`);
  if (quest.expected_output) {
    throw new Error(
      `${where}: quests.expected_output 에 정답이 남아 있어요 (00005 이전 상태). 00005 까지 적용한 DB 에서 추출하세요`,
    );
  }

  const sk = record(quest.prompt_skeleton);
  const prompt: Row = {};
  for (const key of PROMPT_KEYS) if (key in sk) prompt[key] = sk[key];
  for (const key of Object.keys(sk)) {
    if (!(PROMPT_KEYS as readonly string[]).includes(key) && key !== 'steps') {
      prompt[key] = sk[key]; // 모르는 키는 그대로 넘겨 스키마가 짚게 함
    }
  }

  const rule = (type: unknown, expected: unknown, label: string) => {
    const parsed = parseStoredRule(
      String(type) as ValidationType,
      typeof expected === 'string' ? expected : '',
    );
    if (!parsed) throw new Error(`${where} ${label}: 규칙을 읽을 수 없어요`);
    return simplifyRule(parsed);
  };

  const answerPart = (
    validation: ValidationRule,
    hints: unknown,
    solution: unknown,
  ): Row => ({
    validation,
    hints,
    ...(typeof solution === 'string' && solution !== ''
      ? { solution_code: solution }
      : {}),
  });

  const base: Row = {
    id: quest.id,
    order: quest.order,
    title: quest.title,
    concept: quest.concept,
    xp_reward: quest.xp_reward,
  };

  let raw: Row;
  if (Array.isArray(sk.steps)) {
    const stepAnswers = Array.isArray(answer.steps)
      ? answer.steps.map(record)
      : [];
    raw = {
      ...base,
      quest_type: 'project',
      prompt,
      answer: answerPart(
        rule(quest.validation_type, answer.expected_output, 'validation'),
        answer.hints,
        answer.solution_code,
      ),
      steps: sk.steps.map(record).map((step) => {
        const a = stepAnswers.find((x) => x.step_number === step.step_number);
        if (!a) {
          throw new Error(`${where}: ${step.step_number}단계 정답이 없어요`);
        }
        return {
          step_number: step.step_number,
          prompt: {
            step_goal: step.step_goal,
            checklist: step.checklist,
            example_output: step.example_output,
            starter_code: step.starter_code,
            fallback_text: step.fallback_text,
          },
          answer: answerPart(
            rule(
              step.validation_type,
              a.expected_output,
              `steps[${step.step_number}]`,
            ),
            a.hints,
            a.solution_code,
          ),
        };
      }),
    };
  } else {
    raw = {
      ...base,
      quest_type: 'code',
      prompt,
      answer: answerPart(
        rule(quest.validation_type, answer.expected_output, 'validation'),
        answer.hints,
        answer.solution_code,
      ),
    };
  }

  const parsed = parseQuest(raw);
  if (!parsed.ok) throw new Error(`${where}: ${parsed.errors.join('; ')}`);
  return parsed.value;
}

function record(value: unknown): Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : {};
}
