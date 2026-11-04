// P0-13 공용 유틸: 환경 로드, psql, 테스트 사용자 세션 쿠키, 장비 부하 대기, 통계
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';

export const WORK = process.env.P013_WORK ?? process.cwd();
export const APP = process.env.P013_APP ?? 'http://localhost:3113';
export const CHROME =
  process.env.CHROME_PATH ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');
// 결과(요약 JSON)를 쓸 저장소 쪽 스파이크 디렉터리. run-all.sh 가 스크립트를 작업 디렉터리로 복사해 실행하므로 env 로 받음
export const SPIKE = process.env.P013_SPIKE ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const RAW = path.join(WORK, 'raw');
fs.mkdirSync(RAW, { recursive: true });

export function loadEnv() {
  const txt = fs.readFileSync(path.join(WORK, 'supabase.env'), 'utf8');
  return Object.fromEntries(
    txt
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}
export const ENV = loadEnv();

export function psql(sql) {
  return execFileSync('docker', ['exec', '-i', ENV.DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    encoding: 'utf8',
  }).trim();
}

// ── 테스트 사용자 ───────────────────────────────────────────
export const USERS = {
  perf: { email: 'perf@pyroad.local', name: '측정 모험가' }, // 1·2스테이지 완료, 3스테이지 2/7
  newbie: { email: 'newbie@pyroad.local', name: '새싹 모험가' }, // 진행 없음 (첫 퀘스트 첫 방문)
  celeb: { email: 'celeb@pyroad.local', name: '축하 모험가' }, // 1스테이지 6/7 → 마지막 퀘스트로 스테이지 클리어+레벨업 연출
};
export const PASSWORD = 'perf-test-1234!';
export const QUEST = {
  first: 'b1000000-0000-0000-0000-000000000001', // 1-1 첫 번째 인사
  stage1Last: 'b1000000-0000-0000-0000-000000000026', // 1-7 마을 안내판 만들기 (75XP)
  project: 'b1000000-0000-0000-0000-000000000022', // 7-1 숫자 맞추기 게임 (프로젝트, 5단계)
};
export const STAGE1_LAST_ANSWER = 'print("=== 파이썬 마을 ===")\nprint("인구: 2026명")\nprint("환영합니다!")\n';

async function admin(pathname, init = {}) {
  const res = await fetch(`${ENV.API_URL}/auth/v1${pathname}`, {
    ...init,
    headers: { apikey: ENV.SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export async function ensureUser(key) {
  const u = USERS[key];
  const found = psql(`select id from auth.users where email='${u.email}'`);
  if (found) return found;
  const r = await admin('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.name } }),
  });
  if (r.status >= 300) throw new Error(`사용자 생성 실패 ${u.email}: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.id;
}

/** @supabase/ssr 서버 클라이언트로 로그인 → 앱(미들웨어)이 읽는 것과 똑같은 이름·청크·인코딩의 쿠키 */
export async function sessionCookies(key) {
  const jar = new Map();
  const sb = createServerClient(ENV.API_URL, ENV.ANON_KEY, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { error } = await sb.auth.signInWithPassword({ email: USERS[key].email, password: PASSWORD });
  if (error) throw new Error(`로그인 실패 ${key}: ${error.message}`);
  const host = new URL(APP).hostname;
  return [...jar.entries()].map(([name, value]) => ({ name, value, domain: host, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }));
}

// celeb 사용자를 "1스테이지 마지막 퀘스트 직전" 상태로 되돌림 (축하 연출을 매번 다시 재생하기 위해)
export function resetCeleb(uid) {
  psql(`
    delete from user_progress where user_id='${uid}' and quest_id='${QUEST.stage1Last}';
    delete from user_badges where user_id='${uid}' and badge_type='stage_clear';
    update users set total_xp=280, current_level=2, golden_keys=3 where id='${uid}';`);
}

// ── 장비 부하 대기 ───────────────────────────────────────────
export function machineState() {
  const load = os.loadavg();
  let port3107 = false;
  try {
    execSync("ss -ltn | grep -q ':3107 '", { stdio: 'ignore' });
    port3107 = true;
  } catch {}
  return { load1: +load[0].toFixed(2), load5: +load[1].toFixed(2), load15: +load[2].toFixed(2), port3107Busy: port3107, at: new Date().toISOString() };
}

/** 3107 포트가 비고 1분 부하가 maxLoad 미만이 될 때까지 1분마다 확인 (최대 maxMin분). 결과를 그대로 기록에 남김 */
export async function waitQuiet({ maxLoad = Number(process.env.P013_MAX_LOAD ?? 6), maxMin = Number(process.env.P013_MAX_WAIT_MIN ?? 40), label = '' } = {}) {
  const t0 = Date.now();
  for (;;) {
    const s = machineState();
    const ok = !s.port3107Busy && s.load1 < maxLoad;
    const waitedMin = (Date.now() - t0) / 60000;
    if (ok || waitedMin >= maxMin || process.env.P013_NO_WAIT === '1') {
      const out = { ...s, settled: ok, waitedMin: +waitedMin.toFixed(1), label };
      console.log(`[quiet] ${label} load1=${s.load1} port3107=${s.port3107Busy ? 'busy' : 'free'} waited=${out.waitedMin}min ${ok ? 'OK' : 'NOT SETTLED (measuring anyway)'}`);
      return out;
    }
    console.log(`[quiet] ${label} waiting… load1=${s.load1} port3107=${s.port3107Busy ? 'busy' : 'free'} (${waitedMin.toFixed(1)}min)`);
    await new Promise((r) => setTimeout(r, 60000));
  }
}

// ── 통계 ───────────────────────────────────────────────────
export const sorted = (xs) => xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
export function median(xs) {
  const v = sorted(xs);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
export function pct(xs, p) {
  const v = sorted(xs);
  if (!v.length) return null;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}
export const spread = (xs) => {
  const v = sorted(xs);
  return v.length ? [v[0], v[v.length - 1]] : null;
};
export const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
export const r0 = (x) => (x == null ? null : Math.round(x));
export function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
