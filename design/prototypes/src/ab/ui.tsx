// 시안 A×B 공통 컴포넌트 (→ P2-11 근거): 종이 게임 버튼 · HUD · 별 · 진행바 · 말풍선 · 바텀시트 · 토스트 · 배지
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icon, RewardIcon, type IconName } from '../shared/icons';
import { getMotion, springTiming, useMotion } from '../shared/motion';
import { PybaemStatic } from '../shared/rig/PybaemRig';
import { setAb, toast, useAb } from './store';
import type { QuestKind } from './data';

// ───────────── 종이 게임 버튼 (A의 꾹 버튼 구조 + 남색 잉크 외곽선·종이 두께 아랫면)

type BtnVariant = 'primary' | 'secondary' | 'paper' | 'lemon';
export function GameButton({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  block,
  className,
  children,
  onPress,
  ...rest
}: {
  variant?: BtnVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  onPress?: () => void;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const press = () => ref.current?.classList.add('is-pressed');
  const release = () => {
    const el = ref.current;
    if (!el || !el.classList.contains('is-pressed')) return;
    el.classList.remove('is-pressed');
    const m = getMotion();
    if (m.reduced || m.tier === 'minimal') return;
    if (m.tier === 'lite') {
      el.animate([{ transform: 'translateY(5px)' }, { transform: 'none' }], springTiming('face'));
      return;
    }
    el.animate([{ transform: 'translateY(5px) scale(1.04, 0.96)' }, { transform: 'none' }], springTiming('jellyAB'));
  };
  return (
    <button
      ref={ref}
      type="button"
      className={`ab-btn ab-btn-${variant} ab-btn-${size} ${block ? 'ab-btn-block' : ''} ${className ?? ''}`}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && press()}
      onKeyUp={release}
      onClick={() => onPress?.()}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 20 : 24} strokeWidth={2.6} />}
      <span className="ab-btn-label">{children}</span>
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 20 : 24} strokeWidth={2.6} />}
    </button>
  );
}

/** 동그란 아이콘 버튼 (HUD·닫기). 48px */
export function IconButton({ icon, label, onPress, pressed, className }: { icon: IconName; label: string; onPress: () => void; pressed?: boolean; className?: string }) {
  return (
    <button type="button" className={`ab-iconbtn ${className ?? ''}`} aria-label={label} aria-pressed={pressed} onClick={onPress}>
      <Icon name={icon} size={24} strokeWidth={2.6} />
    </button>
  );
}

// ───────────── 별 · 진행바 · 배지

export function Stars({ n, max = 3, size = 22, label }: { n: number; max?: number; size?: number; label?: string }) {
  return (
    <span className="ab-stars" role="img" aria-label={label ?? `별 ${max}개 중 ${Math.max(0, n)}개`}>
      {Array.from({ length: max }, (_, i) => (
        <RewardIcon key={i} kind={i < n ? 'star' : 'starEmpty'} style="AB" size={size} />
      ))}
    </span>
  );
}

