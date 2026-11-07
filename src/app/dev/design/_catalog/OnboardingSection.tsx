'use client';

import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GradePicker } from '@/components/onboarding/GradePicker';
import { GuideMascot } from '@/components/onboarding/GuideMascot';
import { NicknameField } from '@/components/onboarding/NicknameField';
import { OnboardingStamp } from '@/components/onboarding/OnboardingStamp';
import { RegistrationCard } from '@/components/onboarding/RegistrationCard';
import { SkinPicker } from '@/components/onboarding/SkinPicker';
import { StepDots } from '@/components/onboarding/StepDots';
import {
  CodeScene,
  HintScene,
  MapScene,
  RewardScene,
} from '@/components/onboarding/TutorialScenes';
import { TUTORIAL_PANELS } from '@/components/onboarding/OnboardingTutorial';
import type { NicknameStatus } from '@/components/onboarding/useNicknameCheck';
import type { SkinId } from '@/lib/avatar/skins';
import { stampConfetti, stampSlam } from '@/lib/celebration/onboardingFx';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import { buildOnboardingSteps } from '@/lib/onboarding/steps';
import { CodeSample, Demo, Section } from './ui';

const STEP_LABELS = buildOnboardingSteps().map((s) => s.label);
const ISSUED = '2026. 11. 6.';

const NICKNAME_STATES: { label: string; value: string; status: NicknameStatus }[] = [
  { label: '처음 (규칙 안내)', value: '용감한여우', status: { kind: 'idle' } },
  { label: '확인 중', value: '별빛코더', status: { kind: 'checking' } },
  { label: '쓸 수 있음', value: '별빛코더', status: { kind: 'ok', nickname: '별빛코더' } },
  {
    label: '글자 규칙 (금색, 빨간색 아님)',
    value: '파이 뱀',
    status: { kind: 'invalid', message: '띄어쓰기 없이 붙여서 써 주세요.' },
  },
  {
    label: '중복 + 숫자 붙인 추천',
    value: '코딩왕',
    status: {
      kind: 'taken',
      message: '이미 다른 친구가 쓰고 있어요. 숫자를 붙이거나 다른 이름을 골라 볼까요?',
      suggestion: '코딩왕07',
    },
  },
];

/** 첫 로그인 온보딩 "모험가 등록증"·30초 튜토리얼 (P3-11, components.md §13) */
export function OnboardingSection() {
  return (
    <Section
      id="onboarding"
      kicker="온보딩 (P3-11)"
      title="모험가 등록증 · 튜토리얼"
      description="첫 로그인 온보딩 조각들. 등록증은 단계마다 칸이 채워지고 마지막에 금색 도장이 찍혀요. 도장·쪽 넘김·주사위·색 칸 톡은 src/lib/celebration/onboardingFx.ts, 튜토리얼 장면은 onboarding.css 키프레임 — 위 막대의 연출 단계로 대체 동작을 확인하세요(minimal·동작 줄이기 = 끝 상태)."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="등록증: 빈 칸 → 이름 칸 강조" surface="bg">
          <RegistrationCard
            nickname=""
            skin="green"
            skinChosen={false}
            grade={undefined}
            focus="nickname"
            issuedOn={ISSUED}
          />
        </Demo>
        <Demo label="등록증: 이름·색 채움, 학년 칸 강조" surface="bg">
          <RegistrationCard
            nickname="별빛코더07"
            skin="violet"
            skinChosen
            grade={undefined}
            focus="grade"
            issuedOn={ISSUED}
          />
        </Demo>
        <Demo label="등록증: 10자 닉네임 · 학년 비밀 · 도장 찍힘" surface="bg">
          <RegistrationCard
            nickname="반짝이는우주인07"
            skin="sunny"
            skinChosen
            grade={null}
            stamped
            issuedOn={ISSUED}
          />
        </Demo>
        <Demo label="좁은 화면 위 띠 (빈 이름 · 찍힘)" surface="bg">
          <div className="space-y-3">
            <RegistrationCard
              variant="compact"
              nickname=""
              skin="green"
              skinChosen={false}
              grade={undefined}
              issuedOn={ISSUED}
            />
            <RegistrationCard
              variant="compact"
              nickname="딸기코더"
              skin="berry"
              skinChosen
              grade={2}
              stamped
              issuedOn={ISSUED}
            />
          </div>
        </Demo>
        <StampDemo />
        <Demo label="진행 점 (마지막 = 금색 도장 칸)">
          <div className="space-y-3">
            {STEP_LABELS.map((_, i) => (
              <StepDots key={i} labels={STEP_LABELS} current={i} goldLast />
            ))}
          </div>
        </Demo>
        <SkinDemo />
        <GradeDemo />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {NICKNAME_STATES.map((s) => (
          <Demo key={s.label} label={`닉네임: ${s.label}`} surface="card">
            <NicknameField
              value={s.value}
              onChange={() => {}}
              status={s.status}
              onCompositionChange={() => {}}
              onRoll={() => {}}
              onUseSuggestion={() => {}}
            />
          </Demo>
        ))}
      </div>

      <TutorialDemo />
      <CodeSample
        code={`<RegistrationCard nickname={name} skin={skin} skinChosen grade={grade} stamped stampRef={stampRef} ref={cardRef} issuedOn={issuedOn} />
useLayoutEffect(() => { const fx = stampSlam(stampRef.current, { budget, paper: cardRef.current, onImpact }); return () => fx.finish(); }, []);
<SkinPicker value={skin} onChange={setSkin} aria-labelledby={titleId} />   // ←→↑↓·Home·End
<GuideMascot line="안녕! 나는 파이뱀이야." state="wave" skin={skin} />`}
      />
    </Section>
  );
}

