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
// 퀘스트 유형은 `quest_type`으로 나뉘는 discriminated union 입니다 (code · project · quiz(P7-01, quiz_kind 별 union)).

import { z } from 'zod/v4';

import { validateRule, type ValidationRule } from '@/lib/quest/validation';
import { QUIZ_BLANK_RE } from '@/lib/quest/questKind';
import { SOUND_MANIFEST, type BgmId } from '@/lib/sound/manifest';

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

/**
 * 공개 "해 볼 일" 목록과 예시 출력 (P7-17, §12-Q59). 코드 퀘스트와 프로젝트 단계마다 씀.
 * 예시 출력은 학생에게 보여 줘도 되는 "이런 모양이면 돼요"이고, 빌드가 정답 규칙을 통과하는지 확인함
 * (output_match 면 기준값과 같아야 함 — 코드 퀘스트의 의도한 노출, §12-Q20. 결과 쪽지가 줄 단위로 견줌)
 */
const publicGuide = {
  /** 해 볼 일 항목 (2~4개 권장, 짧고 구체적으로) */
  checklist: z.array(text).min(1).max(5),
  /** 예시 출력. 무작위 출력이면 나올 수 있는 한 가지 */
  example_output: text,
};

/** 코드 퀘스트의 공개 부분. 프로젝트는 해 볼 일·예시 출력을 단계마다 씀 */
export const CodePromptSchema = QuestPromptSchema.extend(publicGuide);

