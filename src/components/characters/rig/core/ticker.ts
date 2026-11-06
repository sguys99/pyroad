/**
 * 공유 ticker: 화면의 모든 리그 인스턴스가 requestAnimationFrame 하나를 함께 쓴다 (P0-07 §4.5).
 * - 할 일이 없는 엔진은 목록에서 빠지고, 목록이 비면 rAF도 멈춘다 (대기 CPU 0)
 * - 다음 일(예: 느린 눈 깜빡임)이 정해진 엔진은 `wakeAfter`로 타이머를 걸고 잠든다
 * - 숨긴 탭에서는 브라우저가 rAF를 멈추고, 엔진은 visibilitychange로 스스로도 멈춘다
 * - rAF가 없는 환경(서버·Node 테스트)에서는 아무것도 하지 않는다. 테스트는 `engine.advance()`로 시간을 직접 넘긴다
 */
export interface Tickable {
  /** now = rAF 타임스탬프(ms). false를 돌려주면 목록에서 뺀다 */
  tick(now: number): boolean;
}

const active = new Set<Tickable>();
let rafId = 0;

const hasRaf = () =>
  typeof window !== 'undefined' &&
  typeof window.requestAnimationFrame === 'function';

function loop(now: number) {
  for (const e of active) {
    if (!e.tick(now)) active.delete(e);
  }
  rafId = active.size ? window.requestAnimationFrame(loop) : 0;
}

export function schedule(e: Tickable): void {
  if (!hasRaf()) return;
  active.add(e);
  if (!rafId) rafId = window.requestAnimationFrame(loop);
}

export function unschedule(e: Tickable): void {
  active.delete(e);
}

/** ms 뒤에 다시 목록에 넣는다. 돌려준 함수로 취소 */
export function wakeAfter(e: Tickable, ms: number): () => void {
  if (!hasRaf()) return () => {};
  const id = window.setTimeout(() => schedule(e), Math.max(0, ms));
  return () => window.clearTimeout(id);
}

/** 지금 프레임을 받는 엔진 수 (리뷰 페이지·성능 문서용) */
export function activeCount(): number {
  return active.size;
}
