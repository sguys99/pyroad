'use client';

import { useState } from 'react';
import { useBgm, useSoundEngine } from '@/components/providers/SoundProvider';
import type { BgmId } from '@/lib/sound/manifest';

/**
 * 이 화면이 떠 있는 동안 월드 BGM을 원한다고 선언한다 (P2-14 → P5-11). BGM은 기본 꺼짐이라 설정에서 켠 아이에게만 들린다.
 * 월드 지도는 그 월드 `map.bgm`, 퀘스트 헤더는 퀘스트가 속한 월드 곡. 다른 곡이면 800ms 크로스페이드, 같은 곡이면 이어서.
 */
export function WorldBgm({ id }: { id: BgmId | null }) {
  useBgm(id);
  return null;
}

/**
 * 책장(`/worlds`): 지금 흐르는 곡을 그대로 이어 간다(지도 ↔ 책장을 오갈 때 곡이 바뀌지 않게).
 * 아무 곡도 없을 때(책장으로 바로 들어옴)만 `fallback`(진행 중 월드 곡).
 */
export function KeepWorldBgm({ fallback }: { fallback: BgmId | null }) {
  const engine = useSoundEngine();
  // 마운트 때 한 번: 앞 화면이 원하던 곡은 useBgm 이 120ms 미뤄서 놓으므로 아직 남아 있다
  const [id] = useState(
    () => (engine.getSnapshot().desiredBgm as BgmId | null) ?? fallback,
  );
  useBgm(id);
  return null;
}
