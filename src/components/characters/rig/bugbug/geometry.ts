/** 버그버그: 파라미터 → SVG 속성 (순수 함수). 기존 `BugBugSvg`의 좌표·생김새를 부위로 나눴다 */
import { browNums, browPath, mouthNums, mouthPath } from '../core/face';
import { clamp, n1, n2, n3, pt, smooth } from '../core/math';
import type { Geo, GeoCtx, Params } from '../core/types';
import { STYLE_RULES } from '../style';

/** 다리: 엉덩이(등딱지 가장자리) · 쉬는 방향(라디안) · 길이 */
export const LEGS: { side: 'L' | 'R'; hx: number; hy: number; a: number }[] = [
  { side: 'L', hx: 38, hy: 68, a: Math.atan2(-8, -14) },
  { side: 'L', hx: 36, hy: 80, a: Math.PI },
  { side: 'L', hx: 38, hy: 92, a: Math.atan2(8, -14) },
  { side: 'R', hx: 90, hy: 68, a: Math.atan2(-8, 14) },
  { side: 'R', hx: 92, hy: 80, a: 0 },
  { side: 'R', hx: 90, hy: 92, a: Math.atan2(8, 14) },
];
const LEG_LEN = 16;

const EYE_L = 55.5;
const EYE_R = 72.5;
const EYE_Y = 43;
const MOUTH = { x: 64, y: 53.5, w: 6.5 };
const BROW = { lx: EYE_L, rx: EYE_R, y: 34.5, w: 4.2 };

