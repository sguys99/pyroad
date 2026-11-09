import { loadWorldMapData } from '@/lib/world/loadWorldMapData';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { MapBackground } from '@/components/world/MapBackground';
import { PageTransition } from '@/components/shared/PageTransition';
import { StageLockedNotice } from '@/components/world/StageLockedNotice';
import { InstallHint } from '@/components/pwa/InstallHint';
import { isStageLockedNotice } from '@/lib/world/stageLock';
import { LogoutButton } from '@/components/LogoutButton';
import { SoundToggle } from '@/components/sound/SoundToggle';
import { WorldBgm } from '@/components/sound/WorldBgm';
import { User, MessageSquare, Bell } from 'lucide-react';
import type { WorldId } from '@/lib/design/tokens';

interface Props {
  // notice=stage-locked: 잠긴 스테이지의 퀘스트를 URL 로 열어 돌아옴 (B38, 퀘스트 페이지 가드)
  searchParams: Promise<{ notice?: string | string[] }>;
}

export default async function WorldPage({ searchParams }: Props) {
  const { notice } = await searchParams;
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  const { profile, badges, showApiKeyAlert } = data;

  // 진행 중 월드의 지도만 (Q50, P5-12). 월드별 주소 /world/[slug]·월드 선택은 P5-01
  const current = data.progress.current;
  const currentMap = current?.world.map;

  return (
    <>
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6 lg:max-w-5xl">
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

        {current && currentMap && (
          <MapBackground
            world={current.world.order as WorldId}
            className="rounded-2xl overflow-hidden"
          >
            <WorldMap stages={current.stages} map={currentMap} />
          </MapBackground>
        )}
      </PageTransition>

      {/* 월드 BGM: 기본 꺼짐, 설정에서 켠 경우만 (P2-14) */}
      {currentMap && <WorldBgm id={currentMap.bgm} />}

      {/* fixed 안내라 transform 이 걸리는 PageTransition 밖에 둔다 */}
      {/* 홈 화면에 추가 쪽지 (P4-11): 다른 안내가 떠 있으면 띄우지 않음 (아래 가운데 자리를 같이 씀) */}
      {isStageLockedNotice(notice) ? <StageLockedNotice /> : <InstallHint />}
    </>
  );
}
