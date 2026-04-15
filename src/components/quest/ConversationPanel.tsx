'use client';

import { memo, useEffect, useRef } from 'react';
import { BookOpen, Info, KeyRound, Lightbulb, MessageCircle } from 'lucide-react';
import { m, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { PromptSkeleton } from '@/lib/types/database';
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
  promptSkeleton: PromptSkeleton;
  messages: ChatMessage[];
  isAiLoading: boolean;
  streamingContent?: string;
  hintsUsed: number;
  onHintRequest: () => void;
  goldenKeys: number;
  onGoldenKeyUse: () => void;
  isGoldenKeyLoading?: boolean;
}

function ThinkingIndicator() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="flex items-start gap-3 px-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CharacterAvatar character="pybaem" expression="thinking" size="sm" animated />
      </div>
      <div className="rounded-xl rounded-tl-none bg-primary/5 border border-primary/20 px-4 py-3">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <m.span
              key={i}
              className="block h-2 w-2 rounded-full bg-primary/50"
              animate={shouldReduceMotion ? undefined : { y: [0, -6, 0] }}
              transition={
                shouldReduceMotion
                  ? undefined
                  : {
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }
              }
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          파이뱀 선생님이 생각 중...
        </p>
      </div>
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

const SystemMessage = memo(function SystemMessage({ content }: { content: string }) {
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
      <div className="rounded-xl rounded-tl-none bg-primary/5 border border-primary/20 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">
            파이뱀 선생님
          </span>
          {msg.isFallback && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              저장된 답변
            </span>
          )}
        </div>
        <div className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:leading-relaxed prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-hr:border-border prose-pre:bg-muted prose-pre:text-foreground">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

/**
 * 스트리밍 중 표시되는 메시지 컴포넌트.
 * ReactMarkdown 대신 plain text로 렌더링하여 불완전 마크다운 깜빡임을 방지한다.
 * memo를 사용하지 않아 매 delta마다 즉시 렌더링된다.
 */
function StreamingMessage({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <CharacterAvatar character="pybaem" expression="happy" size="sm" />
      </div>
      <div className="rounded-xl rounded-tl-none bg-primary/5 border border-primary/20 px-4 py-3">
        <div className="mb-1 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-primary">
            파이뱀 선생님
          </span>
        </div>
        <div className="prose prose-sm max-w-none text-foreground prose-p:leading-relaxed whitespace-pre-wrap">
          {content}
          <span className="inline-block h-4 w-0.5 animate-pulse bg-primary/60 align-text-bottom" />
        </div>
      </div>
    </div>
  );
}

export function ConversationPanel({
  promptSkeleton,
  messages,
  isAiLoading,
  streamingContent,
  hintsUsed,
  onHintRequest,
  goldenKeys,
  onGoldenKeyUse,
  isGoldenKeyLoading,
}: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 새 메시지 또는 스트리밍 콘텐츠 변경 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiLoading, streamingContent]);

  return (
    <div className="flex h-full flex-col">
      {/* 스크롤 가능한 콘텐츠 영역 */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {/* 스토리 배경 */}
          <div className="rounded-xl bg-secondary/5 border border-secondary/20 p-4">
            <div className="mb-2 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-secondary-foreground" />
              <h3 className="font-bold text-foreground">이야기</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {promptSkeleton.story_context}
            </p>
          </div>

          {/* 과제 설명 */}
          <div className="rounded-xl bg-accent/10 border border-accent/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-accent-foreground" />
              <h3 className="font-bold text-foreground">미션</h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              {promptSkeleton.exercise_description}
            </p>
            {promptSkeleton.expected_output_hint && (
              <p className="mt-2 text-xs text-muted-foreground">
                예상 결과: {promptSkeleton.expected_output_hint}
              </p>
            )}
          </div>

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

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 힌트 + 황금키 버튼 (하단 고정) */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <TooltipProvider delay={200}>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                힌트: {3 - hintsUsed}/3
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3 w-3 text-muted-foreground/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>힌트는 퀘스트마다 3개씩 제공됩니다.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <KeyRound className="h-3 w-3" />
                황금키: {goldenKeys}/3
                <Tooltip>
                  <TooltipTrigger className="cursor-help">
                    <Info className="h-3 w-3 text-amber-600/60" />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>황금키는 스테이지를 완료하면 3개로 보충됩니다.</p>
                  </TooltipContent>
                </Tooltip>
              </span>
            </div>
          </TooltipProvider>
          <div className="flex items-center gap-2">
            <m.div
              whileHover={
                !(isAiLoading || isGoldenKeyLoading || goldenKeys <= 0) ? { scale: 1.03 } : undefined
              }
              whileTap={
                !(isAiLoading || isGoldenKeyLoading || goldenKeys <= 0) ? { scale: 0.97 } : undefined
              }
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onGoldenKeyUse}
                disabled={isAiLoading || isGoldenKeyLoading || goldenKeys <= 0}
                className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <KeyRound className="h-4 w-4" />
                {goldenKeys <= 0 ? '키 소진' : '황금키'}
              </Button>
            </m.div>
            <m.div
              whileHover={
                !(isAiLoading || hintsUsed >= 3) ? { scale: 1.03 } : undefined
              }
              whileTap={
                !(isAiLoading || hintsUsed >= 3) ? { scale: 0.97 } : undefined
              }
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onHintRequest}
                disabled={isAiLoading || hintsUsed >= 3}
                className="gap-1.5"
              >
                <Lightbulb className="h-4 w-4" />
                {hintsUsed >= 3 ? '힌트 모두 사용' : '힌트 받기'}
              </Button>
            </m.div>
          </div>
        </div>
      </div>
    </div>
  );
}
