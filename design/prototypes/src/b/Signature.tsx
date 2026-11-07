// 시안 B 시그니처 모션 (P2-05): #motion 무대 + 실제 흐름에서 쓰는 조각(해제 레이어·보상 진행·레벨업 오버레이)
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { Icon, RewardIcon } from '../shared/icons';
import { PybaemRig, PybaemStatic } from '../shared/rig/PybaemRig';
import { Byeolttongi } from '../shared/characters/Friends';
import { useMotion } from '../shared/motion';
import type { RigState } from '../shared/rig/params';
import { Scene, type BeatInfo, type M, type SceneSpec, type Tier } from './timeline';
import { buildLevelUp, buildSuccess, buildUnlock } from './beats';
import { Landmark, MagicBoxScene, TinyTree, Mountains, Compass, INK, C } from './art';
import { Hud, InkButton, Layer, Stars } from './ui';
import { getB, setB } from './state';

// ───────────── 단계 고르기 (도구 막대 따름 / 장면 안에서 덮어쓰기)

type Pick = 'auto' | Tier | 'reduced';
const PICKS: { id: Pick; label: string }[] = [
  { id: 'auto', label: '도구 막대' },
  { id: 'full', label: 'full' },
  { id: 'lite', label: 'lite' },
  { id: 'minimal', label: 'minimal' },
  { id: 'reduced', label: '동작 줄이기' },
];
function useM(pick: Pick): M {
  const g = useMotion();
  if (pick === 'auto') return { tier: g.tier, reduced: g.reduced };
  if (pick === 'reduced') return { tier: g.tier, reduced: true };
  return { tier: pick, reduced: false };
}
const mKey = (m: M) => (m.reduced ? 'reduced' : m.tier);
/**
 * 축하 장면 안의 파이뱀 리그 단계: full이어도 lite로 (B 리그의 "선 떨림"은 SVG 변위 필터를 8fps로 다시 그려 비싸다.
 * CPU 4배에서 리그를 끄면 장면 rAF p95가 50→33ms로 줄었다 — 축하 순간에는 도장·별이 주인공이라 선 떨림을 쉰다)
 */
const rigTier = (m: M): Tier => (m.tier === 'full' ? 'lite' : m.tier);

// 장면별 단계 차이 (한 줄 설명)
const NOTES: Record<'unlock' | 'success' | 'levelup', Record<'full' | 'lite' | 'minimal' | 'reduced', string>> = {
  unlock: {
    full: '도장 쾅(흔들림·잉크 튐) → 잉크 길 900ms → 잉크 방울 → 얼룩 모양으로 번지며 스테이지가 깨어남 → 파이뱀 깡충 3번 → 이름표 팝 + "열렸어요!" 도장',
    lite: '흔들림·잉크 튐·방울 없음, 길 400ms, 동그란 번짐 360ms, 파이뱀은 미끄러져 이동, 이름표는 face 스프링 (전체 약 60%)',
    minimal: '모든 비트가 150ms 페이드. 파이뱀은 순간 이동, 리그는 상태 전환만',
    reduced: '움직임 0. 도장·길·색이 입혀진 스테이지·이름표가 순서대로 즉시 바뀌고 "열렸어요!" 글자로 알림. 파이뱀은 몸 정지 + 느린 눈 깜빡임',
  },
  success: {
    full: '버튼 꾹(jellyB) → 출력 잉크 번짐 → "통과!" 도장 쾅 → 쪽 넘김 700ms → 파이뱀 환호 → 별이 도장처럼 하나씩 → 코인 5개 포물선 → HUD 팝·숫자 올리기·XP 채움 → 버튼 팝',
    lite: '넘김 대신 공책을 24px 밀어내며 사라짐, 별 간격 240ms(face), 코인 2개(30%), 흔들림·잉크 튐 없음',
    minimal: '페이드만. 코인 비행 없이 HUD 숫자 즉시 교체, 별은 120ms 간격 페이드',
    reduced: '움직임 0. 도장·보상 쪽·별·숫자가 즉시 바뀌고 "+25" 배지 색으로 강조. 파이뱀은 표정·후광 색만',
  },
  levelup: {
    full: 'XP 바 가득 → 넘친 잉크 방울이 도장으로 → 도장이 책장처럼 뒤집히며 4→5 + 잉크 고리 → "레벨 업!" 번짐 + 종이 조각 24개 → 별똥이 곡선 비행·착지 → 새 칭호 도장 → 스티커 팝 → XP 바 새로',
    lite: '방울·잉크 고리 없음, 종이 조각 7개(30%), 별똥이 직선 비행 500ms, 길이 70%',
    minimal: '페이드만, 종이 조각 0, 별똥이는 제자리에 나타남',
    reduced: '움직임 0. 도장 숫자가 즉시 바뀌고 노란 테두리로 강조, 칭호·스티커 글자로 알림. 별똥이·파이뱀 정지',
  },
};

// ═════════════ 해제 레이어 (월드맵과 #motion 미니 지도가 함께 씀)

