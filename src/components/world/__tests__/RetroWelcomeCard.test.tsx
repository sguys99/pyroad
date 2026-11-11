// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { RetroWelcomeCard } from '../RetroWelcomeCard';

vi.mock('@/components/providers/soundContext', () => ({
  useSfx: () => () => {},
}));

// 그동안의 모험 보상 (P8-11): 별·코인 요약, 업적 받기 가능 안내, 닫으면 사라지고 본 기록 요청

afterEach(cleanup);

describe('RetroWelcomeCard', () => {
  it('별 보상·코인을 보여 주고 "좋아요!"로 닫음', () => {
    const onDismiss = vi.fn();
    render(
      <RetroWelcomeCard
        retro={{ stars: 12, coins: 1250 }}
        achievementsReady={0}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+1,250')).toBeInTheDocument();
    expect(screen.queryByText('업적 보러 가기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('retro-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('retro-welcome')).not.toBeInTheDocument();
  });

  it('별 보상이 없으면 코인 칸만, 받을 업적이 있으면 도감 링크', () => {
    render(
      <RetroWelcomeCard
        retro={{ stars: 0, coins: 140 }}
        achievementsReady={3}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText('별 보상')).not.toBeInTheDocument();
    expect(screen.getByText(/받을 수 있는 업적이 3개/)).toBeInTheDocument();
    expect(screen.getByText('업적 보러 가기').closest('a')).toHaveAttribute(
      'href',
      '/profile/achievements',
    );
  });
});
