// 시그니처 모션 미니 데모 (무드보드). 모두 연출 단계·동작 줄이기를 따른다.
// 구현은 CSS + Web Animations API + 스프링 linear() easing (shared/motion.ts). Framer Motion 없음.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RewardIcon, Icon } from '../shared/icons';
import { getMotion, play, springTiming, tierDuration, useMotion } from '../shared/motion';
import { STAGES } from '../shared/content';
import { EASING, type Concept } from '../shared/tokens';
import { WorldScene } from './scenes';

/** 처음 화면에 보일 때 한 번 + "다시 보기" 버튼 */
function useAutoPlay(run: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting && !done.current) {
        done.current = true;
        setTimeout(run, 250);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

export function DemoFrame({ title, onReplay, children, hint }: { title: string; onReplay?: () => void; children: ReactNode; hint?: string }) {
  return (
    <div className="dm-frame">
      <div className="dm-stage">{children}</div>
      <div className="dm-bar">
        <span className="dm-title">{title}</span>
        {hint && <span className="dm-hint">{hint}</span>}
        {onReplay && (
          <button type="button" className="dm-replay" onClick={onReplay} aria-label={`${title} 다시 보기`}>
            <Icon name="refresh" size={16} />
            다시 보기
          </button>
        )}
      </div>
    </div>
  );
}

// ───────────── 게임 버튼 꾹 (A, AB)

export function GameButtonDemo({ concept }: { concept: Concept }) {
  const btn = useRef<HTMLButtonElement | null>(null);
  const press = () => btn.current?.classList.add('is-pressed');
  const release = () => {
    const el = btn.current;
    if (!el || !el.classList.contains('is-pressed')) return;
    el.classList.remove('is-pressed');
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal') return;
    const from = 'translateY(5px) scale(1.04, 0.96)';
    if (m.tier === 'lite') {
      el.animate([{ transform: 'translateY(5px)' }, { transform: 'none' }], springTiming('face'));
      return;
    }
    el.animate([{ transform: from }, { transform: 'none' }], springTiming(concept === 'AB' ? 'jellyAB' : 'jellyA'));
  };
  const demo = () => {
    press();
    setTimeout(release, 160);
  };
  const ref = useAutoPlay(demo);
  return (
    <DemoFrame title={concept === 'AB' ? '종이 게임 버튼' : '게임 버튼 꾹'} onReplay={demo} hint="직접 눌러 보세요">
      <div ref={ref} className="dm-center">
        <button
          ref={btn}
          type="button"
          className={`dm-gbtn dm-gbtn-${concept}`}
          onPointerDown={press}
          onPointerUp={release}
          onPointerLeave={release}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && press()}
          onKeyUp={release}
        >
          <Icon name="play" size={22} />
          모험 시작!
        </button>
      </div>
    </DemoFrame>
  );
}

// ───────────── 젤리 스퀴시 (A)

