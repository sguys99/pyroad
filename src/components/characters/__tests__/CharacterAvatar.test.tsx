// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CharacterAvatar } from '../CharacterAvatar';

afterEach(cleanup);

describe('CharacterAvatar', () => {
  describe('캐릭터별 SVG 렌더링', () => {
    it('pybaem 캐릭터를 렌더링한다', () => {
      const { container } = render(<CharacterAvatar character="pybaem" expression="happy" />);
      expect(container.querySelector('svg[aria-label*="파이뱀"]')).toBeInTheDocument();
    });

    it('bugbug 캐릭터를 렌더링한다', () => {
      const { container } = render(<CharacterAvatar character="bugbug" expression="searching" />);
      expect(container.querySelector('svg[aria-label*="버그버그"]')).toBeInTheDocument();
    });

    it('byeolttongi 캐릭터를 렌더링한다', () => {
      const { container } = render(<CharacterAvatar character="byeolttongi" expression="flying" />);
      expect(container.querySelector('svg[aria-label*="별똥이"]')).toBeInTheDocument();
    });
  });

  describe('사이즈', () => {
    it.each([
      ['sm', 32],
      ['md', 64],
      ['lg', 128],
    ] as const)('%s 사이즈는 %dpx SVG를 렌더링한다', (size, expectedPx) => {
      const { container } = render(
        <CharacterAvatar character="pybaem" expression="happy" size={size} />,
      );
      const svg = container.querySelector('svg[role="img"]');
      expect(svg).toHaveAttribute('width', String(expectedPx));
      expect(svg).toHaveAttribute('height', String(expectedPx));
    });

    it('기본 사이즈는 md (64px)', () => {
      const { container } = render(<CharacterAvatar character="pybaem" expression="happy" />);
      const svg = container.querySelector('svg[role="img"]');
      expect(svg).toHaveAttribute('width', '64');
    });
  });

  describe('data-testid', () => {
    it('character-expression 형태의 data-testid를 갖는다', () => {
      const { container } = render(
        <CharacterAvatar character="pybaem" expression="teaching" />,
      );
      expect(
        container.querySelector('[data-testid="character-avatar-pybaem-teaching"]'),
      ).toBeInTheDocument();
    });

    it('표정이 변경되면 data-testid도 변경된다', () => {
      const { rerender, container } = render(
        <CharacterAvatar character="pybaem" expression="happy" />,
      );
      expect(
        container.querySelector('[data-testid="character-avatar-pybaem-happy"]'),
      ).toBeInTheDocument();

      rerender(<CharacterAvatar character="pybaem" expression="celebrating" />);
      expect(
        container.querySelector('[data-testid="character-avatar-pybaem-celebrating"]'),
      ).toBeInTheDocument();
    });
  });

  describe('접근성', () => {
    it('SVG에 role="img"와 aria-label이 설정되어 있다', () => {
      const { container } = render(<CharacterAvatar character="pybaem" expression="happy" />);
      const svg = container.querySelector('svg[role="img"]');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-label');
    });
  });

  describe('pybaem 표정', () => {
    const expressions = [
      'happy', 'thinking', 'celebrating', 'encouraging', 'surprised',
      'teaching', 'waving', 'sleeping', 'confused', 'proud',
    ] as const;

    it.each(expressions)('%s 표정을 렌더링한다', (expr) => {
      const { container } = render(<CharacterAvatar character="pybaem" expression={expr} />);
      expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
    });
  });

  describe('bugbug 표정', () => {
    it.each(['searching', 'found', 'fixed'] as const)(
      '%s 표정을 렌더링한다',
      (expr) => {
        const { container } = render(<CharacterAvatar character="bugbug" expression={expr} />);
        expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
      },
    );
  });

  describe('byeolttongi 표정', () => {
    it.each(['flying', 'landing', 'sparkling'] as const)(
      '%s 표정을 렌더링한다',
      (expr) => {
        const { container } = render(<CharacterAvatar character="byeolttongi" expression={expr} />);
        expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
      },
    );
  });
});
