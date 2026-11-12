// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';
import { CODE_FONT_SIZE_STORAGE_KEY } from '@/lib/editor/fontSize';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/**
 * CodeMirror는 마운트 뒤 동적 import로 온다 (P6-16). .cm-editor는 setLoaded 렌더보다 먼저 붙으므로
 * 준비 신호는 data-editor-loading이 빠진 것까지 (B68)
 */
const editorReady = (c: HTMLElement) =>
  waitFor(() => {
    expect(c.querySelector('.cm-editor')).not.toBeNull();
    expect(c.querySelector('[data-editor-loading]')).toBeNull();
  });

const editorText = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.cm-line'))
    .map((line) => line.textContent)
    .join('\n');

describe('CodeEditor 늦게 오는 CodeMirror (P6-16)', () => {
  it('에디터가 오기 전에도 같은 코드가 글자로 보이고, 오면 에디터로 바뀐다', async () => {
    const { container } = render(
      <CodeEditor value={'print("안녕")'} onChange={vi.fn()} />,
    );
    expect(container.querySelector('.ce-static')?.textContent).toBe(
      'print("안녕")',
    );
    await editorReady(container);
    expect(container.querySelector('.ce-static')).toBeNull();
    expect(editorText(container)).toBe('print("안녕")');
  });
});

describe('CodeEditor 값 동기화 (P1-09: 황금키 정답·다음 단계 코드가 에디터에 보이게)', () => {
  it('바깥에서 value를 바꾸면 에디터 내용이 바뀌고 onChange로 같은 값을 알린다', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CodeEditor value="x = ___" onChange={onChange} />,
    );
    await editorReady(container);
    expect(editorText(container)).toBe('x = ___');

    rerender(<CodeEditor value={'x = 10\nprint(x)'} onChange={onChange} />);
    expect(editorText(container)).toBe('x = 10\nprint(x)');
    expect(onChange).toHaveBeenLastCalledWith('x = 10\nprint(x)');
  });

  it('값이 에디터 내용과 같으면(타자로 바뀐 값이 돌아온 경우) 다시 쓰지 않는다', async () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CodeEditor value="a" onChange={onChange} />,
    );
    await editorReady(container);
    rerender(<CodeEditor value="a" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CodeEditor 오류 줄 표시 (P2-18)', () => {
  const code = 'a = 1\nprint(b)\nc = 3';

  it('errorLine 줄에 띠와 줄 번호 표시를 붙이고, 범위 밖이면 붙이지 않는다', async () => {
    const { container, rerender } = render(
      <CodeEditor value={code} onChange={vi.fn()} errorLine={2} />,
    );
    await editorReady(container);
    const marked = container.querySelectorAll('.cm-line[data-error-line]');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe('print(b)');
    expect(
      container.querySelector('.cm-gutterElement.cm-errorLineGutter')
        ?.textContent,
    ).toBe('2');

    rerender(<CodeEditor value={code} onChange={vi.fn()} errorLine={9} />);
    expect(
      container.querySelectorAll('.cm-line[data-error-line]'),
    ).toHaveLength(0);
  });

  it('코드가 바뀌면(학생이 고치기 시작) 표시를 지운다', async () => {
    const { container, rerender } = render(
      <CodeEditor value={code} onChange={vi.fn()} errorLine={2} />,
    );
    await editorReady(container);
    rerender(
      <CodeEditor value={`${code}\n`} onChange={vi.fn()} errorLine={2} />,
    );
    expect(
      container.querySelectorAll('.cm-line[data-error-line]'),
    ).toHaveLength(0);
  });
});

describe('CodeEditor 글자 크기 (P2-18)', () => {
  const sizeOf = (c: HTMLElement) =>
    c.querySelector('.cm-editor')?.getAttribute('data-code-font-size');

  it('기본 16px, 버튼으로 짝수 단계만 오가고 기기에 저장한다', async () => {
    const { container, getByRole } = render(
      <CodeEditor value="x" onChange={vi.fn()} />,
    );
    await editorReady(container);
    expect(sizeOf(container)).toBe('16');
    const larger = getByRole('button', { name: '코드 글자 크게' });
    const smaller = getByRole('button', { name: '코드 글자 작게' });

    fireEvent.click(larger);
    expect(sizeOf(container)).toBe('18');
    fireEvent.click(larger);
    expect(sizeOf(container)).toBe('20');
    expect((larger as HTMLButtonElement).disabled).toBe(true);
    expect(window.localStorage.getItem(CODE_FONT_SIZE_STORAGE_KEY)).toBe('20');

    fireEvent.click(smaller);
    fireEvent.click(smaller);
    fireEvent.click(smaller);
    expect(sizeOf(container)).toBe('14');
    expect((smaller as HTMLButtonElement).disabled).toBe(true);
  });

  it('저장된 크기로 시작하고, 홀수 px 같은 잘못된 값은 기본값', async () => {
    window.localStorage.setItem(CODE_FONT_SIZE_STORAGE_KEY, '18');
    const first = render(<CodeEditor value="x" onChange={vi.fn()} />);
    await editorReady(first.container);
    expect(sizeOf(first.container)).toBe('18');
    first.unmount();

    window.localStorage.setItem(CODE_FONT_SIZE_STORAGE_KEY, '15');
    const second = render(<CodeEditor value="x" onChange={vi.fn()} />);
    await editorReady(second.container);
    expect(sizeOf(second.container)).toBe('16');
  });
});
