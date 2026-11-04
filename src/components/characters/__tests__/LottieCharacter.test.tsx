// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let reduceMotion = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, useReducedMotion: () => reduceMotion };
});

import { LottieCharacter } from '../LottieCharacter';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  reduceMotion = false;
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
    reduceMotion = true;

    const { container } = render(
      <LottieCharacter
        character="pybaem"
        animation="project-complete"
        size={96}
      />,
    );
    expect(
      container.querySelector('span[aria-hidden]'),
    ).not.toBeInTheDocument();
    expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
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
