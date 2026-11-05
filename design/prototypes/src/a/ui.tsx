// 시안 A 공통 컴포넌트 (→ P2-11 근거): 게임 버튼, HUD, 진행바, 별, 대사창, 바텀시트, 토스트, 축하 카드
import { forwardRef, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { getMotion, play, springTiming, useMotion } from '../shared/motion';
import { goScreen } from '../shared/app';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { BugBug, Byeolttongi } from '../shared/characters/Friends';
import { CELEBRATE_EVENT, flyCoins, type CelebrateDetail } from './celebrate';
import { setStore, useStore } from './store';

// ───────────── 게임 버튼 (꾹 눌림 + 젤리 복귀)

export type BtnVariant = 'primary' | 'secondary' | 'lemon' | 'white';
export interface ClayButtonProps {
  variant?: BtnVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  children?: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
  disabled?: boolean;
  pressed?: boolean;
  /** 아이콘만 있는 둥근 버튼 */
  round?: boolean;
  type?: 'button' | 'submit';
  describedBy?: string;
}

export const ClayButton = forwardRef(function ClayButton(
  { variant = 'primary', size = 'md', icon, iconRight, children, onClick, className, label, disabled, pressed, round, type = 'button', describedBy }: ClayButtonProps,
  ref: Ref<HTMLButtonElement>,
) {
  const inner = useRef<HTMLButtonElement | null>(null);
  const setRef = (el: HTMLButtonElement | null) => {
    inner.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as { current: HTMLButtonElement | null }).current = el;
  };
  const press = () => {
    if (!disabled) inner.current?.classList.add('is-pressed');
  };
  const release = () => {
    const el = inner.current;
    if (!el || !el.classList.contains('is-pressed')) return;
    el.classList.remove('is-pressed');
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal') return;
    if (m.tier === 'lite') {
      el.animate([{ transform: 'translateY(5px)' }, { transform: 'none' }], springTiming('face'));
      return;
    }
    el.animate([{ transform: 'translateY(5px) scale(1.04, 0.96)' }, { transform: 'none' }], springTiming('jellyA'));
  };
  const ic = size === 'lg' ? 26 : size === 'md' ? 22 : 20;
  return (
    <button
      ref={setRef}
      type={type}
      className={`a-btn a-btn-${variant} a-btn-${size}${round ? ' a-btn-round' : ''}${className ? ' ' + className : ''}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && press()}
      onKeyUp={release}
      onBlur={release}
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      aria-describedby={describedBy}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={ic} strokeWidth={2.6} />}
      {children && <span className="a-btn-text">{children}</span>}
      {iconRight && <Icon name={iconRight} size={ic} strokeWidth={2.6} />}
    </button>
  );
});

// ───────────── 별·진행바

export function Stars({ n, max = 3, size = 22, label }: { n: number; max?: number; size?: number; label?: string }) {
  return (
    <span className="a-stars" role="img" aria-label={label ?? `별 ${max}개 중 ${n}개`}>
      {Array.from({ length: max }, (_, i) => (
        <RewardIcon key={i} kind={i < n ? 'star' : 'starEmpty'} size={size} style="A" />
      ))}
    </span>
  );
}

export function Progress({ value, max, label, tone = 'green', thin }: { value: number; max: number; label: string; tone?: 'green' | 'lemon' | 'sky'; thin?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className={`a-prog a-prog-${tone}${thin ? ' a-prog-thin' : ''}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="a-prog-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

// ───────────── HUD (레벨·XP·별·코인·소리)

export function Hud({ back, title, sub }: { back?: { label: string; to: string }; title?: string; sub?: string }) {
  const s = useStore();
  return (
    <header className="a-hud">
      <div className="a-hud-row">
        {back ? (
          <ClayButton variant="white" size="sm" round icon="arrowLeft" label={back.label} onClick={() => goScreen(back.to)} className="a-hud-back" />
        ) : (
          <button type="button" className="a-hud-home" onClick={() => goScreen('landing')} aria-label="pyRoad 처음 화면으로">
            <Logo small />
          </button>
        )}
        {title ? (
          <div className="a-hud-title">
            {sub && <span className="a-hud-sub">{sub}</span>}
            <span className="a-hud-name">{title}</span>
          </div>
        ) : (
          <div className="a-hud-player" data-hud-chip="">
            <span className="a-hud-ava" aria-hidden>
              <PybaemRig static state="happy" size={44} framing="avatar" />
            </span>
            <span className="a-hud-lv" aria-label={`레벨 ${s.level}`}>
              <span aria-hidden>Lv</span>
              {s.level}
            </span>
            <span className="a-hud-xp">
              <span className="a-hud-nick">코딩탐험가</span>
              <Progress value={s.xp} max={s.xpNext} label={`경험치 ${s.xp} / ${s.xpNext}`} tone="lemon" thin />
            </span>
          </div>
        )}
        <div className="a-hud-res">
          <span className="a-chip a-chip-star" data-hud-chip="">
            <RewardIcon kind="star" size={26} style="A" />
            <span className="a-num" aria-label={`별 ${s.stars}개`}>
              {s.stars}
            </span>
          </span>
          <span className="a-chip a-chip-coin" data-hud-chip="">
            <span data-hud-coin="" className="a-chip-ic">
              <RewardIcon kind="coin" size={26} style="A" />
            </span>
            <span className="a-num" data-hud-coin-num="" aria-label={`코인 ${s.coins}개`}>
              {s.coins.toLocaleString('ko-KR')}
            </span>
          </span>
          <ClayButton
            variant="white"
            size="sm"
            round
            icon={s.sound ? 'sound' : 'soundOff'}
            label={s.sound ? '소리 끄기' : '소리 켜기'}
            pressed={!s.sound}
            onClick={() => {
              setStore({ sound: !s.sound });
              toast(s.sound ? '소리를 껐어요' : '소리를 켰어요', s.sound ? 'soundOff' : 'sound');
            }}
          />
        </div>
      </div>
    </header>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={`a-logo${small ? ' a-logo-sm' : ''}`}>
      <svg viewBox="0 0 40 40" width={small ? 34 : 42} height={small ? 34 : 42} aria-hidden>
        <path d="M6 22a14 14 0 0 1 28 0v4a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="#38A356" transform="translate(0 3)" />
        <path d="M6 22a14 14 0 0 1 28 0v4a8 8 0 0 1-8 8H14a8 8 0 0 1-8-8z" fill="#5CCB72" />
        <ellipse cx="13" cy="15" rx="4" ry="2.2" fill="#fff" opacity=".45" transform="rotate(-25 13 15)" />
        <circle cx="15" cy="22" r="3" fill="#1B2F45" />
        <circle cx="25" cy="22" r="3" fill="#1B2F45" />
        <circle cx="16" cy="21" r="1" fill="#fff" />
        <circle cx="26" cy="21" r="1" fill="#fff" />
        <path d="M17 28q3 2.4 6 0" stroke="#1B2F45" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
      <span className="a-logo-word">
        py<b>Road</b>
      </span>
    </span>
  );
}

// ───────────── 대사창 (게임 대화 상자: 초상 + 이름표 + 타자 대사)

export type Speaker = 'pybaem' | 'bugbug' | 'star';
const SPEAKER_NAME: Record<Speaker, string> = { pybaem: '파이뱀', bugbug: '버그버그', star: '별똥이' };

/** 타자 치듯 나타나는 글자. 동작 줄이기·minimal이면 바로 전부 */
export function useTypewriter(text: string, cps = 34) {
  const { reduced, tier } = useMotion();
  const instant = reduced || tier === 'minimal';
  const [n, setN] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    const chars = [...text];
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= chars.length) window.clearInterval(id);
    }, 1000 / (tier === 'lite' ? cps * 1.4 : cps));
    return () => window.clearInterval(id);
  }, [text, instant, tier, cps]);
  const chars = [...text];
  return { shown: chars.slice(0, n).join(''), done: n >= chars.length, skip: () => setN(chars.length) };
}

