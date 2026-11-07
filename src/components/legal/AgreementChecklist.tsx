'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  AGREEMENT_ITEMS,
  emptyAgreementState,
  isAllAgreed,
  isPartlyAgreed,
  missingRequiredAgreements,
  setAgreement,
  setAllAgreements,
  type AgreementItem,
  type AgreementState,
} from '@/lib/legal/agreements';
import { cn } from '@/lib/utils';

export interface AgreementChecklistProps<Id extends string> {
  /** 동의 항목 (기본: 이용약관·개인정보 수집·이용, 모두 필수) */
  items?: readonly AgreementItem<Id>[];
  /** 제어 모드 값. 없으면 컴포넌트가 상태를 갖는다 (`defaultValue`에서 시작) */
  value?: AgreementState<Id>;
  defaultValue?: AgreementState<Id>;
  /** 바뀔 때마다 전체 상태. 다음 단계 버튼은 `hasRequiredAgreements(items, state)`로 연다 */
  onChange?: (state: AgreementState<Id>) => void;
  /** 묶음 제목 (fieldset legend) */
  legend?: string;
  /** 다음 단계를 눌렀는데 필수가 빠졌을 때 켠다 → 빠진 항목 안내 (스크린 리더에 바로 읽힘) */
  showRequiredError?: boolean;
  className?: string;
}

/**
 * 약관 동의 체크 목록 (P3-14). 온보딩(P3-11)·보호자 동의(P3-15)에서 쓴다. DB에 쓰지 않는다(기록은 부르는 쪽이
 * `toAgreementRecords()`로). 진짜 `<input type="checkbox">` + `<label>`이라 키보드(Tab·Space)와 스크린 리더가 그대로 동작하고,
 * "모두 동의"는 일부만 체크하면 중간 상태(indeterminate)로 보인다. "보기"는 문서를 새 탭으로 연다(작성 중인 화면을 잃지 않게).
 */
export function AgreementChecklist<Id extends string = string>({
  items = AGREEMENT_ITEMS as unknown as readonly AgreementItem<Id>[],
  value,
  defaultValue,
  onChange,
  legend = '약관 동의',
  showRequiredError = false,
  className,
}: AgreementChecklistProps<Id>) {
  const baseId = useId();
  const [inner, setInner] = useState<AgreementState<Id>>(
    () => defaultValue ?? emptyAgreementState(items),
  );
  const state = value ?? inner;
  const all = isAllAgreed(items, state);
  const partly = isPartlyAgreed(items, state);
  const missing = missingRequiredAgreements(items, state);

  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = partly;
  }, [partly]);

  const update = (next: AgreementState<Id>) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  const errorId = `${baseId}-error`;
  return (
    <fieldset
      className={cn('space-y-2', className)}
      aria-describedby={
        showRequiredError && missing.length > 0 ? errorId : undefined
      }
    >
      <legend className="mb-2 font-display text-h3 text-foreground">
        {legend}
      </legend>

      <div className="flex min-h-14 items-center gap-3 rounded-xl bg-primary-soft px-4">
        <input
          ref={allRef}
          id={`${baseId}-all`}
          type="checkbox"
          checked={all}
          onChange={(e) => update(setAllAgreements(items, e.target.checked))}
          className="focus-ring size-6 shrink-0 cursor-pointer accent-primary"
          data-testid="agreement-all"
        />
        <label
          htmlFor={`${baseId}-all`}
          className="flex-1 cursor-pointer py-3 font-semibold text-foreground"
        >
          모두 동의해요
        </label>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const inputId = `${baseId}-${item.id}`;
          return (
            <li
              key={item.id}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-surface-2 px-4"
            >
              <input
                id={inputId}
                type="checkbox"
                checked={state[item.id] === true}
                onChange={(e) =>
                  update(setAgreement(state, item.id, e.target.checked))
                }
                aria-required={item.required || undefined}
                className="focus-ring size-6 shrink-0 cursor-pointer accent-primary"
                data-testid={`agreement-${item.id}`}
              />
              <label
                htmlFor={inputId}
                className="min-w-0 flex-1 cursor-pointer py-3 text-small text-foreground"
              >
                <span
                  className={
                    item.required
                      ? 'text-primary-text'
                      : 'text-muted-foreground'
                  }
                >
                  {item.required ? '(필수) ' : '(선택) '}
                </span>
                {item.label}
              </label>
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex min-h-10 shrink-0 items-center gap-1 rounded-md px-1 text-small text-primary-text underline underline-offset-4"
              >
                보기
                <ExternalLink aria-hidden className="size-3.5" />
                <span className="sr-only">: {item.title} 내용 (새 창)</span>
              </a>
            </li>
          );
        })}
      </ul>

      {showRequiredError && missing.length > 0 && (
        <p
          id={errorId}
          role="alert"
          className="text-small font-semibold text-error"
        >
          {missing.map((m) => m.title).join(', ')}에 동의해야 다음으로 갈 수
          있어요.
        </p>
      )}
    </fieldset>
  );
}
