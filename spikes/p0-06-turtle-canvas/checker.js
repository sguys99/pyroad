// @ts-check
/**
 * 그리기 검증기 (P11-05 프로토타입). 픽셀 비교 없이 명령 스트림만 봅니다.
 * DOM 없이 동작 → 브라우저와 Node(CI의 solution_code 검증, P0-09)에서 같이 사용.
 *
 *   const a = analyze(commands)
 *   findShape(a, { shape: 'regular', n: 4 })          // 정사각형
 *   findShape(a, { shape: 'regular', n: 5, k: 2, filled: true })  // 채운 별
 *   findCircles(a)                                    // 원/호 찾기 (circle() 또는 직접 만든 원)
 *   matchDrawing(a, analyze(expectedCommands), { normalize: 'translate' })  // 정답 그림과 비교
 */
import { Scene } from './scene.js';

const D2R = Math.PI / 180;

/** 명령 스트림 → 기하 정보 */
export function analyze(commands) {
  const scene = new Scene();
  /** @type {any[]} */ let segments = [];
  /** @type {any[]} */ let fills = [];
  /** @type {any[]} */ let dots = [];
  /** @type {any[]} */ let texts = [];
  let stamps = 0;
  let i = 0;
  for (const c of commands) {
    const op = scene.apply(c);
    i++;
    if (op.k === 'move' && op.draw && (op.x0 !== op.x1 || op.y0 !== op.y1)) {
      segments.push({ tid: op.t.id, x0: op.x0, y0: op.y0, x1: op.x1, y1: op.y1, c: op.color, w: op.width, i });
    } else if (op.k === 'endFill' && op.points) fills.push({ tid: op.t.id, pts: op.points, c: op.color, i });
    else if (op.k === 'dot') dots.push({ tid: op.t.id, x: op.x, y: op.y, s: op.size, c: op.color });
    else if (op.k === 'text') texts.push({ tid: op.t.id, x: op.x, y: op.y, text: op.text, c: op.color });
    else if (op.k === 'stamp') stamps++;
    else if (op.k === 'clear') {
      const keep = (x) => x.tid !== op.t.id;
      segments = segments.filter(keep); fills = fills.filter(keep); dots = dots.filter(keep); texts = texts.filter(keep);
    } else if (op.k === 'clearScreen') {
      segments = []; fills = []; dots = []; texts = []; stamps = 0;
    }
  }
  return { segments, fills, dots, texts, stamps, bg: scene.bg, turtles: [...scene.turtles.values()], commands: commands.length };
}

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const norm180 = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a === -180 ? 180 : a; };

/** 같은 거북이가 끊김 없이 이어 그린 선을 꺾은선으로 묶음 */
export function polylines(a, eps = 0.05) {
  /** @type {Map<number, any>} */ const open = new Map();
  const out = [];
  for (const s of a.segments) {
    let pl = open.get(s.tid);
    if (!pl || dist(pl.ex, pl.ey, s.x0, s.y0) > eps) {
      pl = { tid: s.tid, pts: [[s.x0, s.y0]], colors: new Set(), ex: s.x0, ey: s.y0 };
      out.push(pl);
      open.set(s.tid, pl);
    }
    pl.pts.push([s.x1, s.y1]);
    pl.colors.add(s.c);
    pl.ex = s.x1; pl.ey = s.y1;
  }
  return out.map((p) => ({ tid: p.tid, pts: p.pts, colors: [...p.colors] }));
}

/**
 * 꼭짓점 목록 → 변(side) 목록. 같은 방향으로 이어진 선은 한 변으로 합침.
 * @returns {{sides:{len:number,dir:number}[], turns:number[], closed:boolean, perimeter:number, gap:number}}
 */
export function sidesOf(pts, { angTol = 0.75, closeTol } = {}) {
  /** @type {{len:number,dir:number}[]} */
  const sides = [];
  for (let i = 1; i < pts.length; i++) {
    const len = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
    if (len < 1e-6) continue;
    const dir = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) / D2R;
    const last = sides[sides.length - 1];
    if (last && Math.abs(norm180(dir - last.dir)) < angTol) last.len += len;
    else sides.push({ len, dir });
  }
  const perimeter = sides.reduce((s, x) => s + x.len, 0);
  const p0 = pts[0], pn = pts[pts.length - 1];
  const gap = dist(p0[0], p0[1], pn[0], pn[1]);
  const closed = sides.length >= 2 && gap <= (closeTol ?? Math.max(1, perimeter * 0.01));
  if (closed && sides.length > 2 && Math.abs(norm180(sides[0].dir - sides[sides.length - 1].dir)) < angTol) {
    // 변 중간에서 시작한 경우: 첫 변과 마지막 변을 합침
    sides[0].len += /** @type {any} */ (sides.pop()).len;
  }
  const turns = [];
  for (let i = 1; i < sides.length; i++) turns.push(norm180(sides[i].dir - sides[i - 1].dir));
  if (closed) turns.push(norm180(sides[0].dir - sides[sides.length - 1].dir));
  return { sides, turns, closed, perimeter, gap };
}

