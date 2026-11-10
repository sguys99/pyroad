'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  MOTION_BUDGETS,
  MOTION_TIERS,
  motionBudget,
  type MotionBudget,
} from '@/lib/motion/tier';
import { Demo, Section } from './ui';
import '@/components/world/map/worldMap.css';

/** 단계표 줄 이름 (docs/design/motion-guidelines.md §2) */
const BUDGET_ROWS: [keyof MotionBudget, string][] = [
  ['mascot', '마스코트 리그'],
  ['mascotFps', '리그 프레임 상한'],
  ['mascotSecondary', '두리번·오버래핑'],
  ['blink', '눈 깜빡임'],
  ['idleLoops', '대기 루프'],
  ['springs', '스프링·바운스'],
  ['effectDuration', '일회성 이펙트 길이'],
  ['particles', '파티클·컨페티'],
  ['ambient', '앰비언트'],
  ['parallax', '패럴랙스'],
  ['blur', '흐림'],
  ['bigShadow', '큰 그림자'],
  ['pageTransition', '페이지 전환'],
  ['lottie', 'Lottie'],
  ['bgm', '배경 음악'],
  ['sfx', '효과음'],
];

/** 배율 값 (100% = 그대로) */
const RATIO_KEYS = new Set<keyof MotionBudget>(['particles', 'effectDuration']);

function show(key: keyof MotionBudget, v: MotionBudget[keyof MotionBudget]): string {
  if (typeof v === 'boolean') return v ? '켬' : '끔';
  if (typeof v === 'number' && RATIO_KEYS.has(key)) return `${Math.round(v * 100)}%`;
  return String(v);
}

/** 이 상자 안에서 지금 돌고 있는 무한 반복 애니메이션 수 (1초마다). e2e와 같은 기준: `getAnimations` + iterations = Infinity */
function useRunningLoops() {
  const ref = useRef<HTMLDivElement>(null);
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const count = () => {
      const el = ref.current;
      if (!el || typeof el.getAnimations !== 'function') return;
      setN(
        el
          .getAnimations({ subtree: true })
          .filter(
            (a) =>
              a.playState === 'running' &&
              a.effect?.getComputedTiming().iterations === Infinity,
          ).length,
      );
    };
    count();
    const id = window.setInterval(count, 1000);
    return () => window.clearInterval(id);
  }, []);
  return { ref, n };
}

