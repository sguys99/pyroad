// A×B 시그니처 모션 (P2-05): 퀘스트 성공 · 레벨업 · 스테이지 해제
// 고유 문법 = A의 젤리·점프(jellyAB·prop 스프링) + B의 도장 쾅·종이 팝업(rotateX로 일어서는 종이)
// 화면 조각(카드)과 비트 만들기(build*)를 나눠, #motion 무대·실제 퀘스트 성공·월드맵 해제가 같은 연출을 쓴다
import { forwardRef, useImperativeHandle, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Byeolttongi } from '../shared/characters/Friends';
import { Icon, RewardIcon } from '../shared/icons';
import { PybaemRig, PybaemStatic } from '../shared/rig/PybaemRig';
import type { RigState } from '../shared/rig/params';
import type { StarMood } from '../shared/characters/Friends';
import { PaperIsland, StampMark } from './art';
import type { MotionView, Timeline } from './timeline';


/** 파티클 상한 (motion-guidelines §2: lite 30%, minimal·동작 줄이기 0) */
export function particleCount(m: MotionView, full: number) {
  if (m.reduced || m.tier === 'minimal') return 0;
  return m.tier === 'lite' ? Math.max(1, Math.round(full * 0.3)) : full;
}
/** 같은 결과가 나오는 난수 (되감아도 같은 궤적) */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
function center(el: Element, layer: Element) {
  const a = el.getBoundingClientRect();
  const b = layer.getBoundingClientRect();
  return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
}
const CONFETTI_COLORS = ['#FFD24D', '#FF7F66', '#6EC1EA', '#5CCB7A', '#9B7FE0', '#FFFCF3'];

// ───────────── 종이 컨페티 (가벼운 DOM 조각, transform·opacity만)

export function Confetti({ n, refList }: { n: number; refList: MutableRefObject<(HTMLSpanElement | null)[]> }) {
  const r = rng(11);
  return (
    <div className="ab-confetti" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          data-beat
          ref={(el) => {
            refList.current[i] = el;
          }}
          className={`ab-confetti-bit ${i % 3 === 0 ? 'is-round' : ''}`}
          style={{ background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], width: 11 + Math.round(r() * 7), height: 14 + Math.round(r() * 9) }}
        />
      ))}
    </div>
  );
}
function burst(tl: Timeline, bits: (HTMLElement | null)[], at: number, n: number, opt: { spread: number; up: number; seed: number; label: string; key: string }) {
  const r = rng(opt.seed);
  for (let i = 0; i < bits.length; i++) {
    const el = bits[i];
    if (!el) continue;
    if (i >= n) continue;
    const ang = (-90 + (r() - 0.5) * 160) * (Math.PI / 180);
    const dist = opt.spread * (0.5 + r() * 0.6);
    const x = Math.cos(ang) * dist;
    const y = Math.sin(ang) * dist * opt.up;
    const rot = (r() - 0.5) * 720;
    const delay = Math.round(r() * 120);
    tl.show(el, at + delay, `${opt.key}${i}`);
    tl.add(
      el,
      [
        { transform: 'translate(0,0) rotate(0deg) scale(0.4)', opacity: 1 },
        { transform: `translate(${x}px, ${y}px) rotate(${rot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x * 1.25}px, ${y + 160}px) rotate(${rot}deg) scale(0.9)`, opacity: 0 },
      ],
      { at: at + delay, ease: 'out', dur: tl.d(1600), label: i === 0 ? opt.label : undefined },
    );
  }
}

// ───────────── 퀘스트 성공 카드

export interface SuccessRefs {
  root: HTMLDivElement | null;
  scrim: HTMLDivElement | null;
  card: HTMLDivElement | null;
  stamp: HTMLDivElement | null;
  splat: (HTMLElement | null)[];
  stars: (HTMLSpanElement | null)[];
  sparks: (HTMLSpanElement | null)[];
  xpChip: HTMLSpanElement | null;
  coinChip: HTMLSpanElement | null;
  xpNum: HTMLElement | null;
  coinNum: HTMLElement | null;
  coins: (HTMLSpanElement | null)[];
  gem: HTMLSpanElement | null;
  cta: HTMLDivElement | null;
  setPy: (s: RigState) => void;
}

export const SuccessCard = forwardRef<
  SuccessRefs,
  {
    title: string;
    stars: number;
    xp: number;
    coins: number;
    note?: string;
    view: MotionView;
    compact?: boolean;
    actions: ReactNode;
    kicker?: string;
    /** false면 리그 엔진 없이 정지 그림 (무대에서 재생하지 않을 때, 성능) */
    live?: boolean;
  }