/**
 * 정다각형/별 검사. k=1이면 정n각형, k=2, n=5면 오각별.
 * @param {{n:number,k?:number,side?:number,lenTol?:number,angTol?:number}} spec
 */
export function checkRegular(pts, spec) {
  const { n, k = 1, lenTol = 0.03, angTol = 2 } = spec;
  const g = sidesOf(pts);
  const reasons = [];
  if (!g.closed) reasons.push(`도형이 닫히지 않았어요. 시작한 곳으로 돌아와야 해요 (${g.gap.toFixed(1)}만큼 떨어져 있어요).`);
  if (g.sides.length !== n) reasons.push(`변이 ${n}개여야 하는데 지금은 ${g.sides.length}개예요.`);
  const lens = g.sides.map((s) => s.len);
  const mean = lens.reduce((s, x) => s + x, 0) / (lens.length || 1);
  const minL = Math.min(...lens), maxL = Math.max(...lens);
  if (lens.length && (maxL - minL) / mean > lenTol) reasons.push(`변의 길이가 서로 달라요 (가장 짧은 변 ${minL.toFixed(0)}, 가장 긴 변 ${maxL.toFixed(0)}).`);
  if (spec.side != null && lens.length && Math.abs(mean - spec.side) > Math.max(1, spec.side * lenTol)) reasons.push(`변의 길이가 ${spec.side}여야 하는데 ${mean.toFixed(0)}이에요.`);
  const want = (360 * k) / n;
  const want2 = want > 180 ? 360 - want : want;
  const bad = g.turns.filter((t) => Math.abs(Math.abs(t) - want2) > angTol);
  const signs = new Set(g.turns.map((t) => Math.sign(t)));
  if (g.turns.length && (bad.length || signs.size > 1)) {
    const seen = [...new Set(g.turns.map((t) => Math.round(Math.abs(t))))].slice(0, 4).join('°, ');
    reasons.push(`매번 ${+want2.toFixed(1)}°씩 같은 방향으로 돌아야 해요 (지금: ${seen}°).`);
  }
  return { ok: reasons.length === 0, reasons, sides: g.sides.length, closed: g.closed, meanSide: mean };
}

/** 직사각형 (네 각이 90°, 마주 보는 변이 같음) */
export function checkRectangle(pts, { lenTol = 0.03, angTol = 2 } = {}) {
  const g = sidesOf(pts);
  const reasons = [];
  if (!g.closed) reasons.push('도형이 닫히지 않았어요.');
  if (g.sides.length !== 4) reasons.push(`변이 4개여야 하는데 지금은 ${g.sides.length}개예요.`);
  else {
    const [a, b, c, d] = g.sides.map((s) => s.len);
    if (Math.abs(a - c) / a > lenTol || Math.abs(b - d) / b > lenTol) reasons.push('마주 보는 변의 길이가 같아야 해요.');
  }
  if (g.turns.some((t) => Math.abs(Math.abs(t) - 90) > angTol)) reasons.push('모든 모서리에서 90°씩 돌아야 해요.');
  return { ok: reasons.length === 0, reasons, sides: g.sides.length, closed: g.closed };
}

/**
 * 그림 안에서 조건에 맞는 도형 찾기. 못 찾으면 가장 가까운 후보의 이유를 돌려줌.
 * @param {any} a analyze() 결과
 * @param {{shape:'regular'|'rectangle', n?:number, k?:number, side?:number, filled?:boolean, fillColor?:string}} spec
 */
export function findShape(a, spec) {
  const cands = [];
  for (const pl of polylines(a)) cands.push({ from: 'line', pts: pl.pts });
  for (const f of a.fills) cands.push({ from: 'fill', pts: [...f.pts, f.pts[0]], color: f.c });
  let best = null;
  for (const c of cands) {
    const r = spec.shape === 'rectangle' ? checkRectangle(c.pts) : checkRegular(c.pts, /** @type {any} */ (spec));
    if (spec.filled) {
      const filled = a.fills.some((f) => samePolygon(f.pts, c.pts) && (!spec.fillColor || f.c === spec.fillColor));
      if (!filled) { r.ok = false; r.reasons.push('색칠(채우기)이 안 되어 있어요. begin_fill()과 end_fill()로 감싸 보세요.'); }
    }
    const score = (r.ok ? 100 : 0) - r.reasons.length * 10 - Math.abs((r.sides ?? 0) - (spec.n ?? 4));
    if (!best || score > best.score) best = { ...r, score, from: c.from };
  }
  if (!best) return { ok: false, reasons: ['아직 아무것도 그리지 않았어요. 펜이 내려가 있는지(pendown) 확인해 보세요.'] };
  return best;
}

