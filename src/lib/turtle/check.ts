/**
 * 그림 검사기 (P0-06 스파이크 checker.js → P11-05). 픽셀이 아니라 turtle 명령 스트림을 본다.
 * DOM 없는 순수 TS라 브라우저 피드백·서버 재채점(/api/quest/validate·complete)·CI(`test:content`)가 같은 판정을 쓴다.
 *
 *   const a = analyze(commands)
 *   findShape(a, { shape: 'regular', n: 4, side: 100 })     // 정사각형
 *   findShape(a, { shape: 'regular', n: 5, k: 2, filled: true })  // 채운 오각별
 *   findCircles(a)                                         // circle()로 그렸든 반복으로 직접 그렸든
 *   matchDrawing(a, segments, { translate: true })         // 정답 그림 선분과 견주기 (순서·방향·나눠 그리기 무관)
 *
 * 실패 이유(reasons)는 아이에게 보여 주는 한국어 문장이라 튜터 힌트로도 쓴다.
 * 서버는 남이 보낸 명령을 받으므로 모르는 거북이·이상한 명령은 건너뛰고(던지지 않음), 선 합치기는 칸(bucket)으로 찾아
 * 명령 10만 개에서도 선형에 가깝게 끝난다.
 */
import { Scene, type TurtleCommand } from './scene';

const D2R = Math.PI / 180;

export interface Segment {
  tid: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  c: string;
}

export interface Analysis {
  segments: Segment[];
  fills: { tid: number; pts: number[][]; c: string }[];
  dots: { tid: number; c: string }[];
  texts: { tid: number; text: string }[];
  stamps: number;
  bg: string | null;
  turtles: number;
  commands: number;
}

/** 명령 스트림 → 기하 정보. 지우기(clear·clearscreen)는 반영하고, 읽을 수 없는 명령은 건너뛴다 */
export function analyze(commands: readonly TurtleCommand[]): Analysis {
  const scene = new Scene();
  let segments: Segment[] = [];
  let fills: Analysis['fills'] = [];
  let dots: Analysis['dots'] = [];
  let texts: Analysis['texts'] = [];
  let stamps = 0;
  for (const c of commands) {
    if (!Array.isArray(c)) continue;
    let op;
    try {
      op = scene.apply(c);
    } catch {
      continue; // 모르는 거북이 id 등 (남이 보낸 명령은 믿지 않음)
    }
    if (op.k === 'move') {
      if (op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1) && finite(op))
        segments.push({
          tid: op.t.id,
          x0: op.x0,
          y0: op.y0,
          x1: op.x1,
          y1: op.y1,
          c: String(op.color),
        });
    } else if (op.k === 'endFill' && op.points)
      fills.push({ tid: op.t.id, pts: op.points, c: String(op.color) });
    else if (op.k === 'dot') dots.push({ tid: op.t.id, c: op.color });
    else if (op.k === 'text') texts.push({ tid: op.t.id, text: op.text });
    else if (op.k === 'stamp') stamps++;
    else if (op.k === 'clear') {
      const keep = (x: { tid: number }) => x.tid !== op.t.id;
      segments = segments.filter(keep);
      fills = fills.filter(keep);
      dots = dots.filter(keep);
      texts = texts.filter(keep);
    } else if (op.k === 'clearScreen') {
      segments = [];
      fills = [];
      dots = [];
      texts = [];
      stamps = 0;
    }
  }
  return {
    segments,
    fills,
    dots,
    texts,
    stamps,
    bg: scene.bg,
    turtles: scene.turtles.size,
    commands: commands.length,
  };
}

const finite = (o: { x0: number; y0: number; x1: number; y1: number }) =>
  Number.isFinite(o.x0 + o.y0 + o.x1 + o.y1);
