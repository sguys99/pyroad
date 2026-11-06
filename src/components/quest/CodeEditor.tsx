'use client';

import { useRef, useEffect } from 'react';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { basicSetup } from 'codemirror';
import { cn } from '@/lib/utils';
import { cssVar } from '@/lib/design/tokens';

// 글꼴은 pyRoad Mono(D2Coding, 한글 = 영문 2칸) 토큰만 쓴다 (P2-10). CodeMirror 기본 테마가 `.cm-scroller`에
// `monospace`를 직접 넣으므로 거기도 덮는다. 리거처는 끈다(`!=`가 한 글자처럼 보이지 않게, P0-14 §4.6).
// D2Coding은 짝수 px에서만 한글 2칸이 정확히 맞는다(15px는 3px 어긋남, P2-01). 키즈 테마는 P2-18
// 색은 디자인 토큰 CSS 변수(cssVar)를 가리킨다 → 토큰 값이 바뀌어도 여기는 그대로 (P2-09)
const tint = (name: Parameters<typeof cssVar>[0], pct: number) =>
  `color-mix(in srgb, ${cssVar(name)} ${pct}%, transparent)`;

const pyRoadTheme = EditorView.theme({
  '&': {
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
    fontVariantLigatures: 'none',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    caretColor: cssVar('primary'),
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: cssVar('surface2'),
    borderRight: `var(--line-w) solid ${cssVar('line')}`,
    color: cssVar('textMuted'),
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: `${tint('primary', 18)} !important`,
  },
  '.cm-activeLine': {
    backgroundColor: tint('primary', 6),
  },
  '.cm-activeLineGutter': {
    backgroundColor: tint('primary', 10),
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
