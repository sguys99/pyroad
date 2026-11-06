'use client';

import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import type { PybaemState } from '@/components/characters/rig';
import { Button } from '@/components/ui/button';
import type { SkinId } from '@/lib/avatar/skins';
import { cn } from '@/lib/utils';
import { GuideMascot } from './GuideMascot';
import { StepDots } from './StepDots';
import { CodeScene, HintScene, MapScene, RewardScene } from './TutorialScenes';

/**
 * 30초 튜토리얼 (P3-11): 파이뱀이 네 장면으로 놀이 방법을 알려 준다. 온보딩 도장 뒤 쪽 넘김으로 이어지고,
 * 설정 화면 "튜토리얼 다시 보기"(`/onboarding/tutorial`)에서도 연다.
 * 언제든 "건너뛰기"(→ `onSkip`), 마지막 "모험 시작!"(→ `onDone`). ←·→ 키로도 넘긴다(입력칸이 없으므로).
 * 내용은 `TUTORIAL_PANELS` 한 곳 — 문구를 고칠 때는 여기만.
 */
export interface TutorialPanel {
  id: 'map' | 'code' | 'hint' | 'reward';
  /** 진행 점 이름 */
  label: string;
  title: string;
  line: string;
  mascot: PybaemState;
}

export const TUTORIAL_PANELS: readonly TutorialPanel[] = [
  {
    id: 'map',
    label: '지도',
    title: '모험 지도에서 스테이지 고르기',
    line: '지도에서 반짝이는 곳을 누르면 그 스테이지의 퀘스트가 시작돼!',
    mascot: 'teach',
  },
  {
    id: 'code',
    label: '코드',
    title: '코드를 쓰고 ▶ 실행',
    line: '코드를 쓰고 실행을 누르면 컴퓨터가 그대로 해 줘. 결과 칸을 봐!',
    mascot: 'talk',
  },
  {
    id: 'hint',
    label: '힌트',
    title: '막히면 힌트와 질문',
    line: '막히면 힌트를 보거나 나한테 물어봐. 정답 대신 같이 생각해 줄게!',
    mascot: 'encourage',
  },
  {
    id: 'reward',
    label: '별·도장',
    title: '별과 도장 모으기',
    line: '퀘스트를 끝내면 별을 받고 도장이 쾅! 하나씩 모아 보자!',
    mascot: 'proud',
  },
];

export interface OnboardingTutorialProps {
  skin: SkinId;
  onDone: () => void;
  onSkip: () => void;
  /** 나가는 중 (버튼 바쁨) */
  leaving?: boolean;
  className?: string;
}

export const OnboardingTutorial = forwardRef<
  HTMLElement,
  OnboardingTutorialProps
>(function OnboardingTutorial(
  { skin, onDone, onSkip, leaving, className },
  ref,
) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const panel = TUTORIAL_PANELS[index];
  const last = index === TUTORIAL_PANELS.length - 1;

  useEffect(() => {
    // 처음은 부르는 쪽(쪽 넘김)이 포커스를 정함. 넘길 때마다 제목으로 (낭독기가 새 장면을 읽음)
    if (first.current) {
      first.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
  }, [index]);

  const go = (next: number) =>
    setIndex(Math.max(0, Math.min(TUTORIAL_PANELS.length - 1, next)));

  return (
    <section
      ref={ref}
      className={cn('ob-tut', className)}
      aria-labelledby={titleId}
      data-testid="onboarding-tutorial"
      data-panel={panel.id}
      onKeyDown={(e) => {
        if (
          e.target instanceof HTMLElement &&
          e.target.closest('a,button') &&
          (e.key === 'Enter' || e.key === ' ')
        )
          return;
        if (e.key === 'ArrowRight' && !last) go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
    >
      <header className="ob-tut-top">
        <p className="text-kicker text-primary-text">30초 튜토리얼</p>
        <StepDots
          labels={TUTORIAL_PANELS.map((p) => p.label)}
          current={index}
          label="튜토리얼 장면"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          disabled={leaving}
          data-testid="tutorial-skip"
        >
          건너뛰기
        </Button>
      </header>

      <div className="ob-tut-stage" key={panel.id}>
        {panel.id === 'map' && <MapScene />}
        {panel.id === 'code' && <CodeScene />}
        {panel.id === 'hint' && <HintScene skin={skin} />}
        {panel.id === 'reward' && <RewardScene />}
      </div>

      <h2
        id={titleId}
        ref={titleRef}
        tabIndex={-1}
        className="ob-tut-title font-display"
      >
        <span className="ob-tut-num">{index + 1}</span>
        {panel.title}
      </h2>

      <GuideMascot line={panel.line} state={panel.mascot} skin={skin} />

      <div className="ob-tut-actions">
        {index > 0 ? (
          <Button
            variant="secondary"
            onClick={() => go(index - 1)}
            icon={<ArrowLeft aria-hidden />}
            data-testid="tutorial-prev"
          >
            이전
          </Button>
        ) : (
          <span />
        )}
        {last ? (
          <Button
            size="lg"
            onClick={onDone}
            loading={leaving}
            iconRight={<Rocket aria-hidden />}
            data-testid="tutorial-done"
          >
            모험 시작!
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => go(index + 1)}
            iconRight={<ArrowRight aria-hidden />}
            data-testid="tutorial-next"
          >
            다음
          </Button>
        )}
      </div>
    </section>
  );
});
