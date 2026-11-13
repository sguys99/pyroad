'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import { cn } from '@/lib/utils';
import type { EditorController } from '@/lib/editor/createEditor';
import { CODE_LINE_HEIGHT } from '@/lib/editor/fontSize';
import { useCodeFontSize } from '@/lib/editor/useCodeFontSize';
import { CodeFontSizeControl } from './CodeFontSizeControl';
import { useEditorTheme } from './EditorThemeContext';
import './codeEditor.css';

// CodeMirror 구성은 src/lib/editor/createEditor.ts. 마운트한 뒤 동적 import로 받아 첫 로드 JS에서 뺀다 (P6-16):
// 받기 전(서버 HTML·하이드레이션 직후)에는 같은 코드를 같은 글꼴·크기의 글자로 보여 주고, 에디터가 오면 바꾼다

/** 바깥에서 에디터를 다루는 손잡이 (P6-04 모바일 코드 키보드가 커서 자리에 글자를 넣는다) */
export interface CodeEditorHandle {
  /** 선택 영역을 text로 바꾸고 커서를 text 안 caret 자리(기본: 끝)에 둔 뒤 포커스 */
  insert: (text: string, caret?: number) => void;
  /** 커서를 한 글자 왼쪽(-1)·오른쪽(1)으로. 모바일에서 손가락으로 커서 옮기기가 어려워서 */
  moveCursor: (dir: -1 | 1) => void;
  undo: () => void;
  focus: () => void;
  /** 커서 줄을 화면 안으로 (폰 키보드가 올라온 뒤, P6-11) */
  revealCursor: () => void;
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
  const editorRef = useRef<EditorController | null>(null);
  const [loaded, setLoaded] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const { size: fontSize, change: changeFontSize } = useCodeFontSize();
  const theme = useEditorTheme();
  // 에디터가 도착했을 때의 최신 값 (그 사이 바뀐 값·글자 크기·오류 줄도 그대로 시작)
  const latestRef = useRef({ value, fontSize, errorLine });
  latestRef.current = { value, fontSize, errorLine };

  // 에디터는 처음 마운트할 때 한 번만 만든다. 그 뒤 값은 아래 동기화 effect가 맞춘다
  useEffect(() => {
    let alive = true;
    import('@/lib/editor/createEditor').then(({ createEditor }) => {
      if (!alive || !containerRef.current) return;
      const l = latestRef.current;
      editorRef.current = createEditor(containerRef.current, {
        doc: l.value,
        fontSize: l.fontSize,
        errorLine: l.errorLine,
        onChange: (code) => onChangeRef.current(code),
      });
      setLoaded(true);
    });
    return () => {
      alive = false;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, []);

  // 바깥에서 바꾼 값을 에디터에 반영 (내용 전체 교체, 커서는 끝으로)
  useEffect(() => {
    editorRef.current?.setValue(value);
  }, [value]);

  // 글자 크기 (기기 저장소 값은 마운트 직후 들어온다)
  useEffect(() => {
    editorRef.current?.setFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    editorRef.current?.setErrorLine(errorLine);
  }, [errorLine]);

  useImperativeHandle(
    ref,
    () => ({
      insert: (text, caret) => editorRef.current?.insert(text, caret),
      moveCursor: (dir) => editorRef.current?.moveCursor(dir),
      undo: () => editorRef.current?.undo(),
      focus: () => editorRef.current?.focus(),
      revealCursor: () => editorRef.current?.revealCursor(),
    }),
    [],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* 320px처럼 한 줄에 안 들어가면 제목이 위 줄로 (P6-11) */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {title && <div className="mr-auto min-w-0">{title}</div>}
        {actions}
        <CodeFontSizeControl size={fontSize} onChange={changeFontSize} />
      </div>
      <div
        ref={containerRef}
        data-testid="code-editor"
        data-editor-loading={loaded ? undefined : ''}
        data-editor-theme={theme ?? undefined}
      >
        {!loaded && (
          <pre
            className="ce-static font-mono"
            style={{ fontSize, lineHeight: CODE_LINE_HEIGHT }}
          >
            {value}
          </pre>
        )}
      </div>
    </div>
  );
}