export function Progress({ value, max, label, tone = 'green' }: { value: number; max: number; label: string; tone?: 'green' | 'lemon' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className={`ab-progress ab-progress-${tone}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className="ab-progress-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

const KIND_LABEL: Record<QuestKind, { text: string; icon: IconName }> = {
  code: { text: '코드', icon: 'code' },
  quiz: { text: '퀴즈', icon: 'chat' },
  project: { text: '프로젝트', icon: 'trophy' },
};
export function KindBadge({ kind }: { kind: QuestKind }) {
  const k = KIND_LABEL[kind];
  return (
    <span className={`ab-kind ab-kind-${kind}`}>
      <Icon name={k.icon} size={16} strokeWidth={2.4} />
      {k.text}
    </span>
  );
}

// ───────────── HUD (레벨·XP·코인·별·소리)

function useBump<T extends HTMLElement>(key: 'coins' | 'xp' | 'stars') {
  const bump = useAb((s) => s.bump);
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!bump || bump[key] === undefined || !ref.current) return;
    const m = getMotion();
    const el = ref.current;
    el.classList.add('is-bumped');
    const t = window.setTimeout(() => el.classList.remove('is-bumped'), 1200);
    if (!m.reduced && m.tier !== 'minimal') el.animate([{ transform: 'scale(1.22) rotate(-6deg)' }, { transform: 'none' }], springTiming('prop'));
    return () => window.clearTimeout(t);
  }, [bump, key]);
  return ref;
}

export function Hud({ back, title }: { back?: { label: string; onPress: () => void }; title?: ReactNode }) {
  const s = useAb((x) => x);
  const coinRef = useBump<HTMLSpanElement>('coins');
  const starRef = useBump<HTMLSpanElement>('stars');
  const xpRef = useBump<HTMLDivElement>('xp');
  return (
    <header className="ab-hud">
      <div className="ab-hud-inner">
        {back ? (
          <button type="button" className="ab-hud-back" onClick={back.onPress} aria-label={back.label}>
            <Icon name="arrowLeft" size={24} strokeWidth={2.8} />
            <span aria-hidden>{back.label}</span>
          </button>
        ) : (
          <div className="ab-hud-me">
            <span className="ab-hud-avatar">
              <PybaemStatic style="AB" state="happy" size={44} idPrefix="hudpy" />
            </span>
            <span className="ab-hud-name">{s.nickname}</span>
          </div>
        )}
        {title && <div className="ab-hud-title">{title}</div>}
        <div className="ab-hud-level" ref={xpRef}>
          <span className="ab-lv">
            <small>Lv</small>
            {s.level}
          </span>
          <span className="ab-hud-xp">
            <Progress value={s.xp} max={s.xpNext} label={`경험치 ${s.xpNext} 중 ${s.xp}`} />
            <span className="ab-hud-xp-num" aria-hidden>
              {s.xp}/{s.xpNext}
            </span>
          </span>
        </div>
        <span className="ab-hud-chip" ref={coinRef}>
          <RewardIcon kind="coin" style="AB" size={28} />
          <span className="ab-num">{s.coins.toLocaleString('ko-KR')}</span>
          <span className="sr-only">코인</span>
        </span>
        <span className="ab-hud-chip ab-hud-chip-star" ref={starRef}>
          <RewardIcon kind="star" style="AB" size={28} />
          <span className="ab-num">{s.stars}</span>
          <span className="sr-only">별</span>
        </span>
        <IconButton
          icon={s.sound ? 'sound' : 'soundOff'}
          label={s.sound ? '소리 끄기' : '소리 켜기'}
          pressed={!s.sound}
          className="ab-hud-sound"
          onPress={() => {
            setAb({ sound: !s.sound });
            toast(s.sound ? '소리를 껐어요' : '소리를 켰어요');
          }}
        />
      </div>
    </header>
  );
}

// ───────────── 말풍선 (타자 치듯 나타나는 대사)

export function useTypewriter(text: string, cps = 34) {
  const { tier, reduced } = useMotion();
  const instant = reduced || tier === 'minimal';
  const [n, setN] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    let i = 0;
    const step = tier === 'lite' ? 2 : 1;
    const id = window.setInterval(() => {
      i += step;
      setN(Math.min(i, text.length));
      if (i >= text.length) window.clearInterval(id);
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, instant, tier, cps]);
  return { shown: text.slice(0, n), done: n >= text.length, skip: () => setN(text.length) };
}

/** 게임 대사창 (A 구조): 초상 + 이름표 + 타자 대사. 글자는 실제로는 전체가 스크린 리더에 한 번에 읽힘 */
export function Dialogue({ who, portrait, text, tone = 'py', actions, className }: { who: string; portrait: ReactNode; text: string; tone?: 'py' | 'bug'; actions?: ReactNode; className?: string }) {
  const { shown, done, skip } = useTypewriter(text);
  return (
    <section className={`ab-dialogue ab-dialogue-${tone} ${className ?? ''}`} aria-label={`${who}의 말`}>
      <div className="ab-dialogue-portrait">{portrait}</div>
      <div className="ab-dialogue-box" onClick={skip}>
        <span className="ab-nametag">{who}</span>
        <p className="ab-dialogue-text">
          <span aria-hidden>{shown}</span>
          {!done && <span className="ab-caret" aria-hidden />}
          <span className="sr-only" aria-live="polite">
            {text}
          </span>
        </p>
        {actions && <div className="ab-dialogue-actions">{actions}</div>}
      </div>
    </section>
  );
}

/** 작은 말풍선 (히어로·체험) */
export function Bubble({ children, side = 'left', className }: { children: ReactNode; side?: 'left' | 'right' | 'bottom'; className?: string }) {
  return <div className={`ab-bubble ab-bubble-${side} ${className ?? ''}`}>{children}</div>;
}

// ───────────── 바텀시트 (모바일) / 옆 장 (데스크톱)

export function Sheet({ title, onClose, children, label }: { title: ReactNode; label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = getMotion();
    if (!m.reduced && m.tier !== 'minimal') {
      const layer = el.parentElement?.getBoundingClientRect();
      const wide = !!layer && el.getBoundingClientRect().left - layer.left > 10; // 데스크톱 옆 장
      el.animate(
        wide ? [{ transform: 'translateX(40px) rotate(1.5deg)' }, { transform: 'none' }] : [{ transform: 'translateY(60%)' }, { transform: 'none' }],
        m.tier === 'lite' ? { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } : springTiming('body'),
      );
    }
    el.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ab-sheet-layer">
      <button type="button" className="ab-sheet-scrim" aria-label="닫기" tabIndex={-1} onClick={onClose} />
      <div className="ab-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
        <div className="ab-sheet-grip" aria-hidden />
        <div className="ab-sheet-head">
          <div className="ab-sheet-title">{title}</div>
          <IconButton icon="close" label="닫기" onPress={onClose} />
        </div>
        <div className="ab-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ───────────── 토스트

export function ToastLayer() {
  const t = useAb((s) => s.toast);
  if (!t) return null;
  return (
    <div className="ab-toast-wrap" role="status" aria-live="polite">
      <div key={t.id} className={`ab-toast ab-toast-${t.tone}`}>
        <Icon name={t.tone === 'lock' ? 'lock' : t.tone === 'good' ? 'check' : 'sparkle'} size={22} strokeWidth={2.6} />
        <span>{t.text}</span>
      </div>
    </div>
  );
}

/** 오려 붙인 리본 제목 (지도·절 제목) */
export function Ribbon({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'blue' | 'orange' }) {
  return <span className={`ab-ribbon ab-ribbon-${tone}`}>{children}</span>;
}
