// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';

const confettiMock = vi.fn<(options?: unknown) => null>(() => null);
vi.mock('canvas-confetti', () => ({ default: confettiMock }));

import { fireConfetti } from '../confetti';

describe('fireConfetti', () => {
  it('항상 disableForReducedMotion: true로 발사한다 (B33)', async () => {
    fireConfetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock).toHaveBeenCalledWith({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.6 },
      disableForReducedMotion: true,
    });
  });

  it('호출하는 쪽이 옵션을 넘겨도 reduced-motion 존중은 끌 수 없다', async () => {
    confettiMock.mockClear();
    // 타입으로 막혀 있지만 런타임에서도 덮어쓰지 못하는지 확인
    fireConfetti({
      particleCount: 10,
      disableForReducedMotion: false,
    } as Parameters<typeof fireConfetti>[0]);

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({
      disableForReducedMotion: true,
    });
  });
});