export function JellyDemo() {
  const blob = useRef<HTMLDivElement | null>(null);
  const run = () => {
    const el = blob.current;
    if (!el) return;
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal') {
      el.classList.add('is-happy');
      setTimeout(() => el.classList.remove('is-happy'), 900);
      return;
    }
    const lite = m.tier === 'lite';
    const sq = lite ? 'scale(1.12, 0.88)' : 'scale(1.22, 0.78)';
    el.classList.add('is-happy');
    el.animate([{ transform: 'none' }, { transform: sq }], { duration: 90, easing: EASING.out }).finished.then(() => {
      el.animate([{ transform: sq }, { transform: 'none' }], springTiming(lite ? 'body' : 'jellyA'));
      setTimeout(() => el.classList.remove('is-happy'), 700);
    });
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title="젤리 스퀴시" onReplay={run} hint="눌러 보세요">
      <div ref={ref} className="dm-center">
        <div ref={blob} className="dm-jelly" role="button" tabIndex={0} aria-label="젤리 섬 누르기" onPointerDown={run} onKeyDown={(e) => e.key === 'Enter' && run()}>
          <svg viewBox="0 0 120 100" width="132" height="110" aria-hidden>
            <ellipse cx="60" cy="94" rx="40" ry="5" fill="#1B2F45" opacity="0.14" />
            <path d="M14 70 Q10 30 60 26 Q110 30 106 70 Q106 92 60 92 Q14 92 14 70Z" fill="#4CC46E" />
            <path d="M14 70 Q14 92 60 92 Q106 92 106 70 Q100 84 60 85 Q20 84 14 70Z" fill="#1B7F37" opacity="0.5" />
            <ellipse cx="42" cy="40" rx="14" ry="6" fill="#fff" opacity="0.45" transform="rotate(-16 42 40)" />
            <g className="dm-face-calm">
              <ellipse cx="46" cy="60" rx="4" ry="5" fill="#0E5A25" />
              <ellipse cx="74" cy="60" rx="4" ry="5" fill="#0E5A25" />
              <path d="M54 70 Q60 75 66 70" stroke="#0E5A25" strokeWidth="3" fill="none" strokeLinecap="round" />
            </g>
            <g className="dm-face-happy">
              <path d="M41 61 Q46 55 51 61 M69 61 Q74 55 79 61" stroke="#0E5A25" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M52 68 Q60 78 68 68Z" fill="#0E5A25" />
            </g>
            <ellipse cx="34" cy="68" rx="6" ry="3.5" fill="#FF8A80" opacity="0.6" />
            <ellipse cx="86" cy="68" rx="6" ry="3.5" fill="#FF8A80" opacity="0.6" />
          </svg>
        </div>
      </div>
    </DemoFrame>
  );
}

// ───────────── 코인 튀어나옴 (A) / 스티커 코인 (AB)