/** 프로젝트 단계의 공개 부분 → quests.prompt_skeleton.steps[] */
export const StepPromptSchema = z.strictObject({
  step_goal: text,
  ...publicGuide,
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

/**
 * 자동 검증(P1-13 `npm run test:content`)이 `input()`에 넣을 입력 시나리오. CI 전용이라 DB 에는 쓰지 않음.
 * 실행기의 `setStdin` 큐로 한 줄씩 들어가고, 모자라면 EOFError (P11-05에서 기대 출력 등으로 확장)
 */
export const InputScenarioSchema = z.strictObject({
  /** input() 한 번에 한 줄씩 */
  inputs: z.array(z.string()),
  /** 정하면 이 시드로만 실행 (입력이 난수에 맞춰져 있을 때). 없으면 시드 0~9 + 무시드 */
  seed: z.int().min(0).optional(),
});

/** 코드 퀘스트·프로젝트 단계의 정답 → quest_answer_keys (단계는 steps[]) */
export const CodeAnswerSchema = z.strictObject({
  validation: ValidationRuleSchema,
  hints: HintsSchema,
  /** 황금키 정답 코드. 자동 검증(P1-13)이 이 코드로 규칙을 통과하는지 확인 */
  solution_code: text,
  /** 선택. input() 을 쓰는 퀘스트의 자동 검증 입력 (CI 전용) */
  scenarios: z.array(InputScenarioSchema).min(1).optional(),
});

/**
 * 프로젝트 퀘스트 전체의 정답. 정답 코드는 단계마다 있으므로 퀘스트 전체에는 없어도 됨.
 * 퀘스트 전체 규칙은 마지막 단계 실행 결과로 확인하므로 입력 시나리오도 단계에만 씀
 */
export const ProjectAnswerSchema = CodeAnswerSchema.omit({
  scenarios: true,
}).extend({
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
  prompt: CodePromptSchema,
  answer: CodeAnswerSchema,
});

export const ProjectQuestSchema = z.strictObject({
  ...questBase,
  quest_type: z.literal('project'),
  prompt: QuestPromptSchema,
  answer: ProjectAnswerSchema,
  steps: z.array(ProjectStepSchema).min(1),
});

// ------------------------------------------------------------
// 퀴즈 (P7-01, §12-Q20·Q60). 키보드 없이 푸는 보너스 퀘스트
//   prompt.quiz           → quests.prompt_skeleton.quiz          공개: 문제·코드·보기·토큰·줄·수정안 (빌드가 kind 를 붙임)
//   answer.quiz_answer    → quest_answer_keys.quiz_answer         정답: accepted + 해설 (빌드가 kind 를 붙임)
// accepted 원소의 정규형 (P7-02 채점 RPC 가 제출값과 `jsonb =` 로 그대로 비교)
//   multiple_choice  "opt-k7qz"                                  고른 보기 id
//   fill_blank       {"bk-r2fa": "tok-m4xe", …}                  빈칸 id → 토큰 id (모든 빈칸. jsonb 객체라 키 순서 무관)
//   parsons          ["ln-q8wd", "ln-a3ke", …]                   정답 줄 순서 (모든 줄을 한 번씩)
//                    [{"id": "ln-q8wd", "indent": 0}, …]         indent: true 일 때 (들여쓰기 단계 0~4)
//   bug_hunt         {"line": "ln-x5pc", "fix": "fx-b7nd"}       틀린 줄 id + 고친 줄(수정안) id
// 정답이 여럿이면(바꿔도 되는 줄, 둘 다 맞는 보기) accepted 에 모두 나열. 배열 순서는 의미가 있음(@> 금지, P0-08)
// (00004 의 quiz_answer 주석 예시와 fill_blank 모양이 다름: 배열이 아니라 객체로 확정. 그 주석은 초안)
// ------------------------------------------------------------

/**
 * 보기·토큰·줄·수정안·빈칸 id: `<영문 소문자 머리 1~6자>-<영문 소문자와 숫자를 섞은 4~8자>` (예: opt-k7qz, ln-3fqa).
 * 글자와 숫자를 반드시 섞게 해 a·b·c·d, l1·l2…, 0001 같은 차례형 이름을 막음 (정답 위치가 드러나지 않게)
 */
export const QUIZ_ID_PATTERN =
  /^[a-z]{1,6}-(?=[a-z0-9]*[a-z])(?=[a-z0-9]*\d)[a-z0-9]{4,8}$/;
const quizId = z
  .string()
  .regex(
    QUIZ_ID_PATTERN,
    'id 는 opt-k7qz 처럼 "머리-글자와 숫자를 섞은 4~8자"로 써요 (a·b·l1 처럼 차례가 보이는 이름 금지)',
  );

/** 보기·토큰: 화면에 보이는 글자 */
const quizItem = z.strictObject({ id: quizId, text });
/** 줄·수정안: 코드 한 줄 */
const quizLine = z.strictObject({ id: quizId, code: text });

const MultipleChoiceBody = z.strictObject({
  question: text,
  /** 선택. 출력 예측형("이 코드를 돌리면 무엇이 나올까?")의 코드 */
  code: text.optional(),
  options: z.array(quizItem).min(2).max(6),
});

const FillBlankBody = z.strictObject({
  question: text,
  /** 빈칸은 `{{빈칸 id}}` (예: `for i in {{bk-r2fa}}(3):`). QUIZ_BLANK_RE */
  code: text,
  /** 빈칸에 넣을 토큰. 정답에 안 쓰이는 토큰은 방해 토큰(distractor) */
  tokens: z.array(quizItem).min(1).max(12),
});

const ParsonsBody = z.strictObject({
  question: text,
  /** 섞어서 보여 줄 줄. indent: true 면 앞 공백 없이 쓰고 학생이 들여쓰기도 정함 */
  lines: z.array(quizLine).min(2).max(12),
  indent: z.boolean().optional(),
});

const BugHuntBody = z.strictObject({
  question: text,
  /** 코드 순서 그대로의 줄 (들여쓰기 포함) */
  lines: z.array(quizLine).min(2).max(20),
  /** 틀린 줄을 고칠 후보 줄 */
  fixes: z.array(quizLine).min(2).max(6),
});

/** 퀴즈 공개 부분 → quests.prompt_skeleton (quiz 말고는 코드 퀘스트와 같은 뜻) */
const quizPromptBase = {
  topic: text,
  learning_goals: z.array(text).min(1),
  story_context: text,
  /** 튜터가 실패할 때만 보이는 설명. 퀴즈는 정답을 쓰면 안 됨 (§12-Q20, 빌드 검사) */
  fallback_text: text,
};

/** 퀴즈 정답 부분 → quest_answer_keys.quiz_answer */
const quizAnswerBase = {
  /** 정답 해설 (맞혔을 때, 3번 틀려 정답을 공개할 때) */
  explanation: text,
  /** 선택. 보기·줄·수정안 id 별 해설 (그것을 골랐을 때) */
  explanations: z.record(quizId, text).optional(),
};

const quizBase = { ...questBase, quest_type: z.literal('quiz') };

const ParsonsIndentLine = z.strictObject({
  id: quizId,
  indent: z.int().min(0).max(4),
});

export const QuizQuestSchema = z.discriminatedUnion('quiz_kind', [
  z.strictObject({
    ...quizBase,
    quiz_kind: z.literal('multiple_choice'),
    prompt: z.strictObject({ ...quizPromptBase, quiz: MultipleChoiceBody }),
    answer: z.strictObject({
      quiz_answer: z.strictObject({
        ...quizAnswerBase,
        accepted: z.array(quizId).min(1),
      }),
    }),
  }),
  z.strictObject({
    ...quizBase,
    quiz_kind: z.literal('fill_blank'),
    prompt: z.strictObject({ ...quizPromptBase, quiz: FillBlankBody }),
    answer: z.strictObject({
      quiz_answer: z.strictObject({
        ...quizAnswerBase,
        accepted: z.array(z.record(quizId, quizId)).min(1),
      }),
    }),
  }),
  z.strictObject({
    ...quizBase,
    quiz_kind: z.literal('parsons'),
    prompt: z.strictObject({ ...quizPromptBase, quiz: ParsonsBody }),
    answer: z.strictObject({
      quiz_answer: z.strictObject({
        ...quizAnswerBase,
        accepted: z
          .array(z.union([z.array(quizId), z.array(ParsonsIndentLine)]))
          .min(1),
      }),
    }),
  }),
  z.strictObject({
    ...quizBase,
    quiz_kind: z.literal('bug_hunt'),
    prompt: z.strictObject({ ...quizPromptBase, quiz: BugHuntBody }),
    answer: z.strictObject({
      quiz_answer: z.strictObject({
        ...quizAnswerBase,
        accepted: z.array(z.strictObject({ line: quizId, fix: quizId })).min(1),
      }),
    }),
  }),
]);

export const QuestSchema = z
  .discriminatedUnion('quest_type', [
    CodeQuestSchema,
    ProjectQuestSchema,
    QuizQuestSchema,
  ])
  .superRefine((quest, ctx) => {
    if (quest.quest_type === 'quiz') {
      checkQuiz(quest, (path, message) =>
        ctx.addIssue({ code: 'custom', path, message }),
      );
      return;
    }
    const report: Report = (path, message) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (quest.quest_type === 'code') {
      checkExample(quest.prompt, quest.answer, ['prompt'], report);
      return;
    }
    quest.steps.forEach((step, index) => {
      checkExample(
        step.prompt,
        step.answer,
        ['steps', index, 'prompt'],
        report,
      );
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
 * 월드 해제 규칙 (worlds.unlock_rule).
 * - `open`: 처음부터 열림 (1월드)
 * - `previous_world_cleared`: 이전 월드를 끝내면 열림 (§12-Q2·Q48). 지금 스테이지 잠금은 이 규칙과 같은 결과를
 *   순서로 냄(월드의 첫 스테이지는 이전 월드의 마지막 스테이지를 깨야 열림, src/lib/world/stageOrder.ts).
 *   "실력 확인 퀴즈"로 바로 여는 규칙은 Phase 10(P10-03)에서 union 에 더합니다.
 */
export const WorldUnlockRuleSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('open') }),
  z.strictObject({ type: z.literal('previous_world_cleared') }),
]);

/**
 * world.yaml → worlds (P1-08). 빌드가 slug 기준으로 업서트하고 stages.world_id 를 채움.
 * id 는 DB 가 정함 (1월드는 00012 가 고정 id 로 만듦).
 */
export const WorldSchema = z.strictObject({
  /** 디렉토리 이름과 같아야 함. worlds.slug */
  slug,
  /** 월드 순서. 전체에서 유일 (worlds."order" UNIQUE) */
  order,
  title: text,
  theme: z.string().regex(/^[a-z0-9_]+$/, '영문 소문자·숫자·밑줄만 써요'),
  description: z.string(),
  unlock_rule: WorldUnlockRuleSchema,
});

/** stage.yaml → stages */
export const StageSchema = z.strictObject({
  id,
  /** 디렉토리 이름 앞 두 자리(NN-)와 같아야 함. 월드 안에서 유일(stages (world_id, "order") UNIQUE, P1-08) */
  order,
  title: text,
  theme_name: z.string().regex(/^[a-z0-9_]+$/, '영문 소문자·숫자·밑줄만 써요'),
  description: z.string(),
  is_final: z.boolean(),
});

// ------------------------------------------------------------
// 월드 지도 (map.yaml, P5-03). DB 에 쓰지 않고 content:build 가 src/lib/world/worlds.generated.ts 로 만듦
// ------------------------------------------------------------

const point = z.tuple([z.number().min(0), z.number().min(0)]);

/** 지도 장식 (그림 종류는 지도 컴포넌트가 정함, P5-02) */
export const MapDecorationSchema = z.strictObject({
  kind: z.enum(['tree', 'mountains', 'waves', 'bird', 'boat']),
  x: z.number(),
  y: z.number(),
  /** 크기 배율. 없으면 1 */
  scale: z.number().positive().optional(),
});

/** 한 레이아웃: viewBox(0 0 width height) 좌표계. nodes[i] = i+1번 스테이지 중심 */
export const MapLayoutSchema = z
  .strictObject({
    width: z.number().positive(),
    height: z.number().positive(),
    /** 노드 옆 랜드마크 그림 배율 (시안 WIDE 1, TALL 0.82) */
    node_scale: z.number().positive(),
    nodes: z.array(point),
    decorations: z.array(MapDecorationSchema).optional(),
  })
  .superRefine((layout, ctx) => {
    layout.nodes.forEach(([x, y], i) => {
      if (x > layout.width || y > layout.height) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', i],
          message: `노드가 지도(${layout.width}×${layout.height}) 밖에 있어요`,
        });
      }
    });
  });

