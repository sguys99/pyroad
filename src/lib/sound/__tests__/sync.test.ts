import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSoundSettingsSaver } from '../sync';
import { DEFAULT_SOUND_SETTINGS } from '../settings';

const at = (updatedAt: number) => ({ ...DEFAULT_SOUND_SETTINGS, updatedAt });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('사운드 설정 서버 저장기', () => {
  it('켜기 전(비로그인)에는 보내지 않음', async () => {
    const send = vi.fn(async () => true);
    const saver = createSoundSettingsSaver({ send, debounceMs: 100 });
    saver.save(at(1));
    await vi.advanceTimersByTimeAsync(200);
    expect(send).not.toHaveBeenCalled();
    expect(saver.getStatus()).toBe('idle');
  });

  it('슬라이더처럼 연달아 바꾸면 마지막 값만 한 번 보냄 → saved → idle', async () => {
    const send = vi.fn(async () => true);
    const saver = createSoundSettingsSaver({
      send,
      debounceMs: 100,
      savedResetMs: 500,
    });
    saver.enable();
    saver.save(at(1));
    saver.save(at(2));
    saver.save(at(3));
    expect(saver.getStatus()).toBe('saving');
    await vi.advanceTimersByTimeAsync(150);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(at(3));
    expect(saver.getStatus()).toBe('saved');
    await vi.advanceTimersByTimeAsync(600);
    expect(saver.getStatus()).toBe('idle');
  });

  it('요청은 순서대로 하나씩, 실패하면 error', async () => {
    const order: number[] = [];
    let release!: () => void;
    const send = vi.fn(async (s: { updatedAt: number }) => {
      order.push(s.updatedAt);
      if (s.updatedAt === 1)
        await new Promise<void>((r) => {
          release = r;
        });
      return s.updatedAt !== 2;
    });
    const saver = createSoundSettingsSaver({ send, debounceMs: 10 });
    saver.enable();
    saver.save(at(1));
    await vi.advanceTimersByTimeAsync(20);
    saver.save(at(2));
    await vi.advanceTimersByTimeAsync(20);
    expect(order).toEqual([1]); // 첫 요청이 끝나기 전에는 둘째를 보내지 않음
    release();
    await vi.advanceTimersByTimeAsync(20);
    expect(order).toEqual([1, 2]);
    expect(saver.getStatus()).toBe('error');
  });

  it('disable하면 기다리던 값은 버림', async () => {
    const send = vi.fn(async () => true);
    const saver = createSoundSettingsSaver({ send, debounceMs: 100 });
    saver.enable();
    saver.save(at(1));
    saver.disable();
    await vi.advanceTimersByTimeAsync(200);
    expect(send).not.toHaveBeenCalled();
  });
});
