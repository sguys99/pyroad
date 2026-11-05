import type { Breadcrumb, Event, EventHint } from '@sentry/nextjs';

/**
 * Sentry로 나가는 이벤트에서 아동 개인정보·민감값을 지우는 필터 (P1-16, §2.6).
 *
 * - 요청 본문(학생 코드·stdout 포함)·쿠키·쿼리 문자열은 통째로 버리고, 헤더는 허용 목록만 남긴다
 * - 사용자 정보(`event.user`)는 보내지 않는다 (익명 id도 붙이지 않음)
 * - 토큰·API 키·이메일처럼 보이는 문자열은 `[Filtered]`로 바꾼다
 * - 사용자가 요청을 취소한 것(abort)은 에러가 아니므로 버린다
 *
 * SDK를 import하지 않는 순수 함수라 브라우저·서버·Edge 설정과 단위 테스트가 함께 쓴다.
 */

export const FILTERED = '[Filtered]';

/** 남겨도 되는 요청 헤더 (소문자) */
const ALLOWED_HEADERS = new Set([
  'user-agent',
  'content-type',
  'accept',
  'accept-language',
]);

/** 사용자가 요청을 끊었을 때 나는 에러 이름 (fetch·Next.js·Anthropic/OpenAI SDK) */
const ABORT_ERROR_NAMES = new Set([
  'AbortError',
  'ResponseAborted',
  'APIUserAbortError',
]);

/**
 * 값 전체를 지울 키 (소문자, `_`·`-` 제거 후 비교).
 * 학생 코드(`code`, `student_code`, `previous_code`)와 실행 결과, 인증 정보가 대상이다.
 */
const SENSITIVE_KEY =
  /token|secret|passw|apikey|authorization|cookie|session|email|stdout|stderr|code$|answer|solution/;
/** 위 규칙에 걸리지만 진단에 필요한 키 */
const SAFE_KEYS = new Set(['statuscode', 'errorcode', 'httpstatuscode']);

const STRING_PATTERNS: Array<[RegExp, string]> = [
  // JWT (Supabase access token 등)
  [/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, FILTERED],
  // Authorization: Bearer …
  [/Bearer\s+[\w.~+/-]+=*/gi, `Bearer ${FILTERED}`],
  // LLM API 키 (Anthropic `sk-ant-…`, OpenAI `sk-…`, Google `AIza…`)
  [/\bsk-[\w-]{16,}/g, FILTERED],
  [/\bAIza[\w-]{30,}/g, FILTERED],
  // URL 속 인증 파라미터 (OAuth `code`, `access_token` 등)
  [
    /([?&#](?:access_token|refresh_token|provider_token|provider_refresh_token|token|code|key)=)[^&#\s"']+/gi,
    `$1${FILTERED}`,
  ],
  // 이메일
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, FILTERED],
];

const MAX_DEPTH = 6;

export function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of STRING_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** URL에서 쿼리 문자열과 해시를 떼어 낸다 (`/auth/callback?code=…` 같은 값이 남지 않게) */
export function stripUrlQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return !SAFE_KEYS.has(normalized) && SENSITIVE_KEY.test(normalized);
}

/** 객체를 복사하면서 민감한 키의 값은 지우고 문자열은 `scrubString`을 거친다 */
export function scrubValue<T>(value: T, depth = 0): T {
  if (typeof value === 'string') return scrubString(value) as T;
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return FILTERED as T;
  if (Array.isArray(value))
    return value.map((item) => scrubValue(item, depth + 1)) as T;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? FILTERED : scrubValue(item, depth + 1);
  }
  return out as T;
}

const URL_DATA_KEYS = [
  'url',
  'from',
  'to',
  'http.url',
  'url.full',
  'http.target',
];
const QUERY_DATA_KEYS = [
  'http.query',
  'url.query',
  'http.fragment',
  'url.fragment',
];

function scrubUrlData(data: Record<string, unknown>): Record<string, unknown> {
  const out = scrubValue(data);
  for (const key of URL_DATA_KEYS) {
    if (typeof out[key] === 'string')
      out[key] = stripUrlQuery(out[key] as string);
  }
  for (const key of QUERY_DATA_KEYS) {
    if (key in out) delete out[key];
  }
  return out;
}

