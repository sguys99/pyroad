// 월드맵 (#world) + 스테이지 퀘스트 고르기 (#stage = 같은 지도 위에 바텀시트/오른쪽 패널)
// 바다 위 섬 7개(스테이지 = 섬 위 랜드마크), 섬 사이 나무다리(완료)·징검돌(잠김), 파이뱀이 길을 따라 통통 점프.
// 넓은 화면(≥900px)은 가로 지도, 좁은 화면은 세로 지도. 둘 다 같은 섬·랜드마크 컴포넌트를 쓴다.
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { STAGES } from '../shared/content';
import { goScreen } from '../shared/app';
import { Icon, RewardIcon } from '../shared/icons';
import { getMotion, play, springTiming, tierDuration, useMotion } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { CloudShape, tone } from './clay';
import { Island, LANDMARKS, Landmark, Palm, WorldScene } from './scenes';
import { CURRENT_STAGE, questStars, setStore, stageStars, stageStatus, useStore } from './store';
import { ClayButton, Hud, Progress, Sheet, Stars, toast } from './ui';
import { Seq, burst } from './seq';
import { EASING } from '../shared/tokens';

export interface Layout {
  w: number;
  h: number;
  nodes: [number, number][];
  rx: number;
  ry: number;
  lm: number;
  py: number;
  deco: { palms: [number, number, number][]; bars: [number, number, number][]; boat: [number, number]; waves: [number, number][] };
}

const WIDE: Layout = {
  w: 1200,
  h: 760,
  nodes: [
    [150, 560],
    [340, 360],
    [560, 560],
    [690, 290],
    [880, 540],
    [950, 215],
    [1055, 455],
  ],
  rx: 108,
  ry: 34,
  lm: 1.05,
  py: 112,
  deco: {
    palms: [],
    bars: [
      [120, 230, 40],
      [470, 150, 30],
      [760, 680, 46],
      [1120, 690, 30],
    ],
    boat: [300, 680],
    waves: [
      [60, 400],
      [250, 230],
      [430, 300],
      [520, 700],
      [640, 130],
      [800, 380],
      [1000, 620],
      [1150, 300],
      [820, 110],
      [380, 520],
    ],
  },
};

const TALL: Layout = {
  w: 400,
  h: 1480,
  nodes: [
    [125, 175],
    [280, 375],
    [120, 585],
    [282, 790],
    [118, 995],
    [282, 1195],
    [200, 1385],
  ],
  rx: 88,
  ry: 29,
  lm: 0.86,
  py: 92,
  deco: {
    palms: [],
    bars: [
      [340, 120, 22],
      [40, 400, 20],
      [355, 640, 18],
      [40, 860, 22],
      [350, 1060, 18],
      [40, 1260, 20],
    ],
    boat: [330, 900],
    waves: [
      [40, 270],
      [330, 250],
      [230, 480],
      [40, 700],
      [210, 690],
      [340, 1000],
      [210, 1090],
      [60, 1130],
      [340, 1310],
      [60, 1440],
    ],
  },
};

