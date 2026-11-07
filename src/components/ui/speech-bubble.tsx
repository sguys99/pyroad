'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { useMotionTier } from '@/lib/motion/MotionTierProvider';

/**
 * 말풍선 (P2-11, docs/design/components.md §9). 최종 시안 `Bubble`: 테두리 없는 흰 면 + 그림자 한 종류 + 꼬리, 위에 화자 이름표.
 *
 * - 말투(tone): tutor(흰 면) · good(성공 초록 틴트) · bug(오류 틴트, 이름표 오류색) · quiet(보조 면, 그림자 없음)
 * - 꼬리: left(왼쪽 캐릭터를 가리킴) · top · none
 * - 내용은 `children`(마크다운 등 아무 요소) 또는 `text`(문자열). `text` + `typing`이면 한 글자씩 나타난다:
 *   전체 문장을 처음부터 배치하고 아직 안 나온 글자만 숨기므로 상자 크기가 흔들리지 않고, 화면 낭독기는 전체 문장을 한 번에 읽는다.
 *   minimal·동작 줄이기는 처음부터 전체 문장. 커서 깜빡임은 바쁨 표시라 동작 줄이기에서만 멈춘다
 */
export type BubbleTone = 'tutor' | 'good' | 'bug' | 'quiet';

/** 한 글자 간격 (ms, 최종 시안 `useTyping` 34ms) */
export const TYPING_CHAR_MS = 34;

/** 타자 효과: 보여 줄 글자 수. 단계가 낮으면 처음부터 전부 */
export function useTyping(text: string, enabled: boolean, onDone?: () => void) {
  const { budget } = useMotionTier();
  const chars = [...text];
  const instant = !enabled || !budget.springs;
  const [n, setN] = useState(instant ? chars.length : 0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const total = [...text].length;
    if (instant) {
      setN(total);
      onDoneRef.current?.();
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= total) {
        clearInterval(id);
        onDoneRef.current?.();
      }
    }, TYPING_CHAR_MS);
    return () => clearInterval(id);
  }, [text, instant]);

  return {
    shown: chars.slice(0, n).join(''),
    rest: chars.slice(n).join(''),
    done: n >= chars.length,
  };
}

interface SpeechBubbleProps {
  /** 화자 이름표 ("파이뱀 선생님") */
  speaker?: ReactNode;
  /** 이름표 앞 아이콘 (장식) */
  speakerIcon?: ReactNode;
  /** 이름표 뒤 작은 배지 ("저장된 답변") */
  badge?: ReactNode;
  tone?: BubbleTone;
  tail?: 'left' | 'top' | 'none';
  /** 문자열 내용 (타자 효과를 쓰려면 이것) */
  text?: string;
  typing?: boolean;
  onTypingDone?: () => void;
  /** 아무 요소 내용 (`text`가 없을 때) */
  children?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function SpeechBubble({
  speaker,
  speakerIcon,
  badge,
  tone = 'tutor',
  tail = 'left',
  text,
  typing = false,
  onTypingDone,
  children,
  className,
  'data-testid': testId,
}: SpeechBubbleProps) {
  return (
    <div
      data-slot="speech-bubble"
      data-tone={tone}
      data-tail={tail === 'none' ? undefined : tail}
      data-testid={testId}
      className={cn('g-bubble', className)}
    >
      {(speaker || badge) && (
        <div className="g-bubble-who">
          {speakerIcon && (
            <span aria-hidden className="inline-flex [&_svg]:size-4">
              {speakerIcon}
            </span>
          )}
          {speaker}
          {badge}
        </div>
      )}
      {text !== undefined ? (
        <TypedText text={text} typing={typing} onDone={onTypingDone} />
      ) : (
        <div className="g-bubble-t">{children}</div>
      )}
    </div>
  );
}

function TypedText({
  text,
  typing,
  onDone,
}: {
  text: string;
  typing: boolean;
  onDone?: () => void;
}) {
  const { shown, rest, done } = useTyping(text, typing, onDone);
  return (
    <p className="g-bubble-t">
      <span aria-hidden>{shown}</span>
      {!done && (
        <span className="g-caret" aria-hidden data-testid="bubble-caret" />
      )}
      <span aria-hidden className="g-bubble-rest">
        {rest}
      </span>
      <span className="sr-only">{text}</span>
    </p>
  );
}