export function Dialogue({
  speaker,
  text,
  rigState = 'talk',
  extra,
  className,
  compact,
}: {
  speaker: Speaker;
  text: string;
  rigState?: 'idle' | 'talk' | 'think' | 'happy' | 'sad' | 'cheer';
  extra?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const tw = useTypewriter(text);
  const nameId = useId();
  return (
    <section className={`a-dlg a-dlg-${speaker}${compact ? ' a-dlg-compact' : ''}${className ? ' ' + className : ''}`} aria-labelledby={nameId}>
      <div className="a-dlg-portrait">
        {speaker === 'pybaem' && <PybaemRig state={rigState} talking={!tw.done && rigState !== 'cheer' && rigState !== 'happy'} size={compact ? 124 : 172} framing="avatar" lookAt className="a-dlg-rig" />}
        {speaker === 'bugbug' && <BugBug style="A" mood="found" size={compact ? 84 : 108} motion="appear-bob" />}
        {speaker === 'star' && <Byeolttongi style="A" mood="sparkling" size={compact ? 84 : 108} motion="appear-bob" />}
      </div>
      <div className="a-dlg-box" onClick={tw.skip}>
        <span className="a-dlg-name" id={nameId}>
          {SPEAKER_NAME[speaker]}
        </span>
        <p className="a-dlg-text">
          <span aria-hidden>{tw.shown}</span>
          <span className="a-dlg-ghost" aria-hidden>
            {[...text].slice([...tw.shown].length).join('')}
          </span>
          <span className="sr-only">{text}</span>
        </p>
        {extra}
        <span className={`a-dlg-next m-loop${tw.done ? ' is-on' : ''}`} aria-hidden>
          <svg viewBox="0 0 16 12" width="16" height="12">
            <path d="M2 2h12L8 10z" fill="currentColor" />
          </svg>
        </span>
      </div>
    </section>
  );
}

// ───────────── 바텀시트 (모바일 아래 / 데스크톱 오른쪽 패널)

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const tid = useId();
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    play(el, [{ transform: 'translateY(40px) scale(0.98)' }, { transform: 'none' }], springTiming('body'), { minimal: [{ opacity: 0.4 }, { opacity: 1 }] });
    el?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (!open) return null;
  return (
    <div className={`a-sheet-wrap${wide ? ' a-sheet-wide' : ''}`}>
      <div className="a-scrim" onClick={onClose} aria-hidden />
      <div ref={ref} className="a-sheet" role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? tid} tabIndex={-1}>
        <span className="a-sheet-grip" aria-hidden />
        {title && (
          <h2 className="a-sheet-title" id={tid}>
            {title}
          </h2>
        )}
        <ClayButton variant="white" size="sm" round icon="close" label="닫기" onClick={onClose} className="a-sheet-close" />
        {children}
      </div>
    </div>
  );
}

