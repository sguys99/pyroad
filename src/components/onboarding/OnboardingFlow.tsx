'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Rocket,
  Sparkles,
} from 'lucide-react';
import type { RigHandle } from '@/components/characters/rig/LiveRig';
import type { PybaemState } from '@/components/characters/rig';
import { AgreementChecklist } from '@/components/legal/AgreementChecklist';
import { Button, IconButton } from '@/components/ui/button';
import { useSfx } from '@/components/providers/soundContext';
import { getSkin, type SkinId } from '@/lib/avatar/skins';
import {
  diceRoll,
  diceRollFrames,
  pageTurnIn,
  pageTurnOut,
  stampConfetti,
  stampSlam,
  type FxHandle,
} from '@/lib/celebration/onboardingFx';
import {
  AGREEMENT_ITEMS,
  emptyAgreementState,
  hasRequiredAgreements,
  isAllAgreed,
  toAgreementRecords,
  type AgreementState,
} from '@/lib/legal/agreements';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  ONBOARDING_ENDPOINT,
  ONBOARDING_SERVER_ERROR_MESSAGE,
  type OnboardingRequest,
  type OnboardingResponse,
} from '@/lib/onboarding/api';
import {
  buildOnboardingSteps,
  isSubmitStep,
  nextStepId,
  prevStepId,
  stepIndex,
  type OnboardingStepId,
} from '@/lib/onboarding/steps';
import { checkNicknameRules } from '@/lib/profile/nicknameRules';
import { suggestNickname } from '@/lib/profile/nicknameSuggest';
import { cn } from '@/lib/utils';
import { GradePicker } from './GradePicker';
import { GuideMascot } from './GuideMascot';
import { NicknameField } from './NicknameField';
import { OnboardingTutorial } from './OnboardingTutorial';
import { RegistrationCard, type CardField } from './RegistrationCard';
import { SkinPicker } from './SkinPicker';
import { StepDots } from './StepDots';
import { useNicknameCheck } from './useNicknameCheck';
import {
  RETURNING_NEWS,
  RETURNING_NICKNAME_KEPT,
  RETURNING_NICKNAME_RENAME,
  stampLine,
  stepCopy,
} from './copy';
import type { OnboardingVariant } from '@/lib/onboarding/returning';

type AgreementId = (typeof AGREEMENT_ITEMS)[number]['id'];

export interface OnboardingFlowProps {
  /** 처음 입력칸 값: 이미 정한 닉네임(P3-12) → provider 제안(실명 가능성 없을 때) → 랜덤 추천. 서버가 정함 */
  initialNickname: string;
  /** 이미 고른 스킨 (없으면 null = 아직 안 고름) */
  initialSkin: SkinId | null;
  initialGrade: number | null;
  /** 등록증 발급일 (KST 표시 문자열) */
  issuedOn: string;
  /** 끝나고 갈 곳 */
  doneHref?: string;
  /** 새 사용자 · 기존 사용자(P3-12: 반가운 말, 튜토리얼은 고를 수 있게) */
  variant?: OnboardingVariant;
  /** 기존 사용자의 예전 닉네임: kept = 그대로 채움, rename = 새 규칙에 맞지 않아 새로 추천함 */
  previousNickname?: 'kept' | 'rename' | null;
  /** 기존 사용자의 지금 경험치 (도장 단계에서 "그대로예요" 안내) */
  totalXp?: number;
}

type Phase = 'form' | 'turning' | 'tutorial' | 'leaving';

const CARD_FOCUS: Partial<Record<OnboardingStepId, CardField>> = {
  nickname: 'nickname',
  skin: 'skin',
  grade: 'grade',
};