/** 지도 앰비언트 (P5-09). 움직임은 연출 단계 full에서만, 그 밖에는 정지 그림. 없으면 모두 끔 */
export const MapAmbientSchema = z.strictObject({
  /** 먼 레이어 구름 흐름 */
  clouds: z.boolean(),
  /** 바다(물결 옆)·길 위 반짝임 몇 점 */
  sparkles: z.boolean(),
  /** 날씨. leaves = 나뭇잎 몇 장이 천천히 떨어짐 */
  weather: z.enum(['none', 'leaves']),
});

const BGM_IDS = Object.keys(SOUND_MANIFEST.bgm) as [BgmId, ...BgmId[]];

/** map.yaml: 월드 지도 설정. 테마 키는 world.yaml 의 theme, 랜드마크는 stage.yaml 의 theme_name 을 씀 */
export const WorldMapSchema = z.strictObject({
  /** 월드 BGM id (src/lib/sound/manifest.ts) */
  bgm: z.enum(BGM_IDS),
  /** 노드 사이 길 모양. catmull_rom = 부드러운 손그림 곡선(시안 smooth), straight = 직선 */
  path: z.enum(['catmull_rom', 'straight']),
  /** 넓은 화면(가로 지도)과 좁은 화면(세로로 긴 지도). 노드 수는 둘 다 스테이지 수와 같아야 함 */
  layouts: z.strictObject({
    wide: MapLayoutSchema,
    tall: MapLayoutSchema,
  }),
  ambient: MapAmbientSchema.optional(),
});