function StampDemo() {
  const { budget } = useMotionTier();
  const stamp = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const [n, setN] = useState(0);
  const replay = () => {
    setN((v) => v + 1);
    requestAnimationFrame(() =>
      stampSlam(stamp.current, {
        budget,
        paper: card.current,
        onImpact: () => stampConfetti(stamp.current, budget),
      }),
    );
  };
  return (
    <Demo
      label="도장: 빈 자리 · 찍힘 md · lg"
      note="다시 찍기 = 실제 연출 (full 2.3배 → 쾅 + 떨림 + 금색 방울 + 컨페티, lite 짧게, minimal 페이드, 동작 줄이기 즉시)"
      surface="card"
      data-testid="onboarding-stamp-demo"
    >
      <div ref={card} className="flex flex-wrap items-center gap-6">
        <OnboardingStamp stamped={false} />
        <OnboardingStamp stamped />
        <span className="relative inline-flex" key={n}>
          <OnboardingStamp ref={stamp} stamped size="lg" />
        </span>
        <Button
          variant="secondary"
          size="sm"
          sfx={false}
          icon={<RotateCcw aria-hidden />}
          onClick={replay}
        >
          다시 찍기
        </Button>
      </div>
    </Demo>
  );
}

function SkinDemo() {
  const [skin, setSkin] = useState<SkinId | null>(null);
  return (
    <Demo label="파이뱀 색 고르기 + 안내 파이뱀 (고른 색으로)" surface="card">
      <div className="space-y-3">
        <GuideMascot
          line={skin ? '이 색 정말 마음에 들어!' : '마음에 드는 색을 골라 줘!'}
          state={skin ? 'happy' : 'idle'}
          skin={skin ?? 'green'}
        />
        <p id="catalog-skin-label" className="sr-only">
          파이뱀 색
        </p>
        <SkinPicker value={skin} onChange={setSkin} aria-labelledby="catalog-skin-label" />
      </div>
    </Demo>
  );
}

function GradeDemo() {
  const [grade, setGrade] = useState<number | null>(3);
  return (
    <Demo label="학년 칩 (선택)" surface="card">
      <p id="catalog-grade-label" className="sr-only">
        학년
      </p>
      <GradePicker value={grade} onChange={setGrade} aria-labelledby="catalog-grade-label" />
    </Demo>
  );
}

function TutorialDemo() {
  const [n, setN] = useState(0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold">튜토리얼 장면 4종 (Pyodide 없이 흉내)</p>
        <Button
          variant="secondary"
          size="sm"
          sfx={false}
          icon={<RotateCcw aria-hidden />}
          onClick={() => setN((v) => v + 1)}
        >
          다시 재생
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2" key={n}>
        {TUTORIAL_PANELS.map((p) => (
          <Demo key={p.id} label={`${p.title}`} note={p.line}>
            <div className="ob-tut-stage">
              {p.id === 'map' && <MapScene />}
              {p.id === 'code' && <CodeScene />}
              {p.id === 'hint' && <HintScene skin="sky" />}
              {p.id === 'reward' && <RewardScene />}
            </div>
          </Demo>
        ))}
      </div>
    </div>
  );
}
