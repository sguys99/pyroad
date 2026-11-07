'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Rocket, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuideMascot } from '@/components/onboarding/GuideMascot';
import { OnboardingStamp } from '@/components/onboarding/OnboardingStamp';
import { useSfx } from '@/components/providers/soundContext';
import type { SkinId } from '@/lib/avatar/skins';
import { stampConfetti, stampSlam } from '@/lib/celebration/onboardingFx';
import {
  GUARDIAN_AGREEMENT_ITEMS,
  emptyAgreementState,
  hasRequiredAgreements,
  toAgreementRecords,
  type AgreementState,
  type GuardianAgreementId,
  type GuardianRelation,
} from '@/lib/legal/agreements';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';
import {
  GUARDIAN_CONSENT_ENDPOINT,
  ONBOARDING_SERVER_ERROR_MESSAGE,
  type GuardianConsentResponse,
} from '@/lib/onboarding/api';
import { GuardianConsentPanel } from './GuardianConsentPanel';

/**
 * 나중에 보호자 동의 화면 (P3-15). 온보딩 보호자 단계와 같은 판 + 끝나면 금색 "동의" 도장 쾅(온보딩 도장과 같은 연출·건너뛰기).
 * 끝나면 제한 모드가 풀려 게시판 글쓰기를 할 수 있다는 것을 아이 말로 알려 준다.
 */
export function GuardianConsentFlow({
  skin,
  nickname,
  daysLeft,
}: {
  skin: SkinId;
  nickname: string | null;
  daysLeft: number | null;
}) {
  const router = useRouter();
  const { budget } = useMotionTier();
  const play = useSfx();
  const [state, setState] = useState<AgreementState<GuardianAgreementId>>(() =>
    emptyAgreementState(GUARDIAN_AGREEMENT_ITEMS),
  );
  const [relation, setRelation] = useState<GuardianRelation | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const stampRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fx = useRef<ReturnType<typeof stampSlam> | null>(null);
  const all = hasRequiredAgreements(GUARDIAN_AGREEMENT_ITEMS, state);

  useLayoutEffect(() => {
    if (!done) return;
    titleRef.current?.focus({ preventScroll: true });
    fx.current = stampSlam(stampRef.current, {
      budget,
      paper: boxRef.current,
      onImpact: () => {
        play('tap');
        stampConfetti(stampRef.current, budget);
      },
    });
    return () => fx.current?.finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const submit = async () => {
    setTried(true);
    if (!all || saving) return;
    setSaving(true);
    setError(null);
    let data: GuardianConsentResponse | null = null;
    try {
      const res = await fetch(GUARDIAN_CONSENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreements: toAgreementRecords(GUARDIAN_AGREEMENT_ITEMS, state),
          relation,
        }),
      });
      data = (await res
        .json()
        .catch(() => null)) as GuardianConsentResponse | null;
    } catch {
      data = null;
    }
    setSaving(false);
    if (data?.ok) {
      setDone(true);
      window.scrollTo({ top: 0 });
      return;
    }
    setError(data && !data.ok ? data.message : ONBOARDING_SERVER_ERROR_MESSAGE);
  };

  const name = nickname ?? '친구';

  if (done) {
    return (
      <div
        className="ob-page"
        data-testid="guardian-done"
        onPointerDownCapture={() => fx.current?.finish()}
      >
        <div className="ob-finale cs-done">
          <GuideMascot
            line={`보호자님, 고맙습니다! ${name}, 이제 게시판에도 글을 쓸 수 있어!`}
            state="happy"
            skin={skin}
            size="lg"
          />
          <div ref={boxRef} className="cs-done-card">
            <div className="ob-card-head">
              <div className="min-w-0 flex-1">
                <p className="text-kicker text-primary-text">보호자 동의</p>
                <h1
                  ref={titleRef}
                  tabIndex={-1}
                  className="ob-title font-display"
                >
                  동의를 마쳤어요!
                </h1>
              </div>
              <OnboardingStamp ref={stampRef} stamped text="동의" size="lg" />
            </div>
            <p className="ob-desc">
              이제 게시판에 글과 댓글을 쓸 수 있어요. 동의 기록은 언제든
              보호자님이 열람·철회를 요청할 수 있어요.
            </p>
          </div>
          <div className="ob-actions">
            <Button
              size="lg"
              className="ob-primary"
              iconRight={<Rocket aria-hidden />}
              onClick={() => router.replace('/world')}
              data-testid="guardian-done-cta"
            >
              모험 계속하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-page" data-testid="guardian-consent">
      <div className="ob-sheet">
        <header className="ob-top">
          <Button
            variant="ghost"
            size="sm"
            icon={<ArrowLeft aria-hidden />}
            onClick={() => router.back()}
            data-testid="guardian-back"
          >
            돌아가기
          </Button>
          <span />
          <span className="ob-top-spacer" />
        </header>
        <div className="ob-main cs-guardian-page">
          <GuideMascot
            line={
              all
                ? '보호자님, 고맙습니다! 아래 버튼을 눌러 주세요.'
                : '옆에 계신 보호자님께 화면을 보여 드려! 보호자님이 읽고 체크해 주실 거야.'
            }
            state={all ? 'happy' : 'wave'}
            skin={skin}
          />
          <section className="ob-panel" aria-labelledby="guardian-title">
            <h1 id="guardian-title" className="ob-title font-display">
              <ShieldCheck aria-hidden className="cs-title-icon" />
              보호자 동의
            </h1>
            {daysLeft !== null && (
              <p
                className="ob-desc"
                data-warn={daysLeft <= 7 || undefined}
                data-testid="guardian-days"
              >
                {daysLeft === 0
                  ? '오늘까지 동의하지 않으면 계정과 학습 기록이 지워져요.'
                  : `${daysLeft}일 안에 동의하지 않으면 계정과 학습 기록이 지워져요.`}
              </p>
            )}
            <GuardianConsentPanel
              value={state}
              onChange={setState}
              relation={relation}
              onRelation={setRelation}
              showRequiredError={tried}
            />
          </section>
          <div className="ob-actions">
            {error && (
              <p role="alert" className="ob-save-error">
                {error}
              </p>
            )}
            <Button
              size="lg"
              className="ob-primary"
              loading={saving}
              onClick={submit}
              data-testid="guardian-submit"
            >
              보호자로서 동의합니다
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
