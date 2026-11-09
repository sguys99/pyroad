import { notFound, redirect } from 'next/navigation';

import { WorldMapScreen } from '@/components/world/WorldMapScreen';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}

/**
 * 월드 한 곳의 지도 (P5-01, Q50). 없는 slug 는 미들웨어가 먼저 404 상태로 돌려보낸다(P5-14, `knownWorldSlug.ts`).
 * 아래 notFound()는 그 뒤에 남는 경우(생성물엔 있는데 진행 데이터에 없는 월드)의 대비 — loading.tsx 스트리밍 때문에
 * 상태 코드는 200 + noindex. 잠김·준비 중 월드는 지도 대신 잠긴 책 안내(서버 판정 —
 * 잠긴 월드에서 스테이지를 눌러 볼 수 없음. 퀘스트 주소로 직접 와도 퀘스트 페이지의 스테이지 가드(B38)가 막는다)
 */
export default async function WorldSlugPage({ params, searchParams }: Props) {
  const [{ slug }, { notice }] = await Promise.all([params, searchParams]);
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  const entry = data.progress.worlds.find((w) => w.world.slug === slug);
  if (!entry) notFound();
  return <WorldMapScreen data={data} entry={entry} notice={notice} />;
}
