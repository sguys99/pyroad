// 콘텐츠 → DB 행 → (a) seed SQL, (b) 검증용 JSON (P1-11, §2.4)
//
// 순수 함수만 있습니다 (파일 읽기·쓰기는 scripts/content/build.ts).
// 공개 부분과 정답 부분을 여기서 나눕니다.
//   quests            : 공개. expected_output 은 항상 '' (00005 CHECK), prompt_skeleton 에 정답 키 없음
//   quest_answer_keys : 정답. service_role 전용 (00004)
// 검증용 JSON 은 행에서 만듭니다. 그래서 같은 함수를 원본 DB 스냅샷에도 적용해 왕복 비교를 할 수 있습니다.

import type { WorldInfo } from '@/lib/world/worlds';
import {
  toStoredRule,
  type StoredRule,
  type ValidationRule,
} from '@/lib/quest/validation';

import type { ContentTree } from './load';
import {
  byQuizId,
  findAnswerKeysInPublic,
  quizBlankIds,
  type InputScenario,
  type Quest,
  type QuestType,
  type QuizAnswer,
  type QuizKind,
  type QuizPrompt,
  type QuizPromptSkeleton,
  type QuizQuest,
  type WorldUnlockRule,
} from './schema';

// ------------------------------------------------------------
// 행 타입 (supabase/migrations 의 컬럼과 같은 이름)
// ------------------------------------------------------------

export interface WorldRow {
  slug: string;
  order: number;
  title: string;
  theme: string;
  description: string;
  unlock_rule: WorldUnlockRule;
}

export interface StageRow {
  id: string;
  /** 월드 slug. seed 는 worlds 에서 id 를 찾아 stages.world_id 에 씀 (P1-08) */
  world: string;
  order: number;
  title: string;
  theme_name: string;
  description: string;
  is_final: boolean;
}

export interface PublicStep {
  step_number: number;
  step_goal: string;
  starter_code: string;
  validation_type: StoredRule['validation_type'];
  fallback_text: string;
}

export interface QuestRow {
  id: string;
  stage_id: string;
  order: number;
  title: string;
  concept: string;
  quest_type: QuestType;
  /** 퀴즈 종류 (P7-01). 퀴즈가 아니면 null (00012 quests_quiz_kind_only_for_quiz) */
  quiz_kind: QuizKind | null;
  /** 키보드 없이 풀 수 있는지 (Phase 7). 퀴즈는 true, 코드·프로젝트 퀘스트는 false */
  is_mobile_friendly: boolean;
  prompt_skeleton: Record<string, unknown> & { steps?: PublicStep[] };
  validation_type: StoredRule['validation_type'];
  /** 00005 이후 항상 '' (정답은 quest_answer_keys). v0.4 운영 적용 뒤 다음 배포에서 컬럼 삭제 (런북 "적용 뒤 정리") */
  expected_output: '';
  xp_reward: number;
}

export interface HintsRow {
  level_1: string;
  level_2: string;
  level_3: string;
}

export interface StepAnswerRow {
  step_number: number;
  expected_output: string;
  hints: HintsRow;
  solution_code: string;
}

export interface AnswerKeyRow {
  quest_id: string;
  expected_output: string;
  /** 퀴즈는 {} (힌트 없음) */
  hints: HintsRow | Record<string, never>;
  solution_code: string | null;
  steps: StepAnswerRow[];
  /** 퀴즈 정답 (P7-01). 퀴즈가 아니면 null */
  quiz_answer: QuizAnswer | null;
}

export interface ContentRows {
  worlds: WorldRow[];
  stages: StageRow[];
  quests: QuestRow[];
  answer_keys: AnswerKeyRow[];
}

/** 빌드 결과에만 있는 부가 정보 (DB 에 쓰지 않음) */
export interface QuestMeta {
  world: string;
  quest_type: QuestType;
  rule: ValidationRule;
  /** 자동 검증 입력 시나리오 (CI 전용, DB 에 쓰지 않음) */
  scenarios?: InputScenario[];
  steps: {
    step_number: number;
    rule: ValidationRule;
    scenarios?: InputScenario[];
  }[];
}

