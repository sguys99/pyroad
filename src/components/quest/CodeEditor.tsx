'use client';

import {
  useRef,
  useEffect,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from 'react';
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
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
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
import { cn } from '@/lib/utils';
import { codeFontSizeTheme, kidsTheme } from '@/lib/editor/kidsTheme';
import { errorLineExtension, setErrorLine } from '@/lib/editor/errorLine';
import { useCodeFontSize } from '@/lib/editor/useCodeFontSize';
import { CodeFontSizeControl } from './CodeFontSizeControl';

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
  autocompletion(),
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

/** 바깥에서 에디터를 다루는 손잡이 (P6-04 모바일 코드 키보드가 커서 자리에 글자를 넣는다) */
export interface CodeEditorHandle {
  /** 선택 영역을 text로 바꾸고 커서를 text 안 caret 자리(기본: 끝)에 둔 뒤 포커스 */
  insert: (text: string, caret?: number) => void;
  focus: () => void;
}

interface CodeEditorProps {
  /**
   * 에디터에 보일 코드. 타자로 바뀐 값은 onChange로 올라가서 그대로 돌아오고(변화 없음),
   * 바깥에서 바꾼 값(황금키 정답, 다음 단계 시작 코드)은 에디터 내용을 바꾼다 (P1-09)
   */
  value: string;
  onChange: (code: string) => void;
  /** 실행 오류가 난 줄(1부터). 바뀔 때마다 그 줄을 표시하고, 학생이 코드를 고치기 시작하면 지운다 */
  errorLine?: number | null;
  /** 머리 줄 왼쪽 (공책 제목). 글자 크기 버튼과 한 줄에 놓인다 */
  title?: ReactNode;
  /** 머리 줄에서 글자 크기 버튼 앞 (처음 코드로 등) */
  actions?: ReactNode;
  ref?: Ref<CodeEditorHandle>;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  errorLine = null,
  title,
  actions,
  ref,
  className,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // 에디터는 처음 마운트할 때 한 번만 만든다. 그 뒤 값은 아래 동기화 effect가 맞춘다
  const initialValueRef = useRef(value);
  const fontSizeCompartment = useRef(new Compartment());
  const { size: fontSize, change: changeFontSize } = useCodeFontSize();
  const initialFontSizeRef = useRef(fontSize);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        setup,
        python(),
        EditorState.tabSize.of(4),
        kidsTheme(),
        fontSizeCompartment.current.of(
          codeFontSizeTheme(initialFontSizeRef.current),
        ),
        errorLineExtension(),
        EditorView.contentAttributes.of({ 'aria-label': '파이썬 코드' }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // 바깥에서 바꾼 값을 에디터에 반영 (내용 전체 교체, 커서는 끝으로)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      selection: { anchor: value.length },
    });
  }, [value]);

  // 글자 크기 (기기 저장소 값은 마운트 직후 들어온다)
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: fontSizeCompartment.current.reconfigure(
        codeFontSizeTheme(fontSize),
      ),
    });
  }, [fontSize]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setErrorLine.of(errorLine) });
  }, [errorLine]);

  useImperativeHandle(
    ref,
    () => ({
      insert(text, caret = text.length) {
        const view = viewRef.current;
        if (!view) return;
        const { from } = view.state.selection.main;
        view.dispatch({
          ...view.state.replaceSelection(text),
          selection: { anchor: from + caret },
          scrollIntoView: true,
          userEvent: 'input.type',
        });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
    }),
    [],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-end gap-1">
        {title && <div className="mr-auto min-w-0">{title}</div>}
        {actions}
        <CodeFontSizeControl size={fontSize} onChange={changeFontSize} />
      </div>
      <div ref={containerRef} data-testid="code-editor" />
    </div>
  );
}
