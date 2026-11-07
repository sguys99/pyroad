'use client';

import { useId } from 'react';
import { AgreementChecklist } from '@/components/legal/AgreementChecklist';
import { useRovingRadio } from '@/components/onboarding/useRovingRadio';
import {
  GUARDIAN_AGREEMENT_ITEMS,
  GUARDIAN_RELATIONS,
  type AgreementState,
  type GuardianAgreementId,
  type GuardianRelation,
} from '@/lib/legal/agreements';
import { cn } from '@/lib/utils';

export interface GuardianConsentPanelProps {
  value: AgreementState<GuardianAgreementId>;
  onChange: (next: AgreementState<GuardianAgreementId>) => void;
  relation: GuardianRelation | null;
  onRelation: (next: GuardianRelation) => void;
  showRequiredError?: boolean;
  className?: string;
}

/**
 * 법정대리인 동의 판 (P3-15, §12-Q35 "보호자와 함께 이 화면에서"). 온보딩 보호자 단계와 `/onboarding/guardian`(나중에 동의)이 같이 쓴다.
 * 아이 화면 안에서 **어른에게 말하는 판**이라 말투를 바꾼다: 존댓말·법 근거·처리 내용 요약을 담백하게(아이용 쉬운 말 요약과 구분되는
 * 옅은 보조 면). 보호자 이름·연락처는 받지 않고 관계만 선택으로 묻는다. 동의 기록은 부르는 쪽이 저장
 * (`method = guardian_in_person`). 처리방침 "5. 만 14세 미만 아동의 개인정보 처리"와 같은 내용.
 */
export function GuardianConsentPanel({
  value,
  onChange,
  relation,
  onRelation,
  showRequiredError,
  className,
}: GuardianConsentPanelProps) {
  const id = useId();
  const ids = GUARDIAN_RELATIONS.map((r) => r.id);
  const radio = useRovingRadio(ids, relation, onRelation);
  return (
    <div className={cn('cs-guardian', className)} data-testid="guardian-panel">
      <div className="cs-guardian-letter">
        <p className="cs-guardian-kicker">보호자님께</p>
        <p className="cs-guardian-lead">
          pyRoad는 만 14세 미만 어린이의 개인정보를 처리할 때 「개인정보
          보호법」 제22조의2에 따라 법정대리인의 동의를 받습니다. 아래 내용을
          확인하신 뒤 아이와 함께 동의해 주세요.
        </p>
        <dl className="cs-guardian-facts">
          <div>
            <dt>처리하는 정보</dt>
            <dd>
              로그인 식별자, 닉네임·파이뱀 색·학년(선택), 학습 기록, 게시판에 쓴
              글
            </dd>
          </div>
          <div>
            <dt>쓰는 곳</dt>
            <dd>파이썬 학습 서비스 제공과 계정 관리</dd>
          </div>
          <div>
            <dt>다른 이용자에게</dt>
            <dd>닉네임과 파이뱀 그림만 보입니다 (실명·사진·이메일 비공개)</dd>
          </div>
          <div>
            <dt>보관 기간</dt>
            <dd>
              탈퇴할 때까지. 언제든 열람·삭제·동의 철회를 요청할 수 있습니다
            </dd>
          </div>
          <div>
            <dt>동의하지 않으면</dt>
            <dd>
              학습만 이용할 수 있고, 30일 안에 동의가 없으면 계정과 학습 기록이
              삭제됩니다
            </dd>
          </div>
        </dl>
      </div>

      <AgreementChecklist<GuardianAgreementId>
        items={GUARDIAN_AGREEMENT_ITEMS}
        value={value}
        onChange={onChange}
        legend="법정대리인 동의"
        showRequiredError={showRequiredError}
      />

      <div className="space-y-2">
        <p id={`${id}-rel`} className="ob-label">
          아이와의 관계{' '}
          <span className="font-normal text-muted-foreground">(선택)</span>
        </p>
        <div
          role="radiogroup"
          aria-labelledby={`${id}-rel`}
          className="cs-relations"
        >
          {GUARDIAN_RELATIONS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              {...radio.itemProps(i)}
              className="ob-month focus-ring"
              data-selected={relation === r.id || undefined}
              data-testid={`guardian-relation-${r.id}`}
              onClick={() => onRelation(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          보호자님의 이름·연락처는 받지 않습니다.
        </p>
      </div>
    </div>
  );
}
