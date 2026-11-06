// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef } from 'react';
import { PybaemRig, BugBugRig, ByeolttongiRig } from '../MascotRig';
import type { RigHandle } from '../LiveRig';
import type { PybaemState } from '../pybaem';

afterEach(cleanup);

const nextFrame = () =>
  act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

describe('MascotRig (앱 래퍼)', () => {
  it('세 캐릭터를 그리고, 기존 표정 이름도 받는다', () => {
    const { container } = render(
      <>
        <PybaemRig expression="thinking" size={120} />
        <BugBugRig expression="fixed" size={120} />
        <ByeolttongiRig expression="sparkling" size={120} />
      </>,
    );
    expect(
      container.querySelector('svg[aria-label="파이뱀 선생님 - 생각"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('svg[aria-label="버그버그 - 화해"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('svg[aria-label="별똥이 - 반짝"]'),
    ).not.toBeNull();
  });

  it('엔진은 첫 프레임 뒤에 만든다 (첫 렌더는 정적 geometry)', async () => {
    const ref = createRef<RigHandle<PybaemState>>();
    render(<PybaemRig ref={ref} state="happy" tier="minimal" />);
    expect(ref.current?.engine()).toBeNull();
    await nextFrame();
    expect(ref.current?.engine()?.state).toBe('happy');
    expect(ref.current?.engine()?.policy.mode).toBe('transitions');
  });

  it('언마운트하면 엔진을 멈춘다', async () => {
    const ref = createRef<RigHandle<PybaemState>>();
    const { unmount } = render(<PybaemRig ref={ref} />);
    await nextFrame();
    const e = ref.current!.engine()!;
    unmount();
    expect(e.isRunning()).toBe(false);
  });
});
