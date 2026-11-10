'use client';

import { Fragment, useId } from 'react';
import { Bug, Check, X } from 'lucide-react';
import { BugBugSvg } from '@/components/characters/BugBugSvg';
import { QuizCode } from './QuizCode';
import type { OptionMark } from './MultipleChoice';
import type { QuizInputDef, QuizInputProps } from './types';

type Props = QuizInputProps<'bug_hunt'>;
type Val = Props['value'];

const LINE_TAG: Partial<Record<OptionMark, string>> = {
  correct: '정답',
  answer: '버그 줄',
  wrong: '고른 줄',
};
// 맞혔을 때 "정답"은 줄 꼬리표 하나로 (고친 줄에도 붙이면 두 번 나옴, B53)
const FIX_TAG: Partial<Record<OptionMark, string>> = {
  answer: '정답',
  wrong: '고른 수정',
  miss: '아니었어요',
};

/** 줄 하나의 표시 상태. 공개면 정답 줄이 먼저(고른 줄이 정답 줄이어도 "버그 줄"), 결과 전에는 고름 */
export function lineMark(
  id: string,
  { value, result }: { value: Val; result: Props['result'] },
): OptionMark {
  if (result) {
    if (result.status === 'correct' && result.submitted.line === id)
      return 'correct';
    if (result.status === 'revealed' && result.answer?.line === id)
      return 'answer';
    return result.submitted.line === id ? 'wrong' : 'none';
  }
  return value?.line === id ? 'selected' : 'none';
}

/** 줄 아래에 보일 수정안 미리보기 (원래 줄은 취소선). 결과 전에는 고른 수정안, 결과 뒤에는 제출한 것 + 공개 정답 */
export function linePreviews(
  id: string,
  { value, result }: { value: Val; result: Props['result'] },
): { fix: string; mark: OptionMark }[] {
  if (!result)
    return value?.line === id && value.fix
      ? [{ fix: value.fix, mark: 'selected' }]
      : [];
  const out: { fix: string; mark: OptionMark }[] = [];
  const { submitted, answer } = result;
  if (submitted.line === id)
    out.push({
      fix: submitted.fix,
      mark: result.status === 'correct' ? 'correct' : 'wrong',
    });
  if (
    result.status === 'revealed' &&
    answer?.line === id &&
    !(submitted.line === id && submitted.fix === answer.fix)
  )
    out.push({ fix: answer.fix, mark: 'answer' });
  return out;
}

const TOKEN = /[A-Za-z0-9_]+|[가-힣]+|\s+|[^]/gu;

/**
 * 고친 줄 미리보기 강조 (B53): 원래 줄과 고친 줄을 토큰(낱말·한글 낱말·공백 묶음·기호 한 글자)으로 나눠 LCS 로 견주고,
 * 고친 줄에서 원래 줄에 없던 토큰의 글자를 true 로. 따옴표 하나·괄호 하나처럼 바뀐 기호만 정확히 짚음
 */
export function changedChars(before: string, after: string): boolean[] {
  const a = before.match(TOKEN) ?? [];
  const b = after.match(TOKEN) ?? [];
  // dp[i][j] = a[i..], b[j..] 의 LCS 길이 (줄 하나라 토큰 수가 작음)
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: boolean[] = [];
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j] && dp[i][j] === dp[i + 1][j + 1] + 1) {
      out.push(...new Array<boolean>(b[j].length).fill(false));
      i++;
      j++;
    } else if (i < a.length && dp[i + 1][j] >= dp[i][j + 1]) i++;
    else {
      out.push(...new Array<boolean>(b[j].length).fill(true));
      j++;
    }
  }
  return out;
}

function MarkIcon({ mark }: { mark: OptionMark }) {
  if (mark === 'correct' || mark === 'answer') return <Check strokeWidth={3} />;
  if (mark === 'wrong' || mark === 'miss') return <X strokeWidth={3} />;
  if (mark === 'selected') return <Bug strokeWidth={2.5} />;
  return null;
}

/**
 * 버그 찾기 (P7-06). ① 코드 줄(코드 순서 그대로)에서 버그가 숨은 줄을 탭 → 그 줄 바로 아래 쪽지가 펼쳐지고
 * ② 서버가 섞은 수정안 카드 중 하나를 고르면 그 줄이 "원래 줄(취소선) → 고친 줄" 미리보기로 바뀐다.
 * 줄·수정안 모두 진짜 라디오 그룹(Tab → 방향키). 다른 줄을 고르면 수정안 선택은 비움. 값은 `{line, fix}`(고르는 중엔 fix '')
 */
