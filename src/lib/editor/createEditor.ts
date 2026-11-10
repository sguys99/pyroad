// CodeMirror 에디터 만들기 (P6-16). `CodeEditor`가 마운트한 뒤 동적 import로 받는다 — CodeMirror(약 150KB gzip)가
// 퀘스트 첫 로드 JS에 들어가지 않고 하이드레이션과 따로 받아진다. 받기 전에는 `CodeEditor`가 같은 코드를 글자로 보여 준다
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import {
  cursorCharLeft,
  cursorCharRight,
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  isolateHistory,
  undo as undoCommand,
} from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { python } from '@codemirror/lang-python';

// 키즈 테마·글꼴·글자 크기 규칙은 src/lib/editor/ (P2-18, docs/design/editor.md).
// 구성은 `codemirror`의 basicSetup에서 접기 칸(▸)만 뺀 것: 시안의 공책에는 접기가 없고 아이에게는 잡음이다.
// 줄 바꿈(lineWrapping)은 하지 않는다(최종 시안과 같이 가로 스크롤): 좁은 화면에서 한글 주석이 글자 중간에서 꺾여
// 주석 정렬이 깨지고, 꺾인 줄이 0칸에서 시작해 파이썬 들여쓰기처럼 보인다
const setup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    ...closeBracketsKeymap,
    indentWithTab,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...completionKeymap,
  ]),
];

import { codeFontSizeTheme, kidsTheme } from './kidsTheme';
import { errorLineExtension, setErrorLine } from './errorLine';
import { keyboardInset } from './keyboardInset';
import type { CodeFontSize } from './fontSize';

export interface EditorController {
  /** 바깥에서 바꾼 값 반영 (내용 전체 교체, 커서는 끝으로). 같으면 아무것도 안 함 */
  setValue: (value: string) => void;
  setFontSize: (size: CodeFontSize) => void;
  setErrorLine: (line: number | null) => void;
  insert: (text: string, caret?: number) => void;
  moveCursor: (dir: -1 | 1) => void;
  undo: () => void;
  focus: () => void;
  revealCursor: () => void;
  destroy: () => void;
}

export function createEditor(
  parent: HTMLElement,
  opts: {
    doc: string;
    fontSize: CodeFontSize;
    errorLine: number | null;
    onChange: (code: string) => void;
  },
): EditorController {
  const fontSizeCompartment = new Compartment();
  const state = EditorState.create({
    doc: opts.doc,
    // 커서는 끝에서 시작 (값 동기화와 같음): 에디터를 누르기 전에 코드 키보드로 넣어도 시작 코드 뒤에 붙는다
    selection: { anchor: opts.doc.length },
    extensions: [
      setup,
      // 터치 화면: 자동 완성 목록은 눌러서 고르고 Enter는 늘 줄바꿈 (폰 키보드 Enter가 목록을 골라 줄이 안 바뀌던 문제, P6-04 메모 → P6-11).
      // 기본 키맵을 끄면 setup의 defaultKeymap Enter(줄바꿈)가 completionKeymap Enter보다 먼저다. Esc로 닫기는 그대로
      autocompletion({
        defaultKeymap: !window.matchMedia?.('(pointer: coarse)').matches,
      }),
      // 폰 키보드 + 코드 키보드가 가린 만큼 커서 줄을 위로 (P6-11, CodeKeyboard가 잼)
      EditorView.scrollMargins.of(() => ({ bottom: keyboardInset() })),
      python(),
      EditorState.tabSize.of(4),
      kidsTheme(),
      fontSizeCompartment.of(codeFontSizeTheme(opts.fontSize)),
      errorLineExtension(),
      EditorView.contentAttributes.of({ 'aria-label': '파이썬 코드' }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) opts.onChange(update.state.doc.toString());
      }),
    ],
  });
  const view = new EditorView({ state, parent });
  if (opts.errorLine != null)
    view.dispatch({ effects: setErrorLine.of(opts.errorLine) });

  return {
    setValue(value) {
      const current = view.state.doc.toString();
      if (current === value) return;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        selection: { anchor: value.length },
      });
    },
    setFontSize(size) {
      view.dispatch({
        effects: fontSizeCompartment.reconfigure(codeFontSizeTheme(size)),
      });
    },
    setErrorLine(line) {
      view.dispatch({ effects: setErrorLine.of(line) });
    },
    insert(text, caret = text.length) {
      const { from } = view.state.selection.main;
      view.dispatch({
        ...view.state.replaceSelection(text),
        selection: { anchor: from + caret },
        scrollIntoView: true,
        userEvent: 'input.type',
        // 키 한 번 = 되돌리기 한 번 (빠르게 누른 키들이 한 덩어리로 지워지지 않게)
        annotations: isolateHistory.of('full'),
      });
      view.focus();
    },
    moveCursor(dir) {
      (dir < 0 ? cursorCharLeft : cursorCharRight)(view);
      view.focus();
    },
    undo() {
      undoCommand(view);
      view.focus();
    },
    focus: () => view.focus(),
    revealCursor() {
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.selection.main.head, {
          y: 'nearest',
        }),
      });
    },
    destroy: () => view.destroy(),
  };
}
