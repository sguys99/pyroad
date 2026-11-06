import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutterLineClass,
} from '@codemirror/view';

/**
 * 오류 줄 표시 (P2-18). 실행 결과의 traceback에서 학생 코드 줄 번호를 찾아 그 줄에 옅은 빨강 띠 + 아래 2px 선,
 * 줄 번호 칸은 빨강 글자로 칠한다(최종 시안 `.f-errband`·`.f-gutter .is-err`). 색만이 아니라 밑줄로도 구분된다.
 * 학생이 코드를 고치기 시작하면(문서 변경) 표시를 지운다. 다음 실행 결과가 다시 정한다
 */

/** traceback에 보이는 학생 코드 파일 이름. `public/workers/pyodide-core.mjs`의 `STUDENT_FILENAME`과 같아야 한다 */
export const STUDENT_FILENAME = '<exec>';

const FRAME_RE = new RegExp(
  `File "${STUDENT_FILENAME.replace(/[<>]/g, '\\$&')}", line (\\d+)`,
  'g',
);

/**
 * stderr에서 오류가 난 학생 코드 줄(1부터). 학생 코드 프레임이 여러 개면(함수 호출) 가장 안쪽 = 마지막 것.
 * 경고(`<exec>:2: SyntaxWarning`)나 학생이 직접 쓴 stderr에는 프레임이 없어 null
 */
export function errorLineFromStderr(stderr: string | null | undefined) {
  if (!stderr) return null;
  let line: number | null = null;
  for (const m of stderr.matchAll(FRAME_RE)) line = Number(m[1]);
  return line && line > 0 ? line : null;
}

/** 오류 줄을 정한다 (null = 지움) */
export const setErrorLine = StateEffect.define<number | null>();

const errorLineField = StateField.define<number | null>({
  create: () => null,
  update(line, tr) {
    let next = tr.docChanged ? null : line;
    for (const e of tr.effects) if (e.is(setErrorLine)) next = e.value;
    return next;
  },
});

const lineDeco = Decoration.line({
  class: 'cm-errorLine',
  attributes: { 'data-error-line': 'true' },
});

class ErrorGutterMarker extends GutterMarker {
  elementClass = 'cm-errorLineGutter';
}
const errorGutterMarker = new ErrorGutterMarker();

function lineStart(state: EditorState): number | null {
  const n = state.field(errorLineField);
  if (n == null || n > state.doc.lines) return null;
  return state.doc.line(n).from;
}

/** 오류 줄 표시 확장. 색은 키즈 테마(`.cm-errorLine`·`.cm-errorLineGutter`)가 정한다 */
export function errorLineExtension(): Extension {
  return [
    errorLineField,
    EditorView.decorations.compute([errorLineField], (state) => {
      const from = lineStart(state);
      return from == null
        ? Decoration.none
        : Decoration.set([lineDeco.range(from)]);
    }),
    gutterLineClass.compute([errorLineField], (state) => {
      const from = lineStart(state);
      return from == null
        ? RangeSet.empty
        : RangeSet.of([errorGutterMarker.range(from)]);
    }),
  ];
}
