/**
 * 공책 한 줄 색칠 (P4-02). 퀘스트 에디터 색 토큰과 같은 뜻: 문자열만 `--code-string`, 나머지는 `--code-text`
 * (`print`·숫자는 에디터 테마에서도 글자색과 같다). 정규식 없이 한 번 훑는다 — 입력 길이와 비례하는 시간.
 */
export type SegmentKind = 'str' | 'plain';

export interface Segment {
  kind: SegmentKind;
  text: string;
}

export function highlightSegments(code: string): Segment[] {
  const out: Segment[] = [];
  const push = (kind: SegmentKind, text: string) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'") {
      // 같은 따옴표까지 (역슬래시 다음 글자는 건너뜀). 안 닫혔으면 끝까지
      let j = i + 1;
      while (j < code.length && code[j] !== ch) j += code[j] === '\\' ? 2 : 1;
      const end = Math.min(code.length, j + 1);
      push('str', code.slice(i, end));
      i = end;
      continue;
    }
    push('plain', ch);
    i += 1;
  }
  return out;
}

/** `at` 위치에서 조각을 둘로 나눈다 (커서를 끼우려고). 앞 조각들과 뒤 조각들 */
export function splitSegments(
  segs: readonly Segment[],
  at: number,
): [Segment[], Segment[]] {
  const before: Segment[] = [];
  const after: Segment[] = [];
  let pos = 0;
  for (const s of segs) {
    const end = pos + s.text.length;
    if (end <= at) before.push(s);
    else if (pos >= at) after.push(s);
    else {
      before.push({ kind: s.kind, text: s.text.slice(0, at - pos) });
      after.push({ kind: s.kind, text: s.text.slice(at - pos) });
    }
    pos = end;
  }
  return [before, after];
}
