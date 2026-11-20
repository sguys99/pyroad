import {
  Flag,
  Heart,
  Laugh,
  Lightbulb,
  MessagesSquare,
  Palette,
  PartyPopper,
  Sticker,
  ThumbsUp,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardButton } from '@/components/ui/card';
import { UserAvatar } from '@/components/profile/UserAvatar';
import type { AvatarLook } from '@/lib/avatar/look';
import {
  STICKERS,
  totalStickers,
  type StickerCounts,
  type StickerId,
} from '@/lib/gallery/stickers';
import './gallery.css';

/**
 * 작품 갤러리 (P11-07) 그림 조각: 박람회 배너 · 액자 카드 · 스티커 얼굴 · 빈 전시장. 서버·클라이언트 공용(상태 없음)
 */

const STICKER_ICON: Record<StickerId, LucideIcon> = {
  wow: PartyPopper,
  love: Heart,
  fun: Laugh,
  smart: Lightbulb,
  cheer: ThumbsUp,
};

export function StickerFace({
  sticker,
  className,
}: {
  sticker: StickerId;
  className?: string;
}) {
  const Icon = STICKER_ICON[sticker];
  return (
    <span
      className={`gl-sticker-face ${className ?? ''}`}
      data-sticker={sticker}
      aria-hidden
    >
      <Icon strokeWidth={2.5} />
    </span>
  );
}

/** 붙은 스티커 요약: 많이 붙은 3종 동그라미 + 합계 (낭독은 "스티커 n개") */
export function StickerTally({ counts }: { counts: StickerCounts }) {
  const total = totalStickers(counts);
  const top = STICKERS.filter((s) => counts[s])
    .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))
    .slice(0, 3);
  return (
    <span className="gl-tally" data-testid="gallery-tally">
      {total > 0 ? (
        <>
          <span className="gl-tally-dots">
            {top.map((s) => (
              <StickerFace key={s} sticker={s} />
            ))}
          </span>
          <span>
            <span className="sr-only">스티커 </span>
            {total}
            <span className="sr-only">개</span>
          </span>
        </>
      ) : (
        <>
          <Sticker className="size-4" aria-hidden />
          <span>응원 기다리는 중</span>
        </>
      )}
    </span>
  );
}

export function GalleryBanner({ children }: { children?: React.ReactNode }) {
  return (
    <header className="gl-banner" data-world="3">
      <span className="gl-bunting" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
      <h1 className="m-0 font-display text-h1">작품 갤러리</h1>
      <p className="m-0 text-small text-muted-foreground">
        메이커 시티 친구들이 만든 그림과 이야기를 구경하고, 스티커로 응원해요.
      </p>
      <ul className="gl-rules">
        <li>
          <Sticker aria-hidden />
          응원은 스티커로만
        </li>
        <li>
          <Palette aria-hidden />
          남의 코드는 실행하지 않고 다시 그려요
        </li>
        <li>
          <Flag aria-hidden />
          이상하면 신고해요
        </li>
      </ul>
      {children}
    </header>
  );
}

export interface GalleryCardItem {
  id: string;
  kind: 'drawing' | 'conversation';
  title: string;
  author: { name: string; look: AvatarLook };
  stickers: StickerCounts;
  isMine?: boolean;
  /** 대화 작품 표지 (앞 세 줄) */
  preview?: { text: string; answer?: boolean }[];
}

/** 벽에 건 액자 하나 → 작품 보기 */
export function GalleryCard({
  item,
  thumbnailUrl = (id) => `/api/creations/${id}/thumbnail`,
}: {
  item: GalleryCardItem;
  thumbnailUrl?: (id: string) => string | null;
}) {
  const src = item.kind === 'drawing' ? thumbnailUrl(item.id) : null;
  return (
    <CardButton
      href={`/gallery/${item.id}`}
      radius="m"
      padding="none"
      className="gl-card"
      data-testid="gallery-card"
      aria-label={`${item.title}, ${item.author.name} 작품${item.isMine ? ' (내 작품)' : ''}`}
    >
      <span className="gl-frame">
        <span className="gl-paper">
          {src ? (
            // 로그인 전용 동적 PNG 라 next/image 최적화를 거치지 않는다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              width={400}
              height={400}
              loading="lazy"
              decoding="async"
            />
          ) : item.kind === 'conversation' && item.preview?.length ? (
            <span className="gl-talk" aria-hidden>
              {item.preview.map((row, i) => (
                <span key={i} data-answer={row.answer || undefined}>
                  {row.text || ' '}
                </span>
              ))}
            </span>
          ) : item.kind === 'conversation' ? (
            <MessagesSquare className="gl-paper-icon" aria-hidden />
          ) : (
            <Palette className="gl-paper-icon" aria-hidden />
          )}
        </span>
      </span>
      <span className="gl-label">
        <span className="gl-title font-display">{item.title}</span>
        <span className="gl-by">
          <UserAvatar {...item.author.look} size={24} />
          <span>{item.author.name}</span>
          {item.isMine && <span className="gl-mine">내 작품</span>}
        </span>
        <StickerTally counts={item.stickers} />
      </span>
    </CardButton>
  );
}

export function EmptyGallery() {
  return (
    <div className="gl-empty" data-testid="gallery-empty">
      <span className="gl-empty-easel" aria-hidden>
        <Palette />
      </span>
      <p className="m-0 font-display text-h3">아직 걸린 작품이 없어요</p>
      <p className="m-0 max-w-sm text-small text-muted-foreground">
        메이커 시티 프로젝트를 끝내고 만든 작품을 첫 번째로 걸어 볼까요?
        작품함에서 &ldquo;갤러리에 올리기&rdquo;를 누르면 돼요.
      </p>
      <Button href="/profile/creations" variant="secondary" size="sm">
        내 작품함 가기
      </Button>
    </div>
  );
}
