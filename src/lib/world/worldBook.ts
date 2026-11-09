// 월드 = 그림책 한 권 (P5-01, Q2·Q48). 월드 선택 책장·지도 머리·잠긴 월드 안내가 같이 쓰는 문구 (순수 함수)
import { withObjectParticle } from '@/lib/korean';
import type { WorldId } from '@/lib/design/tokens';

import type { WorldStatus, WorldWithStatus } from './getStageStatuses';

/** 월드 주소. slug 를 모르면(옛 데이터) 진행 중 월드 지도 `/world` */
export const worldPath = (slug?: string | null) =>
  slug ? `/world/${slug}` : '/world';

/** 그림책 N권: 월드 순서(order 순 목록의 자리)대로 1부터 */
export function bookNo(worlds: readonly WorldWithStatus[], slug: string) {
  return worlds.findIndex((w) => w.world.slug === slug) + 1;
}

/** 틴트·표지 그림 번호(data-world 1·2·3). 테마를 모르면(테스트 월드 등) undefined → 월드 1 틴트 */
export function worldTint(order: number): WorldId | undefined {
  return order === 1 || order === 2 || order === 3 ? order : undefined;
}

/**
 * 해제 조건의 앞 월드: order 상 바로 앞 월드가 "준비 중"(스테이지 없음)이면 건너뛰고 그 앞의 진짜 월드.
 * (`unlock.previousWorld`는 바로 앞 월드라 준비 중 월드를 가리킬 수 있음 — 스테이지 잠금 순서도 준비 중 월드를 건너뜀)
 */
export function unlockAfter(
  worlds: readonly WorldWithStatus[],
  index: number,
): WorldWithStatus | null {
  for (let i = index - 1; i >= 0; i--) {
    if (worlds[i].status !== 'coming_soon') return worlds[i];
  }
  return null;
}

/** 잠긴·준비 중 월드의 해제 조건 한 줄 ("파이썬 섬을 다 모험하면 열려요") */
export function unlockText(
  worlds: readonly WorldWithStatus[],
  index: number,
): string {
  const prev = unlockAfter(worlds, index);
  return prev
    ? `${withObjectParticle(prev.world.title)} 다 모험하면 열려요`
    : '앞 월드를 다 모험하면 열려요';
}

/** 표지 띠 글자 */
export const STATUS_LABEL: Record<WorldStatus, string> = {
  open: '모험 중',
  cleared: '다 읽었어요',
  locked: '잠겨 있어요',
  coming_soon: '준비 중',
};

/** 펼칠 수 있는(지도가 있는) 월드 */
export const isOpenable = (w: { status: WorldStatus }) =>
  w.status === 'open' || w.status === 'cleared';

/** 책 표지·카드에 넘기는 값만 (클라이언트로 스테이지·퀘스트 목록을 보내지 않게) */
export interface BookSummary {
  slug: string;
  title: string;
  order: number;
  status: WorldStatus;
  completedStages: number;
  totalStages: number;
  completedQuests: number;
  totalQuests: number;
}

export function toBook(w: WorldWithStatus): BookSummary {
  return {
    slug: w.world.slug,
    title: w.world.title,
    order: w.world.order,
    status: w.status,
    completedStages: w.completedStageCount,
    totalStages: w.stages.length,
    completedQuests: w.completedQuestCount,
    totalQuests: w.totalQuestCount,
  };
}
