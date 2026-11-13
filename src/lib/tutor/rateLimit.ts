import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { captureServerError } from '@/lib/observability/server';
import { tutorRateLimitMessage, type TutorRateLimitScope } from './messages';
import type { TutorRequest } from './types';

/**
 * 튜터 API 사용자별 요청 한도 (P1-19).
 *
 * 서버리스 인스턴스마다 메모리가 따로라 인메모리 카운터로는 한도가 지켜지지 않으므로 Postgres 에 센다
 * (`consume_rate_limit`, service_role 전용, 00016). 요청 유형마다 "분당 / 하루(KST)" 두 창을 함께 본다.
 *
 * 값은 아이의 정상 학습 속도를 넘지 않게 잡았다 (근거는 각 줄, 운영에서 바꾸려면 env `TUTOR_LIMIT_<이름>=분당/하루`):
 * 캐시 적중(quest_intro·stage_summary)도 센다. 캐시는 인스턴스마다 따로라 같은 요청도 적중 여부가 그때그때 다르고,
 * 아이에게 보이는 한도가 운에 따라 달라지면 안 되기 때문이다. 대신 두 유형은 정상 사용보다 넉넉하게 잡았다.
 */
export interface RateLimit {
  perMinute: number;
  perDay: number;
}

type TutorType = TutorRequest['type'];

export const TUTOR_RATE_LIMITS: Record<TutorType, RateLimit & { env: string }> =
  {
    // 퀘스트에 들어갈 때 1번. 퀘스트를 빠르게 오가도 분당 8번이면 충분. 하루 60 = 퀘스트 60번 입장
    quest_intro: { env: 'TUTOR_LIMIT_INTRO', perMinute: 8, perDay: 60 },
    // 단계마다 최대 3번(1·2·3단계). 프로젝트는 단계마다 다시 3번. 분당 6 = 두 단계 연속으로 모두 받아도 통과
    hint_generator: { env: 'TUTOR_LIMIT_HINT', perMinute: 6, perDay: 60 },
    // 실행할 때마다 1번(+ 프로젝트 단계 통과 1번). 5초마다 실행해도 통과하는 분당 12, 가장 자주 쓰므로 하루 200
    code_feedback: { env: 'TUTOR_LIMIT_FEEDBACK', perMinute: 12, perDay: 200 },
    // 퀘스트 완료마다 1번
    encouragement: {
      env: 'TUTOR_LIMIT_ENCOURAGEMENT',
      perMinute: 4,
      perDay: 40,
    },
    // 프로젝트 단계에 들어갈 때마다 1번 (지금 프로젝트는 5단계)
    project_guide: { env: 'TUTOR_LIMIT_GUIDE', perMinute: 6, perDay: 40 },
    // 스테이지 클리어 때 1번 (1월드 스테이지 7개). 클리어 화면을 다시 열어도 넉넉하게
    stage_summary: { env: 'TUTOR_LIMIT_SUMMARY', perMinute: 3, perDay: 20 },
    // "개념만 알려 줘요" 버튼 (P6-10). 퀘스트마다 한두 번이면 충분, 캐시 적중도 셈
    concept_explain: { env: 'TUTOR_LIMIT_CONCEPT', perMinute: 4, perDay: 40 },
    // 퀴즈 오답 뒤 "왜 틀렸어요?" (P7-08). 오답마다 한 번(퀴즈마다 최대 2번) + 오늘의 퀴즈 3문제
    quiz_explain: {
      env: 'TUTOR_LIMIT_QUIZ',
      perMinute: 4,
      perDay: 60,
    },
    // 자유 질문 (P9-17). 아이가 직접 쓰므로 버튼보다 빡빡하게: 분당 3, 하루 20 (안전 설계 docs/tutor-free-input.md)
    free_question: {
      env: 'TUTOR_LIMIT_FREE',
      perMinute: 3,
      perDay: 20,
    },
  };

/**
 * 본인 API 키 사용자는 LLM 비용을 본인이 내므로 하루 한도를 크게 늘린다(×5).
 * 분당 한도는 서버 부하(함수 실행 시간)와 남용 방지용이라 조금만 늘린다(×2). env `TUTOR_LIMIT_OWN_KEY_MULTIPLIER=분/하루`
 */
export const OWN_KEY_MULTIPLIER: RateLimit = { perMinute: 2, perDay: 5 };
const OWN_KEY_MULTIPLIER_ENV = 'TUTOR_LIMIT_OWN_KEY_MULTIPLIER';

/** env 값 상한 (DB integer 범위 안에서 곱하도록) */
const MAX_LIMIT = 100_000;

/** "분당/하루" 형식. 둘 다 1 이상의 정수여야 하고, 아니면 null (기본값을 씀) */
export function parseRateLimitEnv(value: string | undefined): RateLimit | null {
  const m = value?.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const perMinute = Number(m[1]);
  const perDay = Number(m[2]);
  if (
    perMinute < 1 ||
    perDay < 1 ||
    perMinute > MAX_LIMIT ||
    perDay > MAX_LIMIT
  )
    return null;
  return { perMinute, perDay };
}

