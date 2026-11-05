// 축하 연출 한 곳: 모든 성공 흐름은 celebrate(kind)로 들어온다 (P2-05)
// #motion 무대와 같은 연출(sig.tsx buildSuccess · buildLevelUp)을 실제 HUD로 날린다.
// 보상으로 XP가 넘치면 성공 카드가 끝난 뒤 레벨업 카드가 이어진다.
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMotion } from '../shared/motion';
import { LevelUpCard, SuccessCard, buildLevelUp, buildSuccess, type HudTarget, type LevelRefs, type SuccessRefs } from './sig';
import { getAb, grant } from './store';
import { Timeline } from './timeline';
import { GameButton } from './ui';

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

/** 축하 중이면 true (뒤 화면 리그를 정지 그림으로 바꿔 축하 연출 예산을 지킴) */
export function useCelebrating() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l);
      return () => ls.delete(l);
    },
    () => current !== null,
    () => false,
  );
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
  return <CelebrateFlow key={c.id} kind={c.kind} p={c.p} />;
}

/** 실제 HUD의 코인 칩·경험치 (좁은 화면에서 경험치 바가 숨으면 레벨 배지로) */
function realHud(): HudTarget {
  const s = getAb();
  const coin = document.querySelector('.ab-hud .ab-hud-chip');
  const bar = document.querySelector<HTMLElement>('.ab-hud .ab-hud-xp');
  const barVisible = !!bar && getComputedStyle(bar).display !== 'none';
  return {
    coin,
    coinNum: coin?.querySelector('.ab-num') ?? null,
    xp: barVisible ? bar : document.querySelector('.ab-hud .ab-lv'),
    xpFill: barVisible ? bar!.querySelector<HTMLElement>('.ab-progress-fill') : null,
    base: { coins: s.coins, xp: s.xp, xpNext: s.xpNext },
  };
}

function CelebrateFlow({ kind, p }: { kind: CelebrateKind; p: CelebratePayload }) {
  const motion = useMotion();
  const view = { tier: motion.tier, reduced: motion.reduced };
  const card = useRef<SuccessRefs | null>(null);
  const lvRef = useRef<LevelRefs | null>(null);
  const [level, setLevel] = useState<{ from: number; xp: { from: number; next: number; over: number; next2: number } } | null>(null);
  const [narrow] = useState(() => (document.querySelector('.proto-viewport')?.clientWidth ?? 1000) < 560);

  // 성공 카드
  useLayoutEffect(() => {
    const c = card.current;
    if (!c) return;
    const before = getAb();
    const leveled = before.xp + p.xp >= before.xpNext;
    const tl = new Timeline(view);
    buildSuccess(tl, c, {
      at: 0,
      stars: p.stars,
      xp: p.xp,
      coins: p.coins,
      hud: realHud(),
      onGrant: () => grant({ xp: p.xp, coins: p.coins, stars: p.stars }, { bump: false }),
    });
    tl.onFinish = () => {
      if (leveled)
        window.setTimeout(
          () => setLevel({ from: before.level, xp: { from: before.xp, next: before.xpNext, over: before.xp + p.xp - before.xpNext, next2: before.xpNext + 100 } }),
          view.reduced ? 0 : 500,
        );
      else c.cta?.querySelector('button')?.focus({ preventScroll: true });
    };
    tl.play(0);
    return () => tl.dispose(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 레벨업 카드 (XP가 넘쳤을 때 이어서)
  useLayoutEffect(() => {
    const r = lvRef.current;
    if (!level || !r) return;
    const tl = new Timeline(view);
    buildLevelUp(tl, r, { at: 0, from: level.from, xp: level.xp });
    tl.onFinish = () => r.cta?.querySelector('button')?.focus({ preventScroll: true });
    tl.play(0);
    return () => tl.dispose(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  return (
    <div className="ab-cele-layer" role="dialog" aria-modal="true" aria-label={`${p.title} 축하`}>
      <SuccessCard
        ref={card}
        compact={narrow}
        view={view}
        kicker={kind === 'quiz' ? '퀴즈 성공' : kind === 'unlock' ? '새 섬 발견' : '퀘스트 클리어'}
        title={p.title}
        stars={p.stars}
        xp={p.xp}
        coins={p.coins}
        note={p.note}
        actions={
          <>
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
          </>
        }
      />
      {level && (
        <div className="ab-lv-layer" role="dialog" aria-modal="true" aria-label={`레벨 ${level.from + 1} 달성`}>
          <div className="ab-sc-scrim is-on" />
          <LevelUpCard
            ref={lvRef}
            from={level.from}
            view={view}
            compact={narrow}
            actions={
              <GameButton variant="lemon" size="md" icon="check" onPress={() => setLevel(null)}>
                좋아!
              </GameButton>
            }
          />
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {level ? `레벨 ${level.from + 1}이 되었어요` : ''}
      </span>
    </div>
  );
}
