import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureServerMessage } from '@/lib/observability/server';
import { parseRateLimitEnv, type RateLimit } from '@/lib/tutor/rateLimit';
import { MAX_BATCH_BYTES, normalizePath } from '@/lib/analytics/events';
import { clientBatchSchema } from '@/lib/analytics/schema';
import {
  anonymizeUserId,
  classifyDevice,
  getAnalyticsSalt,
  hasOptOutSignal,
  insertAnalyticsRows,
  maybePruneAnalytics,
  runInBackground,
} from '@/lib/analytics/server';

/**
 * 브라우저 분석 이벤트 수집 (P1-17). `track()`(src/lib/analytics/track.ts)이 묶어서 보낸다(`sendBeacon` 또는 fetch keepalive).
 *
 * - 본문: `{ sid, events: [{ name, props, path? }] }` (최대 10건·8KB). 이름·속성은 zod strict 스키마로만 받는다 — 정해 둔 키 밖의 값
 *   (개인정보·학생 내용)이 있으면 묶음 전체를 400 으로 거부. 서버 전용 이벤트(로그인 성공·퀘스트 시작/완료·힌트)는 받지 않는다.
 * - 익명 ID: 로그인 사용자는 서버가 user id 를 HMAC 한 값, 비로그인은 `sid`(탭 세션 난수). IP·User-Agent 원문·쿼리는 저장하지 않음.
 * - 남용 방지: 로그인은 사용자별 `consume_rate_limit`(analytics:client), 비로그인은 전체 합계 `consume_global_rate_limit`
 *   (analytics:visitor, 비로그인 요청에는 믿을 만한 사용자 단위가 없으므로 테이블 크기 상한으로 막음). 한도 DB 가 실패하면 통과.
 * - 다른 사이트에서 보낸 요청(Origin 이 다름)은 403. 쿠키(SameSite=Lax)도 실리지 않지만 비로그인 이벤트를 부풀리는 것을 줄인다.
 * - 꺼져 있거나(ANALYTICS_SALT 없음)·추적 거부 신호(DNT/GPC)가 있으면 검증만 하고 버린다(204).
 * - 클라이언트는 응답을 보지 않는다(재시도 없음). 어떤 실패도 화면에 영향이 없다.
 */

const DEFAULT_USER_LIMIT: RateLimit = { perMinute: 20, perDay: 300 };
const DEFAULT_VISITOR_LIMIT: RateLimit = { perMinute: 120, perDay: 5000 };

function limitFromEnv(name: string, fallback: RateLimit): RateLimit {
  return parseRateLimitEnv(process.env[name]) ?? fallback;
}

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function reject(
  status: number,
  error: string,
  headers?: HeadersInit,
): Response {
  return Response.json({ error }, { status, headers });
}

/** 다른 출처에서 온 브라우저 요청인지 (Origin 이 없으면 브라우저가 아닌 요청 → 판단하지 않음) */
function isCrossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

interface QuotaRow {
  allowed?: unknown;
  retry_after?: unknown;
  denied_minute?: unknown;
}

/** 한도 1 차감. DB 실패는 통과(분석 때문에 로그를 쏟지 않게 기록은 insert 실패 쪽에 맡김) */
async function consumeQuota(
  admin: ReturnType<typeof createAdminClient>,
  userId: string | null,
): Promise<{ allowed: boolean; retryAfter: number; deniedMinute: number }> {
  try {
    const limit = userId
      ? limitFromEnv('ANALYTICS_LIMIT_USER', DEFAULT_USER_LIMIT)
      : limitFromEnv('ANALYTICS_LIMIT_VISITOR', DEFAULT_VISITOR_LIMIT);
    const { data, error } = userId
      ? await admin.rpc('consume_rate_limit', {
          p_user_id: userId,
          p_bucket: 'analytics:client',
          p_per_minute: limit.perMinute,
          p_per_day: limit.perDay,
        })
      : await admin.rpc('consume_global_rate_limit', {
          p_bucket: 'analytics:visitor',
          p_per_minute: limit.perMinute,
          p_per_day: limit.perDay,
        });
    if (error) throw new Error(`${error.code ?? ''} ${error.message}`.trim());
    const row = (data ?? {}) as QuotaRow;
    if (row.allowed === false) {
      return {
        allowed: false,
        retryAfter: Math.max(1, Math.trunc(Number(row.retry_after)) || 1),
        deniedMinute: Math.trunc(Number(row.denied_minute)) || 0,
      };
    }
    return { allowed: true, retryAfter: 0, deniedMinute: 0 };
  } catch (error) {
    console.error(
      '[analytics] 요청 한도 확인 실패:',
      error instanceof Error ? error.message : error,
    );
    return { allowed: true, retryAfter: 0, deniedMinute: 0 };
  }
}

export async function POST(request: Request) {
  if (isCrossSite(request)) return reject(403, 'cross_site');

  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BATCH_BYTES) {
    return reject(413, 'body_too_large');
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return reject(400, 'invalid_body');
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BATCH_BYTES) {
    return reject(413, 'body_too_large');
  }

  // sendBeacon 은 text/plain 으로 보내므로 Content-Type 과 상관없이 JSON 으로 읽는다
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return reject(400, 'invalid_json');
  }
  const parsed = clientBatchSchema.safeParse(json);
  if (!parsed.success) return reject(400, 'invalid_events');

  const salt = getAnalyticsSalt();
  if (!salt || hasOptOutSignal(request.headers)) return noContent();

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const admin = createAdminClient();
  const quota = await consumeQuota(admin, userId);
  if (!quota.allowed) {
    const who = userId ? 'user' : 'visitor';
    console.info(
      '[analytics] 요청 한도 초과',
      JSON.stringify({ actor: who, denied_minute: quota.deniedMinute }),
    );
    // 비로그인 전체 한도를 넘는 것은 봇일 가능성이 큼. 분 창마다 처음 한 번만 Sentry 로
    if (!userId && quota.deniedMinute === 1) {
      captureServerMessage('analytics visitor limit exceeded', 'warning', {
        tags: { area: 'analytics', reason: 'visitor_limit' },
        fingerprint: ['analytics', 'visitor_limit'],
      });
    }
    return reject(429, 'rate_limited', {
      'Retry-After': String(quota.retryAfter),
    });
  }

  const { sid, events } = parsed.data;
  const anonId = userId ? anonymizeUserId(userId, salt) : sid;
  const device = classifyDevice(request.headers.get('user-agent'));
  const rows = events.map((event) => ({
    name: event.name,
    actor: userId ? ('user' as const) : ('visitor' as const),
    anon_id: anonId,
    source: 'client' as const,
    props: event.props,
    device,
    path: normalizePath(event.path),
    dedupe_key: null,
  }));
  await insertAnalyticsRows(admin, rows);
  runInBackground(() => maybePruneAnalytics(admin));

  return noContent();
}
