// 축하 연출을 한 곳에 모은다: celebrate(kind, …). P2-05(시그니처 모션)에서 이 파일만 풍성하게 바꾸면 된다.
// 지금은 최소한: 젤리 스퀴시 + (퀘스트) 축하 카드 + 코인 몇 개가 HUD로 날아감 + 숫자 올리기.
// 모두 연출 단계(full/lite/minimal)·동작 줄이기를 따른다 (무드보드 §4.1 표).
import { getMotion, play, springTiming, tierDuration } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { getStore, setStore } from './store';

export type CelebrateKind = 'quest-clear' | 'quiz-clear' | 'try-it';
export interface CelebrateDetail {
  kind: CelebrateKind;
  stars: number;
  xp: number;
  coins: number;
  title?: string;
}

export const CELEBRATE_EVENT = 'a-celebrate';

export function celebrate(kind: CelebrateKind, opts: { from?: Element | null; stars?: number; xp?: number; coins?: number; title?: string } = {}) {
  jelly(opts.from);
  if (kind === 'try-it') {
    sparkle(opts.from);
    return;
  }
  const detail: CelebrateDetail = { kind, stars: opts.stars ?? 3, xp: opts.xp ?? 50, coins: opts.coins ?? 25, title: opts.title };
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }));
}

/** 젤리 스퀴시: scale(1.22, 0.78) 90ms → jellyA 스프링 (lite: 1.12/0.88 → body, minimal·동작 줄이기: 없음) */
export function jelly(el?: Element | null) {
  if (!el) return;
  const m = getMotion();
  if (m.reduced || m.tier === 'minimal') return;
  const lite = m.tier === 'lite';
  const sq = lite ? 'scale(1.12, 0.88)' : 'scale(1.22, 0.78)';
  const a = el.animate([{ transform: 'none' }, { transform: sq }], { duration: 90, easing: EASING.out });
  a.finished.then(() => el.animate([{ transform: sq }, { transform: 'none' }], springTiming(lite ? 'body' : 'jellyA'))).catch(() => {});
}

