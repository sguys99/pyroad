'use client';

import { useRef, useEffect } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { basicSetup } from 'codemirror';
import { cn } from '@/lib/utils';

const pyRoadTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    caretColor: 'oklch(0.6 0.16 145)',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'oklch(0.94 0.01 85)',
    borderRight: '1px solid oklch(0.88 0.02 85)',
    color: 'oklch(0.6 0.02 85)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'oklch(0.6 0.16 145 / 0.15) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'oklch(0.6 0.16 145 / 0.05)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'oklch(0.6 0.16 145 / 0.1)',
  },
});

interface CodeEditorProps {
  /**
   * 에디터에 보일 코드. 타자로 바뀐 값은 onChange로 올라가서 그대로 돌아오고(변화 없음),
   * 바깥에서 바꾼 값(황금키 정답, 다음 단계 시작 코드)은 에디터 내용을 바꾼다 (P1-09)
   */
  value: string;
  onChange: (code: string) => void;
  className?: string;
}

export function CodeEditor({ value, onChange, className }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // 에디터는 처음 마운트할 때 한 번만 만든다. 그 뒤 값은 아래 동기화 effect가 맞춘다
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        python(),
        keymap.of([indentWithTab, ...defaultKeymap]),
        EditorState.tabSize.of(4),
        EditorView.lineWrapping,
        pyRoadTheme,
        lineNumbers(),
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

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-hidden rounded-lg border border-border [&_.cm-editor]:max-h-[400px] [&_.cm-editor]:min-h-[200px] [&_.cm-scroller]:overflow-auto',
        className,
      )}
    />
  );
}
