/**
 * 파이뱀: 파라미터 → SVG 속성 (순수 함수).
 * 같은 함수를 ① 라이브 리그 매 프레임 ② SSR 첫 렌더 ③ 공유 카드·아바타 정적 렌더에 그대로 쓴다.
 */
import {
  browNums,
  browPath,
  mouthNums,
  mouthPath,
  starPath,
} from '../core/face';
import { clamp, n1, n2, n3, pt, smooth } from '../core/math';
import type { Geo, GeoCtx, Params } from '../core/types';
import { STYLE_RULES } from '../style';

// 꼬리 키 모양 (base, c1, c2, mid, c3, c4, tip)
const TAIL_REST = [28, 84, 16, 76, 10, 62, 18, 52, 24, 44, 34, 46, 32, 54];
const TAIL_RAISED = [28, 84, 14, 74, 6, 54, 10, 38, 13, 28, 20, 21, 27, 20];
const TAIL_CHIN = [28, 84, 18, 80, 18, 68, 27, 63, 33, 59, 39, 60, 42, 58];
const TAIL_DROOP = [28, 84, 20, 94, 16, 102, 9, 105, 4, 108, -1, 107, -1, 102];
/** 설명: 손가락처럼 위로 쭉 (예전 TeachingAccessory 지시봉 대신) */
const TAIL_POINT = [28, 84, 18, 77, 12, 66, 10, 54, 8, 43, 8, 34, 10, 26];

export const SPARK_POS = [
  [20, 14],
  [108, 10],
  [8, 46],
  [119, 42],
];
export const NOTE_POS = [
  [102, 44],
  [114, 30],
];
/** Zzz: 큰 Z부터 작은 z로 오른쪽 위 (예전 `<text>` 자리) */
export const ZZZ_POS = [
  [94, 22, 1],
  [103, 13, 0.78],
  [110, 6, 0.58],
];

const EYE_L = 52;
const EYE_R = 76;
const EYE_Y = 40;
const MOUTH = { x: 64, y: 53, w: 8 };
const BROW = { lx: EYE_L, rx: EYE_R, y: 30.5, w: 5 };

