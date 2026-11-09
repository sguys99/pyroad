import { WorldMap } from '@/components/world/WorldMap';
import { WorldHudBar } from '@/components/world/WorldHudBar';
import { ApiKeyAlert } from '@/components/world/ApiKeyAlert';
import { PageTransition } from '@/components/shared/PageTransition';
import { StageLockedNotice } from '@/components/world/StageLockedNotice';
import { InstallHint } from '@/components/pwa/InstallHint';
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
 * 위에는 따라오는 HUD(P5-07, `WorldHudBar`). 지도 머리 오른쪽은 이어하기 CTA(P5-10) 자리
 */
export function WorldMapScreen({ data, entry, notice }: WorldMapScreenProps) {
  const { showApiKeyAlert, progress } = data;
  const worlds = progress.worlds;
  const index = entry
    ? worlds.findIndex((w) => w.world.slug === entry.world.slug)
    : -1;
  const map = entry && isOpenable(entry) ? entry.world.map : null;
  const no = entry ? bookNo(worlds, entry.world.slug) : 0;

  return (
    <>
      {/* 위에 붙어 따라오는 바라 transform 이 걸리는 PageTransition 밖에 둔다 */}
      <WorldHudBar data={data} />
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6 lg:max-w-5xl">
        {showApiKeyAlert && (
          <div className="relative z-10">
            <ApiKeyAlert />
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
