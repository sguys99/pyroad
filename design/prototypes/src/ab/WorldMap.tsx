// 월드맵 #world (+ #stage에서는 이 지도 위에 스테이지 시트)
// A의 바다 위 섬 지도 구조 + B의 종이: 섬은 종이 층으로 솟아오른 팝업, 길은 잉크 점선, 클리어는 도장
// 파이뱀은 길을 따라 통통 점프해서 이동 (A). 잠긴 섬은 접힌 종이처럼 누워 있다
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { goScreen } from '../shared/app';
import { Icon } from '../shared/icons';
import { getMotion, springTiming, tierDuration, useMotion } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { STAGES, WORLD1 } from '../shared/content';
import { Cloud, Compass, Islet, PaperBoat, PaperIsland, StampMark, WaveRow, WorldArt } from './art';
import { STAGE_BUILDING, stageStars, stageStatus } from './data';
import { buildUnlock } from './sig';
import { getAb, setAb, toast, useAb } from './store';
import { Timeline } from './timeline';
import { GameButton, Hud, Progress } from './ui';
import { StageSheet } from './StageSheet';

type Layout = 'wide' | 'tall';
const VB: Record<Layout, { w: number; h: number }> = { wide: { w: 1200, h: 640 }, tall: { w: 400, h: 1520 } };
/** 섬 중심 (viewBox 좌표). 7번(프로젝트 왕국)은 큰 섬 */
const POS: Record<Layout, [number, number][]> = {
  wide: [
    [140, 495],
    [330, 370],
    [520, 505],
    [700, 350],
    [880, 495],
    [1030, 300],
    [1070, 130],
  ],
  tall: [
    [118, 200],
    [282, 400],
    [118, 600],
    [282, 800],
    [118, 1000],
    [282, 1200],
    [200, 1400],
  ],
};
/** 길 조각 i: 섬 i → i+1 (곡선) */
function segPath(l: Layout, i: number) {
  const [x1, y1] = POS[l][i];
  const [x2, y2] = POS[l][i + 1];
  const dy = l === 'wide' ? 36 : 0;
  const bend = l === 'wide' ? 0 : 60;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return `M${x1} ${y1 + dy} Q${mx + (l === 'tall' ? (x1 < x2 ? -bend : bend) : 0)} ${my + (l === 'wide' ? 80 : bend)} ${x2} ${y2 + dy}`;
}

export function WorldMap({ withStage = false }: { withStage?: boolean }) {
  const [chapter, setChapter] = useState<0 | 1 | 2>(0);
  const stage = useAb((s) => s.stage);
  useAb((s) => s.current); // 해제 데모로 지금 스테이지가 바뀌면 다시 그림
  const closeStage = useCallback(() => goScreen('world'), []);
  const totals = STAGES.reduce(
    (a, s) => {
      const t = stageStars(s.order);
      return { got: a.got + t.got, max: a.max + t.max, cleared: a.cleared + (stageStatus(s.order) === 'done' ? 1 : 0) };
    },
    { got: 0, max: 0, cleared: 0 },
  );
  return (
    <div className="ab-page ab-worldpage">
      <Hud />
      <main className="ab-world-main" {...(withStage ? ({ inert: '' } as object) : {})}>
        <div className="ab-world-head">
          <div>
            <p className="ab-world-kicker">
              {chapter + 1}장 · {['초록 섬', '바다·하늘 섬', '공방 섬'][chapter]}
            </p>
            <h1 className="ab-display ab-h1">{chapter === 0 ? WORLD1.title : chapter === 1 ? '코드 바다' : '메이커 시티'}</h1>
          </div>
          <div className="ab-chapters" role="tablist" aria-label="월드 고르기">
            {[0, 1, 2].map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={chapter === c}
                className={`ab-chapter-tab ab-tone-w${c + 1} ${chapter === c ? 'is-on' : ''}`}
                onClick={() => setChapter(c as 0 | 1 | 2)}
              >
                {c > 0 && <Icon name="lock" size={18} strokeWidth={2.6} />}
                {c + 1}장
              </button>
            ))}
          </div>
        </div>
        {chapter === 0 ? (
          <>
            <div className="ab-world-progress">
              <span>
                섬 <b>{totals.cleared}</b>/{STAGES.length} 열림
              </span>
              <Progress value={totals.got} max={totals.max} label={`1장 별 ${totals.max}개 중 ${totals.got}개`} tone="lemon" />
              <span>
                ★ <b>{totals.got}</b>/{totals.max}
              </span>
            </div>
            <IslandMap />
          </>
        ) : (
          <LockedChapter world={chapter} />
        )}
      </main>
      {withStage && <StageSheet stage={stage} onClose={closeStage} />}
    </div>
  );
}

