'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { Heart } from 'lucide-react';
import {
  BugBugStatic,
  type BugBugState,
  type PybaemState,
} from '@/components/characters/rig';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { tierDuration } from '@/lib/motion/tokens';
import { BOSS_HEARTS } from '@/lib/quest/boss';
import type { BossFx, BossPhase } from '@/lib/quest/useBossSession';
import { MyPybaemStatic } from '@/components/profile/MyLook';
import { PybaemRig } from '../StoryPage';
import './boss.css';

// 버그버그 라이브 리그는 보스 화면에서만 불러옴 (그 사이는 같은 모습의 정지 그림, rig.md 지연 로드)
const BugBugRig = dynamic(
  () =>
    import('@/components/characters/rig/MascotRig').then((m) => m.BugBugRig),
  {
    ssr: false,
    loading: () => <BugBugStatic state="idle" size={BOSS_SIZE} label="" />,
  },
);

const BOSS_SIZE = 132;
const HERO_SIZE = 112;
/** 공격·피격 자세를 보여 주는 시간 (그 뒤 대기로). 리그 일회성 동작이 한 번 끝나는 길이 */
const POSE_MS = 1200;

export interface BossArenaProps {
  phase: BossPhase;
  bossName: string;
  /** 보스 HP = 남은 문제 수 */
  hp: number;
  total: number;
  hearts: number;
  fx: BossFx | null;
  /** 이름표 줄과 무대 사이의 보스 한마디 (말풍선) */
  say?: React.ReactNode;
  /** 움직이지 않는 정지 그림 리그 (카탈로그 상태 견본: 라이브 리그 여러 개가 한 화면에 뜨지 않게) */
  still?: boolean;
  className?: string;
}

/** 리그 자세: 판 단계 + 마지막 연출(공격·피격 직후 POSE_MS 동안) */
export function arenaPoses(
  phase: BossPhase,
  fx: BossFx['type'] | null,
): { hero: PybaemState; boss: BugBugState } {
  if (phase === 'won') return { hero: 'cheer', boss: 'defeat' };
  if (phase === 'lost') return { hero: 'encourage', boss: 'idle' };
  if (phase === 'intro') return { hero: 'idle', boss: 'appear' };
  if (fx === 'attack') return { hero: 'happy', boss: 'hit' };
  if (fx === 'hurt') return { hero: 'surprised', boss: 'attack' };
  return { hero: 'idle', boss: 'idle' };
}

/**
 * 보스 배틀 무대 (P9-12): 왼쪽 내 파이뱀(꾸민 모습, P9-05) + 하트 3개, 오른쪽 버그버그 + 이름표·HP 바.
 * 정답 = 파이뱀이 코드 별을 쏘아 보스에 맞힘(별 날아감 → 충돌 별꽃 → 보스 깜빡·흔들 → "−1"),
 * 오답 = 버그버그 돌진(리그 attack) → 무대 흔들림 → 파이뱀 깜빡 → 하트 하나 깨짐.
 * 움직임은 모두 transform·opacity 일회성 CSS 애니메이션(fx.n 이 바뀌면 key 로 다시 그림). minimal 은 opacity 만,
 * 동작 줄이기는 움직임 0(깜빡·흔들 없이 리그 표정·"−1" 글자·하트 색만). 숫자는 늘 글자로도(HP n/m · 하트 n개)
 */