const warnedEnv = new Set<string>();
function readEnvLimit(
  name: string,
  env: Record<string, string | undefined>,
): RateLimit | null {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return null;
  const parsed = parseRateLimitEnv(raw);
  if (!parsed && !warnedEnv.has(name)) {
    warnedEnv.add(name);
    console.warn(
      `[tutor] ${name} 형식이 잘못됨 ("분당/하루", 예: 6/60) → 기본값 사용`,
    );
  }
  return parsed;
}

/** 요청 유형·키 종류에 맞는 한도 */
export function getTutorRateLimit(
  type: TutorType,
  ownKey: boolean,
  env: Record<string, string | undefined> = process.env,
): RateLimit {
  const def = TUTOR_RATE_LIMITS[type];
  const base = readEnvLimit(def.env, env) ?? def;
  // 자유 질문은 본인 키여도 늘리지 않는다 (P9-17): 한도는 비용보다 아이가 AI와 자유롭게 나누는 대화량을 묶는 안전장치
  if (!ownKey || type === 'free_question')
    return { perMinute: base.perMinute, perDay: base.perDay };
  const mult = readEnvLimit(OWN_KEY_MULTIPLIER_ENV, env) ?? OWN_KEY_MULTIPLIER;
  return {
    perMinute: Math.min(MAX_LIMIT, base.perMinute * mult.perMinute),
    perDay: Math.min(MAX_LIMIT, base.perDay * mult.perDay),
  };
}

export interface QuotaResult {
  allowed: boolean;
  /** 거부일 때 다시 해도 되는 때까지 초 (1 이상) */
  retryAfter: number;
  remaining: number;
  scope: TutorRateLimitScope | null;
  /** 이번 분 창·오늘 거부한 수 (이번 거부 포함). 짧은 시간 반복 초과 판단용 */
  deniedMinute: number;
  deniedToday: number;
  /** DB 호출이 실패해 한도 없이 통과시켰는지 (fail-open) */
  failedOpen?: boolean;
}

const FAIL_OPEN: QuotaResult = {
  allowed: true,
  retryAfter: 0,
  remaining: 0,
  scope: null,
  deniedMinute: 0,
  deniedToday: 0,
  failedOpen: true,
};

function toInt(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * 한도를 1 차감한다. 사용자 id 는 `auth.getUser()`로 확인한 값만 넘긴다.
 *
 * DB 호출이 실패하면(00016 미적용, 일시 오류) **통과시킨다**(fail-open). 한도 때문에 튜터 전체가 멈추지 않게 하고,
 * 실패는 로그·Sentry(같은 에러 10분 3회 제한, P1-16)로 알린다. 입력으로 RPC 를 실패하게 만들 수는 없다(id·유형은 서버가 정함).
 */
export function consumeTutorQuota(
  admin: SupabaseClient<Database>,
  userId: string,
  type: TutorType,
  limit: RateLimit,
): Promise<QuotaResult> {
  return consumeRateLimit(admin, userId, `tutor:${type}`, limit, 'tutor');
}

/** 범용: 버킷 이름(`<영역>:<종류>`)으로 한도 1 차감. 퀴즈 채점(`quiz:answer`, P7-02)도 씀. 실패 처리는 위와 같음 */
export async function consumeRateLimit(
  admin: SupabaseClient<Database>,
  userId: string,
  bucket: string,
  limit: RateLimit,
  area: string,
): Promise<QuotaResult> {
  try {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_user_id: userId,
      p_bucket: bucket,
      p_per_minute: limit.perMinute,
      p_per_day: limit.perDay,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    const row = data as Record<string, unknown> | null;
    if (!row || typeof row.allowed !== 'boolean') {
      throw new Error('consume_rate_limit: 알 수 없는 응답');
    }
    const scope =
      row.scope === 'minute' || row.scope === 'day' ? row.scope : null;
    return {
      allowed: row.allowed,
      retryAfter: row.allowed ? 0 : Math.max(1, toInt(row.retry_after)),
      remaining: toInt(row.remaining),
      scope: row.allowed ? null : (scope ?? 'minute'),
      deniedMinute: toInt(row.denied_minute),
      deniedToday: toInt(row.denied_today),
    };
  } catch (error) {
    console.error(
      `[${area}] consume_rate_limit 실패:`,
      error instanceof Error ? error.message : error,
    );
    captureServerError(error, { tags: { area, op: 'rate_limit' } });
    return FAIL_OPEN;
  }
}

/** 한도 초과 응답 본문 (`useTutor`가 읽음) */
export interface TutorRateLimitedBody {
  error: 'rate_limited';
  /** 아이에게 보여 줄 문구 */
  message: string;
  retry_after: number;
  scope: TutorRateLimitScope;
}

/** 429 + `Retry-After`. 스트림 route 도 스트림을 열기 전에 이 JSON 으로 답한다 */
export function rateLimitedResponse(result: QuotaResult): Response {
  const scope = result.scope ?? 'minute';
  const body: TutorRateLimitedBody = {
    error: 'rate_limited',
    message: tutorRateLimitMessage(result.retryAfter, scope),
    retry_after: result.retryAfter,
    scope,
  };
  return Response.json(body, {
    status: 429,
    headers: { 'Retry-After': String(result.retryAfter) },
  });
}
