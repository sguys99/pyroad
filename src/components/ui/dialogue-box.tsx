'use client';

import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { SpeechBubble, useTyping, type BubbleTone } from './speech-bubble';
import './dialogue-box.css';

/**
 * 게임 대사창 (P6-01, 최종 시안 `.f-tutor`): 왼쪽 캐릭터 + 말풍선, 대사는 한 글자씩 나온다.
 *
 * - 넘기기: 대사창을 누르거나(탭·클릭) 포커스한 채 Enter·Space → 남은 글자를 한 번에. 다 나오면 포커스 대상에서 빠진다
 * - minimal·동작 줄이기는 처음부터 전체 문장(`useTyping`)
 * - 화면 낭독기: 글자 조각은 숨기고, 전체 문장을 `aria-live="polite"`로 대사가 바뀔 때 한 번만 읽는다
 * - 캐릭터는 `character(speaking)`로 받는다: 글자가 나오는 동안 speaking=true (리그 `talking`에 넘기면 입이 움직임)
 * - 효과음 자리(P6-14): 대사 블립은 여기서 `useDialogueBlip(shown)`으로 (2~3글자마다, 낮은 볼륨)
 */
interface DialogueBoxProps {
  /** 대사 (바뀌면 처음부터 다시 타자) */
  text: string;
  /** 이름표 ("파이뱀") */
  speaker: ReactNode;
  character: (speaking: boolean) => ReactNode;
  tone?: BubbleTone;
  className?: string;
  'data-testid'?: string;
}

export function DialogueBox({
  text,
  speaker,
  character,
  tone = 'tutor',
  className,
  'data-testid': testId,
}: DialogueBoxProps) {
  const { shown, rest, done, skip } = useTyping(text, true);

  const onKeyDown = (e: KeyboardEvent) => {
    if (done || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    skip();
  };

  return (
    <div
      className={cn('g-dialogue', className)}
      data-typing={done ? undefined : ''}
      data-testid={testId}
      onClick={skip}
      onKeyDown={onKeyDown}
      tabIndex={done ? undefined : 0}
    >
      <div className="g-dialogue-who" aria-hidden>
        {character(!done)}
      </div>
      <SpeechBubble speaker={speaker} tone={tone} tail="left">
        <span aria-hidden>{shown}</span>
        {!done && <span className="g-caret" aria-hidden />}
        <span aria-hidden className="g-bubble-rest">
          {rest}
        </span>
        <span className="sr-only" aria-live="polite">
          {text}
        </span>
      </SpeechBubble>
    </div>
  );
}