export function BugHunt({
  quiz,
  value,
  onChange,
  disabled,
  result,
  misses,
  labelledBy,
}: Props) {
  const lineName = useId();
  const fixName = useId();
  const sheetId = useId();
  const code = (fixId: string) =>
    quiz.fixes.find((f) => f.id === fixId)?.code ?? '';
  const step = result ? 0 : value?.line ? 2 : 1;
  const face = result
    ? result.status === 'correct'
      ? 'fixed'
      : 'found'
    : value?.line
      ? 'found'
      : 'searching';

  return (
    <div className="qz-bh">
      <div className="qz-bh-guide">
        <span className="qz-bh-face" aria-hidden>
          <BugBugSvg expression={face} size={40} />
        </span>
        <ol className="qz-bh-steps" data-testid="bughunt-steps">
          <li
            data-on={step === 1 || undefined}
            aria-current={step === 1 ? 'step' : undefined}
          >
            1. 버그가 숨은 줄을 찾아요
          </li>
          <li aria-hidden className="qz-bh-arrow">
            →
          </li>
          <li
            data-on={step === 2 || undefined}
            aria-current={step === 2 ? 'step' : undefined}
          >
            2. 고칠 방법을 골라요
          </li>
        </ol>
      </div>

      <fieldset
        className="qz-bh-lines"
        disabled={disabled}
        aria-labelledby={labelledBy}
        data-testid="bughunt-lines"
      >
        {quiz.lines.map((l, i) => {
          const mark = lineMark(l.id, { value, result });
          const previews = linePreviews(l.id, { value, result });
          const tag = LINE_TAG[mark];
          const open = !result && value?.line === l.id;
          return (
            <Fragment key={l.id}>
              <label
                className="qz-bh-line"
                data-mark={mark}
                data-testid="bughunt-line"
              >
                <input
                  type="radio"
                  name={lineName}
                  value={l.id}
                  checked={value?.line === l.id}
                  onChange={() => onChange({ line: l.id, fix: '' })}
                  aria-controls={open ? sheetId : undefined}
                  className="qz-opt-input"
                />
                <span className="qz-bh-no font-mono">
                  <span className="sr-only">줄 </span>
                  {i + 1}
                </span>
                <span className="qz-bh-code">
                  {previews.length ? (
                    <>
                      <del className="qz-bh-del">
                        <span className="sr-only">원래 줄 </span>
                        <QuizCode code={l.code} inline />
                      </del>
                      {previews.map((p) => (
                        <ins
                          key={p.fix}
                          className="qz-bh-ins"
                          data-mark={p.mark}
                          data-testid="bughunt-preview"
                        >
                          <span className="sr-only">고친 줄 </span>
                          <QuizCode
                            code={code(p.fix)}
                            inline
                            changed={changedChars(l.code, code(p.fix))}
                          />
                          {FIX_TAG[p.mark] && (
                            <span className="qz-opt-tag">
                              {FIX_TAG[p.mark]}
                            </span>
                          )}
                        </ins>
                      ))}
                    </>
                  ) : (
                    <QuizCode code={l.code} inline />
                  )}
                  {/* 줄 꼬리표는 코드 아래: 360px 에서 코드 폭을 지킴 */}
                  {tag && <span className="qz-opt-tag qz-bh-tag">{tag}</span>}
                </span>
                <span className="qz-opt-mark qz-bh-mark" aria-hidden>
                  <MarkIcon mark={mark} />
                </span>
              </label>
              {open && (
                <fieldset
                  id={sheetId}
                  className="qz-bh-sheet"
                  data-testid="bughunt-fixes"
                >
                  <legend className="qz-bh-legend">
                    {i + 1}번 줄을 어떻게 고칠까요?
                  </legend>
                  {quiz.fixes.map((f) => {
                    const miss = misses.some(
                      (m) => m.line === l.id && m.fix === f.id,
                    );
                    const fm: OptionMark =
                      value.fix === f.id ? 'selected' : miss ? 'miss' : 'none';
                    return (
                      <label
                        key={f.id}
                        className="qz-opt"
                        data-mark={fm}
                        data-code
                        data-testid="bughunt-fix"
                      >
                        <input
                          type="radio"
                          name={fixName}
                          value={f.id}
                          checked={value.fix === f.id}
                          disabled={miss}
                          onChange={() => onChange({ line: l.id, fix: f.id })}
                          className="qz-opt-input"
                        />
                        <span className="qz-opt-mark" aria-hidden>
                          <MarkIcon mark={fm === 'miss' ? 'miss' : 'none'} />
                        </span>
                        <span className="qz-opt-body">
                          <QuizCode code={f.code} inline />
                        </span>
                        {FIX_TAG[fm] && (
                          <span className="qz-opt-tag">{FIX_TAG[fm]}</span>
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </Fragment>
          );
        })}
      </fieldset>
    </div>
  );
}

export const bugHuntInput: QuizInputDef<'bug_hunt'> = {
  Input: BugHunt,
  isComplete: (value, quiz) =>
    !!value &&
    quiz.lines.some((l) => l.id === value.line) &&
    quiz.fixes.some((f) => f.id === value.fix),
  label: '버그 찾기',
};
