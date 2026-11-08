import { describe, expect, it } from 'vitest';
import { createParallax } from '../hero/parallax';

// 히어로 패럴랙스 계산 (P4-01): 부드럽게 따라가고, 멎으면 rAF를 다시 걸지 않는다

function harness() {
  const writes: [number, number, number][] = [];
  let queue: (() => void)[] = [];
  let ids = 0;
  const fx = createParallax({
    write: (x, y, s) => writes.push([x, y, s]),
    raf: (cb) => {
      queue.push(cb);
      return ++ids;
    },
    cancelRaf: () => {
      queue = [];
    },
  });
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const q = queue;
      queue = [];
      q.forEach((cb) => cb());
    }
  };
  return { fx, writes, step, pending: () => queue.length };
}

describe('createParallax', () => {
  it('포인터 목표를 한 프레임에 다 가지 않고 부드럽게 따라간다', () => {
    const h = harness();
    h.fx.pointer(1, -1);
    h.step();
    const [x, y] = h.writes[0];
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(0.2);
    expect(y).toBeLessThan(0);
    h.step(400);
    expect(h.writes.at(-1)).toEqual([1, -1, 0]);
  });

  it('목표에 닿으면 rAF를 멈춘다 (대기 CPU 0)', () => {
    const h = harness();
    h.fx.pointer(0.5, 0.5);
    h.step(400);
    expect(h.pending()).toBe(0);
    const count = h.writes.length;
    h.step(10);
    expect(h.writes.length).toBe(count);
  });

  it('범위 밖 포인터는 -1~1로 자르고, 스크롤은 지연 없이 바로 쓴다', () => {
    const h = harness();
    h.fx.scroll(240);
    h.step();
    expect(h.writes.at(-1)).toEqual([0, 0, 240]);
    h.fx.pointer(5, -9);
    h.step(400);
    expect(h.writes.at(-1)).toEqual([1, -1, 240]);
    h.fx.scroll(-30);
    h.step();
    expect(h.writes.at(-1)?.[2]).toBe(0);
  });

  it('여러 번 불러도 rAF는 하나만 걸린다', () => {
    const h = harness();
    h.fx.pointer(0.2, 0);
    h.fx.pointer(0.3, 0);
    h.fx.scroll(10);
    expect(h.pending()).toBe(1);
  });

  it('destroy 뒤에는 쓰지 않는다', () => {
    const h = harness();
    h.fx.pointer(1, 1);
    h.fx.destroy();
    h.step(5);
    h.fx.pointer(-1, -1);
    h.step(5);
    expect(h.writes).toEqual([]);
  });
});
