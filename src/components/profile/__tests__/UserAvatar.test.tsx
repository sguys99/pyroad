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

  it('꾸민 모습 (P9-05): 모자는 그림에 들어가고 칩 안으로 줄여 내림, 테두리는 칩 위 고리', () => {
    const { getByTestId } = render(
      <UserAvatar
        skin="sky"
        costume={{ hat: 'wizard' }}
        frame="star"
        size={32}
      />,
    );
    const el = getByTestId('user-avatar');
    expect(el).toHaveAttribute('data-hat', 'wizard');
    expect(el).toHaveAttribute('data-frame', 'star');
    expect(el.querySelector('[data-hat="wizard"]')).not.toBeNull();
    expect(el.querySelector('svg')!.getAttribute('class')).toContain(
      'scale-[0.8]',
    );
    expect(el.querySelector('svg.avatar-frame')).toHaveAttribute(
      'data-art',
      'star',
    );
    expect(el.style.width).toBe('32px');
  });

  it('모르는 테두리는 그리지 않고, 모자가 없으면 줄이지 않음', () => {
    const { getByTestId } = render(<UserAvatar frame="rainbow" size={48} />);
    const el = getByTestId('user-avatar');
    expect(el.querySelector('svg.avatar-frame')).toBeNull();
    expect(el.querySelector('svg')!.getAttribute('class')).not.toContain(
      'scale-',
    );
  });
});
