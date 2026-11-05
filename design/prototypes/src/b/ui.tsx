// 시안 B 공통 컴포넌트 (→ P2-11 근거): 잉크 도장 버튼, 재화 HUD, 별, 말풍선, 시트(바텀시트·대화상자), 토스트, 진행바, 페이지 넘김
import { useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { goScreen } from '../shared/app';
import { useMotion } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { getB, setB, useB } from './state';
import { hudPop, isLite, isMinimal, pressRelease } from './fx';

// ───────────── 잉크 도장 버튼 (종이 겹침 아랫면 + 묵직한 복귀)

type BtnVariant = 'primary' | 'secondary' | 'paper' | 'gold' | 'ghost';
export function InkButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  className = '',
  onPointerUp,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'lg' | 'md' | 'sm'; icon?: IconName; iconRight?: IconName; children?: ReactNode }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  return (
    <button
      ref={ref}
      type="button"
      className={`b-btn b-btn-${variant} b-btn-${size} ${className}`}
      onPointerUp={(e) => {
        pressRelease(ref.current?.querySelector('.b-btn-face') as HTMLElement | null);
        onPointerUp?.(e);
      }}
      {...rest}
    >
      <span className="b-btn-face">
        {icon && <Icon name={icon} size={size === 'lg' ? 26 : 22} strokeWidth={2.4} />}
        {children && <span className="b-btn-label">{children}</span>}
        {iconRight && <Icon name={iconRight} size={size === 'lg' ? 26 : 22} strokeWidth={2.4} />}
      </span>
    </button>
  );
}

// ───────────── 별 (★ 0~3, 잠김)

export function Stars({ n, max = 3, size = 22, label = true }: { n: number; max?: number; size?: number; label?: boolean }) {
  return (
    <span className="b-stars" role={label ? 'img' : undefined} aria-label={label ? `별 ${Math.max(0, n)}개 / ${max}개` : undefined}>
      {Array.from({ length: max }, (_, i) => (
        <RewardIcon key={i} kind={i < n ? 'star' : 'starEmpty'} style="B" size={size} />
      ))}
    </span>
  );
}

// ───────────── 재화 HUD (레벨 도장 · XP 바 · 코인 · 별 · 황금 열쇠 · 소리)

