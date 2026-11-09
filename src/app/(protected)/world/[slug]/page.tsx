import { notFound, redirect } from 'next/navigation';

import { WorldMapScreen } from '@/components/world/WorldMapScreen';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
}

/**
 * 월드 한 곳의 지도 (P5-01, Q50). 없는 slug 는 404 화면(로그인 화면은 loading.tsx 로 스트리밍을 먼저 시작해서
 * 상태 코드는 퀘스트 페이지의 없는 퀘스트처럼 200 + noindex), 잠김·준비 중 월드는 지도 대신 잠긴 책 안내(서버 판정 —
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