const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(bx - ax, by - ay);
const norm180 = (a: number) => {
  const r = ((((a + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
};

interface Polyline {
  tid: number;
  pts: number[][];
}

/** 같은 거북이가 끊김 없이 이어 그린 선을 꺾은선으로 묶음 */
export function polylines(a: Analysis, eps = 0.05): Polyline[] {
  const open = new Map<number, Polyline & { ex: number; ey: number }>();
  const out: (Polyline & { ex: number; ey: number })[] = [];
  for (const s of a.segments) {
    let pl = open.get(s.tid);
    if (!pl || dist(pl.ex, pl.ey, s.x0, s.y0) > eps) {
      pl = { tid: s.tid, pts: [[s.x0, s.y0]], ex: s.x0, ey: s.y0 };
      out.push(pl);
      open.set(s.tid, pl);
    }
    pl.pts.push([s.x1, s.y1]);
    pl.ex = s.x1;
    pl.ey = s.y1;
  }
  return out.map(({ tid, pts }) => ({ tid, pts }));
}

/**
 * 이어 그린 꺾은선 안의 "지나온 점으로 돌아온" 고리들 (스파이크에 더함). 펜을 들지 않고 벽(정사각형) → 왼쪽 변을 올라가
 * 지붕(삼각형)을 이어 그린 집도 도형 두 개로 찾게 한다. 고리는 후보를 더할 뿐 꺾은선 자체도 후보로 남는다
 */
function loops(pts: number[][], tol = 1, max = 200): number[][][] {
  const out: number[][][] = [];
  const seen = new Map<string, number>();
  for (let i = 0; i < pts.length && out.length < max; i++) {
    const key = `${Math.round(pts[i][0])},${Math.round(pts[i][1])}`;
    const j = seen.get(key);
    if (
      j !== undefined &&
      i - j >= 3 &&
      dist(pts[j][0], pts[j][1], pts[i][0], pts[i][1]) <= tol
    )
      out.push(pts.slice(j, i + 1));
    seen.set(key, i);
  }
  return out;
}

export interface Sides {
  sides: { len: number; dir: number }[];
  turns: number[];
  closed: boolean;
  perimeter: number;
  gap: number;
}

/** 꼭짓점 목록 → 변 목록. 같은 방향으로 이어진 선은 한 변으로 합친다 */
export function sidesOf(pts: number[][], angTol = 0.75): Sides {
  const sides: { len: number; dir: number }[] = [];
  for (let i = 1; i < pts.length; i++) {
    const len = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    if (len < 1e-6) continue;
    const dir =
      Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) / D2R;
    const last = sides[sides.length - 1];
    if (last && Math.abs(norm180(dir - last.dir)) < angTol) last.len += len;
    else sides.push({ len, dir });
  }
  const perimeter = sides.reduce((s, x) => s + x.len, 0);
  const p0 = pts[0];
  const pn = pts[pts.length - 1];
  const gap = dist(p0[0], p0[1], pn[0], pn[1]);
  const closed = sides.length >= 2 && gap <= Math.max(1, perimeter * 0.01);
  if (
    closed &&
    sides.length > 2 &&
    Math.abs(norm180(sides[0].dir - sides[sides.length - 1].dir)) < angTol
  ) {
    // 변 중간에서 시작했으면 첫 변과 마지막 변을 합친다
    sides[0].len += sides.pop()!.len;
  }
  const turns: number[] = [];
  for (let i = 1; i < sides.length; i++)
    turns.push(norm180(sides[i].dir - sides[i - 1].dir));
  if (closed) turns.push(norm180(sides[0].dir - sides[sides.length - 1].dir));
  return { sides, turns, closed, perimeter, gap };
}

export interface CheckResult {
  ok: boolean;
  reasons: string[];
}

interface ShapeCheck extends CheckResult {
  sides: number;
}

const fmt = (n: number) => String(+n.toFixed(1));

/** 정다각형·별 검사. k=1이면 정n각형, n=5·k=2면 오각별 */
export function checkRegular(
  pts: number[][],
  spec: { n: number; k?: number; side?: number },
): ShapeCheck {
  const { n, k = 1 } = spec;
  const lenTol = 0.03;
  const angTol = 2;
  const g = sidesOf(pts);
  const reasons: string[] = [];
  if (!g.closed)
    reasons.push(
      `도형이 닫히지 않았어요. 시작한 곳으로 돌아와야 해요 (${fmt(g.gap)}만큼 떨어져 있어요).`,
    );
  if (g.sides.length !== n)
    reasons.push(`변이 ${n}개여야 하는데 지금은 ${g.sides.length}개예요.`);
  const lens = g.sides.map((s) => s.len);
  const mean = lens.reduce((s, x) => s + x, 0) / (lens.length || 1);
  if (lens.length) {
    const minL = Math.min(...lens);
    const maxL = Math.max(...lens);
    if ((maxL - minL) / mean > lenTol)
      reasons.push(
        `변의 길이가 서로 달라요 (가장 짧은 변 ${Math.round(minL)}, 가장 긴 변 ${Math.round(maxL)}).`,
      );
    if (
      spec.side != null &&
      Math.abs(mean - spec.side) > Math.max(1, spec.side * lenTol)
    )
      reasons.push(
        `변의 길이가 ${spec.side}여야 하는데 ${Math.round(mean)}이에요.`,
      );
  }
  const want = (360 * k) / n;
  const want2 = want > 180 ? 360 - want : want;
  const bad = g.turns.filter((t) => Math.abs(Math.abs(t) - want2) > angTol);
  const signs = new Set(g.turns.map((t) => Math.sign(t)));
  if (g.turns.length && (bad.length || signs.size > 1)) {
    const seen = [...new Set(g.turns.map((t) => Math.round(Math.abs(t))))]
      .slice(0, 4)
      .join('°, ');
    reasons.push(
      `매번 ${fmt(want2)}°씩 같은 방향으로 돌아야 해요 (지금: ${seen}°).`,
    );
  }
  return { ok: reasons.length === 0, reasons, sides: g.sides.length };
}

/** 직사각형 (네 모서리가 90°, 마주 보는 변이 같음) */
export function checkRectangle(pts: number[][]): ShapeCheck {
  const lenTol = 0.03;
  const g = sidesOf(pts);
  const reasons: string[] = [];
  if (!g.closed) reasons.push('도형이 닫히지 않았어요.');
  if (g.sides.length !== 4)
    reasons.push(`변이 4개여야 하는데 지금은 ${g.sides.length}개예요.`);
  else {
    const [a, b, c, d] = g.sides.map((s) => s.len);
    if (Math.abs(a - c) / a > lenTol || Math.abs(b - d) / b > lenTol)
      reasons.push('마주 보는 변의 길이가 같아야 해요.');
  }
  if (g.turns.some((t) => Math.abs(Math.abs(t) - 90) > 2))
    reasons.push('모든 모서리에서 90°씩 돌아야 해요.');
  return { ok: reasons.length === 0, reasons, sides: g.sides.length };
}

export interface ShapeSpec {
  shape: 'regular' | 'rectangle';
  /** 변(꼭짓점) 수. regular만 */
  n?: number;
  /** 별 건너뛰기: 1 = 정다각형, 2 = 오각별(144°) */
  k?: number;
  side?: number;
  filled?: boolean;
  /** 이 도형이 몇 개 이상 있어야 하는지 (기본 1) */
  count?: number;
}

/** 도형 이름 (실패 문장용) */
export function shapeName(spec: ShapeSpec): string {
  if (spec.shape === 'rectangle') return '직사각형';
  const n = spec.n ?? 4;
  if ((spec.k ?? 1) > 1) return `꼭짓점 ${n}개 별`;
  return n === 3 ? '정삼각형' : n === 4 ? '정사각형' : `정${n}각형`;
}

/**
 * 그림에서 조건에 맞는 도형 찾기. 못 찾으면 가장 가까운 후보의 이유를 돌려준다.
 * 후보 = 이어 그린 꺾은선 + 그 안의 고리 + 채운 모양 (같은 자리의 같은 도형은 한 번만 셈)
 */
export function findShape(a: Analysis, spec: ShapeSpec): CheckResult {
  const want = spec.count ?? 1;
  const cands: number[][][] = [];
  for (const pl of polylines(a)) {
    cands.push(pl.pts, ...loops(pl.pts));
  }
  for (const f of a.fills) cands.push([...f.pts, f.pts[0]]);
  let best: (ShapeCheck & { score: number }) | null = null;
  const found = new Set<string>();
  for (const pts of cands) {
    const r =
      spec.shape === 'rectangle'
        ? checkRectangle(pts)
        : checkRegular(pts, { n: spec.n ?? 4, k: spec.k, side: spec.side });
    if (spec.filled && !a.fills.some((f) => samePolygon(f.pts, pts))) {
      r.ok = false;
      r.reasons.push(
        '색칠(채우기)이 안 되어 있어요. begin_fill()과 end_fill()로 감싸 보세요.',
      );
    }
    if (r.ok) found.add(shapeKey(pts));
    const score =
      (r.ok ? 100 : 0) -
      r.reasons.length * 10 -
      Math.abs(r.sides - (spec.n ?? 4));
    if (!best || score > best.score) best = { ...r, score };
  }
  if (!best)
    return {
      ok: false,
      reasons: [
        '아직 아무것도 그리지 않았어요. 펜이 내려가 있는지(pendown) 확인해 보세요.',
      ],
    };
  if (found.size >= want) return { ok: true, reasons: [] };
  if (found.size > 0)
    return {
      ok: false,
      reasons: [
        `${shapeName(spec)}이 ${want}개 있어야 하는데 지금은 ${found.size}개예요.`,
      ],
    };
  return {
    ok: false,
    reasons: [`${shapeName(spec)}을 아직 찾지 못했어요.`, ...best.reasons],
  };
}

/** 같은 자리의 같은 도형인지 가려내는 열쇠 (꼭짓점 평균 위치 + 둘레) */
function shapeKey(pts: number[][]): string {
  // 같은 점이 거듭 들어 있어도(채우기는 시작점을 두 번 가짐) 꼭짓점 하나로
  const body = pts.filter(
    (p, i) => i === 0 || dist(p[0], p[1], pts[i - 1][0], pts[i - 1][1]) >= 1e-6,
  );
  if (
    body.length > 1 &&
    dist(body[0][0], body[0][1], body.at(-1)![0], body.at(-1)![1]) < 1
  )
    body.pop();
  let cx = 0;
  let cy = 0;
  for (const [x, y] of body) {
    cx += x;
    cy += y;
  }
  const g = sidesOf(pts);
  return `${Math.round(cx / body.length)},${Math.round(cy / body.length)},${Math.round(g.perimeter)}`;
}

/** 두 꼭짓점 목록이 같은 다각형인지 (변 수·둘레, 순서·시작점 무관) */
function samePolygon(p: number[][], q: number[][], tol = 1): boolean {
  const a = sidesOf([...p, p[0]]);
  const b = sidesOf([...q, q[0]]);
  if (a.sides.length !== b.sides.length) return false;
  return Math.abs(a.perimeter - b.perimeter) <= tol * a.sides.length;
}

export interface Circle {
  tid: number;
  cx: number;
  cy: number;
  r: number;
  steps: number;
  extent: number;
}

/** 원·호 찾기: 길이가 같은 짧은 선이 같은 각도로 계속 꺾이는 구간 (circle()이든 반복이든) */
export function findCircles(a: Analysis, minSteps = 6): Circle[] {
  const lenTol = 0.03;
  const angTol = 0.6;
  const out: Circle[] = [];
  for (const pl of polylines(a)) {
    const pts = pl.pts;
    const seg: { len: number; dir: number; p: number[]; q: number[] }[] = [];
    for (let i = 1; i < pts.length; i++) {
      const len = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (len < 1e-6) continue;
      seg.push({
        len,
        dir:
          Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) /
          D2R,
        p: pts[i - 1],
        q: pts[i],
      });
    }
    let i = 0;
    while (i < seg.length - 1) {
      let turn = norm180(seg[i + 1].dir - seg[i].dir);
      if (
        Math.abs(turn) < 0.2 ||
        Math.abs(turn) > 45 ||
        Math.abs(seg[i + 1].len - seg[i].len) / seg[i].len > lenTol
      ) {
        i++;
        continue;
      }
      let j = i + 1;
      while (
        j + 1 < seg.length &&
        Math.abs(norm180(seg[j + 1].dir - seg[j].dir) - turn) < angTol &&
        Math.abs(seg[j + 1].len - seg[i].len) / seg[i].len <= lenTol
      )
        j++;
      const steps = j - i + 1;
      if (steps >= minSteps) {
        // 좌표가 소수 둘째 자리로 반올림돼 있어 구간 평균으로 반지름을 어림한다
        let sumL = 0;
        let sumT = 0;
        for (let q = i; q <= j; q++) sumL += seg[q].len;
        for (let q = i + 1; q <= j; q++)
          sumT += norm180(seg[q].dir - seg[q - 1].dir);
        turn = sumT / (j - i);
        const l = sumL / steps;
        const th = Math.abs(turn) * D2R;
        const r = l / (2 * Math.sin(th / 2));
        const [ax, ay] = seg[i].p;
        const [bx, by] = seg[i].q;
        const sgn = Math.sign(turn); // +: 반시계 → 중심은 왼쪽
        const ux = (bx - ax) / seg[i].len;
        const uy = (by - ay) / seg[i].len;
        const hgt = r * Math.cos(th / 2);
        out.push({
          tid: pl.tid,
          cx: (ax + bx) / 2 - sgn * uy * hgt,
          cy: (ay + by) / 2 + sgn * ux * hgt,
          r,
          steps,
          extent: steps * Math.abs(turn),
        });
      }
      i = j + 1;
    }
  }
  return out;
}

/** 선·채우기·점에 쓴 색 (소문자) */
export function colorsUsed(a: Analysis): string[] {
  const s = new Set<string>();
  for (const x of a.segments) s.add(x.c.toLowerCase());
  for (const x of a.fills) s.add(x.c.toLowerCase());
  for (const x of a.dots) s.add(String(x.c).toLowerCase());
  return [...s];
}

/** 선분 [x0, y0, x1, y1] */
export type Seg4 = [number, number, number, number];

/**
 * 같은 직선 위의 선분을 구간으로 합친다 → [x0,y0,x1,y1][].
 * 직선은 (방향 θ, 원점 거리 ρ) 칸에 나눠 담아 이웃 칸만 찾는다 (선이 많아도 느려지지 않게)
 */
export function mergedSegments(
  segs: readonly { x0: number; y0: number; x1: number; y1: number }[],
  tol = 2,
): Seg4[] {
  const TH_STEP = 0.5 * D2R;
  const TH_BUCKETS = Math.ceil(Math.PI / TH_STEP);
  const R_STEP = Math.max(tol / 2, 1e-6);
  type Line = { th: number; rho: number; ivs: number[][] };
  const lines: Line[] = [];
  const buckets = new Map<string, Line[]>();
  for (const s of segs) {
    if (dist(s.x0, s.y0, s.x1, s.y1) < 1e-6) continue;
    let th = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
    if (th < 0) th += Math.PI;
    if (th >= Math.PI - 1e-9) th -= Math.PI;
    const rho = -Math.sin(th) * s.x0 + Math.cos(th) * s.y0;
    const tk = Math.floor(th / TH_STEP);
    const rk = Math.floor(rho / R_STEP);
    let L: Line | undefined;
    search: for (let dt = -1; dt <= 1; dt++)
      for (let dr = -1; dr <= 1; dr++) {
        // θ가 π 근처면 0 근처와 같은 직선 (방향을 뒤집으면 ρ 부호가 바뀜)
        const t = tk + dt;
        const wrap = t < 0 || t >= TH_BUCKETS;
        const key = `${(t + TH_BUCKETS) % TH_BUCKETS},${(wrap ? -rk : rk) + dr}`;
        for (const l of buckets.get(key) ?? []) {
          let d = Math.abs(l.th - th);
          d = Math.min(d, Math.PI - d);
          const sameRho = d === Math.abs(l.th - th) ? l.rho : -l.rho;
          if (d < TH_STEP && Math.abs(sameRho - rho) <= tol / 2) {
            L = l;
            break search;
          }
        }
      }
    if (!L) {
      L = { th, rho, ivs: [] };
      lines.push(L);
      const key = `${tk},${rk}`;
      buckets.set(key, [...(buckets.get(key) ?? []), L]);
    }
    const c = Math.cos(L.th);
    const sn = Math.sin(L.th);
    const t0 = c * s.x0 + sn * s.y0;
    const t1 = c * s.x1 + sn * s.y1;
    L.ivs.push([Math.min(t0, t1), Math.max(t0, t1)]);
  }
  const out: Seg4[] = [];
  for (const L of lines) {
    L.ivs.sort((p, q) => p[0] - q[0]);
    const merged: number[][] = [];
    for (const iv of L.ivs) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + tol / 2)
        last[1] = Math.max(last[1], iv[1]);
      else merged.push(iv.slice());
    }
    const c = Math.cos(L.th);
    const sn = Math.sin(L.th);
    for (const [t0, t1] of merged)
      out.push([
        c * t0 - sn * L.rho,
        sn * t0 + c * L.rho,
        c * t1 - sn * L.rho,
        sn * t1 + c * L.rho,
      ]);
  }
  return out;
}

