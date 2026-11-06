// 월드맵 (#world) — 펼쳐지는 보물지도 두루마리. 잉크 길이 그려지고, 통과한 곳에 도장이 쾅, 지금 위치에 파이뱀.
// 스테이지 차례 (#stage) — 지도 위에 바텀시트(넓은 화면은 책 한 쪽 모양 대화상자)
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { goScreen } from '../shared/app';
import { Icon } from '../shared/icons';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { useMotion } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { CHEST_GOAL, CURRENT_STAGE, PROGRESS, stageQuests, type QuestEntry, type StageProgress } from './data';
import { Bird, Compass, CoverArt, Landmark, Mountains, TinyTree, Waves, INK, C } from './art';
import { Hud, InkButton, InkProgress, Sheet, Stars } from './ui';
import { setB, toast, useB } from './state';
import { drawPath, isLite, isMinimal, isStill, popIn, stampSlam } from './fx';
import { UnlockLayer, samplePath, segment, type UnlockLayerHandle } from './Signature';
import { buildUnlock } from './beats';
import { Scene } from './timeline';
import { getMotion } from '../shared/motion';
import type { RigState } from '../shared/rig/params';

type Pt = [number, number];
interface Layout {
  w: number;
  h: number;
  pts: Pt[];
  scale: number;
}
const WIDE: Layout = {
  w: 1200,
  h: 720,
  scale: 1,
  pts: [
    [130, 600],
    [330, 470],
    [540, 580],
    [660, 360],
    [880, 500],
    [960, 300],
    [1100, 120],
  ],
};
const TALL: Layout = {
  w: 400,
  h: 1180,
  scale: 0.82,
  pts: [
    [104, 1080],
    [292, 930],
    [108, 790],
    [292, 640],
    [112, 495],
    [290, 350],
    [180, 175],
  ],
};

