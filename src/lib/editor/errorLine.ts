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

export { STUDENT_FILENAME, errorLineFromStderr } from './stderrLine';

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