function useWide(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

export function MapScreen({ sheet }: { sheet: boolean }) {
  const s = useStore();
  const shell = useRef<HTMLDivElement | null>(null);
  const width = useWide(shell);
  const wide = width >= 900;
  const L = wide ? WIDE : TALL;
  const [preview, setPreview] = useState<2 | 3 | null>(null);
  const done = STAGES.filter((_, i) => stageStatus(i) === 'done').length;
  const allStars = STAGES.reduce((a, _x, i) => a + stageStars(i).got, 0);
  const maxStars = STAGES.reduce((a, _x, i) => a + stageStars(i).max, 0);
  const mapRef = useRef<MapHandle | null>(null);
  const [unlock, setUnlock] = useState<{ from: number; to: number } | null>(null);
  const seqRef = useRef<Seq | null>(null);
  useEffect(() => () => seqRef.current?.cancel(), []);

  /** 지도에서 스테이지 해제 연출 보기: 3스테이지를 다 깼다고 치고 4스테이지를 연다 (P2-05) */
  const playUnlock = () => {
    seqRef.current?.cancel();
    const from = CURRENT_STAGE;
    const to = CURRENT_STAGE + 1;
    setStore({ cur: from });
    setUnlock({ from, to });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const h = mapRef.current;
        if (!h) return;
        h.setPos(from);
        h.setCur(from);
        h.root?.querySelector(`[data-node="${to}"]`)?.scrollIntoView({ block: 'center' });
        const m = getMotion();
        const seq = new Seq(m.reduced ? 'reduced' : m.tier, () => {
          h.setCur(from);
          h.setPos(from);
          h.setHop(false);
        });
        buildUnlock(seq, h, from, to);
        seq.onEnd = () => {
          setStore({ cur: to, stage: to });
          setUnlock(null);
          requestAnimationFrame(() => requestAnimationFrame(() => seq.cancel()));
        };
        seqRef.current = seq;
        seq.play();
      }),
    );
  };

  return (
    <div className="a-screen a-map-screen" ref={shell}>
      <Hud />
      <main className="a-map-main">
        <div className="a-map-head">
          <div className="a-wtabs" role="tablist" aria-label="월드">
            <button type="button" role="tab" aria-selected="true" className="a-wtab is-on">
              <span className="a-wtab-no">1</span>파이썬 섬
            </button>
            {([2, 3] as const).map((n) => (
              <button key={n} type="button" role="tab" aria-selected="false" className="a-wtab is-locked" onClick={() => setPreview(n)}>
                <Icon name="lock" size={18} />
                {n === 2 ? '코드 바다' : '메이커 시티'}
              </button>
            ))}
          </div>
          <div className="a-map-title">
            <h1>
              <span className="a-map-wno">1월드</span> 파이썬 섬
            </h1>
            <p className="a-map-progress">
              <span>
                스테이지 <b>{done}</b> / {STAGES.length} 완료
              </span>
              <span className="a-map-starsum">
                <RewardIcon kind="star" size={20} style="A" /> {allStars} / {maxStars}
              </span>
            </p>
          </div>
        </div>

        {width > 0 && <IslandMap ref={mapRef} key={wide ? 'w' : 't'} L={L} wide={wide} cur={s.cur} selected={s.stage} sheetOpen={sheet} unlock={unlock} />}

        <section className="a-next-worlds" aria-labelledby="a-nw-title">
          <h2 id="a-nw-title" className="a-h2">
            바다 건너 다음 섬
          </h2>
          <div className="a-nw-grid">
            {([2, 3] as const).map((n) => (
              <button key={n} type="button" className={`a-card a-nw-card a-nw-${n}`} onClick={() => setPreview(n)}>
                <WorldScene world={n} locked className="a-nw-scene" />
                <span className="a-nw-body">
                  <span className="a-nw-name">
                    <span className={`a-tag a-tag-w${n}`}>{n}월드</span>
                    {n === 2 ? '코드 바다 · 바다와 하늘 섬' : '메이커 시티 · 공방 섬'}
                  </span>
                  <span className="a-nw-lock">
                    <Icon name="lock" size={18} />
                    {n === 2 ? '파이썬 섬을 다 깨면 열려요' : '코드 바다를 다 깨면 열려요'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <div className="a-map-cta">
          <ClayButton
            variant="primary"
            size="lg"
            icon="play"
            onClick={() => {
              setStore({ stage: s.cur });
              goScreen('stage');
            }}
          >
            {STAGES[s.cur].title} 계속하기
          </ClayButton>
          <ClayButton variant="white" size="md" icon="unlock" onClick={playUnlock} disabled={unlock !== null}>
            {s.cur > CURRENT_STAGE ? '해제 연출 다시 보기' : '4스테이지 열기 연출 보기'}
          </ClayButton>
        </div>
      </main>

      <Sheet open={preview !== null} onClose={() => setPreview(null)} title={preview === 2 ? '2월드 코드 바다' : '3월드 메이커 시티'}>
        {preview && (
          <div className="a-preview">
            <div className="a-preview-scene">
              <WorldScene world={preview} />
              <span className="a-preview-lock">
                <Icon name="lock" size={30} />
              </span>
            </div>
            <p>
              {preview === 2
                ? '구름 위에 떠 있는 섬과 열기구가 기다려요. 배운 것을 섞어서 더 큰 문제를 풀어요.'
                : '톱니바퀴가 도는 공방 섬에서 나만의 게임과 그림을 만들어요.'}
            </p>
            <p className="a-preview-cond">
              <Icon name="flag" size={20} />
              {preview === 2 ? '파이썬 섬 7스테이지를 모두 깨면 열려요' : '코드 바다를 모두 깨면 열려요'}
            </p>
          </div>
        )}
      </Sheet>

      <StageSheet open={sheet} stage={s.stage} />
    </div>
  );
}

// ───────────── 섬 지도

export interface MapHandle {
  root: HTMLDivElement | null;
  fx: HTMLDivElement | null;
  /** viewBox 1단위 = k px */
  k: () => number;
  /** 노드 중심의 지도 안 px 좌표 */
  nodePx: (i: number) => { x: number; y: number };
  hopFrames: (from: number, to: number) => { body: Keyframe[]; shadow: Keyframe[]; dur: number };
  body: () => HTMLDivElement | null;
  shadow: () => HTMLDivElement | null;
  setPos: (i: number) => void;
  setCur: (i: number) => void;
  setHop: (v: boolean) => void;
}

/** 다리 곡선 (2차 베지어): 노드 i → i+1 */
function bridgeCurve(L: Layout, i: number) {
  const [ax, ay] = L.nodes[i];
  const [bx, by] = L.nodes[i + 1];
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const bend = (i % 2 ? 1 : -1) * len * 0.12;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  return { a: [ax, ay], c: [cx, cy], b: [bx, by], len, d: `M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}` };
}

export const IslandMap = forwardRef<
  MapHandle,
  {
    L: Layout;
    wide: boolean;
    cur: number;
    selected?: number;
    sheetOpen?: boolean;
    autoHop?: boolean;
    interactive?: boolean;
    /** 해제 연출용 겹침 요소를 그린다 (from 스테이지 완료 → to 스테이지 열림) */
    unlock?: { from: number; to: number } | null;
    /** 연출 단계 덮어쓰기 (#motion 무대의 비교 토글) */
    tier?: 'full' | 'lite' | 'minimal';
    reduced?: boolean;
  }
>(function IslandMap({ L, wide, cur: curProp, selected = 0, sheetOpen = false, autoHop = true, interactive = true, unlock = null, tier, reduced }, ref) {
  const box = useRef<HTMLDivElement | null>(null);
  const fx = useRef<HTMLDivElement | null>(null);
  const width = useWide(box);
  const k = width ? width / L.w : 1;
  const [cur, setCur] = useState(curProp);
  useEffect(() => setCur(curProp), [curProp]);
  const [pos, setPos] = useState(() => (sheetOpen ? selected : autoHop ? Math.max(0, curProp - 1) : curProp));
  const [hopping, setHopping] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const shadow = useRef<HTMLDivElement | null>(null);
  const motion = useMotion();
  const kRef = useRef(k);
  kRef.current = k;
  const status = (i: number) => stageStatus(i, cur);

  const hopFrames = (from: number, to: number, kk = kRef.current) => {
    const path: number[] = [];
    const dir = to > from ? 1 : -1;
    for (let i = from + dir; dir > 0 ? i <= to : i >= to; i += dir) path.push(i);
    const pts = [from, ...path].map((i) => L.nodes[i]);
    const hopMs = tierDuration(path.length > 2 ? 300 : 460);
    const bodyKf: Keyframe[] = [];
    const shKf: Keyframe[] = [];
    const segs = Math.max(1, pts.length - 1);
    for (let sgi = 0; sgi < pts.length - 1; sgi++) {
      const [ax, ay] = pts[sgi];
      const [bx, by] = pts[sgi + 1];
      const steps = 10;
      for (let st = sgi === 0 ? 0 : 1; st <= steps; st++) {
        const u = st / steps;
        const x = (ax + (bx - ax) * u) * kk;
        const yBase = (ay + (by - ay) * u) * kk;
        const arc = Math.sin(Math.PI * u) * (wide ? 90 : 70);
        const sq = st === steps ? 'scale(1.18, 0.82)' : st === 0 ? 'scale(1.1, 0.9)' : 'scale(0.95, 1.06)';
        const off = (sgi + u) / segs;
        bodyKf.push({ transform: `translate(${x}px, ${yBase - arc}px) ${sq}`, offset: off });
        shKf.push({ transform: `translate(${x}px, ${yBase}px) scale(${1 - Math.sin(Math.PI * u) * 0.45})`, offset: off });
      }
    }
    const [tx, ty] = L.nodes[to];
    bodyKf[bodyKf.length - 1] = { transform: `translate(${tx * kk}px, ${ty * kk}px)`, offset: 1 };
    return { body: bodyKf, shadow: shKf, dur: hopMs * segs };
  };

  useImperativeHandle(ref, () => ({
    root: box.current,
    fx: fx.current,
    k: () => kRef.current,
    nodePx: (i) => ({ x: L.nodes[i][0] * kRef.current, y: L.nodes[i][1] * kRef.current }),
    hopFrames: (a, b) => hopFrames(a, b),
    body: () => body.current,
    shadow: () => shadow.current,
    setPos,
    setCur,
    setHop: setHopping,
  }));

  /** 파이뱀이 노드를 따라 통통 점프 (transform만). 끝나면 cb */
  const hopTo = (target: number, cb?: () => void) => {
    const m = getMotion();
    if (target === pos || m.reduced || m.tier === 'minimal' || !body.current || !shadow.current || !width) {
      setPos(target);
      if (m.tier === 'minimal' && !m.reduced) play(body.current, [{ opacity: 0.2 }, { opacity: 1 }], { duration: 150 });
      cb?.();
      return;
    }
    const f = hopFrames(pos, target);
    setHopping(true);
    body.current.animate(f.body, { duration: f.dur, easing: 'linear', fill: 'forwards' });
    const a = shadow.current.animate(f.shadow, { duration: f.dur, easing: 'linear', fill: 'forwards' });
    a.finished
      .then(() => {
        setPos(target);
        setHopping(false);
        requestAnimationFrame(() => {
          body.current?.getAnimations().forEach((x) => x.cancel());
          shadow.current?.getAnimations().forEach((x) => x.cancel());
          if (getMotion().tier === 'full') {
            body.current?.querySelector('.a-py-squash')?.animate([{ transform: 'scale(1.2, 0.8)' }, { transform: 'none' }], springTiming('jellyA'));
          }
        });
        cb?.();
      })
      .catch(() => {});
  };

  // 처음 들어오면 한 칸 전 섬 → 지금 섬으로 통통 (현재 스테이지로 이동)
  useEffect(() => {
    if (!width || sheetOpen || !autoHop) return;
    const t = setTimeout(() => hopTo(curProp), 650);
    return () => clearTimeout(t);
  }, [width > 0]);

  const tap = (i: number) => {
    if (!interactive) return;
    if (status(i) === 'locked') {
      setShake(i);
      setTimeout(() => setShake(null), 500);
      toast(`아직 잠겨 있어요! ${STAGES[i - 1]?.title ?? ''}부터 깨 봐요`, 'lock');
      return;
    }
    if (hopping) return;
    hopTo(i, () => {
      setStore({ stage: i });
      goScreen('stage');
    });
  };

  const [px, py] = L.nodes[pos];
  const pyStyle = { transform: `translate(${px * k}px, ${py * k}px)` } as CSSProperties;
  const bridges = useMemo(() => L.nodes.slice(1).map((_, i) => bridgeCurve(L, i)), [L]);
  const planks = useMemo(() => {
    if (!unlock) return [];
    const c = bridgeCurve(L, unlock.from);
    const n = Math.max(6, Math.round(c.len / 30));
    const out: { x: number; y: number; r: number }[] = [];
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = (1 - u) ** 2 * c.a[0] + 2 * (1 - u) * u * c.c[0] + u * u * c.b[0];
      const y = (1 - u) ** 2 * c.a[1] + 2 * (1 - u) * u * c.c[1] + u * u * c.b[1];
      const tx = 2 * (1 - u) * (c.c[0] - c.a[0]) + 2 * u * (c.b[0] - c.c[0]);
      const ty = 2 * (1 - u) * (c.c[1] - c.a[1]) + 2 * u * (c.b[1] - c.c[1]);
      out.push({ x, y, r: (Math.atan2(ty, tx) * 180) / Math.PI + 90 });
    }
    return out;
  }, [L, unlock?.from]);

  const ringOn = !(reduced ?? motion.reduced);
  const bw = wide ? 22 : 18;
  const pw = (wide ? 26 : 22) * 0.5;

  return (
    <div className={`a-map${wide ? ' a-map-wide' : ' a-map-tall'}`}>
      <div className="a-sea" aria-hidden>
        <div className="a-sea-waves m-ambient" />
      </div>
      <div className="a-map-inner" ref={box} style={{ aspectRatio: `${L.w} / ${L.h}` }}>
        <svg className="a-map-svg" viewBox={`0 0 ${L.w} ${L.h}`} aria-hidden>
          {/* 바다 장식 */}
          {L.deco.waves.map(([x, y], i) => (
            <path key={i} d={`M${x} ${y} q9 -6 18 0 q9 6 18 0`} stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.55" />
          ))}
          {L.deco.bars.map(([x, y, r], i) => (
            <Island key={i} x={x} y={y} rx={r} ry={r * 0.32} seed={i + 20} sandOnly>
              {i % 2 === 0 && <Palm x={x + 4} y={y - 2} s={wide ? 0.85 : 0.7} flip={i % 4 === 0} />}
            </Island>
          ))}
          <g transform={`translate(${L.deco.boat[0]} ${L.deco.boat[1]})`}>
            <g className="a-amb-bob m-ambient">
              <path d="M-30 -4 H30 L20 10 H-20Z" fill="#A9703D" transform="translate(0 3)" />
              <path d="M-30 -4 H30 L20 10 H-20Z" fill="#D9A066" />
              <path d="M0 -4 V-44 L24 -12Z" fill="#fff" />
              <path d="M0 -40 L-16 -12 H0Z" fill="#FF7A6B" />
              <ellipse cx="-14" cy="0" rx="6" ry="1.6" fill="#fff" opacity="0.5" />
            </g>
          </g>

          {/* 다리(완료)·징검돌(잠김). 해제 연출 구간은 징검돌을 그리고 위에 널빤지를 하나씩 놓는다 */}
          {bridges.map((b, i) => {
            const done = i + 1 <= cur && !(unlock && unlock.from === i);
            return done ? (
              <g key={i}>
                <path d={b.d} stroke="#A9703D" strokeWidth={bw} fill="none" strokeLinecap="round" transform="translate(0 6)" />
                <path d={b.d} stroke="#D9A066" strokeWidth={bw} fill="none" strokeLinecap="round" />
                <path d={b.d} stroke="#B97E47" strokeWidth={bw} fill="none" strokeDasharray="3 11" />
                <path d={b.d} stroke="#fff" strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" transform="translate(0 -6)" />
              </g>
            ) : (
              <g key={i} data-u={unlock && unlock.from === i ? 'stones' : undefined}>
                <path d={b.d} stroke="#A9B8CA" strokeWidth={wide ? 15 : 13} fill="none" strokeLinecap="round" strokeDasharray="0.1 30" transform="translate(0 4)" />
                <path d={b.d} stroke="#E3EAF2" strokeWidth={wide ? 15 : 13} fill="none" strokeLinecap="round" strokeDasharray="0.1 30" />
              </g>
            );
          })}
          {unlock && (
            <g data-u="planks">
              {planks.map((p, i) => (
                <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${p.r})`}>
                  <g className="a-u-box a-u-center" data-u-plank="" opacity={0}>
                    <rect x={-pw} y={-6} width={pw * 2} height={14} rx={4} fill="#A9703D" transform="translate(0 4)" />
                    <rect x={-pw} y={-6} width={pw * 2} height={14} rx={4} fill="#D9A066" />
                    <rect x={-pw + 3} y={-4} width={pw * 0.8} height={3} rx={1.5} fill="#fff" opacity="0.4" />
                  </g>
                </g>
              ))}
            </g>
          )}

          {/* 섬 + 랜드마크 */}
          {L.nodes.map(([x, y], i) => {
            const st = status(i);
            const big = i === 6 ? 1.2 : 1;
            const isTo = unlock?.to === i;
            const isFrom = unlock?.from === i;
            return (
              <g
                key={i}
                className={`a-node-g${hover === i ? ' is-hover' : ''}${shake === i ? ' is-shake' : ''}${st === 'current' ? ' is-current' : ''}`}
              >
                {st === 'current' && ringOn && !isTo && (
                  <ellipse className="a-node-ring m-loop" cx={x} cy={y + L.ry * 0.3} rx={L.rx * 1.3} ry={L.ry * 1.6} fill="none" stroke="#FFD84D" strokeWidth="6" />
                )}
                <Island x={x} y={y} rx={L.rx * big} ry={L.ry * big} seed={i * 3 + 1} locked={st === 'locked'}>
                  <Landmark kind={LANDMARKS[i]} x={x + L.rx * 0.18} y={y - L.ry * 0.05} s={L.lm * big} locked={st === 'locked'} />
                </Island>
                {isTo && (
                  <>
                    {/* 깨어난 섬: 색 있는 섬을 위에 겹쳐 서서히 드러냄 (필터 없이 색만) */}
                    <g data-u="wake" className="a-u-box a-u-bottom" opacity={0}>
                      <Island x={x} y={y} rx={L.rx * big} ry={L.ry * big} seed={i * 3 + 1} />
                    </g>
                    <g data-u="landmark" className="a-u-box a-u-bottom" opacity={0}>
                      <Landmark kind={LANDMARKS[i]} x={x + L.rx * 0.18} y={y - L.ry * 0.05} s={L.lm * big} />
                    </g>
                    {/* 자물쇠 */}
                    <g transform={`translate(${x} ${y - L.ry * 1.6})`}>
                      <g data-u="lock" className="a-u-box a-u-center">
                        <path data-u="shackle" className="a-u-box a-u-shackle" d="M-11 -6 V-15 a11 11 0 0 1 22 0 V-6" stroke="#8496AE" strokeWidth="6" fill="none" strokeLinecap="round" />
                        <rect x="-18" y="-8" width="36" height="30" rx="9" fill="#C98F2A" transform="translate(0 4)" />
                        <rect x="-18" y="-8" width="36" height="30" rx="9" fill="#FFC93C" />
                        <ellipse cx="-8" cy="-2" rx="5" ry="2.4" fill="#fff" opacity="0.55" />
                        <circle cx="0" cy="6" r="4" fill="#8A5A00" />
                        <rect x="-1.6" y="7" width="3.2" height="7" rx="1.6" fill="#8A5A00" />
                      </g>
                    </g>
                  </>
                )}
                {(st === 'done' || isFrom) && (
                  <g transform={`translate(${x - L.rx * 0.8} ${y + L.ry * 0.05})`}>
                    <g data-u={isFrom ? 'flag' : undefined} className={isFrom ? 'a-u-box a-u-bottom' : undefined}>
                      <path d="M0 0 V-34" stroke="#A9703D" strokeWidth="3" strokeLinecap="round" />
                      <path d="M0 -34 L22 -27 L0 -20Z" fill="#FFD84D" />
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* 파이뱀 말 (점프 이동) */}
        <div className="a-py-layer" aria-hidden>
          <div ref={shadow} className="a-py-shadow" style={pyStyle}>
            <span style={{ marginLeft: -L.rx * 0.42 * k - L.py * 0.3, width: L.py * 0.6 }} />
          </div>
          <div ref={body} className="a-py-body" style={pyStyle}>
            <div className="a-py-squash" style={{ width: L.py, height: L.py, marginLeft: -L.py * 0.5 - L.rx * 0.42 * k, marginTop: -L.py * 0.92 }}>
              <PybaemRig state={hopping ? 'happy' : 'idle'} size={L.py} lookAt={false} tier={tier} reducedMotion={reduced} />
            </div>
          </div>
        </div>

        {/* 노드 버튼 (글자·접근성) */}
        {L.nodes.map(([x, y], i) => {
          const st = status(i);
          const { got, max } = stageStars(i, cur);
          const stage = STAGES[i];
          const stLabel = st === 'done' ? '완료' : st === 'current' ? '지금 하는 곳' : '잠김';
          const off = x < -40 || x > L.w + 40;
          return (
            <button
              key={i}
              type="button"
              data-node={i}
              className={`a-node a-node-${st}`}
              style={{ left: `${(x / L.w) * 100}%`, top: `${(y / L.h) * 100}%`, visibility: off ? 'hidden' : undefined }}
              onClick={() => tap(i)}
              onPointerEnter={() => interactive && setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => interactive && setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={interactive ? undefined : -1}
              aria-label={`스테이지 ${stage.order} ${stage.title}, ${stLabel}${st !== 'locked' ? `, 별 ${max}개 중 ${got}개` : ''}`}
            >
              <span className="a-node-hit" aria-hidden />
              <span className="a-plaque" aria-hidden>
                <span className="a-plaque-no">{st === 'locked' ? <Icon name="lock" size={16} strokeWidth={2.6} /> : stage.order}</span>
                <span className="a-plaque-name">{stage.title}</span>
                {st !== 'locked' && (
                  <span className="a-plaque-stars">
                    <RewardIcon kind="star" size={18} style="A" />
                    {got}/{max}
                  </span>
                )}
              </span>
              {unlock?.to === i && (
                <span className="a-opened" data-u="opened" aria-hidden>
                  열렸어요!
                </span>
              )}
              {st === 'current' && unlock?.to !== i && (
                <span className="a-here m-loop" aria-hidden>
                  지금 여기!
                </span>
              )}
            </button>
          );
        })}
        <div className="a-map-fx" ref={fx} aria-hidden />
      </div>
      <div className="a-clouds" aria-hidden>
        <CloudShape className="a-cloud a-cloud-1 m-ambient" w={wide ? 180 : 120} />
        <CloudShape className="a-cloud a-cloud-2 m-ambient" w={wide ? 130 : 90} />
        <CloudShape className="a-cloud a-cloud-3 m-ambient" w={wide ? 220 : 140} />
      </div>
    </div>
  );
});

/**
 * 스테이지 해제 연출 (P2-05). 지도와 #motion 무대가 함께 쓴다.
 * 깃발 → 다리 널빤지 하나씩 → 자물쇠 흔들림·열림 → 섬 색이 돌아오며 젤리 → 랜드마크 솟음 → 파이뱀 점프 → 이름표 + "열렸어요!"
 */
export function buildUnlock(seq: Seq, h: MapHandle, from: number, to: number) {
  const root = h.root;
  if (!root) return;
  const q = (s: string) => root.querySelector(s);
  const qa = (s: string) => [...root.querySelectorAll(s)];
  const fxl = h.fx ?? root;

  // ① 깃발
  seq.appear(q('[data-u="flag"]'), 0, [{ transform: 'scale(0.2, 0)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'body' });
  seq.beat('3스테이지 완료 깃발', 0, seq.moves ? springTiming(seq.mode === 'lite' ? 'body' : 'prop').duration : 150, 'prop / lite body');

  // ② 다리 널빤지
  const T0 = seq.s(420);
  const planks = qa('[data-u-plank]');
  const gap = seq.s(55);
  planks.forEach((p, i) => {
    seq.appear(p, seq.moves ? T0 + i * gap : T0, [{ transform: 'translateY(-34px) scale(0.3)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
  });
  seq.vanish(q('[data-u="stones"]'), T0 + gap * planks.length, [{ opacity: 1 }, { opacity: 0 }], 240);
  const bridgeEnd = T0 + (seq.moves ? gap * planks.length + 300 : 150);
  seq.beat(`다리 놓기 (널빤지 ${planks.length}개, ${gap}ms 간격)`, T0, bridgeEnd - T0, 'prop / lite face');

  // ③ 자물쇠
  const T1 = bridgeEnd;
  const lock = q('[data-u="lock"]');
  seq.wiggle(lock, T1, [{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(5deg)' }, { transform: 'none' }], 420, 'linear');
  if (seq.moves) seq.anim(q('[data-u="shackle"]'), [{ transform: 'none' }, { transform: 'translateY(-5px) rotate(-30deg)' }], T1 + seq.s(420), { duration: seq.s(160), easing: EASING.backOut });
  const T1b = T1 + (seq.moves ? seq.s(620) : seq.s(300));
  seq.vanish(lock, T1b, [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-36px) rotate(25deg) scale(0.6)', opacity: 0 }], 360);
  seq.beat('자물쇠 흔들림 → 열림 → 날아감', T1, T1b + seq.s(360) - T1, 'linear 흔들기 · backOut · out');

  // ④ 섬이 깨어남
  const T2 = T1b + seq.s(120);
  const c = h.nodePx(to);
  seq.appear(q('[data-u="wake"]'), T2, [{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: EASING.out });
  seq.squish(q('[data-u="wake"]'), T2 + seq.s(260), 0.8);
  burst(seq, fxl, c.x, c.y - 20 * h.k(), T2 + seq.s(200), 10, 70);
  seq.beat('섬 색이 돌아옴 + 젤리 스퀴시 + 반짝이', T2, seq.moves ? seq.s(260) + 90 + springTiming(seq.mode === 'lite' ? 'body' : 'jellyA').duration : 150, 'out 360ms → jellyA');

  // ⑤ 랜드마크 솟음
  const T3 = T2 + seq.s(420);
  seq.appear(q('[data-u="landmark"]'), T3, [{ transform: 'translateY(22px) scale(0.5, 0.2)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  seq.beat('랜드마크 솟아오름', T3, seq.moves ? springTiming(seq.mode === 'lite' ? 'body' : 'jellyA').duration : 150, 'jellyA / lite body');

  // ⑥ 파이뱀 점프
  const T4 = T3 + seq.s(700);
  let hopEnd = T4;
  if (seq.moves) {
    const f = h.hopFrames(from, to);
    seq.call(T4, () => h.setHop(true));
    seq.anim(h.body(), f.body, T4, { duration: f.dur, fill: 'forwards' });
    seq.anim(h.shadow(), f.shadow, T4, { duration: f.dur, fill: 'forwards' });
    hopEnd = T4 + f.dur;
    seq.call(hopEnd, () => {
      h.setPos(to);
      h.setHop(false);
    });
    seq.squish(h.body()?.querySelector('.a-py-squash'), hopEnd, 0.9);
    seq.beat('파이뱀 점프 이동 + 착지 젤리', T4, f.dur + 90 + springTiming(seq.mode === 'lite' ? 'body' : 'jellyA').duration, 'linear 아크 → jellyA');
  } else {
    seq.call(T4, () => h.setPos(to));
    seq.appear(h.body(), T4, [{ opacity: 0 }, { opacity: 1 }]);
    hopEnd = T4 + 150;
    seq.beat('파이뱀 자리 옮김 (점프 없음)', T4, 150, seq.mode === 'minimal' ? '페이드 150ms' : '즉시');
  }

  // ⑦ 이름표·별 진행
  const T5 = hopEnd + seq.s(120);
  seq.call(T5, () => h.setCur(to));
  const plaque = root.querySelector(`[data-node="${to}"] .a-plaque`);
  seq.appear(plaque, T5, [{ transform: 'translateX(-50%) scale(0.3)' }, { transform: 'translateX(-50%)' }], { spring: 'prop', liteSpring: 'face', fill: 'forwards' });
  seq.appear(q('[data-u="opened"]'), T5 + seq.s(220), [{ transform: 'translateY(10px) scale(0.4)' }, { transform: 'none' }], { spring: 'jellyA', liteSpring: 'body' });
  seq.beat('이름표·별 0/21 + "열렸어요!"', T5, seq.s(220) + (seq.moves ? springTiming('jellyA').duration : 150), 'prop · jellyA');
}

// ───────────── 스테이지 시트 (퀘스트 고르기·복습, X7)

function StageSheet({ open, stage }: { open: boolean; stage: number }) {
  const st = STAGES[stage] ?? STAGES[1];
  const stars = questStars(stage);
  const { got, max } = stageStars(stage);
  const status = stageStatus(stage);
  const chestAt = Math.round(max * 0.7);
  const rows = st.quests.map((q, i) => ({ q, i, star: stars[i] }));
  const close = () => goScreen('world');
  const go = (qo: number) => {
    setStore({ quest: `${st.order}-${qo}`, quiz: false });
    goScreen('quest');
  };
  return (
    <Sheet open={open} onClose={close} wide labelledBy="a-stage-title">
      <div className="a-stage">
        <div className="a-stage-head">
          <svg className="a-stage-art" viewBox="-80 -120 160 160" aria-hidden>
            <Island x={0} y={0} rx={70} ry={22} seed={stage * 3 + 1}>
              <Landmark kind={LANDMARKS[stage]} x={8} y={0} s={0.82} />
            </Island>
          </svg>
          <div>
            <p className="a-stage-eyebrow">
              스테이지 {st.order} · {status === 'done' ? '완료' : status === 'current' ? '모험 중' : '잠김'}
            </p>
            <h2 id="a-stage-title" className="a-stage-title">
              {st.title}
            </h2>
            <p className="a-stage-desc">{st.description}</p>
          </div>
        </div>
        <div className="a-stage-prog">
          <span className="a-stage-stars">
            <RewardIcon kind="star" size={26} style="A" />
            <b>{got}</b> / {max}
          </span>
          <span className="a-stage-bar">
            <Progress value={got} max={max} label={`별 ${max}개 중 ${got}개`} tone="lemon" />
            <span className="a-chest-mark" style={{ left: `${(chestAt / max) * 100}%` }} aria-hidden />
          </span>
          <span className={`a-chest${got >= chestAt ? ' is-open' : ''}`}>
            <ChestIcon open={got >= chestAt} />
            <span>{got >= chestAt ? '보물상자 열기!' : `별 ${chestAt}개면 보물상자`}</span>
          </span>
        </div>
        <ol className="a-qlist">
          {rows.map(({ q, i, star }) => {
            const locked = star === null;
            const isCur = star === 0;
            const type = q.type === 'project' ? 'project' : 'code';
            const row = (
              <li key={i}>
                <button type="button" className={`a-qrow${locked ? ' is-locked' : ''}${isCur ? ' is-current' : ''}`} disabled={locked} onClick={() => go(q.order)}>
                  <span className="a-qrow-no">{locked ? <Icon name="lock" size={18} strokeWidth={2.6} /> : q.order}</span>
                  <span className="a-qrow-main">
                    <span className="a-qrow-title">{q.title}</span>
                    <span className="a-qrow-meta">
                      <span className={`a-tag a-tag-${type}`}>{type === 'project' ? '프로젝트' : '코드'}</span>
                      {q.challenge && <span className="a-tag a-tag-challenge">도전</span>}
                      <span className="a-qrow-concept">{q.concept}</span>
                    </span>
                  </span>
                  <span className="a-qrow-end">
                    {locked ? (
                      <span className="a-qrow-lock">잠김</span>
                    ) : isCur ? (
                      <span className="a-pill a-pill-go">도전!</span>
                    ) : (
                      <>
                        <Stars n={star ?? 0} size={20} />
                        <span className="a-pill a-pill-review">
                          <Icon name="refresh" size={16} strokeWidth={2.6} />
                          복습
                        </span>
                      </>
                    )}
                  </span>
                </button>
              </li>
            );
            if (i !== 1) return row;
            // 프로토타입: 퀴즈 유형 예시 한 줄 (§4 모바일 문제 유형)
            return [
              row,
              <li key="quiz">
                <button
                  type="button"
                  className="a-qrow"
                  onClick={() => {
                    setStore({ quiz: true, quest: '2-1' });
                    goScreen('quest');
                  }}
                >
                  <span className="a-qrow-no a-qrow-no-quiz">?</span>
                  <span className="a-qrow-main">
                    <span className="a-qrow-title">상자 속 글자 맞히기</span>
                    <span className="a-qrow-meta">
                      <span className="a-tag a-tag-quiz">퀴즈</span>
                      <span className="a-qrow-concept">객관식 · 30초</span>
                    </span>
                  </span>
                  <span className="a-qrow-end">
                    <Stars n={status === 'locked' ? 0 : 2} size={20} />
                    <span className="a-pill a-pill-review">
                      <Icon name="refresh" size={16} strokeWidth={2.6} />
                      복습
                    </span>
                  </span>
                </button>
              </li>,
            ];
          })}
        </ol>
        <div className="a-stage-foot">
          <ClayButton
            variant="primary"
            size="lg"
            icon="play"
            onClick={() => go(status === 'current' ? (stars.findIndex((x) => x === 0) + 1 || 1) : 1)}
          >
            {status === 'current' ? '이어서 하기' : '처음부터 복습하기'}
          </ClayButton>
        </div>
      </div>
    </Sheet>
  );
}

export function ChestIcon({ open, size = 40 }: { open?: boolean; size?: number }) {
  const w = tone('wood');
  return (
    <svg viewBox="0 0 48 40" width={size} height={size * 0.83} aria-hidden>
      <rect x="4" y="18" width="40" height="20" rx="6" fill={w.lip} transform="translate(0 2)" />
      <rect x="4" y="18" width="40" height="20" rx="6" fill={w.fill} />
      {open ? (
        <>
          <path d="M6 18 L10 4 H38 L42 18Z" fill={w.lip} />
          <ellipse cx="24" cy="18" rx="14" ry="4" fill="#FFD84D" />
          <circle cx="18" cy="15" r="3" fill="#FFC93C" />
          <circle cx="28" cy="14" r="3" fill="#FFC93C" />
        </>
      ) : (
        <path d="M4 20 Q24 2 44 20Z" fill={w.fill} />
      )}
      <rect x="20" y="20" width="8" height="10" rx="2" fill="#FFD84D" />
      <rect x="9" y="24" width="10" height="3" rx="1.5" fill="#fff" opacity="0.4" />
    </svg>
  );
}
