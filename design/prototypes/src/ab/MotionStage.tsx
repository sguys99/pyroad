// #motion 시그니처 모션 무대 (P2-05): 스테이지 해제 · 퀘스트 성공 · 레벨업
// 장면마다 [다시 보기] · 일시정지 · 되감기 막대 · 단계 비교 토글(full/lite/minimal/동작 줄이기) · 타임라인 막대
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, RewardIcon } from '../shared/icons';
import { useMotion } from '../shared/motion';
import { PybaemStatic } from '../shared/rig/PybaemRig';
import type { RigState } from '../shared/rig/params';
import { LevelUpCard, SuccessCard, UnlockMini, buildLevelUp, buildSuccess, buildUnlock, type LevelRefs, type SuccessRefs, type UnlockRefs } from './sig';
import { Timeline, type Beat, type MotionView } from './timeline';

type ViewKey = 'full' | 'lite' | 'minimal' | 'reduced';
const VIEW_OF: Record<ViewKey, MotionView> = {
  full: { tier: 'full', reduced: false },
  lite: { tier: 'lite', reduced: false },
  minimal: { tier: 'minimal', reduced: false },
  reduced: { tier: 'full', reduced: true },
};
const VIEW_LABEL: Record<ViewKey, string> = { full: 'full', lite: 'lite', minimal: 'minimal', reduced: '동작 줄이기' };

declare global {
  interface Window {
    __abScenes?: Record<string, Timeline>;
  }
}

/** 장면 하나의 타임라인 수명: 만들기 → 마지막 프레임 보여 주기 → 다시 보기/되감기 */
function useScene(id: string, build: (tl: Timeline) => void, view: MotionView, deps: unknown[]) {
  const tlRef = useRef<Timeline | null>(null);
  const [info, setInfo] = useState<{ beats: Beat[]; duration: number }>({ beats: [], duration: 0 });
  const head = useRef<HTMLDivElement | null>(null);
  const range = useRef<HTMLInputElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!size) return;
    const prev = tlRef.current;
    const keep = prev ? (prev.playing ? null : prev.time) : null;
    prev?.dispose();
    const tl = new Timeline(view);
    build(tl);
    let lastRange = -1;
    tl.onFrame = (t) => {
      const p = tl.duration ? t / tl.duration : 0;
      // 재생 막대는 transform으로만 옮긴다 (left를 바꾸면 매 프레임 레이아웃)
      const h = head.current;
      if (h) h.style.transform = `translateX(${p * (h.parentElement?.clientWidth ?? 0)}px)`;
      const now = performance.now();
      if (range.current && document.activeElement !== range.current && (now - lastRange > 120 || !tl.playing)) {
        lastRange = now;
        range.current.max = String(Math.round(tl.duration));
        range.current.value = String(Math.round(t));
      }
    };
    tl.onFinish = () => setPlaying(false);
    tlRef.current = tl;
    window.__abScenes = { ...(window.__abScenes ?? {}), [id]: tl };
    setInfo({ beats: [...tl.beats].sort((a, b) => a.start - b.start), duration: tl.duration });
    tl.seek(keep ?? tl.duration);
    setPlaying(false);
    return () => tl.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, view.tier, view.reduced, ...deps]);

  useEffect(() => () => tlRef.current?.dispose(false), []);

  const replay = useCallback(() => {
    tlRef.current?.play(0);
    setPlaying(true);
  }, []);
  const toggle = useCallback(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (tl.playing) {
      tl.pause();
      setPlaying(false);
    } else {
      tl.play(tl.time >= tl.duration ? 0 : tl.time);
      setPlaying(true);
    }
  }, []);
  const seek = useCallback((t: number) => {
    tlRef.current?.seek(t);
    setPlaying(false);
  }, []);
  return { box, info, head, range, playing, replay, toggle, seek };
}

function useView(): [ViewKey, (v: ViewKey) => void] {
  const g = useMotion();
  const globalKey: ViewKey = g.reduced ? 'reduced' : g.tier;
  const [v, setV] = useState<ViewKey>(globalKey);
  useEffect(() => setV(globalKey), [globalKey]);
  return [v, setV];
}

