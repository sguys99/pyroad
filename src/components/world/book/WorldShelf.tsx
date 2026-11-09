import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import type { WorldWithStatus } from '@/lib/world/getStageStatuses';
import { toBook, unlockText } from '@/lib/world/worldBook';

import { WorldBook } from './WorldBook';

/**
 * 모험 책장 (P5-01): 월드마다 그림책 한 권. 열린 책(모험 중·다 읽음)은 진행률과 함께 눌러 지도로,
 * 잠긴 책·준비 중인 책은 흐린 표지 + 해제 조건("파이썬 섬을 다 모험하면 열려요")
 */
export function WorldShelf({
  worlds,
  current,
  fresh = [],
}: {
  worlds: readonly WorldWithStatus[];
  /** 지금 모험 중인 월드 slug (책갈피) */
  current: string | null;
  /** 새로 열렸는데 아직 연출을 못 본 스테이지 id (P5-05). 월드의 첫 스테이지가 있으면 "새로 열렸어요!" */
  fresh?: readonly string[];
}) {
  return (
    <>
      <Link
        href="/world"
        className="focus-ring mb-4 inline-flex min-h-touch items-center gap-1 rounded-sm text-small font-bold text-primary-text hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        모험 지도로
      </Link>
      <header className="mb-6">
        <p className="text-kicker text-muted-foreground">모험 책장</p>
        <h1 className="font-display text-h1 text-foreground">
          어떤 책을 펼쳐 볼까요?
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          한 권을 다 모험하면 다음 책이 열려요.
        </p>
      </header>
      <ol className="wb-shelf" aria-label="월드 책">
        {worlds.map((w, i) => (
          <li key={w.world.slug}>
            <WorldBook
              book={toBook(w)}
              no={i + 1}
              unlock={unlockText(worlds, i)}
              current={w.world.slug === current}
              fresh={
                w.status === 'open' &&
                !!w.stages[0] &&
                fresh.includes(w.stages[0].id)
              }
            />
          </li>
        ))}
      </ol>
    </>
  );
}
