import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { WorldWithStatus } from '@/lib/world/getStageStatuses';
import {
  bookNo,
  skillCheckOfferOf,
  toBook,
  unlockText,
} from '@/lib/world/worldBook';

import { WorldBook } from './WorldBook';

/**
 * 지도 아래 "다음 권 미리 보기" (P5-01, 시안 NextBooks): 지금 지도의 월드 뒤 두 권까지.
 * 잠긴 책은 해제 조건, 열린 책은 그 지도로. 뒤 월드가 없으면 그리지 않는다
 */
export function NextBooks({
  worlds,
  slug,
}: {
  worlds: readonly WorldWithStatus[];
  slug: string;
}) {
  const at = worlds.findIndex((w) => w.world.slug === slug);
  const next = worlds.slice(at + 1, at + 3);
  if (at < 0 || next.length === 0) return null;
  return (
    <section className="wb-next relative z-10" aria-labelledby="wb-next-t">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="wb-next-t" className="font-display text-h3 text-foreground">
          다음 권 미리 보기
        </h2>
        <Link
          href="/worlds"
          className="focus-ring inline-flex min-h-touch items-center gap-0.5 rounded-sm text-small font-bold text-primary-text hover:underline"
        >
          책장 전체 보기
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="wb-next-row">
        {next.map((w, i) => (
          <WorldBook
            key={w.world.slug}
            book={toBook(w)}
            no={bookNo(worlds, w.world.slug)}
            unlock={unlockText(worlds, at + 1 + i)}
            skillCheck={skillCheckOfferOf(worlds, at + 1 + i)}
            heading="h3"
          />
        ))}
      </div>
    </section>
  );
}
