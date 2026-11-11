import 'server-only';

import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { OWN_PROFILE_SELECT } from '@/lib/avatar/ownProfile';
import { loadUserApiKeys } from '@/lib/tutor/apiKeys';
import { createAdminClient } from '@/lib/supabase/admin';
import { worldDailyStatusRpc } from '@/lib/quest/rewardRpc';
import { kstStartOfDay, kstToday } from '@/lib/time/kst';

import { toWorldMapData, type WorldMapData } from './mapData';
import { serverWorlds } from './serverWorlds';

/**
 * 월드맵(`/world`) 서버 데이터를 한 번의 병렬 묶음으로 읽는다 (P5-13). 로그인 안 했으면 null.
 *
 * 왕복: 전에는 getUser → (진행·프로필·뱃지·API 키) 2단계였다. 지금은 사용자 테이블(users·user_progress)을
 * user.id 필터 없이 RLS(본인 행만, `(select auth.uid())`)에 맡겨 getUser 와 같이 보내고, service_role 로 읽는 API 키만
 * 확인한 user.id 로 getUser 뒤에 잇는다. 결과는 getUser 가 사용자를 확인한 뒤에만 쓰고, 행은 그 id 로 한 번 더 거른다.
 *
 * 캐시: 하지 않는다. 공개 콘텐츠(worlds·stages·quests)도 RLS 가 authenticated 전용이라 캐시하려면 service_role 로 읽어야 하고,
 * seed 배포 뒤 오래된 목록이 남을 위험이 있는데, 로컬에서 쿼리 하나가 약 2ms 이고 getUser 와 병렬이라 줄어드는 시간이 없다
 * (측정: docs/perf/P5-13-world-data.md). 월드 지도 설정(WORLDS, e2e 는 serverWorlds 가 테스트 월드를 더함)은 빌드 생성물이라 캐시가 필요 없다.
 * 사용자 데이터는 절대 캐시하지 않는다. 오늘의 퀴즈(P7-10)는 같은 묶음의 오늘 quiz_attempts 로 계산하고 `/daily` 도 이 함수를 쓴다.
 *
 * 최신 유지(무효화) 규칙 — 로그인 화면은 `force-dynamic`이고 Next 15 Router Cache 의 동적 페이지 staleTime 은 0 이라
 * `/world` 로 이동할 때마다 새로 렌더한다. 화면에 머문 채 바뀌는 경우만 따로 처리한다:
 * - 퀘스트 완료·황금키 마지막 단계(완료 API): `/api/quest/complete` 의 revalidatePath('/world','/profile') + `useQuestSession` 의 router.refresh()
 * - 같은 데이터를 `/world/[slug]`·`/worlds`(P5-01)도 읽는다. 무효화 경로는 `/world`(layout, 하위 월드 포함)·`/worlds`
 * - 보물상자 열기(P8-06): `/api/world/chest` 의 revalidatePath + `StageSheet` 의 router.refresh() (HUD 코인·상자 상태)
 * - 출석 도장(P8-08): `/api/attendance/stamp` 의 revalidatePath + `AttendanceCard` 의 router.refresh() (HUD 코인·출석 칸).
 *   스트릭 방패는 렌더마다 `world_daily_status` 가 정산(멱등)
 * - 데일리 미션 받기(P8-07): `/api/missions/claim` 의 revalidatePath + `MissionList`(DailyMissions.tsx) 의 router.refresh() (HUD 코인·XP·미션 칸).
 *   미션 진행은 HUD 미션 칸(`WorldHudBar`)이 렌더마다 서버 RPC 로 다시 셈
 * - 진행 리셋: `/api/account/reset` 의 revalidatePath + `AccountManagementSection` 의 router.refresh() (본 기록도 지움, P5-05)
 * - 잠금 해제 본 기록(P5-05): `/api/world/unlocks` 는 무효화하지 않는다. 지도가 기록을 보낸 뒤에는 이 화면에서 다시 쓰지 않고,
 *   다음 방문은 새로 렌더하며, 같은 세션의 중복 재생은 화면 쪽(useStageUnlock)이 막는다
 * - 설정·API 키·닉네임 변경: 다른 화면에서 일어나고 `/world` 로 돌아올 때 새로 렌더됨 (별도 무효화 없음)
 * - 콘텐츠(seed): 캐시가 없으니 다음 요청부터 반영
 * 새 쓰기 API 가 월드맵에 보이는 값을 바꾸면 위 목록에 더하고, 화면에 머문 채 바뀌면 router.refresh() 를 부른다.
 */