export interface BuildResult {
  rows: ContentRows;
  meta: Map<string, QuestMeta>;
  /** DB 제약 때문에 아직 적용할 수 없는 내용 등 (빌드는 계속함) */
  warnings: string[];
}

// quests.validation_type CHECK(00012, P1-08)가 허용하는 값. 새 유형을 더하면 CHECK 를 넓히는 마이그레이션이 먼저 필요
const QUESTS_CHECK_TYPES = new Set([
  'output_match',
  'contains',
  'contains_any',
  'code_check',
  'all',
]);

/**
 * 퀴즈의 quests.validation_type (P7-01). 퀴즈는 quiz_answer 로만 채점하므로 의미 없는 자리값이고,
 * CHECK(00012)가 허용하는 값 중 'all' 을 씀: 기준값 칸이 '' 라 코드 채점 경로(parseStoredRule)로 잘못 들어와도
 * 규칙을 읽지 못해 항상 불합격 (gradeSubmission 은 그보다 먼저 빈 기준값을 거절)
 */
export const QUIZ_VALIDATION_TYPE =
  'all' satisfies StoredRule['validation_type'];

// ------------------------------------------------------------
// 콘텐츠 → 행
// ------------------------------------------------------------

export function buildRows(tree: ContentTree): BuildResult {
  const rows: ContentRows = {
    worlds: [],
    stages: [],
    quests: [],
    answer_keys: [],
  };
  const meta = new Map<string, QuestMeta>();
  const warnings: string[] = [];

  const worlds = [...tree.worlds].sort((a, b) => a.world.order - b.world.order);
  for (const { world, stages } of worlds) {
    rows.worlds.push({
      slug: world.slug,
      order: world.order,
      title: world.title,
      theme: world.theme,
      description: world.description,
      unlock_rule: { ...world.unlock_rule },
    });
    for (const { stage, quests } of [...stages].sort(
      (a, b) => a.stage.order - b.stage.order,
    )) {
      rows.stages.push({
        id: stage.id,
        world: world.slug,
        order: stage.order,
        title: stage.title,
        theme_name: stage.theme_name,
        description: stage.description,
        is_final: stage.is_final,
      });

      for (const { quest, file } of [...quests].sort(
        (a, b) => a.quest.order - b.quest.order,
      )) {
        const { questRow, answerRow } = splitQuest(quest, stage.id);
        if (!QUESTS_CHECK_TYPES.has(questRow.validation_type)) {
          warnings.push(
            `${file}: 퀘스트 전체 규칙 '${questRow.validation_type}'은 quests.validation_type CHECK(00012)가 막아요. ` +
              'CHECK 를 넓히는 마이그레이션이 먼저 필요해요',
          );
        }
        rows.quests.push(questRow);
        rows.answer_keys.push(answerRow);
        // 퀴즈는 실행할 코드·규칙이 없어 자동 검증(meta) 대상이 아님
        if (quest.quest_type === 'quiz') continue;
        meta.set(quest.id, {
          world: world.slug,
          quest_type: quest.quest_type,
          rule: quest.answer.validation,
          ...(quest.quest_type === 'code' &&
            quest.answer.scenarios && { scenarios: quest.answer.scenarios }),
          steps:
            quest.quest_type === 'project'
              ? quest.steps.map((s) => ({
                  step_number: s.step_number,
                  rule: s.answer.validation,
                  ...(s.answer.scenarios && { scenarios: s.answer.scenarios }),
                }))
              : [],
        });
      }
    }
  }

  assertNoAnswersInPublicRows(rows.quests);
  return { rows, meta, warnings };
}

