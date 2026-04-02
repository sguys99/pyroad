'use client';

import { useEffect, useRef } from 'react';
import { BookOpen, Lightbulb, MessageCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import type { PromptSkeleton } from '@/lib/types/database';
import type { ChatMessage } from '@/lib/tutor/types';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { useMessageExpression } from '@/components/characters/useCharacterExpression';

interface ConversationPanelProps {
  promptSkeleton: PromptSkeleton;
  messages: ChatMessage[];
  isAiLoading: boolean;
  hintsUsed: number;
  onHintRequest: () => void;
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
            <motion.span
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

export function ConversationPanel({
  promptSkeleton,
  messages,
  isAiLoading,
  hintsUsed,
  onHintRequest,
}: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAiLoading]);

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
              return (
                <div key={idx} className="flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div key={idx} className="flex items-start gap-3">
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
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ children }) => <h3>{children}</h3>,
                        h2: ({ children }) => <h4>{children}</h4>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 로딩 인디케이터 */}
          {isAiLoading && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 힌트 버튼 (하단 고정) */}
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            힌트: {hintsUsed}/3 사용
          </span>
          <motion.div
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
          </motion.div>
        </div>
      </div>
    </div>
  );
}