export function pybaemGeometry(p: Params, ctx: GeoCtx): Geo {
  const g: Geo = {};

  // ── 몸 전체: 위치·기울기·찌그러짐(바닥 피벗)
  g.root = {
    transform: `translate(${n2(p.rootX)} ${n2(p.rootY)}) rotate(${n2(p.rootRot)} 64 108) translate(64 108) scale(${n3(p.sqX)} ${n3(p.sqY)}) translate(-64 -108)`,
  };
  const lift = clamp(-p.rootY / 28);
  g.shadow = {
    cx: n2(64 + p.rootX),
    rx: n2(36 * (1 - 0.38 * lift) * p.sqX),
    opacity: n3(0.2 * (1 - 0.55 * lift)),
  };
  g.halo = {
    opacity: n3(clamp(p.halo) * ctx.tuning.haloOpacity),
    fill: ctx.haloColor,
  };

  // ── 꼬리 (블렌드 셰이프 + 회전)
  const tp = tailPts(p);
  g.tail = {
    d: `M${pt(tp[0], tp[1])} C${pt(tp[2], tp[3])} ${pt(tp[4], tp[5])} ${pt(tp[6], tp[7])} C${pt(tp[8], tp[9])} ${pt(tp[10], tp[11])} ${pt(tp[12], tp[13])}`,
  };
  g.tailIn = g.tail;
  g.tailTip = { cx: n2(tp[12]), cy: n2(tp[13]) };

  // ── 머리·얼굴
  g.head = {
    transform: `translate(${n2(p.headX)} ${n2(p.headY)}) rotate(${n2(p.headRot)} 64 66)`,
  };
  g.face = { transform: `translate(${n2(p.faceX)} ${n2(p.faceY)})` };
  g.cheekL = {
    rx: n2(6 + 1.3 * p.blush),
    ry: n2(4 + 0.7 * p.blush),
    cy: n2(50 + 0.8 * p.eyeHappy),
    opacity: n3(0.88 + 0.12 * clamp(p.blush)),
  };
  g.cheekR = { ...g.cheekL };

  for (const side of ['L', 'R'] as const) {
    const e = eyeNums(p, side);
    g[`eye${side}`] = {
      cx: n2(e.cx),
      cy: n2(e.cy),
      rx: n2(e.rx),
      ry: n2(e.ry),
      opacity: n3(e.op),
    };
    g[`hl${side}`] = {
      cx: n2(e.hx),
      cy: n2(e.hy),
      r: n2(e.hr),
      opacity: n3(e.hop),
    };
    g[`arc${side}`] = {
      d: `M${pt(e.ax - 5.2, 41)} Q${pt(e.ax, e.acy)} ${pt(e.ax + 5.2, 41)}`,
      opacity: n3(e.aop),
    };
    // 처진 눈꺼풀 (바깥쪽이 더 내려옴) → clipPath 다각형. 눈꺼풀이 없으면 clip을 빼서 래스터 비용을 줄인다
    g[`clip${side}`] = {
      points: e.clip.map(([x, y]) => `${n2(x)},${n2(y)}`).join(' '),
    };
    g[`eyeG${side}`] = {
      clipPath: p.lidSad > 0.01 ? `url(#${ctx.idp}clip${side})` : 'none',
    };
    // 별 눈 (뿌듯)
    const st = clamp(p.eyeStar);
    g[`star${side}`] = {
      transform: `translate(${n2(e.cx)} ${n2(e.cy)}) scale(${n3(0.3 + 0.7 * st)})`,
      opacity: n3(smooth(0.05, 0.6, st)),
    };
    const b = browNums(p, side, BROW);
    g[`brow${side}`] = { d: browPath(b), opacity: n3(b.op) };
  }

  // ── 입
  const m = mouthNums(p, MOUTH);
  const mouthD = mouthPath(m);
  g.mouth = { d: mouthD };
  g.mouthClip = { d: mouthD };
  g.tongue = {
    cx: n2(m.tx),
    cy: n2(m.ty),
    rx: n2(m.trx),
    ry: n2(m.try_),
    opacity: n3(m.top),
  };

  // ── 소품: 반짝이
  SPARK_POS.forEach(([x, y], i) => {
    const tw = 0.62 + 0.38 * Math.sin(2 * Math.PI * (p.sparkPhase + i / 4));
    const sc = Math.max(0, p.spark) * tw;
    g[`spark${i}`] = {
      transform: `translate(${x} ${y}) rotate(${n1(p.sparkPhase * 90 + i * 22)}) scale(${n3(sc)})`,
      opacity: n3(clamp(p.spark * 1.6)),
    };
  });
  // ── 소품: 생각 풍선 (작은 방울 → 큰 구름 순서로 톡톡)
  const th = Math.max(0, p.think);
  const s0 = clamp(th * 3, 0, 1.3);
  const s1 = clamp(th * 3 - 1, 0, 1.3);
  const s2 = clamp(th * 3 - 2, 0, 1.3);
  g.bub0 = {
    transform: `translate(91 22) scale(${n3(s0)})`,
    opacity: n3(clamp(s0 * 2)),
  };
  g.bub1 = {
    transform: `translate(99 11) scale(${n3(s1)})`,
    opacity: n3(clamp(s1 * 2)),
  };
  g.cloud = {
    transform: `translate(116 -8) scale(${n3(s2)})`,
    opacity: n3(clamp(s2 * 2)),
  };
  for (let i = 0; i < 3; i++) {
    g[`dot${i}`] = {
      opacity: n3(
        0.25 +
          0.75 * Math.max(0, Math.sin(2 * Math.PI * (p.dotsPhase - i / 3))),
      ),
    };
  }
  // ── 소품: 음표
  NOTE_POS.forEach(([x, y], i) => {
    const ph = (((p.notesPhase + i * 0.5) % 1) + 1) % 1;
    const dx = Math.sin(ph * 2 * Math.PI) * 4;
    const dy = -ph * 26;
    g[`note${i}`] = {
      transform: `translate(${n2(x + dx)} ${n2(y + dy)}) rotate(${n1(Math.sin(ph * 2 * Math.PI) * 12)})`,
      opacity: n3(clamp(p.notes) * Math.sin(Math.PI * ph)),
    };
  });
  // ── 소품: 눈물
  const tph = p.tearPhase % 1;
  const tearVis =
    clamp(p.tear) *
    (tph < 0.08 ? tph / 0.08 : tph > 0.82 ? (1 - tph) / 0.18 : 1);
  g.tear = {
    transform: `translate(${n2(46.5 - tph * 1.5 + p.lookX * 1.5)} ${n2(45.5 + 12 * Math.pow(tph, 1.6))}) scale(${n3(0.55 + 0.45 * Math.min(1, tph * 3))})`,
    opacity: n3(tearVis),
  };
  // ── 소품: Zzz (경로, `<text>` 금지: P0-10) — 큰 Z부터 차례로 숨 쉬듯
  const zz = clamp(p.zzz);
  ZZZ_POS.forEach(([x, y, s], i) => {
    const w = Math.sin(2 * Math.PI * (p.zzzPhase - i / 3));
    g[`zzz${i}`] = {
      transform: `translate(${n2(x + w * 0.8)} ${n2(y - w * 1.6)}) scale(${n3(s * (0.4 + 0.6 * zz))})`,
      opacity: n3(zz * (0.85 - 0.22 * i) * (0.8 + 0.2 * w)),
    };
  });
  // ── 소품: 물음표 (경로)
  const q = Math.max(0, p.qmark);
  g.qmark = {
    transform: `translate(96 20) rotate(${n1(p.qmarkRot)}) scale(${n3(q)})`,
    opacity: n3(clamp(q * 1.5)),
  };

  // ── 코스튬: 모자(머리 기준 + 흔들림), 망토 자락
  g.hat = { transform: `rotate(${n2(p.hatRot)} 64 24)` };
  const sw = p.capeSwing;
  g.cape = {
    d: `M44 58 C32 60 20 74 ${pt(13 + sw * 0.6, 103)} Q${pt(24 + sw, 99 + Math.abs(sw) * 0.3)} ${pt(34 + sw, 106)} Q${pt(44 + sw, 100)} ${pt(54 + sw * 0.8, 104)} L${pt(74 + sw * 0.8, 104)} Q${pt(84 + sw, 100)} ${pt(94 + sw, 106)} Q${pt(104 + sw, 99 + Math.abs(sw) * 0.3)} ${pt(115 + sw * 0.6, 103)} C108 74 96 60 84 58Z`,
  };
  // ── 종이 결 필터: 선 떨림 seed · 변위
  g.boil = { seed: String(Math.floor(p.boilSeed)) };
  g.boilMap = {
    scale: n2(ctx.tuning.paper ?? STYLE_RULES[ctx.style].paper),
  };
  return g;
}

