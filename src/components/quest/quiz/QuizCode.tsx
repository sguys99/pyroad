import { highlightSegments } from '@/components/landing/sections/trial/highlight';

/**
 * 퀴즈 안 코드 (문제 코드·코드 보기, P7-03). 체험 공책(P4-02)과 같은 색칠 규칙(문자열만 `--code-string`)에
 * 코드 글꼴 pyRoad Mono. 읽기 전용이라 에디터(CodeMirror)는 쓰지 않음. P7-04~06 도 줄·빈칸을 그릴 때 같은 클래스를 씀
 */
export function QuizCode({
  code,
  label,
  inline = false,
}: {
  code: string;
  /** 낭독기 이름 (예: "문제 코드"). 보기 안 코드는 생략 */
  label?: string;
  /** 보기 카드 안: 쪽지 면 없이 글자만 */
  inline?: boolean;
}) {
  const pre = (
    <pre className="qz-code" data-inline={inline || undefined}>
      <code>
        {highlightSegments(code).map((s, i) =>
          s.kind === 'str' ? (
            <span key={i} className="qz-code-str">
              {s.text}
            </span>
          ) : (
            s.text
          ),
        )}
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
