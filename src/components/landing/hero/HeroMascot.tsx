'use client';

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
  type Ref,
} from 'react';
import type { PybaemState } from '@/components/characters/rig';
import type { RigHandle } from '@/components/characters/rig/LiveRig';
import type { PybaemRigProps } from '@/components/characters/rig/MascotRig';
import { SpeechBubble } from '@/components/ui/speech-bubble';
// 가벼운 컨텍스트 모듈 (매니페스트·엔진 문구를 끌고 오지 않음 → 랜딩 서브셋)
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  createTapTracker,
  GREETING,
  HERO_MASCOT_SIZE,
} from './mascotReactions';

type LiveRig = ComponentType<
  PybaemRigProps & { ref?: Ref<RigHandle<PybaemState>> }
>;

const SIZE = HERO_MASCOT_SIZE;
const WAVE_MS = 1400;

/** 브라우저가 한가할 때 (없으면 잠깐 뒤) */
function whenIdle(fn: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout: 1500 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(fn, 300);
  return () => window.clearTimeout(id);
}

/**
 * 히어로 파이뱀 (P4-01): 포인터·터치를 눈으로 따라보고, 누르면 반응한다(점프·젤리·표정 + 말풍선 + 효과음).
 *
 * - 첫 페인트는 서버 컴포넌트(HeroSection)가 그린 정지 그림 `still`(`PybaemStatic` idle). 리그 코드는 첫 JS에 싣지 않고 (P4-12)
 *   하이드레이션 뒤 한가할 때(또는 처음 누를 때) 라이브 리그 모듈을 받아 같은 자리·같은 모습으로 바꾼다 → 깜빡임 없음
 *   (리그 첫 렌더 = 같은 staticGeo, rig.md §2). 라이브가 오기 전에 누르면 반응(말풍선·효과음)은 바로, 표정은 리그가 온 뒤
 * - 반응은 `mascotReactions`의 순서대로, 연타하면 "어지러워". 리그는 어느 순간 끊어도 스프링으로 이어진다
 * - `<button>` + `aria-label`이라 키보드(Enter·Space)로도 반응. 말풍선은 `aria-live`로 한 번 읽힌다
 * - 동작 줄이기: 리그가 위치·크기 변화 0(표정만), 반짝이 터짐 없음, 말풍선은 타자 효과 없이 바로
 * - 마우스를 올리면 손(꼬리) 흔들기 인사
 */
export function HeroMascot({ still }: { still: ReactNode }) {
  const { budget } = useMotionTier();
  const play = useSfx();
  const [Live, setLive] = useState<LiveRig | null>(null);
  const rig = useRef<RigHandle<PybaemState>>(null);
  const [state, setState] = useState<PybaemState>('idle');
  const [line, setLine] = useState(GREETING);
  const [taps, setTaps] = useState(0);
  const tracker = useRef(createTapTracker());
  const back = useRef(0);
  const loading = useRef(false);

  const loadLive = () => {
    if (loading.current) return;
    loading.current = true;
    void import('@/components/characters/rig/MascotRig').then((m) =>
      setLive(() => m.PybaemRig as LiveRig),
    );
  };

  useEffect(() => whenIdle(loadLive), []);
  useEffect(() => () => window.clearTimeout(back.current), []);

  const settle = (ms: number) => {
    window.clearTimeout(back.current);
    back.current = window.setTimeout(() => setState('idle'), ms);
  };

  const react = () => {
    loadLive();
    const r = tracker.current.tap(performance.now());
    setState(r.state);
    setLine(r.line);
    setTaps((n) => n + 1);
    rig.current?.poke();
    play(r.sfx, r.rate ? { rate: r.rate } : undefined);
    settle(r.hold);
  };

  const greet = (pointerType: string) => {
    if (pointerType !== 'mouse' || state !== 'idle') return;
    loadLive();
    setState('wave');
    settle(WAVE_MS);
  };

  const common = {
    state,
    size: SIZE,
    framing: 'stage' as const,
    label: '',
    className: 'hero-mascot-svg',
  };

  return (
    <div className="hero-buddy hero-par">
      <div className="hero-buddy-in">
        <div className="hero-say" aria-live="polite">
          <SpeechBubble
            key={taps}
            speaker="파이뱀"
            text={line}
            typing={taps > 0}
            tail="left"
            data-testid="hero-bubble"
          />
        </div>
        <button
          type="button"
          className="hero-mascot"
          aria-label="파이뱀 콕 누르기"
          data-testid="hero-mascot"
          data-state={state}
          onClick={react}
          onPointerEnter={(e) => greet(e.pointerType)}
        >
          {Live ? <Live ref={rig} {...common} pokeable={false} /> : still}
          {taps === 0 && <span className="hero-poke-hint" aria-hidden />}
          {taps > 0 && budget.particles > 0 && (
            <span key={taps} className="hero-burst" aria-hidden>
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
