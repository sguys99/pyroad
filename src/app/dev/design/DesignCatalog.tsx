'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MotionTierProvider,
  useMotionTier,
  useSamplingPause,
} from '@/lib/motion/MotionTierProvider';
import { applyMotionAttributes } from '@/lib/motion/browser';
import {
  resolveReduced,
  type MotionTier,
  type ReducedMotionSetting,
} from '@/lib/motion/tier';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MotionTierSection } from './_catalog/MotionTierSection';
import {
  ColorSection,
  MotionTokenSection,
  ShapeSection,
  TypeSection,
  WorldSection,
} from './_catalog/TokenSections';
import {
  ButtonSection,
  CardSection,
  AlertDialogSection,
  SheetSection,
  ToastSection,
  TabsSection,
} from './_catalog/ComponentSections';
import {
  BubbleSection,
  HudSection,
  ProgressSection,
  RewardSection,
  TooltipSection,
} from './_catalog/FeedbackSections';
import { RigSection } from './_catalog/RigSection';
import { SocialLoginSection } from './_catalog/AuthSections';
import {
  EditorSection,
  ShareCardSection,
  SoundSection,
} from './_catalog/ExtraSections';
import { LegalSection } from './_catalog/LegalSection';
import { OnboardingSection } from './_catalog/OnboardingSection';
import { ConsentSection } from './_catalog/ConsentSection';
import { PwaSection } from './_catalog/PwaSection';
import { WorldMapSection } from './_catalog/WorldMapSection';

export type TierChoice = 'auto' | MotionTier;
export type ReducedChoice = ReducedMotionSetting;

const TIER_OPTIONS: { value: TierChoice; label: string }[] = [
  { value: 'auto', label: '자동' },
  { value: 'full', label: 'full' },
  { value: 'lite', label: 'lite' },
  { value: 'minimal', label: 'minimal' },
];
const REDUCED_OPTIONS: { value: ReducedChoice; label: string }[] = [
  { value: 'system', label: '기기 설정' },
  { value: 'on', label: '켜기' },
  { value: 'off', label: '끄기' },
];

const TOC: { group: string; items: [id: string, label: string][] }[] = [
  { group: '연출', items: [['motion', '연출 단계 견본']] },
  {
    group: '토큰',
    items: [
      ['colors', '색'],
      ['type', '글자'],
      ['shape', '반경·그림자·간격·선'],
      ['worlds', '월드 테마'],
      ['world-map', '월드 지도'],
      ['motion-tokens', '모션 토큰'],
    ],
  },
  {
    group: '컴포넌트',
    items: [
      ['buttons', '게임 버튼'],
      ['cards', '카드'],
      ['alert-dialog', '확인 모달'],
      ['sheet', '바텀시트·모달'],
      ['toast', '토스트'],
      ['tabs', '세그먼트 탭'],
      ['progress', '진행바'],
      ['hud', '재화 HUD'],
      ['bubble', '말풍선'],
      ['reward', '보상 아이콘'],
      ['tooltip', '툴팁'],
      ['social-login', '소셜 로그인'],
    ],
  },
  { group: '캐릭터', items: [['rig', '마스코트 리그']] },
  {
    group: '기타',
    items: [
      ['editor', '코드 에디터'],
      ['share-card', '공유 카드'],
      ['sound', '효과음'],
      ['legal', '약관 동의'],
      ['onboarding', '온보딩·튜토리얼'],
      ['consent', '보호자 동의'],
      ['pwa', '앱 아이콘·홈 화면'],
    ],
  },
];

/**
 * 카탈로그 본체 (P2-12). 위 막대에서 고른 연출 단계는 **이 화면에만** 적용한다(설정 API·기기 저장소에 쓰지 않음):
 * - JS 연출: 고정 모드 `MotionTierProvider`(`tier`·`reduced`) → 안쪽 `useMotionTier().budget`·Framer `MotionConfig`
 * - CSS 연출: `<html data-motion data-reduced>`를 직접 덮어쓴다. 루트 Provider가 다시 쓰면(감지 결과·기기 설정 변경)
 *   MutationObserver로 곧바로 되돌리고, 실측 판정은 멈춘다(`useSamplingPause`). 화면을 떠나면 루트 값으로 되돌린다
 * 고른 값은 주소(`?motion=&reduced=`)에 남겨 새로고침해도 유지된다.
 */