/** 퀘스트 하나를 공개 행과 정답 행으로 나눈다 */
export function splitQuest(
  quest: Quest,
  stageId: string,
): { questRow: QuestRow; answerRow: AnswerKeyRow } {
  if (quest.quest_type === 'quiz') return splitQuiz(quest, stageId);
  const stored = toStoredRule(quest.answer.validation);
  const p = quest.prompt;

  // 키 순서를 고정해 생성 SQL 이 매번 같게 함 (jsonb 비교에는 영향 없음)
  const skeleton: QuestRow['prompt_skeleton'] = {
    topic: p.topic,
    learning_goals: [...p.learning_goals],
    story_context: p.story_context,
    exercise_description: p.exercise_description,
    starter_code: p.starter_code,
    expected_output_hint: p.expected_output_hint,
    fallback_text: p.fallback_text,
    ...(p.is_challenge === undefined ? {} : { is_challenge: p.is_challenge }),
  };

  const stepAnswers: StepAnswerRow[] = [];
  if (quest.quest_type === 'project') {
    skeleton.steps = quest.steps.map((step) => {
      const s = toStoredRule(step.answer.validation);
      stepAnswers.push({
        step_number: step.step_number,
        expected_output: s.expected_output,
        hints: { ...step.answer.hints },
        solution_code: step.answer.solution_code,
      });
      return {
        step_number: step.step_number,
        step_goal: step.prompt.step_goal,
        starter_code: step.prompt.starter_code,
        validation_type: s.validation_type,
        fallback_text: step.prompt.fallback_text,
      };
    });
  }

  return {
    questRow: {
      id: quest.id,
      stage_id: stageId,
      order: quest.order,
      title: quest.title,
      concept: quest.concept,
      quest_type: quest.quest_type,
      quiz_kind: null,
      is_mobile_friendly: false,
      prompt_skeleton: skeleton,
      validation_type: stored.validation_type,
      expected_output: '',
      xp_reward: quest.xp_reward,
    },
    answerRow: {
      quest_id: quest.id,
      expected_output: stored.expected_output,
      hints: { ...quest.answer.hints },
      solution_code: quest.answer.solution_code ?? null,
      steps: stepAnswers,
      quiz_answer: null,
    },
  };
}

/**
 * 퀴즈 → 공개 행 + 정답 행. 보기·토큰·parsons 줄·수정안은 id 순으로 내보냄(원본에 정답을 앞에 써도 드러나지 않게).
 * bug_hunt 줄은 코드라서 원본 순서 그대로. accepted 는 정규형(schema.ts 머리 주석)으로 키 순서까지 고정
 */
function splitQuiz(
  quest: QuizQuest,
  stageId: string,
): { questRow: QuestRow; answerRow: AnswerKeyRow } {
  const sorted = <T extends { id: string }>(list: T[]) =>
    [...list].sort(byQuizId).map((x) => ({ ...x }));
  let quiz: QuizPrompt;
  let answer: QuizAnswer;
  const a = quest.answer.quiz_answer;
  const explain = {
    explanation: a.explanation,
    ...(a.explanations && {
      explanations: Object.fromEntries(
        Object.entries(a.explanations).sort(([x], [y]) =>
          x < y ? -1 : x > y ? 1 : 0,
        ),
      ),
    }),
  };

  switch (quest.quiz_kind) {
    case 'multiple_choice': {
      const q = quest.prompt.quiz;
      quiz = {
        kind: 'multiple_choice',
        question: q.question,
        ...(q.code !== undefined && { code: q.code }),
        options: sorted(q.options),
      };
      answer = {
        kind: 'multiple_choice',
        accepted: [...quest.answer.quiz_answer.accepted],
        ...explain,
      };
      break;
    }
    case 'fill_blank': {
      const q = quest.prompt.quiz;
      const blanks = quizBlankIds(q.code);
      quiz = {
        kind: 'fill_blank',
        question: q.question,
        code: q.code,
        tokens: sorted(q.tokens),
      };
      answer = {
        kind: 'fill_blank',
        accepted: quest.answer.quiz_answer.accepted.map((fill) =>
          Object.fromEntries(blanks.map((b) => [b, fill[b]])),
        ),
        ...explain,
      };
      break;
    }
    case 'parsons': {
      const q = quest.prompt.quiz;
      quiz = {
        kind: 'parsons',
        question: q.question,
        lines: sorted(q.lines),
        ...(q.indent !== undefined && { indent: q.indent }),
      };
      answer = {
        kind: 'parsons',
        accepted: quest.answer.quiz_answer.accepted.map((order) =>
          order.map((x) =>
            typeof x === 'string' ? x : { id: x.id, indent: x.indent },
          ),
        ) as string[][] | { id: string; indent: number }[][],
        ...explain,
      };
      break;
    }
    case 'bug_hunt': {
      const q = quest.prompt.quiz;
      quiz = {
        kind: 'bug_hunt',
        question: q.question,
        lines: q.lines.map((l) => ({ ...l })),
        fixes: sorted(q.fixes),
      };
      answer = {
        kind: 'bug_hunt',
        accepted: quest.answer.quiz_answer.accepted.map((x) => ({
          line: x.line,
          fix: x.fix,
        })),
        ...explain,
      };
      break;
    }
  }

  const p = quest.prompt;
  const skeleton: QuizPromptSkeleton = {
    topic: p.topic,
    learning_goals: [...p.learning_goals],
    story_context: p.story_context,
    fallback_text: p.fallback_text,
    quiz,
  };

  return {
    questRow: {
      id: quest.id,
      stage_id: stageId,
      order: quest.order,
      title: quest.title,
      concept: quest.concept,
      quest_type: 'quiz',
      quiz_kind: quest.quiz_kind,
      is_mobile_friendly: true,
      prompt_skeleton: skeleton,
      validation_type: QUIZ_VALIDATION_TYPE,
      expected_output: '',
      xp_reward: quest.xp_reward,
    },
    answerRow: {
      quest_id: quest.id,
      expected_output: '',
      hints: {},
      solution_code: null,
      steps: [],
      quiz_answer: answer,
    },
  };
}

