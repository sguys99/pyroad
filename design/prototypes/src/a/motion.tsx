// #motion: 시안 A 시그니처 모션 무대 (P2-05). 스테이지 해제 · 퀘스트 성공 · 레벨업
// 장면마다 [다시 보기]·[멈춤/이어 보기]·타임라인 스크럽, full / lite / minimal / 동작 줄이기 비교 토글, 비트별 타임라인 막대.
// 연출 코드는 실제 흐름과 같다: buildUnlock(worldmap.tsx) · buildClear·buildLevelUp(signature.tsx)
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon, RewardIcon } from '../shared/icons';
import { springTiming, useMotion } from '../shared/motion';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { EASING } from '../shared/tokens';
import { Seq, MODE_LABEL, MODE_NOTE, coins, centerIn, GEM_SVG, type Beat, type Mode } from './seq';
import { ClearCard, LevelUpOverlay, MiniHud, buildClear, buildLevelUp, hudRefs } from './signature';
import { TITLES, xpNeed } from './store';
import { Hud } from './ui';
import { IslandMap, buildUnlock, type Layout, type MapHandle } from './worldmap';

type RigS = 'idle' | 'talk' | 'think' | 'happy' | 'sad' | 'cheer' | 'dance';
const MODES: Mode[] = ['full', 'lite', 'minimal', 'reduced'];

// ───────────── 장면 틀

