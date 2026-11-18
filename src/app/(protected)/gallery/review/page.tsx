import type { Metadata } from 'next';
import { BackLink } from '@/components/ui/back-link';
import { notFound, redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/supabase/auth';
import { isAdminUser } from '@/lib/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { reportServerError } from '@/lib/api/serverError';
import { publicLook } from '@/lib/avatar/look';
import { FALLBACK_AUTHOR_NAME } from '@/lib/board/display';
import { PageTransition } from '@/components/shared/PageTransition';
import { GalleryCard } from '@/components/gallery/GalleryParts';
import '@/components/profile/profile.css';

export const metadata: Metadata = { title: '갤러리 신고 살펴보기' };

/**
 * 운영자: 신고가 들어온 작품 (P11-07). 최근 신고 300건을 작품별로 묶어 숨김 여부와 함께. 숨기기·다시 보이기는 작품 보기의 운영자 패널.
 * 운영자가 아니면 404
 */
export default async function GalleryReviewPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  if (!isAdminUser(user)) notFound();
  const admin = createAdminClient();
  const { data: reports, error } = await admin
    .from('creation_reports')
    .select('creation_id')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) reportServerError(error, { area: 'gallery', op: 'review' });
  const counts = new Map<string, number>();
  for (const r of reports ?? [])
    counts.set(r.creation_id, (counts.get(r.creation_id) ?? 0) + 1);
  const ids = [...counts.keys()];
  const { data: works } = ids.length
    ? await admin
        .from('creations')
        .select('id, kind, title, hidden_at, visibility, user_id')
        .in('id', ids)
    : { data: [] };
  const { data: profiles } = works?.length
    ? await admin
        .from('user_profiles_public')
        .select('id, display_name, avatar_skin, avatar_look')
        .in(
          'id',
          works.map((w) => w.user_id),
        )
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const list = (works ?? []).sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
  );

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-6xl">
      <div className="pf-top">
        <BackLink href="/gallery">갤러리</BackLink>
      </div>
      <header className="grid gap-1">
        <h1 className="m-0 font-display text-h2">신고 살펴보기</h1>
        <p className="m-0 text-small text-muted-foreground">
          서로 다른 친구 3명이 신고하면 저절로 숨겨져요. 작품을 열어 숨기거나
          다시 보이게 할 수 있어요.
        </p>
      </header>
      {list.length === 0 ? (
        <p className="gl-empty m-0 text-small" data-testid="review-empty">
          신고된 작품이 없어요.
        </p>
      ) : (
        <ul className="gl-wall">
          {list.map((w) => {
            const p = byId.get(w.user_id);
            return (
              <li key={w.id} className="grid gap-1">
                <GalleryCard
                  item={{
                    id: w.id,
                    kind:
                      w.kind === 'conversation' ? 'conversation' : 'drawing',
                    title: w.title,
                    author: {
                      name: p?.display_name ?? FALLBACK_AUTHOR_NAME,
                      look: publicLook(p),
                    },
                    stickers: {},
                  }}
                />
                <span
                  className="gl-chip"
                  data-state={
                    w.hidden_at
                      ? 'hidden'
                      : w.visibility === 'public'
                        ? 'public'
                        : undefined
                  }
                >
                  신고 {counts.get(w.id)} ·{' '}
                  {w.hidden_at
                    ? '숨김'
                    : w.visibility === 'public'
                      ? '공개 중'
                      : '작가가 내림'}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </PageTransition>
  );
}
