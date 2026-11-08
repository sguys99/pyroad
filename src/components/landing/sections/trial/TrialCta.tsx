'use client';

import { ArrowRight } from 'lucide-react';
import { LoginSheetButton } from '@/components/auth/LoginSheetButton';

/**
 * 30초 체험 첫 성공 뒤 로그인 카드 (P4-03). 누르면 로그인 시트가 "모험을 저장하려면 로그인!" 머리말로 열리고,
 * provider를 고를 때 `landing_cta_click { cta: 'trial' }`이 간다 (시트가 보냄, P1-17).
 * 나타날 때 한 번 톡 올라온다 (trial.css, 단계 따름). 서버 HTML에는 없다 (성공한 뒤에만).
 */
export function TrialCta() {
  return (
    <div className="ld-trial-cta" data-testid="trial-cta">
      <p className="ld-trial-cta-t font-display">모험을 저장하려면 로그인!</p>
      <p className="ld-trial-cta-d">
        퀘스트를 깰 때마다 섬 지도에 새 길이 열려요.
      </p>
      <LoginSheetButton
        cta="trial"
        context="trial"
        iconRight={<ArrowRight aria-hidden />}
      >
        모험 시작!
      </LoginSheetButton>
    </div>
  );
}
