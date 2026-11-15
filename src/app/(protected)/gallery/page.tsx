import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { getAuthUser } from '@/lib/supabase/auth';
import { isAdminUser } from '@/lib/admin';
import { listGallery } from '@/lib/gallery/server';
import { PageTransition } from '@/components/shared/PageTransition';
import { Button } from '@/components/ui/button';
import {
  EmptyGallery,
  GalleryBanner,
  GalleryCard,
} from '@/components/gallery/GalleryParts';
import '@/components/profile/profile.css';

export const metadata: Metadata = { title: '작품 갤러리' };

/**
 * 작품 갤러리 (P11-07, §3 F13): 로그인한 학생만(Q74 ③). 공개·안 숨긴 작품을 최신 공개순으로 24개씩, 액자 벽에 건다.
 * 작가는 닉네임·파이뱀만(§2.6). 읽기는 서버가 `gallery_creations`(service_role 전용 뷰)로
 */
export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await getAuthUser();
  if (!user) redirect('/');
  const page = Math.max(
    0,
    Math.min(200, Number((await searchParams).page) || 0),
  );
  const { items, hasMore, failed } = await listGallery(user.id, page);

  return (
    <PageTransition className="mx-auto grid min-h-screen max-w-lg content-start gap-5 px-4 py-4 sm:py-6 md:max-w-6xl">
      <div className="pf-top">
        <Link href="/world" className="pf-back focus-ring">
          <ChevronLeft aria-hidden />
          월드맵
        </Link>
        <span className="flex items-center gap-1">
          {isAdminUser(user) && (
            <Button
              href="/gallery/review"
              size="sm"
              variant="ghost"
              icon={<ShieldAlert aria-hidden />}
            >
              신고 살펴보기
            </Button>
          )}
          <Button href="/profile/creations" size="sm" variant="secondary">
            내 작품함
          </Button>
        </span>
      </div>

      <GalleryBanner />

      {failed ? (
        <div className="gl-empty" role="alert" data-testid="gallery-error">
          <p className="m-0 font-display text-h3">작품을 불러오지 못했어요</p>
          <p className="m-0 text-small text-muted-foreground">
            잠시 뒤에 다시 들어와 줘요.
          </p>
          <Button href={`/gallery?page=${page}`} variant="secondary" size="sm">
            다시 불러오기
          </Button>
        </div>
      ) : items.length === 0 && page === 0 ? (
        <EmptyGallery />
      ) : (
        <section aria-label="전시된 작품">
          <ul className="gl-wall" data-world="3">
            {items.map((item) => (
              <li key={item.id}>
                <GalleryCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(page > 0 || hasMore) && (
        <nav aria-label="쪽 넘기기" className="flex justify-center gap-2">
          {page > 0 && (
            <Button
              href={`/gallery?page=${page - 1}`}
              variant="secondary"
              size="sm"
              icon={<ChevronLeft aria-hidden />}
            >
              앞 작품
            </Button>
          )}
          {hasMore && (
            <Button
              href={`/gallery?page=${page + 1}`}
              variant="secondary"
              size="sm"
              iconRight={<ChevronRight aria-hidden />}
              data-testid="gallery-more"
            >
              작품 더 보기
            </Button>
          )}
        </nav>
      )}
    </PageTransition>
  );
}
