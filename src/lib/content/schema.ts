// 콘텐츠 원본 스키마 (Content as Code, P1-11, §2.4)
//
// 퀘스트 하나 = YAML 파일 하나 (`content/worlds/<world>/<NN-stage>/<NN-quest>.yaml`).
// 한 파일 안에서 공개 부분과 정답 부분을 키로 나눠 쓰고, 빌드(`src/lib/content/build.ts`)가 둘을 나눠 씁니다.
//   prompt  → quests.prompt_skeleton        공개: 학생 브라우저로 그대로 내려감
//   answer  → quest_answer_keys             정답: service_role 전용 (P0-08, P1-02)
//             단, answer.validation.type 만 공개 칸(quests.validation_type)에 들어감
// 공개 부분(prompt)에는 정답 키(hints, solution_code, expected_output, is_correct, accepted)를 둘 수 없습니다.
// strictObject 라서 모르는 키는 모두 오류이고, `findAnswerKeysInPublic`이 키 이름을 짚어 알려 줍니다.
//
// 확장 지점: 퀘스트 유형은 `quest_type`으로 나뉘는 discriminated union 입니다.
// Phase 7(P7-01)에서 QuizQuestSchema(`quest_type: 'quiz'` + `quiz_kind`별 union)를 QuestSchema 에 더합니다.

import { z } from 'zod/v4';

import type { ValidationRule } from '@/lib/quest/validation';

const text = z.string().min(1, '비어 있으면 안 돼요');
/** 시작 코드: 프로젝트 단계처럼 빈 문자열도 허용 */
const code = z.string();
/** 기존 데이터의 id 는 버전 비트가 0 인 UUID 형식(b1000000-0000-0000-0000-0000000000NN)이라 z.uuid() 대신 guid */
const id = z.guid(
  'UUID 형식이어야 해요 (예: b1000000-0000-0000-0000-000000000045)',
);
const order = z.int().min(1);

/** 공개 부분에 둘 수 없는 정답 키 (supabase/migrations/00005 의 quests_no_answer_fields CHECK 와 같은 목록) */
export const ANSWER_KEYS = [
  'hints',
  'solution_code',
  'expected_output',
  'is_correct',
  'accepted',
] as const;

// ------------------------------------------------------------
// 판정 규칙
// ------------------------------------------------------------

const OutputMatchRule = z.strictObject({
  type: z.literal('output_match'),
  /** 출력 전체가 같아야 함 (앞뒤 공백·줄바꿈은 무시) */
  expected: text,
});

const ContainsRule = z.strictObject({
  type: z.literal('contains'),
  /** 출력에 이 문자열이 들어 있어야 함 */
  expected: text,
});

const ContainsAnyRule = z.strictObject({
  type: z.literal('contains_any'),
  /** 출력에 이 중 하나라도 들어 있으면 통과 (무작위 출력 퀘스트, B09) */
  expected: z.array(text).min(1),
});

const CodeCheckRule = z.strictObject({
  type: z.literal('code_check'),
  /** 코드(주석·문자열 내용 제외, B25)에 이 문자열이 있어야 함 */
  expected: text,
  /** true 면 식별자 경계를 봄: `int(`가 `randint(` 안에서는 안 걸림 (B30) */
  whole_word: z.boolean().optional(),
});

const AllRule = z.strictObject({
  type: z.literal('all'),
  /** 모두 통과해야 통과 */
  rules: z.array(z.lazy(() => ValidationRuleSchema)).min(1),
});

export const ValidationRuleSchema: z.ZodType<ValidationRule> =
  z.discriminatedUnion('type', [
    OutputMatchRule,
    ContainsRule,
    ContainsAnyRule,
    CodeCheckRule,
    AllRule,
  ]);

// ------------------------------------------------------------
// 공개 부분 (prompt)
// ------------------------------------------------------------

