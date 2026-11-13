'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { SendHorizontal, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FREE_QUESTION_MAX_LENGTH } from '@/lib/tutor/freeQuestion';
import type { FreeAskResult } from '@/lib/quest/useQuestSession';

// 폰 키보드가 가리는 높이가 이보다 크면 "열림" (주소창이 줄어드는 정도는 무시, CodeKeyboard 와 같은 기준)
const KEYBOARD_MIN_PX = 120;

/**
 * 입력 칸에 포커스가 있고 폰 키보드가 화면 아래를 가리면 그 높이(px). 바텀시트는 layout viewport 아래에 붙어 있어
 * 크롬 안드로이드(resizes-visual)·iOS 에서 키보드 뒤에 숨으므로, 폼 아래에 이만큼 여백을 줘 칸을 키보드 위로 올린다
 * (대화 목록이 그만큼 줄어듦). 계산은 CodeKeyboard `useDockAboveKeyboard` 와 같음
 */
function useKeyboardCover(input: RefObject<HTMLInputElement | null>): number {
  const [cover, setCover] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const covered = window.innerHeight - (vv.offsetTop + vv.height);
      const focused = document.activeElement === input.current;
      setCover(
        focused && covered > KEYBOARD_MIN_PX && vv.scale <= 1
          ? Math.round(covered)
          : 0,
      );
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
    };
  }, [input]);
  return cover;
}

interface FreeQuestionFormProps {
  onSubmit: (question: string) => Promise<FreeAskResult>;
  /** 오늘 남은 수 (모르면 null — 숫자를 숨김) */
  remaining: number | null;
  /** 파이뱀이 답하는 중 */
  busy: boolean;
}

/**
 * "파이뱀에게 물어보기" 자유 질문 칸 (P9-17). 정해진 질문 버튼 아래 한 줄: 입력 칸 + 보내기.
 * 거르기는 서버가 하고(docs/tutor-free-input.md), 화면은 글자 수·개인정보 쓰지 않기 안내만 미리 보여 준다.
 * 거른 질문은 대화에 넣지 않고 칸 아래 안내(role=alert)를 띄우며 글은 남겨 고칠 수 있게 한다
 */
export function FreeQuestionForm({
  onSubmit,
  remaining,
  busy,
}: FreeQuestionFormProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  const cover = useKeyboardCover(inputRef);
  // 안내가 이야기 쪽 스크롤 아래로 숨지 않게 (데스크톱 펼침은 쪽 안에서 스크롤됨)
  useEffect(() => {
    if (note) noteRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [note]);
  const out = remaining === 0;
  const canSend = !busy && !out && text.trim().length > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    const result = await onSubmit(text);
    if (result.status === 'sent') {
      setText('');
      setNote(null);
    } else if (result.status === 'note') {
      setNote(result.message);
      inputRef.current?.focus();
    }
  };

  return (
    <form
      className="qf"
      onSubmit={submit}
      data-kb={cover > 0 || undefined}
      style={cover ? { marginBottom: cover } : undefined}
      data-testid="free-ask"
    >
      <label htmlFor={id} className="sr-only">
        파이뱀에게 직접 물어보기
      </label>
      <div className="qf-row">
        <input
          ref={inputRef}
          id={id}
          className="qf-input"
          type="text"
          value={text}
          maxLength={FREE_QUESTION_MAX_LENGTH}
          enterKeyHint="send"
          autoComplete="off"
          spellCheck={false}
          placeholder={
            out ? '오늘은 다 물어봤어요. 내일 또 만나요!' : '직접 물어봐요'
          }
          disabled={out}
          aria-invalid={note ? true : undefined}
          aria-describedby={`${id}-help${note ? ` ${id}-note` : ''}`}
          onChange={(e) => {
            setText(e.target.value);
            if (note) setNote(null);
          }}
          data-testid="free-ask-input"
        />
        <Button
          type="submit"
          size="sm"
          icon={<SendHorizontal aria-hidden />}
          disabled={!canSend}
          data-testid="free-ask-send"
        >
          보내기
        </Button>
      </div>
      {note && (
        <p
          ref={noteRef}
          id={`${id}-note`}
          className="qf-note"
          role="alert"
          data-testid="free-ask-note"
        >
          <ShieldCheck aria-hidden />
          {note}
        </p>
      )}
      <p id={`${id}-help`} className="qf-help">
        <span>파이썬 이야기만 · 이름·연락처·학교는 쓰지 않아요</span>
        <span className="qf-count" data-testid="free-ask-count">
          {remaining !== null && !out && `오늘 ${remaining}번 남음 · `}
          {text.length}/{FREE_QUESTION_MAX_LENGTH}
        </span>
      </p>
    </form>
  );
}
