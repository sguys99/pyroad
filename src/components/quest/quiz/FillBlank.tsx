'use client';

import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { Check, Eraser, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { highlightSegments } from '@/components/landing/sections/trial/highlight';
import { QUIZ_BLANK_RE } from '@/lib/quest/questKind';
import type { QuizInputDef, QuizInputProps, QuizOf } from './types';

type Fill = Record<string, string>;
/** 빈칸 하나의 표시 상태. 결과는 색 + 아이콘 + 낭독 글자로 */
export type SlotMark =
  | 'empty'
  | 'active'
  | 'filled'
  | 'correct'
  | 'wrong'
  | 'answer';

/** 코드의 빈칸 id (나온 차례). 화면 번호는 차례 + 1 */
export function blankIds(code: string): string[] {
  return [...code.matchAll(QUIZ_BLANK_RE)].map((m) => m[1]);
}

/**
 * 지금 채울 빈칸: 고른 빈칸이 비어 있으면 그것, 아니면 첫 빈 빈칸, 다 찼으면 null.
 * 값이 밖에서 바뀌어도(다시 풀기 → null) 고른 것이 틀어지지 않게 그때그때 셈
 */
export function targetBlank(
  blanks: readonly string[],
  value: Fill | null,
  picked: string | null,
): string | null {
  const empty = (b: string) => !value?.[b];
  if (picked && blanks.includes(picked) && empty(picked)) return picked;
  return blanks.find(empty) ?? null;
}

/** 칩을 `blank`에 넣은 새 값과 다음 채울 빈칸 (뒤쪽 빈 빈칸 먼저, 없으면 앞쪽) */
export function fillBlank(
  blanks: readonly string[],
  value: Fill | null,
  blank: string,
  token: string,
): { value: Fill; next: string | null } {
  const v = { ...value, [blank]: token };
  const i = blanks.indexOf(blank);
  const order = [...blanks.slice(i + 1), ...blanks.slice(0, i)];
  return { value: v, next: order.find((b) => !v[b]) ?? null };
}

/** 빈칸에서 칩을 빼낸 값 (되돌리기) */
export function clearBlank(value: Fill | null, blank: string): Fill {
  const v = { ...value };
  delete v[blank];
  return v;
}

const SR: Record<SlotMark, string> = {
  empty: '지금 비어 있어요',
  active: '지금 비어 있어요, 여기에 넣을 차례예요',
  filled: '들어 있어요. 누르면 빼요',
  correct: '맞았어요',
  wrong: '넣은 낱말',
  answer: '정답',
};

/**
 * 빈칸 채우기 (P7-04). 코드 안 빈칸 버튼 + 아래 낱말 칩 트레이(서버가 섞은 순서).
 * 칩을 누르면 "지금 채울" 빈칸(강조)에 들어가고 다음 빈 빈칸으로 넘어감. 찬 빈칸을 누르면 칩이 트레이로 돌아가고(되돌리기)
 * 빈 빈칸을 누르면 그 빈칸을 고름. 스키마가 같은 토큰을 여러 빈칸에 쓰는 정답을 막지 않아서 칩은 소모되지 않고
 * "쓰는 중"으로 흐려질 뿐 다시 누를 수 있음. 칩이 빈칸으로 날아가는 연출은 CSS(연출 단계·동작 줄이기)가 길이를 정함
 */
export function FillBlank({
  quiz,
  value,
  onChange,
  disabled,
  result,
}: QuizInputProps<'fill_blank'>) {
  const parts = quiz.code.split(QUIZ_BLANK_RE);
  const blanks = blankIds(quiz.code);
  const textOf = new Map(quiz.tokens.map((t) => [t.id, t.text]));
  const [picked, setPicked] = useState<string | null>(null);
  const target = disabled ? null : targetBlank(blanks, value, picked);
  const shown: Fill | null = result
    ? result.status === 'revealed'
      ? result.answer
      : result.submitted
    : value;
  const used = new Set(Object.values(value ?? {}));

  // 날아가는 연출 (FLIP): 누른 칩 자리에서 빈칸 자리로 transform 만 옮김
  const root = useRef<HTMLDivElement>(null);
  const fly = useRef<{ blank: string; from: DOMRect } | null>(null);
  useLayoutEffect(() => {
    const f = fly.current;
    fly.current = null;
    const html = document.documentElement.dataset;
    if (!f || html.motion === 'minimal' || html.reduced === 'true') return;
    const el = root.current?.querySelector<HTMLElement>(
      `[data-blank="${f.blank}"] .qz-fb-word`,
    );
    if (!el) return;
    const to = el.getBoundingClientRect();
    el.style.transform = `translate(${f.from.left - to.left}px, ${f.from.top - to.top}px)`;
    el.getBoundingClientRect(); // 시작 자리 확정 뒤 transition 으로 제자리
    el.dataset.fly = '';
    el.style.transform = '';
    const done = () => delete el.dataset.fly;
    el.addEventListener('transitionend', done, { once: true });
  }, [value]);

  const pickChip = (token: string, chip: HTMLElement) => {
    if (!target) return;
    const r = fillBlank(blanks, value, target, token);
    fly.current = { blank: target, from: chip.getBoundingClientRect() };
    setPicked(r.next);
    onChange(r.value);
  };
  const tapSlot = (blank: string) => {
    if (value?.[blank]) onChange(clearBlank(value, blank));
    setPicked(blank);
  };

  const markOf = (b: string): SlotMark => {
    if (result) {
      if (result.status === 'correct') return 'correct';
      return result.status === 'revealed' ? 'answer' : 'wrong';
    }
    if (value?.[b]) return 'filled';
    return b === target ? 'active' : 'empty';
  };

  return (
    <div className="qz-fb" ref={root}>
      <figure className="qz-code-fig">
        <figcaption className="sr-only">문제 코드</figcaption>
        <pre className="qz-code qz-fb-code">
          <code>
            {parts.map((s, i) => {
              if (i % 2 === 0)
                return (
                  <Fragment key={i}>
                    {highlightSegments(s).map((seg, j) =>
                      seg.kind === 'str' ? (
                        <span key={j} className="qz-code-str">
                          {seg.text}
                        </span>
                      ) : (
                        seg.text
                      ),
                    )}
                  </Fragment>
                );
              const n = (i + 1) / 2;
              const mark = markOf(s);
              const word = shown?.[s] ? textOf.get(shown[s]) : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  className="qz-fb-slot"
                  data-blank={s}
                  data-mark={mark}
                  data-testid="quiz-blank"
                  disabled={disabled}
                  aria-current={mark === 'active' || undefined}
                  aria-label={`빈칸 ${n}, ${word ? `${word} ` : ''}${SR[mark]}`}
                  onClick={() => tapSlot(s)}
                >
                  {(mark === 'correct' || mark === 'answer') && (
                    <Check aria-hidden strokeWidth={3} />
                  )}
                  {mark === 'wrong' && <X aria-hidden strokeWidth={3} />}
                  <span className="qz-fb-word">{word ?? n}</span>
                </button>
              );
            })}
          </code>
        </pre>
      </figure>
      <div
        className="qz-fb-tray"
        role="group"
        aria-label="넣을 낱말"
        data-testid="quiz-tokens"
      >
        {quiz.tokens.map((t) => (
          <button
            key={t.id}
            type="button"
            className="qz-fb-chip"
            data-used={used.has(t.id) || undefined}
            data-testid="quiz-token"
            disabled={disabled}
            // 빈칸이 다 차면 누를 곳이 없지만 disabled 로 바꾸지 않음: 방금 누른 칩에서 초점이 body 로 빠지지 않게 (P7-13)
            aria-disabled={!disabled && !target ? true : undefined}
            aria-label={used.has(t.id) ? `${t.text}, 쓰는 중` : undefined}
            onClick={(e) => pickChip(t.id, e.currentTarget)}
          >
            {used.has(t.id) && <Check aria-hidden strokeWidth={3} />}
            <code>{t.text}</code>
          </button>
        ))}
      </div>
      {!result && (
        <Button
          variant="ghost"
          size="sm"
          className="qz-fb-clear"
          icon={<Eraser aria-hidden />}
          disabled={disabled || used.size === 0}
          onClick={() => {
            setPicked(null);
            onChange({});
          }}
          data-testid="quiz-clear"
        >
          모두 지우기
        </Button>
      )}
    </div>
  );
}

export const fillBlankInput: QuizInputDef<'fill_blank'> = {
  Input: FillBlank,
  isComplete: (value, quiz: QuizOf<'fill_blank'>) => {
    const ids = new Set(quiz.tokens.map((t) => t.id));
    return (
      value != null &&
      blankIds(quiz.code).every((b) => value[b] != null && ids.has(value[b]))
    );
  },
  label: '빈칸 채우기',
};
