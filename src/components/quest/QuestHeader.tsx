'use client';

import { BackLink } from '@/components/ui/back-link';
import { SoundToggle } from '@/components/sound/SoundToggle';
import { WorldBgm } from '@/components/sound/WorldBgm';
import type { BgmId } from '@/lib/sound/manifest';
import type { StageDot } from '@/lib/quest/stageProgress';
import { StageProgress } from './StageProgress';

interface QuestHeaderProps {
  /** 돌아갈 월드 지도 (`worldPath`, P5-01) */
  worldHref: string;
  /** 이 퀘스트가 속한 월드의 BGM (P5-11). 모르면 null(선언 안 함) */
  bgm: BgmId | null;
  stageTitle: string;
  stageOrder: number;
  questTitle: string;
  /** 스테이지 진행 점 (P6-02). 비었으면 그리지 않음 */
  dots?: StageDot[];
}

export function QuestHeader({
  worldHref,
  bgm,
  stageTitle,
  stageOrder,
  questTitle,
  dots = [],
}: QuestHeaderProps) {
  // 진행 점이 있으면 좁은 화면에서는 퀘스트 제목 대신 점을 보인다 (제목은 이야기 쪽 h1에 있음)
  const hasDots = dots.length > 1;
  return (
    <header className="flex min-w-0 items-center gap-2 border-b border-border bg-background px-4 py-2 sm:gap-3">
      {/* 소프트 내비게이션 (B22). 완료 후 새 진행은 useQuestSession이 router.refresh()로 받아 둠 */}
      {/* 화살표·굵기·색·터치 영역은 다른 화면의 뒤로 가기와 같게(B122). 글자 크기만 빵부스러기 줄에 맞춤 */}
      <BackLink href={worldHref} className="shrink-0 text-sm">
        월드맵
      </BackLink>
      <span className="hidden text-muted-foreground sm:inline">/</span>
      {/* 태블릿은 진행 점과 퀘스트 제목에 자리를 주려고 "N단계"만 — 스테이지 이름은 바로 아래 눈썹 글자에 있음 (B122) */}
      <span className="hidden shrink-0 truncate text-sm text-muted-foreground sm:inline lg:min-w-0 lg:shrink">
        {stageOrder}단계<span className="max-lg:hidden">: {stageTitle}</span>
      </span>
      <span
        className={
          hasDots
            ? 'hidden text-muted-foreground sm:inline'
            : 'text-muted-foreground'
        }
      >
        /
      </span>
      <span
        className={
          hasDots
            ? 'min-w-0 truncate text-sm font-medium text-foreground max-sm:sr-only'
            : 'min-w-0 truncate text-sm font-medium text-foreground'
        }
      >
        {questTitle}
      </span>
      <div className="ml-auto flex min-w-0 items-center">
        <StageProgress dots={dots} />
      </div>
      {/* HUD 음소거 토글 + 그 월드 BGM(기본 꺼짐, P5-11). 월드맵·다른 퀘스트로 옮겨도 같은 곡이면 끊기지 않음 */}
      <SoundToggle />
      <WorldBgm id={bgm} />
    </header>
  );
}