export function DesignCatalog({
  initialTier,
  initialReduced,
}: {
  initialTier: TierChoice;
  initialReduced: ReducedChoice;
}) {
  const root = useMotionTier();
  const [tierChoice, setTierChoice] = useState<TierChoice>(initialTier);
  const [reducedChoice, setReducedChoice] =
    useState<ReducedChoice>(initialReduced);
  const override = tierChoice !== 'auto' || reducedChoice !== 'system';

  const tier: MotionTier = tierChoice === 'auto' ? root.tier : tierChoice;
  const reduced =
    reducedChoice === 'system'
      ? root.reduced
      : resolveReduced(reducedChoice, root.systemReduced);

  useSamplingPause(override);
  useHtmlMotionOverride(override, tier, reduced, root.tier, root.reduced);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (tierChoice === 'auto') url.searchParams.delete('motion');
    else url.searchParams.set('motion', tierChoice);
    if (reducedChoice === 'system') url.searchParams.delete('reduced');
    else url.searchParams.set('reduced', reducedChoice);
    window.history.replaceState(window.history.state, '', url);
  }, [tierChoice, reducedChoice]);

  return (
    <MotionTierProvider tier={tier} reduced={reduced ? 'on' : 'off'}>
      <TooltipProvider>
        <div className="min-h-dvh bg-background text-foreground">
          <MotionBar
            tierChoice={tierChoice}
            reducedChoice={reducedChoice}
            onTier={setTierChoice}
            onReduced={setReducedChoice}
            tier={tier}
            reduced={reduced}
            detected={root.detected}
            systemReduced={root.systemReduced}
          />
          <div className="mx-auto grid max-w-6xl gap-8 px-gutter py-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
            <header className="space-y-2 lg:col-span-2">
              <p className="text-kicker text-primary-text">
                P2-12 · 개발 전용 (운영에서는 열리지 않아요)
              </p>
              <h1 className="font-display text-h1">pyRoad 디자인 카탈로그</h1>
              <p className="max-w-3xl text-muted-foreground">
                토큰과 공통 컴포넌트, 마스코트를 한 화면에서 봅니다. 위 막대에서
                연출 단계와 동작 줄이기를 바꾸면 이 화면의 모든 연출이 그
                단계로 바뀌어요. 기준 문서는{' '}
                <code className="font-mono text-small">
                  docs/design/catalog.md
                </code>
                .
              </p>
            </header>
            <Toc />
            <div className="min-w-0 space-y-16">
              <MotionTierSection />
              <ColorSection />
              <TypeSection />
              <ShapeSection />
              <WorldSection />
              <WorldMapSection />
              <MotionTokenSection />
              <ButtonSection />
              <CardSection />
              <AlertDialogSection />
              <SheetSection />
              <ToastSection />
              <TabsSection />
              <ProgressSection />
              <HudSection />
              <BubbleSection />
              <RewardSection />
              <TooltipSection />
              <SocialLoginSection />
              <RigSection />
              <EditorSection />
              <ShareCardSection />
              <SoundSection />
              <LegalSection />
              <OnboardingSection />
              <ConsentSection />
              <PwaSection />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </MotionTierProvider>
  );
}

/** 덮어쓰는 동안 `<html>` 속성을 지키고, 끝나면(끄거나 화면을 떠나면) 루트 값으로 되돌린다 */
function useHtmlMotionOverride(
  active: boolean,
  tier: MotionTier,
  reduced: boolean,
  rootTier: MotionTier,
  rootReduced: boolean,
) {
  const rootRef = useRef({ tier: rootTier, reduced: rootReduced });
  rootRef.current = { tier: rootTier, reduced: rootReduced };

  useEffect(() => {
    if (!active) return;
    const apply = () => applyMotionAttributes(tier, reduced);
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-motion', 'data-reduced'],
    });
    return () => {
      mo.disconnect();
      applyMotionAttributes(rootRef.current.tier, rootRef.current.reduced);
    };
  }, [active, tier, reduced]);
}

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  testId,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testId: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="shrink-0 text-caption font-semibold text-on-secondary">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-full bg-on-secondary/10 p-1"
        data-testid={testId}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-10 rounded-full px-3 text-caption font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-secondary',
              value === o.value
                ? 'bg-surface text-foreground'
                : 'text-on-secondary hover:bg-on-secondary/15',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MotionBar({
  tierChoice,
  reducedChoice,
  onTier,
  onReduced,
  tier,
  reduced,
  detected,
  systemReduced,
}: {
  tierChoice: TierChoice;
  reducedChoice: ReducedChoice;
  onTier: (v: TierChoice) => void;
  onReduced: (v: ReducedChoice) => void;
  tier: MotionTier;
  reduced: boolean;
  detected: MotionTier;
  systemReduced: boolean;
}) {
  return (
    <div
      className="sticky top-0 z-40 bg-secondary text-on-secondary shadow-pop"
      data-testid="motion-bar"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-gutter py-2">
        <ChoiceGroup
          label="연출 단계"
          options={TIER_OPTIONS}
          value={tierChoice}
          onChange={onTier}
          testId="motion-tier-choice"
        />
        <ChoiceGroup
          label="동작 줄이기"
          options={REDUCED_OPTIONS}
          value={reducedChoice}
          onChange={onReduced}
          testId="motion-reduced-choice"
        />
        <p
          className="text-caption text-on-secondary/80"
          aria-live="polite"
          data-testid="motion-now"
        >
          지금: <b className="text-on-secondary">{tier}</b>
          {' · '}동작 줄이기 <b className="text-on-secondary">{reduced ? '켜짐' : '꺼짐'}</b>
          <span className="max-sm:hidden">
            {' '}
            (감지 {detected}, 기기 설정 {systemReduced ? '켜짐' : '꺼짐'})
          </span>
        </p>
      </div>
    </div>
  );
}

function Toc() {
  return (
    <nav
      aria-label="카탈로그 목차"
      className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto"
    >
      <ol className="flex flex-wrap gap-x-5 gap-y-3 lg:flex-col lg:gap-4">
        {TOC.map((g) => (
          <li key={g.group} className="min-w-0">
            <p className="text-kicker text-muted-foreground">{g.group}</p>
            <ul className="mt-1 flex flex-wrap gap-1 lg:flex-col lg:gap-0">
              {g.items.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="inline-flex min-h-10 items-center rounded-md px-2 text-small font-medium text-foreground hover:bg-surface-2 hover:text-primary-text lg:-ml-2"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </nav>
  );
}
