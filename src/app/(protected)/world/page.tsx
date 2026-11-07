import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStageStatuses } from '@/lib/world/getStageStatuses';
import { loadUserApiKeys } from '@/lib/tutor/apiKeys';
import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { MapBackground } from '@/components/world/MapBackground';
import { PageTransition } from '@/components/shared/PageTransition';
import { StageLockedNotice } from '@/components/world/StageLockedNotice';
import { isStageLockedNotice } from '@/lib/world/stageLock';
import { LogoutButton } from '@/components/LogoutButton';
import { SoundToggle } from '@/components/sound/SoundToggle';
import { WorldBgm } from '@/components/sound/WorldBgm';
import { User, MessageSquare, Bell } from 'lucide-react';
import type { UserBadge, UserProfile } from '@/lib/types/database';
import { OWN_PROFILE_SELECT, toOwnProfile } from '@/lib/avatar/ownProfile';

interface Props {
  // notice=stage-locked: 잠긴 스테이지의 퀘스트를 URL 로 열어 돌아옴 (B38, 퀘스트 페이지 가드)
  searchParams: Promise<{ notice?: string | string[] }>;
}

export default async function WorldPage({ searchParams }: Props) {
  const { notice } = await searchParams;
  const supabase = await createClient();

  // getAuthUser()와 user.id 불필요한 stages 쿼리를 병렬 실행
  const [{ user }, stagesResult] = await Promise.all([
    getAuthUser(),
    // 순서는 (월드 order, 스테이지 order): getStageStatuses 가 world.order 로 정렬 (P1-08, stages."order" 는 월드 안에서만 유일)
    supabase
      .from('stages')
      .select(
        'id, world_id, order, title, theme_name, description, is_final, created_at, world:worlds(order), quests(id, order)',
      ),
  ]);
  if (!user) redirect('/');

  // user.id 필요한 쿼리는 이후 병렬 실행
  const [progressResult, profileResult, badgesResult, apiKeys] =
    await Promise.all([
      supabase
        .from('user_progress')
        .select('quest_id, status')
        .eq('user_id', user.id),
      supabase
        .from('users')
        .select(OWN_PROFILE_SELECT)
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_badges')
        .select('badge_type, earned_at')
        .eq('user_id', user.id),
      // 본인 API 키는 service_role 전용 테이블에 있어 서버에서만 확인 (B13)
      loadUserApiKeys(user.id),
    ]);

  const stages = stagesResult.data ?? [];
  const progress = progressResult.data ?? [];
  const profile: UserProfile | null = profileResult.data
    ? toOwnProfile(profileResult.data)
    : null;
  const badges = (badgesResult.data ?? []) as Pick<
    UserBadge,
    'badge_type' | 'earned_at'
  >[];

  const stagesWithStatus = getStageStatuses(stages, progress);

  // API 키 상태 확인: 사용자 커스텀 키 유무만 체크 (서버 기본 키는 무시).
  // 서버에 암호화 키가 없어 커스텀 키를 받을 수 없으면 등록 안내도 띄우지 않음
  const showApiKeyAlert =
    apiKeys.enabled && Object.keys(apiKeys.keys).length === 0;

  return (
    <>
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6">
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">모험 지도</h1>
          <div className="flex items-center gap-2">
            <Link
              href="/notice"
              aria-label="공지사항"
              className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary-soft"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">공지사항</span>
            </Link>
            <Link
              href="/board"
              aria-label="게시판"
              className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary-soft"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">게시판</span>
            </Link>
            <Link
              href="/profile"
              aria-label="내 프로필"
              className="inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary-soft"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">내 프로필</span>
            </Link>
            <LogoutButton />
            <SoundToggle />
          </div>
        </div>

        {showApiKeyAlert && (
          <div className="relative z-10">
            <ApiKeyAlert />
          </div>
        )}

        {profile && (
          <div className="relative z-10 mb-6">
            <ProfileSummary profile={profile} badges={badges} />
          </div>
        )}

        <MapBackground world={1} className="rounded-2xl overflow-hidden">
          <WorldMap stages={stagesWithStatus} />
        </MapBackground>
      </PageTransition>

      {/* 월드 BGM: 기본 꺼짐, 설정에서 켠 경우만 (P2-14) */}
      <WorldBgm id="world1" />

      {/* fixed 안내라 transform 이 걸리는 PageTransition 밖에 둔다 */}
      {isStageLockedNotice(notice) && <StageLockedNotice />}
    </>
  );
}
