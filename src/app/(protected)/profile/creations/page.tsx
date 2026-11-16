import type { Metadata } from 'next';
import { BackLink } from '@/components/ui/back-link';
import { redirect } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
 * 내 작품함 (P11-06·P11-07). 프로필 "내 작품함"에서 들어옴. 작품을 누르면 작품 보기(올리기·내리기). 본인 작품은 RLS 본인 읽기(00054)로, 지우기는 `/api/creations/{id}`
 */
export default async function MyCreationsPage() {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('creations')
    .select('id, kind, title, visibility, hidden_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) reportServerError(error, { area: 'creations', op: 'my list' });

  const creations: MyCreation[] = (data ?? []).map((r) => ({
    id: r.id,
    kind: r.kind === 'conversation' ? 'conversation' : 'drawing',
    title: r.title,
    isPublic: r.visibility === 'public',
    hidden: !!r.hidden_at,
    createdAt: r.created_at,
  }));

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-4 px-4 py-4 sm:py-6 md:max-w-4xl">
      <div className="pf-top">
        <BackLink href="/profile">프로필</BackLink>
        <Button
          href="/gallery"
          size="sm"
          variant="secondary"
          icon={<Sparkles aria-hidden />}
          data-testid="my-creations-gallery"
        >
          작품 갤러리
        </Button>
      </div>
      <header className="grid gap-1">
        <h1 className="m-0 font-display text-h2">내 작품함</h1>
        <p className="m-0 text-small text-muted-foreground">
          내가 저장한 그림과 대화예요. 갤러리에 올린 작품만 친구들이 볼 수
          있어요. ({creations.length}/{CREATIONS_PER_USER})
        </p>
      </header>
      <MyCreations creations={creations} />
    </PageTransition>
  );
}
