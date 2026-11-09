'use client';

import { useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import { Sheet } from '@/components/ui/sheet';
import { CharacterAvatar } from '@/components/characters/CharacterAvatar';
import { useMessageExpression } from '@/components/characters/useCharacterExpression';
import { useSfx } from '@/components/providers/SoundProvider';
import type { QuestSession } from '@/lib/quest/useQuestSession';
import type { ChatMessage } from '@/lib/tutor/types';
import './askPybaem.css';

// 대화 내용(마크다운 렌더러 포함)은 처음 열 때 받는다 (P6-16 첫 로드 JS 예산)
const ConversationPanel = dynamic(() => import('./ConversationPanel'), {
  ssr: false,
  loading: () => <p className="qc-loading">대화를 펼치는 중…</p>,
});

/** 책 펼침과 같은 기준 (QuestWorkspace lg) */
const DESKTOP_QUERY = '(min-width: 64rem)';
function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia?.(DESKTOP_QUERY);
  mq?.addEventListener('change', onChange);
  return () => mq?.removeEventListener('change', onChange);
}

/** 미리 보기 한 줄: 마크다운 기호·코드 블록을 걷어 낸 글자 */
export function plainPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?(```|$)/g, ' (코드) ')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const EMPTY: ChatMessage = { role: 'tutor', content: '' };

interface AskPybaemProps {
  session: QuestSession;
  /** 힌트를 받는 중 (흐르는 글자는 힌트 쪽지가 보여 줌, P6-09) */
  hintPending: boolean;
}

/**
 * "파이뱀에게 물어보기" (P6-10, §12-Q54). 대사창 아래 한 줄: 파이뱀 얼굴 + 이름 + 새 이야기 수 + 미리 보기.
 * 닫혀 있을 때 파이뱀이 한 말(소개·실행 피드백)은 이 줄에 미리 보이고(두 줄까지) 숫자 배지가 붙는다.
 * 누르면 데스크톱(lg↑)은 이야기 쪽 안에서 펼치고(대화는 그 안에서만 스크롤), 그 아래는 바텀시트.
 * 다 쓴 답은 늘 여기 aria-live로 읽어 준다(닫혀 있어도) — 흐르는 글자는 읽지 않는다
 */
export function AskPybaem({ session, hintPending }: AskPybaemProps) {
  const { messages, isAiLoading, streamingContent } = session;
  const play = useSfx();
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia?.(DESKTOP_QUERY).matches ?? false,
    () => false,
  );
  const [open, setOpen] = useState(false);

  // 파이뱀 말 + 알림(단계 시작·황금키·저장 실패). 아이 질문과 힌트 쪽지는 세지 않음
  const said = messages.filter((m) => m.role !== 'student' && !m.hint);
  const last = said.at(-1);
  // 펼쳐 둔 동안 들어온 말은 읽은 것으로 (렌더 중 갱신: 효과 없이 같은 값으로 수렴)
  const [seen, setSeen] = useState(0);
  if (open && seen !== said.length) setSeen(said.length);
  const unread = open ? 0 : Math.max(0, said.length - seen);

  const busy = isAiLoading && !hintPending;
  const expression = useMessageExpression(last ?? EMPTY);

  const toggle = (next: boolean) => {
    if (next !== open) play('tap');
    setOpen(next);
  };

  let sub: React.ReactNode;
  if (busy && streamingContent && !open) {
    sub = (
      <>
        {plainPreview(streamingContent)}
        <span className="g-caret" />
      </>
    );
  } else if (busy && !open) {
    sub = (
      <span className="qa-dots">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        생각 중…
      </span>
    );
  } else if (unread > 0 && last) {
    sub = plainPreview(last.content);
  } else {
    sub =
      open && isDesktop
        ? '다 봤으면 눌러서 접어요'
        : '궁금한 게 생기면 눌러 봐요';
  }

  const panel = (
    <ConversationPanel
      messages={messages}
      isAiLoading={isAiLoading}
      streamingContent={streamingContent}
      hintPending={hintPending}
      hasApiKey={session.hasApiKey}
      onAsk={session.handleAsk}
      canAskWhy={session.canAskWhy}
    />
  );

  return (
    <div className="qa" data-open={open || undefined}>
      <button
        type="button"
        className="qa-row"
        onClick={() => toggle(!open)}
        aria-expanded={isDesktop ? open : undefined}
        aria-controls={isDesktop && open ? 'quest-ask-panel' : undefined}
        aria-haspopup={isDesktop ? undefined : 'dialog'}
        data-testid="ask-pybaem"
        data-unread={unread || undefined}
      >
        <span className="qa-face" aria-hidden>
          <CharacterAvatar
            character="pybaem"
            expression={busy ? 'thinking' : expression}
            size={36}
          />
        </span>
        <span className="qa-text">
          <span className="qa-title">
            파이뱀에게 물어보기
            {unread > 0 && (
              <span className="qa-badge" data-testid="ask-unread">
                {unread}
                <span className="sr-only">개 새 이야기</span>
              </span>
            )}
          </span>
          {/* 미리 보기는 장식(같은 말을 아래 aria-live가 읽음) */}
          <span className="qa-sub" aria-hidden>
            {sub}
          </span>
        </span>
        <ChevronDown className="qa-chev" aria-hidden />
      </button>

      <p className="sr-only" aria-live="polite">
        {last ? plainPreview(last.content) : ''}
      </p>

      {isDesktop ? (
        open && (
          <div
            id="quest-ask-panel"
            className="qa-panel"
            data-testid="ask-panel"
          >
            {panel}
          </div>
        )
      ) : (
        <Sheet
          open={open}
          onOpenChange={toggle}
          title="파이뱀에게 물어보기"
          className="qa-sheet"
          closeOnBack
          data-testid="ask-sheet"
        >
          {panel}
        </Sheet>
      )}
    </div>
  );
}
