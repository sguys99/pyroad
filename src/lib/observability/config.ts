/**
 * Sentry 설정값 (P1-16).
 *
 * DSN이 없으면(로컬·테스트·CI) Sentry는 완전히 꺼진다: SDK를 불러오지도, 초기화하지도 않는다.
 * `NEXT_PUBLIC_SENTRY_DSN`은 빌드 때 번들에 박히므로 클라이언트에서는 빌드 env가 기준이다.
 */

/** 서버 트레이스 샘플링 상한. 무료 티어(§12-Q10)라 이보다 높게 잡지 않는다 */
export const MAX_TRACES_SAMPLE_RATE = 0.05;

function normalizeDsn(value: string | undefined): string | undefined {
  const dsn = value?.trim();
  return dsn ? dsn : undefined;
}

/** DSN. 없거나 빈 문자열이면 undefined */
export function getSentryDsn(
  // 클라이언트 번들에 값이 박히도록 `process.env.NEXT_PUBLIC_SENTRY_DSN`을 그대로 쓴다
  value: string | undefined = process.env.NEXT_PUBLIC_SENTRY_DSN,
): string | undefined {
  return normalizeDsn(value);
}

export function isSentryEnabled(
  value: string | undefined = process.env.NEXT_PUBLIC_SENTRY_DSN,
): boolean {
  return getSentryDsn(value) !== undefined;
}

/**
 * 서버 트레이스 샘플링 비율. 기본은 꺼짐(undefined)이고,
 * `SENTRY_TRACES_SAMPLE_RATE`로 0~0.05 사이에서만 켤 수 있다.
 */
export function getServerTracesSampleRate(
  value: string | undefined = process.env.SENTRY_TRACES_SAMPLE_RATE,
): number | undefined {
  const rate = Number(value);
  if (!value || !Number.isFinite(rate) || rate <= 0) return undefined;
  return Math.min(rate, MAX_TRACES_SAMPLE_RATE);
}
