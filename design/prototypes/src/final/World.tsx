// 월드맵 (#world) — 펼쳐지는 보물지도 두루마리. 잉크 길이 그려지고, 통과한 곳에 도장이 쾅, 지금 위치에 파이뱀.
// 스테이지 차례 (#stage) — 지도 위에 바텀시트(넓은 화면은 책 한 쪽 모양 대화상자)
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { goScreen } from '../shared/app';
import { Icon } from '../shared/icons';
import { PybaemRig } from './rig';
import { useMotion } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { CHEST_GOAL, CURRENT_STAGE, PROGRESS, stageQuests, type QuestEntry, type StageProgress } from './data';
import { Bird, CoverArt, Landmark, Mountains, TinyTree, Waves, INK, ROAD, C, tone } from './art';
import { Hud, InkButton, InkProgress, Sheet, Stars } from './ui';
import { setB, toast, useB } from './state';
import { drawPath, isLite, isMinimal, isStill, popIn, stampSlam } from './fx';
import { UnlockLayer, samplePath, segment, type UnlockLayerHandle } from './Signature';
import { buildUnlock } from './beats';
import { Scene, attachSkip } from './timeline';
import { getMotion } from '../shared/motion';
import type { PybaemState as RigState } from '../../../../src/components/characters/rig/pybaem/params';

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
      <main className="f-world" ref={wrap}>
        <div className="f-world-head">
          <div className="f-world-title">
            <span className="f-kicker">그림책 1권</span>
            <h1 className="f-h1">숲 마을 모험 지도</h1>
          </div>
          <div className="f-world-sum">
            <span>
              <b className="f-num">{done}</b>/{PROGRESS.length} 스테이지 통과
            </span>
            <span className="f-world-sum-star">
              <Stars n={1} max={1} size={20} label={false} />
              <b className="f-num">{stars}</b>/{max}
            </span>
            <button type="button" className="f-textbtn" onClick={() => mapApi.current?.unlock()}>
              <Icon name="unlock" size={18} strokeWidth={2.2} /> 해제 보기 (데모)
            </button>
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
        const plate = nodes.current?.querySelectorAll('.f-node')[cur + 1]?.querySelector<HTMLElement>('.f-node-plate');
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
  // 해제 연출 중 누르면 끝 상태로
  useEffect(() => attachSkip(() => scene.current), []);

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
    <div className={`f-scroll ${wide ? 'is-x' : 'is-y'}`} data-tier={tier} data-reduced={reduced || undefined}>
      <span className="f-roller f-roller-a" ref={rollA} aria-hidden />
      <span className="f-roller f-roller-b" ref={rollB} aria-hidden />
      <div className="f-map-paper" ref={paper}>
        <div className="f-map" style={{ aspectRatio: `${layout.w} / ${layout.h}` }}>
          <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="f-map-svg" role="img" aria-label="숲 마을 모험 지도. 일곱 스테이지가 잉크 길로 이어져 있어요">
            <MapBackdrop layout={layout} wide={wide} />
            {/* 길: 모래 바탕 → 지난 길(잉크) → 남은 길(연필 점선) */}
            <path d={dAll} fill="none" stroke={C.sand} strokeWidth={wide ? 22 : 18} strokeLinecap="round" opacity="0.7" />
            <path d={dTodo} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 10" opacity="0.9" />
            <path ref={donePath} d={dDone} fill="none" stroke={ROAD} strokeWidth={wide ? 4 : 3.5} strokeLinecap="round" className="f-road-ink" />
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
          <div className="f-map-nodes" ref={nodes}>
            {layout.pts.map(([x, y], i) => (
              <StageNode key={i} p={prog[i]} style={pct(x, y)} wide={wide} hideStamp={armed && i === cur} />
            ))}
            <div className="f-here" data-here ref={here} style={pct(layout.pts[cur][0] + offX(cur), layout.pts[cur][1] + 4)}>
              <div className="f-here-in">
                <PybaemRig style="B" state={rig} size={wide ? 120 : 96} tier={busy && tier === 'full' ? 'lite' : undefined} />
                <span className="f-here-flag">{open ? '새 곳 도착!' : '지금 여기!'}</span>
              </div>
            </div>
          </div>
          <UnlockLayer ref={layer} w={layout.w} h={layout.h} from={layout.pts[cur]} to={layout.pts[cur + 1]} toStage={cur + 2} d={dNext} scale={layout.scale} armed={armed} open={open} />
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
    <div className={`f-node is-${p.status} ${wide ? '' : 'is-tall'}`} style={style}>
      <button type="button" className="f-node-hit" aria-label={label} onClick={() => openStage(s.order)}>
        <span className="f-node-plate">
          <span className="f-node-no">{s.order}</span>
          <span className="f-node-t">{s.title}</span>
        </span>
        <span className="f-node-meta">
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
        <span className="f-stamp f-node-stamp" data-stamp data-rot={rot} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
          <span>통과</span>
        </span>
      )}
    </div>
  );
}

