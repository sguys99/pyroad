import 'server-only';

import { getAuthUser } from '@/lib/supabase/auth';
import { createClient } from '@/lib/supabase/server';
import { OWN_PROFILE_SELECT } from '@/lib/avatar/ownProfile';
import { loadUserApiKeys } from '@/lib/tutor/apiKeys';

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
 * 사용자 데이터는 절대 캐시하지 않는다.
 *
 * 최신 유지(무효화) 규칙 — 로그인 화면은 `force-dynamic`이고 Next 15 Router Cache 의 동적 페이지 staleTime 은 0 이라
 * `/world` 로 이동할 때마다 새로 렌더한다. 화면에 머문 채 바뀌는 경우만 따로 처리한다:
 * - 퀘스트 완료·황금키 마지막 단계(완료 API): `/api/quest/complete` 의 revalidatePath('/world','/profile') + `useQuestSession` 의 router.refresh()
 * - 같은 데이터를 `/world/[slug]`·`/worlds`(P5-01)도 읽는다. 무효화 경로는 `/world`(layout, 하위 월드 포함)·`/worlds`
 * - 진행 리셋: `/api/account/reset` 의 revalidatePath + `AccountManagementSection` 의 router.refresh() (본 기록도 지움, P5-05)
 * - 잠금 해제 본 기록(P5-05): `/api/world/unlocks` 는 무효화하지 않는다. 지도가 기록을 보낸 뒤에는 이 화면에서 다시 쓰지 않고,
 *   다음 방문은 새로 렌더하며, 같은 세션의 중복 재생은 화면 쪽(useStageUnlock)이 막는다
 * - 설정·API 키·닉네임 변경: 다른 화면에서 일어나고 `/world` 로 돌아올 때 새로 렌더됨 (별도 무효화 없음)
 * - 콘텐츠(seed): 캐시가 없으니 다음 요청부터 반영
 * 새 쓰기 API 가 월드맵에 보이는 값을 바꾸면 위 목록에 더하고, 화면에 머문 채 바뀌면 router.refresh() 를 부른다.
 */
export async function loadWorldMapData(): Promise<WorldMapData | null> {
  const supabase = await createClient();
  const [{ user }, apiKeys, stages, progress, profile, seen] =
    await Promise.all([
      getAuthUser(),
      // 본인 API 키는 service_role 전용 테이블에 있어 확인한 id 로만 (B13)
      getAuthUser().then(({ user }) =>
        user ? loadUserApiKeys(user.id) : null,
      ),
      // 순서는 (월드 order, 스테이지 order): getWorldStatuses 가 world.order 로 정렬 (P1-08)
      supabase
        .from('stages')
        .select(
          'id, world_id, order, title, theme_name, description, is_final, created_at, world:worlds(order), quests(id, order, title, concept, quest_type, is_mobile_friendly)',
        ),
      supabase
        .from('user_progress')
        .select(
          'user_id, quest_id, status, best_stars, completed_at, used_golden_key, created_at',
        ),
      supabase.from('users').select(OWN_PROFILE_SELECT).maybeSingle(),
      // 잠금 해제 연출 본 기록 (P5-05, 00025). 실패하면(00025 전 DB) null → 연출·기록을 하지 않음
      supabase.from('user_seen_unlocks').select('user_id, stage_id'),
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
    },
    serverWorlds(),
  );
}