/**
 * 브레드크럼 필터. 콘솔 로그는 학생 출력이나 서버 오류 원문이 섞일 수 있어 버리고,
 * fetch·내비게이션 URL은 쿼리를 뗀다.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === 'console') return null;
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined && {
      message: scrubString(breadcrumb.message),
    }),
    ...(breadcrumb.data && { data: scrubUrlData(breadcrumb.data) }),
  };
}

function scrubRequest(
  request: NonNullable<Event['request']>,
): Event['request'] {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (ALLOWED_HEADERS.has(name.toLowerCase())) headers[name] = value;
  }
  // data(본문: 학생 코드·stdout), cookies, query_string, env는 버린다
  return {
    ...(request.method && { method: request.method }),
    ...(request.url && { url: stripUrlQuery(request.url) }),
    headers,
  };
}

/** 이벤트 사본에서 민감값을 지운다. 에러·트랜잭션 이벤트 모두에 쓴다 */
export function scrubEvent<T extends Event>(event: T): T {
  const out: T = { ...event };

  delete out.user;
  delete out.server_name; // 서버 호스트 이름

  if (out.request) out.request = scrubRequest(out.request);
  if (out.message) out.message = scrubString(out.message);
  if (out.transaction) out.transaction = stripUrlQuery(out.transaction);
  if (out.extra) out.extra = scrubValue(out.extra);
  if (out.tags) out.tags = scrubValue(out.tags);
  if (out.contexts) out.contexts = scrubValue(out.contexts);

  if (out.exception?.values) {
    out.exception = {
      ...out.exception,
      values: out.exception.values.map((exception) => ({
        ...exception,
        ...(exception.value !== undefined && {
          value: scrubString(exception.value),
        }),
      })),
    };
  }

  if (out.breadcrumbs) {
    out.breadcrumbs = out.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((breadcrumb): breadcrumb is Breadcrumb => breadcrumb !== null);
  }

  if (out.spans) {
    out.spans = out.spans.map((span) => ({
      ...span,
      ...(span.description && { description: stripUrlQuery(span.description) }),
      ...(span.data && { data: scrubUrlData(span.data) as typeof span.data }),
    }));
  }

  return out;
}

/** 사용자 취소(abort)로 생긴 에러인지. 원본 에러가 없으면 이벤트의 예외 타입으로 판단한다 */
export function isAbortError(error: unknown, event?: Event): boolean {
  if (error && typeof error === 'object') {
    const { name, message } = error as { name?: unknown; message?: unknown };
    if (typeof name === 'string' && ABORT_ERROR_NAMES.has(name)) return true;
    // Node http: 클라이언트가 연결을 끊으면 `Error: aborted`
    if (message === 'aborted') return true;
  }
  return (
    event?.exception?.values?.some(
      (exception) => exception.type && ABORT_ERROR_NAMES.has(exception.type),
    ) ?? false
  );
}

export interface RepeatGuardOptions {
  /** 같은 에러를 창 안에서 최대 몇 번 보낼지 */
  max?: number;
  /** 창 길이 (ms) */
  windowMs?: number;
  /** 기억할 에러 종류 수 상한 (넘으면 가장 오래된 것부터 잊음) */
  maxKeys?: number;
  now?: () => number;
}

function eventKey(event: Event): string {
  if (event.fingerprint?.length) return event.fingerprint.join('|');
  const exception = event.exception?.values?.[0];
  if (exception)
    return `${exception.type ?? ''}:${(exception.value ?? '').slice(0, 200)}`;
  return `msg:${(event.message ?? '').slice(0, 200)}`;
}

/**
 * 같은 에러가 폭주할 때 무료 티어(월 5k 에러, §12-Q10)를 다 쓰지 않도록,
 * 같은 에러는 창(기본 10분)마다 `max`(기본 3)번까지만 통과시킨다.
 * 브라우저에서는 탭 하나, 서버에서는 인스턴스 하나 단위다.
 */
export function createRepeatGuard({
  max = 3,
  windowMs = 10 * 60_000,
  maxKeys = 200,
  now = Date.now,
}: RepeatGuardOptions = {}): (event: Event) => boolean {
  const seen = new Map<string, { count: number; start: number }>();

  return (event) => {
    const key = eventKey(event);
    const t = now();
    const entry = seen.get(key);

    if (!entry || t - entry.start >= windowMs) {
      seen.delete(key);
      seen.set(key, { count: 1, start: t });
      if (seen.size > maxKeys) seen.delete(seen.keys().next().value as string);
      return true;
    }

    entry.count += 1;
    return entry.count <= max;
  };
}

/**
 * `beforeSend`에 넣는 공통 필터: abort 무시 → 민감값 제거 → 폭주 제한.
 */
export function createBeforeSend(options: RepeatGuardOptions = {}) {
  const allow = createRepeatGuard(options);
  return <T extends Event>(event: T, hint?: EventHint): T | null => {
    if (isAbortError(hint?.originalException, event)) return null;
    const scrubbed = scrubEvent(event);
    return allow(scrubbed) ? scrubbed : null;
  };
}

/**
 * `beforeSendSpan` 필터 (SDK v11 기본 `traceLifecycle: 'stream'`에서는 `beforeSendTransaction`이 무시된다).
 * 스팬 이름·속성의 URL에서 쿼리를 떼고 민감한 키를 지운다. 트레이싱은 기본 꺼짐이고 켜도 서버에서만 쓴다.
 */
export function scrubSpan<T extends { name: string; attributes?: object }>(
  span: T,
): T {
  return {
    ...span,
    name: stripUrlQuery(span.name),
    ...(span.attributes && {
      attributes: scrubUrlData(
        span.attributes as Record<string, unknown>,
      ) as T['attributes'],
    }),
  };
}
