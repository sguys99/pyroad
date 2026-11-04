// 콘텐츠 → DB 행 → (a) seed SQL, (b) 검증용 JSON (P1-11, §2.4)
//
// 순수 함수만 있습니다 (파일 읽기·쓰기는 scripts/content/build.ts).
// 공개 부분과 정답 부분을 여기서 나눕니다.
//   quests            : 공개. expected_output 은 항상 '' (00005 CHECK), prompt_skeleton 에 정답 키 없음
//   quest_answer_keys : 정답. service_role 전용 (00004)
// 검증용 JSON 은 행에서 만듭니다. 그래서 같은 함수를 원본 DB 스냅샷에도 적용해 왕복 비교를 할 수 있습니다.

import {
  toStoredRule,
  type StoredRule,
  type ValidationRule,
} from '@/lib/quest/validation';

import type { ContentTree } from './load';
import { findAnswerKeysInPublic, type Quest, type QuestType } from './schema';

// ------------------------------------------------------------
// 행 타입 (supabase/migrations 의 컬럼과 같은 이름)
// ------------------------------------------------------------

export interface StageRow {
  id: string;
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
  prompt_skeleton: Record<string, unknown> & { steps?: PublicStep[] };
  validation_type: StoredRule['validation_type'];
  /** 00005 이후 항상 '' (정답은 quest_answer_keys). P1-12 에서 컬럼 삭제 예정 */
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
  hints: HintsRow;
  solution_code: string | null;
  steps: StepAnswerRow[];
  quiz_answer: null;
}

export interface ContentRows {
  stages: StageRow[];
  quests: QuestRow[];
  answer_keys: AnswerKeyRow[];
}

/** 빌드 결과에만 있는 부가 정보 (DB 에 쓰지 않음) */
export interface QuestMeta {
  world: string;
  quest_type: QuestType;
  rule: ValidationRule;
  steps: { step_number: number; rule: ValidationRule }[];
}

export interface BuildResult {
  rows: ContentRows;
  meta: Map<string, QuestMeta>;
  /** DB 제약 때문에 아직 적용할 수 없는 내용 등 (빌드는 계속함) */
  warnings: string[];
}

// 00001 의 quests.validation_type CHECK 가 허용하는 값. 새 유형(contains_any, all)은 프로젝트 단계
// (prompt_skeleton.steps[], jsonb)에는 쓸 수 있지만, 퀘스트 전체 규칙에 쓰려면 CHECK 를 넓히는 마이그레이션이 필요
const QUESTS_CHECK_TYPES = new Set(['output_match', 'contains', 'code_check']);

// ------------------------------------------------------------
// 콘텐츠 → 행
// ------------------------------------------------------------

