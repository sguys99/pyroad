// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { CodeEditor } from '../CodeEditor';

afterEach(cleanup);

const editorText = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.cm-line'))
    .map((line) => line.textContent)
    .join('\n');

describe('CodeEditor 값 동기화 (P1-09: 황금키 정답·다음 단계 코드가 에디터에 보이게)', () => {
  it('바깥에서 value를 바꾸면 에디터 내용이 바뀌고 onChange로 같은 값을 알린다', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CodeEditor value="x = ___" onChange={onChange} />,
    );
    expect(editorText(container)).toBe('x = ___');

    rerender(<CodeEditor value={'x = 10\nprint(x)'} onChange={onChange} />);
    expect(editorText(container)).toBe('x = 10\nprint(x)');
    expect(onChange).toHaveBeenLastCalledWith('x = 10\nprint(x)');
  });

  it('값이 에디터 내용과 같으면(타자로 바뀐 값이 돌아온 경우) 다시 쓰지 않는다', () => {
    const onChange = vi.fn();
    const { rerender } = render(<CodeEditor value="a" onChange={onChange} />);
    rerender(<CodeEditor value="a" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});
