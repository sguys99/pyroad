import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  HintLevels,
  ProjectStepAnswer,
  PromptSkeleton,
  QuestAnswerKeyRow,
} from '@/lib/types/database';

/** quest_answer_keys.quiz_answer 모양 (P7-01, 정규형은 src/lib/content/schema.ts 머리 주석) */
export type { QuizAnswer } from '@/lib/content/schema';

/**
 * 퀘스트 정답 조회 (서버 전용, P1-02·B07)
 *
 * 채점 기준(expected_output)·힌트 원문·황금키 정답 코드는 service_role 전용 테이블
 * `quest_answer_keys`에 있고, 서버 코드는 이 모듈로만 읽습니다. 결과를 클라이언트에 그대로 내려보내지 마세요.
 *
 * 운영 적용 순서(① 00004 → 앱 배포 → ③ 00005) 동안 DB는 다음 중 하나입니다.
 * - ①만 적용: 정답이 quest_answer_keys와 quests 양쪽에 있음 (트리거가 복사)
 * - ①+③ 적용: quest_answer_keys에만 있음
 * - ① 전(배포 순서가 어긋난 경우): quest_answer_keys가 없음
 * 그래서 quest_answer_keys 행이 없거나 조회가 실패하면, 같은 요청에서 읽은 quests 행으로 폴백합니다.
 * ③을 운영에 적용·확인한 뒤 폴백(LegacyAnswerSource)을 지웁니다.
 */

type AdminClient = SupabaseClient<Database>;

type AnswerKeyFields = Pick<
  QuestAnswerKeyRow,
  'expected_output' | 'hints' | 'solution_code' | 'steps'
>;

export interface QuestAnswerKey {
  expectedOutput: string;
  hints: HintLevels;
  solutionCode: string | null;
  steps: ProjectStepAnswer[];
  /** 어디서 읽었는지. 'quests'는 폴백 */
  source: 'quest_answer_keys' | 'quests';
}

/** 폴백용: 같은 요청에서 읽은 quests 행 (expected_output, prompt_skeleton 컬럼) */
export interface LegacyAnswerSource {
  expected_output?: string | null;
  prompt_skeleton?: unknown;
}

const ANSWER_KEY_COLUMNS = 'expected_output, hints, solution_code, steps';

// 00004 적용 전: PostgREST가 테이블을 모름(PGRST205) 또는 Postgres 42P01
const TABLE_MISSING_CODES = new Set(['PGRST205', '42P01']);

/** quest_answer_keys 행 조회. 행이 없거나 조회에 실패하면 null (호출부가 quests로 폴백) */
export async function fetchAnswerKeyRow(
  admin: AdminClient,
  questId: string,
): Promise<AnswerKeyFields | null> {
  const { data, error } = await admin
    .from('quest_answer_keys')
    .select(ANSWER_KEY_COLUMNS)
    .eq('quest_id', questId)
    .maybeSingle();

  if (error) {
    if (!TABLE_MISSING_CODES.has(error.code)) {
      console.error('[answerKeys] quest_answer_keys 조회 실패:', error.message);
    }
    return null;
  }
  return data as AnswerKeyFields | null;
}

/**
 * quest_answer_keys 행을 우선 쓰고, 없으면 quests 행의 정답 필드로 폴백한다.
 * 어느 쪽에도 정답이 없으면 null (호출부는 404 등으로 처리. 빈 기준으로 채점하면 모든 답이 통과함)
 */
export function resolveAnswerKey(
  row: AnswerKeyFields | null,
  legacy: LegacyAnswerSource | null,
): QuestAnswerKey | null {
  if (row) {
    const key: QuestAnswerKey = {
      expectedOutput: row.expected_output ?? '',
      hints: toHints(row.hints),
      solutionCode: row.solution_code || null,
      steps: toStepAnswers(row.steps),
      source: 'quest_answer_keys',
    };
    return hasAnswer(key) ? key : null;
  }

  if (!legacy) return null;
  const sk = asRecord(legacy.prompt_skeleton);
  const key: QuestAnswerKey = {
    expectedOutput: str(legacy.expected_output),
    hints: toHints(sk.hints),
    solutionCode: str(sk.solution_code) || null,
    steps: toStepAnswers(sk.steps),
    source: 'quests',
  };
  if (!hasAnswer(key)) return null;
  console.warn(
    '[answerKeys] quest_answer_keys 에 행이 없어 quests 에서 정답을 읽었습니다 (폴백)',
  );
  return key;
}

export function findStepAnswer(
  key: QuestAnswerKey,
  stepNumber: number,
): ProjectStepAnswer | undefined {
  return key.steps.find((s) => s.step_number === stepNumber);
}

export function hintFor(hints: HintLevels, level: 1 | 2 | 3): string {
  return hints[`level_${level}`];
}

/**
 * prompt_skeleton에서 정답 필드(hints, solution_code, steps[]의 expected_output·hints·solution_code)를 지운 사본.
 * ③(00005) 이후에는 원래 없지만, ①만 적용된 DB에서는 quests에도 정답이 남아 있으므로
 * 클라이언트로 내려보내기 전에 항상 거칩니다.
 */
export function stripAnswerFields(skeleton: unknown): PromptSkeleton {
  const rest = { ...asRecord(skeleton) };
  delete rest.hints;
  delete rest.solution_code;
  if (Array.isArray(rest.steps)) {
    rest.steps = rest.steps.map((s) => {
      const step = { ...asRecord(s) };
      delete step.expected_output;
      delete step.hints;
      delete step.solution_code;
      return step;
    });
  }
  return rest as unknown as PromptSkeleton;
}

// ── 내부 ────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toHints(value: unknown): HintLevels {
  const h = asRecord(value);
  return {
    level_1: str(h.level_1),
    level_2: str(h.level_2),
    level_3: str(h.level_3),
  };
}

function toStepAnswers(value: unknown): ProjectStepAnswer[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(asRecord)
    .filter(
      (s) =>
        typeof s.step_number === 'number' &&
        ('expected_output' in s || 'hints' in s || 'solution_code' in s),
    )
    .map((s) => ({
      step_number: s.step_number as number,
      expected_output: str(s.expected_output),
      hints: toHints(s.hints),
      ...(typeof s.solution_code === 'string' && s.solution_code
        ? { solution_code: s.solution_code }
        : {}),
    }));
}

function hasAnswer(key: QuestAnswerKey): boolean {
  return (
    key.expectedOutput !== '' ||
    key.solutionCode !== null ||
    key.steps.length > 0 ||
    Object.values(key.hints).some((h) => h !== '')
  );
}
