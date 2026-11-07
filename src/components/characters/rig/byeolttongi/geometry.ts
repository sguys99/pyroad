/** 별똥이: 파라미터 → SVG 속성 (순수 함수). 둥근 별 몸을 매 프레임 계산해 팔(양옆 끝)·다리(아래 끝)를 움직인다 */
import { browNums, browPath, mouthNums, mouthPath } from '../core/face';
import { clamp, n1, n2, n3, pt, smooth } from '../core/math';
import type { Geo, GeoCtx, Params } from '../core/types';
import { STYLE_RULES } from '../style';

export const CX = 64;
export const CY = 60;
const R = 46;
const RIN = 22.5;

const EYE_L = 56;
const EYE_R = 72;
const EYE_Y = 56;
const MOUTH = { x: 64, y: 65, w: 5.6 };
const BROW = { lx: EYE_L, rx: EYE_R, y: 47.5, w: 3.6 };

export const TWINKLE_POS = [
  [16, 28, 1],
  [112, 22, 0.8],
  [12, 78, 0.7],
  [116, 72, 0.9],
];
const DUST = [
  { x: 44, y: 103, dx: -0.8, dy: 0.6 },
  { x: 64, y: 106, dx: 0, dy: 1 },
  { x: 84, y: 103, dx: 0.8, dy: 0.6 },
];

/** 끝 각도(도): 위 · 오른팔 · 오른다리 · 왼다리 · 왼팔 */
export function tipAngles(p: Params): number[] {
  const wig = (p.armWiggle ?? 0) * 40;
  const up = 20;
  return [
    -90,
    -18 - up * p.armR - 16 * p.reach - wig,
    54 - 12 * p.legSpread,
    126 + 12 * p.legSpread,
    198 + up * p.armL + 16 * p.reach + wig,
  ];
}

/** 둥근 별 경로 (끝 각도를 받아 안쪽 꼭짓점은 이웃의 가운데로) */
export function starBody(
  angles: number[],
  scale: number,
  round: number,
): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = angles[i];
    let b = angles[(i + 1) % 5];
    if (b < a) b += 360;
    const m = (a + b) / 2;
    const ra = (a * Math.PI) / 180;
    const rm = (m * Math.PI) / 180;
    pts.push([CX + R * scale * Math.cos(ra), CY + R * scale * Math.sin(ra)]);
    pts.push([
      CX + RIN * scale * Math.cos(rm),
      CY + RIN * scale * Math.sin(rm),
    ]);
  }
  let d = '';
  for (let i = 0; i < 10; i++) {
    const [px, py] = pts[(i + 9) % 10];
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % 10];
    const k = i % 2 ? round * 0.55 : round;
    d += `${i ? 'L' : 'M'}${pt(x + (px - x) * k, y + (py - y) * k)} Q${pt(x, y)} ${pt(x + (nx - x) * k, y + (ny - y) * k)} `;
  }
  return d + 'Z';
}

