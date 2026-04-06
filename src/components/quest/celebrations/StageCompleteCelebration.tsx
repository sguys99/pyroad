'use client';

import { useState, useEffect } from 'react';
import { m } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CelebrationOverlay, type ConfettiBurst } from './CelebrationOverlay';
import { LottieCharacter } from '@/components/characters/LottieCharacter';
import { useTutor } from '@/lib/tutor/useTutor';

interface StageCompleteCelebrationProps {
  stageTitle: string;
  stageOrder: number;
  concepts: string[];
  questId: string;
  onClose: () => void;
}

const confettiBursts: ConfettiBurst[] = [
  {
    particleCount: 100,
    spread: 120,
    origin: { x: 0.5, y: 0.4 },
    delay: 0,
    colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'],
  },
  {
    particleCount: 60,
    spread: 80,
    origin: { x: 0.3, y: 0.5 },
    delay: 300,
  },
  {
    particleCount: 60,
    spread: 80,
    origin: { x: 0.7, y: 0.5 },
    delay: 300,
  },
];

export function StageCompleteCelebration({
  stageTitle,
  stageOrder,
  concepts,
  questId,
  onClose,
}: StageCompleteCelebrationProps) {
  const { sendTutorStreamRequest } = useTutor();
  const [summaryText, setSummaryText] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await sendTutorStreamRequest(
          {
            type: 'stage_summary',
            quest_id: questId,
          },
          (delta) => {
            if (!cancelled) setStreamingContent(delta);
          },
        );
        if (!cancelled) {
          setSummaryText(res.message);
          setStreamingContent('');
          setIsStreaming(false);
        }
      } catch {
        if (!cancelled) {
          setSummaryText(
            `스테이지를 모두 완료했어요! ${concepts.join(', ')} 등의 개념을 배웠어요. 대단해요!`,
          );
          setStreamingContent('');
          setIsStreaming(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questId]);

  const displayText = streamingContent || summaryText;

  return (
    <CelebrationOverlay
      onClose={onClose}
      confettiBursts={confettiBursts}
    >
      {/* 헤더 */}
      <m.div
        initial={{ rotate: -20, scale: 0 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', delay: 0.1 }}
      >
        <LottieCharacter
          character="pybaem"
          animation="level-up"
          size={72}
          fallbackExpression="celebrating"
        />
      </m.div>

      <m.p
        className="text-2xl font-black text-primary"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        Stage {stageOrder} 완료!
      </m.p>

      <m.p
        className="text-sm font-medium text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {stageTitle}
      </m.p>

      {/* AI 정리 메시지 */}
      <m.div
        className="max-h-40 w-full overflow-y-auto rounded-xl bg-muted/50 p-3 text-left text-sm leading-relaxed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        {displayText ? (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              strong: ({ children }) => (
                <strong className="font-bold text-primary">{children}</strong>
              ),
            }}
          >
            {displayText}
          </ReactMarkdown>
        ) : (
          <p className="animate-pulse text-muted-foreground">
            파이뱀 선생님이 정리하는 중...
          </p>
        )}
      </m.div>

      {/* 개념 체크리스트 */}
      <m.div
        className="w-full space-y-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-xs font-semibold text-muted-foreground">
          배운 개념
        </p>
        <div className="flex flex-wrap gap-1.5">
          {concepts.map((concept) => (
            <span
              key={concept}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <CheckCircle className="h-3 w-3" />
              {concept}
            </span>
          ))}
        </div>
      </m.div>

      {/* CTA */}
      <m.button
        className="mt-2 w-full rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        disabled={isStreaming}
      >
        {isStreaming ? '정리 중...' : '다음 모험으로!'}
      </m.button>
    </CelebrationOverlay>
  );
}
