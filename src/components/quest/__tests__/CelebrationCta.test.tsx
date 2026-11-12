// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  CTA_FOCUS_DELAY_MS,
  CelebrationCta,
  CtaAutoFocus,
} from '../celebrations/parts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CelebrationCta 포커스', () => {
  it('카드가 뜨고 잠시 뒤 포커스를 받는다', () => {
    vi.useFakeTimers();
    render(<CelebrationCta>좋아요</CelebrationCta>);
    act(() => vi.advanceTimersByTime(CTA_FOCUS_DELAY_MS));
    expect(screen.getByTestId('celebration-cta')).toHaveFocus();
  });

  it('CtaAutoFocus=false(카탈로그 견본)면 포커스를 옮기지 않는다 (B61)', () => {
    vi.useFakeTimers();
    render(
      <CtaAutoFocus.Provider value={false}>
        <CelebrationCta>좋아요</CelebrationCta>
      </CtaAutoFocus.Provider>,
    );
    act(() => vi.advanceTimersByTime(CTA_FOCUS_DELAY_MS));
    expect(screen.getByTestId('celebration-cta')).not.toHaveFocus();
  });
});
