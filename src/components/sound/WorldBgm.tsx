'use client';

import { useBgm } from '@/components/providers/SoundProvider';
import type { BgmId } from '@/lib/sound/manifest';

/**
 * 이 화면이 떠 있는 동안 월드 BGM을 원한다고 선언한다 (P2-14). BGM은 기본 꺼짐이라 설정에서 켠 아이에게만 들린다.
 * 지금 콘텐츠는 1월드뿐이라 월드맵·퀘스트 모두 `world1`. 월드별 연결은 P5-11(`useBgm(world.bgm)`)에서.
 */
export function WorldBgm({ id }: { id: BgmId }) {
  useBgm(id);
  return null;
}
