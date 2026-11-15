'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { SendHorizontal, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface InputReplyProps {
  /** input()이 지금 대답을 기다리는지. 아니면 칸은 남기고(키보드 유지) 보내기만 잠근다 */
  waiting: boolean;
  onAnswer: (value: string) => void;
  onStop: () => void;
  /** 물어볼 때 칸으로 포커스 (카탈로그 견본은 끔: 페이지를 끌어당기지 않게) */
  autoFocus?: boolean;
}

/**
 * input() 대화 입력 칸 (P11-01): 결과 쪽지 아래 붙는 채팅 입력줄. Enter(휴대폰 키보드 "보내기")로 보내고,
 * 보낸 말은 쪽지 안에 내 말풍선으로 남는다(OutputLines). 멈추기는 입력 대기 중에도 Worker를 살린 채 끝낸다.
 * 한글 조합 중 Enter는 조합만 끝내고 보내지 않는다(같은 Enter가 두 번 오는 브라우저가 있음)
 */
export function InputReply({
  waiting,
  onAnswer,
  onStop,
  autoFocus = true,
}: InputReplyProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cueId = useId();

  // 물어볼 때마다 칸으로 (휴대폰은 키보드가 올라옴). 쪽지가 화면 밖이면 칸이 보이게
  useEffect(() => {
    if (!waiting || !autoFocus) return;
    const input = inputRef.current;
    input?.focus({ preventScroll: true });
    input?.scrollIntoView?.({ block: 'nearest' });
  }, [waiting, autoFocus]);

  const send = () => {
    if (!waiting) return;
    onAnswer(value);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    send();
  };

  return (
    <form
      className="qo-reply"
      data-waiting={waiting || undefined}
      data-testid="input-reply"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <p id={cueId} className="qo-reply-cue">
        <span className="qo-reply-dot" aria-hidden />
        {waiting
          ? '파이썬이 내 대답을 기다려요!'
          : '대답을 받았어요. 이어서 돌아가요…'}
      </p>
      <div className="qo-reply-row">
        <input
          ref={inputRef}
          className="qo-reply-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          readOnly={!waiting}
          aria-label="파이썬에게 보낼 대답"
          aria-describedby={cueId}
          placeholder={waiting ? '여기에 대답을 써요' : ''}
          enterKeyHint="send"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={500}
          data-testid="input-reply-field"
        />
        <Button
          type="submit"
          size="sm"
          sfx={false}
          disabled={!waiting}
          icon={<SendHorizontal aria-hidden />}
          // 누르는 동안 칸의 포커스를 빼앗지 않는다 (휴대폰 키보드가 내려가지 않게)
          onMouseDown={(e) => e.preventDefault()}
          className="qo-reply-send"
          data-testid="input-reply-send"
        >
          <span className="qo-reply-send-label">보내기</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          sfx={false}
          icon={<Square className="fill-current" aria-hidden />}
          onClick={onStop}
          onMouseDown={(e) => e.preventDefault()}
          aria-label="멈추기"
          title="멈추기"
          className="qo-reply-stop"
          data-testid="input-reply-stop"
        />
      </div>
    </form>
  );
}
