import 'server-only';

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/database';
import { SKIN_IDS, type SkinId } from '@/lib/avatar/skins';
import {
  AGREEMENT_ITEMS,
  GUARDIAN_AGREEMENT_ITEMS,
  GUARDIAN_RELATIONS,
  type AgreementItem,
  type GuardianRelation,
} from '@/lib/legal/agreements';
import type { AgeBand } from '@/lib/consent/age';
import { NICKNAME_MAX_LENGTH, validateNickname } from '@/lib/profile/nickname';
import { suggestNickname, type Rng } from '@/lib/profile/nicknameSuggest';
import { captureServerError } from '@/lib/observability/server';
import { parseRateLimitEnv, type RateLimit } from '@/lib/tutor/rateLimit';
import type { OnboardingRequest } from './api';
import { onboardingVariant } from './returning';

/**
 * 온보딩 서버 도우미 (P3-11): 요청 검사, 동의 확인, 닉네임 중복·추천, 요청 한도, 저장 RPC.
 * API Route(`src/app/api/onboarding`, `src/app/api/profile/nickname`)만 쓴다. 사용자 id 는 `auth.getUser()`로 확인한 값만 넘긴다.
 */

type Admin = SupabaseClient<Database>;

/** 요청 본문 (zod strict: 정해 둔 키 밖의 값이 오면 거부) */
const agreementRecords = z
  .array(
    z
      .object({
        id: z.string().max(32),
        version: z.string().max(32),
        agreed: z.boolean(),
      })
      .strict(),
  )
  .max(8);

const relation = z.enum(
  GUARDIAN_RELATIONS.map((r) => r.id) as [
    GuardianRelation,
    ...GuardianRelation[],
  ],
);

/** 보호자 동의 (P3-15): 보호자 항목 기록 + 관계(선택). 보호자 이름·연락처는 받지 않음 */
export const guardianConsentSchema = z
  .object({ agreements: agreementRecords, relation: relation.nullable() })
  .strict();

/** 요청 본문 (zod strict: 정해 둔 키 밖의 값이 오면 거부) */
export const onboardingRequestSchema = z
  .object({
    // 글자 규칙은 validateNickname 이 본다. 여기서는 터무니없이 긴 값만 막음
    nickname: z.string().max(64),
    skin: z.enum(SKIN_IDS),
    grade: z.number().int().min(1).max(6).nullable(),
    agreements: agreementRecords,
    // 나이 확인 답 (P3-15). 서버가 KST 오늘로 다시 계산하고 결과만 저장 — 태어난 해·달은 저장·기록하지 않음
    age: z
      .object({
        year: z.union([
          z.number().int().min(1900).max(2200),
          z.literal('older'),
          z.literal('unknown'),
        ]),
        month: z.number().int().min(1).max(12).optional(),
        birthdayPassed: z.boolean().optional(),
      })
      .strict(),
    guardian: guardianConsentSchema.nullable(),
  })
  .strict();

