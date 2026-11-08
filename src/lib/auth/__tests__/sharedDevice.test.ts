// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  SHARED_DEVICE_STORAGE_KEY,
  readSharedDevice,
  resetSharedDeviceMemory,
  writeSharedDevice,
} from '../sharedDevice';

// 공용 기기 표시 (P4-09): 이 기기 localStorage, 기본 꺼짐, 저장소 오류에도 안전

afterEach(() => {
  window.localStorage.clear();
  resetSharedDeviceMemory();
});

describe('sharedDevice', () => {
  it('기본 꺼짐, 켜면 "1", 끄면 키를 지운다', () => {
    expect(readSharedDevice()).toBe(false);
    expect(writeSharedDevice(true)).toBe(true);
    expect(window.localStorage.getItem(SHARED_DEVICE_STORAGE_KEY)).toBe('1');
    expect(readSharedDevice()).toBe(true);
    writeSharedDevice(false);
    expect(window.localStorage.getItem(SHARED_DEVICE_STORAGE_KEY)).toBeNull();
    expect(readSharedDevice()).toBe(false);
  });

  it('다른 값은 꺼짐으로 읽는다', () => {
    window.localStorage.setItem(SHARED_DEVICE_STORAGE_KEY, 'true');
    expect(readSharedDevice()).toBe(false);
  });

  it('저장소가 없거나 예외를 던지면 꺼짐 · 저장 실패 false', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readSharedDevice(broken)).toBe(false);
    expect(readSharedDevice(null)).toBe(false);
    // 저장은 실패해도 이 페이지 안에서는 고른 값이 유지된다 (체크가 바로 효과)
    expect(writeSharedDevice(true, broken)).toBe(false);
    expect(readSharedDevice(broken)).toBe(true);
    expect(writeSharedDevice(false, null)).toBe(false);
    expect(readSharedDevice(null)).toBe(false);
  });
});