export type WorldMapConfig = z.infer<typeof WorldMapSchema>;
export type MapLayout = z.infer<typeof MapLayoutSchema>;
export type MapAmbient = z.infer<typeof MapAmbientSchema>;
export type World = z.infer<typeof WorldSchema>;
export type WorldUnlockRule = z.infer<typeof WorldUnlockRuleSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type InputScenario = z.infer<typeof InputScenarioSchema>;
export type CodeQuest = z.infer<typeof CodeQuestSchema>;
export type ProjectQuest = z.infer<typeof ProjectQuestSchema>;
export type QuizQuest = z.infer<typeof QuizQuestSchema>;
export type Quest = z.infer<typeof QuestSchema>;
export type QuestType = Quest['quest_type'];
export type QuizKind = QuizQuest['quiz_kind'];

type QuizOf<K extends QuizKind> = Extract<QuizQuest, { quiz_kind: K }>;

/** 공개 퀴즈 (quests.prompt_skeleton.quiz). 클라이언트 안전: 정답 없음 */
export type QuizPrompt = {
  [K in QuizKind]: { kind: K } & QuizOf<K>['prompt']['quiz'];
}[QuizKind];

/** 퀴즈의 quests.prompt_skeleton 전체 */
export type QuizPromptSkeleton = Omit<QuizQuest['prompt'], 'quiz'> & {
  quiz: QuizPrompt;
};

