// 월드맵 (#world) + 스테이지 퀘스트 고르기 (#stage = 같은 지도 위에 바텀시트/오른쪽 패널)
// 바다 위 섬 7개(스테이지 = 섬 위 랜드마크), 섬 사이 나무다리(완료)·징검돌(잠김), 파이뱀이 길을 따라 통통 점프.
// 넓은 화면(≥900px)은 가로 지도, 좁은 화면은 세로 지도. 둘 다 같은 섬·랜드마크 컴포넌트를 쓴다.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { STAGES } from '../shared/content';
import { goScreen } from '../shared/app';
import { Icon, RewardIcon } from '../shared/icons';
import { getMotion, play, springTiming, tierDuration, useMotion } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { CloudShape, tone } from './clay';
import { Island, LANDMARKS, Landmark, Palm, WorldScene } from './scenes';
import { CURRENT_STAGE, questStars, setStore, stageStars, stageStatus, useStore } from './store';
import { ClayButton, Hud, Progress, Sheet, Stars, toast } from './ui';

interface Layout {
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

        {width > 0 && <IslandMap key={wide ? 'w' : 't'} L={L} wide={wide} selected={s.stage} sheetOpen={sheet} />}

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
              setStore({ stage: CURRENT_STAGE });
              goScreen('stage');
            }}
          >
            {STAGES[CURRENT_STAGE].title} 계속하기
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

