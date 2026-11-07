// 종이 카드 위 코드 에디터 (진짜 CodeMirror 대신 textarea + 색칠한 pre 겹치기, P2-18에서 CodeMirror 테마로)
// D2Coding 16px(짝수 px) · 행간 1.6 · 줄 번호 · 무드보드 code 토큰 색
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';

const KEYWORDS = new Set(['if', 'elif', 'else', 'for', 'in', 'while', 'def', 'return', 'and', 'or', 'not', 'import', 'from', 'True', 'False', 'None', 'break', 'continue']);
const FUNCS = new Set(['print', 'str', 'int', 'float', 'len', 'range', 'input', 'max', 'min']);

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(#[^\n]*)|("(?:[^"\n\\]|\\.)*"?|'(?:[^'\n\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([^#"'A-Za-z_\d]+)/g;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    const [t] = m;
    if (m[1]) out.push(<span key={k++} className="tk-com">{t}</span>);
    else if (m[2]) out.push(<span key={k++} className="tk-str">{t}</span>);
    else if (m[3]) out.push(<span key={k++} className="tk-num">{t}</span>);
    else if (m[4]) {
      if (KEYWORDS.has(t)) out.push(<span key={k++} className="tk-kw">{t}</span>);
      else if (FUNCS.has(t)) out.push(<span key={k++} className="tk-fn">{t}</span>);
      else out.push(t);
    } else out.push(t);
  }
  return out;
}

export interface EditorHandle {
  insert(text: string, caretBack?: number): void;
  focus(): void;
}

export const CodeEditor = forwardRef<EditorHandle, { value: string; onChange: (v: string) => void; errorLine?: number | null; label: string; readOnly?: boolean }>(
  function CodeEditor({ value, onChange, errorLine, label, readOnly }, ref) {
    const ta = useRef<HTMLTextAreaElement | null>(null);
    const escaped = useRef(false);
    useImperativeHandle(ref, () => ({
      insert(text, caretBack = 0) {
        const el = ta.current;
        if (!el) return;
        const s = el.selectionStart ?? value.length;
        const e = el.selectionEnd ?? value.length;
        const next = value.slice(0, s) + text + value.slice(e);
        onChange(next);
        requestAnimationFrame(() => {
          el.focus({ preventScroll: true });
          const pos = s + text.length - caretBack;
          el.setSelectionRange(pos, pos);
        });
      },
      focus() {
        ta.current?.focus();
      },
    }));
    const lines = value.split('\n');
    const rows = Math.max(lines.length, 6);
    return (
      <div className="ab-editor" style={{ ['--rows' as string]: rows }}>
        <div className="ab-editor-gutter" aria-hidden>
          {Array.from({ length: rows }, (_, i) => (
            <span key={i} className={errorLine === i + 1 ? 'is-error' : undefined}>
              {i + 1}
            </span>
          ))}
        </div>
        <div className="ab-editor-code">
          <div className="ab-editor-inner">
          {errorLine ? <div className="ab-editor-errline" style={{ top: `calc(${errorLine - 1} * 1.6em + 12px)` }} aria-hidden /> : null}
          <pre className="ab-editor-pre" aria-hidden>
            {highlight(value)}
            {'\n'}
          </pre>
          <textarea
            ref={ta}
            className="ab-editor-ta"
            value={value}
            aria-label={label}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            wrap="off"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                escaped.current = true;
                return;
              }
              const esc = escaped.current;
              escaped.current = false;
              if (e.key === 'Tab' && !e.shiftKey && !readOnly && !esc) {
                // 들여쓰기. Esc를 누른 뒤의 Tab은 다음 버튼으로 포커스 이동 (키보드 갇힘 방지)
                e.preventDefault();
                const el = e.currentTarget;
                const s = el.selectionStart;
                const next = value.slice(0, s) + '    ' + value.slice(el.selectionEnd);
                onChange(next);
                requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
              }
            }}
          />
          </div>
        </div>
      </div>
    );
  },
);
