// 리그 기록(rig-frames.json) → Lottie JSON 굽기 + dotLottie 상태머신 JSON
// 같은 파이뱀, 같은 움직임을 Lottie 런타임으로 재생해 런타임 비용을 공정하게 비교하기 위함.
// 실행: node bench/run-ts.mjs bench/gen-lottie.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { eyeNums, browNums, mouthNums, tailPts } from '../src/rig/geometry';
import { PALETTE_A } from '../src/rig/RigSvg';
import type { Params } from '../src/rig/params';

const DIR = new URL('../assets/generated/', import.meta.url).pathname;
const rec = JSON.parse(readFileSync(DIR + 'rig-frames.json', 'utf8')) as {
  fps: number;
  segments: { name: string; frames: Params[] }[];
};
const ONLY = process.env.SEG;
if (ONLY) rec.segments = rec.segments.filter((s) => s.name === ONLY);
const SUFFIX = ONLY ? `-${ONLY}-only` : '';
const fps = rec.fps;
const frames: Params[] = [];
const markers: { tm: number; cm: string; dr: number }[] = [];
for (const seg of rec.segments) {
  markers.push({ tm: frames.length, cm: seg.name, dr: seg.frames.length - 1 });
  frames.push(...seg.frames);
}
const N = frames.length;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).concat(1);
const C = {
  body: hex(PALETTE_A.body),
  dark: hex(PALETTE_A.bodyDark),
  belly: hex(PALETTE_A.belly),
  ink: hex(PALETTE_A.ink),
  cheek: hex(PALETTE_A.cheek),
  tongue: hex(PALETTE_A.tongue),
  white: [1, 1, 1, 1],
};
const r3 = (v: number) => Math.round(v * 1000) / 1000;

// ── 키프레임 줄이기: 선형 보간 오차가 eps 이하면 중간 키를 버림 (세그먼트 경계는 항상 유지)
const segStarts = new Set(markers.map((m) => m.tm));
function decimate(vals: number[][], eps: number): number[] {
  const keep = [0];
  let i = 0;
  while (i < vals.length - 1) {
    let j = i + 1;
    while (j + 1 < vals.length && !segStarts.has(j + 1) && !segStarts.has(j)) {
      let ok = true;
      for (let k = i + 1; k <= j && ok; k++) {
        const t = (k - i) / (j + 1 - i);
        for (let d = 0; d < vals[k].length; d++) {
          const lin = vals[i][d] + (vals[j + 1][d] - vals[i][d]) * t;
          if (Math.abs(lin - vals[k][d]) > eps) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) break;
      j++;
    }
    keep.push(j);
    i = j;
  }
  return keep;
}
const LIN = { i: { x: [1], y: [1] }, o: { x: [0], y: [0] } };
function prop(get: (p: Params) => number[] | number, eps = 0.02, spatial = false) {
  const vals = frames.map((f) => {
    const v = get(f);
    return (Array.isArray(v) ? v : [v]).map(r3);
  });
  const allSame = vals.every((v) => v.every((x, d) => x === vals[0][d]));
  if (allSame) return { a: 0, k: vals[0].length === 1 ? vals[0][0] : vals[0] };
  const keep = decimate(vals, eps);
  return {
    a: 1,
    k: keep.map((idx, n) =>
      n === keep.length - 1
        ? { t: idx, s: vals[idx] }
        : { t: idx, s: vals[idx], ...LIN, ...(spatial ? { to: [0, 0, 0], ti: [0, 0, 0] } : {}) },
    ),
  };
}
type Shape = { v: number[][]; i: number[][]; o: number[][]; c: boolean };
function pathProp(get: (p: Params) => Shape, eps = 0.03) {
  const shapes = frames.map(get);
  const flat = shapes.map((s) => [...s.v.flat(), ...s.i.flat(), ...s.o.flat()].map(r3));
  const keep = decimate(flat, eps);
  const rs = (s: Shape): Shape => ({
    c: s.c,
    v: s.v.map((p) => p.map(r3)),
    i: s.i.map((p) => p.map(r3)),
    o: s.o.map((p) => p.map(r3)),
  });
  return {
    a: 1,
    k: keep.map((idx, n) => (n === keep.length - 1 ? { t: idx, s: [rs(shapes[idx])] } : { t: idx, s: [rs(shapes[idx])], ...LIN })),
  };
}
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1]];

// ── 셰이프 도우미
const tr = (o: unknown = { a: 0, k: 100 }) => ({
  ty: 'tr',
  p: { a: 0, k: [0, 0] },
  a: { a: 0, k: [0, 0] },
  s: { a: 0, k: [100, 100] },
  r: { a: 0, k: 0 },
  o,
  sk: { a: 0, k: 0 },
  sa: { a: 0, k: 0 },
});
const fill = (c: number[], o: unknown = { a: 0, k: 100 }) => ({ ty: 'fl', c: { a: 0, k: c }, o, r: 1 });
const stroke = (c: number[], w: number) => ({ ty: 'st', c: { a: 0, k: c }, o: { a: 0, k: 100 }, w: { a: 0, k: w }, lc: 2, lj: 2 });
const ell = (p: unknown, s: unknown) => ({ ty: 'el', d: 1, p, s });
const group = (nm: string, items: unknown[], opacity?: unknown) => ({ ty: 'gr', nm, it: [...items, tr(opacity)] });
const st = (v: number[]) => ({ a: 0, k: v });

