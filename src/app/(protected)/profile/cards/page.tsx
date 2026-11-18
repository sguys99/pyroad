import type { Metadata } from 'next';
import { BackLink } from '@/components/ui/back-link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { reportServerError } from '@/lib/api/serverError';
import { PageTransition } from '@/components/shared/PageTransition';
import { MyShareCards } from '@/components/share/MyShareCards';
import {
  KIND_LABEL,
  myCardDetail,
  type MyShareCard,
} from '@/lib/share-card/myCards';
import { shareCardImagePath } from '@/lib/share-card/publicCard';
import type { ShareCardKind } from '@/lib/share-card/types';
import { kstToday } from '@/lib/time/kst';
import '@/components/profile/profile.css';

export const metadata: Metadata = { title: '내 자랑 카드' };

/**
 * 내 자랑 카드 (P9-11). 프로필 "내 자랑 카드"에서 들어옴. 본인 카드는 RLS 본인 읽기(00043)로, 바꾸기는 `/api/share-cards/{id}`
 */
export default async function MyShareCardsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const supabase = await createClient();
  const [rows, claimed] = await Promise.all([
    supabase
      .from('share_cards')
      .select(
        'id, kind, ref, version, is_public, expires_at, created_at, snapshot',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('coin_ledger')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', 'share')
      .eq('ref', kstToday())
      .maybeSingle(),
  ]);
  if (rows.error)
    reportServerError(rows.error, { area: 'share-card', op: 'my cards' });

  // 작품 카드(P11-08): 작품이 지금 갤러리에 전시 중인지 (본인 작품 — RLS 본인 읽기)
  const workRefs = (rows.data ?? [])
    .filter((r) => r.kind === 'creation')
    .map((r) => r.ref);
  const shown = new Set<string>();
  if (workRefs.length) {
    const { data } = await supabase
      .from('creations')
      .select('id')
      .in('id', workRefs)
      .eq('visibility', 'public')
      .is('hidden_at', null)
      .not('published_at', 'is', null);
    for (const c of data ?? []) shown.add(c.id);
  }

  const cards: MyShareCard[] = (rows.data ?? [])
    .filter((r) => r.kind in KIND_LABEL)
    .map((r) => ({
      id: r.id,
      kind: r.kind as ShareCardKind,
      version: r.version,
      isPublic: r.is_public,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      imageUrl: shareCardImagePath(r.id, r.version),
      detail: myCardDetail(r.kind, r.snapshot),
      ...(r.kind === 'creation' && !shown.has(r.ref) && { workOffShow: true }),
    }));

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-4xl">
      <div className="pf-top">
        <BackLink href="/profile">프로필</BackLink>
      </div>
      <header className="grid gap-1">
        <h1 className="m-0 font-display text-h2">내 자랑 카드</h1>
        <p className="m-0 text-small text-muted-foreground">
          친구에게 보낸 카드를 숨기거나 지울 수 있어요. 숨기면 링크를 열어도
          보이지 않아요.
        </p>
      </header>
      <MyShareCards
        cards={cards}
        rewardClaimed={!!claimed.data}
        now={new Date().toISOString()}
      />
    </PageTransition>
  );
}
