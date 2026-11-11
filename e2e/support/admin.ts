// 로컬 Supabase 를 service_role 로 다루는 e2e 도우미 (P1-21). 운영 DB 에는 닿지 않는다 (env.ts 가 로컬 주소만 허용).
//
// 테스트 사용자는 실행마다 새로 만들고(auth.setup.ts) 끝나면 지운다(auth.teardown.ts).
// 테스트마다 진행을 처음 상태로 되돌려(resetUser) 순서와 무관하게 같은 결과가 나오게 한다.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { REPO_ROOT, requireLocalStack, USER_FILE } from './env';

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
 * + 잠금 해제 본 기록 삭제 (P5-05)
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
  // 잠금 해제 본 기록 (P5-05): 앱의 진행 리셋과 같게 지운다 → 다음 첫 방문은 연출 없이 조용히 기록
  check(
    'user_seen_unlocks 삭제',
    await db.from('user_seen_unlocks').delete().eq('user_id', userId),
  );
  // 퀴즈 시도 기록 (P7-15): reset_progress 는 남기는데, 오늘의 퀴즈 완료(dailyQuizResults)가 오늘 시도로 세므로 지운다
  check(
    'quiz_attempts 삭제',
    await db.from('quiz_attempts').delete().eq('user_id', userId),
  );
  // 스트릭 방패 (P8-08): 앱 리셋은 남기지만, 지난 실행의 방패·방패 날이 스트릭 값을 바꾸지 않게 지운다 (출석 기록은 원장이라 남음)
  for (const t of ['streak_shield_days', 'user_streak_shields'] as const)
    check(`${t} 삭제`, await db.from(t).delete().eq('user_id', userId));
  // 업적 (P8-09): 앱 리셋은 남기지만, 스펙마다 첫 완료 업적 카드가 다시 뜨게 지운다 (받은 코인은 원장이라 남음 → 다시 받으면 0)
  check(
    'user_achievements 삭제',
    await db.from('user_achievements').delete().eq('user_id', userId),
  );
}

/** 퀴즈 공개 부분(quests.prompt_skeleton.quiz)과 서버 전용 정답(quest_answer_keys.quiz_answer)을 service_role 로 (P7-15) */
export async function quizKey(questId: string): Promise<{
  kind: string;
  quiz: Record<string, unknown>;
  accepted: unknown[];
  explanation: string;
  explanations: Record<string, string>;
}> {
  const db = adminClient();
  const quest = check(
    `quests ${questId}`,
    await db
      .from('quests')
      .select('quiz_kind, prompt_skeleton')
      .eq('id', questId)
      .single(),
  ) as {
    quiz_kind: string;
    prompt_skeleton: { quiz: Record<string, unknown> };
  };
  const key = check(
    `quest_answer_keys ${questId}`,
    await db
      .from('quest_answer_keys')
      .select('quiz_answer')
      .eq('quest_id', questId)
      .single(),
  ) as {
    quiz_answer: {
      accepted: unknown[];
      explanation: string;
      explanations?: Record<string, string>;
    };
  };
  return {
    kind: quest.quiz_kind,
    quiz: quest.prompt_skeleton.quiz,
    accepted: key.quiz_answer.accepted,
    explanation: key.quiz_answer.explanation,
    explanations: key.quiz_answer.explanations ?? {},
  };
}

