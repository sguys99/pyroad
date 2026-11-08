// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 랜딩 로그인 CTA (P3-05 → P4-09): 누르면 시트 모듈을 불러와 **닫힌 채 한 번 그린 뒤** 연다(첫 열림에도 등장 연출),
// cta·맥락·제목을 시트로 넘긴다

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));
vi.mock('@/fonts/landing', () => ({
  displayLanding: { variable: '__d' },
  sansLanding: { variable: '__s' },
}));

/** 가짜 시트: 받은 open 값의 역사를 남긴다 */
const opens: boolean[] = [];
vi.mock('../LoginSheet', () => ({
  LoginSheet: (props: {
    open: boolean;
    cta?: string;
    context?: string;
    heading?: string;
    className?: string;
  }) => {
    opens.push(props.open);
    return (
      <div
        data-testid="fake-sheet"
        data-open={String(props.open)}
        data-cta={props.cta}
        data-context={props.context ?? ''}
        data-heading={props.heading ?? ''}
        className={props.className}
      />
    );
  },
}));

import { LoginSheetButton } from '../LoginSheetButton';

afterEach(() => {
  cleanup();
  opens.length = 0;
});

describe('LoginSheetButton', () => {
  it('처음 누르면 닫힌 시트를 먼저 그리고 다음 프레임에 연다', async () => {
    render(<LoginSheetButton cta="hero">모험 시작!</LoginSheetButton>);
    const button = screen.getByRole('button', { name: '모험 시작!' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('fake-sheet')).toBeNull();

    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByTestId('fake-sheet')).toHaveAttribute(
        'data-open',
        'true',
      ),
    );
    expect(opens[0]).toBe(false);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('fake-sheet')).toHaveClass('__d', '__s');
  });

  it('cta·context·heading을 시트로 넘긴다 (체험 성공 CTA, P4-03)', async () => {
    render(
      <LoginSheetButton cta="hero" context="trial" heading="별 3개! 저장하자">
        모험 저장하기
      </LoginSheetButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: '모험 저장하기' }));
    const sheet = await screen.findByTestId('fake-sheet');
    expect(sheet).toHaveAttribute('data-cta', 'hero');
    expect(sheet).toHaveAttribute('data-context', 'trial');
    expect(sheet).toHaveAttribute('data-heading', '별 3개! 저장하자');
  });
});
