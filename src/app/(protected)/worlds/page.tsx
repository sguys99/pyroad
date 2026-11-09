import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageTransition } from '@/components/shared/PageTransition';
import { WorldShelf } from '@/components/world/book/WorldShelf';
import { WorldHudBar } from '@/components/world/WorldHudBar';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

export const metadata: Metadata = { title: '모험 책장' };

/** 월드 고르기 (P5-01, Q50): 월드마다 그림책 표지. 열린 책은 그 지도(`/world/[slug]`)로 */
export default async function WorldsPage() {
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  return (
    <>
      <WorldHudBar data={data} />
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6 lg:max-w-5xl">
        <WorldShelf
          worlds={data.progress.worlds}
          current={data.progress.current?.world.slug ?? null}
        />
      </PageTransition>
    </>
  );
}