/** 공개 행에 정답이 섞였으면 예외 (00005 의 quests_no_answer_fields CHECK 와 같은 검사를 빌드에서 먼저) */
export function assertNoAnswersInPublicRows(quests: QuestRow[]): void {
  const leaks = quests.flatMap((q) => [
    ...(q.expected_output !== '' ? [`${q.id}: expected_output`] : []),
    ...findAnswerKeysInPublic(q.prompt_skeleton).map(
      (path) => `${q.id}: prompt_skeleton.${path}`,
    ),
  ]);
  if (leaks.length > 0) {
    throw new Error(
      `공개 행(quests)에 정답이 섞였어요:\n  ${leaks.join('\n  ')}`,
    );
  }
}

// ------------------------------------------------------------
// (a) seed SQL
// ------------------------------------------------------------

export interface SeedSqlOptions {
  /** 콘텐츠 해시 (ContentTree.hash) */
  hash: string;
}

/**
 * 멱등 seed SQL. DML 만 있고 DDL·GRANT/REVOKE 는 없습니다(권한은 마이그레이션이 정함).
 * - content/ 에 없는 행은 지우지 않습니다. 퀘스트를 지우면 user_progress 가 CASCADE 로 사라지므로
 *   삭제는 마이그레이션에서 따로 합니다.
 * - quest_answer_keys 는 콘텐츠 값으로 통째로 바꿉니다(콘텐츠가 원본). 분리 트리거의 병합 규칙과 다릅니다.
 */
