import Link from 'next/link';
import { User, MessageSquare, Bell } from 'lucide-react';

import { WorldMap } from '@/components/world/WorldMap';
import { ProfileSummary } from '@/components/world/ProfileSummary';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { PageTransition } from '@/components/shared/PageTransition';
import { StageLockedNotice } from '@/components/world/StageLockedNotice';
import { InstallHint } from '@/components/pwa/InstallHint';
import { LogoutButton } from '@/components/LogoutButton';
import { SoundToggle } from '@/components/sound/SoundToggle';
import { WorldBgm } from '@/components/sound/WorldBgm';
import { LockedBook } from '@/components/world/book/LockedBook';
import { NextBooks } from '@/components/world/book/NextBooks';
import { WorldMapHead } from '@/components/world/book/WorldMapHead';
import type { WorldWithStatus } from '@/lib/world/getStageStatuses';
import type { WorldMapData } from '@/lib/world/mapData';
import { isStageLockedNotice } from '@/lib/world/stageLock';
import {
  bookNo,
  isOpenable,
  unlockText,
  worldTint,
} from '@/lib/world/worldBook';

const HUD_LINK =
  'inline-flex items-center gap-0.5 sm:gap-1.5 rounded-full bg-primary/10 px-2 sm:px-3 py-1.5 text-sm font-medium text-primary-text transition-colors hover:bg-primary-soft';

interface WorldMapScreenProps {
  data: WorldMapData;
  /** 보여 줄 월드. `/world`는 진행 중 월드(progress.current), `/world/[slug]`는 그 월드. null 이면 지도 없음 */
  entry: WorldWithStatus | null;
  /** `?notice=` (B38 잠긴 스테이지 안내) */
  notice?: string | string[];
}

/**
 * 월드 지도 화면 (P5-01, Q50): `/world`와 `/world/[slug]`가 같이 그린다(주소는 그대로).
 * 열린 월드는 머리(그림책 N권 · 이름 · 월드 바꾸기) + 지도 + 다음 권 미리 보기, 잠김·준비 중 월드는 잠긴 책 안내.
 * 상단 HUD 버튼 줄은 P5-07 범위라 그대로 둔다
 */
export function WorldMapScreen({ data, entry, notice }: WorldMapScreenProps) {
  const { profile, badges, showApiKeyAlert, progress } = data;
  const worlds = progress.worlds;
  const index = entry
    ? worlds.findIndex((w) => w.world.slug === entry.world.slug)
    : -1;
  const map = entry && isOpenable(entry) ? entry.world.map : null;
  const no = entry ? bookNo(worlds, entry.world.slug) : 0;

  return (
    <>
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6 lg:max-w-5xl">
        <div className="relative z-10 mb-6 flex items-center justify-end gap-2">
          <Link href="/notice" aria-label="공지사항" className={HUD_LINK}>
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">공지사항</span>
          </Link>
          <Link href="/board" aria-label="게시판" className={HUD_LINK}>
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">게시판</span>
          </Link>
          <Link href="/profile" aria-label="내 프로필" className={HUD_LINK}>
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">내 프로필</span>
          </Link>
          <LogoutButton />
          <SoundToggle />
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

        {entry && map && (
          <>
            <WorldMapHead
              slug={entry.world.slug}
              title={entry.world.title}
              no={no}
              completedStages={entry.completedStageCount}
              totalStages={entry.stages.length}
            />
            <WorldMap
              stages={entry.stages}
              map={map}
              theme={entry.world.theme}
              world={worldTint(entry.world.order)}
              questsByStage={data.questsByStage}
              scrollToCurrent
            />
            <NextBooks worlds={worlds} slug={entry.world.slug} />
          </>
        )}

        {entry && !map && (
          <LockedBook
            entry={entry}
            no={no}
            unlock={unlockText(worlds, index)}
          />
        )}
      </PageTransition>

      {/* 월드 BGM: 기본 꺼짐, 설정에서 켠 경우만 (P2-14). 곡은 그 월드의 map.yaml bgm */}
      {map && <WorldBgm id={map.bgm} />}

      {/* fixed 안내라 transform 이 걸리는 PageTransition 밖에 둔다 */}
      {/* 홈 화면에 추가 쪽지 (P4-11): 다른 안내가 떠 있으면 띄우지 않음 (아래 가운데 자리를 같이 씀) */}
      {isStageLockedNotice(notice) ? <StageLockedNotice /> : <InstallHint />}
    </>
  );
}
