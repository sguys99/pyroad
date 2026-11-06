'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { twinkle } from '@/components/characters/motionClasses';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  sameMotionSettings,
  type MotionSettings,
  type MotionTier,
  type MotionTierSetting,
  type ReducedMotionSetting,
} from '@/lib/motion/tier';
import { cn } from '@/lib/utils';

/**
 * 설정 화면 "움직임" (P2-15, §12-Q26: 아이 설정 화면에 쉬운 말로 노출).
 *
 * 고르면 바로 적용되고(연출 단계 Provider + 기기 사본) 서버 `users.settings.motion`에 저장한다 (`PATCH /api/settings`).
 * 저장이 실패해도 이 기기에서는 바뀐 채로 둔다. 미리 보기는 `<html data-motion data-reduced>`를 따르는 CSS 연출이라
 * 고르는 즉시 달라지는 것을 볼 수 있다.
 */

const TIER_NAMES: Record<MotionTier, string> = {
  full: '풍성하게',
  lite: '가볍게',
  minimal: '최소로',
};

const TIER_OPTIONS: Array<{
  value: MotionTierSetting;
  title: string;
  description: string;
}> = [
  {
    value: 'auto',
    title: '자동 (추천)',
    description: '기기에 맞춰 알아서 골라요.',
  },
  {
    value: 'full',
    title: TIER_NAMES.full,
    description: '반짝이와 배경 움직임까지 모두 보여 줘요.',
  },
  {
    value: 'lite',
    title: TIER_NAMES.lite,
    description: '반짝이는 조금만, 배경은 멈춰서 부드럽게 보여 줘요.',
  },
  {
    value: 'minimal',
    title: TIER_NAMES.minimal,
    description: '꼭 필요한 움직임만 보여 줘요. 느린 기기에서도 빨라요.',
  },
];

const REDUCED_OPTIONS: Array<{
  value: ReducedMotionSetting;
  title: string;
  description: string;
}> = [
  {
    value: 'system',
    title: '기기 설정 따르기',
    description: '기기의 "동작 줄이기" 설정대로 해요.',
  },
  {
    value: 'on',
    title: '켜기',
    description: '화면이 움직이지 않아요. 색과 글자로 알려 줘요.',
  },
  {
    value: 'off',
    title: '끄기',
    description: '기기 설정과 상관없이 움직임을 보여 줘요.',
  },
];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface OptionGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: Array<{ value: T; title: string; description: string }>;
  onChange: (value: T) => void;
  testId: string;
}

function OptionGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  testId,
}: OptionGroupProps<T>) {
  return (
    <fieldset data-testid={testId}>
      <legend className="mb-2 text-[17px] font-bold text-foreground">
        {legend}
      </legend>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
                checked
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/50',
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {/* 고른 표시: 색만이 아니라 채운 점 모양으로도 (색각 이상 대비) */}
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                  checked ? 'border-primary' : 'border-muted-foreground',
                )}
              >
                {checked && (
                  <span className="h-3 w-3 rounded-full bg-primary" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-snug text-foreground">
                  {option.title}
                </span>
                <span className="block text-base leading-snug text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** 고른 단계가 바로 보이는 작은 장면: 파이뱀 숨쉬기·깜빡임(대기 루프) + 반짝이(대기 루프) + 구름(앰비언트) */
function MotionPreview({ reduced }: { reduced: boolean }) {
  return (
    <div
      aria-hidden
      className="relative mb-4 flex h-28 items-end justify-center overflow-hidden rounded-xl border border-border bg-gradient-to-b from-w2-soft to-w1-soft"
    >
      <div
        className="float-cloud absolute left-4 top-3 h-4 w-12 rounded-full bg-card/90"
        style={{ '--ambient-dur': '9s' } as React.CSSProperties}
      />
      <div
        className="float-cloud absolute right-6 top-8 h-3 w-9 rounded-full bg-card/80"
        style={
          {
            '--ambient-dur': '12s',
            '--ambient-delay': '-4s',
          } as React.CSSProperties
        }
      />
      <svg
        className="absolute left-[22%] top-6 h-5 w-5"
        viewBox="0 0 20 20"
        fill="var(--accent)"
      >
        <polygon
          points="10,0 13,7 20,10 13,13 10,20 7,13 0,10 7,7"
          {...twinkle(1, 0.25, 1.4)}
        />
      </svg>
      <svg
        className="absolute right-[24%] top-3 h-4 w-4"
        viewBox="0 0 20 20"
        fill="var(--accent-lip)"
      >
        <polygon
          points="10,0 13,7 20,10 13,13 10,20 7,13 0,10 7,7"
          {...twinkle(0.3, 1, 1.8)}
        />
      </svg>
      <div className="mb-1">
        <CharacterAvatar
          character="pybaem"
          expression={reduced ? 'happy' : 'waving'}
          size={84}
          animated
        />
      </div>
    </div>
  );
}

export function MotionSettingsSection({
  serverMotion,
}: {
  /** `GET /api/settings`의 motion (다른 기기에서 바꾼 값 반영) */
  serverMotion?: MotionSettings | null;
}) {
  const {
    settings,
    setSettings,
    adoptSettings,
    remeasure,
    tier,
    detected,
    reduced,
    systemReduced,
  } = useMotionTier();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const touchedRef = useRef(false);
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupId = useId();

  // 서버 값은 아이가 아직 아무것도 고르지 않았을 때만 반영 (고른 값을 덮지 않게)
  useEffect(() => {
    if (serverMotion && !touchedRef.current) adoptSettings(serverMotion);
  }, [serverMotion, adoptSettings]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    [],
  );

  function update(next: MotionSettings) {
    if (sameMotionSettings(next, settings)) return;
    touchedRef.current = true;
    setSettings(next);
    setStatus('saving');
    // 빠르게 여러 번 눌러도 고른 순서대로 저장
    saveChainRef.current = saveChainRef.current.then(async () => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motion: next }),
      }).catch(() => null);
      setStatus(res?.ok ? 'saved' : 'error');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (res?.ok)
        savedTimerRef.current = setTimeout(() => setStatus('idle'), 2000);
    });
  }

  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className="mb-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      data-testid="motion-settings"
    >
      <h2
        id={`${groupId}-title`}
        className="mb-1 flex items-center gap-2 text-lg font-bold text-foreground"
      >
        <Sparkles aria-hidden className="h-5 w-5 text-accent-foreground" />
        움직임
      </h2>
      <p className="mb-3 text-base text-muted-foreground">
        화면이 얼마나 움직일지 골라요. 고르면 바로 바뀌어요.
      </p>

      <MotionPreview reduced={reduced} />

      <div className="flex flex-col gap-5">
        <div>
          <OptionGroup
            legend="움직임"
            name={`${groupId}-tier`}
            value={settings.tier}
            options={TIER_OPTIONS}
            onChange={(value) => update({ ...settings, tier: value })}
            testId="motion-tier-options"
          />
          {settings.tier === 'auto' && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p
                className="text-base text-foreground"
                data-testid="motion-auto-status"
              >
                지금 이 기기에서는 <strong>‘{TIER_NAMES[tier]}’</strong>로 보여
                주고 있어요.
              </p>
              {detected !== 'full' && (
                <button
                  type="button"
                  onClick={remeasure}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-base font-medium text-foreground underline underline-offset-4 hover:bg-muted"
                >
                  <RotateCcw aria-hidden className="h-4 w-4" />
                  다시 재 보기
                </button>
              )}
            </div>
          )}
        </div>

        <OptionGroup
          legend="동작 줄이기"
          name={`${groupId}-reduced`}
          value={settings.reduced}
          options={REDUCED_OPTIONS.map((option) =>
            option.value === 'system'
              ? {
                  ...option,
                  description: `${option.description} (지금 기기 설정: ${systemReduced ? '켜짐' : '꺼짐'})`,
                }
              : option,
          )}
          onChange={(value) => update({ ...settings, reduced: value })}
          testId="motion-reduced-options"
        />
        {reduced && (
          <p className="-mt-3 text-base text-foreground">
            동작 줄이기가 켜져 있어서 화면이 움직이지 않아요. 파이뱀은 눈만
            천천히 깜빡여요.
          </p>
        )}
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          'mt-3 min-h-6 text-base font-medium',
          status === 'error' ? 'text-destructive' : 'text-foreground',
        )}
      >
        {status === 'saving' && '저장하는 중…'}
        {status === 'saved' && '저장했어요!'}
        {status === 'error' &&
          '저장하지 못했어요. 이 기기에서만 바뀌었어요. 잠시 뒤 다시 골라 주세요.'}
      </p>
    </section>
  );
}
