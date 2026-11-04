import 'server-only';

import { createHmac } from 'node:crypto';
import { after } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/lib/types/database';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { captureServerError } from '@/lib/observability/server';
import type { SocialProvider } from '@/lib/auth/socialLogin';
import {
  normalizePath,
  type AnalyticsEventName,
  type AnalyticsEventProps,
} from './events';
import { parseEventProps } from './schema';

/**
 * 분석 이벤트 서버 기록 (P1-17, §12-Q22). 설계: docs/analytics.md
 *
 * - 저장소는 `analytics_events`(service_role 전용, 00017). 외부 서비스로 보내지 않는다.
 * - 로그인 사용자의 익명 ID 는 `HMAC-SHA256(ANALYTICS_SALT, user id)` 앞 22자(base64url). salt 는 서버 env 에만 있으므로
 *   DB·내보낸 데이터만으로는 사용자와 이을 수 없고, 같은 사용자는 늘 같은 값이 된다 (퍼널·재방문 계산).
 * - `ANALYTICS_SALT`가 없으면 아무것도 기록하지 않는다 (로컬·Preview 기본값). 운영 Production 에만 넣는다.
 * - 브라우저가 Do Not Track(`DNT: 1`)·Global Privacy Control(`Sec-GPC: 1`)을 보내면 기록하지 않는다 (클라이언트 `track()`과 같은 규칙).
 * - IP·User-Agent 원문·URL 쿼리는 저장하지 않는다. User-Agent 는 기기 유형(mobile/tablet/desktop)으로만 줄인다.
 * - 기록 실패는 화면·응답에 영향을 주지 않는다: 던지지 않고 로그·Sentry(같은 에러 10분 3회)만.
 */

type AdminClient = SupabaseClient<Database>;
type EventRow = TablesInsert<'analytics_events'>;

export type AnalyticsDevice = 'mobile' | 'tablet' | 'desktop' | 'unknown';

const SALT_MIN_LENGTH = 32;
let warnedSalt = false;

/** `ANALYTICS_SALT` (32자 이상). 없거나 짧으면 null = 분석 기록 꺼짐 */
export function getAnalyticsSalt(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const salt = env.ANALYTICS_SALT?.trim();
  if (!salt) return null;
  if (salt.length < SALT_MIN_LENGTH) {
    if (!warnedSalt) {
      warnedSalt = true;
      console.warn(
        `[analytics] ANALYTICS_SALT 가 너무 짧음 (${SALT_MIN_LENGTH}자 이상, 예: openssl rand -base64 32) → 기록하지 않음`,
      );
    }
    return null;
  }
  return salt;
}

/** 사용자 id → 익명 ID. 같은 salt·같은 사용자면 같은 값, salt 없이는 되돌리거나 다시 만들 수 없음 */
export function anonymizeUserId(userId: string, salt: string): string {
  return createHmac('sha256', salt)
    .update(`pyroad:analytics:user:${userId}`)
    .digest('base64url')
    .slice(0, 22);
}

/** User-Agent → 기기 유형. 원문은 저장하지 않는다. iPadOS Safari 는 Mac 으로 보고하므로 desktop 으로 셈(문서의 한계) */
export function classifyDevice(
  userAgent: string | null | undefined,
): AnalyticsDevice {
  if (!userAgent) return 'unknown';
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(userAgent))
    return 'tablet';
  if (
    /Mobi|iPhone|iPod|Android|Windows Phone|IEMobile|Opera Mini/i.test(
      userAgent,
    )
  )
    return 'mobile';
  return 'desktop';
}

/** 브라우저의 추적 거부 신호 (DNT·GPC) */
export function hasOptOutSignal(headers: Headers): boolean {
  return (
    headers.get('sec-gpc')?.trim() === '1' || headers.get('dnt')?.trim() === '1'
  );
}

/**
 * 응답을 기다리게 하지 않고 뒤에서 실행한다. 요청 범위 안이면 Next `after()`(Vercel 이 끝날 때까지 기다림),
 * 그 밖(테스트·스트림 콜백)에서는 그냥 실행한다. 어느 쪽이든 던지지 않는다.
 */
export function runInBackground(task: () => Promise<unknown>): void {
  const safe = () => task().catch(() => undefined);
  try {
    after(safe);
  } catch {
    void safe();
  }
}

/** 기록 실패 로그 (내용·id 없이 코드·메시지만) */
function reportFailure(op: string, error: unknown): void {
  console.error(
    `[analytics] ${op} 실패:`,
    error instanceof Error ? error.message : error,
  );
  captureServerError(error, { tags: { area: 'analytics', op } });
}

