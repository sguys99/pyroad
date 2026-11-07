'use client';

import { useState } from 'react';
import { AgeCheck } from '@/components/onboarding/AgeCheck';
import { ConsentBanner } from '@/components/consent/ConsentBanner';
import { ConsentProvider } from '@/components/consent/ConsentProvider';
import { GuardianConsentPanel } from '@/components/consent/GuardianConsentPanel';
import { GuardianConsentStatus } from '@/components/consent/GuardianConsentStatus';
import { RestrictedNotice } from '@/components/consent/RestrictedNotice';
import type { AgeAnswer } from '@/lib/consent/age';
import type { ConsentStatus } from '@/lib/consent/status';
import {
  GUARDIAN_AGREEMENT_ITEMS,
  emptyAgreementState,
  type AgreementState,
  type GuardianAgreementId,
  type GuardianRelation,
} from '@/lib/legal/agreements';
import { CodeSample, Demo, Section } from './ui';

const QUIET: ConsentStatus = {
  state: 'pending',
  deadline: '2026-12-06T00:00:00Z',
  daysLeft: 30,
  warn: false,
};
const WARN: ConsentStatus = { ...QUIET, daysLeft: 6, warn: true };
const LAST: ConsentStatus = { ...QUIET, daysLeft: 0, warn: true };
const OK: ConsentStatus = { state: 'ok' };

/** 만 14세 미만 법정대리인 동의·제한 모드 (P3-15, components.md §13) */
export function ConsentSection() {
  return (
    <Section
      id="consent"
      kicker="온보딩 (P3-15)"
      title="나이 확인 · 보호자 동의 · 제한 모드"
      description="만 14세 미만이면 보호자가 아이 옆에서 동의(Q35). 동의 전에는 학습만(게시판 글·댓글은 서버가 403, 신고는 받음), 30일 안에 동의가 없으면 파기(Q36). 경고는 금색(빨간색 아님), 움직임 없음."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <AgeDemo
          label="나이 확인: 처음 / 해를 고름"
          initial={{}}
        />
        <AgeDemo
          label="경계 해(올해-14) → 달 → 이번 달이면 생일"
          initial={{ year: new Date().getFullYear() - 14 }}
        />
        <GuardianDemo />
        <div className="space-y-4">
          <Demo label="게시판 글쓰기 자리 (제한 모드)">
            <ConsentProvider status={QUIET}>
              <RestrictedNotice />
            </ConsentProvider>
          </Demo>
          <Demo label="7일 이하 남음 + 댓글 자리(compact)">
            <ConsentProvider status={WARN}>
              <div className="space-y-3">
                <RestrictedNotice />
                <RestrictedNotice what="댓글을 달려면" compact />
              </div>
            </ConsentProvider>
          </Demo>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-caption font-semibold">
          맨 위 띠: 조용한 안내(월드맵·게시판·프로필) · D-6 경고 · 오늘까지
        </p>
        {[QUIET, WARN, LAST].map((s, i) => (
          <div key={i} className="overflow-hidden rounded-xl ring-1 ring-border">
            <ConsentProvider status={s}>
              <ConsentBanner force />
            </ConsentProvider>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="설정 칸: 동의 전 (설정 화면에 놓을 조각)">
          <ConsentProvider status={WARN}>
            <GuardianConsentStatus />
          </ConsentProvider>
        </Demo>
        <Demo label="설정 칸: 마침·만 14세 이상">
          <ConsentProvider status={OK}>
            <GuardianConsentStatus />
          </ConsentProvider>
        </Demo>
      </div>
      <CodeSample
        code={`// 서버: 게시판 쓰기 API
const block = await guardianWriteGate(user.id); if (block) return block;   // 403 { code: 'guardian_consent' }
// 화면: 로그인 레이아웃이 ConsentProvider 로 넘김
const restricted = useRestricted();  if (restricted) return <RestrictedNotice />;
// 설정 화면: <GuardianConsentStatus />`}
      />
    </Section>
  );
}

function AgeDemo({
  label,
  initial,
}: {
  label: string;
  initial: Partial<AgeAnswer>;
}) {
  const [value, setValue] = useState<Partial<AgeAnswer>>(initial);
  return (
    <Demo label={label} surface="card">
      <AgeCheck value={value} onChange={setValue} />
    </Demo>
  );
}

function GuardianDemo() {
  const [state, setState] = useState<AgreementState<GuardianAgreementId>>(
    () => emptyAgreementState(GUARDIAN_AGREEMENT_ITEMS),
  );
  const [relation, setRelation] = useState<GuardianRelation | null>(null);
  return (
    <Demo label="보호자 동의 판 (어른에게 말하는 부분)" surface="card">
      <GuardianConsentPanel
        value={state}
        onChange={setState}
        relation={relation}
        onRelation={setRelation}
      />
    </Demo>
  );
}