// ───────────── 토스트

type ToastItem = { id: number; text: string; icon?: IconName };
const toastListeners = new Set<(t: ToastItem) => void>();
let toastSeq = 0;
export function toast(text: string, icon?: IconName) {
  const t = { id: ++toastSeq, text, icon };
  toastListeners.forEach((l) => l(t));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (t: ToastItem) => {
      setItems((xs) => [...xs.slice(-1), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 2400);
    };
    toastListeners.add(on);
    return () => {
      toastListeners.delete(on);
    };
  }, []);
  return (
    <div className="a-toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="a-toast">
          {t.icon && <Icon name={t.icon} size={22} />}
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ───────────── 축하 카드 (celebrate()가 이벤트로 연다)

export function CelebrationLayer({ onNext }: { onNext?: () => void }) {
  const [d, setD] = useState<CelebrateDetail | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  const coinRef = useRef<HTMLSpanElement | null>(null);
  const { reduced } = useMotion();
  useEffect(() => {
    const on = (e: Event) => setD((e as CustomEvent<CelebrateDetail>).detail);
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => window.removeEventListener(CELEBRATE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!d) return;
    const el = card.current;
    play(el, [{ transform: 'translateY(30px) scale(0.7)' }, { transform: 'none' }], springTiming('jellyA'), {
      lite: [{ transform: 'translateY(20px) scale(0.9)' }, { transform: 'none' }],
    });
    el?.querySelector<HTMLElement>('.a-btn-primary')?.focus({ preventScroll: true });
    const stars = el?.querySelectorAll('.a-cel-star.is-on') ?? [];
    stars.forEach((s, i) => {
      const a = play(s, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'none' }], { ...springTiming('prop'), delay: 260 + i * 180, fill: 'backwards' });
      void a;
    });
    const t = setTimeout(() => {
      flyCoins(coinRef.current, d.coins);
      setStore((s) => ({ xp: Math.min(s.xpNext, s.xp + d.xp), stars: s.stars + d.stars }));
    }, reduced ? 0 : 900);
    return () => clearTimeout(t);
  }, [d]);
  if (!d) return null;
  const close = () => setD(null);
  return (
    <div className="a-cel-wrap" role="dialog" aria-modal="true" aria-labelledby="a-cel-title">
      <div className="a-scrim a-scrim-strong" onClick={close} aria-hidden />
      <div ref={card} className="a-cel">
        <div className="a-cel-burst m-loop" aria-hidden />
        <div className="a-cel-rig">
          <PybaemRig state="cheer" size={150} lookAt={false} />
        </div>
        <h2 id="a-cel-title" className="a-cel-title">
          {d.title ?? (d.kind === 'quiz-clear' ? '퀴즈 정답!' : '퀘스트 클리어!')}
        </h2>
        <div className="a-cel-stars" role="img" aria-label={`별 3개 중 ${d.stars}개`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`a-cel-star${i < d.stars ? ' is-on' : ''}${i === 1 ? ' is-mid' : ''}`}>
              <RewardIcon kind={i < d.stars ? 'star' : 'starEmpty'} size={i === 1 ? 64 : 52} style="A" />
            </span>
          ))}
        </div>
        <div className="a-cel-rewards">
          <span className="a-reward">
            <RewardIcon kind="gem" size={26} style="A" />
            <b>+{d.xp}</b> 경험치
          </span>
          <span className="a-reward" ref={coinRef}>
            <RewardIcon kind="coin" size={26} style="A" />
            <b>+{d.coins}</b> 코인
          </span>
        </div>
        <div className="a-cel-actions">
          <ClayButton variant="white" size="md" icon="map" onClick={() => {
            close();
            goScreen('world');
          }}>
            지도로
          </ClayButton>
          <ClayButton variant="primary" size="md" iconRight="arrowRight" onClick={() => {
            close();
            onNext?.();
          }}>
            다음 퀘스트
          </ClayButton>
        </div>
      </div>
    </div>
  );
}
