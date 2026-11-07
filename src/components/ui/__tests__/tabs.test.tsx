// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { SegmentedTabs } from '../tabs';

// 세그먼트 탭 (P2-11): WAI-ARIA 탭 역할, roving tabindex, 화살표·Home·End

const ITEMS = [
  { value: 'story', label: '이야기', panelId: 'p-story' },
  { value: 'code', label: '코드' },
  { value: 'result', label: '결과' },
] as const;

function Harness() {
  const [v, setV] = useState<(typeof ITEMS)[number]['value']>('story');
  return (
    <>
      <SegmentedTabs
        items={ITEMS}
        value={v}
        onValueChange={setV}
        aria-label="퀘스트 화면"
        idBase="qt"
      />
      <output data-testid="value">{v}</output>
    </>
  );
}

afterEach(cleanup);

describe('SegmentedTabs', () => {
  it('tablist + tab + aria-selected, 고른 탭만 Tab 순서에 들어간다', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: '퀘스트 화면' });
    const tabs = screen.getAllByRole('tab');
    expect(list).toContainElement(tabs[0]);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
    ]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
    expect(tabs[0]).toHaveAttribute('id', 'qt-story');
    expect(tabs[0]).toHaveAttribute('aria-controls', 'p-story');
  });

  it('누르면 고르고, 엄지 위치(--g-seg-i)가 따라간다', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('tab', { name: '결과' }));
    expect(screen.getByTestId('value')).toHaveTextContent('result');
    expect(
      screen.getByRole('tablist').style.getPropertyValue('--g-seg-i'),
    ).toBe('2');
  });

  it('→·← 는 옮기며 바로 고르고 끝에서 돌아간다, Home·End', () => {
    render(<Harness />);
    const first = screen.getByRole('tab', { name: '이야기' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(screen.getByTestId('value')).toHaveTextContent('result');
    expect(screen.getByRole('tab', { name: '결과' })).toHaveFocus();

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByTestId('value')).toHaveTextContent('story');

    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByTestId('value')).toHaveTextContent('result');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(screen.getByTestId('value')).toHaveTextContent('story');
    expect(screen.getByRole('tab', { name: '이야기' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
});
