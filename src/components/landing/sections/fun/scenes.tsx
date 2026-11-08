'use client';

/**
 * 재미 요소 쇼케이스 장면 5개 (P4-05). `FunShowcase`가 카드가 화면 근처에 오면 이 모듈을 받는다(`next/dynamic`).
 * 앱과 같은 모습이 되게 공통 컴포넌트를 그대로 쓴다: HUD(`LevelSeal`·`HudCounter`), 진행바, 보상 아이콘·별, 리그 정지 그림·스킨.
 *
 * - `run`이 오르고 `playing`이면 한 번 튼다: CSS 애니메이션 한 번(`data-on` + `key={run}`, fun.css) + 박자(`beats`)마다 값 바꾸기
 * - 안 틀 때 모습 = 대표 정지 그림. 애니메이션은 처음·끝 모습이 이것과 같아서 멈춰도 튀지 않는다
 * - 전부 장식(부모가 `aria-hidden`). 뜻은 카드 제목·설명 글자가 전한다
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HudCounter, LevelSeal } from '@/components/ui/hud';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RewardIcon, Stars } from '@/components/ui/reward-icon';
import {
  BugBugStatic,
  PybaemStatic,
  type BugBugState,
} from '@/components/characters/rig';
import { PYBAEM_SKINS } from '@/lib/avatar/skins';
import { DURATION } from '@/lib/motion/tokens';
import { SCENE_MS } from './funData';

export interface SceneProps {
  /** 몇 번째 재생인지 (0 = 아직 안 틂) */
  run: number;
  playing: boolean;
}