>(function SuccessCard({ title, stars, xp, coins, note, view, compact, actions, kicker = '퀘스트 클리어', live = true }, ref) {
  const [py, setPy] = useState<RigState>('happy');
  const r = useRef<SuccessRefs>({
    root: null,
    scrim: null,
    card: null,
    stamp: null,
    splat: [],
    stars: [],
    sparks: [],
    xpChip: null,
    coinChip: null,
    xpNum: null,
    coinNum: null,
    coins: [],
    gem: null,
    cta: null,
    setPy,
  });
  r.current.setPy = setPy;
  useImperativeHandle(ref, () => r.current);
  const R = r.current;
  return (
    <div className={`ab-sc ${compact ? 'is-compact' : ''}`} data-beat ref={(el) => void (R.root = el)}>
      <div className="ab-sc-scrim" ref={(el) => void (R.scrim = el)} />
      <div className="ab-cele" ref={(el) => void (R.card = el)}>
        <div className="ab-cele-py">
          {live ? (
            <PybaemRig style="AB" state={py} size={compact ? 116 : 150} lookAt={false} tier={view.tier} reducedMotion={view.reduced} />
          ) : (
            <PybaemStatic style="AB" state={py} size={compact ? 116 : 150} framing="stage" idPrefix="scpy" />
          )}
        </div>
        <div className="ab-cele-stamp" data-beat ref={(el) => void (R.stamp = el)} aria-hidden>
          <span>통과!</span>
        </div>
        <div className="ab-splat" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <i key={i} data-beat ref={(el) => void (R.splat[i] = el)} style={{ ['--a' as string]: `${i * 60 + 10}deg` }} />
          ))}
        </div>
        <p className="ab-cele-kicker">{kicker}</p>
        <h2 className="ab-cele-title">{title}</h2>
        <div className="ab-cele-stars" role="img" aria-label={`별 3개 중 ${stars}개`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="ab-sc-star">
              <span className="ab-sc-star-empty">
                <RewardIcon kind="starEmpty" style="AB" size={compact ? 38 : 46} />
              </span>
              {i < stars && (
                <span className="ab-sc-star-fill" data-beat ref={(el) => void (R.stars[i] = el)}>
                  <RewardIcon kind="star" style="AB" size={compact ? 38 : 46} />
                </span>
              )}
              {i < stars &&
                [0, 1, 2].map((k) => (
                  <span key={k} className="ab-spark" data-beat ref={(el) => void (R.sparks[i * 3 + k] = el)} style={{ ['--a' as string]: `${k * 120 - 90}deg` }} />
                ))}
            </span>
          ))}
        </div>
        {note && <p className="ab-cele-note">{note}</p>}
        <div className="ab-cele-rewards">
          <span className="ab-reward" ref={(el) => void (R.xpChip = el)}>
            <RewardIcon kind="gem" style="AB" size={26} />
            <b ref={(el) => void (R.xpNum = el)}>+{xp}</b> XP
          </span>
          <span className="ab-reward" ref={(el) => void (R.coinChip = el)}>
            <RewardIcon kind="coin" style="AB" size={26} />
            <b ref={(el) => void (R.coinNum = el)}>+{coins}</b> 코인
          </span>
        </div>
        <div className="ab-cele-actions" data-beat ref={(el) => void (R.cta = el)}>
          {actions}
        </div>
      </div>
      <div className="ab-fly" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="ab-fly-coin" data-beat ref={(el) => void (R.coins[i] = el)}>
            <RewardIcon kind="coin" style="AB" size={30} />
          </span>
        ))}
        <span className="ab-fly-coin" data-beat ref={(el) => void (R.gem = el)}>
          <RewardIcon kind="gem" style="AB" size={30} />
        </span>
      </div>
    </div>
  );
});

export interface HudTarget {
  coin: Element | null;
  coinNum: Element | null;
  xp: Element | null;
  xpFill?: HTMLElement | null;
  base: { coins: number; xp: number; xpNext: number };
}