let ind = 0;
const layer = (nm: string, ty: number, parent: number | undefined, ks: Record<string, unknown>, shapes?: unknown[]) => ({
  ddd: 0,
  ind: ++ind,
  ty,
  nm,
  ...(parent ? { parent } : {}),
  sr: 1,
  ks: {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 0, k: [0, 0, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
    ...ks,
  },
  ao: 0,
  ...(shapes ? { shapes } : {}),
  ip: 0,
  op: N,
  st: 0,
  bm: 0,
});

// 1) 몸 전체 (null)
const root = layer('root', 3, undefined, {
  a: st([64, 108, 0]),
  p: prop((f) => [64 + f.rootX, 108 + f.rootY, 0], 0.03, true),
  r: prop((f) => f.rootRot, 0.05),
  s: prop((f) => [f.sqX * 100, f.sqY * 100, 100], 0.15),
});
// 2) 머리 (null, 부모 root)
const head = layer('head', 3, root.ind, {
  a: st([64, 66, 0]),
  p: prop((f) => [64 + f.headX, 66 + f.headY, 0], 0.03, true),
  r: prop((f) => f.headRot, 0.05),
});
// 3) 얼굴 (null, 부모 head)
const face = layer('face', 3, head.ind, { p: prop((f) => [f.faceX, f.faceY, 0], 0.03, true) });

// 4) 얼굴 셰이프
const eyeGroup = (side: 'L' | 'R') => [
  group(`arc${side}`, [
    {
      ty: 'sh',
      ks: pathProp((f) => {
        const e = eyeNums(f, side);
        const a = [e.ax - 5.2, 41];
        const b = [e.ax + 5.2, 41];
        const q = [e.ax, 35.2];
        // 2차 → 3차 베지어
        const c1 = [a[0] + (2 / 3) * (q[0] - a[0]), a[1] + (2 / 3) * (q[1] - a[1])];
        const c2 = [b[0] + (2 / 3) * (q[0] - b[0]), b[1] + (2 / 3) * (q[1] - b[1])];
        return { c: false, v: [a, b], o: [sub(c1, a), [0, 0]], i: [[0, 0], sub(c2, b)] };
      }),
    },
    stroke(C.ink, 2.7),
  ], prop((f) => eyeNums(f, side).aop * 100, 0.5)),
  group(`hl${side}`, [
    ell(prop((f) => { const e = eyeNums(f, side); return [e.hx, e.hy]; }), prop((f) => { const e = eyeNums(f, side); return [e.hr * 2, e.hr * 2]; })),
    fill(C.white),
  ], prop((f) => eyeNums(f, side).hop * 100, 0.5)),
  group(`eye${side}`, [
    ell(prop((f) => { const e = eyeNums(f, side); return [e.cx, e.cy]; }), prop((f) => { const e = eyeNums(f, side); return [e.rx * 2, e.ry * 2]; }, 0.04)),
    fill(C.ink),
  ], prop((f) => eyeNums(f, side).op * 100, 0.5)),
];
const browGroup = (side: 'L' | 'R') =>
  group(`brow${side}`, [
    {
      ty: 'sh',
      ks: pathProp((f) => {
        const b = browNums(f, side);
        const a = [b.ox, b.oy];
        const e = [b.ix, b.iy];
        const q = [b.qx, b.qy];
        const c1 = [a[0] + (2 / 3) * (q[0] - a[0]), a[1] + (2 / 3) * (q[1] - a[1])];
        const c2 = [e[0] + (2 / 3) * (q[0] - e[0]), e[1] + (2 / 3) * (q[1] - e[1])];
        return { c: false, v: [a, e], o: [sub(c1, a), [0, 0]], i: [[0, 0], sub(c2, e)] };
      }),
    },
    stroke(C.ink, 2.2),
  ], prop((f) => browNums(f, side).op * 100, 0.5));
const mouth = group('mouth', [
  {
    ty: 'sh',
    ks: pathProp((f) => {
      const m = mouthNums(f);
      return { c: true, v: [m.L, m.R], o: [sub(m.c1, m.L), sub(m.c3, m.R)], i: [sub(m.c4, m.L), sub(m.c2, m.R)] };
    }),
  },
  stroke(C.ink, 2.4),
  fill(C.ink),
]);
// Lottie 셰이프 목록은 위에서 아래로 그려지므로(앞쪽이 위) 순서를 뒤집어 넣는다
const faceLayer = layer('faceShapes', 4, face.ind, {}, [
  mouth,
  browGroup('L'),
  browGroup('R'),
  ...eyeGroup('L'),
  ...eyeGroup('R'),
]);
// 5) 머리 셰이프 (볼·하이라이트·머리)
const cheek = (cx: number) =>
  group(`cheek${cx}`, [
    ell(prop((f) => [cx, 50 + 0.8 * f.eyeHappy]), prop((f) => [2 * (6 + 1.3 * f.blush), 2 * (4 + 0.7 * f.blush)])),
    fill(C.cheek),
  ], prop((f) => (0.36 + 0.38 * Math.min(1, Math.max(0, f.blush))) * 100, 0.5));
const headLayer = layer('headShapes', 4, head.ind, {}, [
  cheek(44),
  cheek(84),
  group('hl', [ell(st([52, 28]), st([17, 8.4])), fill(C.white, st([40]))]),
  group('head', [ell(st([64, 44]), st([56, 48])), fill(C.body)]),
]);
// 6) 몸 셰이프
const bodyLayer = layer('bodyShapes', 4, root.ind, {}, [
  group('shine', [ell(st([50, 66]), st([20, 9])), fill(C.white, st([28]))]),
  group('belly', [ell(st([64, 85]), st([56, 34])), fill(C.belly)]),
  group('body', [ell(st([64, 80]), st([80, 56])), fill(C.body)]),
]);
// 7) 꼬리
const tailLayer = layer('tail', 4, root.ind, {}, [
  group('tip', [ell(prop((f) => { const t = tailPts(f); return [t[12], t[13]]; }), st([9.6, 9.6])), fill(C.dark)]),
  group('tail', [
    {
      ty: 'sh',
      ks: pathProp((f) => {
        const t = tailPts(f);
        const P = (i: number) => [t[i * 2], t[i * 2 + 1]];
        return {
          c: false,
          v: [P(0), P(3), P(6)],
          o: [sub(P(1), P(0)), sub(P(4), P(3)), [0, 0]],
          i: [[0, 0], sub(P(2), P(3)), sub(P(5), P(6))],
        };
      }),
    },
    stroke(C.body, 8),
  ]),
]);
// 8) 그림자
const shadow = layer('shadow', 4, undefined, {}, [
  group('shadow', [
    ell(prop((f) => [64 + f.rootX, 111]), prop((f) => [2 * 36 * (1 - 0.38 * Math.min(1, Math.max(0, -f.rootY / 28))) * f.sqX, 10], 0.1)),
    fill([0.106, 0.369, 0.125, 1]),
  ], prop((f) => 20 * (1 - 0.55 * Math.min(1, Math.max(0, -f.rootY / 28))), 0.3)),
]);

// Lottie 레이어 순서: 배열 앞쪽이 위에 그려짐
const layers = [faceLayer, face, headLayer, head, bodyLayer, tailLayer, root, shadow];
// 뷰박스 -20 -36 168 168 → 168×168 캔버스, 전체를 (20,36)만큼 이동시키는 최상위 null이 필요
const stage = layer('stage', 3, undefined, { p: st([20, 36, 0]) });
for (const l of [root, shadow]) (l as { parent?: number }).parent = stage.ind;
layers.push(stage);

const anim = {
  v: '5.12.0',
  fr: fps,
  ip: 0,
  op: N,
  w: 168,
  h: 168,
  nm: 'pybaem-rig-baked',
  ddd: 0,
  assets: [],
  layers,
  markers,
};
const json = JSON.stringify(anim);
writeFileSync(DIR + `pybaem-rig-baked${SUFFIX}.json`, json);
if (ONLY) {
  console.log(`${ONLY}: ${N} frames ${(json.length / 1024).toFixed(1)}KB raw / ${(gzipSync(json, { level: 9 }).length / 1024).toFixed(1)}KB gzip`);
  process.exit(0);
}

// dance 구간만 (벤치 루프용)
const dance = markers.find((m) => m.cm === 'dance')!;
writeFileSync(DIR + 'pybaem-rig-dance.json', JSON.stringify({ ...anim, ip: dance.tm, op: dance.tm + dance.dr, markers: [] }));

// dotLottie 상태머신: 문자열 입력 state, 모든 상태 사이 Tweened(0.25s) 전환
const names = markers.map((m) => m.cm);
const mkSm = (tween: boolean) => ({
  initial: 'idle',
  states: names.map((n) => ({
    name: n,
    type: 'PlaybackState',
    animation: '',
    segment: n,
    loop: n !== 'happy',
    autoplay: true,
    transitions: names
      .filter((m) => m !== n)
      .map((m) => ({
        type: tween ? 'Tweened' : 'Transition',
        toState: m,
        ...(tween ? { duration: 0.25, easing: [0.4, 0, 0.2, 1] } : {}),
        guards: [{ type: 'String', inputName: 'state', conditionType: 'Equal', compareTo: m }],
      })),
  })),
  inputs: [{ type: 'String', name: 'state', value: 'idle' }],
});
writeFileSync(DIR + 'pybaem-rig-sm.json', JSON.stringify(mkSm(true)));
writeFileSync(DIR + 'pybaem-rig-sm-instant.json', JSON.stringify(mkSm(false)));

const kb = (n: number) => (n / 1024).toFixed(1);
console.log(
  `baked: ${N} frames, ${layers.length} layers, ${kb(json.length)}KB raw / ${kb(gzipSync(json, { level: 9 }).length)}KB gzip; markers ${names.join(',')}`,
);
