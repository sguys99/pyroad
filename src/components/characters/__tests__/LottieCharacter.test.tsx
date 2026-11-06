// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { LottieCharacter } from '../LottieCharacter';
import { MotionTierProvider } from '@/lib/motion/MotionTierProvider';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LottieCharacter (B32: Lottie 대신 정적 SVG + 1회성 연출)', () => {
  it('Lottie JSON을 받지 않고 표정이 있는 정적 CharacterAvatar를 그린다', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { container } = render(
      <LottieCharacter
        character="pybaem"
        animation="level-up"
        size={96}
        expression="celebrating"
      />,
    );

    expect(
      container.querySelector(
        '[data-testid="character-avatar-pybaem-celebrating"]',
      ),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="lottie-character-pybaem"]'),
    ).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('size를 픽셀 그대로 SVG에 쓴다', () => {
    const { container } = render(
      <LottieCharacter
        character="pybaem"
        animation="entrance"
        size={128}
        expression="waving"
      />,
    );

    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('width', '128');
    expect(
      container.querySelector('[data-testid="character-motion-entrance"]'),
    ).toHaveStyle({ width: '128px', height: '128px' });
  });

  it('축하 연출에는 착지 빛 고리가 있고, 등장 연출에는 없다', () => {
    const { container, rerender } = render(
      <LottieCharacter character="pybaem" animation="level-up" size={96} />,
    );
    expect(container.querySelector('span[aria-hidden]')).toBeInTheDocument();

    rerender(
      <LottieCharacter character="pybaem" animation="entrance" size={96} />,
    );
    expect(
      container.querySelector('span[aria-hidden]'),
    ).not.toBeInTheDocument();
  });

  it('reduced-motion이면 빛 고리를 그리지 않는다', () => {
    const { container } = render(
      <MotionTierProvider reduced="on">
        <LottieCharacter
          character="pybaem"
          animation="project-complete"
          size={96}
        />
      </MotionTierProvider>,
    );
    expect(
      container.querySelector('span[aria-hidden]'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
  });

  it('minimal 단계면 빛 고리(곁가지 이펙트)를 그리지 않는다 (P2-15)', () => {
    const { container } = render(
      <MotionTierProvider tier="minimal">
        <LottieCharacter character="pybaem" animation="level-up" size={96} />
      </MotionTierProvider>,
    );
    expect(
      container.querySelector('span[aria-hidden]'),
    ).not.toBeInTheDocument();
  });

  it('animated면 숨쉬기를 CSS 클래스로 건다 (Framer repeat: Infinity 금지, §2.10)', () => {
    const { container } = render(
      <LottieCharacter
        character="pybaem"
        animation="entrance"
        size={128}
        expression="waving"
        animated
        onHover="happy"
      />,
    );
    expect(container.querySelector('.character-breathe')).toBeInTheDocument();
  });
});