/** quest_answer_keys.quiz_answer. 서버 전용 (src/lib/quest/answerKeys.ts 에서 다시 내보냄) */
export type QuizAnswer = {
  [K in QuizKind]: { kind: K } & QuizOf<K>['answer']['quiz_answer'];
}[QuizKind];

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

// ------------------------------------------------------------
// 퀴즈 검사 (빌드가 parseQuest 로 부름)
//   1. id 참조: 모든 id 가 한 퀴즈 안에서 유일하고 accepted·explanations 는 있는 id 만
//   2. 차례가 보이는 id: QUIZ_ID_PATTERN 에 더해, parsons 줄을 id 순으로 늘어놓은 것이 정답 순서면 실패
//      (빌드가 줄·보기·토큰·수정안을 id 순으로 내보내므로 그대로 정답이 보임)
//   3. 공개 문장에 정답 (§12-Q20): 제목·주제·목표·이야기·fallback_text·문제 문장에 정답 글자가 그대로 있으면 실패
// ------------------------------------------------------------

type Report = (path: (string | number)[], message: string) => void;

/** 키 순서와 상관없는 비교용 문자열 (accepted 중복 검사) */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** fill_blank 코드의 빈칸 id (나온 차례) */
export function quizBlankIds(code: string): string[] {
  return [...code.matchAll(QUIZ_BLANK_RE)].map((m) => m[1]);
}