export function CoinDemo({ concept }: { concept: 'A' | 'AB' }) {
  const box = useRef<HTMLDivElement | null>(null);
  const hud = useRef<HTMLDivElement | null>(null);
  const num = useRef<HTMLSpanElement | null>(null);
  const plus = useRef<HTMLSpanElement | null>(null);
  const value = useRef(1280);
  const [coins, setCoins] = useState<number[]>([]);
  const rs = concept === 'AB' ? 'AB' : 'A';

  const setNum = (v: number) => {
    if (num.current) num.current.textContent = v.toLocaleString('ko-KR');
  };
  const countUp = (from: number, to: number, ms: number) => {
    const t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / ms);
      setNum(Math.round(from + (to - from) * (1 - (1 - u) ** 3)));
      if (u < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const bumpHud = () => {
    play(hud.current, [{ transform: concept === 'AB' ? 'scale(1.18) rotate(-4deg)' : 'scale(1.18)' }, { transform: 'none' }], springTiming('prop'));
  };
  const flashPlus = () => {
    const el = plus.current;
    if (!el) return;
    el.classList.remove('is-on');
    void el.offsetWidth;
    el.classList.add('is-on');
  };

  const run = () => {
    const m = getMotion();
    const from = value.current;
    const to = from + 30;
    value.current = to;
    if (m.reduced) {
      setNum(to);
      flashPlus();
      return;
    }
    if (m.tier === 'minimal') {
      play(num.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      setNum(to);
      flashPlus();
      return;
    }
    const n = m.tier === 'lite' ? 1 : 5;
    setCoins(Array.from({ length: n }, (_, i) => Date.now() + i));
    // 코인 요소가 그려진 뒤 날린다
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const host = box.current;
        const target = hud.current?.querySelector('.dm-hud-coin');
        if (!host || !target) return;
        const els = [...host.querySelectorAll<HTMLElement>('.dm-flycoin')];
        const hr = host.getBoundingClientRect();
        const tr = target.getBoundingClientRect();
        let arrived = 0;
        els.forEach((el, i) => {
          const er = el.getBoundingClientRect();
          const tx = tr.left + tr.width / 2 - (er.left + er.width / 2);
          const ty = tr.top + tr.height / 2 - (er.top + er.height / 2);
          const spread = (i - (n - 1) / 2) * 26;
          const up = tierDuration(concept === 'AB' ? 380 : 420);
          const fly = tierDuration(concept === 'AB' ? 440 : 480);
          // 포물선 + 뒤집기(scaleX 코사인) 키프레임
          const kf: Keyframe[] = [];
          for (let s = 0; s <= 10; s++) {
            const u = s / 10;
            const x = spread * u;
            const y = -110 * (1 - (1 - u) ** 2) + 18 * u * u;
            kf.push({ transform: `translate(${x}px, ${y}px) scaleX(${Math.cos(u * Math.PI * 6).toFixed(3)})`, offset: u });
          }
          const a1 = el.animate(kf, { duration: up, delay: i * 60, easing: 'linear', fill: 'forwards' });
          a1.finished.then(() => {
            const last = `translate(${spread}px, -92px)`;
            const end =
              concept === 'AB'
                ? `translate(${tx}px, ${ty}px) rotate(-8deg) scale(0.8)`
                : `translate(${tx}px, ${ty}px) scale(0.7)`;
            const a2 = el.animate([{ transform: last }, { transform: end, opacity: 1 }], {
              duration: fly,
              easing: EASING.inOut,
              fill: 'forwards',
            });
            a2.finished.then(() => {
              el.style.visibility = 'hidden';
              arrived++;
              bumpHud();
              if (arrived === 1) countUp(from, to, tierDuration(600));
              if (arrived === els.length) {
                flashPlus();
                setTimeout(() => setCoins([]), 50);
              }
            });
          });
        });
        void hr;
      }),
    );
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title={concept === 'AB' ? '스티커 코인' : '코인 튀어나옴'} onReplay={run}>
      <div ref={ref} className={`dm-coin dm-coin-${concept}`}>
        <div ref={hud} className="dm-hud" aria-live="polite">
          <span className="dm-hud-coin">
            <RewardIcon kind="coin" size={26} style={rs} />
          </span>
          <span ref={num} className="dm-hud-num">
            1,280
          </span>
          <span ref={plus} className="dm-plus">
            +30
          </span>
        </div>
        <div ref={box} className="dm-chest">
          <svg viewBox="0 0 80 60" width="88" height="66" aria-hidden>
            <rect x="6" y="22" width="68" height="34" rx="8" fill="#C98F55" {...(concept === 'AB' ? { stroke: '#24324A', strokeWidth: 2.4 } : {})} />
            <path d="M6 30 Q40 2 74 30Z" fill="#E0A96D" {...(concept === 'AB' ? { stroke: '#24324A', strokeWidth: 2.4 } : {})} />
            <rect x="34" y="28" width="12" height="14" rx="3" fill="#FFC93C" {...(concept === 'AB' ? { stroke: '#24324A', strokeWidth: 2 } : {})} />
            {concept === 'A' && <rect x="12" y="34" width="22" height="5" rx="2.5" fill="#fff" opacity="0.35" />}
          </svg>
          {coins.map((k) => (
            <span key={k} className="dm-flycoin">
              <RewardIcon kind="coin" size={30} style={rs} />
            </span>
          ))}
        </div>
      </div>
    </DemoFrame>
  );
}

// ───────────── 페이지 넘김 (B)

const PAGES = STAGES[0].quests.slice(0, 6).map((q) => ({ title: `${STAGES[0].order}-${q.order} ${q.title}`, story: q.story }));

function Page({ i, side }: { i: number; side: 'l' | 'r' }) {
  const p = PAGES[i % PAGES.length];
  return (
    <div className={`dm-page dm-page-${side}`}>
      <b className="dm-page-title">{p.title}</b>
      <span className="dm-page-text">{p.story}</span>
      <span className="dm-page-no">{i + 1}</span>
    </div>
  );
}

