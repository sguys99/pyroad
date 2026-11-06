// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';
import type { MotionTier } from '@/lib/motion/tier';
import { DURATION } from '@/lib/motion/tokens';
import { ProgressBar } from '../progress-bar';
import { CurrencyHud, HudCounter, LevelSeal, formatCompact } from '../hud';

// 진행바·재화 HUD (P2-11): 접근성 값, scaleX 변수, 오름 연출, 카운트업·팝의 단계별 분기

const animate = vi.fn();

function at(ui: React.ReactNode, tier: MotionTier = 'full', reduced = false) {
  return (
    <MotionTierProvider tier={tier} reduced={reduced ? 'on' : 'off'}>
      {ui}
    </MotionTierProvider>
  );
}

beforeEach(() => {
  animate.mockReset();
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate'];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

const flushRaf = () =>
  act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });

describe('ProgressBar', () => {
  it('progressbar 역할과 값(넘치면 자름), 채움은 --g-prog(0~1) → scaleX', async () => {
    render(
      <ProgressBar
        value={150}
        max={200}
        label="경험치"
        valueText="150 / 200"
      />,
    );
    const bar = screen.getByRole('progressbar', { name: '경험치' });
    expect(bar).toHaveAttribute('aria-valuenow', '150');
    expect(bar).toHaveAttribute('aria-valuemax', '200');
    expect(bar).toHaveAttribute('aria-valuetext', '150 / 200');
    await flushRaf();
    expect(bar.style.getPropertyValue('--g-prog')).toBe('0.75');

    cleanup();
    render(<ProgressBar value={999} max={10} label="넘침" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '10',
    );
  });

  it('animateOnMount: 0에서 시작해 다음 프레임에 값으로', async () => {
    render(<ProgressBar value={50} label="xp" animateOnMount />);
    const bar = screen.getByRole('progressbar');
    expect(bar.style.getPropertyValue('--g-prog')).toBe('0');
    await flushRaf();
    expect(bar.style.getPropertyValue('--g-prog')).toBe('0.5');
  });

  it('값이 오를 때만 data-rising을 a/b로 번갈아 바꾼다 (같은 키프레임 재생)', () => {
    const { rerender } = render(<ProgressBar value={10} label="p" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('data-rising');
    rerender(<ProgressBar value={20} label="p" />);
    expect(bar).toHaveAttribute('data-rising', 'a');
    rerender(<ProgressBar value={30} label="p" />);
    expect(bar).toHaveAttribute('data-rising', 'b');
    rerender(<ProgressBar value={5} label="p" />);
    expect(bar).toHaveAttribute('data-rising', 'b');
  });
});

describe('HUD', () => {
  it('formatCompact: 9,999까지 그대로, 만·억 단위로 줄인다', () => {
    expect(formatCompact(9999)).toBe('9,999');
    expect(formatCompact(12_000)).toBe('1.2만');
    expect(formatCompact(30_000)).toBe('3만');
    expect(formatCompact(150_000_000)).toBe('1.5억');
  });

  it('칩은 낭독기에 "코인 12,345개"를 한 번에, 보이는 숫자는 aria-hidden(hud-num 고정 폭)', () => {
    render(at(<HudCounter kind="coin" value={12_345} />));
    const chip = screen.getByTestId('hud-coin');
    expect(chip).toHaveTextContent('코인 12,345개');
    const num = chip.querySelector('.hud-num')!;
    expect(num).toHaveAttribute('aria-hidden', 'true');
    // 모바일 축약본이 함께 있다 (CSS로 하나만 보임)
    expect(num.textContent).toContain('1.2만');
  });

  it('full·lite: 값이 오르면 칩 팝(prop 스프링 WAAPI) + 카운트업', async () => {
    const { rerender } = render(at(<HudCounter kind="star" value={3} />));
    rerender(at(<HudCounter kind="star" value={5} />));
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0][0][0].transform).toContain('scale(1.25)');
    // 카운트업 중에도 낭독기 문장은 최종 값
    expect(screen.getByTestId('hud-star')).toHaveTextContent('별 5개');
  });

  it.each([
    ['minimal', false],
    ['full', true],
  ] as const)(
    '%s · 동작 줄이기=%s: 움직이지 않고 숫자를 바로 바꾸고 칩을 금색 틴트로 잠깐(data-flash)',
    (tier, reduced) => {
      vi.useFakeTimers();
      const { rerender } = render(
        at(<HudCounter kind="coin" value={100} />, tier, reduced),
      );
      rerender(at(<HudCounter kind="coin" value={140} />, tier, reduced));
      const chip = screen.getByTestId('hud-coin');
      expect(animate).not.toHaveBeenCalled();
      expect(chip).toHaveAttribute('data-flash');
      expect(chip.querySelector('.hud-num')).toHaveTextContent('140');
      act(() => {
        vi.advanceTimersByTime(DURATION.progress);
      });
      expect(chip).not.toHaveAttribute('data-flash');
    },
  );

  it('레벨 도장은 "레벨 N"으로 읽힌다', () => {
    render(at(<LevelSeal level={7} />));
    expect(screen.getByTestId('level-seal')).toHaveTextContent('레벨 7');
  });

  it('CurrencyHud: 넘긴 재화만 그리고, 황금키는 keys가 있을 때만', () => {
    render(
      at(
        <CurrencyHud
          level={3}
          xp={{ value: 40, max: 100 }}
          coins={120}
          stars={9}
          end={<button type="button">소리</button>}
        />,
      ),
    );
    expect(screen.getByRole('group', { name: '내 레벨과 보물' })).toBeVisible();
    expect(screen.getByTestId('hud-coin')).toBeInTheDocument();
    expect(screen.getByTestId('hud-star')).toBeInTheDocument();
    expect(screen.queryByTestId('hud-key')).toBeNull();
    expect(
      screen.getByRole('progressbar', { name: '다음 레벨까지 경험치' }),
    ).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByRole('button', { name: '소리' })).toBeInTheDocument();
  });
});