/** 두 꼭짓점 목록이 같은 다각형인지 (꼭짓점 집합 비교, 순서·시작점 무관) */
function samePolygon(p, q, tol = 1) {
  const key = (pts) => {
    const g = sidesOf([...pts, pts[0]]);
    return g;
  };
  const a = key(p), b = key(q);
  if (a.sides.length !== b.sides.length) return false;
  return Math.abs(a.perimeter - b.perimeter) <= tol * a.sides.length;
}

/**
 * 원/호 찾기: 길이가 같은 짧은 선이 같은 각도로 계속 꺾이는 구간.
 * circle()로 그렸든 for 반복으로 직접 그렸든 똑같이 찾음.
 */
export function findCircles(a, { minSteps = 6, lenTol = 0.03, angTol = 0.6 } = {}) {
  const out = [];
  for (const pl of polylines(a)) {
    const pts = pl.pts;
    const seg = [];
    for (let i = 1; i < pts.length; i++) {
      const len = dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      if (len < 1e-6) continue;
      seg.push({ len, dir: Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) / D2R, p: pts[i - 1], q: pts[i] });
    }
    let i = 0;
    while (i < seg.length - 1) {
      let turn = norm180(seg[i + 1].dir - seg[i].dir);
      if (Math.abs(turn) < 0.2 || Math.abs(turn) > 45 || Math.abs(seg[i + 1].len - seg[i].len) / seg[i].len > lenTol) { i++; continue; }
      let j = i + 1;
      while (j + 1 < seg.length && Math.abs(norm180(seg[j + 1].dir - seg[j].dir) - turn) < angTol && Math.abs(seg[j + 1].len - seg[i].len) / seg[i].len <= lenTol) j++;
      const steps = j - i + 1;
      if (steps >= minSteps) {
        // 좌표가 소수 둘째 자리로 반올림돼 있으므로 구간 평균으로 반지름 추정
        let sumL = 0, sumT = 0;
        for (let q = i; q <= j; q++) sumL += seg[q].len;
        for (let q = i + 1; q <= j; q++) sumT += norm180(seg[q].dir - seg[q - 1].dir);
        turn = sumT / (j - i);
        const l = sumL / steps, th = Math.abs(turn) * D2R;
        const r = l / (2 * Math.sin(th / 2));
        const [ax, ay] = seg[i].p, [bx, by] = seg[i].q;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const sgn = Math.sign(turn); // +: 반시계 → 중심은 왼쪽
        const ux = (bx - ax) / seg[i].len, uy = (by - ay) / seg[i].len;
        const hgt = r * Math.cos(th / 2);
        out.push({ tid: pl.tid, cx: mx - sgn * uy * hgt, cy: my + sgn * ux * hgt, r, steps, extent: steps * Math.abs(turn), dir: sgn > 0 ? 'ccw' : 'cw' });
      }
      i = j + 1;
    }
  }
  return out;
}

/** 쓴 색 목록 */
export function colorsUsed(a) {
  const s = new Set();
  for (const x of a.segments) s.add(String(x.c).toLowerCase());
  for (const x of a.fills) s.add(String(x.c).toLowerCase());
  for (const x of a.dots) s.add(String(x.c).toLowerCase());
  return [...s];
}

/**
 * 선분 집합 비교 (순서·방향·나눠 그리기와 무관). 한 직선 위에서 겹치거나 이어진 선분은 합친 뒤 비교.
 * @param {{tol?:number, normalize?:'none'|'translate'}} [o]
 */
export function matchDrawing(actual, expected, o = {}) {
  const tol = o.tol ?? 2;
  let A = mergedSegments(actual.segments, tol), E = mergedSegments(expected.segments, tol);
  if (o.normalize === 'translate') { A = translateToOrigin(A); E = translateToOrigin(E); }
  const used = new Array(A.length).fill(false);
  const missing = [];
  for (const e of E) {
    let hit = -1;
    for (let i = 0; i < A.length; i++) {
      if (used[i]) continue;
      const s = A[i];
      const fwd = dist(e[0], e[1], s[0], s[1]) <= tol && dist(e[2], e[3], s[2], s[3]) <= tol;
      const rev = dist(e[0], e[1], s[2], s[3]) <= tol && dist(e[2], e[3], s[0], s[1]) <= tol;
      if (fwd || rev) { hit = i; break; }
    }
    if (hit >= 0) used[hit] = true; else missing.push(e);
  }
  const extra = A.filter((_, i) => !used[i]);
  const matched = E.length - missing.length;
  const reasons = [];
  if (missing.length) reasons.push(`정답 그림의 선 ${missing.length}개가 아직 없어요.`);
  if (extra.length) reasons.push(`정답에 없는 선이 ${extra.length}개 있어요.`);
  return { ok: !missing.length && !extra.length, score: matched / Math.max(E.length, A.length, 1), missing, extra, expected: E.length, actual: A.length, reasons };
}

