'use client';

import { useId, useRef, type ReactNode } from 'react';
import {
  CircleCheck,
  Dices,
  Info,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NICKNAME_MAX_LENGTH } from '@/lib/profile/nicknameRules';
import type { NicknameStatus } from './useNicknameCheck';

export interface NicknameFieldProps {
  value: string;
  onChange: (value: string) => void;
  status: NicknameStatus;
  onCompositionChange: (composing: boolean) => void;
  /** 🎲 다른 이름 추천 */
  onRoll: () => void;
  /** 주사위가 굴러가는 중 (이름이 바뀌어 보이는 동안) */
  rolling?: boolean;
  /** 주사위 아이콘 요소 (굴리는 연출) */
  diceRef?: React.Ref<HTMLSpanElement>;
  /** 중복일 때 추천 이름 쓰기 */
  onUseSuggestion?: (name: string) => void;
  /** 다음 단계로 (Enter) */
  onSubmit?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * 닉네임 입력 (P3-11). 큰 입력칸(Jua 22px, 1px 입력 테두리) + 글자 수 + 안내 한 줄 + "다른 이름 추천" 주사위.
 * 안내는 소리치지 않게: 문제는 금색 글자(경고 = 금색, tokens.md) + 정보 아이콘, 통과는 초록 체크. 빨간색을 쓰지 않는다.
 * 안내 줄은 높이를 미리 잡아 두어(두 줄) 글자가 바뀌어도 아래 버튼이 흔들리지 않는다. `aria-describedby`로 입력칸에 연결,
 * 바뀌면 `aria-live="polite"`로 한 번 읽힌다.
 */
export function NicknameField({
  value,
  onChange,
  status,
  onCompositionChange,
  onRoll,
  rolling = false,
  diceRef,
  onUseSuggestion,
  onSubmit,
  inputRef,
}: NicknameFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const count = Array.from(value.trim()).length;
  const lastSubmit = useRef(0);

  const tone =
    status.kind === 'ok'
      ? 'ok'
      : status.kind === 'invalid' || status.kind === 'taken'
        ? 'warn'
        : 'quiet';

  let hint: ReactNode = '한글, 영어, 숫자로 2~10글자. 띄어쓰기는 안 돼요.';
  let icon: ReactNode = <Info aria-hidden />;
  switch (status.kind) {
    case 'checking':
      icon = (
        <Loader2 aria-hidden className="animate-spin reduced:animate-none" />
      );
      hint = '친구들 이름과 겹치지 않는지 보는 중…';
      break;
    case 'ok':
      icon = <CircleCheck aria-hidden />;
      hint = '멋진 이름이에요! 쓸 수 있어요.';
      break;
    case 'invalid':
      hint = status.message;
      break;
    case 'taken':
      icon = <Users aria-hidden />;
      hint = status.message;
      break;
    case 'unknown':
      hint = status.message;
      break;
  }

  return (
    <div className="space-y-2" data-testid="nickname-field">
      <label htmlFor={id} className="ob-label">
        닉네임
      </label>
      <div className="ob-input" data-tone={tone}>
        <input
          ref={inputRef}
          id={id}
          name="nickname"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => onCompositionChange(true)}
          onCompositionEnd={(e) => {
            onCompositionChange(false);
            onChange(e.currentTarget.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            // Enter 를 꾹 누르고 있어도 한 번만
            const now = Date.now();
            if (now - lastSubmit.current < 400) return;
            lastSubmit.current = now;
            onSubmit?.();
          }}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          // 붙여 넣은 긴 글도 잘라 버리지 않고 "10글자까지" 안내 (maxLength 대신)
          aria-describedby={hintId}
          aria-invalid={tone === 'warn' || undefined}
          className="ob-input-field font-display"
          data-testid="nickname-input"
          data-rolling={rolling || undefined}
        />
        <span
          className="ob-input-count"
          data-over={count > NICKNAME_MAX_LENGTH || undefined}
          aria-hidden
        >
          {count}/{NICKNAME_MAX_LENGTH}
        </span>
      </div>
      <p
        id={hintId}
        className="ob-hint"
        data-tone={tone}
        aria-live="polite"
        data-testid="nickname-hint"
        data-status={status.kind}
      >
        <span className="ob-hint-icon">{icon}</span>
        <span>{hint}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {status.kind === 'taken' && status.suggestion && onUseSuggestion && (
          <Button
            variant="reward"
            size="sm"
            icon={<Sparkles aria-hidden />}
            onClick={() => onUseSuggestion(status.suggestion!)}
            data-testid="nickname-use-suggestion"
          >
            {status.suggestion} 쓰기
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          sfx="tap"
          onClick={onRoll}
          icon={
            <span ref={diceRef} className="inline-flex">
              <Dices aria-hidden />
            </span>
          }
          data-testid="nickname-roll"
        >
          다른 이름 추천
        </Button>
      </div>
    </div>
  );
}
