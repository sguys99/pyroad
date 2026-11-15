import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/auth';
import { reportServerError } from '@/lib/api/serverError';
import { PageTransition } from '@/components/shared/PageTransition';
import {
  MyCreations,
  type MyCreation,
} from '@/components/creations/MyCreations';
import { CREATIONS_PER_USER } from '@/lib/creations/limits';
import '@/components/profile/profile.css';

export const metadata: Metadata = { title: '내 작품함' };

/**
 * 내 작품함 (P11-06). 프로필 "내 작품함"에서 들어옴. 본인 작품은 RLS 본인 읽기(00054)로, 지우기는 `/api/creations/{id}`
 */
export default async function MyCreationsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creations')
    .select('id, kind, title, visibility, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) reportServerError(error, { area: 'creations', op: 'my list' });

  const creations: MyCreation[] = (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind === 'conversation' ? 'conversation' : 'drawing',
    title: r.title,
    isPublic: r.visibility === 'public',
    createdAt: r.created_at,
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
        <h1 className="m-0 font-display text-h2">내 작품함</h1>
        <p className="m-0 text-small text-muted-foreground">
          내가 저장한 그림과 대화예요. 나만 볼 수 있어요. ({creations.length}/
          {CREATIONS_PER_USER})
        </p>
      </header>
      <MyCreations creations={creations} />
    </PageTransition>
  );
}