function LockedChapter({ world }: { world: 1 | 2 }) {
  return (
    <section className={`ab-locked-chapter ab-tone-w${world + 1}`} aria-label={`${world + 1}장 잠긴 미리보기`}>
      <div className="ab-locked-art">
        <WorldArt world={world} locked />
        <div className="ab-locked-fold" aria-hidden />
        <span className="ab-locked-badge">
          <Icon name="lock" size={30} strokeWidth={2.6} />
        </span>
      </div>
      <div className="ab-locked-body">
        <h2 className="ab-display ab-h2">{world === 1 ? '종이 구름 위 바다·하늘 섬' : '톱니가 도는 공방 섬'}</h2>
        <p>{world === 1 ? '파이썬 섬의 일곱 섬을 모두 열면 이 장이 펼쳐져요. 열기구를 타고 구름 섬을 건너요.' : '코드 바다를 다 건너면 나만의 게임을 만드는 공방 섬이 열려요.'}</p>
        <p className="ab-locked-need">
          <Icon name="flag" size={20} strokeWidth={2.6} /> {world === 1 ? `파이썬 섬 ${STAGES.filter((s) => stageStatus(s.order) === 'done').length}/7 열림` : '코드 바다를 먼저 열어요'}
        </p>
      </div>
    </section>
  );
}

// ───────────── 섬 지도

