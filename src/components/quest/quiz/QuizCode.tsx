import { Fragment, type ReactNode } from 'react';
import { highlightSegments } from '@/components/landing/sections/trial/highlight';

/**
 * 퀴즈 안 코드 (문제 코드·코드 보기, P7-03). 체험 공책(P4-02)과 같은 색칠 규칙(문자열만 `--code-string`)에
 * 코드 글꼴 pyRoad Mono. 읽기 전용이라 에디터(CodeMirror)는 쓰지 않음. P7-04~06 도 줄·빈칸을 그릴 때 같은 클래스를 씀
 */
export function QuizCode({
  code,
  label,
  inline = false,
  changed,
}: {
  code: string;
  /** 낭독기 이름 (예: "문제 코드"). 보기 안 코드는 생략 */
  label?: string;
  /** 보기 카드 안: 쪽지 면 없이 글자만 */
  inline?: boolean;
  /** 글자마다 바뀐 곳인지 (버그 찾기 고친 줄 미리보기, `changedChars`). 바뀐 곳은 <mark> 로 강조 */
  changed?: readonly boolean[];
}) {
  let at = 0;
  const pre = (
    <pre className="qz-code" data-inline={inline || undefined}>
      <code>
        {highlightSegments(code).map((s, i) => {
          const from = at;
          at += s.text.length;
          const body = changed ? marked(s.text, changed, from) : s.text;
          return s.kind === 'str' ? (
            <span key={i} className="qz-code-str">
              {body}
            </span>
          ) : (
            <Fragment key={i}>{body}</Fragment>
          );
        })}
      </code>
    </pre>
  );
  if (!label) return pre;
  return (
    <figure className="qz-code-fig">
      <figcaption className="sr-only">{label}</figcaption>
      {pre}
    </figure>
  );
}

/** 조각 글자를 바뀐 곳/그대로 묶음으로 나눠 바뀐 묶음만 <mark> */
function marked(
  text: string,
  changed: readonly boolean[],
  from: number,
): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  while (i < text.length) {
    const on = !!changed[from + i];
    let j = i + 1;
    while (j < text.length && !!changed[from + j] === on) j++;
    const part = text.slice(i, j);
    out.push(
      on ? (
        <mark key={i} className="qz-diff">
          {part}
        </mark>
      ) : (
        part
      ),
    );
    i = j;
  }
  return out;
}