export function toSeedSql(rows: ContentRows, options: SeedSqlOptions): string {
  const stageOrder = new Map(rows.stages.map((s) => [s.id, s.order]));
  const answers = new Map(rows.answer_keys.map((k) => [k.quest_id, k]));
  const counts = countAnswers(rows);
  const out: string[] = [];

  out.push(
    '-- ============================================================',
    '-- pyRoad 콘텐츠 seed — 생성물입니다. 직접 고치지 마세요.',
    '-- 고치려면 content/ 의 YAML 을 고친 뒤 npm run content:build 로 다시 만듭니다 (content/README.md).',
    '-- CI 는 npm run content:build -- --check 로 이 파일이 content/ 와 같은지 확인합니다.',
    `-- 콘텐츠 해시: ${options.hash}`,
    `-- 월드 ${rows.worlds.length} · 스테이지 ${rows.stages.length} · 퀘스트 ${rows.quests.length} · 정답 행 ${rows.answer_keys.length}` +
      ` (solution_code ${counts.solutions} + 프로젝트 단계 ${counts.steps})`,
    '--',
    "-- - quests 에는 공개 부분만 씁니다 (expected_output = '', prompt_skeleton 에 정답 키 없음 → 00005 CHECK 통과).",
    '-- - 정답·힌트·solution_code 는 quest_answer_keys(service_role 전용)에 따로 씁니다.',
    '-- - 다시 실행해도 결과가 같습니다 (ON CONFLICT DO UPDATE). content/ 에 없는 행은 지우지 않습니다.',
    '-- - DML 만 있습니다. 권한(GRANT/REVOKE)은 마이그레이션이 정합니다.',
    "-- - 문자열·jsonb 값은 모두 한 줄 리터럴입니다 (줄바꿈은 E'…\\n…'). SQL Editor 붙여넣기의 CRLF 에 안전 (B39).",
    '--',
    '-- 적용: supabase db reset 이 migrations 다음에 실행합니다. 운영은 SQL Editor 에서 BEGIN; … COMMIT; 으로',
    '--       감싸 실행하고, 00005(③) 뒤에 적용합니다 (docs/release/v0.4-runbook.md "콘텐츠 seed 적용").',
    '--       worlds·stages.world_id·quests.quest_type 을 쓰므로 00012(P1-08) 이후의 스키마가 필요합니다.',
    '-- ============================================================',
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 1. 순서 충돌 방지',
    '--    월드·스테이지·퀘스트의 order 를 바꿀 때 UNIQUE 제약(worlds."order", stages(world_id, "order"),',
    '--    quests(stage_id, "order"))에 걸리지 않도록, 이번에 쓸 행의 기존 order 를 잠시 음수로 옮깁니다.',
    '--    아래 업서트가 제자리로 돌려놓습니다.',
    '-- ------------------------------------------------------------',
    `UPDATE public.worlds SET "order" = -"order" WHERE "order" > 0 AND slug IN (${idList(rows.worlds.map((w) => w.slug))});`,
    `UPDATE public.stages SET "order" = -"order" WHERE "order" > 0 AND id IN (${idList(rows.stages.map((s) => s.id))});`,
    `UPDATE public.quests SET "order" = -"order" WHERE "order" > 0 AND id IN (${idList(rows.quests.map((q) => q.id))});`,
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 2. 월드 (slug 기준. id 는 DB 가 정함: 1월드는 00012 가 만든 고정 id)',
    '-- ------------------------------------------------------------',
    'INSERT INTO public.worlds (slug, "order", title, theme, description, unlock_rule)',
    'VALUES',
    rows.worlds
      .map(
        (w) =>
          `  (${[sqlText(w.slug), String(w.order), sqlText(w.title), sqlText(w.theme), sqlText(w.description), `${sqlText(JSON.stringify(w.unlock_rule))}::jsonb`].join(', ')})`,
      )
      .join(',\n'),
    'ON CONFLICT (slug) DO UPDATE SET',
    '  "order" = EXCLUDED."order", title = EXCLUDED.title, theme = EXCLUDED.theme,',
    '  description = EXCLUDED.description, unlock_rule = EXCLUDED.unlock_rule;',
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 3. 스테이지 (world_id 는 월드 slug 로 찾음. 월드가 없으면 NOT NULL 위반으로 전체 실패)',
    '-- ------------------------------------------------------------',
    'INSERT INTO public.stages (id, world_id, "order", title, theme_name, description, is_final)',
    'VALUES',
    rows.stages
      .map(
        (s) =>
          `  (${[sqlText(s.id), worldIdOf(s.world), String(s.order), sqlText(s.title), sqlText(s.theme_name), sqlText(s.description), s.is_final ? 'TRUE' : 'FALSE'].join(', ')})`,
      )
      .join(',\n'),
    'ON CONFLICT (id) DO UPDATE SET',
    '  world_id = EXCLUDED.world_id, "order" = EXCLUDED."order", title = EXCLUDED.title,',
    '  theme_name = EXCLUDED.theme_name, description = EXCLUDED.description, is_final = EXCLUDED.is_final;',
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 4. 퀘스트 (공개 부분)',
    '-- ------------------------------------------------------------',
  );
  for (const q of rows.quests) {
    out.push(
      '',
      `-- 퀘스트 ${stageOrder.get(q.stage_id)}-${q.order}: ${oneLine(q.title)}`,
      'INSERT INTO public.quests (id, stage_id, "order", title, concept, quest_type, quiz_kind, is_mobile_friendly,',
      '                           prompt_skeleton, validation_type, expected_output, xp_reward)',
      'VALUES (',
      `  ${sqlText(q.id)},`,
      `  ${sqlText(q.stage_id)},`,
      `  ${q.order},`,
      `  ${sqlText(q.title)},`,
      `  ${sqlText(q.concept)},`,
      `  ${sqlText(q.quest_type)},`,
      `  ${q.quiz_kind === null ? 'NULL' : sqlText(q.quiz_kind)},`,
      `  ${q.is_mobile_friendly ? 'TRUE' : 'FALSE'},`,
      `  ${sqlJson(q.prompt_skeleton)},`,
      `  ${sqlText(q.validation_type)},`,
      `  '',`,
      `  ${q.xp_reward}`,
      ')',
      'ON CONFLICT (id) DO UPDATE SET',
      '  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,',
      '  concept = EXCLUDED.concept, quest_type = EXCLUDED.quest_type, quiz_kind = EXCLUDED.quiz_kind,',
      '  is_mobile_friendly = EXCLUDED.is_mobile_friendly, prompt_skeleton = EXCLUDED.prompt_skeleton,',
      '  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,',
      '  xp_reward = EXCLUDED.xp_reward;',
    );
  }
  out.push('');

  out.push(
    '-- ------------------------------------------------------------',
    '-- 5. 정답 (quest_answer_keys, service_role 전용)',
    '-- ------------------------------------------------------------',
  );
  for (const q of rows.quests) {
    const k = answers.get(q.id)!;
    out.push(
      '',
      `-- 정답 ${stageOrder.get(q.stage_id)}-${q.order}: ${oneLine(q.title)}`,
      'INSERT INTO public.quest_answer_keys (quest_id, expected_output, hints, solution_code, steps, quiz_answer)',
      'VALUES (',
      `  ${sqlText(k.quest_id)},`,
      `  ${sqlText(k.expected_output)},`,
      `  ${sqlJson(k.hints)},`,
      `  ${k.solution_code === null ? 'NULL' : sqlText(k.solution_code)},`,
      `  ${sqlJson(k.steps)},`,
      `  ${k.quiz_answer === null ? 'NULL' : sqlJson(k.quiz_answer)}`,
      ')',
      'ON CONFLICT (quest_id) DO UPDATE SET',
      '  expected_output = EXCLUDED.expected_output, hints = EXCLUDED.hints,',
      '  solution_code = EXCLUDED.solution_code, steps = EXCLUDED.steps,',
      '  quiz_answer = EXCLUDED.quiz_answer, updated_at = NOW();',
    );
  }

  return out.join('\n') + '\n';
}