/** 코드·프로젝트 퀘스트의 공개 부분 → quests.prompt_skeleton */
export const QuestPromptSchema = z.strictObject({
  topic: text,
  learning_goals: z.array(text).min(1),
  story_context: text,
  exercise_description: text,
  starter_code: code,
  /**
   * 코드 퀘스트에서는 목표 출력 예시를 써도 됨 (§12-Q20: 의도한 노출).
   * 퀴즈(P7-01)에서는 정답이 드러나는 문장을 금지하고 빌드 검사로 막음.
   */
  expected_output_hint: text,
  /** 튜터가 실패할 때만 보이는 설명. 코드 퀘스트는 예시 코드를 써도 됨 (§12-Q20) */
  fallback_text: text,
  /** 스테이지의 챌린지 퀘스트 표시 */
  is_challenge: z.boolean().optional(),
});

/** 프로젝트 단계의 공개 부분 → quests.prompt_skeleton.steps[] */
export const StepPromptSchema = z.strictObject({
  step_goal: text,
  /** 이전 단계 코드 뒤에 붙는 시작 코드. 빈 문자열 허용 */
  starter_code: code,
  fallback_text: text,
});

// ------------------------------------------------------------
// 정답 부분 (answer)
// ------------------------------------------------------------

export const HintsSchema = z.strictObject({
  level_1: text,
  level_2: text,
  /** 3단계 힌트는 빈칸(`___`) 형태의 거의 정답. 정답 테이블에만 둠 */
  level_3: text,
});

/** 코드 퀘스트·프로젝트 단계의 정답 → quest_answer_keys (단계는 steps[]) */
export const CodeAnswerSchema = z.strictObject({
  validation: ValidationRuleSchema,
  hints: HintsSchema,
  /** 황금키 정답 코드. 자동 검증(P1-13)이 이 코드로 규칙을 통과하는지 확인 */
  solution_code: text,
});

/** 프로젝트 퀘스트 전체의 정답. 정답 코드는 단계마다 있으므로 퀘스트 전체에는 없어도 됨 */
export const ProjectAnswerSchema = CodeAnswerSchema.extend({
  solution_code: text.optional(),
});

export const ProjectStepSchema = z.strictObject({
  step_number: order,
  prompt: StepPromptSchema,
  answer: CodeAnswerSchema,
});

// ------------------------------------------------------------
// 퀘스트
// ------------------------------------------------------------

const questBase = {
  /** quests.id. 한 번 정하면 바꾸지 않음 (user_progress 가 참조) */
  id,
  /** 스테이지 안 순서. 파일 이름 앞 두 자리(NN-)와 같아야 함 */
  order,
  title: text,
  concept: text,
  xp_reward: z.int().min(0),
};

export const CodeQuestSchema = z.strictObject({
  ...questBase,
  quest_type: z.literal('code'),
  prompt: QuestPromptSchema,
  answer: CodeAnswerSchema,
});

export const ProjectQuestSchema = z.strictObject({
  ...questBase,
  quest_type: z.literal('project'),
  prompt: QuestPromptSchema,
  answer: ProjectAnswerSchema,
  steps: z.array(ProjectStepSchema).min(1),
});

// P7-01 확장 지점: QuizQuestSchema
//   quest_type: 'quiz', quiz_kind: 'multiple_choice' | 'fill_blank' | 'parsons' | 'bug_hunt' 별 union
//   prompt.quiz(문제·보기·토큰·줄, id 는 정답 위치를 암시하지 않는 임의 문자열) → quests.prompt_skeleton.quiz
//   answer.quiz_answer(accepted 목록 + 보기별 해설) → quest_answer_keys.quiz_answer
//   §12-Q20: 퀴즈의 공개 필드(fallback_text·expected_output_hint·해설 미리보기)에 정답이나 정답이 드러나는
//   문장을 넣으면 실패하게 함 (superRefine 에서 accepted 보기 문구가 공개 문자열에 들어 있는지 검사)
export const QuestSchema = z
  .discriminatedUnion('quest_type', [CodeQuestSchema, ProjectQuestSchema])
  .superRefine((quest, ctx) => {
    if (quest.quest_type !== 'project') return;
    quest.steps.forEach((step, index) => {
      if (step.step_number !== index + 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['steps', index, 'step_number'],
          message: `단계 번호는 1부터 차례대로 써야 해요 (기대값 ${index + 1})`,
        });
      }
    });
  });