export function buildRows(tree: ContentTree): BuildResult {
  const rows: ContentRows = { stages: [], quests: [], answer_keys: [] };
  const meta = new Map<string, QuestMeta>();
  const warnings: string[] = [];

  const worlds = [...tree.worlds].sort((a, b) => a.world.order - b.world.order);
  for (const { world, stages } of worlds) {
    for (const { stage, quests } of [...stages].sort(
      (a, b) => a.stage.order - b.stage.order,
    )) {
      rows.stages.push({
        id: stage.id,
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
            `${file}: 퀘스트 전체 규칙 '${questRow.validation_type}'은 지금 quests.validation_type CHECK(00001)가 막아요. ` +
              'CHECK 를 넓히는 마이그레이션(P1-08/P1-12)이 먼저 필요해요',
          );
        }
        rows.quests.push(questRow);
        rows.answer_keys.push(answerRow);
        meta.set(quest.id, {
          world: world.slug,
          quest_type: quest.quest_type,
          rule: quest.answer.validation,
          steps:
            quest.quest_type === 'project'
              ? quest.steps.map((s) => ({
                  step_number: s.step_number,
                  rule: s.answer.validation,
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
    '-- pyRoad 콘텐츠 seed — 자동 생성 파일입니다. 직접 고치지 마세요.',
    '-- 원본: content/ (content/README.md) · 생성: npm run content:build',
    `-- 콘텐츠 해시: ${options.hash}`,
    `-- 스테이지 ${rows.stages.length} · 퀘스트 ${rows.quests.length} · 정답 행 ${rows.answer_keys.length}` +
      ` (solution_code ${counts.solutions} + 프로젝트 단계 ${counts.steps})`,
    '--',
    "-- - quests 에는 공개 부분만 씁니다 (expected_output = '', prompt_skeleton 에 정답 키 없음 → 00005 CHECK 통과).",
    '-- - 정답·힌트·solution_code 는 quest_answer_keys(service_role 전용)에 따로 씁니다.',
    '-- - 다시 실행해도 결과가 같습니다 (ON CONFLICT DO UPDATE). content/ 에 없는 행은 지우지 않습니다.',
    '-- - DML 만 있습니다. 권한(GRANT/REVOKE)은 마이그레이션이 정합니다.',
    '-- ============================================================',
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 1. 순서 충돌 방지',
    '--    스테이지·퀘스트의 order 를 바꿀 때 UNIQUE 제약(stages."order", quests(stage_id, "order"))에',
    '--    걸리지 않도록, 이번에 쓸 행의 기존 order 를 잠시 음수로 옮깁니다. 아래 업서트가 제자리로 돌려놓습니다.',
    '-- ------------------------------------------------------------',
    `UPDATE public.stages SET "order" = -"order" WHERE "order" > 0 AND id IN (${idList(rows.stages.map((s) => s.id))});`,
    `UPDATE public.quests SET "order" = -"order" WHERE "order" > 0 AND id IN (${idList(rows.quests.map((q) => q.id))});`,
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 2. 스테이지',
    '-- ------------------------------------------------------------',
    'INSERT INTO public.stages (id, "order", title, theme_name, description, is_final)',
    'VALUES',
    rows.stages
      .map(
        (s) =>
          `  (${[sqlText(s.id), String(s.order), sqlText(s.title), sqlText(s.theme_name), sqlText(s.description), s.is_final ? 'TRUE' : 'FALSE'].join(', ')})`,
      )
      .join(',\n'),
    'ON CONFLICT (id) DO UPDATE SET',
    '  "order" = EXCLUDED."order", title = EXCLUDED.title, theme_name = EXCLUDED.theme_name,',
    '  description = EXCLUDED.description, is_final = EXCLUDED.is_final;',
    '',
  );

  out.push(
    '-- ------------------------------------------------------------',
    '-- 3. 퀘스트 (공개 부분)',
    '-- ------------------------------------------------------------',
  );
  for (const q of rows.quests) {
    out.push(
      '',
      `-- 퀘스트 ${stageOrder.get(q.stage_id)}-${q.order}: ${oneLine(q.title)}`,
      'INSERT INTO public.quests (id, stage_id, "order", title, concept, prompt_skeleton, validation_type, expected_output, xp_reward)',
      'VALUES (',
      `  ${sqlText(q.id)},`,
      `  ${sqlText(q.stage_id)},`,
      `  ${q.order},`,
      `  ${sqlText(q.title)},`,
      `  ${sqlText(q.concept)},`,
      `  ${sqlJson(q.prompt_skeleton)},`,
      `  ${sqlText(q.validation_type)},`,
      `  '',`,
      `  ${q.xp_reward}`,
      ')',
      'ON CONFLICT (id) DO UPDATE SET',
      '  stage_id = EXCLUDED.stage_id, "order" = EXCLUDED."order", title = EXCLUDED.title,',
      '  concept = EXCLUDED.concept, prompt_skeleton = EXCLUDED.prompt_skeleton,',
      '  validation_type = EXCLUDED.validation_type, expected_output = EXCLUDED.expected_output,',
      '  xp_reward = EXCLUDED.xp_reward;',
    );
  }
  out.push('');

  out.push(
    '-- ------------------------------------------------------------',
    '-- 4. 정답 (quest_answer_keys, service_role 전용)',
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
      '  NULL',
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

/** SQL 문자열 리터럴 (standard_conforming_strings = on: 역슬래시는 그대로, 작은따옴표만 두 번) */
export function sqlText(value: string): string {
  if (value.includes('\0'))
    throw new Error('SQL 문자열에 NUL 문자를 넣을 수 없어요');
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlText(JSON.stringify(value, null, 2))}::jsonb`;
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
  stages: Pick<StageRow, 'id' | 'order'>[];
  quests: (Pick<QuestRow, 'id' | 'stage_id' | 'order' | 'title'> & {
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
 * 월드는 아직 DB 에 없으므로 `worldOf`로 받습니다(기본: 모두 python-island).
 */
export function toCheckFixture(
  rows: FixtureSource,
  options: {
    generatedBy: string;
    source: string;
    worldOf?: (stageId: string) => string;
  },
): CheckFixture {
  const stageOrder = new Map(rows.stages.map((s) => [s.id, s.order]));
  const answers = new Map(rows.answer_keys.map((k) => [k.quest_id, k]));
  const worldOf = options.worldOf ?? (() => 'python-island');

  const quests = rows.quests
    .map((q): CheckQuest => {
      const sk = asRecord(q.prompt_skeleton);
      const k = answers.get(q.id);
      const stepAnswers = asArray(k?.steps).map(asRecord);
      const publicSteps = Array.isArray(sk.steps)
        ? sk.steps.map(asRecord)
        : null;
      const so = stageOrder.get(q.stage_id) ?? 0;
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
              };
            })
          : null,
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
