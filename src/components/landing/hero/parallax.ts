/**
 * 히어로 패럴랙스 계산 (P4-01, DOM 없는 순수 로직 → 단위 테스트). `HeroParallax`가 브라우저 이벤트를 넘긴다.
 *
 * - 포인터 목표(-1~1)를 프레임마다 `POINTER_EASE`만큼 따라간다 → 마우스를 멈추면 부드럽게 멎는다
 * - 스크롤은 지연 없이 바로 (페이지와 어긋나 보이지 않게)
 * - 할 일이 없으면 rAF를 다시 걸지 않는다 (대기 CPU 0). 같은 값은 다시 쓰지 않는다
 */
export const POINTER_EASE = 0.085;
const EPS = 0.0005;

export interface ParallaxDeps {
  write: (x: number, y: number, scroll: number) => void;
  raf: (cb: () => void) => number;
  cancelRaf: (id: number) => void;
}

export interface Parallax {
  /** 포인터 목표 (-1~1, 화면 가운데 0). 범위 밖은 자른다 */
  pointer(x: number, y: number): void;
  /** 스크롤 위치 (px, 히어로 높이 안으로 자른 값) */
  scroll(px: number): void;
  destroy(): void;
}

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

export function createParallax({
  write,
  raf,
  cancelRaf,
}: ParallaxDeps): Parallax {
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let s = 0;
  let written: [number, number, number] | null = null;
  let id = 0;
  let dead = false;

  const frame = () => {
    id = 0;
    if (dead) return;
    x += (tx - x) * POINTER_EASE;
    y += (ty - y) * POINTER_EASE;
    if (Math.abs(tx - x) < EPS) x = tx;
    if (Math.abs(ty - y) < EPS) y = ty;
    if (!written || written[0] !== x || written[1] !== y || written[2] !== s) {
      write(x, y, s);
      written = [x, y, s];
    }
    if (x !== tx || y !== ty) id = raf(frame);
  };
  const kick = () => {
    if (!id && !dead) id = raf(frame);
  };

  return {
    pointer(nx, ny) {
      tx = clamp(nx);
      ty = clamp(ny);
      kick();
    },
    scroll(px) {
      s = Math.max(0, px);
      kick();
    },
    destroy() {
      dead = true;
      if (id) cancelRaf(id);
      id = 0;
    },
  };
}