/** 퀘스트 성공 비트. at부터 시작. 끝 시각을 돌려준다 */
export function buildSuccess(tl: Timeline, r: SuccessRefs, o: { at: number; stars: number; xp: number; coins: number; hud: HudTarget | null; onGrant?: () => void }) {
  const m = tl.m;
  const a = o.at;
  const full = m.tier === 'full' && !m.reduced;
  const lite = m.tier === 'lite' && !m.reduced;
  const minimal = m.tier === 'minimal' && !m.reduced;
  tl.show(r.root, a, 'sc-root');
  tl.state('py', 'happy' as RigState, r.setPy);
  // 1. 바닥 어둡게 + 카드 종이 팝업 (아래 접힌 선을 축으로 일어섬)
  if (!m.reduced) tl.add(r.scrim, [{ opacity: 0 }, { opacity: 1 }], { at: a, ease: 'out', dur: minimal ? 150 : tl.d(220), label: '배경 어둡게' });
  if (full) tl.add(r.card, [{ transform: 'perspective(900px) rotateX(-72deg) translateY(30px)' }, { transform: 'none' }], { at: a, ease: 'body', label: '카드 종이 팝업 (body)' });
  else if (lite) tl.add(r.card, [{ transform: 'translateY(16px)' }, { transform: 'none' }], { at: a, ease: 'out', dur: tl.d(260), label: '카드 올라옴' });
  else if (minimal) tl.add(r.card, [{ opacity: 0 }, { opacity: 1 }], { at: a, ease: 'linear', dur: 150, label: '카드 페이드' });
  else tl.beat('카드 즉시 표시', a, 0, 'cue');
  tl.at(a + 120, 'py', 'cheer', '파이뱀 응원');
  // 2. 통과! 도장 쾅 (B)
  const ts = a + (m.reduced ? 300 : tl.d(460));
  tl.show(r.stamp, ts, 'sc-stamp');
  if (full || lite) {
    tl.add(r.stamp, [{ transform: 'rotate(-12deg) scale(2.2)', opacity: 0.25 }, { transform: 'rotate(-12deg) scale(0.9)', opacity: 1 }], { at: ts, ease: 'stampIn', dur: tl.d(220), label: '도장 쾅 (stampIn)' });
    tl.add(r.stamp, [{ transform: 'rotate(-12deg) scale(0.9)' }, { transform: 'rotate(-12deg)' }], { at: ts + tl.d(220), ease: 'body', label: '도장 안착 (body)', fill: 'forwards' });
  } else if (minimal) tl.add(r.stamp, [{ opacity: 0 }, { opacity: 1 }], { at: ts, ease: 'linear', dur: 150, label: '도장 페이드' });
  else tl.beat('도장 즉시', ts, 0, 'cue');
  if (full) {
    tl.add(r.card, [{ transform: 'translate(2px, 1px)' }, { transform: 'translate(-2px, -1px)' }, { transform: 'none' }], { at: ts + 220, ease: 'steps3', dur: 120, label: '종이 흔들림 (steps 3)', fill: 'none' });
    r.splat.forEach((el, i) => {
      tl.show(el, ts + 220, `sc-splat${i}`);
      tl.add(el, [{ transform: 'rotate(var(--a)) translateY(-26px) scale(0.3)', opacity: 0.9 }, { transform: 'rotate(var(--a)) translateY(-58px) scale(1)', opacity: 0 }], { at: ts + 220, ease: 'ink', dur: 420, label: i === 0 ? '잉크 튐 6개' : undefined });
    });
  }
  // 3. 별 하나씩 (A의 팝 + 스티커처럼 기울었다 붙음)
  const t0 = ts + (m.reduced ? 300 : tl.d(380));
  const gap = m.reduced ? 300 : tl.d(240);
  for (let i = 0; i < o.stars; i++) {
    const at = t0 + i * gap;
    tl.show(r.stars[i], at, `sc-star${i}`);
    if (full || lite)
      tl.add(r.stars[i], [{ transform: 'scale(0.2) rotate(-40deg)' }, { transform: 'none' }], { at, ease: 'prop', label: i === 0 ? '별 팝 (prop, 240ms 간격)' : undefined });
    else if (minimal) tl.add(r.stars[i], [{ opacity: 0 }, { opacity: 1 }], { at, ease: 'linear', dur: 150, label: i === 0 ? '별 페이드' : undefined });
    else if (i === 0) tl.beat('별 하나씩 즉시', at, (o.stars - 1) * gap, 'cue');
    const sparks = full ? 3 : lite ? 1 : 0;
    for (let k = 0; k < sparks; k++) {
      const el = r.sparks[i * 3 + k];
      tl.show(el, at + 80, `sc-spark${i}${k}`);
      tl.add(el, [{ transform: 'rotate(var(--a)) translateY(-10px) scale(0.4)', opacity: 1 }, { transform: 'rotate(var(--a)) translateY(-40px) scale(1)', opacity: 0 }], { at: at + 80, ease: 'out', dur: 420, label: i === 0 && k === 0 ? '반짝 조각' : undefined });
    }
  }
  const tEnd = t0 + (o.stars - 1) * gap + (m.reduced ? 300 : tl.d(320));
  // 4. 보상 숫자 카운트업 (카드 안)
  const countDur = m.reduced ? 0 : minimal ? 150 : tl.d(500);
  const xpNum = r.xpNum;
  const coinNum = r.coinNum;
  tl.tick(tEnd, countDur, (p) => {
    if (xpNum) xpNum.textContent = `+${Math.round(o.xp * p)}`;
    if (coinNum) coinNum.textContent = `+${Math.round(o.coins * p)}`;
  }, '보상 숫자 올리기');
  // 5. 스티커 코인 → HUD (A×B: 튀어오름 380 → 이동 440 → 붙을 때 -8° · 0.8)
  const fly = tEnd + (m.reduced ? 200 : tl.d(200));
  const nCoins = particleCount(m, 5);
  const layer = r.root?.querySelector('.ab-fly');
  let land = fly;
  if (o.hud && layer && r.coinChip) {
    const from = center(r.coinChip, layer);
    const to = o.hud.coin ? center(o.hud.coin, layer) : from;
    const up = tl.d(380);
    const mv = tl.d(440);
    r.coins.forEach((el, j) => {
      if (!el) return;
      el.style.left = `${from.x}px`;
      el.style.top = `${from.y}px`;
      if (j >= nCoins) return;
      const at = fly + j * 60;
      tl.show(el, at, `sc-coin${j}`);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      tl.add(
        el,
        [
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 1 },
          { transform: `translate(calc(-50% + ${(j - 2) * 14}px), calc(-50% - 70px)) scale(1.1)`, opacity: 1, offset: up / (up + mv), easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(-8deg) scale(0.8)`, opacity: 1, offset: 0.94 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(-8deg) scale(0.8)`, opacity: 0 },
        ],
        { at, ease: 'out', dur: up + mv, label: j === 0 ? '스티커 코인 → HUD' : undefined },
      );
      land = Math.max(land, at + up + mv);
    });
    if (r.gem && r.xpChip) {
      const gf = center(r.xpChip, layer);
      const gt = o.hud.xp ? center(o.hud.xp, layer) : gf;
      r.gem.style.left = `${gf.x}px`;
      r.gem.style.top = `${gf.y}px`;
      if (nCoins > 0) {
        tl.show(r.gem, fly + 40, 'sc-gem');
        tl.add(
          r.gem,
          [
            { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 1 },
            { transform: 'translate(-50%, calc(-50% - 60px)) scale(1.1)', opacity: 1, offset: 0.46 },
            { transform: `translate(calc(-50% + ${gt.x - gf.x}px), calc(-50% + ${gt.y - gf.y}px)) scale(0.8)`, opacity: 1, offset: 0.94 },
            { transform: `translate(calc(-50% + ${gt.x - gf.x}px), calc(-50% + ${gt.y - gf.y}px)) scale(0.8)`, opacity: 0 },
          ],
          { at: fly + 40, ease: 'out', dur: up + mv, label: 'XP 보석 → 경험치 바' },
        );
      }
    }
    if (!nCoins) land = fly;
    // HUD 붙는 순간: 칩이 살짝 기울며 팝 + 숫자 카운트업 / 줄이기: 색만
    const hud = o.hud;
    if (full || lite) tl.add(hud.coin, [{ transform: 'scale(1.18) rotate(-4deg)' }, { transform: 'none' }], { at: land - 40, ease: 'prop', label: 'HUD 팝 (prop)', fill: 'none' });
    if (hud.coin) {
      const chip = hud.coin;
      tl.state('hud-hi', false, (v) => chip.classList.toggle('is-bumped', !!v));
      tl.at(land - 40, 'hud-hi', true);
      tl.at(land + 1200, 'hud-hi', false);
    }
    if (minimal && hud.coinNum) tl.add(hud.coinNum, [{ opacity: 0 }, { opacity: 1 }], { at: land, ease: 'linear', dur: 150, label: 'HUD 숫자 페이드', fill: 'none' });
    const hn = hud.coinNum;
    const base = hud.base;
    tl.tick(land - 40, m.reduced ? 0 : minimal ? 0 : tl.d(600), (p) => {
      if (hn) hn.textContent = Math.round(base.coins + o.coins * p).toLocaleString('ko-KR');
    }, 'HUD 코인 카운트업');
    const fill = hud.xpFill;
    if (fill) {
      tl.tick(land, m.reduced || minimal ? 0 : tl.d(500), (p) => {
        const v = Math.min(base.xpNext, base.xp + o.xp * p);
        fill.style.width = `${(v / base.xpNext) * 100}%`;
      }, 'XP 바 채우기');
    }
    if (o.onGrant) {
      const g = o.onGrant;
      let done = false;
      tl.state('grant', false, (v) => {
        if (v && !done) {
          done = true;
          g();
        }
      });
      tl.at(land + (m.reduced || minimal ? 0 : tl.d(620)), 'grant', true);
    }
  }
  // 6. 다음 행동 CTA
  const tc = land + (m.reduced ? 200 : tl.d(260));
  tl.show(r.cta, tc, 'sc-cta');
  if (full || lite) tl.add(r.cta, [{ transform: 'translateY(14px) scale(0.92)' }, { transform: 'none' }], { at: tc, ease: lite ? 'face' : 'jellyAB', label: '다음 퀘스트 버튼 (jellyAB)' });
  else if (minimal) tl.add(r.cta, [{ opacity: 0 }, { opacity: 1 }], { at: tc, ease: 'linear', dur: 150, label: '버튼 페이드' });
  else tl.beat('버튼 즉시', tc, 0, 'cue');
  return tc + 300;
}

