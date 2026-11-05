// 축하 연출 입구: celebrate(kind, …). 퀘스트·퀴즈 성공은 이벤트로 CelebrationLayer(celebration.tsx)를 열고,
// 그 안에서 시그니처 모션 시퀀스(signature.tsx: 카드 → 별 → 코인 → XP → 레벨업)를 재생한다 (P2-05).
// 모두 연출 단계(full/lite/minimal)·동작 줄이기를 따른다 (무드보드 §4.1 표).
import { getMotion, springTiming } from '../shared/motion';
import { EASING } from '../shared/tokens';

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

export function layer(): HTMLElement {
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
