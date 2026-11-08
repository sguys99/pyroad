'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PybaemState } from '@/components/characters/rig/pybaem';
import type { BugBugState } from '@/components/characters/rig/bugbug';
import type { ByeolttongiState } from '@/components/characters/rig/byeolttongi';
import { SpeechBubble } from '@/components/ui/speech-bubble';
// 가벼운 컨텍스트 모듈 (매니페스트·엔진 문구를 끌고 오지 않음 → 랜딩 서브셋)
import { useSfx } from '@/components/providers/soundContext';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { useInView } from '../../useInView';
import {
  createReactionCycle,
  FRIENDS,
  GREET_STAGGER_MS,
  type FriendId,
} from './friends';

type RigModule = typeof import('@/components/characters/rig/MascotRig');

/** 리그에서 쓰는 것만 (캐릭터마다 상태 타입이 달라 좁혀 둔다) */
interface Poker {
  poke(): void;
  replay(): void;
}

interface Slot {
  state: string;
  line: string;
  /** 말풍선을 다시 그릴 때마다 +1 (타자 효과 다시) */
  n: number;
  typing: boolean;
  /** 누른 횟수 (반짝이 터짐 key) */
  taps: number;
}

const SIZE = 168;

/**
 * 세 친구 (P4-06): 누르면 저마다 반응하고(리그 포즈·표정 + 말풍선 + 효과음), 화면에 들어오면 한 명씩 인사한다.
 *
 * - 첫 페인트는 서버가 그린 정지 그림(`stills`, 훅 없는 RigStatic). 화면 300px 앞에서 라이브 리그 모듈을 받아
 *   같은 자리·같은 모습으로 바꾼다 (히어로 HeroMascot과 같은 방식, 모듈도 같은 청크)
 * - 인사: 섹션이 화면에 꽤 들어오면 파이뱀 손 흔들기 → 버그버그 등장 → 별똥이 날아오기 (효과음 없음: 제스처 전)
 * - `<button aria-label>`이라 키보드(Enter·Space)로도 반응. 반응 대사는 숨은 `aria-live` 한 곳에서만 읽는다
 *   (인사는 읽지 않음 — 세 말풍선이 한꺼번에 읽히지 않게)
 * - 동작 줄이기: 리그가 위치·크기 변화 0(표정만), 반짝이 없음, 말풍선 즉시. minimal: 대기 루프 없음(리그 정책)
 */
