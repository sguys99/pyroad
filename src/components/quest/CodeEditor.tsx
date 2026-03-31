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
  initialCode: string;
  onChange: (code: string) => void;
  className?: string;
}

export function CodeEditor({ initialCode, onChange, className }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: initialCode,
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
    // initialCode는 최초 마운트 시에만 사용
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