/** 정렬 순서: 빌드가 공개 목록을 이 순서로 내보냄 */
export const byQuizId = (a: { id: string }, b: { id: string }) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** needle 이 hay 에 들어 있는지. 영문·숫자로 이어지는 낱말 한가운데는 무시 (`3` 이 `range(30)` 에 걸리지 않게) */
function mentions(hay: string, needle: string): boolean {
  const h = squash(hay);
  const n = squash(needle);
  if (n.length < 2) return false;
  for (let i = h.indexOf(n); i !== -1; i = h.indexOf(n, i + 1)) {
    const before = h[i - 1] ?? ' ';
    const after = h[i + n.length] ?? ' ';
    const word = /[A-Za-z0-9_]/;
    if (
      !(word.test(n[0]) && word.test(before)) &&
      !(word.test(n.at(-1)!) && word.test(after))
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 예시 출력이 정답 규칙을 통과해야 함 (P7-17): 화면이 "이런 모양이면 돼요"로 보여 주므로 따라 하면 통과해야 함.
 * code_check 는 출력이 아니라 코드를 보므로 정답 코드로 확인 (프로젝트 단계·퀘스트 전체에 정답 코드가 있음)
 */
function checkExample(
  prompt: { example_output: string },
  answer: { validation: ValidationRule; solution_code?: string },
  at: (string | number)[],
  report: Report,
): void {
  const ok = validateRule(answer.validation, {
    stdout: prompt.example_output,
    studentCode: answer.solution_code ?? '',
  });
  if (!ok)
    report(
      [...at, 'example_output'],
      '예시 출력이 정답 규칙을 통과하지 않아요 (output_match 면 기준값과 똑같이 써요)',
    );
}

function checkQuiz(quest: QuizQuest, report: Report): void {
  const quiz = quest.prompt.quiz;
  const answer = quest.answer.quiz_answer;
  const A = ['answer', 'quiz_answer'];
  const Q = ['prompt', 'quiz'];

  // 1. id 유일
  const items: { id: string; text: string; path: (string | number)[] }[] = [];
  const add = (
    list: { id: string; text?: string; code?: string }[],
    key: string,
  ) =>
    list.forEach((x, i) =>
      items.push({
        id: x.id,
        text: x.text ?? x.code ?? '',
        path: [...Q, key, i, 'id'],
      }),
    );
  if ('options' in quiz) add(quiz.options, 'options');
  if ('tokens' in quiz) add(quiz.tokens, 'tokens');
  if ('lines' in quiz) add(quiz.lines, 'lines');
  if ('fixes' in quiz) add(quiz.fixes, 'fixes');
  const blanks =
    quest.quiz_kind === 'fill_blank'
      ? quizBlankIds(quest.prompt.quiz.code)
      : [];
  blanks.forEach((id) => {
    if (!QUIZ_ID_PATTERN.test(id))
      report([...Q, 'code'], `빈칸 id '${id}'는 bk-r2fa 처럼 써요`);
    items.push({ id, text: '', path: [...Q, 'code'] });
  });
  const seen = new Set<string>();
  for (const it of items) {
    if (seen.has(it.id))
      report(it.path, `id '${it.id}'가 이 퀴즈 안에서 겹쳐요`);
    seen.add(it.id);
  }
  const idsOf = (key: 'options' | 'tokens' | 'lines' | 'fixes') =>
    new Set(items.filter((it) => it.path[2] === key).map((it) => it.id));
  const textOf = new Map(items.map((it) => [it.id, it.text]));
  const missing = (path: (string | number)[], id: string, what: string) =>
    report(path, `'${id}'는 없는 ${what} id 예요`);

  // accepted 중복
  const acc = answer.accepted as unknown[];
  const keys = acc.map(canonical);
  keys.forEach((k, i) => {
    if (keys.indexOf(k) !== i)
      report([...A, 'accepted', i], '같은 정답이 두 번 있어요');
  });
  for (const id of Object.keys(answer.explanations ?? {})) {
    if (!seen.has(id))
      missing([...A, 'explanations', id], id, '보기·줄·수정안');
  }

  // 정답 글자 (3번 검사용): choices = 고를 거리 중 정답/오답, phrases = 그대로 나오면 안 되는 정답 글
  let correct: string[] = [];
  let wrong: string[] = [];
  const phrases: string[] = [];

  switch (quest.quiz_kind) {
    case 'multiple_choice': {
      const { accepted } = quest.answer.quiz_answer;
      const options = idsOf('options');
      accepted.forEach((id, i) => {
        if (!options.has(id)) missing([...A, 'accepted', i], id, '보기');
      });
      if (new Set(accepted).size >= options.size) {
        report([...A, 'accepted'], '틀린 보기가 하나는 있어야 해요');
      }
      correct = accepted.map((id) => textOf.get(id) ?? '');
      wrong = quest.prompt.quiz.options
        .filter((o) => !accepted.includes(o.id))
        .map((o) => o.text);
      break;
    }
    case 'fill_blank': {
      const { accepted } = quest.answer.quiz_answer;
      const { code } = quest.prompt.quiz;
      const tokens = idsOf('tokens');
      if (blanks.length === 0)
        report([...Q, 'code'], '빈칸({{bk-r2fa}})이 하나는 있어야 해요');
      accepted.forEach((fill, i) => {
        const filled = Object.keys(fill);
        if (
          filled.length !== blanks.length ||
          !blanks.every((b) => b in fill)
        ) {
          report(
            [...A, 'accepted', i],
            `모든 빈칸(${blanks.join(', ')})을 한 번씩 채워야 해요`,
          );
        }
        Object.entries(fill).forEach(([b, t]) => {
          if (!tokens.has(t)) missing([...A, 'accepted', i, b], t, '토큰');
        });
        // 빈칸이 있던 줄을 정답 토큰으로 채운 모습
        code.split('\n').forEach((line) => {
          if (quizBlankIds(line).length === 0) return;
          phrases.push(
            line.replace(
              QUIZ_BLANK_RE,
              (_, b: string) => textOf.get(fill[b]) ?? '',
            ),
          );
        });
      });
      break;
    }
    case 'parsons': {
      const { accepted } = quest.answer.quiz_answer;
      const { lines, indent = false } = quest.prompt.quiz;
      const all = lines.map((l) => l.id);
      const sorted = [...lines].sort(byQuizId).map((l) => l.id);
      if (indent) {
        lines.forEach((l, i) => {
          if (/^\s/.test(l.code))
            report(
              [...Q, 'lines', i, 'code'],
              'indent: true 면 줄 앞에 공백을 쓰지 않아요 (들여쓰기는 정답에)',
            );
        });
      }
      accepted.forEach((order, i) => {
        const ids = order.map((x) => (typeof x === 'string' ? x : x.id));
        if (order.some((x) => (typeof x === 'string') === indent)) {
          report(
            [...A, 'accepted', i],
            indent
              ? 'indent: true 면 {id, indent} 로 써요'
              : '줄 id 만 써요 (indent 는 prompt.quiz.indent: true 일 때만)',
          );
        }
        if (
          ids.length !== all.length ||
          new Set(ids).size !== ids.length ||
          !ids.every((id) => all.includes(id))
        ) {
          report([...A, 'accepted', i], '모든 줄을 한 번씩 써야 해요');
        }
        if (ids.join() === sorted.join()) {
          report(
            [...A, 'accepted', i],
            '줄 id 를 정렬한 차례가 정답 차례와 같아요. 화면에 정답 순서로 나오니 id 를 바꿔요',
          );
        }
        ids
          .slice(1)
          .forEach((id, j) =>
            phrases.push(`${textOf.get(ids[j])}\n${textOf.get(id)}`),
          );
      });
      break;
    }
    case 'bug_hunt': {
      const { accepted } = quest.answer.quiz_answer;
      const lines = idsOf('lines');
      const fixes = idsOf('fixes');
      accepted.forEach((a, i) => {
        if (!lines.has(a.line))
          missing([...A, 'accepted', i, 'line'], a.line, '줄');
        if (!fixes.has(a.fix))
          missing([...A, 'accepted', i, 'fix'], a.fix, '수정안');
      });
      const fixIds = new Set(accepted.map((a) => a.fix));
      correct = [...fixIds].map((id) => textOf.get(id) ?? '');
      wrong = quest.prompt.quiz.fixes
        .filter((f) => !fixIds.has(f.id))
        .map((f) => f.code);
      break;
    }
  }

  // 3. 공개 문장에 정답 (코드·보기 자체는 문제라서 보지 않음)
  const p = quest.prompt;
  const prose: [(string | number)[], string][] = [
    [['title'], quest.title],
    [['prompt', 'topic'], p.topic],
    ...p.learning_goals.map((g, i): [(string | number)[], string] => [
      ['prompt', 'learning_goals', i],
      g,
    ]),
    [['prompt', 'story_context'], p.story_context],
    [['prompt', 'fallback_text'], p.fallback_text],
    [[...Q, 'question'], quiz.question],
  ];
  for (const [path, hay] of prose) {
    // 고를 거리: 정답만 들어 있고 오답은 없으면 정답을 짚는 문장
    const pick = correct.find((c) => mentions(hay, c));
    const leaked =
      (pick !== undefined && !wrong.some((w) => mentions(hay, w))
        ? pick
        : undefined) ?? phrases.find((ph) => mentions(hay, ph));
    if (leaked !== undefined) {
      report(
        path,
        `정답 '${squash(leaked)}'이 공개 문장에 그대로 있어요. 퀴즈는 공개 필드에 정답을 쓰지 않아요 (§12-Q20)`,
      );
    }
  }
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