export function Hud({ back, title }: { back?: { to: string; label: string }; title?: string }) {
  const s = useB((x) => x);
  const coinRef = useRef<HTMLSpanElement | null>(null);
  const starRef = useRef<HTMLSpanElement | null>(null);
  const prev = useRef({ coins: s.coins, stars: s.stars });
  useEffect(() => {
    if (s.coins !== prev.current.coins) hudPop(coinRef.current);
    if (s.stars !== prev.current.stars) hudPop(starRef.current);
    prev.current = { coins: s.coins, stars: s.stars };
  }, [s.coins, s.stars]);
  const pct = Math.round((s.xp / s.xpNext) * 100);
  return (
    <header className="b-hud" data-b-hud>
      <div className="b-hud-in">
        {back ? (
          <button type="button" className="b-hud-back" onClick={() => goScreen(back.to)} aria-label={back.label}>
            <Icon name="arrowLeft" size={24} strokeWidth={2.6} />
            <span className="b-hud-back-t">{back.label}</span>
          </button>
        ) : (
          <a className="b-logo" href="#landing" aria-label="pyRoad 처음 화면">
            <LogoMark />
            <span className="b-logo-t">pyRoad</span>
          </a>
        )}
        {title && <span className="b-hud-title">{title}</span>}
        <div className="b-hud-stats">
          <div className="b-hud-lv" title={`레벨 ${s.level}, 경험치 ${s.xp}/${s.xpNext}`}>
            <span className="b-seal" aria-hidden>
              <span className="b-seal-n">{s.level}</span>
            </span>
            <span className="b-hud-xp">
              <span className="b-hud-xp-k">
                <span className="sr-only">레벨 {s.level}, </span>경험치
              </span>
              <span className="b-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={s.xpNext} aria-valuenow={s.xp} aria-label="다음 레벨까지 경험치">
                <span className="b-xpbar-fill" style={{ transform: `scaleX(${pct / 100})` }} />
              </span>
            </span>
          </div>
          <span className="b-chip b-chip-coin" ref={coinRef}>
            <RewardIcon kind="coin" style="B" size={26} />
            <span className="b-num" aria-label={`코인 ${s.coins}개`}>
              {s.coins.toLocaleString('ko-KR')}
            </span>
          </span>
          <span className="b-chip b-chip-star" ref={starRef}>
            <RewardIcon kind="star" style="B" size={26} />
            <span className="b-num" aria-label={`별 ${s.stars}개`}>
              {s.stars}
            </span>
          </span>
          <span className="b-chip b-chip-key">
            <RewardIcon kind="key" style="B" size={26} />
            <span className="b-num b-num-s" aria-label={`황금 열쇠 ${s.keys}개`}>
              {s.keys}
            </span>
          </span>
          <button
            type="button"
            className="b-hud-sound"
            aria-pressed={s.muted}
            aria-label={s.muted ? '소리 켜기' : '소리 끄기'}
            onClick={() => setB({ muted: !getB().muted })}
          >
            <Icon name={s.muted ? 'soundOff' : 'sound'} size={24} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function LogoMark({ size = 34 }: { size?: number }) {
  // 책 + 길: 펼친 책 위로 잉크 길이 굽이친다
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="b-logomark">
      <path d="M4 10c5-2 11-2 16 2 5-4 11-4 16-2v22c-5-2-11-2-16 2-5-4-11-4-16-2z" fill="#FFFBF2" stroke="#3B2F25" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M20 12v22" stroke="#3B2F25" strokeWidth="2" />
      <path d="M8 27c3-5 7 0 9-5M23 20c3 4 6-3 10 1" fill="none" stroke="#A4452A" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="0.1 4.2" />
      <path d="M30 13l3 3m0-3l-3 3" stroke="#A4452A" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// ───────────── 말풍선 (타자 치듯)

export function useTyping(text: string, speed = 34) {
  const { reduced, tier } = useMotion();
  const [n, setN] = useState(reduced || tier === 'minimal' ? text.length : 0);
  useEffect(() => {
    if (reduced || tier === 'minimal') {
      setN(text.length);
      return;
    }
    setN(0);
    const chars = [...text];
    let i = 0;
    const id = window.setInterval(() => {
      i++;
      setN(i);
      if (i >= chars.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [text, reduced, tier, speed]);
  const chars = [...text];
  return { shown: chars.slice(0, n).join(''), done: n >= chars.length };
}

export function Bubble({ text, who = '파이뱀', tone = 'tutor', onDone }: { text: string; who?: string; tone?: 'tutor' | 'bug' | 'good'; onDone?: () => void }) {
  const { shown, done } = useTyping(text);
  useEffect(() => {
    if (done) onDone?.();
  }, [done]);
  return (
    <div className={`b-bubble b-bubble-${tone}`}>
      <span className="b-bubble-who">{who}</span>
      {/* 화면 낭독기는 완성된 문장을 한 번에 읽는다 */}
      <p className="b-bubble-t" aria-live="polite">
        <span aria-hidden>{shown}</span>
        <span className="sr-only">{text}</span>
        {!done && <span className="b-caret" aria-hidden />}
      </p>
    </div>
  );
}

// ───────────── 시트 (모바일 바텀시트 · 넓은 화면 대화상자)

export function Sheet({ open, onClose, label, children, wide }: { open: boolean; onClose: () => void; label: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('button, a, [tabindex]');
    first?.focus({ preventScroll: true });
    if (!isMinimal()) {
      const mobile = el.getBoundingClientRect().width < 640;
      el.animate(
        mobile
          ? [{ transform: 'translateY(100%)' }, { transform: 'none' }]
          : [{ transform: 'translateY(24px) rotate(-1.5deg) scale(0.96)', opacity: 0.4 }, { transform: 'none', opacity: 1 }],
        isLite() ? { duration: 220, easing: EASING.out } : { duration: mobile ? 420 : 520, easing: mobile ? EASING.out : 'cubic-bezier(0.34, 1.4, 0.64, 1)' },
      );
      backRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const f = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], textarea, [tabindex="0"]')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="b-sheet-root">
      <div ref={backRef} className="b-sheet-back" onClick={onClose} aria-hidden />
      <div ref={ref} className={`b-sheet ${wide ? 'b-sheet-wide' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
        <span className="b-sheet-grip" aria-hidden />
        <button type="button" className="b-sheet-x" onClick={onClose} aria-label="닫기">
          <Icon name="close" size={24} strokeWidth={2.6} />
        </button>
        {children}
      </div>
    </div>
  );
}

// ───────────── 토스트 (찢은 쪽지)

export function Toasts() {
  const ts = useB((s) => s.toasts);
  return (
    <div className="b-toasts" role="status" aria-live="polite">
      {ts.map((t) => (
        <div key={t.id} className={`b-toast b-toast-${t.tone ?? 'info'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ───────────── 진행바 (잉크 채움)

export function InkProgress({ value, max, label, tone = 'olive' }: { value: number; max: number; label: string; tone?: 'olive' | 'gold' }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <span className={`b-prog b-prog-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <span className="b-prog-fill" style={{ transform: `scaleX(${pct})` }} />
    </span>
  );
}

// ───────────── 페이지 넘김 (빈 종이 한 장이 책등 축으로 넘어가며 새 쪽을 보여 줌)
// full: rotateY 0→-180° 640ms page easing, 원근 1600px, 넘기는 장에 그림자
// lite: 가로 12px 밀며 크로스페이드 260ms / minimal·동작 줄이기: 즉시

export function pageTurn(host: HTMLElement | null, opts: { dir?: 1 | -1; title?: string; kicker?: string; ms?: number; fixed?: boolean } = {}) {
  if (!host || isMinimal()) return;
  if (isLite()) {
    host.animate([{ opacity: 0.2, transform: `translateX(${(opts.dir ?? 1) * 12}px)` }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASING.out });
    return;
  }
  const dir = opts.dir ?? 1;
  const wrap = document.createElement('div');
  wrap.className = `b-leaf-wrap ${opts.fixed ? 'is-fixed' : ''}`;
  wrap.setAttribute('aria-hidden', 'true');
  const leaf = document.createElement('div');
  leaf.className = `b-leaf ${dir < 0 ? 'b-leaf-back' : ''}`;
  if (opts.title) {
    leaf.innerHTML = `<div class="b-leaf-in"><span class="b-leaf-k"></span><b class="b-leaf-t"></b><span class="b-leaf-orn"></span></div>`;
    (leaf.querySelector('.b-leaf-k') as HTMLElement).textContent = opts.kicker ?? '';
    (leaf.querySelector('.b-leaf-t') as HTMLElement).textContent = opts.title;
  }
  const shade = document.createElement('div');
  shade.className = 'b-leaf-shade';
  leaf.appendChild(shade);
  wrap.appendChild(leaf);
  host.appendChild(wrap);
  const ms = opts.ms ?? 640;
  const hold = opts.title ? 160 : 0;
  const a = leaf.animate([{ transform: 'rotateY(0deg)' }, { transform: `rotateY(${dir < 0 ? 180 : -180}deg)` }], {
    duration: ms,
    delay: hold,
    easing: EASING.page,
    fill: 'forwards',
  });
  shade.animate([{ opacity: 0 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0 }], { duration: ms, delay: hold });
  const done = () => wrap.remove();
  a.finished.then(done, done);
}

/** 화면 맨 위로 움직임 없이 (프레임 보기 포함) */
export function useOnce(fn: () => void) {
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    did.current = true;
    fn();
  }, []);
}