// ───────────── 레벨업

export interface LevelRefs {
  card: HTMLDivElement | null;
  bar: HTMLSpanElement | null;
  fill: HTMLSpanElement | null;
  xpText: HTMLSpanElement | null;
  badge: HTMLDivElement | null;
  badgeNum: HTMLSpanElement | null;
  ribbons: (HTMLSpanElement | null)[];
  banner: HTMLDivElement | null;
  confetti: (HTMLSpanElement | null)[];
  star: HTMLDivElement | null;
  title: HTMLDivElement | null;
  titleStamp: HTMLDivElement | null;
  bubble: HTMLDivElement | null;
  cta: HTMLDivElement | null;
  setPy: (s: RigState) => void;
  setStar: (s: StarMood) => void;
}

export const LEVEL_TITLES: Record<number, string> = { 5: '변수 마법사', 6: '조건 탐정', 7: '반복 대장' };

export const LevelUpCard = forwardRef<LevelRefs, { from: number; view: MotionView; actions: ReactNode; compact?: boolean; live?: boolean }>(function LevelUpCard({ from, view, actions, compact, live = true }, ref) {
  const [py, setPy] = useState<RigState>('happy');
  const [star, setStar] = useState<StarMood>('flying');
  const conf = useRef<(HTMLSpanElement | null)[]>([]);
  const r = useRef<LevelRefs>({
    card: null,
    bar: null,
    fill: null,
    xpText: null,
    badge: null,
    badgeNum: null,
    ribbons: [],
    banner: null,
    confetti: [],
    star: null,
    title: null,
    titleStamp: null,
    bubble: null,
    cta: null,
    setPy,
    setStar,
  });
  r.current.setPy = setPy;
  r.current.setStar = setStar;
  r.current.confetti = conf.current;
  useImperativeHandle(ref, () => r.current);
  const R = r.current;
  return (
    <div className={`ab-lv-card ${compact ? 'is-compact' : ''}`} ref={(el) => void (R.card = el)}>
      <Confetti n={24} refList={conf} />
      <div className="ab-lv-banner" data-beat ref={(el) => void (R.banner = el)}>
        <span>레벨 업!</span>
      </div>
      <div className="ab-lv-stage">
        <div className="ab-lv-badge" ref={(el) => void (R.badge = el)}>
          <span className="ab-lv-ribbon is-l" data-beat ref={(el) => void (R.ribbons[0] = el)} />
          <span className="ab-lv-ribbon is-r" data-beat ref={(el) => void (R.ribbons[1] = el)} />
          <span className="ab-lv-badge-face">
            <small>Lv</small>
            <span ref={(el) => void (R.badgeNum = el)}>{from + 1}</span>
          </span>
        </div>
        <div className="ab-lv-py">
          {live ? (
            <PybaemRig style="AB" state={py} size={compact ? 104 : 130} lookAt={false} tier={view.tier} reducedMotion={view.reduced} />
          ) : (
            <PybaemStatic style="AB" state={py} size={compact ? 104 : 130} framing="stage" idPrefix="lvpy" />
          )}
        </div>
        <div className="ab-lv-star" data-beat ref={(el) => void (R.star = el)}>
          <Byeolttongi style="AB" mood={star} size={compact ? 70 : 84} motion={!live || view.reduced || view.tier === 'minimal' ? 'none' : 'bob'} />
        </div>
      </div>
      <div className="ab-lv-xp">
        <span className="ab-progress ab-lv-bar" ref={(el) => void (R.bar = el)}>
          <span className="ab-progress-fill" ref={(el) => void (R.fill = el)} />
        </span>
        <span className="ab-lv-xp-text" ref={(el) => void (R.xpText = el)} />
      </div>
      <div className="ab-lv-title" data-beat ref={(el) => void (R.title = el)}>
        <span className="ab-lv-title-label">새 칭호</span>
        <span className="ab-lv-title-name">{LEVEL_TITLES[from + 1] ?? '모험 고수'}</span>
        <div className="ab-lv-title-stamp" data-beat ref={(el) => void (R.titleStamp = el)} aria-hidden>
          <StampMark text="획득" size={56} />
        </div>
      </div>
      <div className="ab-lv-bubble" data-beat ref={(el) => void (R.bubble = el)}>
        <span className="ab-nametag ab-nametag-lemon">별똥이</span>
        <p>
          레벨 {from + 1}! 새 칭호 <b>{LEVEL_TITLES[from + 1] ?? '모험 고수'}</b>를 프로필에 붙여 줄게.
        </p>
      </div>
      <div className="ab-lv-cta" data-beat ref={(el) => void (R.cta = el)}>
        {actions}
      </div>
    </div>
  );
});

