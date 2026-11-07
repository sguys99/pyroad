'use client';

import { useState } from 'react';
import { AgreementChecklist } from '@/components/legal/AgreementChecklist';
import { LegalNav } from '@/components/legal/LegalPageShell';
import { Button } from '@/components/ui/button';
import {
  AGREEMENT_ITEMS,
  emptyAgreementState,
  hasRequiredAgreements,
  setAllAgreements,
  toAgreementRecords,
  type AgreementState,
} from '@/lib/legal/agreements';
import { CodeSample, Demo, Section } from './ui';

type Id = (typeof AGREEMENT_ITEMS)[number]['id'];

/** 약관 동의 체크 목록 (P3-14). 온보딩(P3-11)·보호자 동의(P3-15)가 쓰는 상태들 */
export function LegalSection() {
  return (
    <Section
      id="legal"
      kicker="기타 (P3-14)"
      title="약관 동의"
      description="진짜 체크박스 + 라벨이라 Tab·Space로 고르고 스크린 리더가 읽어요. 일부만 고르면 '모두 동의'가 중간 상태가 되고, '보기'는 문서를 새 탭으로 열어요. 저장은 부르는 쪽이 toAgreementRecords()로 합니다(이 컴포넌트는 DB에 쓰지 않음)."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Demo label="처음 (아무것도 안 고름)" surface="card" data-testid="legal-empty">
          <AgreementChecklist />
        </Demo>
        <Demo label="일부만 (모두 동의 = 중간 상태)" surface="card">
          <AgreementChecklist defaultValue={{ terms: true, privacy: false }} />
        </Demo>
        <Demo label="모두 동의" surface="card">
          <AgreementChecklist defaultValue={setAllAgreements(AGREEMENT_ITEMS, true)} />
        </Demo>
        <Demo
          label="다음 단계와 함께 (필수 안내)"
          note="필수를 빼고 '다음'을 누르면 빠진 항목을 알려 줘요"
          surface="card"
        >
          <WithNextButton />
        </Demo>
        <Demo label="법적 고지 링크 (페이지 위·설정 아래)">
          <LegalNav />
        </Demo>
      </div>
      <CodeSample
        code={`const [agreements, setAgreements] = useState(emptyAgreementState(AGREEMENT_ITEMS));
const [tried, setTried] = useState(false);
<AgreementChecklist value={agreements} onChange={setAgreements} showRequiredError={tried} />
<Button onClick={() => { setTried(true); if (hasRequiredAgreements(AGREEMENT_ITEMS, agreements)) save(toAgreementRecords(AGREEMENT_ITEMS, agreements)); }}>다음</Button>`}
      />
    </Section>
  );
}

function WithNextButton() {
  const [state, setState] = useState<AgreementState<Id>>(() =>
    emptyAgreementState(AGREEMENT_ITEMS),
  );
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <AgreementChecklist
        value={state}
        onChange={(next) => {
          setState(next);
          setSaved(null);
        }}
        showRequiredError={tried}
      />
      <Button
        sfx={false}
        className="w-full"
        onClick={() => {
          setTried(true);
          if (hasRequiredAgreements(AGREEMENT_ITEMS, state)) {
            setSaved(JSON.stringify(toAgreementRecords(AGREEMENT_ITEMS, state)));
          }
        }}
      >
        다음
      </Button>
      {saved && (
        <p className="text-caption break-all text-muted-foreground" data-testid="legal-records">
          기록: {saved}
        </p>
      )}
    </div>
  );
}
