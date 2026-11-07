'use client';

import { HeartHandshake, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConsentStatus } from './ConsentProvider';
import { GUARDIAN_CONSENT_HREF } from './RestrictedNotice';

/**
 * 설정 화면 "보호자 동의" 칸 (P3-15). 로그인 레이아웃의 `ConsentProvider` 값을 읽는다.
 * - 동의 필요(제한 모드): 남은 날 + [보호자 동의하기]
 * - 만 14세 이상이거나 동의 마침: 한 줄로 "필요 없어요 / 마쳤어요"
 * - 모름(null): 아무것도 그리지 않음
 * 설정 화면(`src/app/(protected)/settings/page.tsx`)의 "움직임"·"소리" 절 아래쯤에 `<GuardianConsentStatus />`로 놓는다.
 */
export function GuardianConsentStatus() {
  const status = useConsentStatus();
  if (!status) return null;
  return (
    <section
      className="cs-status"
      aria-labelledby="guardian-status-title"
      data-testid="guardian-status"
      data-state={status.state}
    >
      <span className="cs-status-icon" aria-hidden>
        {status.state === 'ok' ? <ShieldCheck /> : <HeartHandshake />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="guardian-status-title" className="cs-status-title">
          보호자 동의
        </h2>
        <p className="cs-status-body">
          {status.state === 'ok'
            ? '모든 기능을 쓸 수 있어요.'
            : status.daysLeft !== null
              ? `아직 동의 전이에요. ${status.daysLeft}일 안에 보호자와 함께 동의해 주세요.`
              : '아직 동의 전이에요. 보호자와 함께 동의해 주세요.'}
        </p>
      </div>
      {status.state === 'pending' && (
        <Button href={GUARDIAN_CONSENT_HREF} variant="reward" size="sm">
          보호자 동의하기
        </Button>
      )}
    </section>
  );
}
