'use client';

import { useRef, type KeyboardEvent, type ReactNode } from 'react';

import { useDialogueBlip } from '@/components/sound/useDialogueBlip';
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
 * - 효과음(P6-14): 글자가 나오는 동안 2~3글자마다 낮은 블립(`useDialogueBlip`). 넘기면·처음부터 다 보이면·안 보이는 쪽이면 조용히
 */
interface DialogueBoxProps {
  /** 대사 (바뀌면 처음부터 다시 타자) */
  text: string;
  /** 이름표 ("파이뱀") */
  speaker: ReactNode;
  character: (speaking: boolean) => ReactNode;
  tone?: BubbleTone;
  /** false면 대사가 바뀌어도 낭독기에 알리지 않음 (같은 내용을 다른 곳이 이미 읽을 때, P7-13). 글자는 그대로 읽을 수 있음 */
  live?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function DialogueBox({
  text,
  speaker,
  character,
  tone = 'tutor',
  live = true,
  className,
  'data-testid': testId,
}: DialogueBoxProps) {
  const { shown, rest, done, skip } = useTyping(text, true);
  const root = useRef<HTMLDivElement>(null);
  useDialogueBlip(shown, !done, root);

  const onKeyDown = (e: KeyboardEvent) => {
    if (done || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    skip();
  };

  return (
    <div
      ref={root}
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
        <span className="sr-only" aria-live={live ? 'polite' : undefined}>
          {text}
        </span>
      </SpeechBubble>
    </div>
  );
}