export async function loadWorldMapData(): Promise<WorldMapData | null> {
  const supabase = await createClient();
  const today = kstToday();
  const [
    { user },
    apiKeys,
    stages,
    progress,
    profile,
    seen,
    attempts,
    chests,
    dailyRow,
    dailyStatus,
    readyAchievements,
  ] = await Promise.all([
    getAuthUser(),
    // 본인 API 키는 service_role 전용 테이블에 있어 확인한 id 로만 (B13)
    getAuthUser().then(({ user }) => (user ? loadUserApiKeys(user.id) : null)),
    // 순서는 (월드 order, 스테이지 order): getWorldStatuses 가 world.order 로 정렬 (P1-08)
    supabase
      .from('stages')
      .select(
        'id, world_id, order, title, theme_name, description, is_final, created_at, world:worlds(order), quests(id, order, title, concept, quest_type, quiz_kind, is_mobile_friendly)',
      ),
    supabase
      .from('user_progress')
      .select(
        'user_id, quest_id, status, best_stars, stars_judged_on, completed_at, used_golden_key, created_at',
      ),
    supabase.from('users').select(OWN_PROFILE_SELECT).maybeSingle(),
    // 잠금 해제 연출 본 기록 (P5-05, 00025). 실패하면(00025 전 DB) null → 연출·기록을 하지 않음
    supabase.from('user_seen_unlocks').select('user_id, stage_id'),
    // 오늘(KST) 퀴즈 시도: 오늘의 퀴즈 완료 계산 (P7-10, 본인 행 SELECT 정책 00012). 실패하면 끝난 문제 없음으로
    supabase
      .from('quiz_attempts')
      .select('user_id, quest_id, attempt_no, is_correct, created_at')
      .gte('created_at', kstStartOfDay(today).toISOString()),
    // 연 보물상자 (P8-06): 원장 chest/<stage_id> 본인 행(00030 SELECT 정책). 실패하면 안 연 것으로(열기 RPC 가 멱등)
    supabase.from('coin_ledger').select('user_id, ref').eq('source', 'chest'),
    // 오늘 저장한 오늘의 퀴즈 목록 (P8-07 §12-Q61, 00034 본인 행 SELECT). 없거나(그날 첫 방문·00034 전) 실패하면 지금 계산.
    // 미션 진행·배정은 HUD 미션 칸(WorldHudBar 의 Suspense)이 따로 — 여기서 기다리면 지도 렌더가 늦어짐
    supabase
      .from('user_daily_missions')
      .select('user_id, quiz_ids')
      .eq('day', today)
      .maybeSingle(),
    // 스트릭·방패·출석 (P8-08, 00035): 방패 정산(쓰기)이 있어 service_role 이라 확인한 id 로만. 실패(00035 전 DB)면 null
    getAuthUser().then(async ({ user }) => {
      if (!user) return null;
      const r = await worldDailyStatusRpc(createAdminClient(), user.id);
      return r.ok ? r.data : null;
    }),
    // 코인을 아직 안 받은 업적 (P8-10, 00036 본인 행 SELECT) → 메뉴의 업적 도감 금색 점. 실패하면 점 없음
    supabase
      .from('user_achievements')
      .select('user_id, achievement_id')
      .is('claimed_at', null),
    // 뱃지는 월드맵에 보이지 않아(옛 ProfileSummary 를 HUD 가 대신함, P5-07) 읽지 않는다. 프로필 화면이 따로 읽음
  ]);
  if (!user) return null;

  return toWorldMapData(
    user.id,
    {
      stages: stages.data ?? [],
      progress: progress.data ?? [],
      profile: profile.data,
      apiKeys,
      seen: seen.error ? null : seen.data,
      attempts: attempts.data,
      chests: chests.data,
      dailyQuizIds:
        dailyRow.data?.user_id === user.id ? dailyRow.data.quiz_ids : null,
      dailyStatus,
      readyAchievements: readyAchievements.data,
    },
    serverWorlds(),
    today,
  );
}
