// @vitest-environment jsdom
import { createRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { CodeEditor, type CodeEditorHandle } from '../CodeEditor';
import { ResetCodeButton } from '../CodePanel';

// 공책 머리 "처음 코드로"와 에디터 손잡이 (P6-03)

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => vi.fn(),
}));

afterEach(cleanup);

const resetButton = () =>
  screen.getByRole('button', { name: '처음 코드로' }) as HTMLButtonElement;

describe('ResetCodeButton', () => {
  it('코드가 시작 코드와 같으면 꺼져 있다', () => {
    render(<ResetCodeButton changed={false} onReset={vi.fn()} />);
    expect(resetButton().disabled).toBe(true);
  });

  it('고친 코드가 있으면 한 번 묻고, 확인해야 되돌린다', async () => {
    const onReset = vi.fn();
    render(<ResetCodeButton changed onReset={onReset} />);
    fireEvent.click(resetButton());
    await screen.findByRole('alertdialog');
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('reset-code-confirm'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('그대로 두기를 누르면 되돌리지 않는다', async () => {
    const onReset = vi.fn();
    render(<ResetCodeButton changed onReset={onReset} />);
    fireEvent.click(resetButton());
    await screen.findByRole('alertdialog');
    fireEvent.click(screen.getByRole('button', { name: '그대로 두기' }));
    expect(onReset).not.toHaveBeenCalled();
  });
});

describe('CodeEditorHandle (P6-04 코드 키보드 연결점)', () => {
  it('커서는 코드 끝에서 시작하고, 커서 자리에 넣은 뒤 caret 자리로 옮긴다', () => {
    const onChange = vi.fn();
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} value="ab" onChange={onChange} />);
    ref.current!.insert('print()', 6);
    expect(onChange).toHaveBeenLastCalledWith('abprint()');
    ref.current!.insert('x');
    expect(onChange).toHaveBeenLastCalledWith('abprint(x)');
    // 커서 옮기기 → 닫는 괄호 뒤에 넣기, 되돌리기
    ref.current!.moveCursor(1);
    ref.current!.insert('!');
    expect(onChange).toHaveBeenLastCalledWith('abprint(x)!');
    ref.current!.moveCursor(-1);
    ref.current!.insert('#');
    expect(onChange).toHaveBeenLastCalledWith('abprint(x)#!');
    ref.current!.undo();
    expect(onChange).toHaveBeenLastCalledWith('abprint(x)!');
  });
});

describe('CodeKeyboard (P6-04)', () => {
  it('키를 누르면 에디터에 넣고, 화살표 키로 키 사이를 옮겨 다닌다', async () => {
    const { default: CodeKeyboard } = await import('../CodeKeyboard');
    const onChange = vi.fn();
    const ref = createRef<CodeEditorHandle>();
    render(
      <>
        <CodeEditor ref={ref} value="" onChange={onChange} />
        <CodeKeyboard editor={ref} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'print 주문 넣기' }));
    fireEvent.click(screen.getByRole('button', { name: '따옴표 한 쌍 넣기' }));
    expect(onChange).toHaveBeenLastCalledWith('print("")');

    const toolbar = screen.getByRole('toolbar', { name: '코드 키보드' });
    const keys = Array.from(toolbar.querySelectorAll('button'));
    expect(keys.filter((k) => k.tabIndex === 0)).toHaveLength(1);
    keys[0].focus();
    fireEvent.keyDown(toolbar, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(keys[1]);
    fireEvent.keyDown(toolbar, { key: 'End' });
    expect(document.activeElement).toBe(keys[keys.length - 1]);
    expect(keys[keys.length - 1].tabIndex).toBe(0);
    expect(keys[0].tabIndex).toBe(-1);
  });
});
