import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PYODIDE_CDN_URL, PYODIDE_VERSION } from '@/lib/pyodide/constants';
import {
  API_CSP,
  COMMON_SECURITY_HEADERS,
  CSP_PYODIDE_VERSION,
  PYODIDE_CDN_PREFIX,
  buildPageCsp,
  buildWorkerCsp,
  createNonce,
  cspHeaderName,
  isCspReportOnly,
  isStaticPagePath,
  originOf,
  parseSentryDsn,
  sentryCspReportUri,
} from '../csp';

const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
const DSN =
  'https://0123456789abcdef@o4500000000000001.ingest.us.sentry.io/4500000000000002';

/** `a b; c d` → { a: ['b'], c: ['d'] } */
function parse(policy: string): Record<string, string[]> {
  return Object.fromEntries(
    policy.split(';').map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name, values];
    }),
  );
}

const prod = { isDev: false, isHttps: true, supabaseUrl: SUPABASE_URL };

describe('페이지 CSP (B27)', () => {
  it.each([
    ['nonce 정책', { nonce: 'abc123==' }],
    ['정적 정책', {}],
    ['Sentry 있음', { nonce: 'abc123==', sentryDsn: DSN }],
  ])('운영(%s)에는 unsafe-eval이 절대 없음', (_, extra) => {
    const policy = buildPageCsp({ ...prod, ...extra });
    expect(policy).not.toContain('unsafe-eval');
    expect(parse(policy)['script-src']).not.toContain("'unsafe-eval'");
  });

  it('nonce 정책: nonce + strict-dynamic, unsafe-inline 없음', () => {
    const d = parse(buildPageCsp({ ...prod, nonce: 'abc123==' }));
    expect(d['script-src']).toEqual([
      "'self'",
      "'nonce-abc123=='",
      "'strict-dynamic'",
    ]);
  });

  it('정적 정책(nonce 없음): self + unsafe-inline', () => {
    const d = parse(buildPageCsp(prod));
    expect(d['script-src']).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it('공통 지시어', () => {
    const d = parse(buildPageCsp({ ...prod, nonce: 'n' }));
    expect(d).toMatchObject({
      'default-src': ["'self'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'blob:'],
      'font-src': ["'self'"],
      'connect-src': ["'self'", SUPABASE_URL],
      // canvas-confetti·lottie-web의 Blob Worker (P1-10)
      'worker-src': ["'self'", 'blob:'],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': [],
    });
    // 페이지는 wasm을 컴파일하지 않는다 (Pyodide는 Worker 안)
    expect(d['script-src']).not.toContain("'wasm-unsafe-eval'");
    // Realtime을 쓰지 않으므로 wss: 없음
    expect(d['connect-src'].some((s) => s.startsWith('wss:'))).toBe(false);
  });

  it('Supabase URL은 출처만 (경로·끝 / 제거), 없거나 잘못되면 넣지 않음', () => {
    expect(
      parse(buildPageCsp({ ...prod, supabaseUrl: `${SUPABASE_URL}/rest/v1/` }))[
        'connect-src'
      ],
    ).toEqual(["'self'", SUPABASE_URL]);
    expect(
      parse(buildPageCsp({ ...prod, supabaseUrl: undefined }))['connect-src'],
    ).toEqual(["'self'"]);
    expect(
      parse(buildPageCsp({ ...prod, supabaseUrl: 'not a url' }))['connect-src'],
    ).toEqual(["'self'"]);
    // 로컬 Supabase(http)도 출처로
    expect(originOf('http://127.0.0.1:54331')).toBe('http://127.0.0.1:54331');
    expect(originOf('javascript:alert(1)')).toBeNull();
  });

  it('Sentry DSN이 있으면 ingest 출처를 connect-src에, 보고 주소를 report-uri·report-to로', () => {
    const d = parse(
      buildPageCsp({
        ...prod,
        nonce: 'n',
        sentryDsn: DSN,
        environment: 'preview',
      }),
    );
    expect(d['connect-src']).toEqual([
      "'self'",
      SUPABASE_URL,
      'https://o4500000000000001.ingest.us.sentry.io',
    ]);
    expect(d['report-uri']).toEqual([
      'https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/security/?sentry_key=0123456789abcdef&sentry_environment=preview',
    ]);
    expect(d['report-to']).toEqual(['csp']);
  });

  it('Sentry DSN이 없으면 보고 지시어 없음', () => {
    const d = parse(buildPageCsp({ ...prod, sentryDsn: '  ' }));
    expect(d['report-uri']).toBeUndefined();
    expect(d['report-to']).toBeUndefined();
  });

  it('http(로컬 next start)에는 upgrade-insecure-requests를 넣지 않음', () => {
    const d = parse(buildPageCsp({ ...prod, isHttps: false }));
    expect(d['upgrade-insecure-requests']).toBeUndefined();
  });

  it('개발 서버만 unsafe-eval·ws:를 허용하고 upgrade-insecure-requests 없음', () => {
    const d = parse(buildPageCsp({ ...prod, nonce: 'n', isDev: true }));
    expect(d['script-src']).toContain("'unsafe-eval'");
    expect(d['connect-src']).toContain('ws:');
    expect(d['upgrade-insecure-requests']).toBeUndefined();
  });
});

describe('Sentry DSN 분해', () => {
  it('키·호스트·프로젝트', () => {
    expect(parseSentryDsn(DSN)).toEqual({
      origin: 'https://o4500000000000001.ingest.us.sentry.io',
      publicKey: '0123456789abcdef',
      projectId: '4500000000000002',
    });
    // 경로 접두사가 있는 자체 호스팅 DSN
    expect(parseSentryDsn('https://key@sentry.example.com/base/7')).toEqual({
      origin: 'https://sentry.example.com',
      publicKey: 'key',
      projectId: '7',
    });
  });

  it.each([
    undefined,
    '',
    'nope',
    'https://o1.ingest.sentry.io/1',
    'https://k@o1.ingest.sentry.io/',
  ])('잘못된 DSN(%s) → null', (dsn) => {
    expect(parseSentryDsn(dsn)).toBeNull();
    expect(sentryCspReportUri(dsn)).toBeNull();
  });
});

describe('Worker CSP (B27, §2.9)', () => {
  const d = parse(buildWorkerCsp());

  it('unsafe-eval·unsafe-inline이 없고 wasm 컴파일만 허용', () => {
    expect(buildWorkerCsp()).not.toContain("'unsafe-eval'");
    expect(buildWorkerCsp()).not.toContain("'unsafe-inline'");
    expect(d['script-src']).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
      'https://cdn.jsdelivr.net/pyodide/v314.0.7/',
    ]);
  });

  it('자체 호스팅·jsDelivr 폴백만 fetch, 나머지는 none', () => {
    expect(d['connect-src']).toEqual([
      "'self'",
      'https://cdn.jsdelivr.net/pyodide/v314.0.7/',
    ]);
    expect(d['default-src']).toEqual(["'none'"]);
    // Firefox는 worker-src 'none'·base-uri 'none'이 있으면 Worker를 시작하지 못함 (실측)
    expect(d['worker-src']).toBeUndefined();
    expect(d['base-uri']).toBeUndefined();
  });

  it('Pyodide 버전·폴백 주소가 실행기와 같음', () => {
    expect(CSP_PYODIDE_VERSION).toBe(PYODIDE_VERSION);
    expect(PYODIDE_CDN_URL.startsWith(PYODIDE_CDN_PREFIX)).toBe(true);
    const worker = readFileSync(
      path.resolve(__dirname, '../../../../public/workers/pyodide-worker.mjs'),
      'utf8',
    );
    // Worker의 폴백 indexURL이 CSP가 허용하는 경로 아래에 있어야 함
    const cdn =
      /indexURL:\s*`(https:\/\/cdn\.jsdelivr\.net\/pyodide\/v)\$\{PYODIDE_VERSION\}\//.exec(
        worker,
      );
    expect(cdn?.[1]).toBe('https://cdn.jsdelivr.net/pyodide/v');
  });
});

describe('그 밖의 헤더', () => {
  it('공통 보안 헤더', () => {
    const headers = Object.fromEntries(
      COMMON_SECURITY_HEADERS.map((h) => [h.key, h.value]),
    );
    expect(headers).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
    });
    for (const feature of ['camera', 'microphone', 'geolocation']) {
      expect(headers['Permissions-Policy']).toContain(`${feature}=()`);
    }
    // HSTS는 Vercel이 붙인다 (중복 방지)
    expect(headers['Strict-Transport-Security']).toBeUndefined();
  });

  it('API CSP는 아무것도 불러오지 않음', () => {
    expect(parse(API_CSP)).toEqual({
      'default-src': ["'none'"],
      'frame-ancestors': ["'none'"],
    });
  });

  it('정적 정책 경로는 랜딩만', () => {
    expect(isStaticPagePath('/')).toBe(true);
    for (const p of ['/notice', '/board', '/world', '/quest/1-1', '/nope']) {
      expect(isStaticPagePath(p)).toBe(false);
    }
  });

  it('Report-Only 전환은 CSP_REPORT_ONLY=true일 때만', () => {
    expect(isCspReportOnly('true')).toBe(true);
    expect(isCspReportOnly(' TRUE ')).toBe(true);
    for (const v of [undefined, '', 'false', '1']) {
      expect(isCspReportOnly(v)).toBe(false);
    }
    expect(cspHeaderName(true)).toBe('Content-Security-Policy-Report-Only');
    expect(cspHeaderName(false)).toBe('Content-Security-Policy');
  });

  it('nonce는 요청마다 다른 128비트 base64', () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });
});
