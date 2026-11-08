'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export const SHARED_DEVICE_LABEL = '학교·도서관 컴퓨터예요';
export const SHARED_DEVICE_HINT =
  '다음 사람이 내 계정으로 들어오지 않게 매번 다시 물어봐요';

export interface SharedDeviceCheckProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/**
 * 공용 기기 체크 (P4-09, §12-Q44). 로그인 시트 버튼 아래. 진짜 `<input type="checkbox">` + `<label>`이라
 * 키보드(Tab·Space)·낭독기가 그대로 동작한다(약관 체크와 같은 모양, `AgreementChecklist`). 설명은 `aria-describedby`.
 * 줄 전체가 누르는 자리(48px 이상). 값 저장·로그인 옵션은 `sharedDevice.ts`·`getOAuthCredentials`가 맡는다.
 */
export function SharedDeviceCheck({
  checked,
  onCheckedChange,
  className,
}: SharedDeviceCheckProps) {
  const id = useId();
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-1',
        className,
      )}
      data-testid="shared-device"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        // 이름은 제목만, 한 줄 설명은 설명으로 (라벨이 둘을 감싸 줄 전체가 누르는 자리)
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        className="focus-ring mt-2.5 size-6 shrink-0 cursor-pointer accent-primary"
        data-testid="shared-device-check"
      />
      <label
        htmlFor={id}
        className="grid min-h-touch flex-1 cursor-pointer content-center gap-0.5 py-2"
      >
        <span
          id={`${id}-label`}
          className="text-small font-semibold text-foreground"
        >
          {SHARED_DEVICE_LABEL}
        </span>
        <span id={`${id}-hint`} className="text-caption text-muted-foreground">
          {SHARED_DEVICE_HINT}
        </span>
      </label>
    </div>
  );
}