function countAnswers(rows: ContentRows) {
  return {
    solutions: rows.answer_keys.filter((k) => k.solution_code !== null).length,
    steps: rows.answer_keys.reduce((n, k) => n + k.steps.length, 0),
  };
}

/**
 * SQL 문자열 리터럴. 항상 한 줄입니다 (B39).
 * - 제어 문자가 없으면 표준 리터럴 (standard_conforming_strings = on: 역슬래시는 그대로, 작은따옴표만 두 번)
 * - 줄바꿈·탭 등 제어 문자가 있으면 이스케이프 리터럴 E'…' (\n·\r·\t·\b·\f·\xHH, 역슬래시는 두 번)
 * 리터럴 안에 실제 줄바꿈을 두지 않는 이유: Windows 에서 SQL Editor 에 붙여넣으면 줄바꿈이 CRLF 로 바뀌어
 * 여러 줄 리터럴의 값에 \r 이 섞임(정답 비교가 깨짐). 리터럴 밖(토큰 사이·주석)의 \r 은 SQL 에서 공백이라 무해합니다.
 */
export function sqlText(value: string): string {
  if (value.includes('\0'))
    throw new Error('SQL 문자열에 NUL 문자를 넣을 수 없어요');
  if (!CONTROL_CHAR.test(value)) return `'${value.replace(/'/g, "''")}'`;
  return `E'${value.replace(E_STRING_SPECIAL, escapeForEString)}'`;
}