/** 같은 직선 위의 선분들을 구간 합치기 → [x0,y0,x1,y1][] */
export function mergedSegments(segs, tol = 2) {
  /** @type {{th:number, rho:number, ivs:number[][]}[]} */
  const lines = [];
  for (const s of segs) {
    const len = dist(s.x0, s.y0, s.x1, s.y1);
    if (len < 1e-6) continue;
    let th = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
    if (th < 0) th += Math.PI;
    if (th >= Math.PI - 1e-9) th -= Math.PI;
    const rho = -Math.sin(th) * s.x0 + Math.cos(th) * s.y0;
    let L = lines.find((l) => {
      let d = Math.abs(l.th - th);
      d = Math.min(d, Math.PI - d);
      return d < 0.5 * D2R && Math.abs(l.rho - rho) <= tol / 2;
    });
    if (!L) { L = { th, rho, ivs: [] }; lines.push(L); }
    const c = Math.cos(L.th), sn = Math.sin(L.th);
    const t0 = c * s.x0 + sn * s.y0, t1 = c * s.x1 + sn * s.y1;
    L.ivs.push([Math.min(t0, t1), Math.max(t0, t1)]);
  }
  const out = [];
  for (const L of lines) {
    L.ivs.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const iv of L.ivs) {
      const last = merged[merged.length - 1];
      if (last && iv[0] <= last[1] + tol / 2) last[1] = Math.max(last[1], iv[1]);
      else merged.push(iv.slice());
    }
    const c = Math.cos(L.th), sn = Math.sin(L.th);
    for (const [t0, t1] of merged) out.push([c * t0 - sn * L.rho, sn * t0 + c * L.rho, c * t1 - sn * L.rho, sn * t1 + c * L.rho]);
  }
  return out;
}

function translateToOrigin(S) {
  if (!S.length) return S;
  let mx = Infinity, my = Infinity;
  for (const s of S) { mx = Math.min(mx, s[0], s[2]); my = Math.min(my, s[1], s[3]); }
  return S.map((s) => [s[0] - mx, s[1] - my, s[2] - mx, s[3] - my]);
}

/**
 * 퀘스트 정의에서 쓰는 선언형 규칙 실행. 예:
 *   [{ type: 'shape', shape: 'regular', n: 4 }, { type: 'colors', min: 3 }, { type: 'text', includes: '안녕' }]
 */
export function runRules(a, rules) {
  const results = [];
  for (const r of rules) {
    let res;
    if (r.type === 'shape') res = findShape(a, r);
    else if (r.type === 'circles') {
      const cs = findCircles(a).filter((c) => c.extent >= (r.minExtent ?? 350) && (r.radius == null || Math.abs(c.r - r.radius) <= (r.tol ?? 3)));
      res = { ok: cs.length >= (r.min ?? 1), reasons: cs.length >= (r.min ?? 1) ? [] : [`원을 ${r.min ?? 1}개 이상 그려야 해요 (지금 ${cs.length}개).`], found: cs.length };
    } else if (r.type === 'colors') {
      const n = colorsUsed(a).length;
      res = { ok: n >= r.min, reasons: n >= r.min ? [] : [`색을 ${r.min}가지 이상 써 보세요 (지금 ${n}가지).`], found: n };
    } else if (r.type === 'text') {
      const ok = a.texts.some((t) => String(t.text).includes(r.includes));
      res = { ok, reasons: ok ? [] : [`write()로 "${r.includes}"를 써야 해요.`] };
    } else if (r.type === 'segments') {
      const n = mergedSegments(a.segments).length;
      res = { ok: n >= (r.min ?? 0) && n <= (r.max ?? Infinity), reasons: [], found: n };
      if (!res.ok) res.reasons.push(`선의 개수가 맞지 않아요 (지금 ${n}개).`);
    } else if (r.type === 'turtles') {
      const n = a.turtles.length;
      res = { ok: n >= r.min, reasons: n >= r.min ? [] : [`거북이가 ${r.min}마리 이상 필요해요.`], found: n };
    } else res = { ok: false, reasons: [`모르는 규칙: ${r.type}`] };
    results.push({ rule: r, ...res });
  }
  return { ok: results.every((x) => x.ok), results };
}