export function PageTurnDemo() {
  const [i, setI] = useState(0);
  const [turning, setTurning] = useState(false);
  const leaf = useRef<HTMLDivElement | null>(null);
  const right = useRef<HTMLDivElement | null>(null);
  const motion = useMotion();
  const busy = useRef(false);

  const run = () => {
    if (busy.current) return;
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal') {
      setI((v) => v + 2);
      return;
    }
    if (m.tier === 'lite') {
      busy.current = true;
      setI((v) => v + 2);
      requestAnimationFrame(() => {
        right.current
          ?.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASING.out })
          .finished.finally(() => (busy.current = false));
      });
      return;
    }
    busy.current = true;
    setTurning(true);
    requestAnimationFrame(() => {
      const el = leaf.current;
      if (!el) return;
      const a = el.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 700, easing: EASING.page, fill: 'forwards' });
      el.querySelector('.dm-leaf-shade')?.animate([{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0 }], { duration: 700, easing: 'linear' });
      a.finished.then(() => {
        setI((v) => v + 2);
        setTurning(false);
        busy.current = false;
      });
    });
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title="페이지 넘김" onReplay={run} hint="다음 장">
      <div ref={ref} className="dm-book" data-reduced-flash={motion.reduced ? '' : undefined}>
        <Page i={i} side="l" />
        <div ref={right} className="dm-right">
          <Page i={turning ? i + 3 : i + 1} side="r" />
        </div>
        {turning && (
          <div ref={leaf} className="dm-leaf">
            <div className="dm-leaf-front">
              <Page i={i + 1} side="r" />
            </div>
            <div className="dm-leaf-back">
              <Page i={i + 2} side="l" />
            </div>
            <div className="dm-leaf-shade" />
          </div>
        )}
        <div className="dm-spine" />
      </div>
    </DemoFrame>
  );
}

// ───────────── 잉크 번짐 (B)
// 마스크 크기를 키워 그림이 번지듯 나타나게 한다. full은 불규칙한 잉크 얼룩 모양 마스크(필터 비용 0),
// lite는 동그란 마스크, minimal은 페이드, 동작 줄이기는 즉시.

const BLOT = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='M50 8 C63 6 70 18 80 20 C93 23 95 38 90 48 C86 57 96 66 89 77 C82 88 66 84 57 92 C48 99 36 92 28 86 C17 79 6 74 9 60 C11 50 3 42 9 32 C16 20 33 22 38 14 C42 9 45 9 50 8Z'/><circle cx='93' cy='22' r='4'/><circle cx='8' cy='84' r='3'/><circle cx='84' cy='94' r='2.5'/></svg>",
)}")`;
const ROUND = 'radial-gradient(circle, #000 49%, transparent 50%)';

export function InkDemo() {
  const layer = useRef<HTMLDivElement | null>(null);
  const drop = useRef<HTMLSpanElement | null>(null);
  const run = () => {
    const m = getMotion();
    const lay = layer.current;
    if (!lay) return;
    lay.getAnimations().forEach((a) => a.cancel());
    const clear = () => {
      lay.style.maskImage = lay.style.webkitMaskImage = 'none';
    };
    if (m.reduced) {
      clear();
      return;
    }
    if (m.tier === 'minimal') {
      clear();
      lay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
      return;
    }
    const lite = m.tier === 'lite';
    const img = lite ? ROUND : BLOT;
    lay.style.maskImage = lay.style.webkitMaskImage = img;
    const kf: Keyframe[] = [
      { maskSize: '0% 0%', webkitMaskSize: '0% 0%' } as Keyframe,
      { maskSize: '170% 170%', webkitMaskSize: '170% 170%' } as Keyframe,
    ];
    const spread = () =>
      lay.animate(kf, { duration: lite ? 360 : 800, easing: EASING.ink, fill: 'forwards' }).finished.then(clear);
    lay.animate([{ maskSize: '0% 0%', webkitMaskSize: '0% 0%' } as Keyframe, { maskSize: '0% 0%', webkitMaskSize: '0% 0%' } as Keyframe], { duration: 1, fill: 'forwards' });
    if (lite || !drop.current) {
      spread();
      return;
    }
    drop.current
      .animate(
        [
          { transform: 'translateY(-80px)', opacity: 1 },
          { transform: 'translateY(0)', opacity: 1, offset: 0.85 },
          { transform: 'translateY(0) scale(1.8)', opacity: 0 },
        ],
        { duration: 280, easing: 'cubic-bezier(0.5,0,1,0.6)' },
      )
      .finished.then(spread);
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title="잉크 번짐" onReplay={run}>
      <div ref={ref} className="dm-ink">
        <div ref={layer} className="dm-ink-layer">
          <WorldScene concept="B" world={0} label="그림책 1권 숲 마을" />
        </div>
        <span ref={drop} className="dm-ink-drop" aria-hidden />
      </div>
    </DemoFrame>
  );
}

