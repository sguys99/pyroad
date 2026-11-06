/**
 * 보안 헤더·CSP 생성 (B27, §2.9).
 *
 * SDK·Next를 import하지 않는 순수 함수라 `next.config.ts`(빌드), `src/middleware.ts`(Edge), 단위 테스트가 함께 쓴다.
 *
 * 페이지 CSP는 두 가지다.
 * - **nonce 정책** (기본): `script-src 'nonce-…' 'strict-dynamic'`. 동적 렌더 페이지(로그인 화면, 게시판·공지·퀘스트처럼
 *   사용자 글·마크다운·튜터 답변을 보여 주는 곳)는 어차피 요청마다 렌더하므로 비용이 없다.
 * - **정적 정책**: `script-src 'self' 'unsafe-inline'`. 빌드 때 만든 HTML에는 nonce를 넣을 수 없어서
 *   정적 페이지(`STATIC_PAGE_PATHS`, 지금은 랜딩 `/`만)에 쓴다. 랜딩은 사용자 콘텐츠가 없고 CDN 캐시가 중요하다(§2.10).
 *
 * 연출 단계 부트 스크립트(`src/lib/motion/boot.ts`)는 루트 레이아웃의 고정 인라인 스크립트라 nonce 정책에 sha256 해시로 허용한다
 * (루트 레이아웃은 정적 랜딩도 감싸서 요청마다 nonce를 읽을 수 없음). 정적 정책은 해시를 넣지 않는다: 해시가 있으면 `'unsafe-inline'`이 무시된다.
 *
 * 두 정책 모두 `'unsafe-eval'`이 없다(개발 서버만 예외). 문자열을 코드로 바꾸는 `eval`·`Function`이 막혀야
 * Python → JsProxy → `Function` 우회가 막힌다. Pyodide Worker는 자기 스크립트 응답의 CSP(`buildWorkerCsp`)를 쓴다.
 */

import { MOTION_BOOT_SCRIPT_CSP_SOURCE } from '../motion/boot';

/** Pyodide 버전. `src/lib/pyodide/constants.ts`·`public/workers/pyodide-core.mjs`와 같아야 함 (테스트가 확인) */
export const CSP_PYODIDE_VERSION = '314.0.7';

/** Worker의 jsDelivr 폴백 경로 (`public/workers/pyodide-worker.mjs`의 `SOURCES`) */
export const PYODIDE_CDN_PREFIX = `https://cdn.jsdelivr.net/pyodide/v${CSP_PYODIDE_VERSION}/`;

/**
 * 빌드 때 HTML로 미리 만드는 페이지. 여기 있는 경로만 nonce 없는 정적 정책을 받는다.
 * 새 정적 페이지가 생기면 `scripts/security/check-static-pages.ts`(postbuild)가 빌드를 실패시킨다:
 * 이 목록에 넣거나(사용자 콘텐츠가 없을 때만) 동적 렌더로 바꿔야 한다.
 */
export const STATIC_PAGE_PATHS: readonly string[] = ['/'];

/** 정적 정책을 받는 경로인지. 끝의 `/`는 무시 */
export function isStaticPagePath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;
  return STATIC_PAGE_PATHS.includes(normalized);
}

/** URL의 출처(`https://host[:port]`). 잘못된 값이면 null */
export function originOf(url: string | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const { protocol, origin } = new URL(url.trim());
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return origin;
  } catch {
    return null;
  }
}

interface ParsedDsn {
  origin: string;
  publicKey: string;
  projectId: string;
}

/** Sentry DSN `https://<key>@<host>[/<path>]/<projectId>` 분해. 잘못된 값이면 null */
export function parseSentryDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn?.trim()) return null;
  try {
    const url = new URL(dsn.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (!url.username || !projectId || !/^\d+$/.test(projectId)) return null;
    return { origin: url.origin, publicKey: url.username, projectId };
  } catch {
    return null;
  }
}