function SceneShell({
  id,
  no,
  title,
  desc,
  notes,
  extra,
  build,
  reset,
  rebuildKey,
  children,
}: {
  id: string;
  no: number;
  title: string;
  desc: string;
  notes: Record<Mode, string>;
  extra?: ReactNode;
  build: (seq: Seq, mode: Mode) => void;
  reset: () => void;
  rebuildKey?: string | number;
  children: (mode: Mode) => ReactNode;
}) {
  const g = useMotion();
  const [mode, setMode] = useState<Mode>(g.reduced ? 'reduced' : g.tier);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [total, setTotal] = useState(1);
  const [playing, setPlaying] = useState(false);
  const seqRef = useRef<Seq | null>(null);
  const head = useRef<HTMLSpanElement | null>(null);
  const range = useRef<HTMLInputElement | null>(null);
  const clock = useRef<HTMLSpanElement | null>(null);
  const tNow = useRef(0);
  const box = useRef<HTMLElement | null>(null);
  const seen = useRef(false);
  const buildRef = useRef(build);
  buildRef.current = build;
  const resetRef = useRef(reset);
  resetRef.current = reset;

  const setT = (t: number, tot: number) => {
    tNow.current = t;
    const u = Math.min(1, t / tot);
    if (head.current) head.current.style.transform = `translateX(${u * 100}cqw)`;
    if (range.current) {
      range.current.max = String(tot);
      range.current.value = String(Math.round(Math.min(t, tot)));
    }
    if (clock.current) clock.current.textContent = `${Math.round(Math.min(t, tot))}ms`;
  };

  const rebuild = (autoplay: boolean) => {
    seqRef.current?.cancel();
    resetRef.current();
    const seq = new Seq(mode, () => resetRef.current());
    buildRef.current(seq, mode);
    const tot = Math.max(1, Math.ceil(seq.total / 100) * 100);
    seq.onTime = (t) => setT(t, tot);
    seq.onEnd = () => setPlaying(false);
    seqRef.current = seq;
    setBeats([...seq.beats].sort((a, b) => a.at - b.at));
    setTotal(tot);
    if (autoplay) {
      setPlaying(true);
      seq.play();
    } else seq.finish();
  };

  // 단계·옵션이 바뀌면 다시 만든다 (자식이 새 단계로 그려진 뒤)
  useEffect(() => {
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => rebuild(seen.current));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [mode, rebuildKey]);
  useEffect(() => () => seqRef.current?.cancel(), []);

  // 처음 화면에 보일 때 한 번 재생
  useEffect(() => {
    const el = box.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !seen.current) {
        seen.current = true;
        setTimeout(() => {
          setPlaying(true);
          seqRef.current?.play();
        }, 300);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const replay = () => {
    setPlaying(true);
    seqRef.current?.play();
  };
  const toggle = () => {
    const s = seqRef.current;
    if (!s) return;
    if (playing) {
      s.seek(tNow.current);
      setPlaying(false);
    } else {
      setPlaying(true);
      s.play(tNow.current >= total ? 0 : tNow.current);
    }
  };

  const reducedAttr = mode === 'reduced';
  const tierAttr = mode === 'reduced' ? g.tier : mode;
  return (
    <section className="a-ms" id={`a-ms-${id}`} aria-labelledby={`a-ms-${id}-t`} ref={box}>
      <header className="a-ms-head">
        <span className="a-ms-no">{no}</span>
        <div>
          <h2 id={`a-ms-${id}-t`}>{title}</h2>
          <p>{desc}</p>
        </div>
      </header>
      <div className="a-ms-grid">
        <div className="a-ms-stage" data-motion={tierAttr} data-reduced={String(reducedAttr)}>
          {children(mode)}
        </div>
        <aside className="a-ms-side">
          <div className="a-ms-modes" role="radiogroup" aria-label={`${title} 연출 단계 비교`}>
            {MODES.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className={`a-ms-mode${mode === m ? ' is-on' : ''}`} onClick={() => setMode(m)}>
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="a-ms-note">
            <b>{MODE_LABEL[mode]}</b> {notes[mode]}
          </p>
          <p className="a-ms-common">{MODE_NOTE[mode]}</p>
          {extra}
          <div className="a-ms-ctrl">
            <button type="button" className="a-ms-btn a-ms-btn-main" onClick={replay}>
              <Icon name="refresh" size={20} strokeWidth={2.6} />
              다시 보기
            </button>
            <button type="button" className="a-ms-btn" onClick={toggle} aria-label={playing ? '멈춤' : '이어 보기'}>
              <Icon name={playing ? 'pause' : 'play'} size={20} strokeWidth={2.6} />
              {playing ? '멈춤' : '이어 보기'}
            </button>
          </div>
        </aside>
      </div>
      <div className="a-tl">
        <div className="a-tl-top">
          <label className="a-tl-scrub">
            <span className="sr-only">{title} 타임라인 위치</span>
            <input
              ref={range}
              type="range"
              min={0}
              max={total}
              step={10}
              defaultValue={total}
              onChange={(e) => {
                setPlaying(false);
                seqRef.current?.seek(Number(e.target.value));
              }}
            />
          </label>
          <span className="a-tl-clock" ref={clock}>
            {total}ms
          </span>
        </div>
        <div className="a-tl-body" style={{ '--tl-total': total } as CSSProperties}>
          <div className="a-tl-axis" aria-hidden>
            {Array.from({ length: Math.floor(total / 500) + 1 }, (_, i) => (
              <span key={i} style={{ left: `${((i * 500) / total) * 100}%` }}>
                {i * 500}
              </span>
            ))}
          </div>
          <ol className="a-tl-rows">
            {beats.map((b, i) => (
              <li key={i} className="a-tl-row">
                <span className="a-tl-label">
                  {b.label}
                  <small>
                    {Math.round(b.at)}–{Math.round(b.at + b.dur)}ms · {b.ease}
                  </small>
                </span>
                <span className="a-tl-track" aria-hidden>
                  <span className="a-tl-bar" style={{ left: `${(b.at / total) * 100}%`, width: `${Math.max(0.8, (b.dur / total) * 100)}%` }} />
                </span>
              </li>
            ))}
          </ol>
          <span className="a-tl-head" ref={head} aria-hidden />
        </div>
      </div>
    </section>
  );
}

// ───────────── ① 스테이지 해제

const DEMO: Layout = {
  w: 640,
  h: 380,
  nodes: [
    [-520, 300],
    [-180, 300],
    [150, 255],
    [470, 205],
    [860, 330],
    [1160, 210],
    [1460, 300],
  ],
  rx: 108,
  ry: 34,
  lm: 1.05,
  py: 96,
  deco: {
    palms: [],
    bars: [[590, 345, 30]],
    boat: [330, 350],
    waves: [
      [40, 80],
      [260, 60],
      [560, 70],
      [40, 360],
      [380, 120],
      [610, 280],
    ],
  },
};

const DEMO_TALL: Layout = {
  w: 400,
  h: 580,
  nodes: [
    [-400, -300],
    [-120, -120],
    [118, 215],
    [282, 440],
    [520, 760],
    [800, 900],
    [1100, 1000],
  ],
  rx: 88,
  ry: 29,
  lm: 0.86,
  py: 84,
  deco: {
    palms: [],
    bars: [[350, 120, 22]],
    boat: [80, 510],
    waves: [
      [40, 300],
      [300, 230],
      [230, 520],
      [40, 80],
    ],
  },
};

const UNLOCK_NOTES: Record<Mode, string> = {
  full: '널빤지 하나씩 통통(prop), 자물쇠 흔들림·열림, 섬 젤리 + 반짝이 10개, 파이뱀 점프',
  lite: '널빤지 face 스프링·70%, 반짝이 3개, 젤리 대신 body',
  minimal: '다리 한 번에 페이드, 자물쇠 페이드, 파이뱀 자리만 옮김',
  reduced: '다리·섬 색·이름표가 차례로 즉시 바뀜. "열렸어요!" 글자로 알림',
};

function UnlockScene() {
  const h = useRef<MapHandle | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setNarrow(es[0].contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={wrap}>
    <SceneShell
      id="unlock"
      no={1}
      title="스테이지 해제"
      desc="3스테이지를 깨면 다리가 놓이고, 잠긴 4스테이지 섬이 깨어나며 파이뱀이 건너가요."
      notes={UNLOCK_NOTES}
      rebuildKey={narrow ? 't' : 'w'}
      build={(seq) => h.current && buildUnlock(seq, h.current, 2, 3)}
      reset={() => {
        h.current?.setCur(2);
        h.current?.setPos(2);
        h.current?.setHop(false);
      }}
    >
      {(mode) => (
        <div className="a-ms-map">
          <IslandMap
            key={mode + (narrow ? 't' : 'w')}
            ref={h}
            L={narrow ? DEMO_TALL : DEMO}
            wide={!narrow}
            cur={2}
            autoHop={false}
            interactive={false}
            unlock={{ from: 2, to: 3 }}
            tier={mode === 'reduced' ? undefined : mode}
            reduced={mode === 'reduced'}
          />
        </div>
      )}
    </SceneShell>
    </div>
  );
}

// ───────────── ② 퀘스트 성공

const CLEAR_NOTES: Record<Mode, string> = {
  full: '버튼 꾹 → 젤리, 카드 jellyA, 별 prop + 반짝이, 코인 5개 포물선·뒤집기 → HUD 팝 + 숫자 올리기',
  lite: '카드 body, 별 face, 반짝이 30%, 코인 1개, 전체 70%',
  minimal: '카드·별 150ms 페이드, 코인 비행 없음, HUD 숫자 페이드 교체',
  reduced: '즉시 표시 + "짠!" 정지 컷, 별·숫자가 차례로 바뀜, 파이뱀은 표정·후광만',
};

function QuestScene() {
  const [stars, setStars] = useState(3);
  const [rig, setRig] = useState<RigS>('idle');
  const stage = useRef<HTMLDivElement | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const C0 = 1280;
  const XP0 = 320;
  const build = (seq: Seq) => {
    const root = stage.current;
    if (!root || !card.current) return;
    const q = (s: string) => root.querySelector(s);
    const run = q('[data-s="run"]');
    // 실행 버튼 꾹
    if (seq.moves) {
      seq.anim(run, [{ transform: 'none' }, { transform: 'translateY(5px)' }], 0, { duration: 70, easing: EASING.press, fill: 'none' });
      seq.anim(run, [{ transform: 'translateY(5px) scale(1.04, 0.96)' }, { transform: 'none' }], 160, { ...springTiming(seq.mode === 'lite' ? 'face' : 'jellyA'), fill: 'none' });
    }
    seq.beat('실행 버튼 꾹 → 젤리 복귀', 0, seq.moves ? 160 + 600 : 150, 'press 70ms → jellyA');
    seq.call(seq.s(120), () => setRig('think'));
    seq.appear(q('[data-s="dots"]'), seq.s(120), [{ transform: 'scale(0.6)' }, { transform: 'none' }], { spring: 'face' });
    q('[data-s="dots"]')
      ?.querySelectorAll('i')
      .forEach((d, i) => seq.wiggle(d, seq.s(160) + i * 120, [{ transform: 'none' }, { transform: 'translateY(-5px)' }, { transform: 'none' }], 320));
    seq.vanish(q('[data-s="dots"]'), seq.s(700), [{ opacity: 1 }, { opacity: 0 }], 120);
    seq.beat('실행 중 (점 3개 통통)', seq.s(120), seq.s(580), 'face · out');
    seq.appear(q('[data-s="out"]'), seq.s(720), [{ transform: 'translateY(10px)' }, { transform: 'none' }], { spring: 'face' });
    seq.appear(q('[data-s="ok"]'), seq.s(800), [{ transform: 'scale(1.8) rotate(-12deg)' }, { transform: 'rotate(-6deg)' }], { spring: 'jellyA', liteSpring: 'body' });
    seq.beat('출력 "파이뱀" + 정답 배지', seq.s(720), seq.moves ? 900 : 150, 'face · jellyA');
    seq.call(seq.s(880), () => setRig('cheer'));
    seq.squish(q('[data-s="rig"]'), seq.s(880));
    seq.beat('파이뱀 환호 + 젤리 스퀴시', seq.s(880), seq.moves ? 1000 : 150, '90ms → jellyA');
    buildClear(seq, card.current, hudRefs(root, root), {
      at0: seq.s(1300),
      stars,
      coins: 10 + stars * 5,
      coinFrom: C0,
      xpFrom: XP0,
      xpTo: XP0 + 50,
      xpMax: xpNeed(4),
    });
  };
  const reset = () => {
    setRig('idle');
    const n = stage.current?.querySelector<HTMLElement>('[data-hud-coin-num]');
    if (n) n.textContent = C0.toLocaleString('ko-KR');
  };
  return (
    <SceneShell
      id="clear"
      no={2}
      title="퀘스트 성공"
      desc="실행 → 정답 → 파이뱀 환호 → 별이 하나씩 → 코인·경험치가 HUD로 → 다음 퀘스트."
      notes={CLEAR_NOTES}
      rebuildKey={stars}
      build={build}
      reset={reset}
      extra={
        <div className="a-ms-stars" role="radiogroup" aria-label="받는 별 개수">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={stars === n} className={`a-ms-mode${stars === n ? ' is-on' : ''}`} onClick={() => setStars(n)}>
              <RewardIcon kind="star" size={18} style="A" />
              {n}개
            </button>
          ))}
        </div>
      }
    >
      {(mode) => (
        <div className="a-ms-quest" ref={stage}>
          <MiniHud level={4} xp={XP0} xpMax={xpNeed(4)} coins={C0} />
          <div className="a-ms-qbody">
            <div className="a-ms-rig" data-s="rig">
              <PybaemRig state={rig} size={120} lookAt={false} tier={mode === 'reduced' ? undefined : mode} reducedMotion={mode === 'reduced'} />
            </div>
            <div className="a-ms-panel">
              <pre className="a-ms-code">
                <span className="tk-txt">name = </span>
                <span className="tk-str">"파이뱀"</span>
                {'\n'}
                <span className="tk-fn">print</span>(name)
              </pre>
              <div className="a-ms-out">
                <span className="a-ms-dots" data-s="dots">
                  <i />
                  <i />
                  <i />
                </span>
                <code data-s="out">파이뱀</code>
                <span className="a-ms-ok" data-s="ok">
                  <Icon name="check" size={18} strokeWidth={3} />
                  정답!
                </span>
              </div>
              <span className="a-ms-run" data-s="run">
                <Icon name="play" size={22} />
                코드 돌려보기
              </span>
            </div>
          </div>
          <ClearCard ref={card} contained stars={stars} xp={50} coins={10 + stars * 5} rig="cheer" tier={mode === 'reduced' ? undefined : mode} reduced={mode === 'reduced'} />
        </div>
      )}
    </SceneShell>
  );
}

