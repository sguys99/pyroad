import { redirect } from 'next/navigation';

import { WorldMapScreen } from '@/components/world/WorldMapScreen';
import { loadWorldMapData } from '@/lib/world/loadWorldMapData';

interface Props {
  // notice=stage-locked: 잠긴 스테이지의 퀘스트를 URL 로 열어 돌아옴 (B38, 퀘스트 페이지 가드).
  // stage=<id>(열린 차례 시트, P5-06)는 WorldMap 이 브라우저에서만 읽는다
  searchParams: Promise<{ notice?: string | string[] }>;
}

/**
 * `/world` = 진행 중 월드 지도 (Q50). 리다이렉트하지 않고 같은 화면을 그려 주소를 지킨다
 * (기존 링크·PWA start_url·로그인 기본 이동). 각 월드는 `/world/[slug]`, 월드 고르기는 `/worlds` (P5-01)
 */
export default async function WorldPage({ searchParams }: Props) {
  const { notice } = await searchParams;
  const data = await loadWorldMapData();
  if (!data) redirect('/');
  return (
    <WorldMapScreen data={data} entry={data.progress.current} notice={notice} />
  );
}