/** 반짝이 6개가 튀어나감 (full만. lite는 곁가지 이펙트 없음) */
function sparkle(el?: Element | null) {
  if (!el) return;
  const m = getMotion();
  if (m.reduced || m.tier !== 'full') return;
  const r = el.getBoundingClientRect();
  const host = layer();
  for (let i = 0; i < 6; i++) {
    const s = document.createElement('span');
    s.className = 'a-spark';
    s.innerHTML = SPARK_SVG;
    s.style.left = `${r.left + r.width / 2 - 9}px`;
    s.style.top = `${r.top + r.height / 2 - 9}px`;
    host.appendChild(s);
    const ang = (i / 6) * Math.PI * 2 + 0.3;
    const dist = 60 + (i % 2) * 26;
    s.animate(
      [
        { transform: 'translate(0,0) scale(0.3)', opacity: 1 },
        { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(${Math.cos(ang) * dist * 1.1}px, ${Math.sin(ang) * dist * 1.1 + 10}px) scale(0.6)`, opacity: 0 },
      ],
      { duration: 620, easing: EASING.out, fill: 'forwards' },
    ).finished.then(() => s.remove()).catch(() => s.remove());
  }
}

function layer(): HTMLElement {
  let el = document.getElementById('a-fx');
  if (!el) {
    el = document.createElement('div');
    el.id = 'a-fx';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  return el;
}

const SPARK_SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2c.8 5.6 2.6 7.4 8 8.2-5.4.8-7.2 2.6-8 8.2-.8-5.6-2.6-7.4-8-8.2 5.4-.8 7.2-2.6 8-8.2z" fill="#FFD84D"/><ellipse cx="10" cy="8" rx="1.4" ry="2.4" fill="#fff" opacity=".7"/></svg>';
const COIN_SVG =
  '<svg viewBox="0 0 32 32" width="30" height="30"><circle cx="16" cy="17.5" r="12" fill="#E09A00"/><circle cx="16" cy="15.5" r="12" fill="#FFC93C"/><circle cx="16" cy="15.5" r="8" fill="none" stroke="#E09A00" stroke-width="1.6" opacity=".7"/><path d="M13.5 11.5h4a2 2 0 0 1 0 4h-4v4.5M13.5 15.5h4" stroke="#E09A00" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="11" cy="9.5" rx="3.2" ry="1.6" fill="#fff" opacity=".7" transform="rotate(-30 11 9.5)"/></svg>';

/**
 * 코인 튀어나옴 (간단판): from에서 코인이 포물선으로 튀어 오른 뒤 HUD 코인으로 날아가 꽂힘 → HUD 팝 + 숫자 올리기.
 * full 5개 / lite 1개(70%) / minimal 숫자 페이드 / 동작 줄이기 숫자 즉시 + "+N" 배지
 */
export function flyCoins(from: Element | null | undefined, amount: number) {
  const m = getMotion();
  const target = document.querySelector('[data-hud-coin]');
  const numEl = document.querySelector<HTMLElement>('[data-hud-coin-num]');
  const start = getStore().coins;
  const end = start + amount;
  const finish = () => {
    setStore({ coins: end });
    badge(target, `+${amount}`);
  };
  if (!from || !target || m.reduced) {
    finish();
    return;
  }
  if (m.tier === 'minimal') {
    play(numEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    finish();
    return;
  }
  const n = m.tier === 'lite' ? 1 : 5;
  const fr = from.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  const host = layer();
  let arrived = 0;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span');
    c.className = 'a-flycoin';
    c.innerHTML = COIN_SVG;
    const sx = fr.left + fr.width / 2 - 15;
    const sy = fr.top + fr.height / 2 - 15;
    c.style.left = `${sx}px`;
    c.style.top = `${sy}px`;
    host.appendChild(c);
    const spread = (i - (n - 1) / 2) * 30;
    const kf: Keyframe[] = [];
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      const y = -120 * (1 - (1 - u) ** 2) + 20 * u * u;
      kf.push({ transform: `translate(${spread * u}px, ${y}px) scaleX(${Math.cos(u * Math.PI * 6).toFixed(3)})`, offset: u });
    }
    const up = tierDuration(420);
    const fly = tierDuration(480);
    c.animate(kf, { duration: up, delay: i * 60, easing: 'linear', fill: 'forwards' })
      .finished.then(() => {
        const tx = tr.left + tr.width / 2 - 15 - sx;
        const ty = tr.top + tr.height / 2 - 15 - sy;
        return c.animate([{ transform: `translate(${spread}px, -100px)` }, { transform: `translate(${tx}px, ${ty}px) scale(0.7)` }], {
          duration: fly,
          easing: EASING.inOut,
          fill: 'forwards',
        }).finished;
      })
      .then(() => {
        c.remove();
        arrived++;
        play(target, [{ transform: 'scale(1.25)' }, { transform: 'none' }], springTiming('prop'));
        if (arrived === 1) countUp(numEl, start, end, tierDuration(600));
        if (arrived === n) setTimeout(finish, tierDuration(600));
      })
      .catch(() => c.remove());
  }
}

function countUp(el: HTMLElement | null, from: number, to: number, ms: number) {
  if (!el) return;
  const t0 = performance.now();
  const step = (t: number) => {
    const u = Math.min(1, (t - t0) / ms);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - u) ** 3)).toLocaleString('ko-KR');
    if (u < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** HUD 옆 "+N" 레몬 배지 1.2초 */
function badge(target: Element | null, text: string) {
  if (!target) return;
  const host = target.closest('[data-hud-chip]') ?? target;
  const b = document.createElement('span');
  b.className = 'a-plus';
  b.textContent = text;
  host.appendChild(b);
  setTimeout(() => b.remove(), 1300);
}
