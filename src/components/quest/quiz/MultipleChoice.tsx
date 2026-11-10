'use client';

import { useId } from 'react';
import { Check, X } from 'lucide-react';
import { QuizCode } from './QuizCode';
import type { QuizInputDef, QuizInputProps } from './types';

/** 보기 하나의 표시 상태. 색과 함께 아이콘 + 글자 꼬리표로도 보임 */
export type OptionMark =
  | 'none'
  | 'selected'
  | 'correct'
  | 'wrong'
  | 'answer'
  | 'miss';

const TAG: Partial<Record<OptionMark, string>> = {
  correct: '정답',
  answer: '정답',
  wrong: '고른 답',
  miss: '아니었어요',
};

export function optionMark(
  id: string,
  {
    value,
    result,
    misses,
  }: Pick<QuizInputProps<'multiple_choice'>, 'value' | 'result' | 'misses'>,
): OptionMark {
  if (result) {
    if (result.status === 'correct' && result.submitted === id)
      return 'correct';
    if (result.status === 'revealed' && result.answer === id) return 'answer';
    if (result.submitted === id) return 'wrong';
  }
  if (misses.includes(id)) return 'miss';
  return value === id ? 'selected' : 'none';
}

/**
 * 보기 글자 모양 (content/README 객관식 절): 출력 예측형(문제에 code 가 있으면 보기는 출력)은 "출력 모양"(코드 글꼴·문법 색 없음·줄마다 ↵, B53),
 * `로 감싼 글자 · 여러 줄이면 pyRoad Mono 코드, 아니면 보통 글자
 */
export function optionCode(
  text: string,
  hasCode: boolean,
): { code: boolean; output: boolean; text: string } {
  const fenced = /^`([^`]+)`$/.exec(text.trim());
  if (fenced) return { code: true, output: false, text: fenced[1] };
  if (hasCode) return { code: true, output: true, text };
  return { code: text.includes('\n'), output: false, text };
}

/** 출력 모양 보기: 줄마다 한 줄, 다음 줄이 있으면 끝에 ↵ (낭독기는 "줄 바꿈") */
function OutputText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <span className="qz-out font-mono">
      {lines.map((l, i) => (
        <span key={i} className="qz-out-line">
          {l}
          {i < lines.length - 1 && (
            <>
              <span className="qz-out-nl" aria-hidden>
                ↵
              </span>
              <span className="sr-only">, 줄 바꿈, </span>
            </>
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * 객관식 (P7-03). 서버가 섞어 준 순서 그대로 큰 보기 카드(쪽 폭 30rem 미만 1열, 넓으면 2열).
 * 진짜 라디오 버튼이라 Tab 으로 들어와 방향키로 고르고(브라우저 기본), 낭독기는 "N개 중 M번째"를 읽는다. 값은 보기 id
 */
export function MultipleChoice({
  quiz,
  value,
  onChange,
  disabled,
  result,
  misses,
  labelledBy,
}: QuizInputProps<'multiple_choice'>) {
  const name = useId();
  const hasCode = !!quiz.code;
  return (
    <div className="qz-mc">
      {quiz.code && <QuizCode code={quiz.code} label="문제 코드" />}
      <fieldset
        className="qz-opts"
        disabled={disabled}
        aria-labelledby={labelledBy}
        data-testid="quiz-options"
      >
        {quiz.options.map((o) => {
          const mark = optionMark(o.id, { value, result, misses });
          const shown = optionCode(o.text, hasCode);
          const tag = TAG[mark];
          return (
            <label
              key={o.id}
              className="qz-opt"
              data-mark={mark}
              data-code={shown.code || undefined}
              data-testid="quiz-option"
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={value === o.id}
                disabled={mark === 'miss'}
                onChange={() => onChange(o.id)}
                className="qz-opt-input"
              />
              <span className="qz-opt-mark" aria-hidden>
                {mark === 'correct' || mark === 'answer' ? (
                  <Check strokeWidth={3} />
                ) : mark === 'wrong' || mark === 'miss' ? (
                  <X strokeWidth={3} />
                ) : null}
              </span>
              <span className="qz-opt-body">
                {shown.output ? (
                  <OutputText text={shown.text} />
                ) : shown.code ? (
                  <QuizCode code={shown.text} inline />
                ) : (
                  shown.text
                )}
              </span>
              {tag && <span className="qz-opt-tag">{tag}</span>}
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

export const multipleChoiceInput: QuizInputDef<'multiple_choice'> = {
  Input: MultipleChoice,
  isComplete: (value, quiz) =>
    value != null && quiz.options.some((o) => o.id === value),
  label: '객관식',
};