// ------------------------------------------------------------
// 월드·스테이지 메타 (world.yaml, stage.yaml)
// ------------------------------------------------------------

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, '영문 소문자·숫자·하이픈만 써요');

/**
 * world.yaml. 지금은 검증만 하고 SQL 로는 내보내지 않음.
 * P1-08 에서 worlds 테이블(id, order, slug, title, theme, description, unlock_rule)이 생기면
 * 빌드가 slug 기준으로 업서트하고 stages.world_id 를 채움.
 */
export const WorldSchema = z.strictObject({
  /** 디렉토리 이름과 같아야 함. worlds.slug */
  slug,
  order,
  title: text,
  theme: z.string().regex(/^[a-z0-9_]+$/, '영문 소문자·숫자·밑줄만 써요'),
  description: z.string(),
});

/** stage.yaml → stages */
export const StageSchema = z.strictObject({
  id,
  /** 디렉토리 이름 앞 두 자리(NN-)와 같아야 함. 지금은 전체에서 유일(stages."order" UNIQUE) */
  order,
  title: text,
  theme_name: z.string().regex(/^[a-z0-9_]+$/, '영문 소문자·숫자·밑줄만 써요'),
  description: z.string(),
  is_final: z.boolean(),
});

export type World = z.infer<typeof WorldSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type CodeQuest = z.infer<typeof CodeQuestSchema>;
export type ProjectQuest = z.infer<typeof ProjectQuestSchema>;
export type Quest = z.infer<typeof QuestSchema>;
export type QuestType = Quest['quest_type'];

// ------------------------------------------------------------
// 검사 도우미
// ------------------------------------------------------------

/**
 * 공개 부분에 들어간 정답 키의 경로 목록. 비어 있으면 안전.
 * `prompt`·`steps[].prompt`(원본) 와 빌드한 prompt_skeleton(출력) 양쪽에 씀.
 */
export function findAnswerKeysInPublic(
  value: unknown,
  path: (string | number)[] = [],
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      findAnswerKeysInPublic(item, [...path, i]),
    );
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...((ANSWER_KEYS as readonly string[]).includes(key)
      ? [formatPath([...path, key])]
      : []),
    ...findAnswerKeysInPublic(child, [...path, key]),
  ]);
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

/** 퀘스트 파일 하나를 검사한다. 공개 부분에 정답 키가 있으면 다른 오류보다 먼저, 알아보기 쉽게 알려 줌 */
export function parseQuest(raw: unknown): ParseResult<Quest> {
  const leaks = publicPartsOf(raw).flatMap(([path, part]) =>
    findAnswerKeysInPublic(part, path),
  );
  const leakErrors = leaks.map(
    (p) =>
      `${p}: 정답 필드는 공개 부분(prompt)에 둘 수 없어요. answer 아래로 옮기세요`,
  );
  const result = QuestSchema.safeParse(raw);
  if (result.success && leakErrors.length === 0) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    errors: [
      ...leakErrors,
      ...(result.success ? [] : formatIssues(result.error)),
    ],
  };
}

export function parseWith<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): ParseResult<T> {
  const result = schema.safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, errors: formatIssues(result.error) };
}

function publicPartsOf(raw: unknown): [(string | number)[], unknown][] {
  if (typeof raw !== 'object' || raw === null) return [];
  const quest = raw as { prompt?: unknown; steps?: unknown };
  const parts: [(string | number)[], unknown][] = [[['prompt'], quest.prompt]];
  if (Array.isArray(quest.steps)) {
    quest.steps.forEach((step, i) => {
      if (typeof step === 'object' && step !== null) {
        parts.push([
          ['steps', i, 'prompt'],
          (step as { prompt?: unknown }).prompt,
        ]);
      }
    });
  }
  return parts;
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length ? formatPath(issue.path) : '(파일 전체)';
    return `${where}: ${issue.message}`;
  });
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((p, i) =>
      typeof p === 'number' ? `[${p}]` : `${i === 0 ? '' : '.'}${String(p)}`,
    )
    .join('');
}