export function parseOnboardingRequest(
  body: unknown,
): OnboardingRequest | null {
  const parsed = onboardingRequestSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/**
 * 필수 동의를 **지금 문서 버전으로** 모두 했는지. 했으면 저장할 기록(동의한 항목만), 아니면 null.
 * 모르는 항목·지난 버전·동의하지 않은 필수 항목이 있으면 null (화면이 오래된 버전을 들고 있으면 다시 동의받음)
 */
export function agreedRecords(
  records: OnboardingRequest['agreements'],
): { item: string; version: string }[] | null {
  return agreedRecordsFor(AGREEMENT_ITEMS, records);
}

/** 보호자 동의 기록 (P3-15): 보호자 항목 모두(필수)를 지금 버전으로. 아니면 null */
export function guardianRecords(
  records: OnboardingRequest['agreements'],
): { item: string; version: string }[] | null {
  return agreedRecordsFor(GUARDIAN_AGREEMENT_ITEMS, records);
}

function agreedRecordsFor(
  items: readonly AgreementItem[],
  records: OnboardingRequest['agreements'],
): { item: string; version: string }[] | null {
  const known = new Map(items.map((i) => [i.id as string, i]));
  for (const r of records) {
    const item = known.get(r.id);
    if (!item || r.version !== item.version) return null;
  }
  for (const item of items) {
    if (!item.required) continue;
    if (!records.some((r) => r.id === item.id && r.agreed)) return null;
  }
  return records
    .filter((r) => r.agreed)
    .map((r) => ({ item: r.id, version: r.version }));
}

// ── 요청 한도 (00016 consume_rate_limit) ───────────────────────

/**
 * 닉네임 확인: 입력 중 디바운스(약 0.45초)로 부르므로 빠르게 고쳐 써도 분당 30이면 넉넉하다.
 * 하루 300 = 다른 아이의 닉네임을 훑어보는 용도로는 쓸모없을 만큼. env `PROFILE_LIMIT_NICKNAME=분/하루`
 */
export const NICKNAME_CHECK_LIMIT: RateLimit = { perMinute: 30, perDay: 300 };
/** 온보딩 저장: 중복으로 다시 누르는 것까지 분당 10. env `PROFILE_LIMIT_ONBOARDING` */
export const ONBOARDING_SAVE_LIMIT: RateLimit = { perMinute: 10, perDay: 60 };

export type ProfileBucket =
  | 'profile:nickname'
  | 'profile:onboarding'
  | 'profile:guardian';

const LIMIT_ENV: Record<ProfileBucket, [string, RateLimit]> = {
  'profile:nickname': ['PROFILE_LIMIT_NICKNAME', NICKNAME_CHECK_LIMIT],
  'profile:onboarding': ['PROFILE_LIMIT_ONBOARDING', ONBOARDING_SAVE_LIMIT],
  // 보호자 동의 (P3-15): 저장과 같은 한도
  'profile:guardian': ['PROFILE_LIMIT_ONBOARDING', ONBOARDING_SAVE_LIMIT],
};

/**
 * 한도를 1 차감. 거부면 `{ allowed: false, retryAfter }`.
 * DB 호출이 실패하면 통과시킨다(fail-open, 튜터 한도와 같음): 온보딩이 한도 때문에 막히지 않게 하고 로그·Sentry로 알림
 */
export async function consumeProfileQuota(
  admin: Admin,
  userId: string,
  bucket: ProfileBucket,
  env: Record<string, string | undefined> = process.env,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const [envName, fallback] = LIMIT_ENV[bucket];
  const limit = parseRateLimitEnv(env[envName]) ?? fallback;
  try {
    const { data, error } = await admin.rpc('consume_rate_limit', {
      p_user_id: userId,
      p_bucket: bucket,
      p_per_minute: limit.perMinute,
      p_per_day: limit.perDay,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    const row = (data ?? {}) as { allowed?: unknown; retry_after?: unknown };
    if (row.allowed === false) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.trunc(Number(row.retry_after)) || 1),
      };
    }
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    console.error(
      `[onboarding] consume_rate_limit(${bucket}) 실패:`,
      error instanceof Error ? error.message : error,
    );
    captureServerError(error, {
      tags: { area: 'onboarding', op: 'rate_limit' },
    });
    return { allowed: true, retryAfter: 0 };
  }
}

// ── 닉네임 중복·추천 ─────────────────────────────────────────

/** 다른 사용자가 쓰는 닉네임인지 (본인 행 제외). DB 오류면 throw → 부르는 쪽이 reportServerError */
export async function isNicknameTaken(
  admin: Admin,
  nickname: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc('is_nickname_taken', {
    p_nickname: nickname,
    p_user_id: userId,
  });
  if (error) throw error;
  return data === true;
}

/**
 * 중복일 때 권할 후보: 입력한 이름 뒤에 숫자 두 개(10자를 넘지 않을 때) → 아니면 랜덤 추천 + 숫자.
 * 모두 `validateNickname`을 통과한 값만 (숫자를 붙여 예약어·금칙어가 되는 일은 없지만 한 번 더 확인)
 */
export function suggestionCandidates(
  base: string,
  rng: Rng = Math.random,
  count = 4,
): string[] {
  const out: string[] = [];
  const baseLength = Array.from(base).length;
  for (let i = 0; i < count; i++) {
    const digits = String(Math.floor(rng() * 100)).padStart(2, '0');
    const candidate =
      i < 2 && baseLength + 2 <= NICKNAME_MAX_LENGTH
        ? base + digits
        : suggestNickname(rng, { withNumber: true });
    const checked = validateNickname(candidate);
    if (checked.ok && !out.includes(checked.nickname))
      out.push(checked.nickname);
  }
  return out;
}