function IslandMap() {
  const box = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<Layout>('wide');
  const [size, setSize] = useState({ w: 0, h: 0 });
  const segRefs = useRef<(SVGPathElement | null)[]>([]);
  const pyRef = useRef<HTMLDivElement | null>(null);
  const pyInner = useRef<HTMLDivElement | null>(null);
  const pyAt = useAb((s) => s.pyAt);
  const current = useAb((s) => s.current);
  const [hopping, setHopping] = useState(false);
  /** 해제 데모 중인 섬 번호 (P2-05 스테이지 해제를 실제 지도에서) */
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const maskRef = useRef<SVGPathElement | null>(null);
  const { tier, reduced } = useMotion();

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.parentElement?.clientWidth ?? el.clientWidth;
      setLayout(w >= 900 ? 'wide' : 'tall');
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  const vb = VB[layout];
  const toPx = useCallback((x: number, y: number) => ({ x: (x / vb.w) * size.w, y: (y / vb.h) * size.h }), [vb, size]);
  const islandTop = (i: number) => {
    const [x, y] = POS[layout][i];
    // 건물 왼쪽 풀밭에 선다 (건물과 겹치지 않게)
    return toPx(x - (layout === 'wide' ? 44 : 50), y - (layout === 'wide' ? 34 : 38) - (i === 6 ? 16 : 0));
  };

  // 파이뱀 자리 (뛰지 않을 때)
  useLayoutEffect(() => {
    if (hopping || unlocking || !pyRef.current || !size.w) return;
    const p = islandTop(pyAt - 1);
    pyRef.current.style.transform = `translate(${p.x}px, ${p.y}px)`;
  });

  // 섬 팝업 등장 (A×B 시그니처: 누워 있던 종이 섬이 일어섬) — full: rotateX, lite: 12px 올라옴, minimal·줄이기: 없음
  useEffect(() => {
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal' || !box.current) return;
    const arts = Array.from(box.current.querySelectorAll<HTMLElement>('.ab-isle-art'));
    arts.forEach((el, i) => {
      const delay = tierDuration(80 + i * 70);
      if (m.tier === 'lite') el.animate([{ transform: 'translateY(12px)' }, { transform: 'none' }], { duration: 260, delay, easing: EASING.out, fill: 'backwards' });
      else el.animate([{ transform: 'rotateX(75deg)' }, { transform: 'rotateX(0deg)' }], { ...springTiming('body'), delay, fill: 'backwards' });
    });
    // 첫 화면이 비어 보이지 않게 transform만 쓴다 (opacity 0 시작 없음)
  }, [layout]);

  /** 길을 따라 점프 이동 → 도착하면 스테이지 열기 */
  const hopTo = (target: number) => {
    const from = getAb().pyAt;
    const open = () => {
      setAb({ pyAt: target, stage: target });
      goScreen('stage');
    };
    if (from === target) return open();
    const m = getMotion();
    const el = pyRef.current;
    if (!el || m.reduced || m.tier === 'minimal') {
      setAb({ pyAt: target });
      if (el && m.tier === 'minimal' && !m.reduced) el.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 150 });
      window.setTimeout(open, m.reduced ? 0 : 160);
      return;
    }
    // 지나갈 지점: 섬 꼭대기 사이 길 위 점들
    const pts: { x: number; y: number }[] = [islandTop(from - 1)];
    const step = from < target ? 1 : -1;
    for (let s = from; s !== target; s += step) {
      const seg = segRefs.current[Math.min(s, s + step) - 1];
      if (seg && m.tier === 'full') {
        const len = seg.getTotalLength();
        const fr = step > 0 ? [0.5] : [0.5];
        for (const f of fr) {
          const p = seg.getPointAtLength(len * f);
          const q = toPx(p.x, p.y - 30);
          pts.push(q);
        }
      }
      pts.push(islandTop(s + step - 1));
    }
    const kf: Keyframe[] = [];
    const n = pts.length - 1;
    const hopH = m.tier === 'full' ? 46 : 28;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const o0 = i / n;
      kf.push({ offset: o0, transform: `translate(${a.x}px, ${a.y}px)`, easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)' });
      kf.push({ offset: o0 + 0.5 / n, transform: `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - hopH}px)`, easing: 'cubic-bezier(0.5, 0, 0.7, 0.4)' });
    }
    kf.push({ offset: 1, transform: `translate(${pts[n].x}px, ${pts[n].y}px)` });
    setHopping(true);
    const per = m.tier === 'full' ? 360 : 260;
    const anim = el.animate(kf, { duration: per * n, fill: 'forwards' });
    // 착지마다 찌그러짐 (안쪽 요소)
    if (pyInner.current) {
      const sq: Keyframe[] = [];
      for (let i = 0; i <= n; i++) {
        sq.push({ offset: i / n, transform: 'scale(1.18, 0.82)' });
        if (i < n) sq.push({ offset: (i + 0.25) / n, transform: 'scale(0.92, 1.1)' }, { offset: (i + 0.7) / n, transform: 'none' });
      }
      sq[sq.length - 1] = { offset: 1, transform: 'scale(1.12, 0.88)' };
      pyInner.current.animate(sq, { duration: per * n });
    }
    anim.finished.then(() => {
      pyInner.current?.animate([{ transform: 'scale(1.12, 0.88)' }, { transform: 'none' }], springTiming(m.tier === 'full' ? 'jellyAB' : 'face'));
      el.style.transform = kf[kf.length - 1].transform as string;
      anim.cancel();
      setHopping(false);
      setAb({ pyAt: target });
      window.setTimeout(open, 220);
    });
  };

  // 스테이지 해제 데모: #motion 무대와 같은 buildUnlock을 지도 DOM에 적용
  useLayoutEffect(() => {
    if (!unlocking || !box.current) return;
    const root = box.current;
    const to = root.querySelector<HTMLElement>(`[data-isle='${unlocking}']`);
    const from = root.querySelector<HTMLElement>(`[data-isle='${unlocking - 1}']`);
    if (!to || !from) return;
    const m = getMotion();
    const stars = to.querySelector('.ab-isle-stars');
    const starsHtml = stars?.innerHTML ?? '';
    to.classList.add('is-asleep');
    const tl = new Timeline({ tier: m.tier, reduced: m.reduced });
    buildUnlock(tl, {
      stamp: from.querySelector('.ab-isle-stamp'),
      mask: maskRef.current,
      lock: to.querySelector('.ab-isle-lock'),
      art: to.querySelector('.ab-isle-art'),
      awake: (v) => to.classList.toggle('is-asleep', !v),
      tag: to.querySelector('.ab-isle-tag'),
      stars,
      starsText: (v) => stars && (stars.innerHTML = v ? starsHtml : '잠김'),
      badge: to.querySelector('.ab-um-badge'),
      py: pyRef.current,
      pyInner: pyInner.current,
      pyFrom: islandTop(unlocking - 2),
      pyTo: islandTop(unlocking - 1),
      bits: Array.from(to.querySelectorAll<HTMLElement>('.ab-um-bit')),
    }, { at: 0 });
    tl.onFinish = () =>
      window.setTimeout(() => {
        tl.dispose(false);
        to.classList.remove('is-asleep');
        setUnlocking(null);
        toast(`${STAGES[unlocking - 1].title}이 열렸어요!`, 'good');
      }, 400);
    tl.play(0);
    return () => tl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocking]);

  const playUnlock = () => {
    if (unlocking || hopping) return;
    const next = getAb().current + 1;
    if (next > STAGES.length) return;
    setAb({ current: next, pyAt: next });
    setUnlocking(next);
  };
  const resetUnlock = () => {
    if (unlocking) return;
    setAb({ current: 3, pyAt: 3 });
  };

  const onIsland = (order: number) => {
    if (unlocking) return;
    const st = stageStatus(order);
    if (st === 'locked') {
      const prev = STAGES.find((s) => s.order === order - 1);
      toast(`아직 잠겨 있어요. ${prev?.title ?? '앞 섬'}을 먼저 깨 보자!`, 'lock');
      const el = box.current?.querySelector<HTMLElement>(`[data-isle='${order}'] .ab-isle-lock`);
      if (el && !getMotion().reduced && getMotion().tier !== 'minimal')
        el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-14deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(-6deg)' }, { transform: 'none' }], { duration: tierDuration(420) });
      return;
    }
    if (hopping) return;
    hopTo(order);
  };

  return (
    <div className={`ab-map-wrap ab-map-${layout}`}>
      <div className="ab-map" ref={box} style={{ aspectRatio: `${vb.w} / ${vb.h}`, '--isle-w': layout === 'wide' ? '15.5%' : '40%' } as CSSProperties} data-tier={tier}>
        {/* 바다 장식 */}
        <div className="ab-map-deco" aria-hidden>
          {layout === 'wide' ? (
            <>
              <div className="ab-map-cloud m-ambient" style={{ left: '30%', top: '6%' }}>
                <Cloud w={130} />
              </div>
              <div className="ab-map-cloud ab-map-cloud-b m-ambient" style={{ left: '66%', top: '3%' }}>
                <Cloud w={96} />
              </div>
              <div style={{ position: 'absolute', left: '3%', top: '6%' }}>
                <Compass size={92} />
              </div>
              <div className="ab-map-boat m-loop" style={{ left: '44%', top: '74%' }}>
                <PaperBoat size={76} />
              </div>
              <div style={{ left: '46%', top: '24%' }}>
                <Islet w={120} />
              </div>
              <div style={{ left: '15%', top: '30%' }}>
                <Islet w={84} rock />
              </div>
            </>
          ) : (
            <>
              <div className="ab-map-cloud m-ambient" style={{ left: '52%', top: '2%' }}>
                <Cloud w={100} />
              </div>
              <div style={{ position: 'absolute', left: '64%', top: '30.5%' }}>
                <Compass size={70} />
              </div>
              <div style={{ left: '62%', top: '58%' }}>
                <Islet w={90} rock />
              </div>
              <div className="ab-map-boat m-loop" style={{ left: '6%', top: '52%' }}>
                <PaperBoat size={64} />
              </div>
              <div className="ab-map-cloud ab-map-cloud-b m-ambient" style={{ left: '8%', top: '73%' }}>
                <Cloud w={84} />
              </div>
            </>
          )}
          {Array.from({ length: layout === 'wide' ? 6 : 8 }, (_, i) => (
            <div
              key={i}
              className="ab-map-wave m-ambient"
              style={{ left: `${(i * 37 + 8) % 86}%`, top: `${12 + ((i * 53) % 80)}%`, animationDelay: `${-i * 0.7}s` }}
            >
              <WaveRow w={layout === 'wide' ? 150 : 110} color="#fff" />
            </div>
          ))}
        </div>
        {/* 길 */}
        <svg className="ab-map-paths" viewBox={`0 0 ${vb.w} ${vb.h}`} aria-hidden focusable="false">
          {POS[layout].slice(0, -1).map((_, i) => {
            const d = segPath(layout, i);
            const open = stageStatus(i + 2) !== 'locked';
            const drawing = unlocking === i + 2;
            return (
              <g key={`${layout}${i}`}>
                {drawing && (
                  <>
                    <path d={d} fill="none" stroke="#FFF1CF" strokeWidth={layout === 'wide' ? 22 : 18} strokeLinecap="round" opacity={0.55} />
                    <path d={d} fill="none" stroke="#24324A" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="1 9" opacity={0.45} />
                    <mask id="ab-unlock-mask" maskUnits="userSpaceOnUse">
                      <path ref={maskRef} d={d} fill="none" stroke="#fff" strokeWidth={40} strokeLinecap="round" />
                    </mask>
                  </>
                )}
                <g mask={drawing ? 'url(#ab-unlock-mask)' : undefined}>
                <path d={d} fill="none" stroke="#FFF1CF" strokeWidth={layout === 'wide' ? 22 : 18} strokeLinecap="round" opacity={open ? 0.95 : 0.55} />
                <path
                  ref={(el) => {
                    segRefs.current[i] = el;
                  }}
                  d={d}
                  fill="none"
                  stroke="#24324A"
                  strokeWidth={open ? 3.4 : 2.6}
                  strokeLinecap="round"
                  strokeDasharray={open ? '2 11' : '1 9'}
                  opacity={open ? 1 : 0.45}
                />
                </g>
              </g>
            );
          })}
        </svg>
        {/* 섬 */}
        {STAGES.map((s, i) => {
          const [x, y] = POS[layout][i];
          const st = stageStatus(s.order);
          const t = stageStars(s.order);
          const big = s.final;
          return (
            <button
              key={s.order}
              type="button"
              data-isle={s.order}
              className={`ab-isle is-${st} ${big ? 'is-big' : ''}`}
              style={{ left: `${(x / vb.w) * 100}%`, top: `${(y / vb.h) * 100}%` }}
              onClick={() => onIsland(s.order)}
              aria-label={`${s.order}번 섬 ${s.title}, ${st === 'done' ? '클리어' : st === 'current' ? '지금 모험 중' : '잠김'}, 별 ${t.max}개 중 ${t.got}개`}
            >
              <span className="ab-isle-art">
                <PaperIsland kind={STAGE_BUILDING[i]} big={big} locked={st === 'locked'} />
              </span>
              {st === 'done' && <StampMark className="ab-isle-stamp" size={layout === 'wide' ? 58 : 54} />}
              {(st === 'locked' || unlocking === s.order) && (
                <span className="ab-isle-lock">
                  <Icon name="lock" size={22} strokeWidth={2.8} />
                </span>
              )}
              {unlocking === s.order &&
                Array.from({ length: 5 }, (_, k) => <span key={k} className="ab-um-bit" data-beat style={{ background: ['#FFD24D', '#FF7F66', '#6EC1EA', '#5CCB7A', '#9B7FE0'][k] }} />)}
              {unlocking === s.order && (
                <span className="ab-um-badge" data-beat>
                  열렸어요!
                </span>
              )}
              <span className="ab-isle-tag" {...(unlocking === s.order ? { 'data-beat': '' } : {})}>
                <span className="ab-isle-no">{s.order}</span>
                <span className="ab-isle-name">{s.title}</span>
                <span className="ab-isle-stars">
                  <span aria-hidden>★</span> {t.got}/{t.max}
                </span>
              </span>
            </button>
          );
        })}
        {/* 파이뱀 (현재 위치) */}
        <div className="ab-map-py" ref={pyRef} aria-hidden>
          <div className="ab-map-py-inner" ref={pyInner}>
            <PybaemRig style="AB" state={hopping ? 'happy' : 'idle'} size={layout === 'wide' ? 84 : 72} lookAt={false} framing="avatar" tier={reduced ? undefined : tier} />
          </div>
          {!hopping && !unlocking && <span className="ab-map-here">여기!</span>}
        </div>
      </div>
      <div className="ab-map-legend">
        <span>
          <StampMark size={30} /> 클리어
        </span>
        <span>
          <span className="ab-legend-dot is-current" /> 지금 모험 중
        </span>
        <span>
          <Icon name="lock" size={20} strokeWidth={2.6} /> 잠김
        </span>
        {current < 4 ? (
          <GameButton variant="lemon" size="sm" icon="unlock" className="ab-map-demo" onPress={playUnlock}>
            해제 보기 (4번 섬)
          </GameButton>
        ) : (
          <GameButton variant="paper" size="sm" icon="refresh" className="ab-map-demo" onPress={resetUnlock}>
            다시 잠그기
          </GameButton>
        )}
        <GameButton variant="primary" size="md" icon="play" className="ab-map-go" onPress={() => onIsland(getAb().pyAt)}>
          이어서 모험하기
        </GameButton>
      </div>
    </div>
  );
}
