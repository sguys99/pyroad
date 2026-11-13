import Link from 'next/link';
import { PartyPopper } from 'lucide-react';
import { PybaemStatic } from '@/components/characters/rig';
import type { ShareViewKind } from '@/lib/analytics/events';
import { ShareCta } from './ShareCta';

/** 서비스 소개 한 줄 (공유 페이지·만료 화면 공용) */
export const SHARE_SERVICE_LINE =
  'pyRoad는 초등학생이 파이뱀 선생님과 퀘스트를 깨며 진짜 파이썬을 배우는 무료 학습 사이트예요.';

/** 로고 줄. 너비는 본문과 같게 (로고 왼쪽 끝 = 본문 왼쪽 끝) */
function ShareHeader({ width }: { width: string }) {
  return (
    <header
      className={`mx-auto flex w-full items-center px-gutter py-4 ${width}`}
    >
      <Link
        href="/"
        className="inline-flex min-h-touch items-center font-display text-h2 text-primary-text"
      >
        pyRoad
      </Link>
    </header>
  );
}

/** 소개 + "나도 해보기" (보호자·친구가 이 링크로 처음 pyRoad 를 만남) */
function ShareInvite({ kind }: { kind: ShareViewKind }) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-card"
      data-surface="raised"
    >
      <div className="flex items-center gap-3">
        <PybaemStatic
          state="wave"
          size={64}
          framing="avatar"
          label=""
          className="shrink-0"
        />
        <p className="text-small text-pretty text-foreground">
          {SHARE_SERVICE_LINE}
        </p>
      </div>
      <ShareCta kind={kind} className="w-full" />
      <p className="text-center text-caption text-muted-foreground">
        로그인 없이 30초 체험부터 해 볼 수 있어요.
      </p>
    </div>
  );
}

/**
 * 공유 페이지 본문 (P9-08). 카드 그림(스냅샷으로 그린 PNG, 대체 글 포함) + 축하 문구 + 소개 + "나도 해보기".
 * 그리는 글자는 모두 카드 스냅샷에서 만든 것(`shareCardSummary`)뿐 — 쿼리 문자열은 읽지 않는다.
 * 360: 위아래로 쌓음 · 1024+: 카드 왼쪽, 글·CTA 오른쪽
 */
export function ShareCardView({
  kind,
  headline,
  alt,
  imageSrc,
}: {
  kind: ShareViewKind;
  headline: string;
  alt: string;
  imageSrc: string;
}) {
  return (
    <div className="min-h-dvh bg-background font-sans">
      <ShareHeader width="max-w-2xl lg:max-w-6xl" />
      <main className="mx-auto grid w-full max-w-2xl gap-6 px-gutter pb-12 lg:max-w-6xl lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-12">
        {/* 동적 PNG(CDN 캐시)라 next/image 최적화를 거치지 않는다. 크기를 적어 자리를 미리 잡음 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={alt}
          width={1200}
          height={630}
          fetchPriority="high"
          className="h-auto w-full rounded-2xl bg-surface shadow-pop"
          data-testid="share-card-image"
        />
        <section aria-labelledby="share-title" className="grid gap-5">
          <div className="grid gap-2">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-kicker font-bold text-accent-text">
              <PartyPopper aria-hidden className="size-4" />
              축하해 주세요!
            </p>
            <h1
              id="share-title"
              className="font-display text-h1 text-balance text-foreground lg:text-hero"
            >
              {headline}
            </h1>
            <p className="text-body text-pretty text-muted-foreground">
              친구가 pyRoad에서 파이썬 모험을 하고 있어요. 박수를 보내 주세요.
            </p>
          </div>
          <ShareInvite kind={kind} />
        </section>
      </main>
    </div>
  );
}

/** 없음·비공개·만료 (404). 아이 정보(닉네임·성과)는 하나도 보이지 않는다 */
export function ShareGoneView() {
  return (
    <div className="min-h-dvh bg-background font-sans">
      <ShareHeader width="max-w-md" />
      <main className="mx-auto grid w-full max-w-md gap-6 px-gutter pb-12 pt-4">
        <section
          aria-labelledby="share-gone-title"
          className="flex flex-col items-center gap-3 text-center"
        >
          <PybaemStatic state="think" size={120} framing="avatar" label="" />
          <h1
            id="share-gone-title"
            className="font-display text-h1 text-balance text-foreground"
          >
            이 카드는 더 이상 볼 수 없어요
          </h1>
          <p className="text-body text-pretty text-muted-foreground">
            카드를 만든 친구가 공유를 멈췄거나, 공유한 지 오래되어 닫혔어요.
          </p>
        </section>
        <ShareInvite kind="gone" />
      </main>
    </div>
  );
}
