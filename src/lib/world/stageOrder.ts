// 스테이지 순서 (P1-08): (월드 order, 스테이지 order).
// stages."order" 는 월드 안에서만 유일하므로(UNIQUE(world_id, "order")) 여러 월드의 스테이지를 order 만으로 정렬하면 섞입니다.
// SQL 쪽 같은 규칙: supabase/migrations/00012 의 is_stage_unlocked·reset_progress.

/** 정렬에 필요한 최소 정보. world 는 PostgREST 임베딩 `world:worlds(order)` 결과 (없으면 같은 월드로 봄) */
export interface OrderedStage {
  order: number;
  world?: { order: number } | null;
}

export function compareStages(a: OrderedStage, b: OrderedStage): number {
  return (a.world?.order ?? 0) - (b.world?.order ?? 0) || a.order - b.order;
}

/** (월드 order, 스테이지 order) 순서로 정렬한 새 배열 */
export function sortStages<T extends OrderedStage>(stages: readonly T[]): T[] {
  return [...stages].sort(compareStages);
}
