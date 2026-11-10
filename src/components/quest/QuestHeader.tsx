'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
      <Link
        href={worldHref}
        className="flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary-text hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        월드맵
      </Link>
      <span className="hidden text-muted-foreground sm:inline">/</span>
      <span className="hidden truncate text-sm text-muted-foreground sm:inline">
        {stageOrder}단계: {stageTitle}
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
            ? 'sr-only min-w-0 truncate text-sm font-medium text-foreground sm:not-sr-only'
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