function MapBackdrop({ layout, wide }: { layout: Layout; wide: boolean }) {
  // 최종 시안: 경위선·나침반·잔 장식을 덜고 바다·해안선·산 2개·나무 몇 그루만 (덜어낸 것은 보고서)
  if (wide)
    return (
      <g aria-hidden>
        <path d="M0 0 H760 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160 Z" fill={C.waterLight} />
        <path d="M760 0 C720 40 660 60 600 50 C520 36 470 90 400 80 C330 70 300 120 230 110 C160 100 110 150 40 140 C20 138 8 150 0 160" fill="none" stroke={tone(C.waterLight, 0.86)} strokeWidth="1" />
        <Waves x={110} y={50} n={3} />
        <Waves x={420} y={26} n={2} />
        <g transform="translate(210 52)">
          <path d="M0 18 h44 l-8 12 h-28z" fill={C.paper} stroke={tone(C.paper)} strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M22 18 v-30 l18 26 h-18" fill={C.terra} stroke={tone(C.terra)} strokeWidth="1.4" strokeLinejoin="round" />
        </g>
        <path d="M1200 560 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720 H1200 Z" fill={C.waterLight} />
        <path d="M1200 560 C1140 570 1110 620 1060 640 C1010 660 990 700 960 720" fill="none" stroke={tone(C.waterLight, 0.86)} strokeWidth="1" />
        <Mountains x={480} y={290} s={1.3} o={0.8} />
        <Mountains x={770} y={235} s={1.1} o={0.8} />
        {[
          [70, 430, 1.2],
          [230, 655, 1.1],
          [790, 650, 1.1],
          [1150, 480, 1.1],
          [890, 175, 1],
        ].map(([x, y, sc], i) => (
          <TinyTree key={i} x={x} y={y} s={sc} c={i % 2 ? C.olive : C.forest} />
        ))}
        <Bird x={650} y={140} />
      </g>
    );
  return (
    <g aria-hidden>
      <path d="M0 0 H400 V60 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124 Z" fill={C.waterLight} />
      <path d="M400 60 C350 80 300 70 250 90 C190 112 140 90 80 110 C40 122 16 116 0 124" fill="none" stroke={tone(C.waterLight, 0.86)} strokeWidth="1" />
      <Waves x={50} y={44} n={2} />
      <Mountains x={20} y={620} s={1} o={0.8} />
      <Mountains x={250} y={770} s={0.9} o={0.8} />
      {[
        [40, 960, 1.1],
        [350, 1040, 1],
        [30, 300, 1],
        [360, 520, 1],
      ].map(([x, y, sc], i) => (
        <TinyTree key={i} x={x} y={y} s={sc} c={i % 2 ? C.olive : C.forest} />
      ))}
    </g>
  );
}

// ───────────── 다음 권 (잠긴 책 표지 미리보기)