// ───────────── 스탬프 쾅 (B)

export function StampDemo() {
  const stamp = useRef<HTMLDivElement | null>(null);
  const paper = useRef<HTMLDivElement | null>(null);
  const dots = useRef<HTMLDivElement | null>(null);
  const run = () => {
    const s = stamp.current;
    const p = paper.current;
    if (!s || !p) return;
    const m = getMotion();
    dots.current?.classList.remove('is-on');
    if (m.reduced) {
      s.style.opacity = '1';
      return;
    }
    if (m.tier === 'minimal') {
      s.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150, fill: 'forwards' });
      s.style.opacity = '1';
      return;
    }
    const lite = m.tier === 'lite';
    s.getAnimations().forEach((a) => a.cancel());
    s.style.opacity = '1';
    s.animate(
      [
        { transform: 'scale(2.2) rotate(-18deg)', opacity: 0 },
        { transform: 'scale(0.9) rotate(-10deg)', opacity: 1 },
      ],
      { duration: lite ? 160 : 220, easing: EASING.stampIn, fill: 'both' },
    ).finished.then(() => {
      s.animate([{ transform: 'scale(0.9) rotate(-10deg)' }, { transform: 'scale(1) rotate(-8deg)' }], { ...springTiming('body'), fill: 'forwards' });
      if (!lite) {
        p.animate(
          [{ transform: 'translate(0,0)' }, { transform: 'translate(2px,1px)' }, { transform: 'translate(-2px,0)' }, { transform: 'translate(0,0)' }],
          { duration: 120, easing: 'steps(3, end)' },
        );
        dots.current?.classList.add('is-on');
      }
    });
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title="스탬프 쾅" onReplay={run}>
      <div ref={ref} className="dm-stampwrap">
        <div ref={paper} className="dm-paper">
          <span className="dm-paper-k">퀘스트 {STAGES[0].order}-1</span>
          <b className="dm-paper-t">{STAGES[0].quests[0].title}</b>
          <span className="dm-paper-line" />
          <span className="dm-paper-line short" />
          <div ref={stamp} className="dm-stamp">
            <span>통과!</span>
          </div>
          <div ref={dots} className="dm-splat" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <i key={i} style={{ ['--a' as string]: `${i * 60 + 15}deg` }} />
            ))}
          </div>
        </div>
      </div>
    </DemoFrame>
  );
}

// ───────────── 잉크 길 + 팝업 섬 (AB)

