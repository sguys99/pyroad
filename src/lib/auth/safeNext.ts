/**
 * 로그인 뒤 이동할 `next` 값 검증 (B23: `/auth/callback`의 오픈 리다이렉트 차단).
 *
 * 같은 출처의 경로만 허용합니다. 규칙:
 * - 단일 `/`로 시작해야 함. `//host`(프로토콜 상대 URL)·`/\host`(브라우저가 `\`를 `/`로 읽음)·
 *   `https:`·`javascript:` 같은 스킴은 거부
 * - 역슬래시와 제어 문자(탭·줄바꿈 포함, URL 파서가 지워서 `/\t/host` → `//host`가 됨)는 어디에 있어도 거부
 * - 이중 인코딩(`%2F%2Fhost`, `%252F…`)을 막으려고 디코딩할 때마다 같은 규칙으로 다시 검사
 * - 마지막으로 가짜 출처 기준으로 파싱해 출처가 바뀌지 않는지, 정규화한 경로가 `//`로 시작하지 않는지 확인
 *   (`/.//host`는 점 세그먼트 정리 후 `//host`가 됨)
 * 통과하면 정규화한 `경로 + 쿼리 + 해시`를, 아니면 `fallback`을 돌려줍니다.
 */
const PROBE_ORIGIN = 'https://pyroad.invalid';
const MAX_DECODE_ROUNDS = 5;

export const DEFAULT_NEXT = '/world';

export function safeNext(
  raw: string | null | undefined,
  fallback: string = DEFAULT_NEXT,
): string {
  if (!raw) return fallback;

  // 디코딩 단계마다 검사. 더 디코딩할 수 없거나(잘못된 % 포함) 횟수를 넘기면 거부
  let current = raw;
  for (let round = 0; ; round++) {
    if (!isSafePathShape(current)) return fallback;
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return fallback;
    }
    if (decoded === current) break;
    if (round >= MAX_DECODE_ROUNDS) return fallback;
    current = decoded;
  }

  let url: URL;
  try {
    url = new URL(raw, PROBE_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PROBE_ORIGIN) return fallback;
  if (url.pathname.startsWith('//')) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}

function isSafePathShape(value: string): boolean {
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  // C0 제어 문자, DEL, C1 제어 문자
  if (/[\u0000-\u001f\u007f-\u009f]/.test(value)) return false;
  return true;
}
