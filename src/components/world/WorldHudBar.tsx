import { WorldHud } from '@/components/world/WorldHud';
import type { WorldMapData } from '@/lib/world/mapData';
import { currentStreak } from '@/lib/time/streak';

/** 서버에서 월드맵 데이터 → HUD 값 (스트릭은 요청 시각의 KST 오늘 기준). 프로필이 없으면 그리지 않음 */
export function WorldHudBar({ data }: { data: WorldMapData }) {
  const { profile } = data;
  if (!profile) return null;
  return (
    <WorldHud
      name={profile.name}
      skin={profile.skin}
      totalXp={profile.total_xp}
      level={profile.current_level}
      streak={currentStreak(data.completedAt)}
    />
  );
}