/** 콘텐츠에 적을 정답 선분 (소수 첫째 자리, `test:content`가 정답 코드 그림에서 뽑아 보여 줌) */
export function roundSegments(segs: readonly Seg4[]): Seg4[] {
  const r = (n: number) => Math.round(n * 10) / 10 || 0;
  return segs.map((s) => [r(s[0]), r(s[1]), r(s[2]), r(s[3])]);
}

export interface MatchOptions {
  tol?: number;
  /** 그린 자리는 보지 않음 (가장 왼쪽 아래를 맞춤) */
  translate?: boolean;
  /** 정답에 없는 선이 더 있어도 됨 (앞 단계 그림이 남는 덧붙이기 프로젝트) */
  extraOk?: boolean;
}

/** 정답 선분과 견주기 (순서·방향·나눠 그리기 무관). 한 직선 위에서 겹치거나 이어진 선분은 합친 뒤 비교 */
export function matchDrawing(
  actual: Analysis,
  expected: readonly Seg4[],
  o: MatchOptions = {},
): CheckResult & { missing: number; extra: number } {
  const tol = o.tol ?? 2;
  let A = mergedSegments(actual.segments, tol);
  let E = mergedSegments(
    expected.map(([x0, y0, x1, y1]) => ({ x0, y0, x1, y1 })),
    tol,
  );
  if (o.translate) {
    A = translateToOrigin(A);
    E = translateToOrigin(E);
  }
  const used = new Array<boolean>(A.length).fill(false);
  let missing = 0;
  for (const e of E) {
    let hit = -1;
    for (let i = 0; i < A.length; i++) {
      if (used[i]) continue;
      const s = A[i];
      const fwd =
        dist(e[0], e[1], s[0], s[1]) <= tol &&
        dist(e[2], e[3], s[2], s[3]) <= tol;
      const rev =
        dist(e[0], e[1], s[2], s[3]) <= tol &&
        dist(e[2], e[3], s[0], s[1]) <= tol;
      if (fwd || rev) {
        hit = i;
        break;
      }
    }
    if (hit >= 0) used[hit] = true;
    else missing++;
  }
  const extra = used.filter((u) => !u).length;
  const reasons: string[] = [];
  if (missing) reasons.push(`정답 그림의 선 ${missing}개가 아직 없어요.`);
  if (extra && !o.extraOk)
    reasons.push(`정답 그림에 없는 선이 ${extra}개 있어요.`);
  return { ok: reasons.length === 0, reasons, missing, extra };
}