/**
 * Sentry CSP 보고 주소 (`/api/<project>/security/`). DSN이 없으면 null.
 * 브라우저가 보내는 보고에는 문서 주소·막힌 주소가 들어 있다. `'report-sample'`은 넣지 않아 스크립트 내용은 가지 않는다.
 */
export function sentryCspReportUri(
  dsn: string | undefined,
  environment?: string,
): string | null {
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return null;
  const params = new URLSearchParams({ sentry_key: parsed.publicKey });
  if (environment) params.set('sentry_environment', environment);
  return `${parsed.origin}/api/${parsed.projectId}/security/?${params}`;
}

export interface PageCspOptions {
  /** 요청마다 새로 만든 nonce. 없으면 정적 정책 (`'unsafe-inline'`) */
  nonce?: string;
  /** `NEXT_PUBLIC_SUPABASE_URL` */
  supabaseUrl?: string;
  /** `NEXT_PUBLIC_SENTRY_DSN`. 있으면 ingest 출처를 connect-src에 넣고 보고 주소를 붙인다 */
  sentryDsn?: string;
  /** `VERCEL_ENV` 등. Sentry 보고에 환경 이름으로 붙음 */
  environment?: string;
  /** `next dev`. Turbopack HMR·React 개발 도구가 eval을 쓴다 */
  isDev: boolean;
  /** HTTPS로 서비스될 때만 `upgrade-insecure-requests` (로컬 `next start`의 http에서 넣으면 자원이 https로 바뀌어 깨짐) */
  isHttps: boolean;
}

/** CSP 보고 엔드포인트 이름 (`Reporting-Endpoints`·`report-to`) */
export const CSP_REPORT_GROUP = 'csp';

function serialize(directives: Array<[string, string[]]>): string {
  return directives
    .map(([name, values]) =>
      values.length > 0 ? `${name} ${values.join(' ')}` : name,
    )
    .join('; ');
}

/** 페이지(HTML 문서) CSP */
export function buildPageCsp(options: PageCspOptions): string {
  const { nonce, isDev } = options;
  const supabase = originOf(options.supabaseUrl);
  const sentry = parseSentryDsn(options.sentryDsn);
  const reportUri = sentryCspReportUri(options.sentryDsn, options.environment);

  const scriptSrc = nonce
    ? [
        "'self'",
        `'nonce-${nonce}'`,
        MOTION_BOOT_SCRIPT_CSP_SOURCE,
        "'strict-dynamic'",
      ]
    : ["'self'", "'unsafe-inline'"];
  if (isDev) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'"];
  if (supabase) connectSrc.push(supabase);
  if (sentry) connectSrc.push(sentry.origin);
  // 개발 서버 HMR 웹소켓 (Safari는 'self'를 ws:에 맞추지 않음)
  if (isDev) connectSrc.push('ws:');

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', scriptSrc],
    // Framer Motion·서버 렌더 style 속성·CodeMirror가 넣는 <style>
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // next/image는 /_next/image를 거치므로 외부 이미지 출처가 필요 없다. data:·blob:은 SVG·캔버스 저장용
    ['img-src', ["'self'", 'data:', 'blob:']],
    // 폰트는 src/fonts/를 빌드가 /_next/static/media로 내보내 우리 도메인에서 제공한다 (자체 호스팅, P2-10·§2.5)
    ['font-src', ["'self'"]],
    ['connect-src', connectSrc],
    // Pyodide module Worker(/workers/) + canvas-confetti·lottie-web이 Blob URL로 만드는 Worker
    // (blob: Worker는 이 페이지 CSP를 물려받으므로 'unsafe-eval' 없이 돈다)
    ['worker-src', ["'self'", 'blob:']],
    ['manifest-src', ["'self'"]],
    ['frame-src', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    // 소셜 로그인은 폼 전송이 아닌 내비게이션이라 form-action에 걸리지 않는다
    ['form-action', ["'self'"]],
    ['frame-ancestors', ["'none'"]],
  ];
  if (options.isHttps && !isDev)
    directives.push(['upgrade-insecure-requests', []]);
  if (reportUri) {
    directives.push(['report-uri', [reportUri]]);
    directives.push(['report-to', [CSP_REPORT_GROUP]]);
  }
  return serialize(directives);
}