// ───────── 숫자 기하 (SVG 문자열 없이)
export function tailPts(p: Params): number[] {
  const tail = TAIL_REST.map(
    (v, i) =>
      v +
      p.tailRaise * (TAIL_RAISED[i] - v) +
      p.tailChin * (TAIL_CHIN[i] - v) +
      p.tailDroop * (TAIL_DROOP[i] - v) +
      p.tailPoint * (TAIL_POINT[i] - v),
  );
  const ang = (p.tailRot * Math.PI) / 180;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const bx = tail[0];
  const by = tail[1];
  const tp: number[] = [];
  for (let i = 0; i < tail.length; i += 2) {
    const dx = tail[i] - bx;
    const dy = tail[i + 1] - by;
    tp.push(bx + dx * ca - dy * sa, by + dx * sa + dy * ca);
  }
  return tp;
}

export function eyeNums(p: Params, side: 'L' | 'R') {
  // 윙크(설명)는 오른쪽 눈만 웃는 눈, 잠은 아래로 감은 눈
  const happy = clamp(
    side === 'R' ? Math.max(p.eyeHappy, p.eyeWink) : p.eyeHappy,
  );
  const sleep = clamp(p.eyeSleep);
  const closed = Math.max(happy, sleep);
  const star = clamp(p.eyeStar);
  const open = clamp(p.eyeOpen, 0, 1.2);
  const ex = side === 'L' ? EYE_L : EYE_R;
  const ey = EYE_Y;
  // 갸우뚱: 짝눈 (왼쪽 크게, 오른쪽 작게)
  const asym = clamp(p.eyeAsym) * (side === 'L' ? 0.14 : -0.2);
  const s = p.eyeScale * (1 + asym);
  const rx = 5 * s * (1 + 0.08 * happy);
  const ry = Math.max(0.35, 5.5 * s * open * (1 - 0.9 * closed));
  const cx = ex + p.lookX * 2.2;
  const cy = ey + p.lookY * 1.8 + 1.2 * happy;
  const outer = side === 'L' ? ex - 9 : ex + 9;
  const inner = side === 'L' ? ex + 9 : ex - 9;
  const top = cy - 7 * s;
  const sleepW = closed > 0 ? sleep / (happy + sleep) : 0;
  return {
    cx,
    cy,
    rx,
    ry,
    op: (1 - smooth(0.7, 1, closed)) * (1 - smooth(0.05, 0.5, star)),
    hx: cx + 1.6 * s,
    hy: cy - 1.7 * s * Math.min(1, open),
    hr: 2 * s,
    hop: clamp((ry - 1.4) / 2) * (1 - closed) * (1 - star),
    ax: ex + p.lookX * 1.2,
    // 웃는 눈 ^ (위로 볼록) ↔ 잠든 눈 ‿ (아래로 볼록)
    acy: 35.2 + 9.6 * sleepW,
    aop: smooth(0.3, 0.8, closed),
    clip: [
      [outer, top + p.lidSad * 6],
      [inner, top + p.lidSad * 2],
      [inner, cy + 9],
      [outer, cy + 9],
    ] as [number, number][],
  };
}

/** 별 눈 모양 (눈 중심 기준) */
export const STAR_EYE = starPath(0, 0, 7.2, 3.3, 0.16);