export interface UnlockLayerHandle {
  els: () => {
    stamp: HTMLElement;
    splats: HTMLElement[];
    path: SVGPathElement;
    inkLayer: HTMLElement;
    drop: HTMLElement;
    lock: HTMLElement;
    banner: HTMLElement;
  };
}

export const UnlockLayer = forwardRef<
  UnlockLayerHandle,
  { w: number; h: number; from: [number, number]; to: [number, number]; toStage: number; d: string; scale: number; armed: boolean; open: boolean; stampSize?: number; lockIdle?: boolean }
>(function UnlockLayer({ w, h, from, to, toStage, d, scale, armed, open, stampSize = 58, lockIdle = false }, ref) {
  const stamp = useRef<HTMLSpanElement | null>(null);
  const splatHost = useRef<HTMLSpanElement | null>(null);
  const path = useRef<SVGPathElement | null>(null);
  const inkLayer = useRef<HTMLDivElement | null>(null);
  const drop = useRef<HTMLSpanElement | null>(null);
  const lock = useRef<HTMLSpanElement | null>(null);
  const banner = useRef<HTMLSpanElement | null>(null);
  useImperativeHandle(ref, () => ({
    els: () => ({
      stamp: stamp.current!,
      splats: [...(splatHost.current?.children ?? [])] as HTMLElement[],
      path: path.current!,
      inkLayer: inkLayer.current!,
      drop: drop.current!,
      lock: lock.current!,
      banner: banner.current!,
    }),
  }));
  const pct = (x: number, y: number): CSSProperties => ({ left: `${(x / w) * 100}%`, top: `${(y / h) * 100}%` });
  return (
    <div className={`b-ul ${armed ? 'is-armed' : ''} ${lockIdle ? 'is-lockidle' : ''}`} aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} className="b-ul-svg">
        <path ref={path} d={d} fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" className="b-ul-road" />
      </svg>
      {/* 잉크 번짐 레이어: 랜드마크 둘레 작은 상자 (마스크 중심이 크기와 상관없이 고정되게) */}
      <div
        className="b-ul-ink"
        ref={inkLayer}
        style={{ left: `${((to[0] - IB.w / 2) / w) * 100}%`, top: `${((to[1] - IB.top) / h) * 100}%`, width: `${(IB.w / w) * 100}%`, height: `${(IB.h / h) * 100}%` }}
      >
        <svg viewBox={`${to[0] - IB.w / 2} ${to[1] - IB.top} ${IB.w} ${IB.h}`}>
          <g transform={`translate(${to[0]} ${to[1] + 6}) scale(${scale})`}>
            <Landmark stage={toStage} mode="ink" />
          </g>
        </svg>
      </div>
      <span className="b-ul-at" style={pct(from[0], from[1])}>
        <span className="b-stamp b-ul-stamp" ref={stamp} style={{ width: stampSize, height: stampSize }}>
          <span>통과</span>
        </span>
        <span className="b-ul-splats" ref={splatHost}>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} className="b-ul-splat" />
          ))}
        </span>
      </span>
      <span className="b-ul-at" style={pct(to[0], to[1])}>
        <span className="b-ul-drop" ref={drop} />
        <span className={`b-ul-lock ${open && !armed ? 'is-gone' : ''}`} ref={lock}>
          <Icon name="lock" size={22} strokeWidth={2.6} />
        </span>
        <span className="b-ul-banner" ref={banner}>
          열렸어요!
        </span>
      </span>
    </div>
  );
});

/** 잉크 번짐 상자 (viewBox 단위): 랜드마크 바닥 기준 위로 top, 폭 w, 높이 h */
export const IB = { w: 170, top: 130, h: 138 };

/** 길 위 점들 (viewBox 좌표 → 화면 px 이동량) */
export function samplePath(path: SVGPathElement, svgW: number, boxW: number, n = 13) {
  const len = path.getTotalLength();
  const k = boxW / svgW;
  const p0 = path.getPointAtLength(0);
  return Array.from({ length: n }, (_, i) => {
    const p = path.getPointAtLength((len * i) / (n - 1));
    return { x: (p.x - p0.x) * k, y: (p.y - p0.y) * k };
  });
}

/** Catmull-Rom 한 구간 (지도와 같은 곡선) */
export function segment(pts: [number, number][], i: number): string {
  const p0 = pts[i - 1] ?? pts[i];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[i + 2] ?? p2;
  const t = 0.5 / 3;
  return `M${p1[0]} ${p1[1]} C${p1[0] + (p2[0] - p0[0]) * t} ${p1[1] + (p2[1] - p0[1]) * t} ${p2[0] - (p3[0] - p1[0]) * t} ${p2[1] - (p3[1] - p1[1]) * t} ${p2[0]} ${p2[1]}`;
}

// ═════════════ 장면 카드 (무대 + 조작 + 단계 비교 + 타임라인)

interface StageApi {
  build: (m: M) => SceneSpec;
}

