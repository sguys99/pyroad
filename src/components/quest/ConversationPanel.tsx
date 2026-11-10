'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpeechBubble } from '@/components/ui/speech-bubble';
import { Button } from '@/components/ui/button';
import type { ChatMessage } from '@/lib/tutor/types';
import { ASK_QUESTIONS, type AskQuestion } from '@/lib/quest/useQuestSession';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import type { PybaemExpression } from '@/components/characters/expressions';
import { useMessageExpression } from '@/components/characters/useCharacterExpression';
import { ApiKeyBanner } from './ApiKeyBanner';
import './askPybaem.css';

// 모듈 스코프 상수 — React.memo 무효화 방지
const remarkPlugins = [remarkGfm];
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
  h2: ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>,
};

export interface ConversationPanelProps {
  messages: ChatMessage[];
  isAiLoading: boolean;
  streamingContent?: string;
  /** 힌트를 받는 중: 흘러 들어오는 글자는 이야기 쪽 힌트 쪽지가 보여 준다 (P6-09) */
  hintPending?: boolean;
  /** 본인 API 키가 없으면 기본 튜터 안내 한 줄 (P6-10: 책 위 띠 대신 대화 안) */
  hasApiKey?: boolean | null;
  /** 정해진 질문 고르기 (없으면 질문 줄을 그리지 않음) */
  onAsk?: (question: AskQuestion) => void;
  /** "왜 이렇게 나왔어요?" (마지막 실행 결과가 지금 코드의 것일 때만) */
  canAskWhy?: boolean;
}

/** 이 시간이 지나도 답이 없으면 "조금 오래 걸려요" 문구로 바꿔 아이가 기다릴 수 있게 함 */
const SLOW_THINKING_MS = 8_000;

function TutorFace({ expression }: { expression: PybaemExpression }) {
  return (
    <span className="qc-face" aria-hidden>
      <CharacterAvatar character="pybaem" expression={expression} size={28} />
    </span>
  );
}

function ThinkingBubble() {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), SLOW_THINKING_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="qc-row" data-testid="chat-thinking">
      <TutorFace expression="thinking" />
      <SpeechBubble tail="left" speaker="파이뱀" className="min-w-0">
        <span className="qc-dots">
          {/* 반복 연출은 CSS 키프레임(바쁨 표시: 동작 줄이기에서만 멈춤, app.css). 멈춰도 글자로 알려 준다 */}
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="thinking-dot" />
          <span className="qc-dots-t">
            {isSlow
              ? '열심히 생각하고 있어요. 조금만 기다려 줘요!'
              : '생각 중…'}
          </span>
        </span>
      </SpeechBubble>
    </div>
  );
}

const SystemMessage = memo(function SystemMessage({
  content,
}: {
  content: string;
}) {
  return (
    <p className="qc-system" data-testid="chat-system">
      {content}
    </p>
  );
});

const StudentMessage = memo(function StudentMessage({
  content,
}: {
  content: string;
}) {
  return (
    <div className="qc-row qc-row-me" data-testid="chat-student">
      <p className="qc-me">
        <span className="sr-only">내 질문: </span>
        {content}
      </p>
    </div>
  );
});

const TutorMessage = memo(function TutorMessage({ msg }: { msg: ChatMessage }) {
  const expression = useMessageExpression(msg);
  return (
    <div className="qc-row" data-testid="chat-tutor">
      <TutorFace expression={expression} />
      <SpeechBubble
        tail="left"
        speaker="파이뱀"
        badge={msg.isFallback && <span className="qc-badge">저장된 답변</span>}
        className="min-w-0"
      >
        <div className="qc-md prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-strong:text-foreground prose-p:leading-relaxed prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-hr:border-border prose-pre:bg-muted prose-pre:text-foreground">
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
 * 스트리밍 중 말풍선. ReactMarkdown 대신 글자 그대로 그려 불완전 마크다운 깜빡임을 막고, 끝에 부드러운 커서.
 * 화면 낭독기는 다 쓴 답만 읽는다(AskPybaem의 aria-live) — 늘어나는 글자는 aria-hidden
 */
function StreamingMessage({ content }: { content: string }) {
  // 블립 없음 (P6-14): 긴 답 스트리밍 내내 울리지 않게, 블립은 대사창(DialogueBox) 한 줄 대사만
  return (
    <div className="qc-row" data-testid="chat-streaming">
      <TutorFace expression="teaching" />
      <SpeechBubble tail="left" speaker="파이뱀" className="min-w-0">
        <p className="qc-stream" aria-hidden>
          {content}
          <span className="g-caret" />
        </p>
      </SpeechBubble>
    </div>
  );
}

/**
 * 파이뱀과 나눈 이야기 (P6-10). "파이뱀에게 물어보기"를 열면 지연 로드된다(마크다운 렌더러가 첫 화면 JS에 들지 않게):
 * 데스크톱은 이야기 쪽 안에서 펼침, 모바일은 바텀시트. 파이뱀은 왼쪽(작은 얼굴 + 테두리 없는 말풍선), 아이 질문은 오른쪽.
 * 아래에는 정해진 질문 버튼 줄 — 고르면 내 말풍선 → 생각 중 점 세 개 → 흘러나오는 답
 */
export default function ConversationPanel({
  messages,
  isAiLoading,
  streamingContent,
  hintPending = false,
  hasApiKey,
  onAsk,
  canAskWhy = false,
}: ConversationPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);

  // 새 메시지·스트리밍이면 대화 상자 안에서만 끝으로. 이야기 쪽 전체(해 볼 일 카드)는 움직이지 않는다 (P6-01)
  useEffect(() => {
    const log = logRef.current;
    log?.scrollTo?.({ top: log.scrollHeight });
  }, [messages.length, isAiLoading, streamingContent]);

  const busy = isAiLoading && !hintPending;
  const questions = (Object.keys(ASK_QUESTIONS) as AskQuestion[]).filter(
    (q) => q !== 'why' || canAskWhy,
  );

  return (
    <div className="qc">
      {hasApiKey === false && <ApiKeyBanner />}
      <div
        ref={logRef}
        className="qc-log"
        tabIndex={0}
        aria-label="파이뱀과 나눈 이야기"
        data-testid="chat-log"
      >
        {/* 힌트는 이야기 쪽 쪽지(QuestHints)로 따로 보여 주므로 대화 기록에는 넣지 않는다 (P6-09) */}
        {messages.map((msg, idx) => {
          if (msg.hint) return null;
          if (msg.role === 'system')
            return <SystemMessage key={idx} content={msg.content} />;
          if (msg.role === 'student')
            return <StudentMessage key={idx} content={msg.content} />;
          return <TutorMessage key={idx} msg={msg} />;
        })}

        {/* 힌트를 받는 중이면 흐르는 글자는 쪽지가 보여 준다 (P6-09) */}
        {busy &&
          (streamingContent ? (
            <StreamingMessage content={streamingContent} />
          ) : (
            <ThinkingBubble />
          ))}
      </div>

      {onAsk && (
        <div className="qc-ask" role="group" aria-label="파이뱀에게 물어볼 것">
          {questions.map((q) => (
            <Button
              key={q}
              variant="secondary"
              size="sm"
              icon={<MessageCircleQuestion aria-hidden />}
              disabled={isAiLoading}
              onClick={() => onAsk(q)}
              data-testid={`ask-${q}`}
            >
              {ASK_QUESTIONS[q]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
