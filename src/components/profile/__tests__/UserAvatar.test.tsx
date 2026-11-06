// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UserAvatar } from '../UserAvatar';
import { PYBAEM_SKINS } from '@/lib/avatar/skins';

afterEach(cleanup);

describe('UserAvatar (P3-13)', () => {
  it.each(PYBAEM_SKINS.map((s) => [s.id, s.palette.body] as const))(
    '%s 스킨의 파이뱀을 그린다 (몸색 %s)',
    (id, body) => {
      const { getByTestId } = render(<UserAvatar skin={id} size={32} />);
      const el = getByTestId('user-avatar');
      expect(el).toHaveAttribute('data-skin', id);
      expect(el.querySelector(`ellipse[fill="${body}"]`)).not.toBeNull();
    },
  );

  it('장식이라 낭독기에 숨기고, 사진(img)을 쓰지 않는다', () => {
    const { getByTestId } = render(<UserAvatar skin="sky" size={96} />);
    const el = getByTestId('user-avatar');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelector('img, image')).toBeNull();
    expect(el.style.width).toBe('96px');
    expect(el.querySelector('svg')).toHaveAttribute('width', '96');
  });

  it('스킨이 없거나 모르는 값이면 기본 숲초록', () => {
    for (const skin of [null, undefined, 'rainbow']) {
      const { getByTestId } = render(<UserAvatar skin={skin} />);
      expect(getByTestId('user-avatar')).toHaveAttribute('data-skin', 'green');
      cleanup();
    }
  });
});
