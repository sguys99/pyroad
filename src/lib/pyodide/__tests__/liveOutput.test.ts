import { describe, it, expect, vi } from 'vitest';
import { createLiveOutputStore } from '../liveOutput';

describe('createLiveOutputStore (실행 중 stdout)', () => {
  it('조각을 이어 붙이고 구독자에게 알린다', () => {
    const store = createLiveOutputStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.append('안녕\n');
    store.append('파이뱀\n');
    expect(store.getSnapshot()).toMatchObject({
      text: '안녕\n파이뱀\n',
      clipped: false,
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('상한을 넘으면 앞부분만 남기고 clipped, 그 뒤 조각은 무시한다', () => {
    const store = createLiveOutputStore(5);
    store.append('123');
    store.append('4567');
    expect(store.getSnapshot()).toMatchObject({ text: '12345', clipped: true });
    const before = store.getSnapshot();
    store.append('8');
    expect(store.getSnapshot()).toBe(before);
  });

  it('reset 하면 비고, 이미 비어 있으면 알리지 않는다', () => {
    const store = createLiveOutputStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.reset();
    expect(listener).not.toHaveBeenCalled();
    store.append('a');
    store.reset();
    expect(store.getSnapshot().text).toBe('');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    store.append('b');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('getSnapshot은 바뀌지 않으면 같은 객체 (useSyncExternalStore 요구 사항)', () => {
    const store = createLiveOutputStore();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
    store.append('x');
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('input() 대기: ask → waiting, answer는 그때 글자 자리와 함께 기록하고 요청에 전달 (P11-01)', () => {
    const store = createLiveOutputStore();
    const answer = vi.fn();
    const stop = vi.fn();
    store.append('이름? ');
    store.ask({ answer, stop });
    expect(store.getSnapshot().waiting).toBe(true);
    store.answer('철수');
    expect(answer).toHaveBeenCalledWith('철수');
    expect(store.getSnapshot()).toMatchObject({
      waiting: false,
      inputs: [{ at: 4, value: '철수' }],
    });
    // 기다리지 않을 때 답은 무시, 멈추기는 이번 실행에 그대로 간다
    store.answer('또');
    expect(answer).toHaveBeenCalledTimes(1);
    store.stopInput();
    expect(stop).toHaveBeenCalledTimes(1);
    store.reset();
    store.stopInput();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().inputs).toEqual([]);
  });
});