/** Catmull-Rom → 3차 베지어 (부드러운 손그림 길) */
function smooth(pts: Pt[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.5 / 3;
    d += ` C${p1[0] + (p2[0] - p0[0]) * t} ${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t} ${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function World({ sheet }: { sheet: boolean }) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 940);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setWide(el.getBoundingClientRect().width >= 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const stage = useB((s) => s.stage);
  const mapApi = useRef<{ unlock: () => void } | null>(null);
  const done = PROGRESS.filter((p) => p.status === 'clear').length;
  const stars = PROGRESS.reduce((a, p) => a + p.stars, 0);
  const max = PROGRESS.reduce((a, p) => a + p.max, 0);
  return (
    <>
      <Hud />
      <main className="b-world" ref={wrap}>
        <div className="b-world-head">
          <div className="b-cartouche">
            <span className="b-kicker">그림책 1권</span>
            <h1 className="b-h1">숲 마을 모험 지도</h1>
          </div>
          <div className="b-world-sum">
            <span>
              <b className="b-num">{done}</b>/{PROGRESS.length} 스테이지 통과
            </span>
            <span className="b-world-sum-star">
              <Stars n={1} max={1} size={20} label={false} />
              <b className="b-num">{stars}</b>/{max}
            </span>
            <InkButton variant="paper" size="sm" icon="unlock" onClick={() => mapApi.current?.unlock()}>
              해제 보기
            </InkButton>
            <InkButton variant="primary" size="sm" iconRight="arrowRight" onClick={() => openStage(CURRENT_STAGE)}>
              이어서 하기
            </InkButton>
          </div>
        </div>
        <ScrollMap key={wide ? 'w' : 't'} layout={wide ? WIDE : TALL} wide={wide} api={mapApi} />
        <NextBooks />
      </main>
      <StageSheet open={sheet} stage={stage} />
    </>
  );
}

function openStage(n: number) {
  const p = PROGRESS.find((x) => x.stage.order === n);
  if (!p) return;
  if (p.status === 'locked') {
    toast(`${n - 1}번 스테이지를 통과하면 열려요`, 'warn');
    return;
  }
  setB({ stage: n });
  goScreen('stage');
}

// ───────────── 두루마리 지도

function ScrollMap({ layout, wide, api }: { layout: Layout; wide: boolean; api: MutableRefObject<{ unlock: () => void } | null> }) {
  const { tier, reduced } = useMotion();
  // 스테이지 해제 데모 (P2-05): 지금 스테이지 통과 → 다음 스테이지가 열림. 시그니처 모션 장면과 같은 빌더
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [rig, setRig] = useState<RigState>('idle');
  const [busy, setBusy] = useState(false);
  const layer = useRef<UnlockLayerHandle | null>(null);
  const here = useRef<HTMLDivElement | null>(null);
  const scene = useRef<Scene | null>(null);
  const paper = useRef<HTMLDivElement | null>(null);
  const rollA = useRef<HTMLSpanElement | null>(null);
  const rollB = useRef<HTMLSpanElement | null>(null);
  const donePath = useRef<SVGPathElement | null>(null);
  const nodes = useRef<HTMLDivElement | null>(null);
  const cur = PROGRESS.findIndex((p) => p.status === 'current');
  const dDone = useMemo(() => smooth(layout.pts.slice(0, cur + 1)), [layout, cur]);
  const dAll = useMemo(() => smooth(layout.pts), [layout]);
  const dTodo = useMemo(() => smooth(layout.pts.slice(cur)), [layout, cur]);
  const dNext = useMemo(() => segment(layout.pts, cur), [layout, cur]);
  const offX = (i: number) => (wide ? -86 : layout.pts[i][0] < layout.w / 2 ? 92 : -92);
  const prog: StageProgress[] = PROGRESS.map((p, i) =>
    open && i === cur ? { ...p, status: 'clear' } : open && i === cur + 1 ? { ...p, status: 'current' } : p,
  );
  api.current = {
    unlock: () => {
      setArmed(true);
      setOpen(false);
      here.current?.scrollIntoView({ block: 'center', behavior: isStill() ? 'auto' : 'smooth' });
      requestAnimationFrame(() => {
        const e = layer.current?.els();
        const box = paper.current?.getBoundingClientRect();
        const plate = nodes.current?.querySelectorAll('.b-node')[cur + 1]?.querySelector<HTMLElement>('.b-node-plate');
        if (!e || !box || !plate || !here.current) return;
        const k = box.width / layout.w;
        const pts = samplePath(e.path, layout.w, box.width);
        const dOff = (offX(cur + 1) - offX(cur)) * k;
        pts.forEach((p, i) => (p.x += (dOff * i) / (pts.length - 1)));
        scene.current?.stop();
        const sc = new Scene(
          buildUnlock({ ...e, paper: paper.current!, inkOrigin: '50% 62%', inkSize: '330% 330%', py: here.current, pyPts: pts, plate, onRig: setRig, onOpen: setOpen }, getMotion()),
        );
        sc.onEnd = () => {
          setBusy(false);
          toast(`${cur + 2}번 스테이지 "${PROGRESS[cur + 1].stage.title}"이(가) 열렸어요! (데모)`, 'good');
        };
        scene.current = sc;
        setBusy(true);
        sc.play();
      });
    },
  };
  useEffect(() => () => scene.current?.stop(), []);

  // 펼치기 → 잉크 길 → 도장 쾅 → 파이뱀 (지도에 들어올 때 한 번)
  useLayoutEffect(() => {
    if (isStill()) return;
    const p = paper.current;
    if (!p) return;
    const axisX = wide;
    let t = 0;
    if (!isMinimal()) {
      const unroll = isLite() ? 420 : 900;
      const r = p.getBoundingClientRect();
      const half = axisX ? r.width / 2 : Math.min(r.height / 2, 420);
      p.animate([{ clipPath: axisX ? 'inset(0 50% 0 50%)' : 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: unroll, easing: EASING.out });
      if (axisX) {
        rollA.current?.animate([{ transform: `translateX(${half}px)` }, { transform: 'none' }], { duration: unroll, easing: EASING.out });
        rollB.current?.animate([{ transform: `translateX(${-half}px)` }, { transform: 'none' }], { duration: unroll, easing: EASING.out });
      } else {
        rollB.current?.animate([{ transform: `translateY(${-r.height + 40}px)` }, { transform: 'none' }], { duration: unroll, easing: EASING.out });
      }
      t = Math.round(unroll * 0.6);
    } else {
      p.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 150 });
    }
    const end = drawPath(donePath.current, t, 1200);
    // 통과한 곳 도장: 길이 지나갈 즈음
    const stamps = nodes.current?.querySelectorAll<HTMLElement>('[data-stamp]') ?? [];
    stamps.forEach((s, i) => {
      const at = t + ((end - t) * (i + 0.8)) / Math.max(1, cur);
      stampSlam(s, { delay: Math.round(at), rot: Number(s.dataset.rot ?? -12), splat: !isLite() });
    });
    popIn(nodes.current?.querySelector('[data-here]') ?? null, end);
  }, []);

  const pct = (x: number, y: number): CSSProperties => ({ left: `${(x / layout.w) * 100}%`, top: `${(y / layout.h) * 100}%` });

  return (
    <div className={`b-scroll ${wide ? 'is-x' : 'is-y'}`} data-tier={tier} data-reduced={reduced || undefined}>
      <span className="b-roller b-roller-a" ref={rollA} aria-hidden />
      <span className="b-roller b-roller-b" ref={rollB} aria-hidden />
      <div className="b-map-paper" ref={paper}>
        <div className="b-map" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
          <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="b-map-svg" role="img" aria-label="숲 마을 모험 지도. 일곱 스테이지가 잉크 길로 이어져 있어요">
            <MapBackdrop layout={layout} wide={wide} />
            {/* 길: 모래 바탕 → 지난 길(잉크) → 남은 길(연필 점선) */}
            <path d={dAll} fill="none" stroke={C.sand} strokeWidth={wide ? 26 : 22} strokeLinecap="round" opacity="0.75" />
            <path d={dTodo} fill="none" stroke="#8A7356" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="2 10" opacity="0.9" />
            <path ref={donePath} d={dDone} fill="none" stroke={INK} strokeWidth={wide ? 6 : 5} strokeLinecap="round" className="b-road-ink" />
            <path d={dDone} fill="none" stroke={C.paper} strokeWidth="1.6" strokeLinecap="round" strokeDasharray="10 14" opacity="0.9" />
            {layout.pts.map(([x, y], i) => {
              const p = PROGRESS[i];
              return (
                <g key={i} transform={`translate(${x} ${y + 6}) scale(${layout.scale})`}>
                  <Landmark stage={i + 1} mode={p.status === 'locked' ? 'pencil' : 'ink'} />
                </g>
              );
            })}
          </svg>
          <div className="b-map-nodes" ref={nodes}>
            {layout.pts.map(([x, y], i) => (
              <StageNode key={i} p={prog[i]} style={pct(x, y)} wide={wide} hideStamp={armed && i === cur} />
            ))}
            <div className="b-here" data-here ref={here} style={pct(layout.pts[cur][0] + offX(cur), layout.pts[cur][1] + 4)}>
              <div className="b-here-in">
                <PybaemRig style="B" state={rig} size={wide ? 120 : 96} tier={busy && tier === 'full' ? 'lite' : undefined} />
                <span className="b-here-flag">{open ? '새 곳 도착!' : '지금 여기!'}</span>
              </div>
            </div>
          </div>
          <UnlockLayer ref={layer} w={layout.w} h={layout.h} from={layout.pts[cur]} to={layout.pts[cur + 1]} toStage={cur + 2} d={dNext} scale={layout.scale} armed={armed} open={open} />
          <div className="b-map-legend" aria-hidden>
            <span>
              <i className="b-lg-ink" /> 지나온 길
            </span>
            <span>
              <i className="b-lg-pencil" /> 아직 못 간 길
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StageNode({ p, style, wide, hideStamp }: { p: StageProgress; style: CSSProperties; wide: boolean; hideStamp?: boolean }) {
  const s = p.stage;
  const label = `${s.order}번 스테이지 ${s.title}, ${p.status === 'clear' ? '통과' : p.status === 'current' ? '지금 도전 중' : '잠김'}, 별 ${p.stars}/${p.max}`;
  const rot = [-14, 9, -6, 12, -10, 7, -12][s.order - 1];
  return (
    <div className={`b-node is-${p.status} ${wide ? '' : 'is-tall'}`} style={style}>
      <button type="button" className="b-node-hit" aria-label={label} onClick={() => openStage(s.order)}>
        <span className="b-node-plate">
          <span className="b-node-no">{s.order}</span>
          <span className="b-node-t">{s.title}</span>
        </span>
        <span className="b-node-meta">
          {p.status === 'locked' ? (
            <>
              <Icon name="lock" size={16} strokeWidth={2.6} /> 잠김
            </>
          ) : (
            <>
              <Stars n={1} max={1} size={16} label={false} /> {p.stars}/{p.max}
            </>
          )}
        </span>
      </button>
      {p.status === 'clear' && !hideStamp && (
        <span className="b-stamp b-node-stamp" data-stamp data-rot={rot} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
          <span>통과</span>
        </span>
      )}
    </div>
  );
}

function MapBackdrop({ layout, wide }: { layout: Layout; wide: boolean }) {
  const { w, h } = layout;
  if (wide)
    return (
      <g aria-hidden>
        {/* 경위선 */}
        <g stroke="#8A7356" strokeWidth="1" opacity="0.18" strokeDasharray="3 7">
          {[1, 2, 3, 4, 5].map((i) => (
            <path key={`v${i}`} d={`M${(w / 6) * i} 0 V${h}`} />
          ))}
          {[1, 2, 3].map((i) => (
            <path key={`h${i}`} d={`M0 ${(h / 4) * i} H${w}`} />
          ))}
        </g>
        {/* 바다 (위쪽) + 해안선 */}
        <path d="M0 0 H760 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160 Z" fill="#CFE0E6" />
        <path d="M760 0 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160" fill="none" stroke={INK} strokeWidth="2.2" />
        <path d="M740 8 C705 44 650 66 598 58 C520 46 472 100 400 90" fill="none" stroke={INK} strokeWidth="1" opacity="0.4" />
        <Waves x={90} y={50} n={4} />
        <Waves x={330} y={30} n={3} />
        <Waves x={560} y={18} n={2} />
        {/* 종이배 */}
        <g transform="translate(200 52)">
          <path d="M0 18 h44 l-8 12 h-28z" fill={C.paper} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 18 v-30 l18 26 h-18" fill={C.terra} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        </g>
        {/* 오른쪽 아래 바다 */}
        <path d="M1200 560 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720 H1200 Z" fill="#CFE0E6" />
        <path d="M1200 560 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720" fill="none" stroke={INK} strokeWidth="2.2" />
        <Waves x={1080} y={680} n={3} />
        {/* 산맥·숲 */}
        <Mountains x={470} y={300} s={1.5} />
        <Mountains x={560} y={250} s={1} o={0.85} />
        <Mountains x={760} y={240} s={1.3} />
        <Mountains x={1110} y={330} s={1} />
        {[
          [60, 420, 1.3],
          [90, 440, 1],
          [220, 650, 1.2],
          [250, 668, 0.9],
          [420, 470, 1.1],
          [760, 640, 1.2],
          [790, 660, 1],
          [960, 420, 1.1],
          [1140, 470, 1.2],
          [1160, 500, 0.9],
          [880, 170, 1],
          [910, 186, 0.8],
        ].map(([x, y, s], i) => (
          <TinyTree key={i} x={x} y={y} s={s} c={i % 2 ? C.olive : C.forest} />
        ))}
        <Bird x={640} y={140} />
        <Bird x={668} y={156} s={0.7} />
        <Bird x={300} y={250} s={0.8} />
        <Compass x={1110} y={620} r={50} />
        {/* 미지의 땅 테두리 해칭 */}
        <path d="M1150 40 c20 30 30 60 30 100" fill="none" stroke={INK} strokeWidth="1.2" strokeDasharray="2 6" opacity="0.5" />
      </g>
    );
  return (
    <g aria-hidden>
      <g stroke="#8A7356" strokeWidth="1" opacity="0.18" strokeDasharray="3 7">
        {[1, 2, 3].map((i) => (
          <path key={`v${i}`} d={`M${(w / 4) * i} 0 V${h}`} />
        ))}
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <path key={`h${i}`} d={`M0 ${(h / 8) * i} H${w}`} />
        ))}
      </g>
      <path d="M0 0 H400 V60 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124 Z" fill="#CFE0E6" />
      <path d="M400 60 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124" fill="none" stroke={INK} strokeWidth="2.2" />
      <Waves x={40} y={44} n={3} />
      <Waves x={250} y={30} n={3} />
      <path d="M0 1120 C40 1100 70 1120 120 1110 C160 1102 180 1130 200 1180 H0 Z" fill="#CFE0E6" />
      <path d="M0 1120 C40 1100 70 1120 120 1110 C160 1102 180 1130 200 1180" fill="none" stroke={INK} strokeWidth="2" />
      <Mountains x={20} y={620} s={1.1} />
      <Mountains x={250} y={760} s={1} />
      <Mountains x={210} y={470} s={0.9} o={0.85} />
      {[
        [40, 960, 1.2],
        [64, 976, 0.9],
        [350, 1040, 1.1],
        [370, 1060, 0.9],
        [30, 300, 1.1],
        [56, 316, 0.9],
        [360, 520, 1.1],
        [190, 1010, 1],
        [360, 220, 1.1],
      ].map(([x, y, s], i) => (
        <TinyTree key={i} x={x} y={y} s={s} c={i % 2 ? C.olive : C.forest} />
      ))}
      <Bird x={60} y={200} />
      <Bird x={300} y={560} s={0.7} />
      <Compass x={330} y={1080} r={38} />
    </g>
  );
}

// ───────────── 다음 권 (잠긴 책 표지 미리보기)

function NextBooks() {
  const done = PROGRESS.filter((p) => p.status === 'clear').length;
  return (
    <section className="b-next" aria-labelledby="b-next-t">
      <h2 id="b-next-t" className="b-h2">
        다음 권 미리 보기
      </h2>
      <div className="b-next-row">
        {[
          { no: 2 as const, t: '바다 여행', d: '종이배를 타고 배운 주문을 섞어 더 큰 문제를 풀어요' },
          { no: 3 as const, t: '발명가의 공방', d: '톱니와 전구로 나만의 게임과 그림을 만들어요' },
        ].map((b) => (
          <article key={b.no} className={`b-next-book b-book-${b.no}`}>
            <div className="b-next-cover">
              <CoverArt book={b.no} />
              <span className="b-book-band">{b.no}권</span>
              <span className="b-book-clasp" aria-hidden>
                <Icon name="lock" size={22} strokeWidth={2.6} />
              </span>
            </div>
            <div className="b-next-info">
              <h3 className="b-h3">{b.t}</h3>
              <p>{b.d}</p>
              <div className="b-next-prog">
                <InkProgress value={done} max={7} label={`1권 진행 ${done}/7`} />
                <span className="b-muted">
                  <Icon name="lock" size={16} strokeWidth={2.4} /> {b.no === 2 ? `1권 진행 ${done}/7 · 다 읽으면 열려요` : '2권을 다 읽으면 열려요'}
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ───────────── 스테이지 차례 (#stage)

const KIND_LABEL: Record<QuestEntry['kind'], string> = { code: '코드', quiz: '퀴즈', project: '프로젝트' };

function StageSheet({ open, stage }: { open: boolean; stage: number }) {
  const p = PROGRESS.find((x) => x.stage.order === stage) ?? PROGRESS[0];
  const qs = stageQuests(p.stage);
  const close = () => goScreen('world');
  const go = (q: QuestEntry) => {
    if (q.stars < 0) {
      toast('앞의 퀘스트를 먼저 풀면 열려요', 'warn');
      return;
    }
    setB({ questId: q.id, stage: q.stage });
    goScreen('quest');
  };
  return (
    <Sheet open={open} onClose={close} label={`${p.stage.order}번 스테이지 ${p.stage.title} 차례`} wide>
      <div className="b-toc">
        <div className="b-toc-head">
          <svg viewBox="-70 -120 140 135" className="b-toc-art" aria-hidden>
            <Landmark stage={p.stage.order} mode="ink" />
          </svg>
          <div className="b-toc-titles">
            <span className="b-kicker">제{p.stage.order}장 · {p.status === 'clear' ? '통과한 곳' : '지금 모험 중'}</span>
            <h2 className="b-h2">{p.stage.title}</h2>
            <p className="b-muted">{p.stage.description}</p>
          </div>
        </div>
        <div className="b-toc-chest">
          <ChestIcon open={p.stars >= CHEST_GOAL} />
          <div className="b-toc-chest-txt">
            <b>
              별 보물상자 <span className="b-num">{Math.min(p.stars, CHEST_GOAL)}</span>/{CHEST_GOAL}
            </b>
            <InkProgress value={Math.min(p.stars, CHEST_GOAL)} max={CHEST_GOAL} label="보물상자까지 모은 별" tone="gold" />
          </div>
          <span className="b-toc-chest-note">{p.stars >= CHEST_GOAL ? '열었어요!' : `별 ${CHEST_GOAL - p.stars}개 더`}</span>
        </div>
        <h3 className="b-toc-k">차례</h3>
        <ol className="b-toc-list">
          {qs.map((q) => {
            const locked = q.stars < 0;
            const now = q.stars === 0;
            const review = q.stars > 0 && q.stars < 3;
            return (
              <li key={q.id}>
                <button type="button" className={`b-toc-row ${locked ? 'is-locked' : ''} ${now ? 'is-now' : ''}`} onClick={() => go(q)} aria-disabled={locked}>
                  <span className={`b-toc-no b-kind-${q.kind}`}>{q.kind === 'quiz' ? <Icon name="hint" size={18} strokeWidth={2.4} /> : q.label}</span>
                  <span className="b-toc-main">
                    <span className="b-toc-t">{q.title}</span>
                    <span className="b-toc-tags">
                      <span className={`b-tag b-tag-${q.kind}`}>{KIND_LABEL[q.kind]}</span>
                      {q.challenge && <span className="b-tag b-tag-challenge">도전</span>}
                      {now && <span className="b-tag b-tag-now">지금 차례</span>}
                      {review && <span className="b-tag b-tag-review">별 채우기</span>}
                    </span>
                  </span>
                  <span className="b-toc-dots" aria-hidden />
                  <span className="b-toc-end">{locked ? <Icon name="lock" size={22} strokeWidth={2.4} label="잠김" /> : <Stars n={q.stars} size={22} />}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </Sheet>
  );
}

function ChestIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 64 56" width="56" height="49" aria-hidden className="b-chest">
      <path d="M6 26 h52 v24 h-52z" fill={C.brass} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d={open ? 'M6 26 L10 6 H54 L58 26' : 'M6 26 C6 10 58 10 58 26 Z'} fill={C.woodDark} stroke={INK} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M26 24 h12 v12 h-12z" fill={C.mustard} stroke={INK} strokeWidth="2.2" />
      <path d="M14 26 v24 M50 26 v24" stroke={INK} strokeWidth="1.6" opacity="0.6" />
    </svg>
  );
}