/** 비어 있는 추천 이름 하나 (못 찾으면 undefined). DB 오류도 undefined (추천은 덤이라 실패해도 안내는 그대로) */
export async function findFreeSuggestion(
  admin: Admin,
  userId: string,
  base: string,
  rng: Rng = Math.random,
): Promise<string | undefined> {
  try {
    for (const candidate of suggestionCandidates(base, rng)) {
      if (!(await isNicknameTaken(admin, candidate, userId))) return candidate;
    }
  } catch (error) {
    console.error(
      '[onboarding] 추천 닉네임 확인 실패:',
      error instanceof Error ? error.message : error,
    );
  }
  return undefined;
}

// ── 기존 사용자 (P3-12) ───────────────────────────────────────

/**
 * 온보딩을 마친 직후 분석용: 이 아이가 온보딩 전부터 학습하던 기존 사용자였는지 (경험치·진행 행).
 * 닉네임은 방금 저장했으므로 신호로 쓰지 않는다. DB 오류면 false (분석 값일 뿐)
 */
export async function wasReturningUser(
  admin: Admin,
  userId: string,
): Promise<boolean> {
  try {
    const [user, progress] = await Promise.all([
      admin.from('users').select('total_xp').eq('id', userId).maybeSingle(),
      admin
        .from('user_progress')
        .select('quest_id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);
    return (
      onboardingVariant({
        totalXp: user.data?.total_xp,
        progressCount: progress.count,
        nickname: null,
      }) === 'returning'
    );
  } catch {
    return false;
  }
}

// ── 저장 ────────────────────────────────────────────────────

export interface CompleteOnboardingInput {
  nickname: string;
  skin: SkinId;
  grade: number | null;
  agreements: { item: string; version: string }[];
  ageBand: AgeBand;
  /** 보호자 동의 기록 (만 14세 미만이고 보호자가 함께 동의했을 때만) */
  guardian: {
    agreements: { item: string; version: string }[];
    relation: GuardianRelation | null;
  } | null;
}

export type CompleteOnboardingResult =
  | { ok: true; first: boolean; restricted: boolean }
  | { ok: false; reason: 'taken' | 'error'; error?: unknown };

/** `complete_onboarding`(00023): 닉네임·스킨·학년·완료 시각 + 동의 기록을 한 트랜잭션에 */
export async function completeOnboarding(
  admin: Admin,
  userId: string,
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const { data, error } = await admin.rpc('complete_onboarding', {
    p_user_id: userId,
    p_nickname: input.nickname,
    p_skin: input.skin,
    // 학년을 건너뛰면 NULL (생성 타입이 nullable 인자를 number 로만 적음)
    p_grade: input.grade as number,
    p_agreements: input.agreements as unknown as Json,
    p_method: 'self',
    p_age_band: input.ageBand,
    p_guardian_agreements: (input.guardian?.agreements ??
      null) as unknown as Json,
    p_guardian_relation: (input.guardian?.relation ?? null) as string,
  });
  if (error) {
    // 닉네임 유일 인덱스(users_nickname_lower_key) 위반 = 그사이 다른 친구가 먼저 씀
    if (error.code === '23505') return { ok: false, reason: 'taken' };
    return { ok: false, reason: 'error', error };
  }
  const row = (data ?? {}) as { first?: unknown; restricted?: unknown };
  return {
    ok: true,
    first: row.first === true,
    restricted: row.restricted === true,
  };
}

export type GuardianConsentResult =
  | { ok: true; first: boolean }
  | { ok: false; reason: 'not_under14' | 'error'; error?: unknown };

/** `record_guardian_consent`(00024): 나중에 보호자 동의 (제한 모드 → 해제). 방법은 보호자가 이 화면에서 함께 (Q35) */
export async function recordGuardianConsent(
  admin: Admin,
  userId: string,
  agreements: { item: string; version: string }[],
  relation: GuardianRelation | null,
): Promise<GuardianConsentResult> {
  const { data, error } = await admin.rpc('record_guardian_consent', {
    p_user_id: userId,
    p_agreements: agreements as unknown as Json,
    p_relation: relation as string,
    p_method: 'guardian_in_person',
  });
  if (error) {
    if (error.code === 'PT409') return { ok: false, reason: 'not_under14' };
    return { ok: false, reason: 'error', error };
  }
  return { ok: true, first: (data as { first?: unknown })?.first === true };
}