export function buildLevelUp(tl: Timeline, r: LevelRefs, o: { at: number; from: number; xp: { from: number; next: number; over: number; next2: number } }) {
  const m = tl.m;
  const a = o.at;
  const full = m.tier === 'full' && !m.reduced;
  const lite = m.tier === 'lite' && !m.reduced;
  const minimal = m.tier === 'minimal' && !m.reduced;
  const moving = full || lite;
  tl.state('lv-py', 'happy' as RigState, r.setPy);
  tl.state('lv-star', 'flying' as StarMood, r.setStar);
  const num = r.badgeNum;
  const badge = r.badge;
  tl.state('lv-num', o.from, (v) => num && (num.textContent = String(v)));
  tl.state('lv-new', false, (v) => badge?.classList.toggle('is-new', !!v));
  const fill = r.fill;
  const txt = r.xpText;
  const bar = r.bar;
  // 1. XP 바가 차서 넘침
  const fillDur = m.reduced ? 0 : minimal ? 150 : tl.d(700);
  tl.tick(a, fillDur, (p) => {
    const v = o.xp.from + (o.xp.next - o.xp.from) * p;
    if (fill) fill.style.width = `${(v / o.xp.next) * 100}%`;
    if (txt) txt.textContent = `${Math.round(v)} / ${o.xp.next} XP`;
  }, 'XP 바 차오름');
  const tOver = a + (m.reduced ? 300 : tl.d(760));
  tl.state('lv-full', false, (v) => bar?.classList.toggle('is-full', !!v));
  tl.at(tOver, 'lv-full', true, '넘침 (바 반짝)');
  if (moving) tl.add(r.bar, [{ transform: 'scale(1.05, 1.5)' }, { transform: 'none' }], { at: tOver, ease: lite ? 'face' : 'jellyAB', label: '바 젤리 (jellyAB)', fill: 'none' });
  // 2. 레벨 배지 변신: 뒤집혀서 새 숫자 + 종이 리본이 펼쳐짐
  const tFlip = tOver + (m.reduced ? 300 : tl.d(160));
  const flip = tl.d(180);
  if (moving) {
    tl.add(r.badge, [{ transform: 'none' }, { transform: 'rotateY(90deg) scale(1.1)' }], { at: tFlip, ease: 'press', dur: flip, label: '배지 뒤집기', fill: 'none' });
    tl.add(r.badge, [{ transform: 'rotateY(-90deg) scale(1.35)' }, { transform: 'scale(1.35)' }], { at: tFlip + flip, ease: 'out', dur: flip, fill: 'none' });
    tl.add(r.badge, [{ transform: 'scale(1.35)' }, { transform: 'none' }], { at: tFlip + flip * 2, ease: 'prop', label: '배지 팝 (prop)', fill: 'none' });
  } else if (minimal) tl.add(r.badge, [{ opacity: 0.2 }, { opacity: 1 }], { at: tFlip + flip, ease: 'linear', dur: 150, label: '배지 페이드', fill: 'none' });
  tl.at(tFlip + (moving ? flip : 0), 'lv-num', o.from + 1, '숫자 바뀜');
  tl.at(tFlip + (moving ? flip : 0), 'lv-new', true);
  const tRib = tFlip + (moving ? flip * 2 : 0);
  r.ribbons.forEach((el, i) => {
    tl.show(el, tRib, `lv-rib${i}`);
    if (full) tl.add(el, [{ transform: `rotate(${i ? 18 : -18}deg) rotateX(90deg)` }, { transform: `rotate(${i ? 18 : -18}deg)` }], { at: tRib + i * 60, ease: 'body', label: i === 0 ? '종이 리본 펼침 (body)' : undefined });
  });
  // XP 바는 넘친 만큼 새 바에서 다시
  tl.tick(tRib, m.reduced || minimal ? 0 : tl.d(400), (p) => {
    if (p <= 0) return;
    const v = o.xp.over * p;
    if (fill) fill.style.width = `${(v / o.xp.next2) * 100}%`;
    if (txt) txt.textContent = `${Math.round(v)} / ${o.xp.next2} XP`;
  }, '새 경험치 바');
  tl.at(tRib, 'lv-full', false);
  // 3. 축하: 접힌 배너가 펼쳐짐 (B 종이) + 종이 컨페티 + 파이뱀 춤
  const tBan = tRib + (m.reduced ? 0 : 40);
  tl.show(r.banner, tBan, 'lv-banner');
  if (full) tl.add(r.banner, [{ transform: 'perspective(600px) rotateX(-90deg)' }, { transform: 'none' }], { at: tBan, ease: 'body', label: '배너 펼침 (body)' });
  else if (lite) tl.add(r.banner, [{ transform: 'translateY(-10px)' }, { transform: 'none' }], { at: tBan, ease: 'out', dur: tl.d(260), label: '배너 내려옴' });
  else if (minimal) tl.add(r.banner, [{ opacity: 0 }, { opacity: 1 }], { at: tBan, ease: 'linear', dur: 150, label: '배너 페이드' });
  const n = particleCount(m, 24);
  if (n) burst(tl, r.confetti, tBan + 60, n, { spread: 170, up: 1.1, seed: 7, label: `종이 컨페티 ${n}조각`, key: 'lv-c' });
  tl.at(tBan + 100, 'lv-py', 'dance', '파이뱀 춤');
  // 4. 별똥이 등장 (보상 안내 요정): 오른쪽 위에서 휙 → 착지 → 반짝
  const tStar = tBan + (m.reduced ? 300 : tl.d(520));
  tl.show(r.star, tStar, 'lv-starshow');
  const flyDur = tl.d(600);
  if (moving) {
    tl.add(r.star, [{ transform: 'translate(170px, -150px) rotate(30deg) scale(0.6)' }, { transform: 'translate(40px, -60px) rotate(10deg)', offset: 0.6 }, { transform: 'none' }], { at: tStar, ease: 'inOut', dur: flyDur, label: '별똥이 날아옴 (inOut)' });
    tl.add(r.star, [{ transform: 'scale(1.2, 0.8)' }, { transform: 'none' }], { at: tStar + flyDur, ease: 'prop', label: '별똥이 착지 (prop)', fill: 'none' });
  } else if (minimal) tl.add(r.star, [{ opacity: 0 }, { opacity: 1 }], { at: tStar, ease: 'linear', dur: 150, label: '별똥이 페이드' });
  tl.at(tStar + (moving ? flyDur : 0), 'lv-star', 'landing');
  tl.at(tStar + (moving ? flyDur + 400 : 300), 'lv-star', 'sparkling', '별똥이 반짝');
  // 5. 새 칭호 카드 + 말풍선 + "획득" 도장
  const tTitle = tStar + (m.reduced ? 300 : tl.d(flyDur + 160));
  tl.show(r.title, tTitle, 'lv-title');
  if (moving) tl.add(r.title, [{ transform: 'scale(0.6) rotate(-10deg)' }, { transform: 'rotate(-2deg)' }], { at: tTitle, ease: 'prop', label: '새 칭호 스티커 (prop)' });
  else if (minimal) tl.add(r.title, [{ opacity: 0 }, { opacity: 1 }], { at: tTitle, ease: 'linear', dur: 150, label: '칭호 페이드' });
  const tBub = tTitle + (m.reduced ? 300 : tl.d(220));
  tl.show(r.bubble, tBub, 'lv-bubble');
  if (moving) tl.add(r.bubble, [{ transform: 'translateY(10px) scale(0.94)' }, { transform: 'none' }], { at: tBub, ease: 'face', label: '말풍선 (face)' });
  const tSt = tTitle + (m.reduced ? 300 : tl.d(520));
  tl.show(r.titleStamp, tSt, 'lv-tstamp');
  if (moving) tl.add(r.titleStamp, [{ transform: 'scale(2.2)', opacity: 0.25 }, { transform: 'scale(0.9)', opacity: 1 }, { transform: 'none' }], { at: tSt, ease: 'stampIn', dur: tl.d(320), label: '획득 도장 쾅' });
  else if (minimal) tl.add(r.titleStamp, [{ opacity: 0 }, { opacity: 1 }], { at: tSt, ease: 'linear', dur: 150, label: '도장 페이드' });
  // 6. CTA
  const tC = tSt + (m.reduced ? 300 : tl.d(380));
  tl.show(r.cta, tC, 'lv-cta');
  if (moving) tl.add(r.cta, [{ transform: 'translateY(12px) scale(0.92)' }, { transform: 'none' }], { at: tC, ease: lite ? 'face' : 'jellyAB', label: '확인 버튼 (jellyAB)' });
  return tC + 300;
}

