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

describe('CodeEditorHandle.insert (P6-04 코드 키보드 연결점)', () => {
  it('커서 자리에 글자를 넣고 caret 자리로 커서를 옮긴다', () => {
    const onChange = vi.fn();
    const ref = createRef<CodeEditorHandle>();
    render(<CodeEditor ref={ref} value="ab" onChange={onChange} />);
    ref.current!.insert('print()', 6);
    expect(onChange).toHaveBeenLastCalledWith('print()ab');
    ref.current!.insert('x');
    expect(onChange).toHaveBeenLastCalledWith('print(x)ab');
  });
});