function translateToOrigin(S: Seg4[]): Seg4[] {
  if (!S.length) return S;
  let mx = Infinity;
  let my = Infinity;
  for (const s of S) {
    mx = Math.min(mx, s[0], s[2]);
    my = Math.min(my, s[1], s[3]);
  }
  return S.map((s) => [s[0] - mx, s[1] - my, s[2] - mx, s[3] - my]);
}

/** 그림 규칙 (content 스키마 `answer.validation`의 그림 유형과 같은 모양, src/lib/quest/validation.ts) */
export type DrawingRule =
  | ({ type: 'shape' } & ShapeSpec)
  | { type: 'circles'; min?: number; radius?: number }
  | { type: 'colors'; min: number }
  | { type: 'text'; includes?: string; min?: number }
  | { type: 'segments'; min?: number; max?: number }
  | { type: 'turtles'; min: number }
  | {
      type: 'match_drawing';
      segments: Seg4[];
      translate?: boolean;
      extra_ok?: boolean;
    };

export const DRAWING_RULE_TYPES = new Set<string>([
  'shape',
  'circles',
  'colors',
  'text',
  'segments',
  'turtles',
  'match_drawing',
]);

/** 그림 규칙 하나 판정 + 실패 문장 */
export function checkDrawingRule(a: Analysis, r: DrawingRule): CheckResult {
  const res = (ok: boolean, reason: string): CheckResult => ({
    ok,
    reasons: ok ? [] : [reason],
  });
  switch (r.type) {
    case 'shape':
      return findShape(a, r);
    case 'circles': {
      const min = r.min ?? 1;
      const full = findCircles(a).filter(
        (c) =>
          c.extent >= 350 &&
          (r.radius == null || Math.abs(c.r - r.radius) <= 3),
      );
      // 같은 자리에 겹쳐 그린 원은 하나로 (도형과 같음, 3월드 플레이테스트: 꽃 다섯 송이를 한 자리에)
      const n = new Set(
        full.map((c) => [c.cx, c.cy, c.r].map(Math.round).join()),
      ).size;
      const size = r.radius == null ? '' : `반지름 ${r.radius}인 `;
      const overlap =
        full.length > n ? ' 같은 자리에 겹친 원은 하나로 세요.' : '';
      return res(
        n >= min,
        `${size}원을 ${min}개 이상 그려야 해요 (지금 ${n}개).${overlap}`,
      );
    }
    case 'colors': {
      const n = colorsUsed(a).length;
      return res(
        n >= r.min,
        `색을 ${r.min}가지 이상 써 보세요 (지금 ${n}가지).`,
      );
    }
    case 'text': {
      const min = r.min ?? 1;
      const n = a.texts.filter(
        (t) => r.includes == null || t.text.includes(r.includes),
      ).length;
      return res(
        n >= min,
        r.includes == null
          ? `write()로 글씨를 ${min}번 이상 써야 해요 (지금 ${n}번).`
          : `write()로 “${r.includes}”를 써야 해요.`,
      );
    }
    case 'segments': {
      const n = mergedSegments(a.segments).length;
      const ok = n >= (r.min ?? 0) && n <= (r.max ?? Infinity);
      const want =
        r.max == null
          ? `${r.min ?? 0}개 이상`
          : r.min == null
            ? `${r.max}개 이하`
            : `${r.min}~${r.max}개`;
      return res(ok, `선이 ${want}여야 하는데 지금 ${n}개예요.`);
    }
    case 'turtles':
      return res(
        a.turtles >= r.min,
        `거북이가 ${r.min}마리 이상 필요해요 (지금 ${a.turtles}마리).`,
      );
    case 'match_drawing':
      return matchDrawing(a, r.segments, {
        translate: r.translate,
        extraOk: r.extra_ok,
      });
  }
}
