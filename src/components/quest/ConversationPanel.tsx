'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Info, Lightbulb, MessageCircle } from 'lucide-react';
import { DURATION } from '@/lib/motion/tokens';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { RewardIcon } from '@/components/ui/reward-icon';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { useDialogueBlip } from '@/components/sound/useDialogueBlip';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  hintsUsed: number;
  onHintRequest: () => void;
  goldenKeys: number;
  onGoldenKeyUse: () => void;
  isGoldenKeyLoading?: boolean;
  /** 실행기가 준비되지 않았거나 실행·채점 중이라 지금은 황금키를 쓸 수 없음 */
  isGoldenKeyBlocked?: boolean;
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
  hintsUsed,
  onHintRequest,
  goldenKeys,
  onGoldenKeyUse,
  isGoldenKeyLoading,
  isGoldenKeyBlocked = false,
}: ConversationPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const goldenKeyDisabled =
    isAiLoading || isGoldenKeyLoading || isGoldenKeyBlocked || goldenKeys <= 0;

  // 새 메시지·스트리밍이면 대화 상자 안에서만 끝으로. 이야기 쪽 전체(해 볼 일 카드)는 움직이지 않는다 (P6-01)
  useEffect(() => {
    const log = logRef.current;
    log?.scrollTo?.({ top: log.scrollHeight, behavior: 'smooth' });
  }, [messages.length, isAiLoading, streamingContent]);

  // 힌트·황금키 줄이 위, 대화 기록이 아래 (시안: 힌트 버튼 아래에 쪽지가 쌓임)
  const log = (
    <div
      ref={logRef}
      className="flex max-h-[28rem] flex-col gap-4 overflow-y-auto"
    >
      {/* 채팅 메시지 목록 */}
      {messages.map((msg, idx) => {
        if (msg.role === 'system') {
          return <SystemMessage key={idx} content={msg.content} />;
        }
        return <TutorMessage key={idx} msg={msg} />;
      })}

      {/* 스트리밍 중이면 plain text로 부분 텍스트 표시, 아니면 로딩 인디케이터 */}
      {streamingContent ? (
        <StreamingMessage content={streamingContent} />
      ) : isAiLoading ? (
        <ThinkingIndicator />
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 힌트 + 황금키 버튼 */}
      <div className="border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TooltipProvider delay={DURATION.base}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                힌트: {3 - hintsUsed}/3
                <Tooltip>
                  <TooltipTrigger
                    className="cursor-help"
                    aria-label="힌트 안내"
                  >
                    <Info
                      className="h-3 w-3 text-muted-foreground/60"
                      aria-hidden
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>힌트는 퀘스트마다 3개씩 제공됩니다.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className="flex items-center gap-1 text-xs text-accent-text">
                <RewardIcon kind="key" size={18} />
                황금키: {goldenKeys}/3
                <Tooltip>
                  <TooltipTrigger
                    className="cursor-help"
                    aria-label="황금키 안내"
                  >
                    <Info className="h-3 w-3 text-accent-text/70" aria-hidden />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>황금키는 스테이지를 완료하면 3개로 보충됩니다.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
          </TooltipProvider>
          <div className="flex items-center gap-2">
            {/* 눌림 피드백은 게임 버튼 자체 (P2-11). 힌트 소리(tap)는 세션이 낸다 */}
            <Button
              variant="reward"
              size="sm"
              onClick={onGoldenKeyUse}
              disabled={goldenKeyDisabled}
              icon={<RewardIcon kind="key" size={22} />}
            >
              {goldenKeys <= 0 ? '키 소진' : '황금키'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onHintRequest}
              disabled={isAiLoading || hintsUsed >= 3}
              sfx={false}
              icon={<Lightbulb aria-hidden />}
            >
              {hintsUsed >= 3 ? '힌트 모두 사용' : '힌트 받기'}
            </Button>
          </div>
        </div>
      </div>
      {log}
    </div>
  );
}
