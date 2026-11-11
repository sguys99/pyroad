import { Suspense } from 'react';

import { WorldHud } from '@/components/world/WorldHud';
import {
  MissionHudButton,
  MissionHudPlaceholder,
} from '@/components/world/DailyMissions';
import { dailyMissionsRpc } from '@/lib/quest/rewardRpc';
import { createAdminClient } from '@/lib/supabase/admin';
import type { WorldMapData } from '@/lib/world/mapData';
import { currentStreak } from '@/lib/time/streak';
import { shieldSavedYesterday } from '@/lib/world/attendance';
import { AttendanceMenuSection } from '@/components/world/AttendanceCard';

/**
 * HUD 미션 칸 (P8-07): 서버 RPC `daily_missions_today`(service_role, 확인한 사용자 id)로 오늘 미션·진행을 읽고,
 * 그날 첫 방문이면 지금 고른 오늘의 퀴즈와 함께 배정. Suspense 안이라 지도 렌더를 기다리게 하지 않음. 실패(00034 전 DB)면 칸 없음
 */
async function MissionSlot({
  userId,
  quizIds,
}: {
  userId: string;
  quizIds: string[];
}) {
  const r = await dailyMissionsRpc(createAdminClient(), userId, quizIds);
  if (!r.ok || !r.data.assigned) return null;
  return (
    <MissionHudButton
      state={{
        day: r.data.day,
        missions: r.data.missions ?? [],
        pending: r.data.pending ?? [],
      }}
    />
  );
}

/**
 * 서버에서 월드맵 데이터 → HUD 값. 프로필이 없으면 그리지 않음.
 * 스트릭·방패는 서버 `world_daily_status`(P8-08, 학습일·방패로 메운 날, 방패 정산 뒤). 못 읽었으면(00035 전) 예전처럼 완료 시각으로
 */
export function WorldHudBar({ data }: { data: WorldMapData }) {
  const { profile, dailyStatus } = data;
  if (!profile) return null;
  const s = dailyStatus?.streak;
  return (
    <WorldHud
      name={profile.name}
      skin={profile.skin}
      totalXp={profile.total_xp}
      level={profile.current_level}
      coins={profile.coins}
      streak={
        s ? { days: s.days, today: s.today } : currentStreak(data.completedAt)
      }
      shields={s?.shields ?? 0}
      shieldSaved={!!s && shieldSavedYesterday(s, dailyStatus.attendance.today)}
      attendance={
        dailyStatus && (
          <AttendanceMenuSection
            status={dailyStatus.attendance}
            shields={dailyStatus.streak.shields}
          />
        )
      }
      missions={
        <Suspense fallback={<MissionHudPlaceholder />}>
          <MissionSlot
            userId={profile.id}
            quizIds={data.daily.picks.map((p) => p.questId)}
          />
        </Suspense>
      }
    />
  );
}