/** 박자: [장면 길이 중 비율, 할 일]. 재생이 끊기면(화면 밖) 남은 박자는 취소 */
function useBeats(
  run: number,
  playing: boolean,
  beats: ReadonlyArray<readonly [number, () => void]>,
) {
  const ref = useRef(beats);
  ref.current = beats;
  useEffect(() => {
    if (!playing || run === 0) return;
    const ids = ref.current.map(([at], k) =>
      window.setTimeout(() => ref.current[k][1](), at * SCENE_MS),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [run, playing]);
}

/** 한 번 도는 애니메이션의 틀: 재생마다 새로 그려(key) 처음부터 돈다 */
function Scene({
  id,
  run,
  playing,
  children,
}: SceneProps & { id: string; children: ReactNode }) {
  return (
    <div
      key={run}
      className="ld-fun-scene"
      data-scene={id}
      data-on={playing || undefined}
    >
      <div className="ld-fun-core">{children}</div>
    </div>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={`ld-fun-spark ${className}`} viewBox="-12 -12 24 24">
      <path d="M0-11L3-3L11 0L3 3L0 11L-3 3L-11 0L-3-3Z" />
    </svg>
  );
}

/** 레벨: XP 바가 차오르고 → 레벨 도장이 오르며 "레벨 업!" → 새 레벨의 XP로 */
export function LevelScene({ run, playing }: SceneProps) {
  const [level, setLevel] = useState(2);
  const [xp, setXp] = useState(55);
  useBeats(run, playing, [
    [0, () => setXp(100)],
    [0.3, () => setLevel((l) => l + 1)],
    [0.72, () => setXp(15)],
  ]);
  return (
    <Scene id="level" run={run} playing={playing}>
      <span className="ld-fun-lvup font-display">레벨 업!</span>
      <Sparkle className="ld-fun-s1" />
      <Sparkle className="ld-fun-s2" />
      <Sparkle className="ld-fun-s3" />
      <span className="ld-fun-hudbox">
        <LevelSeal level={level} />
        <ProgressBar value={xp} max={100} className="ld-fun-xpbar" />
      </span>
      <span className="ld-fun-xp font-display">+20 XP</span>
    </Scene>
  );
}

/** 코인: 보물상자에서 코인이 튀어 올라 HUD 코인 칩으로 빨려 들어가고 숫자가 올라간다 */
export function CoinScene({ run, playing }: SceneProps) {
  const [coins, setCoins] = useState(120);
  useBeats(run, playing, [[0.46, () => setCoins((c) => c + 30)]]);
  return (
    <Scene id="coin" run={run} playing={playing}>
      <HudCounter kind="coin" value={coins} className="ld-fun-chip" />
      <svg className="ld-fun-chest" viewBox="0 0 64 52">
        <g className="ld-fun-lid">
          <path
            className="hm hm-wood"
            d="M6 22C6 10 16 4 32 4C48 4 58 10 58 22Z"
          />
          <path className="hm hm-gold" d="M28 14h8v8h-8z" />
        </g>
        <path className="hm hm-wood" d="M6 22h52v26H6z" />
        <path className="hm hm-wood-dark" d="M6 30h52v4H6z" />
        <path className="hm hm-gold" d="M28 26h8v12h-8z" />
      </svg>
      {[0, 1, 2].map((i) => (
        <span key={i} className="ld-fun-coin" data-i={i}>
          <RewardIcon kind="coin" size={26} />
        </span>
      ))}
    </Scene>
  );
}

/** 꾸미기: 파이뱀이 6가지 색(온보딩에서 고르는 스킨, §12-Q34)으로 차례로 바뀐다 */
export function DressScene({ run, playing }: SceneProps) {
  const [k, setK] = useState(0);
  const n = PYBAEM_SKINS.length;
  useBeats(
    run,
    playing,
    Array.from(
      { length: n },
      (_, i) => [(i + 1) / (n + 1), () => setK((i + 1) % n)] as const,
    ),
  );
  const skin = PYBAEM_SKINS[k];
  return (
    <Scene id="dress" run={run} playing={playing}>
      {/* 색이 바뀔 때마다 새로 그려 물감 퍼짐·통통 튐이 한 번씩 돈다 (재생 중에만) */}
      <span key={`burst-${k}`} className="ld-fun-burst" />
      <span key={`py-${k}`} className="ld-fun-pybaem">
        <PybaemStatic
          state={k === 0 ? 'happy' : 'proud'}
          palette={skin.palette}
          size={96}
          framing="avatar"
          filters={false}
          label=""
          idPrefix={`ldfun-skin-${skin.id}-`}
        />
      </span>
      <span className="ld-fun-swatches">
        {PYBAEM_SKINS.map((s, i) => (
          <span
            key={s.id}
            className="ld-fun-swatch"
            data-on={i === k || undefined}
            style={{ background: s.palette.body }}
          />
        ))}
      </span>
    </Scene>
  );
}

/** 자랑하기: 공유 카드 미니어처가 살짝 들렸다가 슝 날아가고, 새 카드가 다시 놓인다 */
export function ShareScene({ run, playing }: SceneProps) {
  return (
    <Scene id="share" run={run} playing={playing}>
      <span className="ld-fun-whoosh">
        <i />
        <i />
        <i />
      </span>
      <span className="ld-fun-card-mini">
        <PybaemStatic
          state="proud"
          size={56}
          framing="avatar"
          filters={false}
          label=""
          idPrefix="ldfun-share-"
        />
        <span className="ld-fun-card-copy">
          <Stars n={3} size={16} label={false} />
          <b className="font-display">레벨 3!</b>
        </span>
      </span>
    </Scene>
  );
}

/** 보스 배틀: 파이뱀의 코드 주문이 날아가 버그버그 HP 바가 깎이고 흔들린다 → 다음 판은 다시 가득 */
export function BossScene({ run, playing }: SceneProps) {
  const [hp, setHp] = useState(100);
  const [bug, setBug] = useState<BugBugState>('idle');
  const hit = () => {
    setHp((h) => Math.max(15, h - 40));
    setBug('hit');
  };
  const back = DURATION.slow / SCENE_MS;
  useBeats(run, playing, [
    [0.2, hit],
    [0.2 + back, () => setBug('idle')],
    [0.56, hit],
    [0.56 + back, () => setBug('idle')],
    // 다음 판: HP가 다시 가득 (정지 그림도 가득 찬 HP)
    [0.86, () => setHp(100)],
  ]);
  return (
    <Scene id="boss" run={run} playing={playing}>
      <span className="ld-fun-hero">
        <PybaemStatic
          state="teach"
          size={72}
          framing="avatar"
          filters={false}
          label=""
          idPrefix="ldfun-boss-py-"
        />
      </span>
      <span className="ld-fun-shot">
        <Sparkle className="ld-fun-shot-star" />
      </span>
      <span className="ld-fun-boss">
        <ProgressBar value={hp} max={100} size="sm" className="ld-fun-hp" />
        <span className="ld-fun-bug">
          <BugBugStatic
            state={bug}
            size={84}
            framing="avatar"
            filters={false}
            label=""
            idPrefix={`ldfun-boss-bug-${bug}-`}
          />
        </span>
        <span className="ld-fun-impact" />
      </span>
    </Scene>
  );
}