export function byeolttongiGeometry(p: Params, ctx: GeoCtx): Geo {
  const g: Geo = {};
  const mx = p.rootX + p.flyX;
  const my = p.rootY + p.flyY;
  const st = p.stretch;
  const dir = p.stretchDir;
  g.move = { transform: `translate(${n2(mx)} ${n2(my)})` };
  g.body = {
    transform: `rotate(${n1(dir)} ${CX} ${CY}) scale(${n3(1 + st)} ${n3(1 - 0.45 * st)}) rotate(${n1(-dir)} ${CX} ${CY}) rotate(${n2(p.rootRot)} ${CX} ${CY}) translate(${CX} 100) scale(${n3(p.sqX)} ${n3(p.sqY)}) translate(${-CX} -100)`,
  };
  // 그림자: 높이 뜰수록 작고 옅게 (날아오는 중에는 멀리 있어 거의 안 보임)
  const lift = clamp((-my + 4) / 40);
  g.shadow = {
    cx: n2(64 + mx),
    rx: n2(24 * (1 - 0.45 * lift) * p.sqX),
    opacity: n3(0.16 * (1 - 0.7 * lift)),
  };
  g.halo = {
    opacity: n3(clamp(p.halo) * ctx.tuning.haloOpacity),
    fill: ctx.haloColor,
  };

  const ang = tipAngles(p);
  g.star = { d: starBody(ang, 1, 0.24) };
  g.inner = { d: starBody(ang, 0.6, 0.3) };

  // 꼬리 빛 (몸 가운데에서 지나온 길로)
  const tr = clamp(p.trail);
  const tdx = p.tx2 - p.tx1;
  const tdy = p.ty2 - p.ty1;
  const tlen = Math.hypot(p.tx2, p.ty2);
  g.trailOut = {
    d: `M${CX} ${CY} Q${pt(CX + p.tx1, CY + p.ty1)} ${pt(CX + p.tx2, CY + p.ty2)}`,
    opacity: n3(tr * 0.75 * smooth(4, 18, tlen)),
  };
  g.trailIn = { ...g.trailOut, opacity: n3(tr * smooth(4, 18, tlen)) };
  for (let i = 0; i < 3; i++) {
    const u = 0.45 + i * 0.25;
    g[`td${i}`] = {
      cx: n2(CX + p.tx1 * u * 1.3 + tdx * u * u * 0.4),
      cy: n2(CY + p.ty1 * u * 1.3 + tdy * u * u * 0.4 + (i - 1) * 2),
      opacity: n3(
        tr *
          smooth(4, 18, tlen) *
          (0.5 + 0.5 * Math.sin(2 * Math.PI * (p.twPhase * 1.6 + i / 3))),
      ),
    };
  }

  // 얼굴
  g.face = { transform: `translate(${n2(p.faceX)} ${n2(p.faceY)})` };
  g.cheekL = {
    rx: n2(4.5 + 1 * p.blush),
    ry: n2(2.6 + 0.5 * p.blush),
    opacity: n3(0.88 + 0.12 * clamp(p.blush)),
  };
  g.cheekR = { ...g.cheekL };
  for (const side of ['L', 'R'] as const) {
    const ex = side === 'L' ? EYE_L : EYE_R;
    const happy = clamp(p.eyeHappy);
    const open = clamp(p.eyeOpen, 0, 1.2);
    const s = p.eyeScale;
    const ry = Math.max(0.35, 5.4 * s * open * (1 - 0.9 * happy));
    const cx = ex + p.lookX * 1.8;
    const cy = EYE_Y + p.lookY * 1.5 + happy;
    g[`eye${side}`] = {
      cx: n2(cx),
      cy: n2(cy),
      rx: n2(4.6 * s),
      ry: n2(ry),
      opacity: n3(1 - smooth(0.7, 1, happy)),
    };
    g[`hl${side}`] = {
      cx: n2(cx + 1.4 * s),
      cy: n2(cy - 1.6 * s * Math.min(1, open)),
      r: n2(1.8 * s),
      opacity: n3(clamp((ry - 1.4) / 2) * (1 - happy)),
    };
    const ax = ex + p.lookX * 1;
    g[`arc${side}`] = {
      d: `M${pt(ax - 4.6, 57)} Q${pt(ax, 51.6)} ${pt(ax + 4.6, 57)}`,
      opacity: n3(smooth(0.3, 0.8, happy)),
    };
    const b = browNums(p, side, BROW);
    g[`brow${side}`] = { d: browPath(b), opacity: n3(b.op) };
  }
  const m = mouthNums(p, MOUTH);
  const md = mouthPath(m);
  g.mouth = { d: md };
  g.mouthClip = { d: md };
  g.tongue = {
    cx: n2(m.tx),
    cy: n2(m.ty),
    rx: n2(m.trx),
    ry: n2(m.try_),
    opacity: n3(m.top),
  };

  // 코인 (보상 건네기)
  const co = clamp(p.coin) * clamp(p.coinOp);
  g.coin = {
    transform: `translate(${n2(p.coinX)} ${n2(p.coinY)}) scale(${n3(p.coinS * Math.max(0.15, Math.abs(p.coinFlip)) * clamp(p.coin * 1.4))} ${n3(p.coinS * clamp(p.coin * 1.4))})`,
    opacity: n3(co),
  };

  // 반짝이 4개
  const tw = clamp(p.twinkle);
  TWINKLE_POS.forEach(([x, y, s], i) => {
    const k = 0.55 + 0.45 * Math.sin(2 * Math.PI * (p.twPhase + i * 0.29));
    g[`tw${i}`] = {
      transform: `translate(${x} ${y}) rotate(${n1(p.twPhase * 60 + i * 20)}) scale(${n3(s * tw * k)})`,
      opacity: n3(clamp(tw * 1.5) * (0.4 + 0.6 * k)),
    };
  });

  // 착지 먼지 선
  const ph = clamp(p.dustPhase);
  const dv = clamp(p.dust);
  DUST.forEach((d, i) => {
    const a = 3 + ph * 7;
    const b = a + 7 * (1 - 0.5 * ph);
    g[`dust${i}`] = {
      d: `M${pt(d.x + d.dx * a + mx, d.y + d.dy * a)} L${pt(d.x + d.dx * b + mx, d.y + d.dy * b)}`,
      opacity: n3(dv * (ph >= 1 ? 0 : 0.75 * (1 - ph))),
    };
  });

  g.boil = { seed: String(Math.floor(p.boilSeed)) };
  g.boilMap = {
    scale: n2(ctx.tuning.paper ?? STYLE_RULES[ctx.style].paper),
  };
  return g;
}