export function PopupIslandDemo() {
  const path = useRef<SVGPathElement | null>(null);
  const island = useRef<HTMLDivElement | null>(null);
  const lock = useRef<HTMLDivElement | null>(null);
  const label = useRef<HTMLSpanElement | null>(null);
  const run = () => {
    const pth = path.current;
    const isl = island.current;
    const lk = lock.current;
    if (!pth || !isl || !lk) return;
    const m = getMotion();
    [pth, isl, lk].forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    const len = pth.getTotalLength();
    pth.style.strokeDasharray = `${len}`;
    label.current?.classList.remove('is-on');
    const finish = () => {
      pth.style.strokeDashoffset = '0';
      isl.style.transform = 'none';
      isl.style.opacity = '1';
      lk.style.opacity = '0';
    };
    if (m.reduced) {
      finish();
      label.current?.classList.add('is-on');
      return;
    }
    if (m.tier === 'minimal') {
      pth.style.strokeDashoffset = '0';
      isl.style.transform = 'none';
      isl.style.opacity = '1';
      lk.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: 'forwards' });
      return;
    }
    const lite = m.tier === 'lite';
    pth.style.strokeDashoffset = `${len}`;
    isl.style.transform = lite ? 'translateY(12px)' : 'rotateX(75deg)';
    isl.style.opacity = lite ? '0' : '1';
    lk.style.opacity = '1';
    pth
      .animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: lite ? 400 : 800, easing: EASING.ink, fill: 'forwards' })
      .finished.then(() => {
        pth.style.strokeDashoffset = '0';
        lk.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 200, fill: 'forwards' });
        const kf = lite
          ? [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }]
          : [{ transform: 'rotateX(75deg)' }, { transform: 'rotateX(0deg)' }];
        isl.animate(kf, lite ? { duration: 260, easing: EASING.out, fill: 'forwards' } : { ...springTiming('body'), fill: 'forwards' }).finished.then(finish);
        if (!lite) label.current?.classList.add('is-on');
      });
  };
  const ref = useAutoPlay(run);
  return (
    <DemoFrame title="잉크 길 + 팝업 섬" onReplay={run} hint="스테이지 해제">
      <div ref={ref} className="dm-popup">
        <svg className="dm-popup-map" viewBox="0 0 300 170" aria-hidden preserveAspectRatio="xMidYMid meet">
          <path d="M58 120 C110 150 150 70 228 92" stroke="#E2C99B" strokeWidth="9" fill="none" strokeLinecap="round" />
          <path ref={path} d="M58 120 C110 150 150 70 228 92" stroke="#24324A" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeDasharray="4 7" />
          <g transform="translate(58 120)">
            <ellipse rx="34" ry="12" fill="#6CC77F" stroke="#24324A" strokeWidth="2.4" />
            <ellipse cx="-10" cy="-4" rx="10" ry="3" fill="#fff" opacity="0.45" />
            <path d="M-6 -10 l4 -16 l12 6z" fill="#FF7F66" stroke="#24324A" strokeWidth="2" strokeLinejoin="round" />
          </g>
        </svg>
        <div className="dm-popup-island" ref={island} style={{ transform: 'none' }}>
          <svg viewBox="0 0 120 90" width="120" height="90" aria-hidden>
            <ellipse cx="60" cy="78" rx="50" ry="10" fill="#24324A" opacity="0.12" />
            <path d="M12 74 Q14 40 60 36 Q106 40 108 74 Q60 86 12 74Z" fill="#6CC77F" stroke="#24324A" strokeWidth="2.6" strokeLinejoin="round" />
            <ellipse cx="40" cy="48" rx="14" ry="4" fill="#fff" opacity="0.45" />
            <rect x="44" y="20" width="32" height="30" rx="4" fill="#FFFCF3" stroke="#24324A" strokeWidth="2.4" />
            <path d="M40 22 L60 6 L80 22Z" fill="#6EC1EA" stroke="#24324A" strokeWidth="2.4" strokeLinejoin="round" />
            <rect x="55" y="34" width="10" height="16" rx="2" fill="#F4A04B" stroke="#24324A" strokeWidth="2" />
          </svg>
          <span className="dm-popup-name">변수의 숲</span>
        </div>
        <div className="dm-popup-lock" ref={lock} style={{ opacity: 0 }}>
          <Icon name="lock" size={22} />
        </div>
        <span ref={label} className="dm-popup-label">
          열렸어요!
        </span>
      </div>
    </DemoFrame>
  );
}