function SceneShell({
  id,
  title,
  sub,
  notes,
  viewKey,
  setView,
  scene,
  extra,
  children,
}: {
  id: string;
  title: string;
  sub: string;
  notes: Record<ViewKey, string>;
  viewKey: ViewKey;
  setView: (v: ViewKey) => void;
  scene: ReturnType<typeof useScene>;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const { info } = scene;
  return (
    <section className="ab-scene" aria-labelledby={`ab-scene-${id}`}>
      <div className="ab-scene-head">
        <div>
          <h2 id={`ab-scene-${id}`} className="ab-display ab-h2">
            {title}
          </h2>
          <p className="ab-scene-sub">{sub}</p>
        </div>
        <div className="ab-scene-btns">
          <button type="button" className="ab-tool" onClick={scene.toggle} aria-label={scene.playing ? '일시정지' : '이어서 재생'}>
            <Icon name={scene.playing ? 'pause' : 'play'} size={20} strokeWidth={2.6} />
          </button>
          <button type="button" className="ab-btn ab-btn-primary ab-btn-sm" onClick={scene.replay}>
            <Icon name="refresh" size={20} strokeWidth={2.6} />
            <span className="ab-btn-label">다시 보기</span>
          </button>
        </div>
      </div>
      <div className="ab-scene-body">
        <div className="ab-scene-view" ref={scene.box} data-scene={id}>
          {children}
        </div>
        <div className="ab-scene-side">
          <div className="ab-seg" role="group" aria-label="연출 단계 비교">
            {(Object.keys(VIEW_OF) as ViewKey[]).map((k) => (
              <button key={k} type="button" aria-pressed={viewKey === k} onClick={() => setView(k)}>
                {VIEW_LABEL[k]}
              </button>
            ))}
          </div>
          <ul className="ab-tier-notes">
            {(Object.keys(VIEW_OF) as ViewKey[]).map((k) => (
              <li key={k} className={viewKey === k ? 'is-on' : ''}>
                <b>{VIEW_LABEL[k]}</b> {notes[k]}
              </li>
            ))}
          </ul>
          {extra}
        </div>
      </div>
      <div className="ab-tlbar">
        <div className="ab-tl-scrub">
          <label className="sr-only" htmlFor={`ab-range-${id}`}>
            {title} 되감기
          </label>
          <input
            id={`ab-range-${id}`}
            ref={scene.range}
            type="range"
            min={0}
            max={Math.round(info.duration)}
            step={10}
            defaultValue={Math.round(info.duration)}
            onInput={(e) => scene.seek(Number((e.target as HTMLInputElement).value))}
          />
          <span className="ab-tl-total">{(info.duration / 1000).toFixed(2)}초</span>
        </div>
        <div className="ab-tl-rows">
          <div className="ab-tl-overlay" aria-hidden>
            <div className="ab-tl-head" ref={scene.head} />
          </div>
          {info.beats.map((b) => (
            <div key={b.label} className="ab-tl-row">
              <span className="ab-tl-label">{b.label}</span>
              <span className="ab-tl-track">
                <span
                  className={`ab-tl-seg ${b.dur === 0 ? 'is-cue' : ''}`}
                  style={{ left: `${(b.start / info.duration) * 100}%`, width: b.dur ? `${Math.max(0.8, (b.dur / info.duration) * 100)}%` : undefined }}
                />
              </span>
              <span className="ab-tl-ms">
                {Math.round(b.start)}
                {b.dur ? `–${Math.round(b.start + b.dur)}` : ''}ms
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── 1. 스테이지 해제

function UnlockScene() {
  const [vk, setVk] = useView();
  const view = VIEW_OF[vk];
  const mini = useRef<UnlockRefs | null>(null);
  const scene = useScene(
    'unlock',
    (tl) => {
      const r = mini.current;
      const root = scene.box.current?.querySelector('.ab-um');
      if (!r || !root) return;
      const rb = root.getBoundingClientRect();
      const pos = (sel: string) => {
        const b = root.querySelector(sel)!.getBoundingClientRect();
        return { x: b.left - rb.left + b.width * 0.26, y: b.top - rb.top + b.height * 0.5 };
      };
      r.pyFrom = pos('.ab-um-isle.is-from .ab-island-svg');
      r.pyTo = pos('.ab-um-isle.is-to .ab-island-svg');
      buildUnlock(tl, r, { at: 0 });
    },
    view,
    [],
  );
  return (
    <SceneShell
      id="unlock"
      title="스테이지 해제"
      sub="도장 쾅(B) → 잉크 길 → 자물쇠 톡 → 누워 있던 종이 섬이 일어섬(팝업북) → 파이뱀이 통통 점프(A) → 이름표·별 진행"
      notes={{
        full: '모든 비트. 섬은 rotateX 58°→0 body 스프링 + 착지 젤리, 점프 2번, 종이 조각 5개',
        lite: '길이 70%. 섬은 12px 올라오기만, 점프 1번, 종이 조각 2개(30%), 잉크 튐·젤리 없음',
        minimal: '움직임 없이 150ms 페이드와 즉시 바뀜만. 파티클 0. 순서는 그대로',
        reduced: '움직임 0. 300ms 간격으로 길·섬 색·이름표·"열렸어요!"가 차례로 나타남. 파이뱀은 표정만',
      }}
      viewKey={vk}
      setView={setVk}
      scene={scene}
    >
      <UnlockMini ref={mini} view={view} key={vk} live={scene.playing} />
    </SceneShell>
  );
}

// ───────────── 2. 퀘스트 성공

function MockHud({ coinRef, numRef, xpRef, fillRef }: { coinRef: (el: HTMLSpanElement | null) => void; numRef: (el: HTMLSpanElement | null) => void; xpRef: (el: HTMLSpanElement | null) => void; fillRef: (el: HTMLSpanElement | null) => void }) {
  return (
    <div className="ab-mockhud" aria-hidden>
      <span className="ab-lv">
        <small>Lv</small>4
      </span>
      <span className="ab-progress ab-mockhud-xp" ref={xpRef}>
        <span className="ab-progress-fill" ref={fillRef} style={{ width: '64%' }} />
      </span>
      <span className="ab-hud-chip" ref={coinRef}>
        <RewardIcon kind="coin" style="AB" size={26} />
        <span className="ab-num" ref={numRef}>
          1,280
        </span>
      </span>
    </div>
  );
}

function SuccessScene() {
  const [vk, setVk] = useView();
  const view = VIEW_OF[vk];
  const [stars, setStars] = useState(3);
  const card = useRef<SuccessRefs | null>(null);
  const hud = useRef<{ coin: HTMLSpanElement | null; num: HTMLSpanElement | null; xp: HTMLSpanElement | null; fill: HTMLSpanElement | null }>({ coin: null, num: null, xp: null, fill: null });
  const pre = useRef<{ btn: HTMLSpanElement | null; l1: HTMLSpanElement | null; l2: HTMLSpanElement | null; out: HTMLDivElement | null; ok: HTMLSpanElement | null; py: HTMLDivElement | null }>({ btn: null, l1: null, l2: null, out: null, ok: null, py: null });
  const [pyState, setPyState] = useState<RigState>('idle');
  const scene = useScene(
    'success',
    (tl) => {
      const c = card.current;
      const p = pre.current;
      if (!c) return;
      const m = tl.m;
      const moving = !m.reduced && m.tier !== 'minimal';
      // 실행 → 출력 → 정답 판정 → 파이뱀 반응 (퀘스트 화면 쪽 비트)
      const btn = p.btn;
      tl.state('pre-press', false, (v) => btn?.classList.toggle('is-pressed', !!v));
      tl.at(0, 'pre-press', true, '실행 버튼 꾹');
      tl.at(m.reduced ? 120 : 90, 'pre-press', false);
      if (moving) tl.add(btn, [{ transform: 'translateY(5px) scale(1.04, 0.96)' }, { transform: 'none' }], { at: 90, ease: m.tier === 'lite' ? 'face' : 'jellyAB', label: '버튼 복귀 (jellyAB)', fill: 'none' });
      tl.show(p.l1, tl.d(260), 'pre-l1');
      tl.show(p.l2, tl.d(400), 'pre-l2');
      tl.beat('출력 두 줄', tl.d(260), tl.d(140), 'cue');
      const out = p.out;
      tl.state('pre-ok', false, (v) => out?.classList.toggle('is-ok', !!v));
      tl.at(tl.d(560), 'pre-ok', true, '정답 판정');
      tl.show(p.ok, tl.d(560), 'pre-okb');
      if (moving) tl.add(p.ok, [{ transform: 'scale(0.4) rotate(-20deg)' }, { transform: 'rotate(-6deg)' }], { at: tl.d(560), ease: 'prop' });
      tl.state('pre-py', 'idle' as RigState, (v) => setPyState(v as RigState));
      tl.at(tl.d(600), 'pre-py', 'happy', '파이뱀 기뻐함');
      if (moving && m.tier === 'full') tl.add(p.py, [{ transform: 'none' }, { transform: 'translateY(-22px) scale(0.95, 1.06)', offset: 0.4 }, { transform: 'scale(1.1, 0.9)', offset: 0.75 }, { transform: 'none' }], { at: tl.d(600), ease: 'out', dur: 520, label: '파이뱀 점프', fill: 'none' });
      const h = hud.current;
      h.fill && (h.fill.style.width = '64%');
      h.num && (h.num.textContent = '1,280');
      buildSuccess(tl, c, {
        at: m.reduced ? 900 : tl.d(1000),
        stars,
        xp: 50,
        coins: 10 + stars * 5,
        hud: { coin: h.coin, coinNum: h.num, xp: h.xp, xpFill: h.fill, base: { coins: 1280, xp: 320, xpNext: 500 } },
      });
    },
    view,
    [stars],
  );
  return (
    <SceneShell
      id="success"
      title="퀘스트 성공"
      sub="실행 → 정답 판정 → 파이뱀 반응 → 카드가 종이처럼 일어섬 → 통과! 도장 → 별 하나씩 → 스티커 코인이 HUD로 → 다음 퀘스트"
      notes={{
        full: '카드 rotateX 팝업(body), 도장 쾅 + 종이 흔들림 + 잉크 튐 6, 별 팝(prop) + 반짝 3, 코인 5개, 버튼 젤리',
        lite: '길이 70%. 카드는 16px 올라오기만, 흔들림·잉크 튐 없음, 반짝 1, 코인 2개, 버튼 face 복귀',
        minimal: '150ms 페이드만, 코인 0, HUD 숫자는 페이드로 교체',
        reduced: '움직임 0. 도장·별·보상이 300ms 간격으로 바로 나타나고 HUD 코인 칩이 레몬색으로 강조. 파이뱀은 표정만',
      }}
      viewKey={vk}
      setView={setVk}
      scene={scene}
      extra={
        <div className="ab-seg ab-seg-stars" role="group" aria-label="별 개수">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" aria-pressed={stars === n} onClick={() => setStars(n)}>
              ★ {n}개
            </button>
          ))}
        </div>
      }
    >
      <div className="ab-ss" key={`${vk}${stars}`}>
        <MockHud coinRef={(el) => void (hud.current.coin = el)} numRef={(el) => void (hud.current.num = el)} xpRef={(el) => void (hud.current.xp = el)} fillRef={(el) => void (hud.current.fill = el)} />
        <div className="ab-ss-quest">
          <pre className="ab-ss-code">
            <span className="tk-com"># 2-2 숫자 상자와 글자 상자</span>
            {'\n'}number = <span className="tk-num">10</span>
            {'\n'}greeting = <span className="tk-str">"안녕"</span>
            {'\n'}
            <span className="tk-fn">print</span>(number)
          </pre>
          <span className="ab-btn ab-btn-primary ab-btn-sm ab-ss-run" ref={(el) => void (pre.current.btn = el)}>
            <Icon name="play" size={20} />
            <span className="ab-btn-label">코드 돌려보기</span>
          </span>
          <div className="ab-ss-out" ref={(el) => void (pre.current.out = el)}>
            <span data-beat ref={(el) => void (pre.current.l1 = el)}>
              10
            </span>
            <span data-beat ref={(el) => void (pre.current.l2 = el)}>
              안녕
            </span>
            <span className="ab-ss-ok" data-beat ref={(el) => void (pre.current.ok = el)}>
              정답!
            </span>
          </div>
          <div className="ab-ss-py" ref={(el) => void (pre.current.py = el)}>
            {/* 무대 왼쪽 파이뱀은 엔진 없는 정지 그림 (카드의 파이뱀과 동시에 리그 2개를 돌리지 않게, 성능 예산) */}
            <PybaemStatic style="AB" state={pyState} size={72} idPrefix="ssmini" />
          </div>
        </div>
        <SuccessCard
          ref={card}
          compact
          live={scene.playing}
          view={view}
          title="숫자 상자와 글자 상자"
          stars={stars}
          xp={50}
          coins={10 + stars * 5}
          note={stars === 3 ? '힌트 없이 한 번에!' : stars === 2 ? '힌트 1번으로 통과!' : '힌트를 여러 번 봤어요'}
          actions={
            <span className="ab-btn ab-btn-primary ab-btn-md">
              <span className="ab-btn-label">다음 퀘스트</span>
              <Icon name="arrowRight" size={22} strokeWidth={2.6} />
            </span>
          }
        />
      </div>
    </SceneShell>
  );
}

// ───────────── 3. 레벨업

function LevelScene() {
  const [vk, setVk] = useView();
  const view = VIEW_OF[vk];
  const card = useRef<LevelRefs | null>(null);
  const scene = useScene(
    'level',
    (tl) => {
      if (!card.current) return;
      buildLevelUp(tl, card.current, { at: 0, from: 4, xp: { from: 470, next: 500, over: 20, next2: 600 } });
    },
    view,
    [],
  );
  return (
    <SceneShell
      id="level"
      title="레벨업"
      sub="XP 바가 차서 넘침 → 레벨 배지가 뒤집혀 변신 + 종이 리본 → 접힌 배너가 펼쳐짐 + 종이 컨페티 → 별똥이가 날아와 새 칭호를 안내 → 획득 도장"
      notes={{
        full: '바 젤리, 배지 rotateY 뒤집기 + prop 팝, 리본·배너 종이 펼침(body), 컨페티 24, 별똥이 비행(inOut) + 착지',
        lite: '길이 70%. 배너는 내려오기만, 리본 펼침 없음, 컨페티 7(30%)',
        minimal: '150ms 페이드와 즉시 바뀜만, 컨페티 0, 별똥이 페이드 등장',
        reduced: '움직임 0. 숫자 4→5·배지 색·칭호·도장이 300ms 간격으로 바뀜. 별똥이·파이뱀은 표정만',
      }}
      viewKey={vk}
      setView={setVk}
      scene={scene}
    >
      <div className="ab-ls" key={vk}>
        <LevelUpCard
          ref={card}
          compact
          live={scene.playing}
          from={4}
          view={view}
          actions={
            <span className="ab-btn ab-btn-lemon ab-btn-md">
              <span className="ab-btn-label">좋아!</span>
            </span>
          }
        />
      </div>
    </SceneShell>
  );
}

export function MotionStage() {
  return (
    <div className="ab-stagewrap">
      <header className="ab-stage-intro">
        <span className="ab-ribbon ab-ribbon-orange">P2-05 시그니처 모션</span>
        <h1 className="ab-display ab-h1">게임의 탄력 + 종이의 물성</h1>
        <p className="ab-lead">
          누르고 이동하는 반응은 A의 젤리·점프, 클리어·해제·보상 같은 기록은 B의 도장·종이 팝업이에요. 장면마다 단계를 바꿔 비교하고, 막대를 끌어 원하는 순간에 멈춰 볼 수 있어요.
        </p>
      </header>
      <UnlockScene />
      <SuccessScene />
      <LevelScene />
    </div>
  );
}