// ───────────── 스테이지 해제 (지도 조각)

export interface UnlockRefs {
  stamp: Element | null;
  mask: SVGPathElement | null;
  lock: Element | null;
  art: Element | null;
  awake: (v: boolean) => void;
  tag: Element | null;
  stars: Element | null;
  starsText: (v: boolean) => void;
  badge: Element | null;
  py: HTMLElement | null;
  pyInner: Element | null;
  pyFrom: { x: number; y: number };
  pyTo: { x: number; y: number };
  bits: (HTMLElement | null)[];
  setPy?: (s: RigState) => void;
}

export function buildUnlock(tl: Timeline, r: UnlockRefs, o: { at: number }) {
  const m = tl.m;
  const a = o.at;
  const full = m.tier === 'full' && !m.reduced;
  const lite = m.tier === 'lite' && !m.reduced;
  const minimal = m.tier === 'minimal' && !m.reduced;
  const moving = full || lite;
  // 1. 지금 섬에 클리어 도장 쾅 (B 기록)
  tl.show(r.stamp, a, 'un-stamp');
  if (moving) {
    tl.add(r.stamp, [{ transform: 'rotate(-12deg) scale(2.2)', opacity: 0.25 }, { transform: 'rotate(-12deg) scale(0.9)', opacity: 1 }], { at: a, ease: 'stampIn', dur: tl.d(220), label: '클리어 도장 쾅 (stampIn)' });
    tl.add(r.stamp, [{ transform: 'rotate(-12deg) scale(0.9)' }, { transform: 'rotate(-12deg)' }], { at: a + tl.d(220), ease: 'body', fill: 'forwards' });
  } else if (minimal) tl.add(r.stamp, [{ opacity: 0 }, { opacity: 1 }], { at: a, ease: 'linear', dur: 150, label: '도장 페이드' });
  // 2. 잉크 길이 이어짐
  const tPath = a + (m.reduced ? 300 : tl.d(340));
  const mask = r.mask;
  if (mask) {
    const len = mask.getTotalLength();
    mask.style.strokeDasharray = `${len}`;
    if (moving) tl.add(mask, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { at: tPath, ease: 'ink', dur: tl.d(800), label: '잉크 길 그리기 (ink)' });
    else {
      tl.state('un-path', len, (v) => (mask.style.strokeDashoffset = String(v)));
      tl.at(tPath, 'un-path', 0, '길 즉시 표시');
    }
  }
  // 3. 자물쇠 톡
  const tLock = tPath + (m.reduced ? 300 : tl.d(800));
  const lock = r.lock;
  tl.state('un-lock', true, (v) => lock && ((lock as HTMLElement).style.visibility = v ? 'visible' : 'hidden'));
  if (moving) tl.add(r.lock, [{ transform: 'none', opacity: 1 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.35 }, { transform: 'scale(0.2) rotate(30deg) translateY(-20px)', opacity: 0 }], { at: tLock, ease: 'out', dur: tl.d(280), label: '자물쇠 톡' });
  else if (minimal) tl.add(r.lock, [{ opacity: 1 }, { opacity: 0 }], { at: tLock, ease: 'linear', dur: 150, label: '자물쇠 페이드' });
  tl.at(tLock + (moving ? tl.d(280) : minimal ? 150 : 0), 'un-lock', false, m.reduced ? '자물쇠 사라짐' : undefined);
  const nb = particleCount(m, 5);
  r.bits.forEach((el, i) => {
    if (!el || i >= nb) return;
    const ang = (-150 + i * 30) * (Math.PI / 180);
    tl.show(el, tLock + 60, `un-bit${i}`);
    tl.add(el, [{ transform: 'translate(-50%, -50%) scale(0.5)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(ang) * 46}px), calc(-50% + ${Math.sin(ang) * 46 + 30}px)) rotate(${i * 70}deg)`, opacity: 0 }], { at: tLock + 60, ease: 'out', dur: tl.d(520), label: i === 0 ? '종이 조각' : undefined });
  });
  // 4. 누워 있던 종이 섬이 일어섬 (팝업북) + 색이 깨어남
  const tPop = tLock + (m.reduced ? 0 : tl.d(120));
  tl.state('un-awake', false, r.awake);
  tl.at(tPop, 'un-awake', true, m.reduced ? '섬 색 깨어남' : undefined);
  if (full) {
    tl.add(r.art, [{ transform: 'rotateX(58deg)' }, { transform: 'rotateX(-8deg)', offset: 0.55 }, { transform: 'none' }], { at: tPop, ease: 'body', dur: 743, label: '팝업 섬 일어섬 (body)' });
    tl.add(r.art, [{ transform: 'scale(1.1, 0.9)' }, { transform: 'none' }], { at: tPop + 743, ease: 'jellyAB', label: '착지 젤리 (jellyAB)', fill: 'none' });
  } else if (lite) tl.add(r.art, [{ transform: 'translateY(12px)' }, { transform: 'none' }], { at: tPop, ease: 'out', dur: tl.d(260), label: '섬 올라옴' });
  else if (minimal) tl.add(r.art, [{ opacity: 0.4 }, { opacity: 1 }], { at: tPop, ease: 'linear', dur: 150, label: '섬 페이드' });
  else {
    // 동작 줄이기: 누운 섬을 바로 세움 (움직임 없이 상태만)
    const art = r.art as HTMLElement | null;
    tl.state('un-stand', false, (v) => art && (art.style.transform = v ? 'none' : ''));
    tl.at(tPop, 'un-stand', true);
  }
  // 5. 파이뱀이 새 섬으로 점프 이동 (A)
  const tHop = tPop + (m.reduced ? 300 : tl.d(full ? 900 : 400));
  const py = r.py;
  const f = r.pyFrom;
  const t = r.pyTo;
  const mid = { x: (f.x + t.x) / 2, y: (f.y + t.y) / 2 };
  if (r.setPy) tl.state('un-pystate', 'idle' as RigState, r.setPy);
  if (full) {
    const hop = 360;
    tl.add(
      py,
      [
        { transform: `translate(${f.x}px, ${f.y}px)` },
        { transform: `translate(${(f.x + mid.x) / 2}px, ${Math.min(f.y, mid.y) - 46}px)`, offset: 0.25, easing: 'cubic-bezier(0.5, 0, 0.7, 0.4)' },
        { transform: `translate(${mid.x}px, ${mid.y - 20}px)`, offset: 0.5, easing: 'cubic-bezier(0.3, 0.6, 0.5, 1)' },
        { transform: `translate(${(mid.x + t.x) / 2}px, ${Math.min(mid.y, t.y) - 46}px)`, offset: 0.75, easing: 'cubic-bezier(0.5, 0, 0.7, 0.4)' },
        { transform: `translate(${t.x}px, ${t.y}px)` },
      ],
      { at: tHop, ease: 'linear', dur: hop * 2, label: '파이뱀 점프 2번' },
    );
    tl.add(r.pyInner, [{ transform: 'scale(1.18, 0.82)' }, { transform: 'scale(0.92, 1.1)', offset: 0.2 }, { transform: 'none', offset: 0.4 }, { transform: 'scale(1.12, 0.88)', offset: 0.5 }, { transform: 'scale(0.92, 1.1)', offset: 0.7 }, { transform: 'none' }], { at: tHop, ease: 'linear', dur: hop * 2, fill: 'none' });
    tl.add(r.pyInner, [{ transform: 'scale(1.14, 0.86)' }, { transform: 'none' }], { at: tHop + hop * 2, ease: 'jellyAB', label: '착지 젤리 (jellyAB)', fill: 'none' });
  } else if (lite) {
    tl.add(py, [{ transform: `translate(${f.x}px, ${f.y}px)` }, { transform: `translate(${mid.x}px, ${Math.min(f.y, t.y) - 28}px)`, offset: 0.5 }, { transform: `translate(${t.x}px, ${t.y}px)` }], { at: tHop, ease: 'linear', dur: tl.d(500), label: '파이뱀 점프 1번' });
  } else if (py) {
    tl.state('un-pypos', 0, (v) => (py.style.transform = v ? `translate(${t.x}px, ${t.y}px)` : `translate(${f.x}px, ${f.y}px)`));
    tl.at(tHop, 'un-pypos', 1, '파이뱀 자리 이동');
    if (minimal) tl.add(py, [{ opacity: 0.2 }, { opacity: 1 }], { at: tHop, ease: 'linear', dur: 150, fill: 'none' });
  }
  const tLand = tHop + (full ? 720 : lite ? tl.d(500) : 0);
  if (r.setPy) {
    tl.at(tHop, 'un-pystate', 'happy');
    tl.at(tLand + 200, 'un-pystate', 'cheer', '파이뱀 응원');
  }
  // 6. 이름표 · 별 진행 · "열렸어요!"
  const tTag = tPop + (m.reduced ? 300 : tl.d(500));
  tl.show(r.tag, tTag, 'un-tag');
  if (moving) tl.add(r.tag, [{ transform: 'scale(0.6) rotate(-8deg)' }, { transform: 'none' }], { at: tTag, ease: 'prop', label: '이름표 팝 (prop)' });
  else if (minimal) tl.add(r.tag, [{ opacity: 0 }, { opacity: 1 }], { at: tTag, ease: 'linear', dur: 150, label: '이름표 페이드' });
  tl.state('un-stars', false, r.starsText);
  const tSt = tTag + (m.reduced ? 300 : tl.d(260));
  tl.at(tSt, 'un-stars', true, '별 진행 ★ 0/24');
  if (moving) tl.add(r.stars, [{ transform: 'translateY(6px) scale(0.8)' }, { transform: 'none' }], { at: tSt, ease: 'prop', fill: 'none' });
  const tB = Math.max(tLand, tSt) + (m.reduced ? 300 : tl.d(160));
  tl.show(r.badge, tB, 'un-badge');
  if (moving) tl.add(r.badge, [{ transform: 'translate(-50%, 10px) scale(0.6)' }, { transform: 'translate(-50%, 0)' }], { at: tB, ease: lite ? 'face' : 'jellyAB', label: '"열렸어요!" (jellyAB)' });
  else if (minimal) tl.add(r.badge, [{ opacity: 0 }, { opacity: 1 }], { at: tB, ease: 'linear', dur: 150, label: '"열렸어요!" 페이드' });
  else tl.beat('"열렸어요!" 즉시', tB, 0, 'cue');
  return tB + 600;
}

/** 해제 장면 무대용 작은 지도 */
export const UnlockMini = forwardRef<
  UnlockRefs,
  { view: MotionView; live?: boolean }
>(function UnlockMini({ view, live = true }, ref) {
  const [awake, setAwake] = useState(false);
  const [starsOn, setStarsOn] = useState(false);
  const [pyState, setPyState] = useState<RigState>('idle');
  const r = useRef<UnlockRefs>({
    stamp: null,
    mask: null,
    lock: null,
    art: null,
    awake: setAwake,
    tag: null,
    stars: null,
    starsText: setStarsOn,
    badge: null,
    py: null,
    pyInner: null,
    pyFrom: { x: 0, y: 0 },
    pyTo: { x: 0, y: 0 },
    bits: [],
    setPy: setPyState,
  });
  useImperativeHandle(ref, () => r.current);
  const R = r.current;
  return (
    <div className="ab-um">
      <svg className="ab-um-path" viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden>
        <defs>
          <mask id="ab-um-mask" maskUnits="userSpaceOnUse">
            <path ref={(el) => void (R.mask = el)} d="M190 250 Q300 330 420 200" stroke="#fff" strokeWidth="40" fill="none" strokeLinecap="round" />
          </mask>
        </defs>
        <path d="M190 250 Q300 330 420 200" stroke="#FFF1CF" strokeWidth="20" fill="none" strokeLinecap="round" opacity="0.5" />
        <path d="M190 250 Q300 330 420 200" stroke="#24324A" strokeWidth="2.6" strokeDasharray="1 9" fill="none" strokeLinecap="round" opacity="0.4" />
        <g mask="url(#ab-um-mask)">
          <path d="M190 250 Q300 330 420 200" stroke="#FFF1CF" strokeWidth="20" fill="none" strokeLinecap="round" />
          <path d="M190 250 Q300 330 420 200" stroke="#24324A" strokeWidth="3.4" strokeDasharray="2 11" fill="none" strokeLinecap="round" />
        </g>
      </svg>
      <div className="ab-um-isle is-from">
        <PaperIsland kind="signpost" />
        <span className="ab-um-stamp" data-beat ref={(el) => void (R.stamp = el)}>
          <StampMark size={56} />
        </span>
        <span className="ab-isle-tag ab-um-tag-static">
          <span className="ab-isle-no">3</span>
          <span className="ab-isle-name">조건의 갈림길</span>
        </span>
      </div>
      <div className="ab-um-isle is-to">
        <span className={`ab-um-art ${awake ? 'is-awake' : ''}`} ref={(el) => void (R.art = el)}>
          <PaperIsland kind="cave" locked={!awake} />
        </span>
        <span className="ab-isle-lock ab-um-lock" ref={(el) => void (R.lock = el)}>
          <Icon name="lock" size={22} strokeWidth={2.8} />
        </span>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="ab-um-bit" data-beat ref={(el) => void (R.bits[i] = el)} style={{ background: CONFETTI_COLORS[i] }} />
        ))}
        <span className="ab-isle-tag ab-um-tag" data-beat ref={(el) => void (R.tag = el)}>
          <span className="ab-isle-no">4</span>
          <span className="ab-isle-name">반복의 동굴</span>
          <span className="ab-isle-stars" ref={(el) => void (R.stars = el)}>
            {starsOn ? '★ 0/24' : '잠김'}
          </span>
        </span>
        <span className="ab-um-badge" data-beat ref={(el) => void (R.badge = el)}>
          열렸어요!
        </span>
      </div>
      <div className="ab-map-py ab-um-py" ref={(el) => void (R.py = el)}>
        <div className="ab-map-py-inner" ref={(el) => void (R.pyInner = el)}>
          {live ? (
            <PybaemRig style="AB" state={pyState} size={80} lookAt={false} framing="avatar" tier={view.tier} reducedMotion={view.reduced} />
          ) : (
            <PybaemStatic style="AB" state={pyState} size={80} framing="avatar" idPrefix="umpy" />
          )}
        </div>
      </div>
    </div>
  );
});

