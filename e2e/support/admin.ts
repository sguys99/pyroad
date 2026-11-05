// 로컬 Supabase 를 service_role 로 다루는 e2e 도우미 (P1-21). 운영 DB 에는 닿지 않는다 (env.ts 가 로컬 주소만 허용).
//
// 테스트 사용자는 실행마다 새로 만들고(auth.setup.ts) 끝나면 지운다(auth.teardown.ts).
// 테스트마다 진행을 처음 상태로 되돌려(resetUser) 순서와 무관하게 같은 결과가 나오게 한다.

import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireLocalStack, USER_FILE } from './env';

export interface E2eUser {
  id: string;
  email: string;
}

let admin: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (!admin) {
    const stack = requireLocalStack();
    admin = createClient(stack.url, stack.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

/** auth.setup.ts 가 만든 이번 실행의 테스트 사용자 */
export function readE2eUser(): E2eUser {
  try {
    return JSON.parse(readFileSync(USER_FILE, 'utf8')) as E2eUser;
  } catch {
    throw new Error(
      `[e2e] 테스트 사용자 정보(${USER_FILE})가 없어요. setup 프로젝트가 먼저 돌아야 해요 (npx playwright test --project=chromium)`,
    );
  }
}

function check<T>(
  label: string,
  result: { data: T; error: { message: string } | null },
): T {
  if (result.error)
    throw new Error(`[e2e] ${label} 실패: ${result.error.message}`);
  return result.data;
}

/**
 * 진행·뱃지·XP·황금키를 처음 상태로 (`reset_progress(…, 'all')`, 앱의 전체 리셋과 같은 RPC)
 * + 튜터 요청 한도 카운터 삭제 (같은 사용자가 1분 안에 퀘스트를 여러 번 열면 소개 한도 8회/분에 걸림)
 */
export async function resetUser(userId: string): Promise<void> {
  const db = adminClient();
  check(
    'reset_progress',
    await db.rpc('reset_progress', { p_user_id: userId, p_scope: 'all' }),
  );
  check(
    'api_rate_limits 삭제',
    await db.from('api_rate_limits').delete().eq('user_id', userId),
  );
}

/** 앞 퀘스트를 서버 완료 RPC 로 끝내 둔다 (앱의 /api/quest/complete 가 채점 뒤 부르는 것과 같은 함수) */
export async function completeQuests(
  userId: string,
  quests: ReadonlyArray<{ id: string; solution: string }>,
): Promise<void> {
  const db = adminClient();
  for (const q of quests) {
    check(
      `complete_quest ${q.id}`,
      await db.rpc('complete_quest', {
        p_user_id: userId,
        p_quest_id: q.id,
        p_submission: { code: q.solution, passed: true },
      }),
    );
  }
}