/**
 * 첫 로그인 온보딩 "모험가 등록증" (P3-11). 그림책 한 쪽 위에서 파이뱀이 한 단계씩 안내하고, 등록증 칸이 채워지다가
 * 마지막에 금색 도장이 쾅 찍힌 뒤 쪽을 넘겨 30초 튜토리얼로 간다.
 *
 * - 단계는 `buildOnboardingSteps()` 목록 하나 (`src/lib/onboarding/steps.ts`). 단계 추가 = 목록 한 줄 + 아래 `renderStep` 한 갈래
 *   + `canLeave` 조건. ▼ P3-15 나이 확인·보호자 동의는 `agree` 다음에 끼운다
 * - 저장은 마지막 입력 단계에서 한 번(`POST /api/onboarding`). 서버가 모든 값을 다시 검사하고, 닉네임이 그사이 쓰였으면(409)
 *   닉네임 단계로 돌아가 추천 이름을 보여 준다
 * - 연출: 도장·쪽 넘김·주사위는 `src/lib/celebration/onboardingFx.ts`(연출 단계·동작 줄이기 대체 포함). 도장 연출 중 화면 어디든
 *   누르거나 Enter·Space·Esc → 끝 상태로 (§12-Q28)
 * - 넓은 화면(1024px 이상)은 왼쪽 안내 + 오른쪽 등록증, 좁은 화면은 위에 등록증 띠
 */