const CONTROL_CHAR = /[\x00-\x1f\x7f]/;
const E_STRING_SPECIAL = /[\\'\x00-\x1f\x7f]/g;
const E_STRING_ESCAPES: Record<string, string> = {
  '\\': '\\\\',
  "'": "''",
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
};

function escapeForEString(ch: string): string {
  return (
    E_STRING_ESCAPES[ch] ??
    `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`
  );
}

/** jsonb 리터럴. 한 줄 JSON (문자열 안의 줄바꿈은 JSON 이 \n 으로 이스케이프하므로 제어 문자가 없음) */
function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value))}::jsonb`;
}

function worldIdOf(slug: string): string {
  return `(SELECT w.id FROM public.worlds w WHERE w.slug = ${sqlText(slug)})`;
}

function idList(ids: string[]): string {
  return ids.length ? ids.map(sqlText).join(', ') : 'NULL';
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ');
}

// ------------------------------------------------------------
// (b) 검증용 JSON (P0-09 fixture 형태, P1-13 이 읽음)
// ------------------------------------------------------------

export interface CheckStep {
  step_number: number;
  validation_type: string;
  expected_output: string;
  starter_code: string | null;
  solution_code: string | null;
  /** input() 입력 시나리오. 콘텐츠에 있을 때만 (빌드에 meta 를 넘긴 경우) */
  scenarios?: InputScenario[];
}

export interface CheckQuest {
  id: string;
  /** `<스테이지 order>-<퀘스트 order>` (P0-09 와 같음). 2월드가 생기면 월드를 앞에 붙임 */
  key: string;
  world: string;
  stage_order: number;
  order: number;
  title: string;
  quest_type: QuestType;
  /** DB 저장 형태 그대로: validateResult({ validationType, expectedOutput }) 에 바로 넣음 */
  validation_type: string;
  expected_output: string;
  starter_code: string | null;
  solution_code: string | null;
  steps: CheckStep[] | null;
  /** input() 입력 시나리오. 콘텐츠에 있을 때만 (빌드에 meta 를 넘긴 경우) */
  scenarios?: InputScenario[];
}

export interface CheckFixture {
  meta: {
    generated_by: string;
    source: string;
    counts: {
      quests: number;
      with_solution: number;
      project_steps: number;
      project_steps_with_solution: number;
    };
  };
  quests: CheckQuest[];
}

export interface FixtureSource {
  /** world(월드 slug)가 없으면 python-island (P1-08 전 DB 스냅샷) */
  stages: (Pick<StageRow, 'id' | 'order'> & { world?: string })[];
  /** quest_type 이 quiz 인 행은 검증용 JSON 에서 뺌 (실행할 정답 코드가 없음). DB 스냅샷처럼 없으면 코드·프로젝트 */
  quests: (Pick<QuestRow, 'id' | 'stage_id' | 'order' | 'title'> & {
    quest_type?: QuestType;
    validation_type: string;
    prompt_skeleton: unknown;
  })[];
  answer_keys: (Pick<
    AnswerKeyRow,
    'quest_id' | 'expected_output' | 'solution_code'
  > & { steps: unknown })[];
}

/**
 * 행(빌드 결과 또는 DB 스냅샷) → 검증용 JSON.
 * 월드는 스테이지 행의 `world`(slug)에서 읽고, 없으면 `worldOf`(기본: python-island)로 정합니다.
 * 입력 시나리오는 DB 에 없으므로 `meta`(buildRows 결과)를 넘길 때만 붙습니다.
 */
export function toCheckFixture(
  rows: FixtureSource,
  options: {
    generatedBy: string;
    source: string;
    worldOf?: (stageId: string) => string;
    meta?: Map<string, Pick<QuestMeta, 'scenarios' | 'steps'>>;
  },
): CheckFixture {
  const stageOrder = new Map(rows.stages.map((s) => [s.id, s.order]));
  const answers = new Map(rows.answer_keys.map((k) => [k.quest_id, k]));
  const stageWorld = new Map(rows.stages.map((s) => [s.id, s.world]));
  const worldOf = (stageId: string) =>
    stageWorld.get(stageId) ?? options.worldOf?.(stageId) ?? 'python-island';

  const quests = rows.quests
    .filter((q) => q.quest_type !== 'quiz')
    .map((q): CheckQuest => {
      const sk = asRecord(q.prompt_skeleton);
      const k = answers.get(q.id);
      const stepAnswers = asArray(k?.steps).map(asRecord);
      const publicSteps = Array.isArray(sk.steps)
        ? sk.steps.map(asRecord)
        : null;
      const so = stageOrder.get(q.stage_id) ?? 0;
      const meta = options.meta?.get(q.id);
      return {
        id: q.id,
        key: `${so}-${q.order}`,
        world: worldOf(q.stage_id),
        stage_order: so,
        order: q.order,
        title: q.title,
        quest_type: publicSteps ? 'project' : 'code',
        validation_type: q.validation_type,
        expected_output: k?.expected_output ?? '',
        starter_code: strOrNull(sk.starter_code),
        solution_code: k?.solution_code ?? null,
        steps: publicSteps
          ? publicSteps.map((s) => {
              const a = stepAnswers.find(
                (x) => x.step_number === s.step_number,
              );
              return {
                step_number: Number(s.step_number),
                validation_type: String(s.validation_type),
                expected_output: strOrNull(a?.expected_output) ?? '',
                starter_code: strOrNull(s.starter_code),
                solution_code: strOrNull(a?.solution_code),
                ...scenariosField(
                  meta?.steps.find((m) => m.step_number === s.step_number)
                    ?.scenarios,
                ),
              };
            })
          : null,
        ...scenariosField(meta?.scenarios),
      };
    })
    .sort((a, b) => a.stage_order - b.stage_order || a.order - b.order);

  return {
    meta: {
      generated_by: options.generatedBy,
      source: options.source,
      counts: {
        quests: quests.length,
        with_solution: quests.filter((q) => q.solution_code).length,
        project_steps: quests.reduce((n, q) => n + (q.steps?.length ?? 0), 0),
        project_steps_with_solution: quests.reduce(
          (n, q) => n + (q.steps?.filter((s) => s.solution_code).length ?? 0),
          0,
        ),
      },
    },
    quests,
  };
}

/** 시나리오가 없으면 키 자체를 빼서 기존 fixture 모양(왕복 비교)과 같게 둔다 */
function scenariosField(scenarios: InputScenario[] | undefined) {
  return scenarios?.length ? { scenarios } : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

// ------------------------------------------------------------
// 월드 목록·지도 → 앱이 import 하는 TS 모듈 (P5-03)
// ------------------------------------------------------------

/**
 * world.yaml + map.yaml → `src/lib/world/worlds.generated.ts` 소스.
 * 지도는 DB 가 아니라 앱 번들로 갑니다(서버·클라이언트 어디서나 import). 이름·준비 여부도 여기 한 곳에서 읽습니다.
 * `ready` 는 스테이지가 있는지에서 나옴 (없으면 "준비 중", 랜딩 worldsData 와 같은 뜻).
 * TS 로 만드는 까닭: 랜딩 글꼴 서브셋 수집기(scripts/fonts/landing-text.mjs)가 TS 모듈만 따라감.
 */
export function toWorldInfos(tree: ContentTree): WorldInfo[] {
  return [...tree.worlds]
    .sort((a, b) => a.world.order - b.world.order)
    .map(({ world, map, stages }) => ({
      slug: world.slug,
      order: world.order,
      title: world.title,
      theme: world.theme,
      unlock_rule: world.unlock_rule,
      ready: stages.length > 0,
      map,
    }));
}

export function toWorldsModule(tree: ContentTree): string {
  const json = JSON.stringify(toWorldInfos(tree), null, 2)
    // 좌표 [x, y] 는 한 줄로 (리뷰하기 쉽게)
    .replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]');
  return [
    '// 생성물: npm run content:build (content/worlds/*/world.yaml·map.yaml, P5-03). 직접 고치지 않습니다.',
    "import type { WorldInfo } from './worlds';",
    '',
    `export const WORLDS: readonly WorldInfo[] = ${json};`,
    '',
  ].join('\n');
}
