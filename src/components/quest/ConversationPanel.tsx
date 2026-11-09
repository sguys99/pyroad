'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { useDialogueBlip } from '@/components/sound/useDialogueBlip';
import type { ChatMessage } from '@/lib/tutor/types';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { useMessageExpression } from '@/components/characters/useCharacterExpression';

// 모듈 스코프 상수 — React.memo 무효화 방지
const remarkPlugins = [remarkGfm];
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>,
};

interface ConversationPanelProps {
  messages: ChatMessage[];
  isAiLoading: boolean;
  streamingContent?: string;
  /** 힌트를 받는 중: 흘러 들어오는 글자는 이야기 쪽 힌트 쪽지가 보여 준다 (P6-09) */
  hintPending?: boolean;
}

/** 이 시간이 지나도 답이 없으면 "조금 오래 걸려요" 문구로 바꿔 아이가 기다릴 수 있게 함 */
const SLOW_THINKING_MS = 8_000;

function ThinkingIndicator() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_THINKING_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-start gap-3 px-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CharacterAvatar
          character="pybaem"
          expression="thinking"
          size="sm"
          animated
        />
      </div>
      <SpeechBubble tail="left" speaker="파이뱀 선생님">
        <div className="flex items-center gap-1 py-1">
          {/* 반복 연출은 CSS 키프레임으로 (§2.10). reduced-motion이면 멈춘 점 세 개 */}
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="thinking-dot block h-2 w-2 rounded-full bg-primary/50"
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          {isSlow
            ? '열심히 생각하고 있어요. 조금만 기다려 줘요!'
            : '파이뱀 선생님이 생각 중...'}
        </p>
      </SpeechBubble>
    </div>
  );
}

function TutorMessageAvatar({ message }: { message: ChatMessage }) {
  const expression = useMessageExpression(message);
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <CharacterAvatar character="pybaem" expression={expression} size="sm" />
    </div>
  );
}

const SystemMessage = memo(function SystemMessage({
  content,
}: {
  content: string;
}) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
        {content}
      </span>
    </div>
  );
});

const TutorMessage = memo(function TutorMessage({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex items-start gap-3">
      <TutorMessageAvatar message={msg} />
      <SpeechBubble
        tail="left"
        speaker="파이뱀 선생님"
        speakerIcon={<MessageCircle />}
        badge={
          msg.isFallback && (
            <span className="rounded-md bg-surface-2 px-1.5 text-caption font-normal text-muted-foreground">
              저장된 답변
            </span>
          )
        }
        className="min-w-0"
      >
        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:leading-relaxed prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-hr:border-border prose-pre:bg-muted prose-pre:text-foreground">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      </SpeechBubble>
    </div>
  );
});

/**
 * 스트리밍 중 표시되는 메시지 컴포넌트.
 * ReactMarkdown 대신 plain text로 렌더링하여 불완전 마크다운 깜빡임을 방지한다.
 * memo를 사용하지 않아 매 delta마다 즉시 렌더링된다.
 */
function StreamingMessage({ content }: { content: string }) {
  // 글자가 늘어날 때 작은 블립 (빈도 제한, P2-14). 말하는 중 표시는 깜빡이는 커서가 함께 보여 준다
  useDialogueBlip(content);
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CharacterAvatar character="pybaem" expression="happy" size="sm" />
      </div>
      <SpeechBubble
        tail="left"
        speaker="파이뱀 선생님"
        speakerIcon={<MessageCircle />}
        className="min-w-0"
      >
        <div className="prose prose-sm max-w-none text-foreground prose-p:leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="g-caret" aria-hidden />
        </div>
      </SpeechBubble>
    </div>
  );
}

export function ConversationPanel({
  messages,
  isAiLoading,
  streamingContent,
  hintPending = false,
}: ConversationPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // 새 메시지·스트리밍이면 대화 상자 안에서만 끝으로. 이야기 쪽 전체(해 볼 일 카드)는 움직이지 않는다 (P6-01)
  useEffect(() => {
    const log = logRef.current;
    log?.scrollTo?.({ top: log.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isAiLoading, streamingContent]);

  // 힌트는 이야기 쪽 쪽지(QuestHints)로 따로 보여 주므로 대화 기록에는 넣지 않는다 (P6-09)
  return (
    <div
      ref={logRef}
      className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto"
    >
      {/* 채팅 메시지 목록 */}
      {messages.map((msg, idx) => {
        if (msg.hint) return null;
        if (msg.role === 'system') {
          return <SystemMessage key={idx} content={msg.content} />;
        }
        return <TutorMessage key={idx} msg={msg} />;
      })}

      {/* 스트리밍 중이면 plain text로 부분 텍스트 표시, 아니면 로딩 인디케이터 */}
      {hintPending ? null : streamingContent ? (
        <StreamingMessage content={streamingContent} />
      ) : isAiLoading ? (
        <ThinkingIndicator />
      ) : null}
    </div>
  );
}
