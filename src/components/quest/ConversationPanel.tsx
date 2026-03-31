'use client';

import { BookOpen, Lightbulb, MessageCircle } from 'lucide-react';
import type { PromptSkeleton } from '@/lib/types/database';

interface ConversationPanelProps {
  promptSkeleton: PromptSkeleton;
}

export function ConversationPanel({ promptSkeleton }: ConversationPanelProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* 파이뱀 선생님 설명 */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
        <div className="mb-2 flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-foreground">파이뱀 선생님</h3>
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {promptSkeleton.fallback_text}
        </p>
      </div>

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
            💡 힌트: {promptSkeleton.expected_output_hint}
          </p>
        )}
      </div>
    </div>
  );
}