/** 사용자의 서버 XP (users.total_xp) */
export async function totalXp(userId: string): Promise<number> {
  const row = check(
    'users total_xp',
    await adminClient()
      .from('users')
      .select('total_xp')
      .eq('id', userId)
      .single(),
  ) as { total_xp: number };
  return row.total_xp;
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

/**
 * 퀘스트 최고 별 (P8-05). 다시 풀기 스펙이 "별이 모자란 완료"를 만들 때 (서버 값이라 service_role 로만).
 * 판정일은 오래전으로 → 복습 도전이 열린 상태 (§12-Q64, 같은 날은 연습)
 */
export async function setBestStars(
  userId: string,
  questId: string,
  stars: number,
): Promise<void> {
  check(
    `best_stars ${questId}`,
    await adminClient()
      .from('user_progress')
      .update({ stars, best_stars: stars, stars_judged_on: '2000-01-01' })
      .eq('user_id', userId)
      .eq('quest_id', questId),
  );
}

export async function bestStars(userId: string, questId: string) {
  const row = check(
    'user_progress.best_stars',
    await adminClient()
      .from('user_progress')
      .select('best_stars')
      .eq('user_id', userId)
      .eq('quest_id', questId)
      .single(),
  ) as { best_stars: number };
  return row.best_stars;
}

/**
 * 코인 (P8-04). 진행 리셋(resetUser)은 코인·원장을 지우지 않으므로(P8-03 정책) 같은 실행의 스펙끼리 잔액이 이어진다
 * → 스펙은 절대값 대신 지금 잔액·원장 키를 읽어 기대값을 정한다
 */
export async function coinBalance(userId: string): Promise<number> {
  const row = check(
    'users.coins',
    await adminClient().from('users').select('coins').eq('id', userId).single(),
  ) as { coins: number };
  return row.coins;
}

/** 원장에 그 키가 이미 있는지 (있으면 같은 보상은 다시 안 줌) */
export async function hasCoinKey(
  userId: string,
  source: string,
  ref: string,
): Promise<boolean> {
  const rows = check(
    `coin_ledger ${source}:${ref}`,
    await adminClient()
      .from('coin_ledger')
      .select('id')
      .eq('user_id', userId)
      .eq('source', source)
      .eq('ref', ref),
  ) as unknown[];
  return rows.length > 0;
}

/** 테스트용 코인 지급 (grant_coins, 이번 호출만의 키) */
export async function grantTestCoins(userId: string, amount: number) {
  check(
    'grant_coins',
    await adminClient().rpc('grant_coins', {
      p_user_id: userId,
      p_source: 'retro',
      p_ref: `e2e:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      p_amount: amount,
    }),
  );
}

/** `content:build -- --fixtures`가 만든 테스트 월드 행 (Q48, P5-01). 앱 서버는 같은 빌드의 worlds.json 을 읽는다 */
export const FIXTURE_ROWS = join(REPO_ROOT, 'build/e2e/rows.json');

interface FixtureRows {
  worlds: Array<{ slug: string } & Record<string, unknown>>;
  stages: Array<{ id: string; world: string } & Record<string, unknown>>;
  quests: Array<Record<string, unknown>>;
  answer_keys: Array<Record<string, unknown>>;
}

function readFixtureRows(): FixtureRows {
  try {
    return JSON.parse(readFileSync(FIXTURE_ROWS, 'utf8')) as FixtureRows;
  } catch {
    throw new Error(
      `[e2e] 테스트 월드 행(${FIXTURE_ROWS})이 없어요. npm run content:build -- --fixtures e2e/fixtures/content`,
    );
  }
}

/** 테스트 월드를 로컬 DB 에 넣는다 (seed.sql 과 같은 업서트, 운영 seed 에는 없음). 끝나면 removeFixtureWorlds */
export async function installFixtureWorlds(): Promise<FixtureRows> {
  const db = adminClient();
  const rows = readFixtureRows();
  const worlds = check(
    'worlds 업서트',
    await db
      .from('worlds')
      .upsert(rows.worlds, { onConflict: 'slug' })
      .select('id, slug'),
  ) as Array<{ id: string; slug: string }>;
  const worldId = new Map(worlds.map((w) => [w.slug, w.id]));
  check(
    'stages 업서트',
    await db.from('stages').upsert(
      rows.stages.map(({ world, ...s }) => ({
        ...s,
        world_id: worldId.get(world),
      })),
    ),
  );
  check('quests 업서트', await db.from('quests').upsert(rows.quests));
  check(
    'quest_answer_keys 업서트',
    await db
      .from('quest_answer_keys')
      .upsert(rows.answer_keys, { onConflict: 'quest_id' }),
  );
  return rows;
}

/** 테스트 월드 행 삭제 (스테이지를 지우면 퀘스트·정답·진행이 같이 지워짐) */
export async function removeFixtureWorlds(): Promise<void> {
  const db = adminClient();
  const rows = readFixtureRows();
  check(
    'stages 삭제',
    await db
      .from('stages')
      .delete()
      .in(
        'id',
        rows.stages.map((s) => s.id),
      ),
  );
  check(
    'worlds 삭제',
    await db
      .from('worlds')
      .delete()
      .in(
        'slug',
        rows.worlds.map((w) => w.slug),
      ),
  );
}