/**
 * Pyodide module Worker(`/workers/*.mjs`) CSP.
 *
 * Worker는 자기 스크립트 응답의 CSP를 쓴다(페이지 CSP를 물려받지 않음). 학생 Python 코드가 JsProxy로
 * `Function` 생성자에 닿아도 `'unsafe-eval'`이 없어 EvalError가 난다 (B15의 실제 경계).
 * - script-src: 자체 호스팅 `pyodide.mjs` import + wasm 컴파일(`'wasm-unsafe-eval'`) + jsDelivr 폴백 import
 * - connect-src: wasm·zip·lock 파일 fetch와 HEAD 확인 (자체 호스팅·jsDelivr)
 * - default-src 'none': 그 밖(이미지·폰트 등)은 Worker에서 쓰지 않음
 * - `worker-src`·`base-uri`는 넣지 않는다. (실측, Firefox 1538) `worker-src 'none'`이나 `base-uri 'none'`이 있으면
 *   Worker가 시작하지 못하고 `onerror`만 난다. Worker 안의 하위 Worker는 script-src로 떨어지고,
 *   로딩 뒤 `Worker` 전역 자체를 지운다(B15)
 * 이 정책은 Report-Only로 바꾸지 않는다: Report-Only면 eval이 실제로 막히지 않는다.
 */
export function buildWorkerCsp(): string {
  return serialize([
    ['default-src', ["'none'"]],
    ['script-src', ["'self'", "'wasm-unsafe-eval'", PYODIDE_CDN_PREFIX]],
    ['connect-src', ["'self'", PYODIDE_CDN_PREFIX]],
  ]);
}

/** API 응답 CSP. JSON만 돌려주므로 아무것도 불러오지 않고, 다른 사이트의 iframe에도 들어가지 않는다 */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

/**
 * 모든 응답에 붙이는 헤더 (`next.config.ts`).
 * HSTS는 Vercel이 모든 HTTPS 배포에 `Strict-Transport-Security: max-age=63072000`을 붙이므로 여기서 넣지 않는다.
 */
export const COMMON_SECURITY_HEADERS: ReadonlyArray<{
  key: string;
  value: string;
}> = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // frame-ancestors를 모르는 오래된 브라우저용
  { key: 'X-Frame-Options', value: 'DENY' },
  // 쓰지 않는 강력한 기능은 끔. 알 수 없는 이름은 Chrome 콘솔 경고가 나므로 널리 아는 이름만 쓴다
  {
    key: 'Permissions-Policy',
    value: [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'display-capture=()',
      'browsing-topics=()',
    ].join(', '),
  },
];

/** CSP 응답 헤더 이름. `reportOnly`면 막지 않고 보고만 한다 (비상 전환용, 런북) */
export function cspHeaderName(reportOnly: boolean): string {
  return reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
}

/** `CSP_REPORT_ONLY=true`면 페이지 CSP를 보고 전용으로 (Worker CSP는 항상 강제) */
export function isCspReportOnly(
  value: string | undefined = process.env.CSP_REPORT_ONLY,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/**
 * 요청의 페이지 CSP에서 nonce를 꺼낸다 (미들웨어가 요청 헤더로 넘긴 값). 서버 컴포넌트가 직접 쓰는 인라인 스크립트용
 * (Next는 자기 스크립트에만 nonce를 붙인다). 정적 정책·헤더 없음이면 undefined
 */
export function nonceFromCsp(
  policy: string | null | undefined,
): string | undefined {
  const match = policy?.match(/'nonce-([A-Za-z0-9+/=_-]+)'/);
  return match?.[1];
}

/** 요청마다 새 nonce (128비트, base64). Edge·Node 모두 Web Crypto를 쓴다 */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
