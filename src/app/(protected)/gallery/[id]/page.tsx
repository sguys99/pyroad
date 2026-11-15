import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  MessagesSquare,
  Palette,
} from 'lucide-react';
import { getAuthUser } from '@/lib/supabase/auth';
import { isAdminUser } from '@/lib/admin';
import { isUuid } from '@/lib/api/serverError';
import { formatKstDate } from '@/lib/time/kst';
import { loadWork, myStickers, reportCounts } from '@/lib/gallery/server';
import { PageTransition } from '@/components/shared/PageTransition';
import { UserAvatar } from '@/components/profile/UserAvatar';
import { ReportButton } from '@/components/board/ReportButton';
import {
  ConversationReplay,
  DrawingReplay,
} from '@/components/gallery/WorkReplay';
import { StickerBoard } from '@/components/gallery/StickerBoard';
import { OwnerPanel } from '@/components/gallery/OwnerPanel';
import { ModerationPanel } from '@/components/gallery/ModerationPanel';
import '@/components/gallery/gallery.css';
import '@/components/profile/profile.css';
// 코드 보기·대화 줄은 코드 글꼴 (퀘스트 레이아웃 밖이라 여기서 싣는다)
import '@/fonts/pyroad-mono/pyroad-mono.css';

export const metadata: Metadata = { title: '작품 보기' };

/**
 * 작품 보기 (P11-07): 그림은 저장된 명령을 다시 그리고(남의 코드는 실행하지 않음), 대화는 기록을 채팅처럼 재생(Q74 ④).
 * 이름표(제목·닉네임·파이뱀) + 스티커 판 + 코드 보기(작가가 켠 것만) + 신고. 내 작품이면 작가 패널(올리기·내리기),
 * 운영자면 숨김 패널. 볼 수 없는 작품은 404
 */
export default async function GalleryWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const work = await loadWork(id, user);
  if (!work) notFound();
  const admin = isAdminUser(user);
  const [mine, reports] = await Promise.all([
    work.mode === 'public' ? myStickers(id, user.id) : Promise.resolve([]),
    admin ? reportCounts(id) : Promise.resolve({}),
  ]);
  const thumb =
    work.kind === 'drawing' ? `/api/creations/${id}/thumbnail` : null;
  const shown = work.visibility === 'public' && !work.hiddenAt;

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-3xl lg:max-w-6xl">
      <div className="pf-top">
        <Link
          href={work.isMine ? '/profile/creations' : '/gallery'}
          className="pf-back focus-ring"
        >
          <ChevronLeft aria-hidden />
          {work.isMine ? '내 작품함' : '갤러리'}
        </Link>
        {work.isMine && shown && (
          <Link href="/gallery" className="pf-back focus-ring">
            갤러리 가기
            <ChevronRight aria-hidden />
          </Link>
        )}
      </div>

      <div className="gl-detail" data-world="3">
        {work.kind === 'drawing' ? (
          <DrawingReplay id={id} title={work.title} poster={thumb} />
        ) : (
          <ConversationReplay rows={work.transcript} />
        )}

        <div className="grid gap-4">
          <article className="gl-plaque" data-testid="gallery-plaque">
            <header className="gl-plaque-head">
              <span className="gl-kicker">
                {work.kind === 'drawing' ? (
                  <Palette aria-hidden />
                ) : (
                  <MessagesSquare aria-hidden />
                )}
                {work.kind === 'drawing' ? '거북이 그림' : '대화 작품'}
              </span>
              <h1 className="gl-plaque-title font-display">{work.title}</h1>
              <div className="gl-artist">
                <UserAvatar {...work.author.look} size={44} />
                <span className="gl-artist-name">
                  <strong>{work.author.name}</strong>
                  <span>
                    {formatKstDate(work.publishedAt, 'monthDay')}
                    {shown ? ' 전시' : ' 저장'}
                  </span>
                </span>
              </div>
            </header>

            <div className="grid gap-2">
              <p className="gl-section-k">
                {work.isMine ? '친구들이 붙여 준 스티커' : '스티커로 응원하기'}
              </p>
              <StickerBoard
                id={id}
                counts={work.stickers}
                mine={mine}
                readOnly={work.mode !== 'public'}
              />
            </div>

            {work.code && (
              <details className="gl-code" data-testid="gallery-code">
                <summary>
                  <ChevronRight aria-hidden />
                  <Code2 className="size-5" aria-hidden />
                  코드 보기
                </summary>
                {work.isMine && !work.showCode && (
                  <p className="gl-hint">지금은 나만 볼 수 있는 코드예요.</p>
                )}
                <pre className="font-mono">
                  <code>{work.code}</code>
                </pre>
              </details>
            )}

            {work.mode === 'public' && (
              <div className="flex justify-end">
                <ReportButton
                  targetType="creation"
                  targetId={id}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-caption text-muted-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                />
              </div>
            )}
          </article>

          {work.isMine && (
            <OwnerPanel
              work={{
                id,
                kind: work.kind,
                title: work.title,
                code: work.code,
                transcript: work.transcript,
                visibility: work.visibility,
                hiddenAt: work.hiddenAt,
                showCode: work.showCode,
                eligible: work.eligible,
                author: work.author,
              }}
              thumbnailUrl={thumb}
            />
          )}
          {admin && !work.isMine && work.visibility === 'public' && (
            <ModerationPanel
              id={id}
              hidden={!!work.hiddenAt}
              reports={reports}
            />
          )}
        </div>
      </div>
    </PageTransition>
  );
}
