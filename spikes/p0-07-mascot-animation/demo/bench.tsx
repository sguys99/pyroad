// 벤치 페이지: ?c=<후보>&scene=single|busy&warm=1500&dur=6000
// React는 모든 후보에 미리 로드 (앱에는 항상 있으므로). 후보 런타임은 동적 import.
import { createRoot } from 'react-dom/client';
import confetti from 'canvas-confetti';
import type { MountFn, Mounted } from './cand/types';

const q = new URLSearchParams(location.search);
const C = q.get('c') ?? 'rig';
const SCENE = q.get('scene') ?? 'single';
const WARM = Number(q.get('warm') ?? 1500);
const DUR = Number(q.get('dur') ?? 6000);
const marks: Record<string, number> = {};
const mark = (n: string) => (marks[n] ??= performance.now());

const loaders: Record<string, () => Promise<{ mount: MountFn }>> = {
  none: () => import('./cand/none'),
  rig: () => import('./cand/rig'),
  'rig-full': () => import('./cand/rig'),
  'rig-b': () => import('./cand/rig'),
  'rig-lite': () => import('./cand/rig'),
  'rig-minimal': () => import('./cand/rig'),
  'lottie-svg': () => import('./cand/lottie'),
  'lottie-canvas': () => import('./cand/lottie'),
  dotlottie: () => import('./cand/dotlottie'),
  'rive-avatar': () => import('./cand/rive'),
  'rive-birb': () => import('./cand/rive'),
};

// 셸은 React로 (앱과 같은 조건)
const shell = document.getElementById('root')!;
createRoot(document.createElement('div')).render(null);

async function main() {
  mark('start');
  const { mount } = await loaders[C]();
  mark('chunk');
  const sizes = SCENE === 'busy' ? [240, 180, 180] : [240];
  const firsts: Promise<void>[] = [];
  const mounted: Mounted[] = [];
  for (let i = 0; i < sizes.length; i++) {
    const box = document.createElement('div');
    box.className = 'slot';
    shell.appendChild(box);
    let resolve!: () => void;
    firsts.push(new Promise<void>((r) => (resolve = r)));
    mounted.push(
      await mount(box, {
        size: sizes[i],
        index: i,
        variant: C,
        mark: (n) => mark(`${n}${i}`),
        onFirstFrame: () => {
          mark(`first${i}`);
          resolve();
        },
      }),
    );
  }
  await Promise.all(firsts);
  mark('allFirst');
  (window as unknown as { __mounted: Mounted[] }).__mounted = mounted;

  let confettiTimer = 0;
  if (SCENE === 'busy') {
    confettiTimer = window.setInterval(() => {
      confetti({ particleCount: 6, spread: 70, startVelocity: 32, ticks: 150, origin: { x: Math.random(), y: 0.7 }, disableForReducedMotion: false });
    }, 150);
  }
  if (q.get('hold') === '1') return; // 수동 관찰용
  await new Promise((r) => setTimeout(r, WARM));

  const deltas: number[] = [];
  const longtasks: number[] = [];
  const loafs: { d: number; b: number }[] = [];
  let poL: PerformanceObserver | null = null;
  let poA: PerformanceObserver | null = null;
  try {
    poL = new PerformanceObserver((l) => l.getEntries().forEach((e) => longtasks.push(e.duration)));
    poL.observe({ type: 'longtask', buffered: false });
  } catch {}
  try {
    poA = new PerformanceObserver((l) =>
      l.getEntries().forEach((e) => loafs.push({ d: e.duration, b: (e as unknown as { blockingDuration: number }).blockingDuration })),
    );
    poA.observe({ type: 'long-animation-frame', buffered: false });
  } catch {}
  (window as unknown as { __measureStart: number }).__measureStart = performance.now();
  document.title = 'measuring';
  await new Promise<void>((done) => {
    let last = 0;
    const t0 = performance.now();
    const f = (t: number) => {
      if (last) deltas.push(t - last);
      last = t;
      if (t - t0 < DUR) requestAnimationFrame(f);
      else done();
    };
    requestAnimationFrame(f);
  });
  poL?.disconnect();
  poA?.disconnect();
  clearInterval(confettiTimer);
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  (window as unknown as { __result: unknown }).__result = {
    c: C,
    scene: SCENE,
    marks,
    deltas,
    longtasks,
    loafs,
    heap: mem?.usedJSHeapSize ?? null,
    nodes: document.getElementsByTagName('*').length,
  };
  document.title = 'done';
}
main().catch((e) => {
  (window as unknown as { __result: unknown }).__result = { error: String(e?.stack ?? e) };
  document.title = 'done';
});
