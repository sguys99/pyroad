// e2e 실행 환경 (P1-21). playwright.config.ts 와 픽스처가 함께 쓴다.
//
// - 앱 서버는 로컬 Supabase 스택에만 붙는다. 저장소의 .env·.env.local 은 바꾸지 않고, Playwright webServer 에 env 로 주입한다
//   (Next 는 이미 있는 process.env 값을 .env 파일 값으로 덮지 않음 → 빈 문자열로 넣으면 파일 값이 무시됨).
// - LLM 키·Sentry DSN·ANALYTICS_SALT 등은 빈 값으로: 튜터는 저장된 답변 경로로만 답하고 외부 호출이 없다.
// - 스택 정보: E2E_SUPABASE_URL·E2E_SUPABASE_ANON_KEY·E2E_SUPABASE_SERVICE_ROLE_KEY 가 있으면 그것을,
//   없으면 `supabase status -o env --workdir <E2E_SUPABASE_WORKDIR | 저장소>`를 읽는다. 로컬 주소가 아니면 중단한다 (운영 DB 금지).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REPO_ROOT = resolve(__dirname, '../..');

/** 로그인 세션(storageState)과 테스트 사용자 정보. git 에 없음 (.gitignore e2e/.auth/) */
export const AUTH_DIR = join(REPO_ROOT, 'e2e/.auth');
export const STORAGE_STATE = join(AUTH_DIR, 'user.json');
export const USER_FILE = join(AUTH_DIR, 'user-meta.json');

export interface LocalStack {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

const LOCAL_URL_RE = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/;

function assertLocal(url: string): string {
  if (!LOCAL_URL_RE.test(url)) {
    throw new Error(
      `[e2e] Supabase 주소가 로컬이 아님: '${url}'. e2e 는 로컬 스택에만 붙습니다 (운영 DB 금지)`,
    );
  }
  return url.replace(/\/$/, '');
}

function readStatus(workdir: string): LocalStack | null {
  let out: string;
  try {
    out = execFileSync(
      'supabase',
      ['status', '-o', 'env', '--workdir', workdir],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 30_000,
      },
    );
  } catch {
    return null; // CLI 없음 또는 스택이 꺼져 있음
  }
  const get = (key: string) =>
    out.match(new RegExp(`^${key}="(.*)"$`, 'm'))?.[1] ?? '';
  const url = get('API_URL');
  const anonKey = get('ANON_KEY');
  const serviceRoleKey = get('SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceRoleKey) return null;
  return { url: assertLocal(url), anonKey, serviceRoleKey };
}

/**
 * 켜진 로컬 스택. 없으면 null (비로그인 `public` 프로젝트는 스택 없이 돈다).
 * 처음 읽은 값을 E2E_SUPABASE_* 로 process.env 에 남겨, 나중에 뜨는 테스트 워커는 CLI 를 다시 부르지 않는다.
 */
export function resolveLocalStack(): LocalStack | null {
  const {
    E2E_SUPABASE_URL,
    E2E_SUPABASE_ANON_KEY,
    E2E_SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;
  if (
    E2E_SUPABASE_URL &&
    E2E_SUPABASE_ANON_KEY &&
    E2E_SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      url: assertLocal(E2E_SUPABASE_URL),
      anonKey: E2E_SUPABASE_ANON_KEY,
      serviceRoleKey: E2E_SUPABASE_SERVICE_ROLE_KEY,
    };
  }
  if (process.env.E2E_NO_STACK === '1') return null;
  const stack = readStatus(process.env.E2E_SUPABASE_WORKDIR || REPO_ROOT);
  if (stack) {
    process.env.E2E_SUPABASE_URL = stack.url;
    process.env.E2E_SUPABASE_ANON_KEY = stack.anonKey;
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY = stack.serviceRoleKey;
  } else {
    process.env.E2E_NO_STACK = '1';
  }
  return stack;
}

/** 로그인 시나리오용: 스택이 꺼져 있으면 무엇을 하면 되는지 알려 주고 실패 */
export function requireLocalStack(): LocalStack {
  const stack = resolveLocalStack();
  if (!stack) {
    throw new Error(
      '[e2e] 로컬 Supabase 스택을 찾지 못했어요. `npm run db:start` 로 켜거나 ' +
        'E2E_SUPABASE_URL·E2E_SUPABASE_ANON_KEY·E2E_SUPABASE_SERVICE_ROLE_KEY 를 넣으세요. ' +
        '비로그인 스펙만 돌리려면 `npx playwright test --project=public`',
    );
  }
  return stack;
}

/** 외부 서비스·운영 값을 가리키는 키. 개발자 셸이나 .env 파일에 있어도 앱 서버에는 빈 값으로 넣는다 */
const ALWAYS_BLANK = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'API_KEY_ENCRYPTION_KEY',
  'API_KEY_ENCRYPTION_KEY_PREVIOUS',
  'ADMIN_EMAIL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'SENTRY_DSN',
  'SENTRY_AUTH_TOKEN',
  'ANALYTICS_SALT',
  'CSP_REPORT_ONLY',
];

/** Next 가 읽는 .env 파일들에 적힌 키 (주석 제외) */
function envFileKeys(): string[] {
  const files = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.env.development',
    '.env.development.local',
  ];
  const keys = new Set<string>();
  for (const file of files) {
    const path = join(REPO_ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) keys.add(m[1]);
    }
  }
  return [...keys];
}

/** 스택이 없을 때(비로그인 스펙만) 미들웨어가 Supabase 클라이언트를 만들 수 있게 넣는 자리 값. 세션이 없으면 요청을 보내지 않는다 */
const NO_STACK_PLACEHOLDER: LocalStack = {
  url: 'http://127.0.0.1:54521',
  anonKey: 'e2e-no-local-stack',
  serviceRoleKey: 'e2e-no-local-stack',
};

/** Playwright webServer 에 넘길 env: .env 파일 값은 모두 무시되고 로컬 스택만 가리킨다 */
export function serverEnv(
  stack: LocalStack | null,
  port: number,
): Record<string, string> {
  const s = stack ?? NO_STACK_PLACEHOLDER;
  const blank = Object.fromEntries(
    [...envFileKeys(), ...ALWAYS_BLANK].map((key) => [key, '']),
  );
  return {
    ...blank,
    NEXT_PUBLIC_SUPABASE_URL: s.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: s.serviceRoleKey,
    NEXT_TELEMETRY_DISABLED: '1',
    // 테스트 전용 페이지(/dev/editor, P2-18). 운영 배포에는 없는 값이라 거기서는 404
    PYROAD_TEST_PAGES: '1',
    // 테스트 월드 지도 설정 (Q48, P5-01): webServer 명령이 먼저 `content:build -- --fixtures`로 만든다 (src/lib/world/serverWorlds.ts)
    PYROAD_E2E_WORLDS: join(REPO_ROOT, 'build/e2e/worlds.json'),
    PORT: String(port),
  };
}

/**
 * 앱 서버가 보는 Supabase 주소 (스택이 없으면 자리 값). 비로그인 스펙이 GoTrue authorize 이동을 가로챌 때 쓴다
 * (P3-17 support/oauthMock.ts: 가로채므로 스택이 꺼져 있어도 됨)
 */
export function appSupabaseUrl(): string {
  return (resolveLocalStack() ?? NO_STACK_PLACEHOLDER).url;
}