/**
 * 행 저장. dedupe_key 가 같은 행이 이미 있으면 건너뛴다(ON CONFLICT DO NOTHING) — "처음 한 번" 이벤트.
 * 실패해도 던지지 않고 false.
 */
export async function insertAnalyticsRows(
  admin: AdminClient,
  rows: EventRow[],
): Promise<boolean> {
  if (rows.length === 0) return true;
  try {
    const { error } = await admin
      .from('analytics_events')
      .upsert(rows, {
        onConflict: 'anon_id,dedupe_key',
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    return true;
  } catch (error) {
    reportFailure('insert', error);
    return false;
  }
}

export interface ServerEventInput<N extends AnalyticsEventName> {
  /** 요청 헤더 (기기 유형·DNT/GPC 판별용. 원문은 저장하지 않음) */
  headers: Headers;
  /** `auth.getUser()`로 확인한 사용자 id */
  userId: string;
  name: N;
  props: AnalyticsEventProps[N];
  /** 이벤트가 일어난 화면의 경로 템플릿 (예: '/quest/[id]') */
  path?: string;
  /** 같은 사용자에게 한 번만 셀 때 (예: `quest_start:<quest id>`) */
  dedupeKey?: string;
}

/**
 * 서버가 직접 아는 사건(로그인 성공·퀘스트 시작/완료·힌트)을 기록한다. 클라이언트는 이 이벤트를 보낼 수 없다.
 * 꺼져 있거나(ANALYTICS_SALT 없음)·추적 거부 신호가 있거나·속성 형식이 틀리면 기록하지 않는다. 던지지 않는다.
 */
export async function recordServerEvent<N extends AnalyticsEventName>(
  input: ServerEventInput<N>,
  deps: { admin?: AdminClient; env?: Record<string, string | undefined> } = {},
): Promise<boolean> {
  try {
    const salt = getAnalyticsSalt(deps.env);
    if (!salt || hasOptOutSignal(input.headers)) return false;
    const props = parseEventProps(input.name, input.props);
    if (!props) {
      console.error(
        `[analytics] ${input.name} 속성 형식이 틀림 → 기록하지 않음`,
      );
      return false;
    }
    const row: EventRow = {
      name: input.name,
      actor: 'user',
      anon_id: anonymizeUserId(input.userId, salt),
      source: 'server',
      props,
      device: classifyDevice(input.headers.get('user-agent')),
      path: normalizePath(input.path),
      dedupe_key: input.dedupeKey ?? null,
    };
    return await insertAnalyticsRows(deps.admin ?? createAdminClient(), [row]);
  } catch (error) {
    reportFailure('record', error);
    return false;
  }
}

/** `recordServerEvent`를 응답을 기다리게 하지 않고 실행 */
export function trackServerEvent<N extends AnalyticsEventName>(
  input: ServerEventInput<N>,
): void {
  if (!getAnalyticsSalt()) return;
  runInBackground(() => recordServerEvent(input));
}

/**
 * 퀘스트 첫 진입 (퀘스트 페이지 서버 컴포넌트에서 부름). 사용자·퀘스트마다 한 번만 남는다(dedupe).
 * 잠긴 스테이지로 돌려보내는 경우(B38)에는 부르지 않는다.
 */
export function trackQuestStart(
  headers: Headers,
  userId: string,
  questId: string,
): void {
  trackServerEvent({
    headers,
    userId,
    name: 'quest_start',
    props: { quest_id: questId },
    path: '/quest/[id]',
    dedupeKey: `quest_start:${questId}`,
  });
}

/** 지금 요청의 로그인 사용자 id (분석이 꺼져 있거나 확인하지 못하면 null). 요청 범위 안에서 불러야 함(cookies) */
export async function currentAnalyticsUserId(): Promise<string | null> {
  if (!getAnalyticsSalt()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 튜터 route 의 `recordHint`(record_hint RPC, P1-04)를 감싸 힌트를 실제로 보낸 때에만 `hint_used`를 남긴다.
 * 사용자 확인(getUser)은 요청 범위 안인 지금 시작하고(LLM 호출과 동시에), 기록은 뒤에서 한다 → 힌트 응답이 늦어지지 않음.
 * 분석이 꺼져 있으면 원래 함수를 그대로 돌려준다.
 *
 * TODO(B38 뒤): `prepareTutorCall`(helpers.ts)의 `recordHintUsage`가 이미 user id 를 알고 있으므로, 그쪽에서 바로 기록하면
 * getUser 를 한 번 덜 부른다. helpers.ts 는 B38 작업 중이라 P1-17 에서는 route 에서 감쌌다.
 */
export function withHintTracking(
  recordHint: (() => Promise<void>) | null,
  request: Request,
  hint: { questId: string; level: number | undefined },
): (() => Promise<void>) | null {
  if (!recordHint || !getAnalyticsSalt()) return recordHint;
  const userIdPromise = currentAnalyticsUserId();
  const level = hint.level;
  return async () => {
    await recordHint();
    if (level !== 1 && level !== 2 && level !== 3) return;
    runInBackground(async () => {
      const userId = await userIdPromise;
      if (!userId) return;
      await recordServerEvent({
        headers: request.headers,
        userId,
        name: 'hint_used',
        props: { quest_id: hint.questId, level },
        path: '/quest/[id]',
      });
    });
  };
}

/** 이번 로그인의 provider (00013 `social_login_provider`와 같은 규칙: issuer 우선, 그다음 app_metadata.provider) */
export function loginProvider(
  user: Pick<User, 'user_metadata' | 'app_metadata'>,
): SocialProvider | 'unknown' {
  const iss = user.user_metadata?.iss;
  if (iss === 'https://accounts.google.com') return 'google';
  if (iss === 'https://kapi.kakao.com' || iss === 'https://kauth.kakao.com')
    return 'kakao';
  if (iss === 'https://nid.naver.com') return 'naver';
  const p = String(user.app_metadata?.provider ?? '')
    .trim()
    .toLowerCase();
  if (p === 'google') return 'google';
  if (p === 'kakao' || p === 'custom:kakao') return 'kakao';
  if (p === 'naver' || p === 'custom:naver') return 'naver';
  return 'unknown';
}

/** 가입 직후 첫 로그인인지: 가입 시각과 이번 로그인 시각이 2분 안 */
export function isNewUser(
  user: Pick<User, 'created_at' | 'last_sign_in_at'>,
): boolean {
  const created = Date.parse(user.created_at);
  const signedIn = Date.parse(user.last_sign_in_at ?? '');
  if (!Number.isFinite(created) || !Number.isFinite(signedIn)) return false;
  return Math.abs(signedIn - created) < 2 * 60_000;
}

/** 로그인 성공 (`/auth/callback`). 가입(new_user)은 사용자당 한 번만 남긴다 */
export function trackLoginSuccess(headers: Headers, user: User): void {
  const newUser = isNewUser(user);
  trackServerEvent({
    headers,
    userId: user.id,
    name: 'login_success',
    props: { provider: loginProvider(user), new_user: newUser },
    path: '/auth/callback',
    ...(newUser && { dedupeKey: 'login_success:new_user' }),
  });
}

/**
 * 탈퇴한 사용자의 이벤트 삭제 (`/api/account/delete`). HMAC 이라 salt 가 있어야 찾을 수 있다.
 * salt 가 없으면(기록도 안 했음) 할 일이 없다. 실패해도 던지지 않음 — 남은 행은 보존 기간(180일)이 지나면 지워진다.
 */
export async function deleteUserAnalytics(
  admin: AdminClient,
  userId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<void> {
  const salt = getAnalyticsSalt(env);
  if (!salt) return;
  try {
    const { error } = await admin
      .from('analytics_events')
      .delete()
      .eq('actor', 'user')
      .eq('anon_id', anonymizeUserId(userId, salt));
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  } catch (error) {
    reportFailure('delete_user', error);
  }
}

/** 보존 기간. 바꾸면 docs/analytics.md·런북·00017 주석도 함께 */
export const ANALYTICS_RETENTION_DAYS = 180;
const PRUNE_INTERVAL_MS = 60 * 60_000;
let lastPruneAt = 0;

/**
 * 보존 기간이 지난 행 정리 (pg_cron 없음 → 기회적). 인스턴스마다 1시간에 한 번, 한 번에 최대 5,000행.
 * 밀린 양이 많으면 런북의 SQL 로 직접 실행한다.
 */
export async function maybePruneAnalytics(
  admin: AdminClient,
  now: number = Date.now(),
): Promise<void> {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  try {
    const { error } = await admin.rpc('prune_analytics_events', {
      p_retention: `${ANALYTICS_RETENTION_DAYS} days`,
      p_limit: 5000,
    });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
  } catch (error) {
    reportFailure('prune', error);
  }
}

/** 테스트용: 정리 주기 초기화 */
export function resetAnalyticsPruneClock(): void {
  lastPruneAt = 0;
}
