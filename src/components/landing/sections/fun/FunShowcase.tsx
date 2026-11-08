'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import dynamic from 'next/dynamic';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { WhenVisible } from '../../WhenVisible';
import {
  nextScene,
  SCENE_GAP_MS,
  SCENE_MS,
  showMode,
  SOON_LABEL,
  type FunScene,
  type FunSceneId,
} from './funData';
import type { SceneProps } from './scenes';

// 장면 그림(HUD·보상 아이콘·리그)은 첫 화면 JS에 넣지 않는다 (§2.10). 카드가 화면 300px 앞에 오면 한 덩어리로 받는다
const load = () => import('./scenes');
const SCENES: Record<FunSceneId, ComponentType<SceneProps>> = {
  level: dynamic(() => load().then((m) => m.LevelScene), { ssr: false }),
  coin: dynamic(() => load().then((m) => m.CoinScene), { ssr: false }),
  dress: dynamic(() => load().then((m) => m.DressScene), { ssr: false }),
  share: dynamic(() => load().then((m) => m.ShareScene), { ssr: false }),
  boss: dynamic(() => load().then((m) => m.BossScene), { ssr: false }),
};

/**
 * 재미 요소 쇼케이스 목록 (P4-05). 제목·설명·"곧 열려요"는 서버 HTML에도 있고, 장면 그림만 늦게 받는다.
 *
 * 재생 순서표(스포트라이트): 화면 안(카드 60% 이상 보임)의 장면만, 한 번에 하나씩 차례로 튼다 → 다섯 장면이 동시에 움직이지 않는다.
 * - full: 차례로 계속 반복 / lite: 들어온 장면을 한 번씩만 / minimal·동작 줄이기: 틀지 않음(대표 정지 그림)
 * - 트는 장면이 화면 밖으로 나가거나 탭이 숨으면 바로 멈추고(장면은 정지 그림으로 돌아감) 다시 보이면 이어서
 * - 장면 하나 = 한 번 도는 CSS 애니메이션(transform·opacity) + 몇 번의 값 바꾸기(HUD 숫자·XP·HP). 무한 반복 애니메이션은 없다
 */
export function FunShowcase({ scenes }: { scenes: readonly FunScene[] }) {
  const { tier, reduced } = useMotionTier();
  const mode = showMode(tier, reduced);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const listRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [runs, setRuns] = useState<number[]>(() => scenes.map(() => 0));
  const visible = useRef(new Set<number>());
  const played = useRef(new Set<number>());
  const last = useRef<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const timer = useRef(0);
  const busy = useRef(false);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    busy.current = false;
    activeRef.current = null;
    setActive(null);
  }, []);

  const tick = useCallback(() => {
    busy.current = false;
    const i = document.hidden
      ? null
      : nextScene(
          [...visible.current].sort((a, b) => a - b),
          last.current,
          played.current,
          modeRef.current,
        );
    if (i === null) {
      activeRef.current = null;
      setActive(null);
      return;
    }
    busy.current = true;
    last.current = i;
    played.current.add(i);
    activeRef.current = i;
    setActive(i);
    setRuns((r) => r.map((v, k) => (k === i ? v + 1 : v)));
    timer.current = window.setTimeout(() => {
      activeRef.current = null;
      setActive(null);
      timer.current = window.setTimeout(tick, SCENE_GAP_MS);
    }, SCENE_MS);
  }, []);

  const kick = useCallback(() => {
    if (!busy.current) tick();
  }, [tick]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.funCard);
          if (e.isIntersecting) visible.current.add(i);
          else visible.current.delete(i);
        }
        const a = activeRef.current;
        if (a !== null && !visible.current.has(a)) stop();
        kick();
      },
      { threshold: 0.6 },
    );
    for (const card of list.querySelectorAll('[data-fun-card]')) {
      io.observe(card);
    }
    const onVisibility = () => {
      if (document.hidden) stop();
      else kick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(timer.current);
      busy.current = false;
    };
  }, [kick, stop]);

  // 단계가 바뀌면(하이드레이션 직후 보정·실측 하향) 지금 것을 멈추고 새 방식으로
  useEffect(() => {
    stop();
    if (mode !== 'still') kick();
  }, [mode, stop, kick]);

  return (
    <ul
      ref={listRef}
      className="ld-fun-list"
      data-mode={mode}
      data-testid="fun-list"
      // 좁은 화면에서는 가로로 넘기는 목록 → 키보드로도 스크롤할 수 있게 포커스를 받는다
      tabIndex={0}
      aria-label="재미 요소 다섯 가지"
    >
      {scenes.map((s, i) => {
        const Scene = SCENES[s.id];
        const playing = active === i;
        return (
          <li
            key={s.id}
            className="ld-fun-card"
            data-fun-card={i}
            data-scene={s.id}
            data-active={playing || undefined}
            data-testid={`fun-card-${s.id}`}
          >
            <div className="ld-fun-stage" aria-hidden>
              <WhenVisible minHeight="0px" className="ld-fun-lazy">
                <Scene run={runs[i]} playing={playing} />
              </WhenVisible>
            </div>
            {s.soon && (
              <span className="ld-fun-soon" aria-hidden>
                {SOON_LABEL}
              </span>
            )}
            <h3 className="ld-fun-title font-display">
              {s.title}
              {s.soon && <span className="sr-only"> ({SOON_LABEL})</span>}
            </h3>
            <p className="ld-fun-line">{s.line}</p>
          </li>
        );
      })}
    </ul>
  );
}