export function BossArena({
  phase,
  bossName,
  hp,
  total,
  hearts,
  fx,
  say,
  still = false,
  className,
}: BossArenaProps) {
  const { budget } = useMotionTier();
  // 공격·피격 자세는 잠깐만 → 대기로. 판이 끝난 뒤 자세는 phase 가 정함
  const [posing, setPosing] = useState<BossFx | null>(null);
  useEffect(() => {
    if (!fx) return;
    setPosing(fx);
    const t = setTimeout(
      () => setPosing((cur) => (cur === fx ? null : cur)),
      Math.max(tierDuration(POSE_MS, budget), 600),
    );
    return () => clearTimeout(t);
  }, [fx, budget]);
  const poses = arenaPoses(phase, posing?.type ?? null);
  const n = fx?.n ?? 0;
  // 리그를 다시 마운트하지 않고 같은 연출을 다시 틀려고 a·b 두 이름을 번갈아 씀 (같은 키프레임을 다시 걸면 재생되지 않음)
  const alt = n % 2 ? 'a' : 'b';
  const hurt = fx?.type === 'hurt' ? alt : undefined;
  const hit = fx?.type === 'attack' ? alt : undefined;

  return (
    <section
      className={['bb-arena', className].filter(Boolean).join(' ')}
      data-phase={phase}
      data-fx={posing?.type}
      aria-label="보스 배틀"
      data-testid="boss-arena"
    >
      <div className="bb-sky" aria-hidden />
      {/* 흔들림은 무대 안쪽 층만 (머리 글자·HP 바는 읽을 수 있게 그대로) */}
      <div className="bb-stage" data-shake={hurt}>
        <div className="bb-ground" aria-hidden />
        <div className="bb-side" data-side="hero" data-lunge={hit}>
          <div className="bb-rig" data-flash={hurt}>
            {still ? (
              <MyPybaemStatic
                state={poses.hero}
                size={HERO_SIZE}
                framing="stage"
                label=""
              />
            ) : (
              <PybaemRig
                state={poses.hero}
                size={HERO_SIZE}
                framing="stage"
                lookAt={false}
                label=""
              />
            )}
          </div>
        </div>
        <div className="bb-side" data-side="boss" data-lunge={hurt}>
          <div className="bb-rig" data-flash={hit}>
            {still ? (
              <BugBugStatic
                state={poses.boss}
                size={BOSS_SIZE}
                framing="stage"
                label=""
              />
            ) : (
              <BugBugRig
                state={poses.boss}
                size={BOSS_SIZE}
                framing="stage"
                lookAt={false}
                label=""
              />
            )}
          </div>
        </div>

        {/* 일회성 이펙트: 별탄 · 충돌 별꽃 · 피해 숫자 (key 로 다시 재생) */}
        {fx?.type === 'attack' && (
          <div className="bb-fx" key={`atk-${n}`} aria-hidden>
            <span className="bb-shot">
              <ShotStar />
            </span>
            <span className="bb-burst" data-at="boss">
              {BURST.map((r) => (
                <i key={r} style={{ '--r': `${r}deg` } as CSSProperties} />
              ))}
            </span>
            <b className="bb-dmg font-display" data-at="boss">
              −1
            </b>
          </div>
        )}
        {fx?.type === 'hurt' && (
          <div className="bb-fx" key={`hurt-${n}`} aria-hidden>
            <span className="bb-burst" data-at="hero" data-tone="hurt">
              {BURST.map((r) => (
                <i key={r} style={{ '--r': `${r}deg` } as CSSProperties} />
              ))}
            </span>
            <b className="bb-dmg font-display" data-at="hero" data-tone="hurt">
              −1
            </b>
          </div>
        )}
      </div>

      <div className="bb-plates">
        <HeartRow hearts={hearts} hurtKey={fx?.type === 'hurt' ? n : 0} />
        <BossHpBar name={bossName} hp={hp} total={total} />
      </div>
      {say && <div className="bb-say">{say}</div>}
    </section>
  );
}

const BURST = [0, 45, 90, 135, 180, 225, 270, 315];

/** 파이뱀이 쏘는 별탄 (코드 괄호 모양 별, 금색 토큰) */
function ShotStar() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" focusable="false">
      <path
        d="M16 3.5l3.7 7.6 8.3 1.2-6 5.9 1.4 8.3L16 22.6l-7.4 3.9 1.4-8.3-6-5.9 8.3-1.2z"
        className="fill-accent stroke-accent-lip"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 하트 3개 (남은 것 = 빨강, 잃은 것 = 빈 하트). 방금 잃은 하트는 깨지는 연출 */
export function HeartRow({
  hearts,
  hurtKey = 0,
}: {
  hearts: number;
  hurtKey?: number;
}) {
  return (
    <div
      className="bb-hearts"
      role="img"
      aria-label={`하트 ${hearts}개 남음`}
      data-testid="boss-hearts"
      data-hearts={hearts}
    >
      {Array.from({ length: BOSS_HEARTS }, (_, i) => {
        const alive = i < hearts;
        // 방금 잃은 하트 = 남은 수 바로 다음 칸
        const breaking = !alive && i === hearts && hurtKey > 0;
        return (
          <span
            key={breaking ? `b-${hurtKey}` : i}
            className="bb-heart"
            data-alive={alive || undefined}
            data-breaking={breaking || undefined}
          >
            <Heart aria-hidden strokeWidth={2.4} />
          </span>
        );
      })}
      <span className="bb-plate-n" aria-hidden>
        {hearts}/{BOSS_HEARTS}
      </span>
    </div>
  );
}

/** 보스 이름표 + HP 바: 채움은 scaleX 트윈, 깎인 만큼 밝은 잔상이 한 박자 늦게 줄어듦 (격투 게임 HP 바) */
export function BossHpBar({
  name,
  hp,
  total,
}: {
  name: string;
  hp: number;
  total: number;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, hp / total)) : 0;
  return (
    <div className="bb-hp" data-testid="boss-hp" data-hp={hp}>
      <p className="bb-hp-name">
        <span className="font-display">{name}</span>
        <span className="bb-plate-n" aria-hidden>
          HP {hp}/{total}
        </span>
      </p>
      <div
        className="bb-hp-track"
        role="progressbar"
        aria-label="보스 HP"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={hp}
        aria-valuetext={`보스 HP ${hp}/${total}`}
        style={{ '--bb-hp': ratio } as CSSProperties}
      >
        <span className="bb-hp-lag" />
        <span className="bb-hp-fill" />
        {/* 칸 나눔: 문제 하나 = 한 칸 */}
        {Array.from({ length: Math.max(0, total - 1) }, (_, i) => (
          <i
            key={i}
            className="bb-hp-tick"
            style={{ left: `${((i + 1) / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
