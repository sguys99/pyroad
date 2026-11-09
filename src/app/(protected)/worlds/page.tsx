import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PageTransition } from '@/components/shared/PageTransition';
import { KeepWorldBgm, PrefetchBgm } from '@/components/sound/WorldBgm';
import { WorldShelf } from '@/components/world/book/WorldShelf';
import { WorldHudBar } from '@/components/world/WorldHudBar';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

export const metadata: Metadata = { title: '모험 책장' };

/** 월드 고르기 (P5-01, Q50): 월드마다 그림책 표지. 열린 책은 그 지도(`/world/[slug]`)로 */
export default async function WorldsPage() {
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  const current = data.progress.current;
  // 책장에서 열 수 있는 다음 월드(지금 월드 뒤, 열렸거나 다 깬 월드)의 곡도 미리 받아 둔다
  const nextOpen = data.progress.worlds.find(
    (w) =>
      current &&
      w.world.order > current.world.order &&
      (w.status === 'open' || w.status === 'cleared'),
  );
  return (
    <>
      <WorldHudBar data={data} />
      <PageTransition className="mx-auto min-h-screen max-w-2xl px-4 py-6 lg:max-w-5xl">
        <WorldShelf
          worlds={data.progress.worlds}
          current={data.progress.current?.world.slug ?? null}
          fresh={data.unlocks?.silent ? [] : data.unlocks?.stageIds}
        />
      </PageTransition>
      {/* 책장 BGM: 지금 흐르는 월드 곡을 이어 감, 없으면 진행 중 월드 곡 (P5-11, 기본 꺼짐) */}
      <KeepWorldBgm fallback={current?.world.map?.bgm ?? null} />
      <PrefetchBgm
        ids={[
          current?.world.map?.bgm ?? null,
          nextOpen?.world.map?.bgm ?? null,
        ]}
      />
    </>
  );
}
