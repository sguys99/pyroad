// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MyAvatar, MyLookProvider, useSetMyLook } from '../MyLook';

afterEach(cleanup);

let setLook: (c: unknown) => void = () => {};
function Grab() {
  setLook = useSetMyLook();
  return null;
}

describe('MyLookProvider (P9-05)', () => {
  it('레이아웃이 준 avatar_config 로 그리고, 상점이 장착하면 바로 바뀜', () => {
    render(
      <MyLookProvider config={{ skin: 'sky', hat: 'hat_party' }}>
        <Grab />
        <MyAvatar size={32} />
      </MyLookProvider>,
    );
    const el = screen.getByTestId('user-avatar');
    expect(el).toHaveAttribute('data-skin', 'sky');
    expect(el).toHaveAttribute('data-hat', 'party');
    act(() => setLook({ skin: 'sky', hat: 'hat_crown', frame: 'frame_wave' }));
    expect(el).toHaveAttribute('data-hat', 'crown');
    expect(el).toHaveAttribute('data-frame', 'wave');
  });

  it('공급자가 없으면 기본 파이뱀', () => {
    render(<MyAvatar size={32} />);
    const el = screen.getByTestId('user-avatar');
    expect(el).toHaveAttribute('data-skin', 'green');
    expect(el).not.toHaveAttribute('data-hat');
  });
});
