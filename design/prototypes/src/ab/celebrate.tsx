// 축하 연출 한 곳 (P2-05에서 풍성하게 바꿀 자리). 지금은 최소한:
// 종이 카드 등장(A 스프링) → "통과!" 도장 쾅(B) → 별 하나씩 팝 → 보상 숫자 → HUD에 반영
// 연출 단계: lite 70%·흔들림 없음 / minimal 페이드 / 동작 줄이기 즉시 표시(색·글자로만)
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { RewardIcon } from '../shared/icons';
import { getMotion, play, springTiming, tierDuration } from '../shared/motion';
import { EASING } from '../shared/tokens';
import { PybaemRig } from '../shared/rig/PybaemRig';
import { GameButton, Stars } from './ui';
import { grant } from './store';

export type CelebrateKind = 'quest' | 'quiz' | 'unlock';
export interface CelebratePayload {
  title: string;
  stars: number;
  xp: number;
  coins: number;
  note?: string;
  onNext?: () => void;
  nextLabel?: string;
  onMap?: () => void;
}
let current: { kind: CelebrateKind; p: CelebratePayload; id: number } | null = null;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

/** 축하 시작: 모든 성공 흐름은 이 함수 하나로 들어온다 */
export function celebrate(kind: CelebrateKind, p: CelebratePayload) {
  current = { kind, p, id: Date.now() };
  emit();
}
export function closeCelebrate() {
  current = null;
  emit();
}

export function CelebrateLayer() {
  const c = useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => current,
    () => current,
  );
  if (!c) return null;
  return <CelebrateCard key={c.id} kind={c.kind} p={c.p} />;
}

function CelebrateCard({ kind, p }: { kind: CelebrateKind; p: CelebratePayload }) {
  const card = useRef<HTMLDivElement | null>(null);
  const stamp = useRef<HTMLDivElement | null>(null);
  const stars = useRef<HTMLDivElement | null>(null);
  const rewards = useRef<HTMLDivElement | null>(null);
  const nextBtn = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const m = getMotion();
    const timers: number[] = [];
    // 1. 카드: 아래에서 종이가 튀어 오름
    play(card.current, [{ transform: 'translateY(40px) scale(0.92) rotate(-2deg)' }, { transform: 'none' }], springTiming('body'), {
      lite: [{ transform: 'translateY(16px)' }, { transform: 'none' }],
    });
    // 2. 도장 쾅
    timers.push(
      window.setTimeout(() => {
        const el = stamp.current;
        if (!el) return;
        el.classList.add('is-on');
        if (m.reduced) return;
        if (m.tier === 'minimal') {
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
          return;
        }
        el.animate([{ transform: 'rotate(-12deg) scale(2.2)', opacity: 0.2 }, { transform: 'rotate(-12deg) scale(0.9)', opacity: 1 }], {
          duration: tierDuration(220),
          easing: EASING.stampIn,
        }).finished.then(() => {
          el.animate([{ transform: 'rotate(-12deg) scale(0.9)' }, { transform: 'rotate(-12deg)' }], springTiming('body'));
          if (m.tier === 'full') card.current?.animate([{ transform: 'translate(2px, 1px)' }, { transform: 'translate(-2px, -1px)' }, { transform: 'none' }], { duration: 120, easing: 'steps(3)' });
        });
      }, m.reduced ? 0 : tierDuration(320)),
    );
    // 3. 별 하나씩
    const starEls = Array.from(stars.current?.querySelectorAll('svg') ?? []);
    starEls.forEach((s, i) => {
      timers.push(
        window.setTimeout(() => {
          play(s, [{ transform: 'scale(0.2) rotate(-40deg)' }, { transform: 'none' }], springTiming('prop'), { minimal: null });
        }, m.reduced ? 0 : tierDuration(620 + i * 160)),
      );
    });
    // 4. 보상 → HUD
    timers.push(
      window.setTimeout(() => {
        rewards.current?.classList.add('is-on');
        play(rewards.current, [{ transform: 'translateY(10px)' }, { transform: 'none' }], springTiming('prop'));
        grant({ xp: p.xp, coins: p.coins, stars: p.stars });
      }, m.reduced ? 0 : tierDuration(1150)),
    );
    timers.push(window.setTimeout(() => nextBtn.current?.querySelector('button')?.focus({ preventScroll: true }), m.reduced ? 0 : tierDuration(1200)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [p]);

  return (
    <div className="ab-cele-layer" role="dialog" aria-modal="true" aria-label={`${p.title} 축하`}>
      <div className="ab-cele-scrim" />
      <div className="ab-cele" ref={card}>
        <div className="ab-cele-py">
          <PybaemRig style="AB" state="cheer" size={150} lookAt={false} />
        </div>
        <div className="ab-cele-stamp" ref={stamp} aria-hidden>
          <span>{kind === 'unlock' ? '열렸다!' : '통과!'}</span>
        </div>
        <p className="ab-cele-kicker">{kind === 'quiz' ? '퀴즈 성공' : kind === 'unlock' ? '새 섬 발견' : '퀘스트 클리어'}</p>
        <h2 className="ab-cele-title">{p.title}</h2>
        <div className="ab-cele-stars" ref={stars}>
          <Stars n={p.stars} size={44} />
        </div>
        {p.note && <p className="ab-cele-note">{p.note}</p>}
        <div className="ab-cele-rewards" ref={rewards}>
          <span className="ab-reward">
            <RewardIcon kind="gem" style="AB" size={26} />
            <b>+{p.xp}</b> XP
          </span>
          <span className="ab-reward">
            <RewardIcon kind="coin" style="AB" size={26} />
            <b>+{p.coins}</b> 코인
          </span>
        </div>
        <div className="ab-cele-actions" ref={nextBtn}>
          <GameButton
            variant="primary"
            size="lg"
            iconRight="arrowRight"
            onPress={() => {
              closeCelebrate();
              p.onNext?.();
            }}
          >
            {p.nextLabel ?? '다음 퀘스트'}
          </GameButton>
          <GameButton
            variant="paper"
            size="md"
            icon="map"
            onPress={() => {
              closeCelebrate();
              p.onMap?.();
            }}
          >
            지도로
          </GameButton>
        </div>
      </div>
    </div>
  );
}