function LoopTile({
  label,
  rule,
  children,
  testId,
}: {
  label: string;
  rule: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  const { ref, n } = useRunningLoops();
  return (
    <Demo
      label={label}
      note={rule}
      surface="card"
      data-testid={testId}
      className="flex flex-col"
    >
      <div
        ref={ref}
        className="relative flex min-h-24 flex-1 items-center justify-center gap-4 overflow-hidden rounded-xl bg-surface-2"
      >
        {children}
      </div>
      <p className="text-caption text-muted-foreground" aria-live="off">
        돌고 있는 반복 연출:{' '}
        <b className="text-foreground tabular-nums">{n ?? '-'}</b>개
      </p>
    </Demo>
  );
}

/** 연출 단계 견본: 단계표 + 앱의 실제 반복 연출 클래스(globals.css)를 그대로 써서 단계별로 켜지고 꺼지는지 본다 */
export function MotionTierSection() {
  const { tier, reduced, budget } = useMotionTier();
  const reducedBudget = motionBudget(tier, true);
  return (
    <Section
      id="motion"
      kicker="연출 단계 (P2-15)"
      title="연출 단계 견본"
      description="위 막대에서 단계를 바꾸면 아래 표의 '지금' 줄과 견본이 함께 바뀝니다. 견본은 앱 화면과 같은 클래스(.mascot-bob, .float-cloud, .waking-dot …)라 여기서 멈추면 앱에서도 멈춥니다. 반복 연출 수는 e2e 검사와 같은 기준으로 셉니다."
    >
      <div className="overflow-x-auto rounded-2xl bg-card shadow-card">
        <table className="w-full min-w-[40rem] text-left text-small">
          <caption className="sr-only">단계별 능력값 (MotionBudget)</caption>
          <thead className="text-caption text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 font-semibold">연출</th>
              {MOTION_TIERS.map((t) => (
                <th
                  key={t}
                  className={cn(
                    'px-3 py-2 font-semibold',
                    t === tier && !reduced && 'text-primary-text',
                  )}
                >
                  {t}
                </th>
              ))}
              <th
                className={cn(
                  'px-3 py-2 font-semibold',
                  reduced && 'text-primary-text',
                )}
              >
                동작 줄이기 ({tier})
              </th>
              <th className="bg-primary-soft px-3 py-2 font-semibold text-primary-text">
                지금
              </th>
            </tr>
          </thead>
          <tbody>
            {BUDGET_ROWS.map(([key, label]) => (
              <tr key={key} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-1.5 font-medium">
                  {label}
                </th>
                {MOTION_TIERS.map((t) => (
                  <td key={t} className="px-3 py-1.5 text-muted-foreground">
                    {show(key, MOTION_BUDGETS[t][key])}
                  </td>
                ))}
                <td className="px-3 py-1.5 text-muted-foreground">
                  {show(key, reducedBudget[key])}
                </td>
                <td
                  className="bg-primary-soft px-3 py-1.5 font-semibold"
                  data-testid={`budget-${key}`}
                >
                  {show(key, budget[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <LoopTile
          label="대기 루프"
          rule="full·lite 켬 · minimal·동작 줄이기 끔"
          testId="tile-loop"
        >
          <span className="mascot-bob inline-block size-10 rounded-full bg-primary" />
          <span className="character-breathe inline-block size-10 rounded-xl bg-primary-bright" />
          <span className="relative inline-block size-10 rounded-full bg-surface">
            <span className="stage-pulse" />
          </span>
        </LoopTile>
        <LoopTile
          label="앰비언트"
          rule="full만 켬 (구름·나뭇잎·반짝임) · lite부터 정지 배경"
          testId="tile-ambient"
        >
          <span className="float-cloud inline-block h-6 w-20 rounded-full bg-surface" />
          <span className="drift-leaf absolute top-1 left-1/4 inline-block size-3 rounded-tl-full rounded-br-full bg-primary-bright" />
          <span className="relative inline-block h-10 w-24 overflow-hidden rounded-xl bg-accent-soft">
            <span className="stage-shimmer" />
          </span>
        </LoopTile>
        <LoopTile
          label="월드 지도 앰비언트 (P5-09)"
          rule="full만 · 구름 흐름·물결·배 까딱·새 날기+날갯짓·반짝임·나뭇잎. 지도 밖·탭 숨김이면 멈춤"
          testId="tile-map-ambient"
        >
          <span className="wm-a-cloud inline-block h-5 w-16 rounded-full bg-surface" />
          <span className="wm-a-wave inline-block h-1 w-12 rounded-full bg-secondary" />
          <span className="wm-a-boat inline-block size-6 rounded-b-xl bg-accent" />
          <span className="wm-a-bird inline-block text-foreground">
            <svg className="h-2 w-6" viewBox="0 -6 24 8" aria-hidden>
              <path d="M0 0q6-6 12 0q6-6 12 0" fill="none" stroke="currentColor" />
            </svg>
          </span>
          <span className="wm-a-spark inline-block size-3 rounded-sm bg-accent" />
          <span className="wm-a-leaf inline-block size-3 rounded-tl-full rounded-br-full bg-primary-bright" />
        </LoopTile>
        <LoopTile
          label="바쁨 표시"
          rule="기능 신호라 minimal에서도 돎 · 동작 줄이기에서만 멈춤"
          testId="tile-busy"
        >
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="waking-dot size-2 rounded-full bg-foreground" />
            ))}
          </span>
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="thinking-dot size-2 rounded-full bg-primary" />
            ))}
          </span>
          <Loader2 aria-hidden className="size-6 animate-spin reduced:animate-none" />
          <span className="h-4 w-16 animate-pulse rounded bg-surface-lip reduced:animate-none" />
        </LoopTile>
        <LoopTile
          label="눈 깜빡임 (예전 캐릭터 SVG)"
          rule="full·lite 4.2초 · 동작 줄이기는 느리게 7초 · minimal 끔"
          testId="tile-blink"
        >
          <svg viewBox="0 0 40 24" width={80} height={48} aria-hidden>
            <ellipse className="char-blink-eye fill-foreground" cx={12} cy={12} rx={5} ry={7} />
            <ellipse className="char-blink-eye fill-foreground" cx={28} cy={12} rx={5} ry={7} />
            <circle className="char-blink-highlight fill-surface" cx={13.5} cy={9} r={1.6} />
            <circle className="char-blink-highlight fill-surface" cx={29.5} cy={9} r={1.6} />
          </svg>
          <svg viewBox="0 0 32 32" width={36} height={36} aria-hidden>
            <path
              className="char-twinkle fill-accent"
              d="M16 3l3.6 8.4 9 .8-6.8 6 2 8.8L16 22.4 8.2 27l2-8.8-6.8-6 9-.8z"
            />
          </svg>
        </LoopTile>
        <Demo
          label="흐림 (backdrop-blur)"
          note="full만 흐림 · lite부터 불투명 배경(알파 0.9 이상으로 글자 대비 유지)"
          surface="card"
          data-testid="tile-blur"
        >
          <div className="relative flex min-h-24 items-center justify-center overflow-hidden rounded-xl bg-[repeating-linear-gradient(45deg,var(--primary-bright)_0_8px,var(--accent-light)_8px_16px)]">
            <span className="rounded-xl bg-surface/60 px-4 py-2 text-small font-semibold backdrop-blur-md no-blur:bg-surface/90">
              흐림 유리판
            </span>
          </div>
        </Demo>
        <Demo
          label="큰 그림자 (.m-shadow)"
          note="full은 흐린 그림자 · lite부터 단색 오프셋 그림자"
          surface="card"
          data-testid="tile-shadow"
        >
          <div className="flex min-h-24 items-center justify-center rounded-xl bg-surface-2">
            <span className="m-shadow rounded-xl bg-surface px-4 py-2 text-small font-semibold shadow-pop">
              떠 있는 쪽지
            </span>
          </div>
        </Demo>
      </div>
      <p className="text-caption text-muted-foreground">
        일회성 연출(버튼 눌림·시트 등장·카운트업·진행바 빛 띠·토스트)은 각
        컴포넌트 절에서, 마스코트 리그는 아래 &ldquo;마스코트 리그&rdquo;에서
        단계별로 확인합니다. 패럴랙스는 &ldquo;월드 지도&rdquo; 절에서 스크롤해
        보세요 (full만).
      </p>
    </Section>
  );
}