export function FriendsCast({
  stills,
}: {
  stills: Record<FriendId, ReactNode>;
}) {
  const { budget } = useMotionTier();
  const play = useSfx();
  const [rig, setRig] = useState<RigModule | null>(null);
  const [slots, setSlots] = useState<Slot[]>(() =>
    FRIENDS.map((f) => ({
      state: 'idle',
      line: f.hello,
      n: 0,
      typing: false,
      taps: 0,
    })),
  );
  const [said, setSaid] = useState('');
  const pokers = useRef<(Poker | null)[]>([]);
  const cycles = useRef(FRIENDS.map((f) => createReactionCycle(f.reactions)));
  const backs = useRef<number[]>([]);
  const greets = useRef<number[]>([]);
  const tapped = useRef<boolean[]>([]);
  const loading = useRef(false);

  // 300px 앞: 라이브 리그 모듈 / 화면에 꽤 들어옴: 인사
  const [nearRef, near] = useInView<HTMLUListElement>();
  const [seenRef, seen] = useInView<HTMLUListElement>({
    rootMargin: '0px 0px -20% 0px',
    threshold: 0.2,
  });
  const listRef = useCallback(
    (el: HTMLUListElement | null) => {
      nearRef(el);
      seenRef(el);
    },
    [nearRef, seenRef],
  );

  const loadRig = useCallback(() => {
    if (loading.current) return;
    loading.current = true;
    void import('@/components/characters/rig/MascotRig').then(setRig);
  }, []);

  useEffect(() => {
    if (near) loadRig();
  }, [near, loadRig]);

  const patch = (i: number, next: Partial<Slot>) =>
    setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...next } : s)));

  const settle = (i: number, ms: number) => {
    window.clearTimeout(backs.current[i]);
    backs.current[i] = window.setTimeout(() => patch(i, { state: 'idle' }), ms);
  };

  useEffect(() => {
    if (!seen) return;
    const ids = FRIENDS.map((f, i) =>
      window.setTimeout(
        () => {
          // 먼저 눌러 본 친구는 인사를 건너뛴다 (반응을 덮지 않게)
          if (tapped.current[i]) return;
          setSlots((all) =>
            all.map((s, j) =>
              j === i
                ? { ...s, state: f.greet.state, n: s.n + 1, typing: true }
                : s,
            ),
          );
          settle(i, f.greet.hold);
        },
        150 + i * GREET_STAGGER_MS,
      ),
    );
    greets.current = ids;
    return () => ids.forEach((id) => window.clearTimeout(id));
    // patch·settle은 setState·ref만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen]);

  useEffect(
    () => () => {
      backs.current.forEach((id) => window.clearTimeout(id));
      greets.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const tap = (i: number) => {
    loadRig();
    const f = FRIENDS[i];
    const r = cycles.current[i].next();
    tapped.current[i] = true;
    // 같은 상태를 다시 주면 리그가 다시 시작하지 않으므로 직접 다시 재생
    if (slots[i].state === r.state) pokers.current[i]?.replay();
    pokers.current[i]?.poke();
    setSlots((all) =>
      all.map((s, j) =>
        j === i
          ? {
              ...s,
              state: r.state,
              line: r.line,
              n: s.n + 1,
              typing: true,
              taps: s.taps + 1,
            }
          : s,
      ),
    );
    setSaid(`${f.name}: ${r.line}`);
    play(r.sfx, r.rate ? { rate: r.rate } : undefined);
    settle(i, r.hold);
  };

  // 리그 ref (렌더마다 새 콜백을 만들지 않게 한 번만)
  const keepers = useRef(
    FRIENDS.map((_, i) => (h: Poker | null) => {
      pokers.current[i] = h;
    }),
  );

  const figure = (id: FriendId, i: number): ReactNode => {
    if (!rig) return stills[id];
    const common = {
      size: SIZE,
      framing: 'stage' as const,
      label: '',
      className: 'ld-friends-svg',
      pokeable: false,
    };
    const state = slots[i].state;
    if (id === 'pybaem')
      return (
        <rig.PybaemRig
          ref={keepers.current[i]}
          state={state as PybaemState}
          {...common}
        />
      );
    if (id === 'bugbug')
      return (
        <rig.BugBugRig
          ref={keepers.current[i]}
          state={state as BugBugState}
          {...common}
        />
      );
    return (
      <rig.ByeolttongiRig
        ref={keepers.current[i]}
        state={state as ByeolttongiState}
        {...common}
      />
    );
  };

  return (
    <>
      <ul ref={listRef} className="ld-friends-list" data-greeted={seen}>
        {FRIENDS.map((f, i) => {
          const s = slots[i];
          return (
            <li
              key={f.id}
              className="ld-friends-item"
              data-friend={f.id}
              data-testid={`friend-${f.id}`}
            >
              <h3 className="ld-friends-name font-display">{f.name}</h3>
              <p className="ld-friends-role">{f.role}</p>
              <div className="ld-friends-art">
                <button
                  type="button"
                  className="ld-friends-btn"
                  aria-label={`${f.name} 콕 누르기`}
                  data-state={s.state}
                  data-testid={`friend-${f.id}-btn`}
                  onClick={() => tap(i)}
                >
                  {figure(f.id, i)}
                  {s.taps > 0 && budget.particles > 0 && (
                    <span key={s.taps} className="ld-friends-burst" aria-hidden>
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                </button>
              </div>
              <div className="ld-friends-say">
                <SpeechBubble
                  key={s.n}
                  tone={f.tone}
                  tail="left"
                  text={s.line}
                  typing={s.typing}
                  data-testid={`friend-${f.id}-bubble`}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="sr-only" aria-live="polite" data-testid="friends-said">
        {said}
      </p>
    </>
  );
}