// ───────────── ③ 레벨업

const LEVEL_NOTES: Record<Mode, string> = {
  full: 'XP 바 번쩍·늘어남, 배지 감기→뒤집기→젤리, 별똥이 포물선 비행, 컨페티 36개',
  lite: '배지 body 스프링, 별똥이 70%, 컨페티 11개, 햇살 회전 끔',
  minimal: '배지 숫자 페이드 교체, 오버레이 페이드, 별똥이·컨페티 없음(즉시 표시)',
  reduced: 'Lv 숫자·배너·칭호가 차례로 즉시 + "뽁!" 정지 컷, 마스코트는 느린 눈 깜빡임',
};

function LevelScene() {
  const stage = useRef<HTMLDivElement | null>(null);
  const ov = useRef<HTMLDivElement | null>(null);
  const [rig, setRig] = useState<RigS>('happy');
  const XP0 = 470;
  const max = xpNeed(4);
  const build = (seq: Seq) => {
    const root = stage.current;
    if (!root || !ov.current) return;
    const hud = hudRefs(root, root);
    const chip = root.querySelector('[data-s="xpchip"]');
    // 경험치 보석이 들어와 바가 꽉 참
    if (chip && hud.xpBox && hud.xpFill) {
      const from = centerIn(chip, root);
      const to = centerIn(hud.xpBox, root);
      seq.appear(chip, 0, [{ transform: 'scale(0.4)' }, { transform: 'none' }], { spring: 'prop', liteSpring: 'face' });
      const r = coins(seq, root, from, to, seq.s(250), 1, GEM_SVG, 26);
      const arrive = seq.moves ? r.first : seq.s(250);
      seq.anim(hud.xpFill, [{ transform: `scaleX(${XP0 / max})` }, { transform: 'scaleX(1)' }], arrive, { duration: seq.moves ? seq.s(420) : seq.mode === 'minimal' ? 150 : 1, easing: EASING.out });
      seq.vanish(chip, arrive, [{ opacity: 1 }, { opacity: 0 }], 200);
      seq.beat('+50 경험치 → XP 바 470→500', 0, arrive + seq.s(420), 'prop · inOut · out');
      buildLevelUp(seq, ov.current, hud, { at0: arrive + seq.s(440), from: 4, to: 5, xpAfter: 20, xpMaxAfter: xpNeed(5), setRig });
    }
  };
  const reset = () => {
    setRig('happy');
    const n = stage.current?.querySelector<HTMLElement>('[data-hud-lv-num]');
    if (n) n.textContent = '4';
    stage.current?.querySelector('[data-hud-lv]')?.classList.remove('is-up');
  };
  return (
    <SceneShell
      id="level"
      no={3}
      title="레벨업"
      desc="경험치 바가 넘치면 레벨 배지가 변신하고, 별똥이가 새 칭호를 가져와요."
      notes={LEVEL_NOTES}
      build={build}
      reset={reset}
    >
      {(mode) => (
        <div className="a-ms-level" ref={stage}>
          <MiniHud level={4} xp={XP0} xpMax={max} coins={1305} />
          <span className="a-reward a-ms-xpchip" data-s="xpchip">
            <RewardIcon kind="gem" size={26} style="A" />
            <b>+50</b> 경험치
          </span>
          <div ref={ov} className="a-ms-lvhost">
            <LevelUpOverlay contained level={5} title={TITLES[5]} unlockText="파이뱀 모자 꾸미기가 열렸어요" rig={rig} tier={mode === 'reduced' ? undefined : mode} reduced={mode === 'reduced'} />
          </div>
        </div>
      )}
    </SceneShell>
  );
}

// ───────────── 화면

export function MotionScreen() {
  return (
    <div className="a-screen">
      <Hud />
      <main className="a-motion">
        <div className="a-motion-intro">
          <h1 className="a-h2">시그니처 모션</h1>
          <p>
            모험 섬의 손맛은 <b>바운스 · 젤리 스퀴시 · 코인 튀어나옴</b>이에요. 세 장면 모두 실제 지도·퀘스트에서 쓰는 코드 그대로이고, 오른쪽 토글로 연출 단계를 바꿔
            비교할 수 있어요. 타임라인 막대를 끌면 원하는 순간에 멈춰 볼 수 있어요.
          </p>
          <p className="a-motion-springs">
            쓰는 스프링: <code>jellyA</code>(k520 c10) 젤리·착지 · <code>prop</code>(k170 c13) 별·배지·HUD 팝 · <code>body</code>(k200 c19) 카드·배지 lite ·{' '}
            <code>face</code>(k420 c34) 출력·lite 별. 새 스프링 없음.
          </p>
        </div>
        <UnlockScene />
        <QuestScene />
        <LevelScene />
      </main>
    </div>
  );
}