export function OnboardingFlow({
  initialNickname,
  initialSkin,
  initialGrade,
  issuedOn,
  doneHref = '/world',
  variant = 'new',
  previousNickname = null,
  totalXp = 0,
}: OnboardingFlowProps) {
  const copy = stepCopy(variant);
  const returning = variant === 'returning';
  const router = useRouter();
  const { budget } = useMotionTier();
  const play = useSfx();
  const steps = useMemo(() => buildOnboardingSteps(), []);
  const [stepId, setStepId] = useState<OnboardingStepId>(steps[0].id);
  const [phase, setPhase] = useState<Phase>('form');

  // 1. 약속
  const [agreements, setAgreements] = useState<AgreementState<AgreementId>>(
    () => emptyAgreementState(AGREEMENT_ITEMS),
  );
  const [agreeTried, setAgreeTried] = useState(false);

  // 2. 닉네임
  const [nickname, setNickname] = useState(initialNickname);
  const [composing, setComposing] = useState(false);
  const [rolling, setRolling] = useState(false);
  const { status, markTaken, markInvalid } = useNicknameCheck(
    nickname,
    composing,
  );
  const diceRef = useRef<HTMLSpanElement>(null);
  const nicknameInputRef = useRef<HTMLInputElement>(null);
  const rollTimer = useRef<number | null>(null);

  // 3. 색 · 4. 학년
  const [skin, setSkin] = useState<SkinId | null>(initialSkin);
  const [grade, setGrade] = useState<number | null | undefined>(
    initialGrade ?? undefined,
  );

  // 저장
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 파이뱀 반응 (단계 기본 표정 위에 잠깐 얹음)
  const [reaction, setReaction] = useState<{
    state: PybaemState;
    line?: string;
  } | null>(null);
  const rigRef = useRef<RigHandle<PybaemState>>(null);

  // 도장
  const cardRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<FxHandle | null>(null);
  const [impacted, setImpacted] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const tutorialRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  const index = stepIndex(steps, stepId);
  const prev = prevStepId(steps, stepId);
  const text = copy[stepId];
  const shownSkin: SkinId = skin ?? getSkin(null).id;
  const nicknameRules = checkNicknameRules(nickname);
  const allAgreed = isAllAgreed(AGREEMENT_ITEMS, agreements);
  const canLeaveNickname =
    nicknameRules.ok &&
    !composing &&
    !rolling &&
    status.kind !== 'invalid' &&
    status.kind !== 'taken';

  // 단계가 바뀌면 반응을 지우고 제목으로 포커스 (낭독기가 새 단계를 읽음). 첫 화면은 그대로
  const firstRender = useRef(true);
  useEffect(() => {
    setReaction(null);
    setSaveError(null);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [stepId]);

  // 닉네임 상태 → 파이뱀 표정·대사
  useEffect(() => {
    if (stepId !== 'nickname') return;
    switch (status.kind) {
      case 'ok':
        setReaction({
          state: 'happy',
          line: `“${status.nickname}”! 정말 멋진 이름이야!`,
        });
        break;
      case 'invalid':
        setReaction({
          state: 'confused',
          line: '음, 조금만 고쳐 볼까? 아래 안내를 봐 줘.',
        });
        break;
      case 'taken':
        setReaction({
          state: 'surprised',
          line: '앗, 같은 이름의 친구가 벌써 있대! 다른 이름은 어때?',
        });
        break;
      case 'checking':
        setReaction((r) => (r ? { ...r, state: 'think' } : { state: 'think' }));
        break;
      default:
        setReaction(null);
    }
  }, [status, stepId]);

  useEffect(
    () => () => {
      if (rollTimer.current) window.clearInterval(rollTimer.current);
    },
    [],
  );

  // ── 도장: 단계에 들어서면 그리기 전에 연출을 건다 (첫 프레임부터 시작 모양) ──
  useLayoutEffect(() => {
    if (stepId !== 'stamp') return;
    setImpacted(false);
    const fx = stampSlam(stampRef.current, {
      budget,
      paper: cardRef.current,
      onImpact: () => {
        setImpacted(true);
        play('tap');
        stampConfetti(stampRef.current, budget);
      },
    });
    fxRef.current = fx;
    fx.done.then(() => {
      if (fxRef.current === fx) fxRef.current = null;
    });
    return () => fx.finish();
    // 연출 단계가 바뀌어도 다시 찍지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  const skipFx = useCallback(() => {
    if (!fxRef.current) return;
    fxRef.current.finish();
    fxRef.current = null;
  }, []);

  // ── 쪽 넘김 → 튜토리얼 ──
  useLayoutEffect(() => {
    if (phase !== 'tutorial') return;
    pageTurnIn(tutorialRef.current, budget);
    tutorialRef.current
      ?.querySelector<HTMLElement>('h2')
      ?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const goTutorial = () => {
    skipFx();
    setPhase('turning');
    pageTurnOut(sheetRef.current, budget).done.then(() => {
      window.scrollTo({ top: 0 });
      setPhase('tutorial');
    });
  };

  const [leavingForm, setLeavingForm] = useState(false);
  const leave = () => {
    if (phase === 'tutorial') setPhase('leaving');
    else {
      skipFx();
      setLeavingForm(true);
    }
    router.replace(doneHref);
  };

  // ── 이동 ──
  const goTo = (id: OnboardingStepId) => setStepId(id);
  const goNext = () => {
    const next = nextStepId(steps, stepId);
    if (next) goTo(next);
  };

  const submit = async (gradeValue: number | null) => {
    if (saving || !skin) return;
    setSaving(true);
    setSaveError(null);
    setReaction({ state: 'think', line: '등록증을 만드는 중이야… 잠깐만!' });
    const body: OnboardingRequest = {
      nickname,
      skin,
      grade: gradeValue,
      agreements: toAgreementRecords(AGREEMENT_ITEMS, agreements),
    };
    let data: OnboardingResponse | null = null;
    try {
      const res = await fetch(ONBOARDING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      data = (await res.json().catch(() => null)) as OnboardingResponse | null;
    } catch {
      data = null;
    }
    setSaving(false);
    if (data?.ok) {
      goTo('stamp');
      return;
    }
    setReaction(null);
    if (data && !data.ok) {
      switch (data.error) {
        case 'nickname_taken':
          markTaken(nickname, data.message, data.suggestion);
          goTo('nickname');
          return;
        case 'invalid_nickname':
          markInvalid(nickname, data.message);
          goTo('nickname');
          return;
        case 'agreements_required':
          setAgreeTried(true);
          goTo('agree');
          return;
        default:
          setSaveError(data.message);
          return;
      }
    }
    setSaveError(ONBOARDING_SERVER_ERROR_MESSAGE);
  };

  const primary = () => {
    switch (stepId) {
      case 'agree':
        setAgreeTried(true);
        if (hasRequiredAgreements(AGREEMENT_ITEMS, agreements)) goNext();
        return;
      case 'nickname':
        if (canLeaveNickname) goNext();
        else nicknameInputRef.current?.focus();
        return;
      case 'skin':
        if (!skin) return;
        if (isSubmitStep(steps, 'skin')) void submit(grade ?? null);
        else goNext();
        return;
      case 'grade':
        void submit(grade ?? null);
        return;
      case 'stamp':
        // 기존 사용자는 놀이 방법을 이미 알므로 바로 이어서 (튜토리얼은 옆 버튼, P3-12)
        if (returning) leave();
        else goTutorial();
        return;
    }
  };

  // ── 닉네임: 주사위 ──
  const stopRoll = () => {
    if (rollTimer.current) window.clearInterval(rollTimer.current);
    rollTimer.current = null;
    setRolling(false);
  };
  const roll = () => {
    stopRoll();
    const fresh = () => {
      let next = suggestNickname();
      for (let i = 0; i < 4 && next === nickname; i++) next = suggestNickname();
      return next;
    };
    diceRoll(diceRef.current, budget);
    const { frames, frameMs } = diceRollFrames(budget);
    if (frames === 0) {
      setNickname(fresh());
      return;
    }
    setRolling(true);
    let i = 0;
    rollTimer.current = window.setInterval(() => {
      i += 1;
      setNickname(fresh());
      if (i >= frames) {
        if (rollTimer.current) window.clearInterval(rollTimer.current);
        rollTimer.current = null;
        setRolling(false);
      }
    }, frameMs);
  };

  // ── 파이뱀 ──
  let mascotState: PybaemState = reaction?.state ?? text.mascot;
  let line = reaction?.line ?? text.line;
  if (stepId === 'agree' && allAgreed && !reaction) {
    mascotState = 'happy';
    line = '좋아, 약속 완료! 이제 이름을 정하러 가 볼까?';
  }
  if (stepId === 'nickname' && !reaction && returning && previousNickname) {
    line =
      previousNickname === 'kept'
        ? RETURNING_NICKNAME_KEPT
        : RETURNING_NICKNAME_RENAME;
  }
  if (stepId === 'stamp') {
    mascotState = impacted ? 'happy' : 'surprised';
    line = stampLine(
      variant,
      nicknameRules.ok ? nicknameRules.nickname : nickname,
    );
  }

  const onPickSkin = (next: SkinId) => {
    setSkin(next);
    setReaction({
      state: 'happy',
      line: `${getSkin(next).name}! 이 색 정말 마음에 들어!`,
    });
    // 이미 기쁨 상태면 점프를 처음부터 다시
    rigRef.current?.replay();
  };

  // ── 단계 내용 ──
  const renderStep = (): ReactNode => {
    switch (stepId) {
      case 'agree':
        return (
          <>
            {returning && (
              <p className="ob-news" data-testid="onboarding-news">
                <Sparkles aria-hidden className="ob-news-icon" />
                <span>{RETURNING_NEWS}</span>
              </p>
            )}
            <AgreementChecklist<AgreementId>
              value={agreements}
              onChange={setAgreements}
              showRequiredError={agreeTried}
            />
          </>
        );
      case 'nickname':
        return (
          <NicknameField
            value={nickname}
            onChange={(v) => {
              // 굴리는 중에 직접 쓰면 주사위를 멈춤 (쓴 글자를 덮어쓰지 않게)
              stopRoll();
              setNickname(v);
            }}
            status={status}
            onCompositionChange={setComposing}
            onRoll={roll}
            rolling={rolling}
            diceRef={diceRef}
            inputRef={nicknameInputRef}
            onUseSuggestion={(name) => {
              stopRoll();
              setNickname(name);
            }}
            onSubmit={primary}
          />
        );
      case 'skin':
        return (
          <SkinPicker
            value={skin}
            onChange={onPickSkin}
            aria-labelledby={titleId}
          />
        );
      case 'grade':
        return (
          <GradePicker
            value={grade ?? null}
            onChange={(g) => setGrade(g)}
            aria-labelledby={titleId}
          />
        );
      case 'stamp':
        return null;
    }
  };

  const primaryLabel: Record<OnboardingStepId, string> = {
    agree: '약속할게요',
    nickname: '이 이름으로 할래요',
    skin: isSubmitStep(steps, 'skin') ? '등록증 완성하기' : '이 색으로 할래요',
    grade: '등록증 완성하기',
    stamp: returning ? '이미 알아요, 이어서 모험!' : '모험 떠나기!',
  };
  const primaryDisabled =
    (stepId === 'nickname' && !canLeaveNickname) ||
    (stepId === 'skin' && !skin) ||
    (stepId === 'grade' && grade == null);

  const actions = (
    <div className="ob-actions">
      {saveError && (
        <p
          role="alert"
          className="ob-save-error"
          data-testid="onboarding-error"
        >
          {saveError}
        </p>
      )}
      {stepId === 'grade' && (
        <Button
          variant="ghost"
          onClick={() => {
            setGrade(null);
            void submit(null);
          }}
          disabled={saving}
          data-testid="grade-skip"
        >
          건너뛰기
        </Button>
      )}
      {stepId === 'stamp' && returning && (
        <Button
          variant="secondary"
          onClick={goTutorial}
          disabled={phase !== 'form' || leavingForm}
          icon={<BookOpen aria-hidden />}
          data-testid="onboarding-tutorial-offer"
        >
          30초 튜토리얼 볼래요
        </Button>
      )}
      <Button
        size="lg"
        onClick={primary}
        disabled={primaryDisabled || phase !== 'form'}
        loading={saving || leavingForm}
        iconRight={
          stepId === 'stamp' ? (
            <Rocket aria-hidden />
          ) : (
            <ArrowRight aria-hidden />
          )
        }
        className="ob-primary"
        data-testid="onboarding-next"
      >
        {primaryLabel[stepId]}
      </Button>
    </div>
  );

  // ── 튜토리얼 ──
  if (phase === 'tutorial' || phase === 'leaving') {
    return (
      <div className="ob-page" data-phase={phase}>
        <OnboardingTutorial
          ref={tutorialRef}
          skin={shownSkin}
          onDone={leave}
          onSkip={leave}
          leaving={phase === 'leaving'}
        />
      </div>
    );
  }

  const isStamp = stepId === 'stamp';
  return (
    <div
      className="ob-page"
      data-step={stepId}
      data-phase={phase}
      data-testid="onboarding"
      // 도장 연출 중 어디든 누르거나 Enter·Space·Esc → 끝 상태로 (§12-Q28)
      onPointerDownCapture={skipFx}
      onKeyDownCapture={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') skipFx();
      }}
    >
      <div ref={sheetRef} className="ob-sheet">
        <header className="ob-top">
          {prev ? (
            <IconButton
              label="이전 단계로"
              onClick={() => goTo(prev)}
              disabled={saving}
              data-testid="onboarding-back"
            >
              <ChevronLeft aria-hidden />
            </IconButton>
          ) : (
            <span className="ob-top-spacer" />
          )}
          <StepDots
            labels={steps.map((s) => s.label)}
            current={index}
            label="모험가 등록 단계"
            goldLast
          />
          <span className="ob-top-spacer" />
        </header>

        {isStamp ? (
          <div className="ob-finale" data-testid="onboarding-step-stamp">
            <GuideMascot
              ref={rigRef}
              line={line}
              state={mascotState}
              skin={shownSkin}
              size="lg"
              className="ob-finale-guide"
            />
            <h1
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
              className="ob-title font-display text-center"
            >
              {text.title}
            </h1>
            {returning && (
              <p className="ob-desc text-center" data-testid="onboarding-kept">
                {totalXp > 0
                  ? `지금까지 모은 경험치 ${totalXp.toLocaleString('ko-KR')} XP와 기록은 그대로예요.`
                  : text.desc}
              </p>
            )}
            <RegistrationCard
              ref={cardRef}
              stampRef={stampRef}
              nickname={nickname}
              skin={shownSkin}
              skinChosen
              grade={grade ?? null}
              stamped
              issuedOn={issuedOn}
              className="ob-finale-card"
            />
            {actions}
          </div>
        ) : (
          <div className="ob-layout">
            <div className="ob-main">
              <RegistrationCard
                variant="compact"
                nickname={nickname}
                skin={shownSkin}
                skinChosen={skin !== null}
                grade={grade}
                issuedOn={issuedOn}
                className="ob-compact-card"
              />
              <GuideMascot
                ref={rigRef}
                line={line}
                state={mascotState}
                skin={shownSkin}
              />
              <section
                className="ob-panel"
                aria-labelledby={titleId}
                data-surface="raised"
                data-testid={`onboarding-step-${stepId}`}
              >
                <h1
                  id={titleId}
                  ref={titleRef}
                  tabIndex={-1}
                  className="ob-title font-display"
                >
                  {text.title}
                  {stepId === 'grade' && (
                    <span className="ob-optional font-sans">선택</span>
                  )}
                </h1>
                <p className="ob-desc">{text.desc}</p>
                {renderStep()}
              </section>
              {actions}
            </div>
            <aside className="ob-aside" aria-label="모험가 등록증 미리 보기">
              <RegistrationCard
                nickname={nickname}
                skin={shownSkin}
                skinChosen={skin !== null}
                grade={grade}
                focus={CARD_FOCUS[stepId] ?? null}
                issuedOn={issuedOn}
                className={cn('ob-aside-card')}
              />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