function NextBooks() {
  const done = PROGRESS.filter((p) => p.status === 'clear').length;
  return (
    <section className="f-next" aria-labelledby="f-next-t">
      <h2 id="f-next-t" className="f-h2">
        다음 권 미리 보기
      </h2>
      <div className="f-next-row">
        {[
          { no: 2 as const, t: '바다 여행', d: '종이배를 타고 배운 주문을 섞어 더 큰 문제를 풀어요' },
          { no: 3 as const, t: '발명가의 공방', d: '톱니와 전구로 나만의 게임과 그림을 만들어요' },
        ].map((b) => (
          <article key={b.no} className={`f-next-book f-book-${b.no}`}>
            <div className="f-next-cover">
              <CoverArt book={b.no} />
              <span className="f-book-band">{b.no}권</span>
              <span className="f-book-clasp" aria-hidden>
                <Icon name="lock" size={22} strokeWidth={2.6} />
              </span>
            </div>
            <div className="f-next-info">
              <h3 className="f-h3">{b.t}</h3>
              <p>{b.d}</p>
              <div className="f-next-prog">
                <InkProgress value={done} max={7} label={`1권 진행 ${done}/7`} />
                <span className="f-muted">
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
      <div className="f-toc">
        <div className="f-toc-head">
          <svg viewBox="-70 -120 140 135" className="f-toc-art" aria-hidden>
            <Landmark stage={p.stage.order} mode="ink" />
          </svg>
          <div className="f-toc-titles">
            <span className="f-kicker">제{p.stage.order}장 · {p.status === 'clear' ? '통과한 곳' : '지금 모험 중'}</span>
            <h2 className="f-h2">{p.stage.title}</h2>
            <p className="f-muted">{p.stage.description}</p>
          </div>
        </div>
        <div className="f-toc-chest">
          <ChestIcon open={p.stars >= CHEST_GOAL} />
          <div className="f-toc-chest-txt">
            <b>
              별 보물상자 <span className="f-num">{Math.min(p.stars, CHEST_GOAL)}</span>/{CHEST_GOAL}
            </b>
            <InkProgress value={Math.min(p.stars, CHEST_GOAL)} max={CHEST_GOAL} label="보물상자까지 모은 별" tone="gold" />
          </div>
          <span className="f-toc-chest-note">{p.stars >= CHEST_GOAL ? '열었어요!' : `별 ${CHEST_GOAL - p.stars}개 더`}</span>
        </div>
        <h3 className="f-toc-k">차례</h3>
        <ol className="f-toc-list">
          {qs.map((q) => {
            const locked = q.stars < 0;
            const now = q.stars === 0;
            const review = q.stars > 0 && q.stars < 3;
            return (
              <li key={q.id}>
                <button type="button" className={`f-toc-row ${locked ? 'is-locked' : ''} ${now ? 'is-now' : ''}`} onClick={() => go(q)} aria-disabled={locked}>
                  <span className={`f-toc-no f-kind-${q.kind}`}>{q.kind === 'quiz' ? <Icon name="hint" size={18} strokeWidth={2.4} /> : q.label}</span>
                  <span className="f-toc-main">
                    <span className="f-toc-t">{q.title}</span>
                    <span className="f-toc-tags">
                      {q.kind !== 'code' && <span className={`f-tag f-tag-${q.kind}`}>{KIND_LABEL[q.kind]}</span>}
                      {q.challenge && <span className="f-tag f-tag-challenge">도전</span>}
                      {now && <span className="f-tag f-tag-now">지금 차례</span>}
                      {review && <span className="f-tag f-tag-review">별 채우기</span>}
                    </span>
                  </span>
                  <span className="f-toc-dots" aria-hidden />
                  <span className="f-toc-end">{locked ? <Icon name="lock" size={22} strokeWidth={2.4} label="잠김" /> : <Stars n={q.stars} size={22} />}</span>
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
    <svg viewBox="0 0 64 56" width="56" height="49" aria-hidden className="f-chest">
      <path d="M6 26 h52 v24 h-52z" fill={C.brass} stroke={tone(C.brass)} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={open ? 'M6 26 L10 6 H54 L58 26' : 'M6 26 C6 10 58 10 58 26 Z'} fill={C.woodDark} stroke={tone(C.woodDark)} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M26 24 h12 v12 h-12z" fill={C.mustard} stroke={tone(C.mustard)} strokeWidth="1.4" />
      <path d="M14 26 v24 M50 26 v24" stroke={tone(C.brass)} strokeWidth="1.2" opacity="0.6" />
    </svg>
  );
}
