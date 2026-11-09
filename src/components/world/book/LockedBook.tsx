import { Library, Map as MapIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { WorldWithStatus } from '@/lib/world/getStageStatuses';
import { STATUS_LABEL, toBook, worldTint } from '@/lib/world/worldBook';

import { WorldCover } from './WorldBook';

/**
 * 잠겼거나 준비 중인 월드의 주소(`/world/[slug]`)로 왔을 때 (P5-01): 지도 대신 잠긴 표지 + 해제 조건 + 돌아갈 곳.
 * 판정은 서버(페이지)가 한다 — 잠긴 월드의 스테이지·퀘스트는 내려보내지 않는다
 */
export function LockedBook({
  entry,
  no,
  unlock,
}: {
  entry: WorldWithStatus;
  no: number;
  unlock: string;
}) {
  const soon = entry.status === 'coming_soon';
  return (
    <Card
      radius="l"
      padding="none"
      className="wb-locked"
      data-world={worldTint(entry.world.order)}
      data-testid="world-locked"
    >
      <div className="wb-book" data-status={entry.status}>
        <WorldCover book={toBook(entry)} no={no} />
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-kicker text-muted-foreground">
          그림책 {no}권 · {STATUS_LABEL[entry.status]}
        </p>
        <h1 className="font-display text-h1 text-foreground">
          {entry.world.title}
        </h1>
        <p className="text-body text-foreground">
          {soon
            ? '이 책은 아직 만들고 있어요. 조금만 기다려 주세요!'
            : '아직 펼칠 수 없는 책이에요.'}
        </p>
        <p className="text-body font-bold text-primary-text">{unlock}</p>
        <div className="mt-1 flex flex-wrap gap-3">
          <Button href="/world" icon={<MapIcon aria-hidden />}>
            지금 모험 지도로
          </Button>
          <Button
            href="/worlds"
            variant="secondary"
            icon={<Library aria-hidden />}
          >
            책장 보기
          </Button>
        </div>
      </div>
    </Card>
  );
}