function SceneCard({
  id,
  no,
  title,
  desc,
  extra,
  children,
  note,
  pick,
  setPick,
  m,
  stageRef,
  rebuildKey,
}: {
  id: 'unlock' | 'success' | 'levelup';
  no: number;
  title: string;
  desc: string;
  extra?: ReactNode;
  children: ReactNode;
  note: string;
  pick: Pick;
  setPick: (p: Pick) => void;
  m: M;
  stageRef: MutableRefObject<StageApi | null>;
  rebuildKey: string;
}) {
  const scene = useRef<Scene | null>(null);
  const head = useRef<HTMLSpanElement | null>(null);
  const clock = useRef<HTMLSpanElement | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const [beats, setBeats] = useState<{ beats: BeatInfo[]; total: number }>({ beats: [], total: 1 });
  const [playing, setPlaying] = useState(false);
  const seen = useRef(false);

  const tick = (t: number) => {
    const total = scene.current?.spec.total ?? 1;
    if (head.current) head.current.style.transform = `translateX(${(Math.min(t, total) / total) * 100}cqw)`;
    // 글자 바꾸기는 레이아웃을 부르므로 10Hz로만
    const tt = Math.round(Math.min(t, total) / 100) * 100;
    if (clock.current && clock.current.dataset.t !== String(tt)) {
      clock.current.dataset.t = String(tt);
      clock.current.textContent = `${t >= total ? total : tt} / ${total}ms`;
    }
  };
  const make = () => {
    scene.current?.stop();
    const api = stageRef.current;
    if (!api) return null;
    const s = new Scene(api.build(m));
    s.onTick = tick;
    s.onEnd = () => setPlaying(false);
    scene.current = s;
    setBeats({ beats: s.spec.beats, total: s.spec.total });
    return s;
  };
  const play = () => {
    const s = make();
    if (!s) return;
    s.play();
    setPlaying(true);
  };
  const seek = (t: number) => {
    const s = scene.current ?? make();
    s?.seek(t);
    setPlaying(false);
  };
  // 디버그·스크린샷용 전역 핸들
  useEffect(() => {
    const w = window as unknown as { __bScenes?: Record<string, unknown> };
    w.__bScenes = { ...(w.__bScenes ?? {}), [id]: { play, seek: (t: number) => seek(t), total: () => scene.current?.spec.total ?? 0 } };
  });
  // 처음 보일 때 한 번 자동 재생
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es[0].isIntersecting && !seen.current) {
          seen.current = true;
          play();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // 단계·별 개수가 바뀌면 다시 재생
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    requestAnimationFrame(play);
  }, [rebuildKey]);
  useEffect(() => () => scene.current?.stop(), []);

  const lanes = Math.max(1, ...beats.beats.map((b) => (b.lane ?? 0) + 1));
  return (
    <section className="bm-card" ref={card} aria-labelledby={`bm-${id}-t`}>
      <header className="bm-card-head">
        <span className="bm-no">{no}</span>
        <div className="bm-card-titles">
          <h2 id={`bm-${id}-t`} className="b-h2">
            {title}
          </h2>
          <p className="b-muted">{desc}</p>
        </div>
        <div className="bm-ctrl">
          <InkButton variant="primary" size="sm" icon="refresh" onClick={play}>
            다시 보기
          </InkButton>
          <InkButton
            variant="paper"
            size="sm"
            icon={playing ? 'pause' : 'play'}
            onClick={() => {
              const s = scene.current;
              if (!s) return play();
              if (s.playing) {
                s.pause();
                setPlaying(false);
              } else if (s.t < s.spec.total) {
                s.resume();
                setPlaying(true);
              } else play();
            }}
          >
            {playing ? '멈춤' : '계속'}
          </InkButton>
        </div>
      </header>
      <div className="bm-opts">
        <div className="bm-seg" role="group" aria-label={`${title} 연출 단계`}>
          {PICKS.map((p) => (
            <button key={p.id} type="button" aria-pressed={pick === p.id} onClick={() => setPick(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {extra}
      </div>
      <p className="bm-note">
        <b>{mKey(m) === 'reduced' ? '동작 줄이기' : m.tier}</b> {note}
      </p>
      <div className="bm-stage">{children}</div>
      <div className="bm-tl">
        <div className="bm-tl-head">
          <span>타임라인 · 눌러서 그 순간에 멈추기</span>
          <span className="bm-tl-clock" ref={clock}>
            0 / {beats.total}ms
          </span>
        </div>
        <div
          className="bm-tl-bar"
          style={{ height: lanes * 22 + 18 }}
          role="slider"
          tabIndex={0}
          aria-label="장면 시각"
          aria-valuemin={0}
          aria-valuemax={beats.total}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek(((e.clientX - r.left) / r.width) * beats.total);
          }}
          onKeyDown={(e) => {
            const s = scene.current;
            if (!s) return;
            if (e.key === 'ArrowRight') seek(s.t + 100);
            if (e.key === 'ArrowLeft') seek(s.t - 100);
          }}
        >
          {beats.beats.map((b, i) => (
            <span
              key={i}
              className={`bm-tl-beat bm-lane-${b.lane ?? 0}`}
              title={`${b.label} · ${b.start}ms +${b.dur}ms · ${b.ease}`}
              style={{ left: `${(b.start / beats.total) * 100}%`, width: `max(4px, ${(b.dur / beats.total) * 100}%)`, top: (b.lane ?? 0) * 22 + 4 }}
            />
          ))}
          <span className="bm-tl-head-line" ref={head} />
        </div>
        <details className="bm-tl-list">
          <summary>비트 표 ({beats.beats.length}개)</summary>
          <table>
            <thead>
              <tr>
                <th>비트</th>
                <th>시작</th>
                <th>길이</th>
                <th>스프링·easing</th>
              </tr>
            </thead>
            <tbody>
              {[...beats.beats]
                .sort((a, b) => a.start - b.start)
                .map((b, i) => (
                  <tr key={i}>
                    <td>
                      <i className={`bm-dot bm-lane-${b.lane ?? 0}`} /> {b.label}
                    </td>
                    <td>{b.start}</td>
                    <td>{b.dur}</td>
                    <td>{b.ease}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}

// ═════════════ 1. 스테이지 해제 무대 (지도 조각)

const UL = { w: 600, h: 300, pts: [[90, 250], [290, 214], [470, 130]] as [number, number][], scale: 0.85 };

function UnlockStage({ api, m }: { api: MutableRefObject<StageApi | null>; m: M }) {
  const layer = useRef<UnlockLayerHandle | null>(null);
  const paper = useRef<HTMLDivElement | null>(null);
  const py = useRef<HTMLDivElement | null>(null);
  const plate = useRef<HTMLSpanElement | null>(null);
  const [rig, setRig] = useState<RigState>('idle');
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const d23 = useMemo(() => segment(UL.pts, 1), []);
  const d12 = useMemo(() => segment(UL.pts, 0), []);
  api.current = {
    build: (mm) => {
      setArmed(true);
      const e = layer.current!.els();
      const box = paper.current!.getBoundingClientRect();
      return buildUnlock(
        {
          ...e,
          paper: paper.current!,
          inkOrigin: '50% 62%',
          inkSize: '330% 330%',
          py: py.current!,
          pyPts: samplePath(e.path, UL.w, box.width),
          plate: plate.current!,
          onRig: setRig,
          onOpen: setOpen,
        },
        mm,
      );
    },
  };
  const pct = (x: number, y: number): CSSProperties => ({ left: `${(x / UL.w) * 100}%`, top: `${(y / UL.h) * 100}%` });
  return (
    <div className="bm-ul" ref={paper}>
      <svg viewBox={`0 0 ${UL.w} ${UL.h}`} className="bm-ul-map" aria-hidden>
        <path d="M0 0 H600 V40 C520 60 460 30 380 50 C300 70 240 40 160 56 C90 70 40 50 0 64Z" fill="#CFE0E6" />
        <path d="M600 40 C520 60 460 30 380 50 C300 70 240 40 160 56 C90 70 40 50 0 64" fill="none" stroke={INK} strokeWidth="2" />
        <Mountains x={150} y={150} s={1.1} />
        <Mountains x={380} y={250} s={0.9} />
        <TinyTree x={40} y={170} s={1.2} />
        <TinyTree x={560} y={250} s={1.1} c={C.olive} />
        <TinyTree x={250} y={290} s={1} />
        <Compass x={548} y={210} r={30} />
        <path d={`${d12} ${d23.replace('M', 'L').split(' C')[0]}`} fill="none" stroke={C.sand} strokeWidth="20" strokeLinecap="round" opacity="0.75" />
        <path d={d23} fill="none" stroke={C.sand} strokeWidth="20" strokeLinecap="round" opacity="0.75" />
        <path d={d12} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
        <path d={d23} fill="none" stroke="#8A7356" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="2 9" />
        {UL.pts.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y + 6}) scale(${UL.scale})`}>
            <Landmark stage={i + 2} mode={i === 2 ? 'pencil' : 'ink'} />
          </g>
        ))}
      </svg>
      <UnlockLayer ref={layer} w={UL.w} h={UL.h} from={UL.pts[1]} to={UL.pts[2]} toStage={4} d={d23} scale={UL.scale} armed={armed} open={open} stampSize={52} lockIdle />
      {UL.pts.map(([x, y], i) => {
        const st = i === 0 ? 'clear' : i === 1 ? (open ? 'clear' : 'current') : open ? 'current' : 'locked';
        return (
          <span key={i} className={`bm-plate is-${st}`} style={pct(x, y)} ref={i === 2 ? plate : undefined}>
            <b>{i + 2}</b> {['변수의 숲', '조건의 갈림길', '반복의 동굴'][i]}
            <small>{st === 'locked' ? '잠김' : i === 2 ? '★ 0/24' : i === 1 ? '★ 8/24' : '★ 19/24'}</small>
          </span>
        );
      })}
      <div className="bm-ul-py" ref={py} style={pct(UL.pts[1][0], UL.pts[1][1])}>
        <div className="bm-ul-py-in">
          <span className="bm-rig-iso">
            <PybaemRig style="B" state={rig} size={84} tier={rigTier(m)} reducedMotion={m.reduced} lookAt={false} />
          </span>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {open ? '반복의 동굴이 열렸어요!' : ''}
      </p>
    </div>
  );
}

// ═════════════ 2. 퀘스트 성공 무대 (책 펼침: 공책 장이 넘어가며 보상 쪽)

function SuccessStage({ api, m, stars }: { api: MutableRefObject<StageApi | null>; m: M; stars: number }) {
  const host = useRef<HTMLDivElement | null>(null);
  const face = useRef<HTMLSpanElement | null>(null);
  const slip = useRef<HTMLDivElement | null>(null);
  const stamp = useRef<HTMLSpanElement | null>(null);
  const leaf = useRef<HTMLDivElement | null>(null);
  const paper = useRef<HTMLDivElement | null>(null);
  const splats = useRef<HTMLSpanElement | null>(null);
  const starsRef = useRef<HTMLSpanElement | null>(null);
  const coinFrom = useRef<HTMLSpanElement | null>(null);
  const coins = useRef<HTMLSpanElement | null>(null);
  const chip = useRef<HTMLSpanElement | null>(null);
  const num = useRef<HTMLSpanElement | null>(null);
  const xp = useRef<HTMLSpanElement | null>(null);
  const plus = useRef<HTMLSpanElement | null>(null);
  const cta = useRef<HTMLDivElement | null>(null);
  const [rig, setRig] = useState<RigState>('talk');
  const coinsGain = 10 + stars * 5;
  api.current = {
    build: (mm) =>
      buildSuccess(
        {
          host: host.current!,
          btnFace: face.current,
          slip: slip.current,
          stamp: stamp.current,
          paper: paper.current,
          splats: [...(splats.current?.children ?? [])] as HTMLElement[],
          leaf: leaf.current,
          stars: [...(starsRef.current?.querySelectorAll<HTMLElement>('.bm-star-on') ?? [])],
          coinFrom: coinFrom.current!,
          coins: [...(coins.current?.children ?? [])] as HTMLElement[],
          coinChip: chip.current!,
          coinNum: num.current,
          xpFill: xp.current,
          xpFrom: 0.2,
          xpTo: 0.3,
          plus: plus.current,
          cta: cta.current,
          coinsFrom: 1280,
          coinsTo: 1280 + coinsGain,
          onRig: setRig,
        },
        mm,
        stars,
      ),
  };
  return (
    <div className="bm-succ" ref={host}>
      <div className="bm-hud" aria-hidden>
        <span className="b-seal">
          <span className="b-seal-n">4</span>
        </span>
        <span className="b-xpbar bm-hud-xp">
          <span className="b-xpbar-fill" ref={xp} style={{ transform: 'scaleX(0.3)' }} />
        </span>
        <span className="b-chip" ref={chip}>
          <RewardIcon kind="coin" style="B" size={24} />
          <span className="b-num" ref={num}>
            {(1280 + coinsGain).toLocaleString('ko-KR')}
          </span>
        </span>
        <span className="bm-plus" ref={plus}>
          +{coinsGain}
        </span>
      </div>
      <div className="bm-book">
        <div className="bm-lpage">
          <span className="b-kicker">퀘스트 2-1</span>
          <b className="bm-lpage-t">마법 상자에 이름 넣기</b>
          <div className="bm-lpage-art">
            <MagicBoxScene />
          </div>
        </div>
        <div className="bm-rpage">
          <div className="bm-under">
            <div className="bm-under-top">
              <span className="bm-rig-iso">
                <PybaemRig style="B" state={rig} size={92} tier={rigTier(m)} reducedMotion={m.reduced} lookAt={false} />
              </span>
              <div className="bm-under-say">{rig === 'talk' ? '주문을 돌려 볼까?' : '해냈다! 별을 모아 봐요!'}</div>
            </div>
            <div className="bm-reward">
              <span className="b-kicker">퀘스트 통과</span>
              <span className="bm-stars" ref={starsRef} role="img" aria-label={`별 ${stars}개`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="bm-star">
                    <RewardIcon kind="starEmpty" style="B" size={44} />
                    {i < stars && (
                      <span className="bm-star-on">
                        <RewardIcon kind="star" style="B" size={44} />
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <span className="bm-gain">
                <span ref={coinFrom}>
                  <RewardIcon kind="coin" style="B" size={28} />
                </span>
                +{coinsGain} 코인 · +50 경험치
              </span>
            </div>
            <div className="bm-cta" ref={cta}>
              <InkButton variant="primary" iconRight="arrowRight" tabIndex={-1}>
                다음 퀘스트
              </InkButton>
            </div>
          </div>
          <div className="bm-leaf" ref={leaf}>
            <div className="bm-leaf-front" ref={paper}>
              <span className="bm-nb-t">
                <Icon name="code" size={18} strokeWidth={2.4} /> 나의 주문 공책
              </span>
              <pre className="bm-nb-code">
                <span className="tk-c"># 변수에 이름을 넣어보세요!</span>
                {'\nname = '}
                <span className="tk-s">"파이뱀"</span>
                {'\n'}
                <span className="tk-f">print</span>
                {'(name)'}
              </pre>
              <span className="b-btn b-btn-primary b-btn-sm bm-nb-run">
                <span className="b-btn-face" ref={face}>
                  <Icon name="play" size={20} strokeWidth={2.4} />
                  <span className="b-btn-label">코드 돌려보기</span>
                </span>
              </span>
              <div className="bm-nb-slip" ref={slip}>
                <small>나온 글자</small>
                <b>파이뱀</b>
              </div>
              <span className="b-stamp b-stamp-big bm-nb-stamp" ref={stamp}>
                <span>통과!</span>
              </span>
              <span className="bm-splats" ref={splats}>
                {Array.from({ length: 6 }, (_, i) => (
                  <i key={i} className="b-ul-splat" />
                ))}
              </span>
            </div>
            <div className="bm-leaf-back">
              <span className="b-kicker">다음 장</span>
              <b>숫자 상자와 글자 상자</b>
              <svg viewBox="-70 -110 140 120" aria-hidden>
                <Landmark stage={2} mode="pencil" />
              </svg>
            </div>
            <div className="bm-leaf-shade" />
          </div>
        </div>
      </div>
      <span className="bm-coins" ref={coins} aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="bm-coin">
            <RewardIcon kind="coin" style="B" size={26} />
          </span>
        ))}
      </span>
    </div>
  );
}

// ═════════════ 3. 레벨업 무대

const LV_FROM = { lv: 4, xp: 470, next: 500 };
const LV_GAIN = 50;

function LevelUpStage({
  api,
  m,
  from = LV_FROM,
  gain = LV_GAIN,
  onCta,
}: {
  api: MutableRefObject<StageApi | null>;
  m: M;
  from?: { lv: number; xp: number; next: number };
  gain?: number;
  onCta?: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const fill = useRef<HTMLSpanElement | null>(null);
  const xpNum = useRef<HTMLSpanElement | null>(null);
  const drip = useRef<HTMLSpanElement | null>(null);
  const seal = useRef<HTMLSpanElement | null>(null);
  const sealNum = useRef<HTMLSpanElement | null>(null);
  const ring = useRef<HTMLSpanElement | null>(null);
  const title = useRef<HTMLDivElement | null>(null);
  const conf = useRef<HTMLSpanElement | null>(null);
  const star = useRef<HTMLDivElement | null>(null);
  const bubble = useRef<HTMLDivElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const sticker = useRef<HTMLDivElement | null>(null);
  const cta = useRef<HTMLDivElement | null>(null);
  const [rig, setRig] = useState<RigState>('happy');
  const [mood, setMood] = useState<'flying' | 'landing' | 'sparkling'>('sparkling');
  const over = from.xp + gain - from.next;
  api.current = {
    build: (mm) => {
      const h = host.current!.getBoundingClientRect();
      const s = star.current!.getBoundingClientRect();
      return buildLevelUp(
        {
          host: host.current!,
          xpFill: fill.current!,
          xpNum: xpNum.current!,
          drip: drip.current!,
          seal: seal.current!,
          sealNum: sealNum.current!,
          ring: ring.current!,
          title: title.current!,
          confetti: [...(conf.current?.children ?? [])] as HTMLElement[],
          star: star.current!,
          starFrom: { x: h.right - s.left + 40, y: h.top - s.top - 60 },
          bubble: bubble.current!,
          titleCard: card.current!,
          sticker: sticker.current!,
          cta: cta.current!,
          from,
          gain,
          onRig: setRig,
          onStar: setMood,
        },
        mm,
      );
    },
  };
  return (
    <div className="bm-lv" ref={host}>
      <div className="bm-lv-top">
        <span className="bm-lv-sealwrap">
          <span className="bm-lv-ring" ref={ring} aria-hidden />
          <span className="b-seal bm-lv-seal" ref={seal}>
            <span className="b-seal-n" ref={sealNum}>
              {from.lv + 1}
            </span>
          </span>
        </span>
        <div className="bm-lv-xp">
          <span className="bm-lv-xpk">경험치</span>
          <span className="b-xpbar bm-lv-bar">
            <span className="b-xpbar-fill" ref={fill} style={{ transform: `scaleX(${over / 600})` }} />
          </span>
          <span className="bm-lv-xpn" ref={xpNum}>
            {over} / 600
          </span>
          <span className="bm-lv-drip" ref={drip} aria-hidden />
        </div>
      </div>
      <div className="bm-lv-title" ref={title}>
        <span className="b-kicker">레벨 업!</span>
        <b>레벨 {from.lv + 1} 달성</b>
      </div>
      <span className="bm-conf" ref={conf} aria-hidden>
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} className={`bm-conf-${i % 4}`} />
        ))}
      </span>
      <div className="bm-lv-row">
        <div className="bm-lv-py">
          <span className="bm-rig-iso">
            <PybaemRig style="B" state={rig} size={104} tier={rigTier(m)} reducedMotion={m.reduced} lookAt={false} />
          </span>
        </div>
        <div className="bm-lv-starbox">
          <div className="bm-lv-star" ref={star}>
            <Byeolttongi style="B" mood={mood} size={78} motion="none" label="별똥이" />
          </div>
          <div className="bm-lv-bubble b-bubble" ref={bubble}>
            <span className="b-bubble-who">별똥이</span>
            <p className="b-bubble-t">새 칭호랑 선물을 가져왔어!</p>
          </div>
        </div>
      </div>
      <div className="bm-lv-cards">
        <div className="bm-lv-card" ref={card}>
          <small>새 칭호</small>
          <b>숲 마을 탐험가</b>
        </div>
        <div className="bm-lv-sticker" ref={sticker}>
          <PybaemStatic style="B" state="happy" size={64} costume={{ hat: 'explorer' }} idPrefix="lvhat" />
          <span>
            <small>새로 열린 꾸미기</small>
            <b>탐험가 모자</b>
          </span>
        </div>
      </div>
      <div className="bm-cta bm-lv-cta" ref={cta}>
        <InkButton variant="primary" onClick={onCta} tabIndex={onCta ? 0 : -1} data-autofocus>
          좋아!
        </InkButton>
      </div>
    </div>
  );
}

// ═════════════ #motion 화면

export function MotionScreen() {
  const [p1, setP1] = useState<Pick>('auto');
  const [p2, setP2] = useState<Pick>('auto');
  const [p3, setP3] = useState<Pick>('auto');
  const [stars, setStars] = useState(3);
  const m1 = useM(p1);
  const m2 = useM(p2);
  const m3 = useM(p3);
  const a1 = useRef<StageApi | null>(null);
  const a2 = useRef<StageApi | null>(null);
  const a3 = useRef<StageApi | null>(null);
  return (
    <>
      <Hud back={{ to: 'world', label: '지도' }} />
      <main className="bm">
        <div className="bm-intro">
          <span className="b-kicker">P2-05 · 시안 B 마법 그림책</span>
          <h1 className="b-h1">시그니처 모션</h1>
          <p className="b-muted">
            페이지 넘김 · 잉크 번짐 · 스탬프 쾅을 세 장면에 녹였어요. 장면마다 단계를 바꿔 비교하고, 아래 타임라인을 누르면 그 순간에 멈춰 볼 수 있어요.
          </p>
        </div>
        <SceneCard
          id="unlock"
          no={1}
          title="스테이지 해제"
          desc="통과 도장 → 잉크 길이 이어지고 → 연필 스케치였던 스테이지가 잉크로 깨어나고 → 파이뱀이 깡충깡충 → 이름표·별 진행"
          note={NOTES.unlock[mKey(m1)]}
          pick={p1}
          setPick={setP1}
          m={m1}
          stageRef={a1}
          rebuildKey={mKey(m1)}
        >
          <UnlockStage api={a1} m={m1} />
        </SceneCard>
        <SceneCard
          id="success"
          no={2}
          title="퀘스트 성공"
          desc="실행 → 통과 도장 → 쪽이 넘어가며 보상 쪽 → 파이뱀 환호 → 별이 하나씩 → 코인·경험치가 HUD로 → 다음 퀘스트"
          note={NOTES.success[mKey(m2)]}
          pick={p2}
          setPick={setP2}
          m={m2}
          stageRef={a2}
          rebuildKey={`${mKey(m2)}-${stars}`}
          extra={
            <div className="bm-seg bm-seg-stars" role="group" aria-label="받은 별 개수">
              {[1, 2, 3].map((n) => (
                <button key={n} type="button" aria-pressed={stars === n} onClick={() => setStars(n)}>
                  ★ {n}
                </button>
              ))}
            </div>
          }
        >
          <SuccessStage key={stars} api={a2} m={m2} stars={stars} />
        </SceneCard>
        <SceneCard
          id="levelup"
          no={3}
          title="레벨업"
          desc="경험치가 넘쳐 → 레벨 도장이 책장처럼 뒤집히며 숫자가 바뀌고 → 별똥이가 새 칭호와 꾸미기를 가져와요"
          note={NOTES.levelup[mKey(m3)]}
          pick={p3}
          setPick={setP3}
          m={m3}
          stageRef={a3}
          rebuildKey={mKey(m3)}
        >
          <LevelUpStage api={a3} m={m3} />
        </SceneCard>
      </main>
    </>
  );
}

// ═════════════ 실제 흐름: 퀘스트 보상 진행 + 레벨업 오버레이

/**
 * 보상 시트 안에서 퀘스트 성공 장면의 뒷부분(별 → 코인이 진짜 HUD로 → XP)을 같은 빌더로 재생.
 * XP가 넘치면 끝난 뒤 레벨업 오버레이를 연다.
 */
export function RewardRun({ stars, coins, xp, onLevelUp }: { stars: number; coins: number; xp: number; onLevelUp: (from: { lv: number; xp: number; next: number }) => void }) {
  const g = useMotion();
  const fly = useRef<HTMLDivElement | null>(null);
  const starsRef = useRef<HTMLSpanElement | null>(null);
  const coinFrom = useRef<HTMLSpanElement | null>(null);
  const coinsRef = useRef<HTMLSpanElement | null>(null);
  const plus = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let sc: Scene | null = null;
    let total = 0;
    const s0 = getB();
    // 시트를 붙이는 작업과 같은 태스크에서 강제 레이아웃을 부르지 않게, 측정·빌드는 시트가 올라온 뒤에
    const id = window.setTimeout(() => {
    const chip = document.querySelector<HTMLElement>('[data-b-hud] .b-chip-coin');
    if (!fly.current || !chip || !coinFrom.current) return;
    const from = { lv: s0.level, xp: s0.xp, next: s0.xpNext };
    const overflow = s0.xp + xp >= s0.xpNext;
    const spec = buildSuccess(
      {
        host: fly.current,
        btnFace: null,
        slip: null,
        stamp: null,
        paper: null,
        splats: [],
        leaf: null,
        stars: [...(starsRef.current?.querySelectorAll<HTMLElement>('.bm-star-on') ?? [])],
        coinFrom: coinFrom.current,
        coins: [...(coinsRef.current?.children ?? [])] as HTMLElement[],
        coinChip: chip,
        coinNum: null,
        xpFill: null,
        xpFrom: 0,
        xpTo: 0,
        plus: plus.current,
        cta: null,
        coinsFrom: s0.coins,
        coinsTo: s0.coins + coins,
        onCoins: (v) => setB({ coins: v }),
        onXp: () => setB((s) => ({ xp: Math.min(s.xpNext, s.xp + xp) })),
      },
      { tier: g.tier, reduced: g.reduced },
      stars,
    );
    sc = new Scene(spec);
    total = spec.total;
    sc.onEnd = () => {
      if (overflow) onLevelUp(from);
    };
    sc.play();
    }, 260);
    return () => {
      window.clearTimeout(id);
      if (sc) {
        sc.onEnd = undefined;
        sc.stop();
      }
      // 끝까지 못 봤어도 보상은 들어가야 한다
      if (!sc || sc.t < total) {
        setB((s) => ({ coins: Math.max(s.coins, s0.coins + coins), xp: Math.max(s.xp, Math.min(s.xpNext, s0.xp + xp)) }));
      }
    };
  }, []);
  return (
    <>
      <span className="bm-stars bm-stars-lg" ref={starsRef} role="img" aria-label={`별 ${stars}개`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="bm-star">
            <RewardIcon kind="starEmpty" style="B" size={54} />
            {i < stars && (
              <span className="bm-star-on">
                <RewardIcon kind="star" style="B" size={54} />
              </span>
            )}
          </span>
        ))}
      </span>
      <div className="b-reward-row">
        <span className="b-reward-item">
          <span ref={coinFrom}>
            <RewardIcon kind="coin" style="B" size={34} />
          </span>
          <b className="b-num">+{coins}</b>
          <span>코인</span>
          <span className="bm-plus bm-plus-inline" ref={plus}>
            HUD로 쏙!
          </span>
        </span>
        <span className="b-reward-item">
          <Icon name="sparkle" size={30} strokeWidth={2.2} />
          <b className="b-num">+{xp}</b>
          <span>경험치</span>
        </span>
      </div>
      <div className="bm-flylayer" ref={fly} aria-hidden>
        <span className="bm-coins" ref={coinsRef}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="bm-coin">
              <RewardIcon kind="coin" style="B" size={26} />
            </span>
          ))}
        </span>
      </div>
    </>
  );
}

/** 레벨업 오버레이 (실제 흐름). 같은 LevelUpStage + 빌더를 자동 재생 */
export function LevelUpOverlay({ from, gain, onDone }: { from: { lv: number; xp: number; next: number }; gain: number; onDone: () => void }) {
  const g = useMotion();
  const api = useRef<StageApi | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let sc: Scene | null = null;
    // 오버레이를 붙인 다음 프레임에 측정·재생 (붙이기와 강제 레이아웃을 한 태스크에 몰지 않음)
    const raf = requestAnimationFrame(() => {
      sc = new Scene(api.current!.build({ tier: g.tier, reduced: g.reduced }));
      sc.play();
    });
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      sc?.stop();
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <Layer>
    <div className="bm-over" role="dialog" aria-modal="true" aria-label={`레벨 ${from.lv + 1} 달성`}>
      <div className="bm-over-back" onClick={onDone} />
      <div className="bm-over-card" ref={box}>
        <LevelUpStage api={api} m={{ tier: g.tier, reduced: g.reduced }} from={from} gain={gain} onCta={onDone} />
      </div>
    </div>
    </Layer>
  );
}

export type { StageApi };
export { Stars };