function IslandMap({ L, wide, selected, sheetOpen }: { L: Layout; wide: boolean; selected: number; sheetOpen: boolean }) {
  const box = useRef<HTMLDivElement | null>(null);
  const width = useWide(box);
  const k = width ? width / L.w : 1;
  const [pos, setPos] = useState(() => (sheetOpen ? selected : CURRENT_STAGE - 1));
  const [hopping, setHopping] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [shake, setShake] = useState<number | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const shadow = useRef<HTMLDivElement | null>(null);
  const motion = useMotion();

  /** 파이뱀이 노드를 따라 통통 점프 (transform만). 끝나면 cb */
  const hopTo = (target: number, cb?: () => void) => {
    const m = getMotion();
    if (target === pos || m.reduced || m.tier === 'minimal' || !body.current || !shadow.current || !width) {
      setPos(target);
      if (m.tier === 'minimal' && !m.reduced) play(body.current, [{ opacity: 0.2 }, { opacity: 1 }], { duration: 150 });
      cb?.();
      return;
    }
    const path: number[] = [];
    const dir = target > pos ? 1 : -1;
    for (let i = pos + dir; dir > 0 ? i <= target : i >= target; i += dir) path.push(i);
    const pts = [pos, ...path].map((i) => L.nodes[i]);
    const hopMs = tierDuration(path.length > 2 ? 300 : 420);
    const bodyKf: Keyframe[] = [];
    const shKf: Keyframe[] = [];
    const segs = pts.length - 1;
    for (let sgi = 0; sgi < segs; sgi++) {
      const [ax, ay] = pts[sgi];
      const [bx, by] = pts[sgi + 1];
      const steps = 8;
      for (let st = sgi === 0 ? 0 : 1; st <= steps; st++) {
        const u = st / steps;
        const x = (ax + (bx - ax) * u) * k;
        const yBase = (ay + (by - ay) * u) * k;
        const arc = Math.sin(Math.PI * u) * (wide ? 90 : 70);
        const sq = st === steps ? 'scale(1.18, 0.82)' : st === 0 ? 'scale(1.1, 0.9)' : 'scale(0.95, 1.06)';
        const off = (sgi + u) / segs;
        bodyKf.push({ transform: `translate(${x}px, ${yBase - arc}px) ${sq}`, offset: off });
        shKf.push({ transform: `translate(${x}px, ${yBase}px) scale(${1 - Math.sin(Math.PI * u) * 0.45})`, offset: off });
      }
    }
    setHopping(true);
    const dur = hopMs * segs;
    body.current.animate(bodyKf, { duration: dur, easing: 'linear', fill: 'forwards' });
    const a = shadow.current.animate(shKf, { duration: dur, easing: 'linear', fill: 'forwards' });
    a.finished
      .then(() => {
        setPos(target);
        setHopping(false);
        requestAnimationFrame(() => {
          body.current?.getAnimations().forEach((x) => x.cancel());
          shadow.current?.getAnimations().forEach((x) => x.cancel());
          // 착지 젤리
          if (getMotion().tier === 'full') {
            body.current
              ?.querySelector('.a-py-squash')
              ?.animate([{ transform: 'scale(1.2, 0.8)' }, { transform: 'none' }], springTiming('jellyA'));
          }
        });
        cb?.();
      })
      .catch(() => {});
  };

  // 처음 들어오면 변수의 숲 → 조건의 갈림길로 통통 (현재 스테이지로 이동)
  useEffect(() => {
    if (!width) return;
    if (sheetOpen) return;
    const t = setTimeout(() => hopTo(CURRENT_STAGE), 650);
    return () => clearTimeout(t);
  }, [width > 0]);

  const tap = (i: number) => {
    const st = stageStatus(i);
    if (st === 'locked') {
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
  const bridges = useMemo(() => {
    return L.nodes.slice(1).map(([bx, by], i) => {
      const [ax, ay] = L.nodes[i];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy);
      const bend = (i % 2 ? 1 : -1) * len * 0.12;
      const cx = mx + (-dy / len) * bend;
      const cy = my + (dx / len) * bend;
      return { d: `M${ax} ${ay} Q${cx} ${cy} ${bx} ${by}`, done: i + 1 <= CURRENT_STAGE };
    });
  }, [L]);

  const ringOn = !motion.reduced;

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

          {/* 다리·징검돌 */}
          {bridges.map((b, i) =>
            b.done ? (
              <g key={i}>
                <path d={b.d} stroke="#A9703D" strokeWidth={wide ? 22 : 18} fill="none" strokeLinecap="round" transform="translate(0 6)" />
                <path d={b.d} stroke="#D9A066" strokeWidth={wide ? 22 : 18} fill="none" strokeLinecap="round" />
                <path d={b.d} stroke="#B97E47" strokeWidth={wide ? 22 : 18} fill="none" strokeDasharray="3 11" />
                <path d={b.d} stroke="#fff" strokeWidth="3" fill="none" opacity="0.35" strokeLinecap="round" transform="translate(0 -6)" />
              </g>
            ) : (
              <g key={i}>
                <path d={b.d} stroke="#A9B8CA" strokeWidth={wide ? 15 : 13} fill="none" strokeLinecap="round" strokeDasharray="0.1 30" transform="translate(0 4)" />
                <path d={b.d} stroke="#E3EAF2" strokeWidth={wide ? 15 : 13} fill="none" strokeLinecap="round" strokeDasharray="0.1 30" />
              </g>
            ),
          )}

          {/* 섬 + 랜드마크 */}
          {L.nodes.map(([x, y], i) => {
            const st = stageStatus(i);
            const big = i === 6 ? 1.2 : 1;
            return (
              <g
                key={i}
                className={`a-node-g${hover === i ? ' is-hover' : ''}${shake === i ? ' is-shake' : ''}${st === 'current' ? ' is-current' : ''}`}
              >
                {st === 'current' && ringOn && <ellipse className="a-node-ring m-loop" cx={x} cy={y + L.ry * 0.3} rx={L.rx * 1.3} ry={L.ry * 1.6} fill="none" stroke="#FFD84D" strokeWidth="6" />}
                <Island x={x} y={y} rx={L.rx * big} ry={L.ry * big} seed={i * 3 + 1} locked={st === 'locked'}>
                  <Landmark kind={LANDMARKS[i]} x={x + L.rx * 0.18} y={y - L.ry * 0.05} s={L.lm * big} locked={st === 'locked'} />
                </Island>
                {st === 'done' && (
                  <g transform={`translate(${x - L.rx * 0.62} ${y - L.ry * 0.2})`}>
                    <path d="M0 0 V-34" stroke="#A9703D" strokeWidth="3" strokeLinecap="round" />
                    <path d="M0 -34 L22 -27 L0 -20Z" fill="#FFD84D" />
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
              <PybaemRig state={hopping ? 'happy' : 'idle'} size={L.py} lookAt={false} />
            </div>
          </div>
        </div>

        {/* 노드 버튼 (글자·접근성) */}
        {L.nodes.map(([x, y], i) => {
          const st = stageStatus(i);
          const { got, max } = stageStars(i);
          const stage = STAGES[i];
          const stLabel = st === 'done' ? '완료' : st === 'current' ? '지금 하는 곳' : '잠김';
          return (
            <button
              key={i}
              type="button"
              className={`a-node a-node-${st}`}
              style={{ left: `${(x / L.w) * 100}%`, top: `${(y / L.h) * 100}%` }}
              onClick={() => tap(i)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
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
              {st === 'current' && (
                <span className="a-here m-loop" aria-hidden>
                  지금 여기!
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="a-clouds" aria-hidden>
        <CloudShape className="a-cloud a-cloud-1 m-ambient" w={wide ? 180 : 120} />
        <CloudShape className="a-cloud a-cloud-2 m-ambient" w={wide ? 130 : 90} />
        <CloudShape className="a-cloud a-cloud-3 m-ambient" w={wide ? 220 : 140} />
      </div>
    </div>
  );
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
