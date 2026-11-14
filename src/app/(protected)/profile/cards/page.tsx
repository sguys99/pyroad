import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
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
import { isPolicyLive } from '@/lib/legal/policyGate';
import '@/components/profile/profile.css';

export const metadata: Metadata = { title: '내 자랑 카드' };

/**
 * 내 자랑 카드 (P9-11). 프로필 "내 자랑 카드"에서 들어옴. 본인 카드는 RLS 본인 읽기(00043)로, 바꾸기는 `/api/share-cards/{id}`
 */
export default async function MyShareCardsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  if (!(await isPolicyLive())) notFound(); // 처리방침 시행일부터 (B79)
  const supabase = await createClient();
  const [rows, claimed] = await Promise.all([
    supabase
      .from('share_cards')
      .select('id, kind, version, is_public, expires_at, created_at, snapshot')
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
    }));

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-4xl">
      <div className="pf-top">
        <Link href="/profile" className="pf-back focus-ring">
          <ChevronLeft aria-hidden />
          프로필
        </Link>
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
