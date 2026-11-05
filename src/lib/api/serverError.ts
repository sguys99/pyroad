import 'server-only';

import { captureServerError } from '@/lib/observability/server';

/**
 * API Route 공용: DB·서버 오류를 응답 대신 서버 로그와 Sentry 로 (B19, B36).
 *
 * DB `error.message` 에는 제약·테이블 이름, SQL 조각이 들어 있으므로 응답에 넣지 않고 각 API 가
 * 일반 문구를 돌려줌. `details`·`hint` 에는 실패한 행(아이가 쓴 글 등)이 들어 있어 로그에도 남기지 않음.
 */

/** PostgREST 오류 등에서 코드·메시지만 */
export function describeServerError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    const e = error as { code?: unknown; message?: unknown };
    return `${typeof e.code === 'string' ? e.code : ''} ${typeof e.message === 'string' ? e.message : ''}`.trim();
  }
  return String(error);
}

/** `[area] op 실패: <코드 메시지>` 로그 + Sentry (tags: area, op). 런북이 이 로그 형식으로 원인을 찾음 */
export function reportServerError(
  error: unknown,
  { area, op }: { area: string; op: string },
): void {
  const message = describeServerError(error);
  console.error(`[${area}] ${op} 실패:`, message);
  captureServerError(
    error instanceof Error ? error : new Error(`[${area}] ${op}: ${message}`),
    { tags: { area, op } },
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 경로·본문의 id 모양 검사. 아니면 DB 에 보내지 않음 (잘못된 uuid 는 22P02 오류가 되므로) */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