export function bugbugGeometry(p: Params, ctx: GeoCtx): Geo {
  const g: Geo = {};
  g.root = {
    transform: `translate(${n2(p.rootX)} ${n2(p.rootY)}) rotate(${n2(p.rootRot)} 64 78) translate(64 108) scale(${n3(p.sqX)} ${n3(p.sqY)}) translate(-64 -108)`,
  };
  const lift = clamp(-p.rootY / 28);
  g.shadow = {
    cx: n2(64 + p.rootX),
    rx: n2(32 * (1 - 0.38 * lift) * p.sqX),
    opacity: n3(0.2 * (1 - 0.55 * lift)),
  };
  g.halo = {
    opacity: n3(clamp(p.halo) * ctx.tuning.haloOpacity),
    fill: ctx.haloColor,
  };

  // ── 다리 6개: 삼각 보행(L0·R1·L2 ↔ R0·L1·R2 엇갈림) + 버둥 + 앞다리 흔들기
  LEGS.forEach((leg, i) => {
    const tripod = i === 0 || i === 2 || i === 4 ? 0 : Math.PI;
    const mirror = leg.side === 'L' ? 1 : -1;
    let off =
      0.32 *
      clamp(p.legAmp, 0, 1.2) *
      Math.sin(2 * Math.PI * p.legPhase + tripod);
    off +=
      0.55 * p.legFlail * Math.sin(2 * Math.PI * p.legPhase * 1.7 + i * 1.3);
    let a = leg.a + off * mirror;
    let len = LEG_LEN;
    if (i === 3) {
      // 화해: 오른쪽 앞다리를 들어 흔든다
      a += (p.waveRot * Math.PI) / 180;
      len += 3 * clamp(p.legWave);
    }
    const fx = leg.hx + len * Math.cos(a);
    const fy = leg.hy + len * Math.sin(a);
    // 무릎: 가운데에서 위쪽으로 살짝 굽힘
    const mx = (leg.hx + fx) / 2;
    const my = (leg.hy + fy) / 2;
    const nx = -(fy - leg.hy) / len;
    const ny = (fx - leg.hx) / len;
    const bend = 3.6 * mirror;
    g[`leg${i}`] = {
      d: `M${pt(leg.hx, leg.hy)} Q${pt(mx + nx * bend, my + ny * bend)} ${pt(fx, fy)}`,
    };
  });

  // ── 등딱지 좌우 반쪽 (위쪽 경첩에서 열림) + 날개
  const open = clamp(p.shellOpen, 0, 1.3);
  g.shellL = { transform: `rotate(${n2(-open * 26)} 64 56)` };
  g.shellR = { transform: `rotate(${n2(open * 26)} 64 56)` };
  g.wingL = {
    opacity: n3(smooth(0.05, 0.5, open) * 0.85),
    transform: `rotate(${n2(18 + open * 16)} 50 76)`,
  };
  g.wingR = {
    opacity: n3(smooth(0.05, 0.5, open) * 0.85),
    transform: `rotate(${n2(-18 - open * 16)} 78 76)`,
  };

  // ── 머리·더듬이
  g.head = {
    transform: `translate(${n2(p.headX)} ${n2(p.headY)}) rotate(${n2(p.headRot)} 64 62)`,
  };
  g.antL = { transform: `rotate(${n2(p.antL)} 52 33)` };
  g.antR = { transform: `rotate(${n2(p.antR)} 76 33)` };
  g.face = { transform: `translate(${n2(p.faceX)} ${n2(p.faceY)})` };
  g.cheekL = {
    rx: n2(5 + 1.2 * p.blush),
    ry: n2(3 + 0.6 * p.blush),
    opacity: n3(0.88 + 0.12 * clamp(p.blush)),
  };
  g.cheekR = { ...g.cheekL };

  // ── 눈 (흰자 + 눈동자). 웃는 눈 ^ · 감은 눈 ‿ · 질끈 > <
  const squint = clamp(p.eyeSquint);
  for (const side of ['L', 'R'] as const) {
    const ex = side === 'L' ? EYE_L : EYE_R;
    const happy = clamp(
      side === 'L' ? Math.max(p.eyeHappy, p.eyeWinkL) : p.eyeHappy,
    );
    const sleep = clamp(p.eyeSleep);
    const closed = Math.max(happy, sleep, squint);
    const open = clamp(p.eyeOpen, 0, 1.2);
    const s = p.eyeScale;
    const rx = 6 * s;
    const ry = Math.max(0.4, 6.6 * s * open * (1 - 0.92 * closed));
    const cx = ex + p.lookX * 1.1;
    const cy = EYE_Y + p.lookY * 0.8;
    const vis = 1 - smooth(0.7, 1, closed);
    g[`eye${side}`] = {
      cx: n2(cx),
      cy: n2(cy),
      rx: n2(rx),
      ry: n2(ry),
      opacity: n3(vis),
    };
    const pr = 2.9 * s;
    const px = cx + p.lookX * 2.4;
    const py = cy + p.lookY * 2.2;
    g[`pup${side}`] = {
      cx: n2(px),
      cy: n2(py),
      rx: n2(pr),
      ry: n2(Math.min(pr, ry * 0.9)),
      opacity: n3(vis),
    };
    g[`hl${side}`] = {
      cx: n2(px + 1.1 * s),
      cy: n2(py - 1.2 * s),
      r: n2(1.15 * s),
      opacity: n3(vis * clamp((ry - 1.6) / 2)),
    };
    const sleepW = happy + sleep > 0 ? sleep / (happy + sleep) : 0;
    const ax = ex + p.lookX * 0.8;
    g[`arc${side}`] = {
      d: `M${pt(ax - 5, 44)} Q${pt(ax, 38.4 + 10.4 * sleepW)} ${pt(ax + 5, 44)}`,
      opacity: n3(smooth(0.3, 0.8, Math.max(happy, sleep)) * (1 - squint)),
    };
    g[`sq${side}`] = { opacity: n3(smooth(0.2, 0.8, squint)) };
    const b = browNums(p, side, BROW);
    g[`brow${side}`] = { d: browPath(b), opacity: n3(b.op) };
  }

  // ── 입 + 장난 송곳니
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
  const topY = (m.L[1] + m.R[1]) / 2 + (m.c1[1] - (m.L[1] + m.R[1]) / 2) * 0.72;
  g.tooth = {
    transform: `translate(${n2(m.tx + 2.6)} ${n2(topY)})`,
    opacity: n3(clamp(p.fang) * smooth(0.12, 0.3, p.mouthOpen)),
  };

  // ── 소품
  const mg = Math.max(0, p.magnify);
  g.mag = {
    transform: `translate(${n2(100 + p.lookX * 7)} ${n2(48 + p.lookY * 3)}) rotate(${n1(p.magRot)}) scale(${n3(mg)})`,
    opacity: n3(clamp(mg * 1.5)),
  };
  const exq = Math.max(0, p.exclaim);
  g.exclaim = {
    transform: `translate(${n2(98 + p.rootX)} 16) rotate(${n1(p.exRot)}) scale(${n3(exq)})`,
    opacity: n3(clamp(exq * 1.5)),
  };
  const dz = clamp(p.dizzy);
  for (let i = 0; i < 3; i++) {
    const ang = 2 * Math.PI * (p.dizzyPhase + i / 3);
    const front = 0.5 + 0.5 * Math.sin(ang);
    g[`dz${i}`] = {
      transform: `translate(${n2(64 + p.rootX + 21 * Math.cos(ang))} ${n2(24 + 5.5 * Math.sin(ang))}) scale(${n3(dz * (0.65 + 0.35 * front))})`,
      opacity: n3(dz * (0.55 + 0.45 * front)),
    };
  }
  const bd = Math.max(0, p.badge);
  g.badge = {
    transform: `translate(102 24) scale(${n3(bd)})`,
    opacity: n3(clamp(bd * 1.5)),
  };
  const ph = clamp(p.puffPhase);
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * (20 + 14 * ph);
    g[`puff${i}`] = {
      cx: n2(64 + dx + p.rootX),
      cy: n2(110 - 3 * ph - (i === 1 ? 2 : 0)),
      r: n2(2 + 4.5 * ph),
      opacity: n3(ph >= 1 ? 0 : 0.55 * (1 - ph)),
    };
  }

  g.boil = { seed: String(Math.floor(p.boilSeed)) };
  g.boilMap = {
    scale: n2(ctx.tuning.paper ?? STYLE_RULES[ctx.style].paper),
  };
  return g;
}
